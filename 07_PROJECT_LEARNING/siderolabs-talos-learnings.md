# Forensic Learning Record (Deep Inspection): siderolabs/talos

> **Canonical Artifact**: `07_PROJECT_LEARNING/siderolabs-talos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/siderolabs/talos](https://github.com/siderolabs/talos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:58.199Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `siderolabs/talos`
- **Description**: Talos Linux is a modern Linux distribution built for Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11264 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/installer/cmd/imager/root.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package imager implements the imager command.
package imager

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/siderolabs/gen/xerrors"
	"github.com/siderolabs/gen/xslices"
	"github.com/spf13/cobra"
	"go.yaml.in/yaml/v4"

	"github.com/siderolabs/talos/cmd/installer/pkg/install"
	"github.com/siderolabs/talos/pkg/archiver"
	"github.com/siderolabs/talos/pkg/cli"
	"github.com/siderolabs/talos/pkg/imager"
	"github.com/siderolabs/talos/pkg/imager/profile"
	installerexitcode "github.com/siderolabs/talos/pkg/installer/exitcode"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/overlay"
	"github.com/siderolabs/talos/pkg/reporter"
)

var cmdFlags struct {
	Platform string
	Arch     string
	// Insecure can be set to true to force pull from insecure registry.
	Insecure              bool
	ExtraKernelArgs       []string
	MetaValues            install.MetaValues
	SystemExtensionImages []string
	BaseInstallerImage    string
	ImageCache            string
	EmbeddedConfigPath    string
	OutputPath            string
	OutputKind            string
	TarToStdout           bool
	OverlayName           string
	OverlayImage          string
	OverlayOptions        []string
	// Only used when generating a secure boot iso without also providing a secure boot database.
	SecurebootIncludeWellKnownCerts bool
	SecurebootSignerAddress         string
	PCRSignerAddress                string
	SecurebootEnrollKeys            string
}

// rootCmd represents the base command when called without any subcommands.
var rootCmd = &cobra.Command{
	Use:          "imager <profile>|-",
	Short:        "Generate various boot assets and images.",
	Long:         ``,
	Args:         cobra.ExactArgs(1),
	SilenceUsage: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()

		report := reporter.New()
		report.Report(reporter.Update{
			Message: "assembling the finalized profile...",
			Status:  reporter.StatusRunning,
		})

		baseProfile := args[0]

		var prof profile.Profile

		if baseProfile == "-" {
			if err := yaml.NewDecoder(os.Stdin).Decode(&prof); err != nil {
				return xerrors.NewTaggedf[profile.InvalidInputTag]("%w", err)
			}
		} else {
			prof = profile.Profile{
				BaseProfileName: baseProfile,
				Arch:            cmdFlags.Arch,
				Platform:        cmdFlags.Platform,
				Customization: profile.CustomizationProfile{
					ExtraKernelArgs: cmdFlags.ExtraKernelArgs,
					MetaContents:    cmdFlags.MetaValues.GetMetaValues(),
				},
			}

			extraOverlayOptions := overlay.ExtraOptions{}

			for _, option := range cmdFlags.OverlayOptions {
				if strings.HasPrefix(option, "@") {
					data, err := os.ReadFile(option[1:])
					if err != nil {
						return xerrors.NewTaggedf[imager.IOTag]("%w", err)
					}

					decoder := yaml.NewDecoder(bytes.NewReader(data))
					decoder.KnownFields(true)

					if err := decoder.Decode(&extraOverlayOptions); err != nil {
						return xerrors.NewTaggedf[profile.InvalidInputTag]("%w", err)
					}

					continue
				}

				k, v, _ := strings.Cut(option, "=")

				if strings.HasPrefix(v, "@") {
					data, err := os.ReadFile(v[1:])
					if err != nil {
						return xerrors.NewTaggedf[imager.IOTag]("%w", err)
					}

					v = string(data)
				}

				extraOverlayOptions[k] = v
			}

			if cmdFlags.OverlayName != "" || cmdFlags.OverlayImage != "" {
				prof.Overlay = &profile.OverlayOptions{
					Name: cmdFlags.OverlayName,
					Image: profile.ContainerAsset{
						ImageRef: cmdFlags.OverlayImage,
					},
					ExtraOptions: extraOverlayOptions,
				}

				prof.Input.OverlayInstaller.ImageRef = cmdFlags.OverlayImage
			}

			prof.Input.SystemExtensions = xslices.Map(
				cmdFlags.SystemExtensionImages,
				func(imageRef string) profile.ContainerAsset {
					return profile.ContainerAsset{
						ImageRef:      imageRef,
						ForceInsecure: cmdFlags.Insecure,
					}
				},
			)

			if cmdFlags.OutputKind != "" {
				outKind, err := profile.OutputKindString(cmdFlags.OutputKind)
				if err != nil {
					return xerrors.NewTaggedf[profile.InvalidInputTag]("%w", err)
				}

				prof.Output.Kind = outKind
			}

			if cmdFlags.BaseInstallerImage != "" {
				prof.Input.BaseInstaller = profile.ContainerAsset{
					ImageRef:      cmdFlags.BaseInstallerImage,
					ForceInsecure: cmdFlags.Insecure,
				}
			}

			if cmdFlags.ImageCache != "" {
				parseOpts := []name.Option{name.StrictValidation}

				if cmdFlags.Insecure {
					parseOpts = append(parseOpts, name.Insecure)
				}

				if _, err := name.ParseReference(cmdFlags.ImageCache, parseOpts...); err == nil {
					prof.Input.ImageCache = profile.ContainerAsset{
						ImageRef:      cmdFlags.ImageCache,
						ForceInsecure: cmdFlags.Insecure,
					}
				} else {
					prof.Input.ImageCache = profile.ContainerAsset{
						OCIPath: cmdFlags.ImageCache,
					}
				}
			}

			if cmdFlags.SecurebootIncludeWellKnownCerts {
				if prof.Input.SecureBoot == nil {
					prof.Input.SecureBoot = &profile.SecureBootAssets{}
				}

				prof.Input.SecureBoot.IncludeWellKnownCerts = true
			}

			if cmdFlags.SecurebootSignerAddress != "" {
				if prof.Input.SecureBoot == nil {
					prof.Input.SecureBoot = &profile.SecureBootAssets{}
				}

				prof.Input.SecureBoot.SecureBootSigner.SignerAddress = cmdFlags.SecurebootSignerAddress
			}

			if cmdFlags.PCRSignerAddress != "" {
				if prof.Input.SecureBoot == nil {
					prof.Input.SecureBoot = &profile.SecureBootAssets{}
				}

				prof.Input.SecureBoot.PCRSigner.SignerAddress = cmdFlags.PCRSignerAddress
			}

			if err := applySDBootEnrollKeys(cmdFlags.SecurebootEnrollKeys, &prof.Output); err != nil {
				return err
			}

			if cmdFlags.EmbeddedConfigPath != "" {
				data, err := os.ReadFile(cmdFlags.EmbeddedConfigPath)
				if err != nil {
					return xerrors.NewTaggedf[imager.IOTag]("error reading embedded config file: %w", err)
				}

				prof.Customization.EmbeddedMachineConfiguration = string(data)
			}
		}

		if err := os.MkdirAll(cmdFlags.OutputPath, 0o755); err != nil {
			return xerrors.NewTaggedf[imager.IOTag]("%w", err)
		}

		imgr, err := imager.New(prof)
		if err != nil {
			return err
		}

		if _, err = imgr.Execute(ctx, cmdFlags.OutputPath, report); err != nil {
			report.Report(reporter.Update{
				Message: err.Error(),
				Status:  reporter.StatusError,
			})

			return err
		}

		if cmdFlags.TarToStdout {
			if err := archiver.TarGz(ctx, cmdFlags.OutputPath, os.Stdout); err != nil {
				return xerrors.NewTaggedf[imager.IOTag]("%w", err)
			}
		}

		return nil
	},
}

// applySDBootEnrollKeys applies the --secureboot-enroll-keys flag value to the output profile.
//
// The value is set on both the image and ISO options so it applies regardless of the base
// profile's output kind; the unused options struct is ignored downstream. An empty value is
// a no-op, leaving the base profile's default (if-safe) in place.
func applySDBootEnrollKeys(value string, output *profile.Output) error {
	if value == "" {
		return nil
	}

	enrollKeys, err := profile.SDBootEnrollKeysString(value)
	if err != nil {
		return xerrors.NewTaggedf[profile.InvalidInputTag]("invalid --secureboot-enroll-keys value: %w", err)
	}

	if output.ImageOptions == nil {
		output.ImageOptions = &profile.ImageOptions{}
	}

	output.ImageOptions.SDBootEnrollKeys = enrollKeys

	if output.ISOOptions == nil {
		output.ISOOptions = &profile.ISOOptions{}
	}

	output.ISOOptions.SDBootEnrollKeys = enrollKeys

	return nil
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(installe
```

### Core Architecture Module: `cmd/installer/cmd/installer/install.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package installer

import (
	"context"
	"errors"
	"log"

	"github.com/siderolabs/gen/xerrors"
	"github.com/spf13/cobra"

	"github.com/siderolabs/talos/cmd/installer/pkg/install"
	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/platform"
	"github.com/siderolabs/talos/pkg/machinery/config/configloader"
	"github.com/siderolabs/talos/pkg/machinery/version"
)

// installCmd represents the installation command.
var installCmd = &cobra.Command{
	Use:   "install",
	Short: "",
	Long:  ``,
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		return runInstallCmd(cmd.Context())
	},
}

func init() {
	rootCmd.AddCommand(installCmd)
}

//nolint:gocyclo
func runInstallCmd(ctx context.Context) (err error) {
	log.Printf("running Talos installer %s", version.NewVersion().Tag)

	mode := install.ModeInstall

	if options.Upgrade {
		mode = install.ModeUpgrade
	}

	p, err := platform.NewPlatform(options.Platform)
	if err != nil {
		return xerrors.NewTaggedf[install.InvalidInputTag]("%w", err)
	}

	config, err := configloader.NewFromStdin()
	if err != nil {
		if errors.Is(err, configloader.ErrNoConfig) {
			log.Printf("machine configuration missing, skipping validation")

			// machine configuration can be only missing while running an upgrade in maintenance mode, assume that we should follow GrubUseUKICmdline
			options.GrubUseUKICmdline = true
		} else {
			return xerrors.NewTaggedf[install.InvalidInputTag]("error loading machine configuration: %w", err)
		}
	} else {
		var warnings []string

		warnings, err = config.ValidateAsClient(p.Mode())
		if err != nil {
			return xerrors.NewTaggedf[install.InvalidInputTag]("machine configuration is invalid: %w", err)
		}

		if len(warnings) > 0 {
			log.Printf("WARNING: config validation:")

			for _, warning := range warnings {
				log.Printf("  %s", warning)
			}
		}

		// defaults from the deprecated .machine.install section (if present).
		legacyBIOSSupport := config.Machine() != nil && config.Machine().Install().LegacyBIOSSupport()

		// if we don't have v1alpha1 config (we are in maintenance mode),
		// or if we have v1alpha1 config, and GrubUseUKICmdline is set to true,
		// then we should set the option to true
		grubUseUKICmdline := config.Machine() == nil || config.Machine().Install().GrubUseUKICmdline()

		// A config with no .machine.install section has nowhere to hold extraKernelArgs, so there is no
		// legacy command line to preserve and the UKI is the only source for the kernel arguments. The
		// check above reads a missing setting the same as an explicit false, so look at the raw config.
		if raw := config.RawV1Alpha1(); raw != nil && raw.MachineConfig != nil && raw.MachineConfig.MachineInstall == nil { //nolint:staticcheck // legacy configuration
			grubUseUKICmdline = true
		}

		// the UnattendedInstallConfig document takes precedence over the deprecated .machine.install section.
		if config.UnattendedInstallConfig() != nil {
			// legacyBIOSSupport is not supported in the new config.
			legacyBIOSSupport = false

			// GrubUseUKICmdline is always true when UnattendedInstallConfig is used.
			grubUseUKICmdline = true
		}

		if legacyBIOSSupport {
			options.LegacyBIOSSupport = true
		}

		if grubUseUKICmdline {
			options.GrubUseUKICmdline = true
		}
	}

	return install.Install(ctx, p, mode, options)
}

```

### Core Architecture Module: `cmd/installer/cmd/installer/root.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package installer implements the installer command.
package installer

import (
	"fmt"
	"os"
	"runtime"
	"strconv"

	"github.com/siderolabs/gen/xerrors"
	"github.com/spf13/cobra"

	"github.com/siderolabs/talos/cmd/installer/pkg/install"
	installerexitcode "github.com/siderolabs/talos/pkg/installer/exitcode"
	"github.com/siderolabs/talos/pkg/machinery/constants"
)

// rootCmd represents the base command when called without any subcommands.
var rootCmd = &cobra.Command{
	Use:   "installer",
	Short: "",
	Long:  ``,
}

func setFlagsFromEnvironment() error {
	if value := os.Getenv(constants.InstallerGrubUseUKICmdlineEnvVar); value != "" {
		grubUseUKICmdline, err := strconv.ParseBool(value)
		if err != nil {
			return xerrors.NewTaggedf[install.InvalidInputTag]("invalid %s value: %w", constants.InstallerGrubUseUKICmdlineEnvVar, err)
		}

		options.GrubUseUKICmdline = grubUseUKICmdline
	}

	if metaEnvBase64 := os.Getenv(constants.MetaValuesEnvVar); metaEnvBase64 != "" {
		if err := options.MetaValues.Decode(metaEnvBase64); err != nil {
			return xerrors.NewTaggedf[install.InvalidInputTag]("%w", err)
		}
	}

	return nil
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(installerexitcode.Resolve(err))
	}
}

func execute() error {
	if err := setFlagsFromEnvironment(); err != nil {
		return err
	}

	return rootCmd.Execute()
}

var options = &install.Options{}

func init() {
	rootCmd.SilenceErrors = true
	rootCmd.SilenceUsage = true

	rootCmd.PersistentFlags().StringVar(&options.ConfigSource, "config", "", "The value of "+constants.KernelParamConfig)
	rootCmd.PersistentFlags().StringVar(&options.DiskPath, "disk", "", "The path to the disk to install to")
	rootCmd.PersistentFlags().StringVar(&options.Platform, "platform", "", "The value of "+constants.KernelParamPlatform)
	rootCmd.PersistentFlags().StringVar(&options.Arch, "arch", runtime.GOARCH, "The target architecture")
	rootCmd.PersistentFlags().StringArrayVar(&options.ExtraKernelArgs, "extra-kernel-arg", []string{}, "Extra argument to pass to the kernel")
	rootCmd.PersistentFlags().BoolVar(&options.Upgrade, "upgrade", false, "Indicates that the install is being performed by an upgrade")
	rootCmd.PersistentFlags().BoolVar(&options.Force, "force", false, "Indicates that the install should forcefully format the partition")
	rootCmd.PersistentFlags().BoolVar(&options.Zero, "zero", false, "Indicates that the install should write zeros to the disk before installing")
	rootCmd.PersistentFlags().Var(&options.MetaValues, "meta", "A key/value pair for META")
}

```

### Core Architecture Module: `cmd/installer/main.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package installer provides the installer implementation.
package main

import (
	"os"
	"path/filepath"

	"github.com/siderolabs/talos/cmd/installer/cmd/imager"
	"github.com/siderolabs/talos/cmd/installer/cmd/installer"
)

func main() {
	switch filepath.Base(os.Args[0]) {
	case "imager":
		imager.Execute()
	default:
		installer.Execute()
	}
}

```

### Core Architecture Module: `cmd/installer/pkg/install/errata.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package install

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/siderolabs/gen/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"github.com/siderolabs/talos/pkg/machinery/client"
	"github.com/siderolabs/talos/pkg/machinery/compatibility"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/role"
)

// errataNetIfnames appends the `net.ifnames=0` kernel parameter to the kernel command line if upgrading
// from an old enough version of Talos.
func (i *Installer) errataNetIfnames(talosVersion *compatibility.TalosVersion) {
	if i.cmdline.Get(constants.KernelParamNetIfnames).First() != nil {
		// net.ifnames is already set, nothing to do
		return
	}

	oldTalos := upgradeFromPreIfnamesTalos(talosVersion)

	if oldTalos {
		log.Printf("appending net.ifnames=0 to the kernel command line")

		i.cmdline.Append(constants.KernelParamNetIfnames, "0")
	}
}

func readHostTalosVersion() (*compatibility.TalosVersion, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	if _, err := os.Stat(constants.MachineSocketPath); err != nil {
		// can't read Talos version
		return nil, nil
	}

	c, err := client.New(
		ctx,
		client.WithUnixSocket(constants.MachineSocketPath),
		client.WithGRPCDialOptions(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		),
	)
	if err != nil {
		return nil, xerrors.NewTaggedf[EnvironmentTag]("error connecting to the machine service: %w", err)
	}

	defer c.Close() //nolint:errcheck

	// inject "fake" authorization
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(constants.APIAuthzRoleMetadataKey, string(role.Admin)))

	resp, err := c.Version(ctx)
	if err != nil {
		return nil, xerrors.NewTaggedf[EnvironmentTag]("error getting Talos version: %w", err)
	}

	hostVersion := unpack(resp.Messages)

	talosVersion, err := compatibility.ParseTalosVersion(hostVersion.Version)
	if err != nil {
		return nil, xerrors.NewTaggedf[EnvironmentTag]("error parsing Talos version: %w", err)
	}

	return talosVersion, nil
}

func upgradeFromPreIfnamesTalos(talosVersion *compatibility.TalosVersion) bool {
	if talosVersion == nil {
		// old Talos version, include fallback
		return true
	}

	return talosVersion.DisablePredictableNetworkInterfaces()
}

```

### Core Architecture Module: `cmd/installer/pkg/install/install.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// Package install provides the installation routine.
package install

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"slices"

	"github.com/google/uuid"
	"github.com/siderolabs/gen/xerrors"
	"github.com/siderolabs/gen/xslices"
	"github.com/siderolabs/go-blockdevice/v2/blkid"
	"github.com/siderolabs/go-blockdevice/v2/block"
	"github.com/siderolabs/go-blockdevice/v2/partitioning/gpt"
	"github.com/siderolabs/go-pointer"
	"github.com/siderolabs/go-procfs/procfs"
	"go.yaml.in/yaml/v4"

	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
	bootloaderpkg "github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader"
	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub"
	bootloaderoptions "github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/options"
	"github.com/siderolabs/talos/internal/pkg/meta"
	"github.com/siderolabs/talos/internal/pkg/partition"
	"github.com/siderolabs/talos/pkg/imager/overlay/executor"
	"github.com/siderolabs/talos/pkg/imager/profile"
	"github.com/siderolabs/talos/pkg/imager/utils"
	"github.com/siderolabs/talos/pkg/machinery/compatibility"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/imager/quirks"
	"github.com/siderolabs/talos/pkg/machinery/kernel"
	metaconsts "github.com/siderolabs/talos/pkg/machinery/meta"
	"github.com/siderolabs/talos/pkg/machinery/overlay"
	"github.com/siderolabs/talos/pkg/machinery/version"
	"github.com/siderolabs/talos/pkg/makefs"
)

// Options represents the set of options available for an install.
type Options struct {
	ConfigSource string
	// Can be an actual disk path or a file representing a disk image.
	DiskPath            string
	Platform            string
	Arch                string
	ExtraKernelArgs     []string
	Upgrade             bool
	Force               bool
	Zero                bool
	LegacyBIOSSupport   bool
	GrubUseUKICmdline   bool
	MetaValues          MetaValues
	OverlayInstaller    overlay.Installer[overlay.ExtraOptions]
	OverlayName         string
	OverlayExtractedDir string
	ExtraOptions        overlay.ExtraOptions

	ImageCachePath string
	ImageCacheSize int64

	// Options specific for the image creation mode.
	ImageSecureboot     bool
	DiskImageBootloader string
	ImageSectorSize     uint

	Version     string
	BootAssets  bootloaderoptions.BootAssets
	Printf      func(string, ...any)
	MountPrefix string

	// SecureBoot key auto-enrollment (image creation mode only).
	//
	// When SecureBootEnrollKeys is non-empty, the bootloader installer writes
	// loader/keys/auto/{PK,KEK,db}.auth on the ESP and renders loader.conf with
	// secure-boot-enroll set to this value.
	SecureBootEnrollKeys string
	PlatformKeyPath      string
	KeyExchangeKeyPath   string
	SignatureKeyPath     string
}

// Mode is the install mode.
type Mode int

const (
	// ModeInstall is the install mode.
	ModeInstall Mode = iota
	// ModeUpgrade is the upgrade mode.
	ModeUpgrade
	// ModeImage is the image creation mode.
	ModeImage
)

// IsImage returns true if the mode is image creation.
func (m Mode) IsImage() bool {
	return m == ModeImage
}

const typeGPT = "gpt"

// diskImageLabel is used as a label to generate a deterministic GPT UUID for disk images.
const diskImageLabel = "talos-image-disk"

// Install installs Talos.
//
//nolint:gocyclo
func Install(ctx context.Context, p runtime.Platform, mode Mode, opts *Options) error {
	if overlayPresent() {
		extraOptionsBytes, err := os.ReadFile(constants.ImagerOverlayExtraOptionsPath)
		if err != nil {
			return xerrors.NewTaggedf[DependencyTag]("%w", err)
		}

		var extraOptions overlay.ExtraOptions

		decoder := yaml.NewDecoder(bytes.NewReader(extraOptionsBytes))
		decoder.KnownFields(true)

		if err := decoder.Decode(&extraOptions); err != nil {
			return xerrors.NewTaggedf[InvalidInputTag]("failed to decode extra options: %w", err)
		}

		opts.OverlayInstaller = executor.New(constants.ImagerOverlayInstallerDefaultPath)
		opts.ExtraOptions = extraOptions
	}

	// NOTE: this is legacy code which is only used when running in GRUB mode with GrubUseUKICmdline set to false.
	cmdline := procfs.NewCmdline("")
	cmdline.Append(constants.KernelParamPlatform, p.Name())

	if opts.ConfigSource != "" {
		cmdline.Append(constants.KernelParamConfig, opts.ConfigSource)
	}

	cmdline.SetAll(p.KernelArgs(opts.Arch, quirks.Quirks{}).Strings())

	// first defaults, then extra kernel args to allow extra kernel args to override defaults
	if err := cmdline.AppendAll(kernel.DefaultArgs(quirks.Quirks{})); err != nil {
		return xerrors.NewTagged[InvalidInputTag](err)
	}

	if opts.OverlayInstaller != nil {
		overlayOpts, getOptsErr := opts.OverlayInstaller.GetOptions(ctx, opts.ExtraOptions)
		if getOptsErr != nil {
			return xerrors.NewTaggedf[DependencyTag]("failed to get overlay installer options: %w", getOptsErr)
		}

		opts.OverlayName = overlayOpts.Name

		cmdline.SetAll(overlayOpts.KernelArgs)
	}

	// preserve console=ttyS0 if it was already present in cmdline for metal platform
	existingCmdline := procfs.ProcCmdline()

	if *existingCmdline.Get(constants.KernelParamPlatform).First() == constants.PlatformMetal && existingCmdline.Get("console").Contains("ttyS0") {
		if !slices.Contains(opts.ExtraKernelArgs, "console=ttyS0") {
			cmdline.Append("console", "ttyS0")
		}
	}

	if err := cmdline.AppendAll(
		opts.ExtraKernelArgs,
		procfs.WithOverwriteArgs("console"),
		procfs.WithOverwriteArgs(constants.KernelParamPlatform),
		procfs.WithDeleteNegatedArgs(),
	); err != nil {
		return xerrors.NewTagged[InvalidInputTag](err)
	}

	i, err := NewInstaller(ctx, cmdline, mode, opts)
	if err != nil {
		return xerrors.NewTagged[InstallTag](err)
	}

	if err = i.Install(ctx, mode); err != nil {
		return xerrors.NewTagged[InstallTag](err)
	}

	i.options.Printf("installation of %s complete", version.Tag)

	return nil
}

// Installer represents the installer logic. It serves as the entrypoint to all
// installation methods.
type Installer struct {
	cmdline *procfs.Cmdline
	options *Options
}

// NewInstaller initializes and returns an Installer.
func NewInstaller(ctx context.Context, cmdline *procfs.Cmdline, mode Mode, opts *Options) (i *Installer, err error) {
	i = &Installer{
		cmdline: cmdline,
		options: opts,
	}

	if i.options.Version == "" {
		i.options.Version = version.Tag
	}

	if i.options.Printf == nil {
		i.options.Printf = log.Printf
	}

	if mode == ModeUpgrade && i.options.Force {
		i.options.Printf("system disk wipe on upgrade is not supported anymore, option ignored")
	}

	if i.options.Zero && mode != ModeInstall {
		i.options.Printf("zeroing of the disk is only supported for the initial installation, option ignored")
	}

	i.options.BootAssets.FillDefaults(opts.Arch)

	return i, nil
}

// detectBootloader detects the bootloader to use based on the mode.
func (i *Installer) detectBootloader(mode Mode) (bootloaderpkg.Bootloader, error) {
	switch mode {
	case ModeInstall:
		return bootloaderpkg.NewAuto(), nil
	case ModeUpgrade:
		return bootloaderpkg.Probe(i.options.DiskPath, bootloaderoptions.ProbeOptions{
			// the disk is already locked
			BlockProbeOptions: []blkid.ProbeOption{
				blkid.WithSkipLocking(true),
			},
			Logger: log.Printf,
		})
	case ModeImage:
		return bootloaderpkg.New(i.options.DiskImageBootloader, i.options.Version, i.options.Arch)
	default:
		return nil, fmt.Errorf("unknown image mode: %d", mode)
	}
}

// diskOperations performs any disk operations required before installation.
//
//nolint:gocyclo
func (i *Installer) diskOperations(mode Mode, bd *block.Device, info *blkid.Info) error {
	switch mode {
	case ModeInstall:
		if !i.options.Zero && !i.options.Force {
			// verify that the disk is either empt
```

### Core Architecture Module: `cmd/installer/pkg/install/meta_value.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package install

import (
	"strings"

	"github.com/spf13/pflag"

	"github.com/siderolabs/talos/pkg/machinery/meta"
)

// MetaValues is a list of MetaValue.
type MetaValues struct {
	values  meta.Values
	changed bool
}

// Interface check.
var (
	_ pflag.Value      = &MetaValues{}
	_ pflag.SliceValue = &MetaValues{}
)

// FromMeta returns a new MetaValues from a meta.Values.
func FromMeta(values meta.Values) MetaValues {
	return MetaValues{values: values}
}

// Set implements pflag.Value.
func (s *MetaValues) Set(val string) error {
	var v meta.Value

	if err := v.Parse(val); err != nil {
		return err
	}

	if !s.changed {
		s.values = meta.Values{v}
	} else {
		s.values = append(s.values, v)
	}

	s.changed = true

	return nil
}

// Type implements pflag.Value.
func (s *MetaValues) Type() string {
	return "metaValueSlice"
}

// String implements pflag.Value.
func (s *MetaValues) String() string {
	return "[" + strings.Join(s.GetSlice(), ",") + "]"
}

// Append implements pflag.SliceValue.
func (s *MetaValues) Append(val string) error {
	var v meta.Value

	if err := v.Parse(val); err != nil {
		return err
	}

	s.values = append(s.values, v)

	return nil
}

// Replace implements pflag.SliceValue.
func (s *MetaValues) Replace(val []string) error {
	out := make(meta.Values, len(val))

	for i, pair := range val {
		var v meta.Value

		if err := v.Parse(pair); err != nil {
			return err
		}

		out[i] = v
	}

	s.values = out

	return nil
}

// GetSlice implements pflag.SliceValue.
func (s *MetaValues) GetSlice() []string {
	out := make([]string, len(s.values))

	for i, v := range s.values {
		out[i] = v.String()
	}

	return out
}

// Encode returns the encoded values.
func (s *MetaValues) Encode() string {
	return s.values.Encode(false)
}

// Decode the values from the given string.
func (s *MetaValues) Decode(val string) error {
	values, err := meta.DecodeValues(val)
	if err != nil {
		return err
	}

	s.values = values

	return nil
}

// GetMetaValues returns the wrapped meta.Values.
func (s *MetaValues) GetMetaValues() meta.Values {
	return s.values
}

```

### Core Architecture Module: `cmd/installer/pkg/install/preflight.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

package install

import (
	"context"
	"log"
	"os"

	"github.com/siderolabs/gen/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"github.com/siderolabs/talos/pkg/machinery/client"
	"github.com/siderolabs/talos/pkg/machinery/compatibility"
	"github.com/siderolabs/talos/pkg/machinery/constants"
	"github.com/siderolabs/talos/pkg/machinery/role"
	"github.com/siderolabs/talos/pkg/machinery/version"
)

// Exit-code tags for installer runtime failures.
//
//nolint:revive
type (
	InvalidInputTag struct{}
	EnvironmentTag  struct{}
	DependencyTag   struct{}
	InstallTag      struct{}
)

// PreflightChecks runs the preflight checks.
type PreflightChecks struct {
	disabled bool
	client   *client.Client

	installerTalosVersion *compatibility.TalosVersion
	hostTalosVersion      *compatibility.TalosVersion
}

// NewPreflightChecks initializes and returns the installation PreflightChecks.
func NewPreflightChecks(ctx context.Context) (*PreflightChecks, error) {
	if _, err := os.Stat(constants.MachineSocketPath); err != nil {
		log.Printf("pre-flight checks disabled, as host Talos version is too old")

		return &PreflightChecks{disabled: true}, nil //nolint:nilerr
	}

	c, err := client.New(
		ctx,
		client.WithUnixSocket(constants.MachineSocketPath),
		client.WithGRPCDialOptions(
			grpc.WithTransportCredentials(insecure.NewCredentials()),
		),
	)
	if err != nil {
		return nil, xerrors.NewTaggedf[EnvironmentTag]("error connecting to the machine service: %w", err)
	}

	return &PreflightChecks{
		client: c,
	}, nil
}

// Close closes the client.
func (checks *PreflightChecks) Close() error {
	if checks.disabled {
		return nil
	}

	return checks.client.Close()
}

// Run the checks, return the error if the check fails.
func (checks *PreflightChecks) Run(ctx context.Context) error {
	if checks.disabled {
		return nil
	}

	log.Printf("running pre-flight checks")

	// inject "fake" authorization
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(constants.APIAuthzRoleMetadataKey, string(role.Admin)))

	for _, check := range []func(context.Context) error{
		checks.talosVersion,
	} {
		if err := check(ctx); err != nil {
			return xerrors.NewTaggedf[EnvironmentTag]("pre-flight checks failed: %w", err)
		}
	}

	log.Printf("all pre-flight checks successful")

	return nil
}

func (checks *PreflightChecks) talosVersion(ctx context.Context) error {
	resp, err := checks.client.Version(ctx)
	if err != nil {
		return xerrors.NewTaggedf[EnvironmentTag]("error getting Talos version: %w", err)
	}

	hostVersion := unpack(resp.Messages)

	log.Printf("host Talos version: %s", hostVersion.Version.Tag)

	checks.hostTalosVersion, err = compatibility.ParseTalosVersion(hostVersion.Version)
	if err != nil {
		return xerrors.NewTaggedf[EnvironmentTag]("error parsing host Talos version: %w", err)
	}

	checks.installerTalosVersion, err = compatibility.ParseTalosVersion(version.NewVersion())
	if err != nil {
		return xerrors.NewTaggedf[EnvironmentTag]("error parsing installer Talos version: %w", err)
	}

	if err := checks.installerTalosVersion.UpgradeableFrom(checks.hostTalosVersion); err != nil {
		return xerrors.NewTagged[EnvironmentTag](err)
	}

	return nil
}

func unpack[T any](s []T) T {
	if len(s) != 1 {
		panic("unpack: slice length is not 1")
	}

	return s[0]
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14514** (2026-09-30): **fix: reject impersonation header without impersonator role**
  *Symptoms*: This is not a security fix, but a UX fix.  Previously the role header was simply ignored, now Talos rejects such requests.  While we are on it, refactor the code to use errors instead of panics, add misssing unit-test coverage, add integration test coverage. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14512** (2026-09-30): **Implement VM macvtap into host link**
  *Symptoms*: 

- **Issue #14509** (2026-09-30): **fix: validate ExtensionServiceConfig name**
  *Symptoms*: The name of the config document should have same validation as extension service name. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14507** (2026-09-30): **chore: update go-kubernetes to v0.2.42**
  *Symptoms*: This adds the upgrade path from Kubernetes 1.37 to 1.38 for `talosctl upgrade-k8s`, along with the pre-upgrade checks for feature gates removed in 1.38 (including kubelet feature gates).  See https://github.com/siderolabs/go-kubernetes/pull/69  Signed-off-by: Oscar Wieman <oscar@oscarr.nl> 
  **Post-Mortem & Fix Analysis**:
  > whoops this is a duplicate

- **Issue #14501** (2026-09-30): **v1.14: kernel no longer loads extension modules on demand (drbd_transport_tcp)**
  *Symptoms*: ## Bug Report  ### What happened? What did you expect?  After upgrading a node from v1.13.6 to v1.14.2, DRBD on that node couldn't connect to any peer. `drbd` was loaded, but `drbd_transport_tcp` from the drbd extension was not, and `drbdsetup new-peer` failed:  ```text Failure: (172) Failed to create transport (drbd_transport_xxx module missing?) ```  Every DRBD resource on the node stayed in Connecting. On v1.13.6 and v1.12.12 nodes in the same cluster, with the same machine config, `drbd_transport_tcp` shows up in `/proc/modules` without being listed anywhere: DRBD loads it through `request_module()` on the first `new-peer`.  I expected extension modules the kernel asks for to keep loading on v1.14, or a note in the upgrade notes that they have to be listed explicitly now.  What I saw on the nodes:  ```text # v1.14.2 node /proc/sys/kernel/modprobe:   (empty) # v1.13.6 node, same cluster /proc/sys/kernel/modprobe:   /sbin/modprobe ```  `kernel.modules_disabled` is 0 on both. The v1.14.2 kernel config in pkgs has `CONFIG_MODPROBE_PATH=""` and `CONFIG_STATIC_USERMODEHELPER=y`, which came in with siderolabs/pkgs#1565 and reached Talos in e317d4b472 ("fix: drop modprobe path and enforce usermode helper"). The PR description says: "I don't think we have any usecase for it (all stuff which is reachable via the kernel is already =y in the config). If this breaks something, we can revert." That holds for `=y` code, but not for modules from system extensions or for in-tree `=m` modu
  **Post-Mortem & Fix Analysis**:
  > This is more of expected hardening - today Talos doesn't let any kernel module to be loaded bypassing the Talos itself.   Load whatever you need explicitly, DRBD working was a side-effected, and it wasn't an intended one.

- **Issue #14498** (2026-09-30): **feat: update etcd to 3.7.2**
  *Symptoms*: Also update kube-network-policies to 1.1.2. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14497** (2026-09-30): **feat: override the kubelet's image GC thresholds**
  *Symptoms*: Fixes #14488  The defaults in Kubernetes collide on ephemeral node eviciation taint & image GC policy, so once the free space on EPHEMERAL reaches image GC threshold, the node is tainted at the same time.  By default, put image GC below that threshold, so that image GC happens before tainting. 
  **Post-Mortem & Fix Analysis**:
  > /m

- **Issue #14496** (2026-09-29): **release(v1.14.2): prepare release**
  *Symptoms*: This is the official v1.14.2 release. 
  **Post-Mortem & Fix Analysis**:
  > /m

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

### Incident Patch 1: `b6a32fc1` (2026-09-30)
**Commit Message**: fix: reject impersonation header without impersonator role

This is not a security fix, but a UX fix.

Previously the role header was simply ignored, now Talos rejects such
requests.

While we are on it, refactor the code to use errors instead of panics,
add misssing unit-test coverage, add integration test coverage.

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `internal/integration/api/apid.go` (modified, +166/-0)
```diff
@@ -18,6 +18,8 @@ import (
 	"github.com/cosi-project/runtime/pkg/safe"
 	"github.com/dustin/go-humanize"
 	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/metadata"
+	"google.golang.org/protobuf/types/known/durationpb"
 
 	"github.com/siderolabs/talos/internal/integration/base"
 	machineapi "github.com/siderolabs/talos/pkg/machinery/api/machine"
@@ -272,6 +274,170 @@ func (suite *ApidSuite) TestPKIMismatch() {
 	suite.Require().NoError(wrongClient.Close())
 }
 
+// TestImpersonationWithoutRole verifies that the impersonation header is rejected when the client
+// doesn't have os:impersonator role, whatever roles the client has otherwise.
+func (suite *ApidSuite) TestImpersonationWithoutRole() {
+	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
+	cpNode := suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane)
+
+	for _, tt := range []struct {
+		name  string
+		roles []role.Role
+	}{
+		{
+			name:  "reader",
+			roles: []role.Role{role.Reader},
+		},
+		{
+			name:  "admin",
+			roles: []role.Role{role.Admin},
+		},
+		{
+			name:  "operator and reader",
+			roles: []role.Role{role.Operator, role.Reader},
+		},
+	} {
+		suite.Run(tt.name, func() {
+			cli := suite.generateClient(tt.roles...)
+
+			for _, node := range nodes {
+				nodeCtx := client.WithNode(suite.ctx, node)
+
+				// sanity check: the client works without the impersonation header
+				_, err := cli.Version(nodeCtx)
+				suite.Require().NoError(err)
+
+				// any impersonation header is rejected, whether it escalates, downgrades or keeps the roles
+				for _, impersonated := range []role.Role{role.Admin, role.Reader, role.Impersonator, tt.roles[0]} {
+					_, err = cli.Version(withImpersonation(nodeCtx, impersonated))
+					suite.Require().Error(err)
+					suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+					suite.Assert().ErrorContains(err, "impersonator role")
+				}
+			}
+
+			// the header doesn't escalate access to admin-only APIs either
+			_, err := cli.GenerateClientConfiguration(withImpersonation(client.WithNode(suite.ctx, cpNode), role.Admin), &machineapi.GenerateClientConfigurationRequest{
+				Roles:  []string{string(role.Reader)},
+				CrtTtl: durationpb.New(time.Hour),
+			})
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+			suite.Assert().ErrorContains(err, "impersonator role")
+		})
+	}
+}
+
+// TestImpersonation verifies that a client with os:impersonator role can impersonate any role via the impersonation header,
+// and that the impersonated roles are what gets authorized, including when the request is proxied between apid instances.
+func (suite *ApidSuite) TestImpersonation() {
+	nodes := suite.DiscoverNodeInternalIPs(suite.ctx)
+	cpCtx := client.WithNode(suite.ctx, suite.RandomDiscoveredNodeInternalIP(machine.TypeControlPlane))
+
+	adminOnlyRequest := &machineapi.GenerateClientConfigurationRequest{
+		Roles:  []string{string(role.Reader)},
+		CrtTtl: durationpb.New(time.Hour),
+	}
+
+	suite.Run("impersonator only", func() {
+		cli := suite.generateClient(role.Impersonator)
+
+		for _, node := range nodes {
+			nodeCtx := client.WithNode(suite.ctx, node)
+
+			// os:impersonator alone doesn't grant access to anything
+			_, err := cli.Version(nodeCtx)
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.PermissionDenied, client.StatusCode(err), "unexpected error: %v", err)
+
+			// impersonating a reader grants read-only access
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Reader))
+			suite.Require().NoError(err)
+
+			// impersonating an admin grants access as well
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Admin))
+			suite.Require().NoError(err)
+
+			// impersonating an unknown role grants nothing
+			_, err = cli.Version(withImpersonation(nodeCtx, role.Role("os:nonexistent")))
+			suite.Require().Error(err)
+			suite.Assert().Equal(codes.Permis
```

**File**: `pkg/grpc/middleware/authz/injector.go` (modified, +42/-17)
```diff
@@ -6,14 +6,17 @@ package authz
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"net"
 	"net/netip"
 
 	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware/v2"
 	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
 	"google.golang.org/grpc/credentials"
 	"google.golang.org/grpc/peer"
+	"google.golang.org/grpc/status"
 
 	grpclog "github.com/siderolabs/talos/pkg/grpc/middleware/log"
 	"github.com/siderolabs/talos/pkg/machinery/resources/network"
@@ -74,20 +77,20 @@ func (i *Injector) annotatef(ctx context.Context, format string, v ...any) {
 // or from gRPC metadata (in case of subsequent apid instances, machined, or user with impersonator role).
 //
 //nolint:gocyclo
-func (i *Injector) extractRoles(ctx context.Context) role.Set {
+func (i *Injector) extractRoles(ctx context.Context) (role.Set, error) {
 	// sanity check
 	if _, ok := getFromContext(ctx); ok {
-		panic("roles should not be present in the context at this point")
+		return role.Zero, errors.New("roles should not be present in the context at this point")
 	}
 
 	switch i.Mode {
 	case Disabled:
 		i.annotatef(ctx, "RBAC is disabled, injecting all roles")
 
-		return role.All
+		return role.All, nil
 
 	case ReadOnly:
-		return readerRoleSet
+		return readerRoleSet, nil
 
 	case ReadOnlyWithAdminOnSiderolink:
 		check := i.SideroLinkPeerCheckFunc
@@ -98,29 +101,32 @@ func (i *Injector) extractRoles(ctx context.Context) role.Set {
 		if siderolinkPeerAddr, siderolinkPeer := check(ctx); siderolinkPeer {
 			i.annotatef(ctx, "inject admin role for SideroLink peer %q", siderolinkPeerAddr)
 
-			return adminRoleSet
+			return adminRoleSet, nil
 		}
 
-		return readerRoleSet
+		return readerRoleSet, nil
 
 	case MetadataOnly:
-		roles, _ := getFromMetadata(ctx, i.annotatef)
+		roles, _, err := getFromMetadata(ctx, i.annotatef)
+		if err != nil {
+			return role.Zero, err
+		}
 
-		return roles
+		return roles, nil
 
 	case Enabled:
 		p, ok := peer.FromContext(ctx)
 		if !ok {
-			panic("can't get peer information")
+			return role.Zero, errors.New("can't get peer information")
 		}
 
 		tlsInfo, ok := p.AuthInfo.(credentials.TLSInfo)
 		if !ok {
-			panic(fmt.Sprintf("expected credentials.TLSInfo, got %T", p.AuthInfo))
+			return role.Zero, fmt.Errorf("expected credentials.TLSInfo, got %T", p.AuthInfo)
 		}
 
 		if len(tlsInfo.State.PeerCertificates) == 0 {
-			panic("expected at least one certificate")
+			return role.Zero, errors.New("expected at least one certificate")
 		}
 
 		// PeerCertificates[0] is the leaf certificate the connection was verified against, so this
@@ -135,25 +141,38 @@ func (i *Injector) extractRoles(ctx context.Context) role.Set {
 		// trust gRPC metadata from clients with impersonator role if present
 		// (including requests proxied from other apid instances)
 		if roles.Includes(role.Impersonator) {
-			metadataRoles, ok := getFromMetadata(ctx, i.annotatef)
+			metadataRoles, ok, err := getFromMetadata(ctx, i.annotatef)
+			if err != nil {
+				return role.Zero, err
+			}
+
 			if ok {
-				return metadataRoles
+				return metadataRoles, nil
 			}
 
 			// that's a real user with impersonator role then
 			i.annotatef(ctx, "no roles in metadata, returning parsed roles")
+		} else if hasInMetadata(ctx) {
+			// impersonation header is present, but the client doesn't have impersonator role, so we reject the request
+			// with a clean error instead of silently ignoring the impersonation header
+			return role.Zero, status.Error(codes.PermissionDenied, "client doesn't have impersonator role, but impersonation header is present")
 		}
 
-		return roles
+		return roles, nil
 	}
 
-	panic("unreachable")
+	return role.Zero, fmt.Errorf("unknown injector mode %v", i.Mode)
 }
 
 // UnaryInterceptor returns grpc UnaryServerInterceptor.
 func (i *Injector) UnaryInterceptor() grpc.UnaryServerInterceptor {
 	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
-		ctx = ContextWithRo
```

**File**: `pkg/grpc/middleware/authz/injector_test.go` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package authz_test
+
+import (
+	"context"
+	"crypto/tls"
+	"crypto/x509"
+	"crypto/x509/pkix"
+	"net"
+	"net/netip"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/grpc"
+	"google.golang.org/grpc/codes"
+	"google.golang.org/grpc/credentials"
+	"google.golang.org/grpc/metadata"
+	"google.golang.org/grpc/peer"
+	"google.golang.org/grpc/status"
+
+	"github.com/siderolabs/talos/pkg/grpc/middleware/authz"
+	"github.com/siderolabs/talos/pkg/machinery/constants"
+	"github.com/siderolabs/talos/pkg/machinery/role"
+)
+
+// withPeerCert returns a context with gRPC peer info carrying a client TLS certificate with the given organizations.
+func withPeerCert(ctx context.Context, orgs ...string) context.Context {
+	return peer.NewContext(ctx, &peer.Peer{
+		Addr: &net.TCPAddr{IP: net.ParseIP("192.168.1.1"), Port: 12345},
+		AuthInfo: credentials.TLSInfo{
+			State: tls.ConnectionState{
+				PeerCertificates: []*x509.Certificate{
+					{
+						Subject: pkix.Name{
+							Organization: orgs,
+						},
+					},
+				},
+			},
+		},
+	})
+}
+
+// withRoleMetadata returns a context with the impersonation header set in the incoming gRPC metadata.
+func withRoleMetadata(ctx context.Context, roles ...string) context.Context {
+	md, _ := metadata.FromIncomingContext(ctx)
+	md = md.Copy()
+
+	md.Set(constants.APIAuthzRoleMetadataKey, roles...)
+
+	return metadata.NewIncomingContext(ctx, md)
+}
+
+// withEmptyMetadata returns a context with (empty) incoming gRPC metadata, as it would be for any real gRPC request.
+func withEmptyMetadata(ctx context.Context) context.Context {
+	return metadata.NewIncomingContext(ctx, metadata.MD{})
+}
+
+type fakeServerStream struct {
+	grpc.ServerStream
+
+	ctx context.Context //nolint:containedctx
+}
+
+func (s *fakeServerStream) Context() context.Context {
+	return s.ctx
+}
+
+//nolint:gocyclo
+func TestInjector(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name     string
+		injector authz.Injector
+		ctx      context.Context //nolint:containedctx
+
+		expectedRoles role.Set
+		expectedCode  codes.Code
+		expectedError string
+	}{
+		{
+			name:          "disabled",
+			injector:      authz.Injector{Mode: authz.Disabled},
+			ctx:           withEmptyMetadata(context.Background()),
+			expectedRoles: role.All,
+		},
+		{
+			name:     "disabled ignores impersonation header",
+			injector: authz.Injector{Mode: authz.Disabled},
+			ctx:      withRoleMetadata(context.Background(), "os:reader"),
+			// RBAC is off, so the header is meaningless: every role is granted anyway
+			expectedRoles: role.All,
+		},
+		{
+			name:          "read-only",
+			injector:      authz.Injector{Mode: authz.ReadOnly},
+			ctx:           withRoleMetadata(context.Background(), "os:admin"),
+			expectedRoles: role.MakeSet(role.Reader),
+		},
+		{
+			name: "read-only with admin on SideroLink: not a SideroLink peer",
+			injector: authz.Injector{
+				Mode: authz.ReadOnlyWithAdminOnSiderolink,
+				SideroLinkPeerCheckFunc: func(context.Context) (netip.Addr, bool) {
+					return netip.Addr{}, false
+				},
+			},
+			ctx:           withRoleMetadata(context.Background(), "os:admin"),
+			expectedRoles: role.MakeSet(role.Reader),
+		},
+		{
+			name: "read-only with admin on SideroLink: SideroLink peer",
+			injector: authz.Injector{
+				Mode: authz.ReadOnlyWithAdminOnSiderolink,
+				SideroLinkPeerCheckFunc: func(context.Context) (netip.Addr, bool) {
+					return netip.MustParseAddr("fdae:41e4:649b:9303::1"), true
+				},
+			},
+			ctx:           withEmptyMetadata(context.Background()),
+			expectedRoles: role.MakeSet(role.Admin),
+		},
+		{
+			name:          "metadata only",
+			injector:      authz.Injector{Mode: authz.Metadata
```

**File**: `pkg/grpc/middleware/authz/metadata.go` (modified, +15/-4)
```diff
@@ -6,6 +6,7 @@ package authz
 
 import (
 	"context"
+	"errors"
 
 	"google.golang.org/grpc/metadata"
 
@@ -32,22 +33,32 @@ func SetMetadata(md metadata.MD, roles role.Set) {
 	md.Set(mdKey, roleStrings...)
 }
 
+// hasInMetadata returns true if the role header is present in gRPC metadata.
+func hasInMetadata(ctx context.Context) bool {
+	md, ok := metadata.FromIncomingContext(ctx)
+	if !ok {
+		return false
+	}
+
+	return len(md.Get(mdKey)) > 0
+}
+
 // getFromMetadata returns roles extracted from gRPC metadata.
-func getFromMetadata(ctx context.Context, annotate func(ctx context.Context, format string, v ...any)) (role.Set, bool) {
+func getFromMetadata(ctx context.Context, annotate func(ctx context.Context, format string, v ...any)) (role.Set, bool, error) {
 	md, ok := metadata.FromIncomingContext(ctx)
 	if !ok {
-		panic("no request metadata")
+		return role.Zero, false, errors.New("no request metadata")
 	}
 
 	strings := md.Get(mdKey)
 	if len(strings) == 0 {
 		annotate(ctx, "no roles in metadata")
 
-		return role.Zero, false
+		return role.Zero, false, nil
 	}
 
 	roles, unknownRoles := role.Parse(strings)
 	annotate(ctx, "parsed metadata %v as %v (unknownRoles = %v)", strings, roles.Strings(), unknownRoles)
 
-	return roles, true
+	return roles, true, nil
 }
```

---

### Incident Patch 2: `76e761d8` (2026-09-30)
**Commit Message**: fix: validate ExtensionServiceConfig name

The name of the config document should have same validation as extension
service name.

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `pkg/machinery/config/types/runtime/extensions/service_config.go` (modified, +5/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"github.com/siderolabs/talos/pkg/machinery/config/merge"
 	"github.com/siderolabs/talos/pkg/machinery/config/types/meta"
 	"github.com/siderolabs/talos/pkg/machinery/config/validation"
+	"github.com/siderolabs/talos/pkg/machinery/extensions/services"
 )
 
 // ServiceConfigKind is a Extension config document kind.
@@ -133,6 +134,10 @@ func (e *ServiceConfigV1Alpha1) Validate(validation.RuntimeMode, ...validation.O
 		return nil, fmt.Errorf("name is required")
 	}
 
+	if !services.IsValidName(e.ServiceName) {
+		return nil, fmt.Errorf("name %q is invalid", e.ServiceName)
+	}
+
 	if len(e.ServiceConfigFiles) == 0 && len(e.ServiceEnvironment) == 0 {
 		if len(e.ServiceConfigFiles) == 0 {
 			return nil, fmt.Errorf("no config files found for extension %q", e.ServiceName)
```

**File**: `pkg/machinery/config/types/runtime/extensions/service_config_test.go` (modified, +81/-0)
```diff
@@ -70,3 +70,84 @@ func TestExtensionServiceConfigMerge(t *testing.T) {
 	assert.Equal(t, "hello world", cfgLeft.ConfigFiles()[0].Content())
 	assert.Equal(t, "bar", cfgLeft.ConfigFiles()[1].Content())
 }
+
+func TestExtensionServiceConfigValidate(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name string
+		cfg  func() *extensions.ServiceConfigV1Alpha1
+
+		expectedError string
+	}{
+		{
+			name: "valid",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "nut-client"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+		},
+		{
+			name: "empty name",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: "name is required",
+		},
+		{
+			name: "path traversal",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "../../../etc/cri/conf.d"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: `name "../../../etc/cri/conf.d" is invalid`,
+		},
+		{
+			name: "uppercase",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "Foo"
+				cfg.ServiceEnvironment = []string{"FOO=BAR"}
+
+				return cfg
+			},
+			expectedError: `name "Foo" is invalid`,
+		},
+		{
+			name: "no files or environment",
+			cfg: func() *extensions.ServiceConfigV1Alpha1 {
+				cfg := extensions.NewServicesConfigV1Alpha1()
+				cfg.ServiceName = "foo"
+
+				return cfg
+			},
+			expectedError: `no config files found for extension "foo"`,
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			_, err := test.cfg().Validate(validationMode{})
+			if test.expectedError != "" {
+				require.EqualError(t, err, test.expectedError)
+			} else {
+				require.NoError(t, err)
+			}
+		})
+	}
+}
+
+type validationMode struct{}
+
+func (validationMode) String() string        { return "" }
+func (validationMode) RequiresInstall() bool { return false }
+func (validationMode) InContainer() bool     { return false }
```

**File**: `pkg/machinery/extensions/services/services.go` (modified, +6/-1)
```diff
@@ -107,11 +107,16 @@ type Dependency struct {
 
 var nameRe = regexp.MustCompile(`^[-_a-z0-9]{1,}$`)
 
+// IsValidName checks whether the extension service name is valid.
+func IsValidName(name string) bool {
+	return nameRe.MatchString(name)
+}
+
 // Validate the service spec.
 func (spec *Spec) Validate() error {
 	var multiErr *multierror.Error
 
-	if !nameRe.MatchString(spec.Name) {
+	if !IsValidName(spec.Name) {
 		multiErr = multierror.Append(multiErr, fmt.Errorf("name %q is invalid", spec.Name))
 	}
 
```

---

### Incident Patch 3: `2363acc1` (2026-09-29)
**Commit Message**: fix: hv domain status ctrl must use openpersistent

libvirt client .Domain is short lived. Using it in a controller
eventually results in the client closing, and further requests fail,
crashing the controller. We recover on the next controller restart, but
we should instead use a controller-friendly client instead.

DomainConnector().OpenPersistent is exactly what we need.

Signed-off-by: Maja Bojarska <maja.bojarska@siderolabs.com>

**File**: `internal/app/machined/pkg/runtime/v1alpha2/v1alpha2_controller.go` (modified, +1/-1)
```diff
@@ -286,7 +286,7 @@ func (ctrl *Controller) Run(ctx context.Context, drainer *runtime.Drainer) error
 		&hypervisorctrls.VirtualMachineDomainSpecController{},
 		&hypervisorctrls.VirtualMachineDomainStatusController{
 			V1Alpha1Mode: ctrl.v1alpha1Runtime.State().Platform().Mode(),
-			Open:         virtClient.Domain,
+			Open:         virtClient.DomainConnector().OpenPersistent,
 			Watch:        virtClient.DomainConnector().Watch,
 		},
 		&hypervisorctrls.VirtualMachineStatusController{
```

---

### Incident Patch 4: `6b333c14` (2026-09-28)
**Commit Message**: fix: don't overwrite currently booted on upgrade for GRUB

This mirrors a change done for sd-boot bootloader: if the user manually
picks a different entry in the GRUB menu, treat it as the one which is
protected (not overwritten) on upgrade.

Fixes #14474

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub/boot_label.go` (modified, +63/-0)
```diff
@@ -7,6 +7,10 @@ package grub
 import (
 	"fmt"
 	"strings"
+
+	"github.com/siderolabs/go-procfs/procfs"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/kexec"
 )
 
 // flipBootLabel flips the boot label.
@@ -42,6 +46,65 @@ func (c *Config) flip() error {
 	return nil
 }
 
+// SelectUpgradeTarget flips the default boot label away from the booted one.
+//
+// The entry the system is running from is kept as the fallback, and the other one is overwritten,
+// even if the default entry points to the other entry (e.g. an operator manually selected the
+// fallback entry in the GRUB menu after a failed upgrade).
+// If the booted entry is not known, it falls back to flipping the default entry.
+func (c *Config) SelectUpgradeTarget(printf func(string, ...any)) error {
+	if c.Booted == "" {
+		return c.flip()
+	}
+
+	next, err := flipBootLabel(c.Booted)
+	if err != nil {
+		return err
+	}
+
+	if c.Booted != c.Default {
+		printf("GRUB: booted entry %q differs from the default entry %q, keeping the booted entry as a fallback", c.Booted, c.Default)
+	}
+
+	c.Default = next
+	c.Fallback = c.Booted
+
+	return nil
+}
+
+// DetectBooted detects the entry the system is running from based on the kernel command line.
+//
+// GRUB passes the path to the kernel as BOOT_IMAGE, which is matched against the entries.
+func (c *Config) DetectBooted(cmdline *procfs.Cmdline) {
+	c.Booted = ""
+
+	if cmdline == nil {
+		return
+	}
+
+	bootImage := cmdline.Get(kexec.BootImageParam).First()
+	if bootImage == nil {
+		return
+	}
+
+	path := *bootImage
+
+	// strip the GRUB device prefix, e.g. `(hd0,gpt3)/A/vmlinuz`
+	if strings.HasPrefix(path, "(") {
+		if idx := strings.Index(path, ")"); idx >= 0 {
+			path = path[idx+1:]
+		}
+	}
+
+	for _, label := range []BootLabel{BootA, BootB} {
+		if entry, ok := c.Entries[label]; ok && entry.Linux == path {
+			c.Booted = label
+
+			return
+		}
+	}
+}
+
 // ParseBootLabel parses the given human-readable boot label to a BootLabel.
 func ParseBootLabel(name string) (BootLabel, error) {
 	switch {
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub/booted_test.go` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package grub_test
+
+import (
+	"testing"
+
+	"github.com/siderolabs/go-procfs/procfs"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub"
+	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/kexec"
+)
+
+func newABConfig(t *testing.T, defaultLabel grub.BootLabel) *grub.Config {
+	t.Helper()
+
+	config := grub.NewConfig()
+	require.NoError(t, config.Put(grub.BootA, "cmdline A", "v1.0.0"))
+	require.NoError(t, config.Put(grub.BootB, "cmdline B", "v1.1.0"))
+
+	config.Default = defaultLabel
+
+	return config
+}
+
+func TestDetectBooted(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name    string
+		cmdline string
+
+		expected grub.BootLabel
+	}{
+		{
+			name:     "A",
+			cmdline:  "BOOT_IMAGE=/A/vmlinuz talos.platform=metal",
+			expected: grub.BootA,
+		},
+		{
+			name:     "B",
+			cmdline:  "BOOT_IMAGE=/B/vmlinuz talos.platform=metal",
+			expected: grub.BootB,
+		},
+		{
+			name:     "device prefix",
+			cmdline:  "BOOT_IMAGE=(hd0,gpt3)/B/vmlinuz talos.platform=metal",
+			expected: grub.BootB,
+		},
+		{
+			name:    "no BOOT_IMAGE",
+			cmdline: "talos.platform=metal",
+		},
+		{
+			name:    "unknown kernel",
+			cmdline: "BOOT_IMAGE=/boot/vmlinuz talos.platform=metal",
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			config := newABConfig(t, grub.BootA)
+			config.DetectBooted(procfs.NewCmdline(test.cmdline))
+
+			assert.Equal(t, test.expected, config.Booted)
+		})
+	}
+}
+
+func TestSelectUpgradeTarget(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name          string
+		defaultLabel  grub.BootLabel
+		bootedLabel   grub.BootLabel
+		expectDefault grub.BootLabel
+	}{
+		{
+			name:          "booted default A",
+			defaultLabel:  grub.BootA,
+			bootedLabel:   grub.BootA,
+			expectDefault: grub.BootB,
+		},
+		{
+			name:          "booted default B",
+			defaultLabel:  grub.BootB,
+			bootedLabel:   grub.BootB,
+			expectDefault: grub.BootA,
+		},
+		{
+			// failed upgrade to B, operator selected A manually in the GRUB menu
+			name:          "manually booted A",
+			defaultLabel:  grub.BootB,
+			bootedLabel:   grub.BootA,
+			expectDefault: grub.BootB,
+		},
+		{
+			name:          "manually booted B",
+			defaultLabel:  grub.BootA,
+			bootedLabel:   grub.BootB,
+			expectDefault: grub.BootA,
+		},
+		{
+			name:          "booted unknown",
+			defaultLabel:  grub.BootB,
+			expectDefault: grub.BootA,
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			config := newABConfig(t, test.defaultLabel)
+			config.Booted = test.bootedLabel
+
+			require.NoError(t, config.SelectUpgradeTarget(t.Logf))
+
+			assert.Equal(t, test.expectDefault, config.Default)
+
+			expectedFallback := test.bootedLabel
+			if expectedFallback == "" {
+				expectedFallback = test.defaultLabel
+			}
+
+			assert.Equal(t, expectedFallback, config.Fallback)
+		})
+	}
+}
+
+func TestDetectBootedKexec(t *testing.T) {
+	t.Parallel()
+
+	// the kexec command line is detected back as the kexec'ed entry
+	config := newABConfig(t, grub.BootB)
+	config.DetectBooted(procfs.NewCmdline(kexec.AppendBootImage(config.Entries[grub.BootB].Cmdline, config.Entries[grub.BootB].Linux)))
+
+	assert.Equal(t, grub.BootB, config.Booted)
+}
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub/grub.go` (modified, +12/-2)
```diff
@@ -38,8 +38,14 @@ const bootPartitionCmdlineArg = constants.KernelParamBootPartitionUUID + "=$" +
 
 // Config represents a grub configuration file (grub.cfg).
 type Config struct {
-	Default        BootLabel
-	Fallback       BootLabel
+	Default  BootLabel
+	Fallback BootLabel
+	// Booted is the entry the system is running from right now (if known).
+	//
+	// It is detected on probe from the kernel command line, and it is not persisted in the config.
+	// It differs from Default e.g. when an operator selected a non-default entry in the GRUB menu,
+	// or right after an upgrade before the reboot.
+	Booted         BootLabel
 	Entries        map[BootLabel]MenuEntry
 	AddResetOption bool
 	// AppendBootPartitionUUID makes GRUB probe the partition it was loaded from (BOOT) and pass its UUID
@@ -97,6 +103,10 @@ func (c *Config) KexecLoad(r runtime.Runtime, disk string) error {
 
 		cmdline := strings.TrimSpace(defaultEntry.Cmdline)
 
+		// GRUB is skipped on kexec, so the kernel path it would have passed is set explicitly,
+		// so that the booted entry can be detected after kexec
+		cmdline = kexec.AppendBootImage(cmdline, defaultEntry.Linux)
+
 		// GRUB is skipped on kexec, so the boot partition UUID it would have probed is round-tripped
 		// from the current boot (if it is known)
 		if c.AppendBootPartitionUUID {
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub/probe.go` (modified, +11/-4)
```diff
@@ -7,6 +7,7 @@ package grub
 
 import (
 	"github.com/siderolabs/gen/xerrors"
+	"github.com/siderolabs/go-procfs/procfs"
 
 	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/mount"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/v1alpha1/bootloader/options"
@@ -36,12 +37,18 @@ func ProbeWithCallback(disk string, options options.ProbeOptions, callback func(
 				return err
 			}
 
-			if grubConf != nil && callback != nil {
-				return callback(grubConf)
-			}
-
 			if grubConf == nil {
 				options.Logf("GRUB: config not found")
+
+				return nil
+			}
+
+			grubConf.DetectBooted(procfs.ProcCmdline())
+
+			options.Logf("GRUB: default entry: %q, booted entry: %q", grubConf.Default, grubConf.Booted)
+
+			if callback != nil {
+				return callback(grubConf)
 			}
 
 			return nil
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/bootloader/grub/upgrade.go` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ func (c *Config) Upgrade(opts options.InstallOptions) (*options.InstallResult, e
 		opts.BootDisk,
 		mountSpecs,
 		func() error {
-			if err := c.flip(); err != nil {
+			if err := c.SelectUpgradeTarget(opts.Printf); err != nil {
 				return err
 			}
 
```

---

### Incident Patch 5: `cad70acb` (2026-09-23)
**Commit Message**: feat: add ignoreCtrlAltDelete to SecurityProfileConfig

Fixes #13762

Signed-off-by: Ian Atha <ian@atha.io>
Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `hack/release.toml` (modified, +7/-0)
```diff
@@ -386,6 +386,13 @@ The following `talosctl gen` subcommands have been removed:
 
 These commands where historically used to generate pieces of Talos PKI, but they are no longer needed
 as `talosctl gen config` and `talosctl gen secrets` now generate all required PKI material automatically.
+"""
+
+    [notes.ignore_ctrl_alt_delete]
+        title = "Ignore Ctrl-Alt-Delete"
+        description = """\
+Setting `ignoreCtrlAltDelete: true` in the `SecurityProfileConfig` document makes Talos log and ignore Ctrl-Alt-Delete instead of rebooting the machine.
+Ctrl-Alt-Delete still reboots the machine until a configuration with this option is applied.
 """
 
 [make_deps]
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/v1alpha1_controller.go` (modified, +29/-1)
```diff
@@ -229,8 +229,25 @@ func (c *Controller) ListenForEvents(ctx context.Context) error {
 	return eg.Wait()
 }
 
+//nolint:gocyclo
 func (c *Controller) listenForSignals(ctx context.Context, sigs chan os.Signal, allSignals []os.Signal) {
-	sig := <-sigs
+	var sig os.Signal
+
+	for {
+		select {
+		case <-ctx.Done():
+			return
+		case sig = <-sigs:
+		}
+
+		if sig == syscall.SIGINT && c.ignoreCtrlAltDelete() {
+			log.Printf("Ctrl-Alt-Delete ignored as per SecurityProfileConfig")
+
+			continue
+		}
+
+		break
+	}
 
 	switch sig {
 	case syscall.SIGTERM:
@@ -257,6 +274,17 @@ func (c *Controller) listenForSignals(ctx context.Context, sigs chan os.Signal,
 	signal.Ignore(allSignals...)
 }
 
+func (c *Controller) ignoreCtrlAltDelete() bool {
+	cfg := c.r.Config()
+	if cfg == nil {
+		return false
+	}
+
+	securityProfile := cfg.SecurityProfileConfig()
+
+	return securityProfile != nil && securityProfile.IgnoreCtrlAltDelete()
+}
+
 func (c *Controller) listenForACPI(ctx context.Context) error {
 	if err := acpi.StartACPIListener(); err != nil {
 		return err
```

**File**: `internal/app/machined/pkg/runtime/v1alpha1/v1alpha1_controller_test.go` (modified, +120/-0)
```diff
@@ -6,12 +6,16 @@
 package v1alpha1
 
 import (
+	"bytes"
 	"context"
 	"errors"
 	"fmt"
 	"log"
 	"os"
+	"os/signal"
+	"strings"
 	"sync"
+	"syscall"
 	"testing"
 	"time"
 
@@ -23,6 +27,9 @@ import (
 	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime"
 	"github.com/siderolabs/talos/internal/app/machined/pkg/runtime/logging"
 	"github.com/siderolabs/talos/pkg/machinery/api/machine"
+	"github.com/siderolabs/talos/pkg/machinery/config/config"
+	"github.com/siderolabs/talos/pkg/machinery/config/container"
+	runtimecfg "github.com/siderolabs/talos/pkg/machinery/config/types/runtime"
 )
 
 type mockSequencer struct {
@@ -220,6 +227,119 @@ func TestRun(t *testing.T) {
 	}
 }
 
+func TestListenForSignalsCtrlAltDelete(t *testing.T) {
+	securityProfile := func(ignoreCtrlAltDelete *bool) []config.Document {
+		doc := runtimecfg.NewSecurityProfileConfigV1Alpha1()
+		doc.IgnoreCtrlAltDeleteEnabled = ignoreCtrlAltDelete
+
+		return []config.Document{doc}
+	}
+
+	tests := []struct {
+		name       string
+		configured bool
+		documents  []config.Document
+		signals    []os.Signal
+
+		expectedReboots   int
+		expectedShutdowns int
+		expectedIgnored   int
+	}{
+		{
+			name:            "no config",
+			signals:         []os.Signal{syscall.SIGINT},
+			expectedReboots: 1,
+		},
+		{
+			name:            "no security profile",
+			configured:      true,
+			signals:         []os.Signal{syscall.SIGINT},
+			expectedReboots: 1,
+		},
+		{
+			name:            "not set",
+			configured:      true,
+			documents:       securityProfile(nil),
+			signals:         []os.Signal{syscall.SIGINT},
+			expectedReboots: 1,
+		},
+		{
+			name:            "disabled",
+			configured:      true,
+			documents:       securityProfile(new(false)),
+			signals:         []os.Signal{syscall.SIGINT},
+			expectedReboots: 1,
+		},
+		{
+			name:              "enabled",
+			configured:        true,
+			documents:         securityProfile(new(true)),
+			signals:           []os.Signal{syscall.SIGINT, syscall.SIGINT, syscall.SIGTERM},
+			expectedShutdowns: 1,
+			expectedIgnored:   2,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("PLATFORM", "container")
+
+			prevLogOutput := log.Writer()
+
+			t.Cleanup(func() { log.SetOutput(prevLogOutput) })
+
+			logOutput := &bytes.Buffer{}
+			log.SetOutput(logOutput)
+
+			s, err := NewState()
+			require.NoError(t, err)
+
+			sequencer := &mockSequencer{
+				calls:  map[runtime.Sequence]int{},
+				phases: map[runtime.Sequence]PhaseList{},
+			}
+
+			for _, seq := range []runtime.Sequence{runtime.SequenceReboot, runtime.SequenceShutdown} {
+				sequencer.phases[seq] = sequencer.phases[seq].Append(seq.String(), sequencer.trackCall(seq.String(), nil))
+			}
+
+			l := logging.NewCircularBufferLoggingManager(log.New(os.Stdout, "machined fallback logger: ", log.Flags()))
+
+			controller := Controller{
+				r:            NewRuntime(s, NewEvents(1000, 10), l),
+				s:            sequencer,
+				priorityLock: NewPriorityLock[runtime.Sequence](),
+			}
+
+			if tt.configured {
+				cfg, err := container.New(tt.documents...)
+				require.NoError(t, err)
+
+				require.NoError(t, controller.r.SetConfig(cfg))
+			}
+
+			sigs := make(chan os.Signal, len(tt.signals))
+
+			for _, sig := range tt.signals {
+				sigs <- sig
+			}
+
+			// listenForSignals ignores the passed signals on return, so pass one the test doesn't care about
+			t.Cleanup(func() { signal.Reset(syscall.SIGUSR2) })
+
+			controller.listenForSignals(t.Context(), sigs, []os.Signal{syscall.SIGUSR2})
+
+			sequencer.callsMu.Lock()
+			defer sequencer.callsMu.Unlock()
+
+			assert.Equal(t, tt.expectedReboots, sequencer.calls[runtime.SequenceReboot])
+			assert.Equal(t, tt.expectedShutdowns, sequencer.calls[runtime.SequenceShutdown])
+			assert.Equal(t, tt.expectedIgnored, strings.Count(logOutput.String(), "Ctrl-Alt-Delete ignored as per SecurityProfileConfig"))
+			assert.Empty(t, sigs)
+		})
+	}
+}
+
 func wait(
```

**File**: `internal/integration/provision/external_triggers.go` (modified, +73/-0)
```diff
@@ -9,6 +9,8 @@ package provision
 import (
 	"context"
 	"fmt"
+	"os"
+	"path/filepath"
 	"time"
 
 	"github.com/stretchr/testify/assert"
@@ -17,6 +19,8 @@ import (
 	"github.com/siderolabs/talos/pkg/images"
 	"github.com/siderolabs/talos/pkg/machinery/api/machine"
 	"github.com/siderolabs/talos/pkg/machinery/client"
+	"github.com/siderolabs/talos/pkg/machinery/config/container"
+	runtimecfg "github.com/siderolabs/talos/pkg/machinery/config/types/runtime"
 	"github.com/siderolabs/talos/pkg/machinery/constants"
 )
 
@@ -126,6 +130,11 @@ func (suite *ExternalTriggerSuite) TestTriggers() {
 		}
 	})
 
+	suite.Run("ignore Ctrl+Alt+Delete", func() {
+		// using machine 1 for this test, before it is powered off
+		suite.ignoreCtrlAltDelete(maintenanceClients[1], suite.Cluster.Info().Nodes[1].Name)
+	})
+
 	suite.Run("trigger poweroff", func() {
 		suite.T().Logf("using node %s", suite.Cluster.Info().Nodes[1].Name)
 
@@ -160,6 +169,70 @@ func (suite *ExternalTriggerSuite) TestTriggers() {
 	})
 }
 
+// ignoreCtrlAltDelete verifies that Ctrl+Alt+Delete is logged and ignored with the SecurityProfileConfig option set.
+func (suite *ExternalTriggerSuite) ignoreCtrlAltDelete(c *client.Client, nodeName string) {
+	suite.T().Logf("using node %s", nodeName)
+
+	events := make(chan client.EventResult)
+
+	ctx, cancel := context.WithTimeout(suite.ctx, time.Minute)
+	defer cancel()
+
+	suite.Require().NoError(c.EventsWatchV2(ctx, events))
+
+	// a partial config is accepted in maintenance mode, and the node stays in maintenance mode
+	suite.applyIgnoreCtrlAltDelete(ctx, c)
+
+	suite.sendMonitorCommand(ctx, nodeName, "sendkey ctrl-alt-delete")
+
+	suite.Require().EventuallyWithT(func(collect *assert.CollectT) {
+		assert.Contains(collect, suite.readConsoleLog(nodeName), "Ctrl-Alt-Delete ignored as per SecurityProfileConfig")
+	}, 10*time.Second, time.Second, "Ctrl+Alt+Delete should be logged as ignored")
+
+	noRebootCtx, noRebootCancel := context.WithTimeout(ctx, 10*time.Second)
+	defer noRebootCancel()
+
+	for {
+		select {
+		case <-noRebootCtx.Done():
+			return
+		case event := <-events:
+			suite.Require().NoError(event.Error)
+
+			if taskEvent, ok := event.Event.Payload.(*machine.TaskEvent); ok && taskEvent.Task == "reboot" {
+				suite.FailNow("unexpected reboot on ignored Ctrl+Alt+Delete")
+			}
+		}
+	}
+}
+
+func (suite *ExternalTriggerSuite) applyIgnoreCtrlAltDelete(ctx context.Context, c *client.Client) {
+	securityProfile := runtimecfg.NewSecurityProfileConfigV1Alpha1()
+	securityProfile.IgnoreCtrlAltDeleteEnabled = new(true)
+
+	cfg, err := container.New(securityProfile)
+	suite.Require().NoError(err)
+
+	cfgBytes, err := cfg.Bytes()
+	suite.Require().NoError(err)
+
+	_, err = c.ApplyConfiguration(ctx, &machine.ApplyConfigurationRequest{
+		Data: cfgBytes,
+		Mode: machine.ApplyConfigurationRequest_NO_REBOOT,
+	})
+	suite.Require().NoError(err)
+}
+
+func (suite *ExternalTriggerSuite) readConsoleLog(nodeName string) string {
+	statePath, err := suite.Cluster.StatePath()
+	suite.Require().NoError(err)
+
+	contents, err := os.ReadFile(filepath.Join(statePath, nodeName+".log"))
+	suite.Require().NoError(err)
+
+	return string(contents)
+}
+
 func init() {
 	allSuites = append(
 		allSuites,
```

**File**: `pkg/machinery/config/config/runtime.go` (modified, +2/-0)
```diff
@@ -106,6 +106,8 @@ type SecurityProfileConfig interface {
 	SecurityProfileConfigSignal()
 	// WorkloadIsolation reports whether the container plane should run inside the sandbox namespace.
 	WorkloadIsolation() bool
+	// IgnoreCtrlAltDelete reports whether Ctrl-Alt-Delete should be ignored.
+	IgnoreCtrlAltDelete() bool
 }
 
 // WrapRuntimeConfigList wraps a list of RuntimeConfig into a single RuntimeConfig aggregating the results.
```

---

### Incident Patch 6: `691a26f1` (2026-09-28)
**Commit Message**: fix: installer-with-extension image tag handling

Different jobs build and push images with a different set of extensions,
but with the same tag.
Push/pull races intermittently cause jobs to fail on missing extensions.
This diff ensures that each job references it's own image by digest,
resolving the image ref ambiguity.

Signed-off-by: Maja Bojarska <maja.bojarska@siderolabs.com>

**File**: `Makefile` (modified, +10/-3)
```diff
@@ -673,9 +673,16 @@ provision-tests-track-%:
 
 installer-with-extensions: $(ARTIFACTS)/extensions/_out/extensions-metadata
 	$(MAKE) image-installer \
-		IMAGER_ARGS="--base-installer-image=$(REGISTRY_AND_USERNAME)/installer-base$(IMAGE_NAME_SUFFIX):$(IMAGE_TAG_IN) $(shell cat $(ARTIFACTS)/extensions/_out/extensions-metadata | $(EXTENSIONS_FILTER_COMMAND) | xargs -n 1 echo --system-extension-image)"
-	crane push $(ARTIFACTS)/installer-amd64.tar $(REGISTRY_AND_USERNAME)/installer$(IMAGE_NAME_SUFFIX):$(IMAGE_TAG_OUT)-amd64-extensions
-	INSTALLER_IMAGE_EXTENSIONS="$(REGISTRY_AND_USERNAME)/installer$(IMAGE_NAME_SUFFIX):$(IMAGE_TAG_OUT)-amd64-extensions" yq eval -n '.apiVersion = "v1alpha1" | .kind = "UnattendedInstallConfig" | .installer.image = strenv(INSTALLER_IMAGE_EXTENSIONS) | .provisioning.diskSelector.match = "disk.dev_path == \"/dev/vda\""' > $(ARTIFACTS)/installer-extensions-patch.yaml
+		IMAGER_ARGS="--base-installer-image=$(REGISTRY_AND_USERNAME)/installer-base$(IMAGE_NAME_SUFFIX):$(IMAGE_TAG_IN) \
+			$(shell cat $(ARTIFACTS)/extensions/_out/extensions-metadata | $(EXTENSIONS_FILTER_COMMAND) | xargs -n 1 echo --system-extension-image)"
+	crane push \
+		--image-refs $(ARTIFACTS)/installer-extensions.ref \
+		$(ARTIFACTS)/installer-amd64.tar \
+		$(REGISTRY_AND_USERNAME)/installer$(IMAGE_NAME_SUFFIX):$(IMAGE_TAG_OUT)-amd64-extensions
+	INSTALLER_IMAGE_EXTENSIONS="$$(cat $(ARTIFACTS)/installer-extensions.ref)" \
+		yq eval -n \
+		'.apiVersion = "v1alpha1" | .kind = "UnattendedInstallConfig" | .installer.image = strenv(INSTALLER_IMAGE_EXTENSIONS) | .provisioning.diskSelector.match = "disk.dev_path == \"/dev/vda\""' \
+		> $(ARTIFACTS)/installer-extensions-patch.yaml
 
 kubelet-fat-patch:
 	K8S_VERSION=$(KUBECTL_VERSION) yq eval -n '.apiVersion = "v1alpha1" | .kind = "KubeletConfig" | .image = "ghcr.io/siderolabs/kubelet:" + strenv(K8S_VERSION) + "-fat"' > $(ARTIFACTS)/kubelet-fat-patch.yaml
```

---

### Incident Patch 7: `92fdb5b0` (2026-09-28)
**Commit Message**: test: fix OOM kills in TinkSuite

The TinkSuite runs after OomSuite, and sometimes this causes a Tink
failure when Tink pod is killed by OOM.

Fix this in two ways:

* after the OOM test, wait for the OOM pressure to go down
* set memory limits for Tink to make it exempt from OOM

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `internal/integration/k8s/oom.go` (modified, +243/-17)
```diff
@@ -13,12 +13,14 @@ import (
 	"fmt"
 	"io"
 	"maps"
+	"path/filepath"
 	"strconv"
 	"strings"
 	"sync"
 	"testing"
 	"time"
 
+	"github.com/cosi-project/runtime/pkg/safe"
 	"github.com/cosi-project/runtime/pkg/state"
 	"github.com/dustin/go-humanize"
 	"github.com/stretchr/testify/require"
@@ -28,6 +30,7 @@ import (
 	"github.com/siderolabs/talos/internal/integration/base"
 	"github.com/siderolabs/talos/pkg/machinery/client"
 	"github.com/siderolabs/talos/pkg/machinery/config/machine"
+	"github.com/siderolabs/talos/pkg/machinery/constants"
 	"github.com/siderolabs/talos/pkg/machinery/resources/runtime"
 )
 
@@ -75,27 +78,23 @@ func (suite *OomSuite) TestOom() {
 
 		suite.DeleteManifests(cleanUpCtx, oomPodManifest)
 
-		ticker := time.NewTicker(time.Second)
-		done := cleanUpCtx.Done()
-
 		// Wait for all stress-mem pods to complete terminating
-		for {
-			select {
-			case <-ticker.C:
-				pods, err := suite.Clientset.CoreV1().Pods("default").List(cleanUpCtx, metav1.ListOptions{
-					LabelSelector: "app=stress-mem",
-				})
+		if !suite.waitForStressPodsGone(cleanUpCtx) {
+			suite.Require().Fail("Timed out waiting for cleanup")
 
-				suite.Require().NoError(err)
+			return
+		}
 
-				if len(pods.Items) == 0 {
-					return
-				}
-			case <-done:
-				suite.Require().Fail("Timed out waiting for cleanup")
+		// Memory pressure on the worker nodes doesn't go away the moment the stress pods are gone:
+		// the OOM handler trigger is based on a 10-second PSI average, and the kernel might still be
+		// reclaiming memory. If the next test suite deploys something memory-hungry right away, the
+		// OOM handler picks it as the next victim (see waitForMemoryPressureToSubside), so wait for the
+		// nodes to settle before handing over.
+		settleCtx, settleCancel := context.WithTimeout(context.Background(), memoryPressureSettleTimeout)
+		defer settleCancel()
 
-				return
-			}
+		if !suite.waitForMemoryPressureToSubside(settleCtx, suite.DiscoverNodeInternalIPsByType(settleCtx, machine.TypeWorker)) {
+			suite.Assert().Failf("memory pressure didn't subside", "worker nodes are still under memory pressure %s after the stress pods were removed", memoryPressureSettleTimeout)
 		}
 	})
 
@@ -149,6 +148,233 @@ func patchToReplicas(t *testing.T, replicas int) []byte {
 	return patch
 }
 
+// waitForStressPodsGone polls until no stress-mem pods are left, returning false if ctx expires first.
+func (suite *OomSuite) waitForStressPodsGone(ctx context.Context) bool {
+	ticker := time.NewTicker(time.Second)
+	defer ticker.Stop()
+
+	for {
+		select {
+		case <-ticker.C:
+			pods, err := suite.Clientset.CoreV1().Pods("default").List(ctx, metav1.ListOptions{
+				LabelSelector: "app=stress-mem",
+			})
+
+			suite.Require().NoError(err)
+
+			if len(pods.Items) == 0 {
+				return true
+			}
+		case <-ctx.Done():
+			return false
+		}
+	}
+}
+
+const (
+	// memoryPressureSettleTimeout bounds the wait for memory pressure to subside on the worker nodes
+	// after the stress pods are removed.
+	memoryPressureSettleTimeout = 3 * time.Minute
+
+	// memoryPressureQuietPeriod is how long every worker node has to stay below the pressure threshold
+	// (with no new userspace OOM kills) before the nodes are considered settled.
+	memoryPressureQuietPeriod = 15 * time.Second
+
+	// memoryPressureFullAvg10Threshold is the upper bound on the PSI memory "full avg10" value for a node
+	// to be considered free of memory pressure.
+	//
+	// The default OOM handler trigger (constants.DefaultOOMTriggerExpression) fires when the sum of "full avg10"
+	// over the system and podruntime cgroups exceeds 5.0, so both that sum and the root cgroup value are
+	// required to stay well below it.
+	memoryPressureFullAvg10Threshold = 1.0
+)
+
+// memoryPressureCgroups lists the cgroups (relative to the cgroup root) sampled by the OOM handler trigger
+// expression, plus the root cgroup which covers everything else (e.g. the pods).
+var memoryPressureCgroups = []string{
+	""
```

**File**: `internal/integration/k8s/tink.go` (modified, +6/-0)
```diff
@@ -382,6 +382,12 @@ func (suite *TinkSuite) getTinkManifests(namespace, serviceName, ssName, talosIm
 									corev1.ResourceMemory: resource.MustParse("1Gi"),
 									corev1.ResourceCPU:    resource.MustParse("750m"),
 								},
+								// A memory limit caps the inner Talos and, as a side effect, exempts the pod from the
+								// Talos userspace OOM handler on the host node: the default cgroup ranking gives a
+								// cgroup with memory.max set a zero score, so it never gets picked as a victim.
+								Limits: corev1.ResourceList{
+									corev1.ResourceMemory: resource.MustParse("2Gi"),
+								},
 							},
 							Ports: []corev1.ContainerPort{
 								{
```

---

### Incident Patch 8: `bfa1ef26` (2026-09-28)
**Commit Message**: fix: drop devices from the last observed generation if they are gone

This fixes the case when the device is re-created under the same name,
e.g. `/dev/dm-0` - the controller skipped probing such devices which
leads to cascading failures in the tests.

If the device was removed, make sure that once it reappears, it will be
treated as a new one.

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `internal/app/machined/pkg/controllers/block/disks.go` (modified, +15/-0)
```diff
@@ -10,6 +10,7 @@ import (
 	"context"
 	"fmt"
 	"io"
+	"maps"
 	"path/filepath"
 	"strings"
 
@@ -65,6 +66,10 @@ func (ctrl *DisksController) Run(ctx context.Context, r controller.Runtime, logg
 	// lastObservedGenerations holds the last observed generation of each device.
 	//
 	// when the generation of a device changes, the device might have changed and might need to be re-probed.
+	//
+	// an entry is dropped as soon as the device is gone: a device which comes back under the same name
+	// (e.g. device-mapper devices reuse "dm-N" names) starts counting generations from scratch, and
+	// a stale entry would make it look unchanged and never probed.
 	lastObservedGenerations := map[string]int{}
 
 	for {
@@ -80,12 +85,15 @@ func (ctrl *DisksController) Run(ctx context.Context, r controller.Runtime, logg
 		}
 
 		touchedDisks := map[string]struct{}{}
+		presentDevices := map[string]struct{}{}
 
 		for device := range blockdevices.All() {
 			if device.TypedSpec().Type != block.DeviceTypeDisk {
 				continue
 			}
 
+			presentDevices[device.Metadata().ID()] = struct{}{}
+
 			if device.TypedSpec().Major == 1 {
 				// ignore ram disks (/dev/ramX), major number is 1
 				// ref: https://www.kernel.org/doc/Documentation/admin-guide/devices.txt
@@ -128,6 +136,13 @@ func (ctrl *DisksController) Run(ctx context.Context, r controller.Runtime, logg
 
 			delete(lastObservedGenerations, disk.Metadata().ID())
 		}
+
+		// forget the devices which are gone, whether or not they ever produced a disk
+		maps.DeleteFunc(lastObservedGenerations, func(id string, _ int) bool {
+			_, present := presentDevices[id]
+
+			return !present
+		})
 	}
 }
 
```

**File**: `internal/app/machined/pkg/controllers/block/disks_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package block_test
+
+import (
+	"errors"
+	"os"
+	"path/filepath"
+	"testing"
+	"time"
+
+	"github.com/cosi-project/runtime/pkg/resource/rtestutils"
+	"github.com/freddierice/go-losetup/v2"
+	blkdev "github.com/siderolabs/go-blockdevice/v2/block"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/stretchr/testify/suite"
+	"golang.org/x/sys/unix"
+
+	blockctrls "github.com/siderolabs/talos/internal/app/machined/pkg/controllers/block"
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/ctest"
+	"github.com/siderolabs/talos/pkg/machinery/resources/block"
+)
+
+type DisksSuite struct {
+	ctest.DefaultSuite
+}
+
+func TestDisksSuite(t *testing.T) {
+	suite.Run(t, new(DisksSuite))
+}
+
+const loopImageSize = 4 * 1024 * 1024
+
+// TestRecreatedDevice checks that a device which goes away and comes back under the same name
+// is probed again, even if the first incarnation never produced a disk.
+//
+// This is what happens with device-mapper devices: "dm-N" names are reused, and a private
+// (or not yet resumed) device-mapper device is skipped by the controller.
+func (suite *DisksSuite) TestRecreatedDevice() {
+	if os.Geteuid() != 0 {
+		suite.T().Skip("skipping test; must be root to use loop devices")
+	}
+
+	// the subject is a loop device which is going to be detached and attached back
+	subjectImage := createRawImage(suite.T(), loopImageSize)
+	subject := attachLoopDevice(suite.T(), subjectImage)
+
+	// the barrier is a loop device which stays attached; once the controller has produced a disk for it,
+	// it has processed everything created before it
+	barrierImage := createRawImage(suite.T(), loopImageSize)
+	barrier := attachLoopDevice(suite.T(), barrierImage)
+
+	subjectID := filepath.Base(subject.Path())
+	barrierID := filepath.Base(barrier.Path())
+
+	suite.Require().NoError(suite.Runtime().RegisterController(&blockctrls.DisksController{}))
+
+	// detach the subject: the device node stays, but the device has no size now
+	suite.Require().NoError(subject.Detach())
+	waitForLoopDeviceSize(suite.T(), subject.Path(), 0)
+
+	// first incarnation: the controller sees an empty device and produces no disk for it
+	const generation = 2
+
+	suite.Create(newDiskDevice(subjectID, generation))
+	suite.Create(newDiskDevice(barrierID, 1))
+
+	rtestutils.AssertResource(suite.Ctx(), suite.T(), suite.State(), barrierID, func(disk *block.Disk, asrt *assert.Assertions) {
+		asrt.EqualValues(loopImageSize, disk.TypedSpec().Size)
+	})
+	ctest.AssertNoResource[*block.Disk](suite, subjectID)
+
+	// the device goes away
+	suite.Destroy(newDiskDevice(subjectID, generation))
+	ctest.AssertNoResource[*block.Disk](suite, subjectID)
+
+	// second incarnation of the device under the same name and with the same generation number, but now it has a size
+	reattachLoopDevice(suite.T(), subject, subjectImage)
+	waitForLoopDeviceSize(suite.T(), subject.Path(), loopImageSize)
+
+	suite.Create(newDiskDevice(subjectID, generation))
+
+	rtestutils.AssertResource(suite.Ctx(), suite.T(), suite.State(), subjectID, func(disk *block.Disk, asrt *assert.Assertions) {
+		asrt.EqualValues(loopImageSize, disk.TypedSpec().Size)
+	})
+}
+
+func newDiskDevice(id string, generation int) *block.Device {
+	dev := block.NewDevice(block.NamespaceName, id)
+	dev.TypedSpec().Type = block.DeviceTypeDisk
+	dev.TypedSpec().DevicePath = filepath.Join("/sys/class/block", id)
+	dev.TypedSpec().Generation = generation
+
+	return dev
+}
+
+func createRawImage(t *testing.T, size int64) string {
+	t.Helper()
+
+	rawImage := filepath.Join(t.TempDir(), "image.raw")
+
+	f, err := os.Create(rawImage)
+	require.NoError(t, err)
+
+	require.NoError(t, f.Truncate(size))
+	require.NoError(t, f.Close())
+
+	return rawImage
```

---

### Incident Patch 9: `3f3a1e01` (2026-09-28)
**Commit Message**: fix: type VM CPU limits for 32-bit talosctl builds

Passing the untyped maximum CPU limit to fmt.Errorf defaults it to
int, overflowing on ARMv7. Type the bounds as uint64 to match the
parsed limit and keep validation portable.

Signed-off-by: Noel Georgi <git@frezbo.dev>

**File**: `pkg/machinery/hypervisorhelpers/hypervisorhelpers.go` (modified, +2/-2)
```diff
@@ -10,10 +10,10 @@ const (
 	CPUQuotaPeriod = 100000
 
 	// MinCPULimitMillicores corresponds to libvirt's minimum cpuquota of 1000 microseconds.
-	MinCPULimitMillicores = 1000 * 1000 / CPUQuotaPeriod
+	MinCPULimitMillicores uint64 = 1000 * 1000 / CPUQuotaPeriod
 
 	// MaxCPULimitMillicores keeps the quota within libvirt's maximum of 17592186044415 microseconds.
-	MaxCPULimitMillicores = 17592186044415 * 1000 / CPUQuotaPeriod
+	MaxCPULimitMillicores uint64 = 17592186044415 * 1000 / CPUQuotaPeriod
 )
 
 //go:generate go tool github.com/dmarkham/enumer -type=PowerState,VirtualMachineDiskBus,VirtualMachineDiskFormat,VirtualMachineDiskImageMode,VirtualMachineDiskType,VirtualMachineFirmwareType -linecomment -text
```

---

### Incident Patch 10: `6ced9374` (2026-09-25)
**Commit Message**: feat: handle the change in kubelet's CPU and memory policies

Fixes #14459

Previously Talos handled changes to CPU manager policy with the only
transition from "none" to "set" and back.

Expand this code to handle both CPU & memory policies, and perform
comparison on startup to ensure that the kubelet's state matches the
policy. On mismatch, clear the kubelet state.

There are some edge cases still which Talos can't handle correctly,
but this should get us much closer to 99%.

In the edge case `talosctl debug` might be used to remove the bad
kubelet state, or via partial volume wipe for `KUBELET`.

Signed-off-by: Andrey Smirnov <andrey.smirnov@siderolabs.com>

**File**: `hack/release.toml` (modified, +13/-0)
```diff
@@ -64,6 +64,19 @@ other continuously.
 Talos now listens for LLDP on physical Ethernet interfaces and reports neighbors through the `LLDPNeighborStatus` resource.
 Reported information includes chassis and port IDs, system and port descriptions, system names, management addresses, and VLANs.
 The built-in listener does not transmit advertisements; use the `lldpd` system extension when advertising is required.
+"""
+
+    [notes.kubelet_resource_managers]
+        title = "Kubelet Resource Manager State"
+        description = """\
+Talos now validates the kubelet CPU manager and memory manager state files (`/var/lib/kubelet/cpu_manager_state`, `/var/lib/kubelet/memory_manager_state`)
+the same way kubelet does on startup, and removes a state file kubelet would refuse to load before starting kubelet.
+
+Previously only a change of the manager policy was detected, so changing e.g. `reservedSystemCPUs` or `reservedMemory`, or
+a change of the CPU/NUMA topology of the machine, left kubelet unable to start until the state file was removed manually.
+
+Only the rendered `KubeletConfiguration` (`machine.kubelet.extraConfig`) is checked: the resource manager settings passed as kubelet
+command line flags via `machine.kubelet.extraArgs` (e.g. `--cpu-manager-policy`, `--reserved-cpus`) are not taken into account.
 """
 
     [notes.updates]
```

**File**: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/cpu_manager.go` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package kubeletstate
+
+import (
+	"cmp"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"math"
+	"strconv"
+
+	"k8s.io/apimachinery/pkg/api/resource"
+	kubeletconfig "k8s.io/kubelet/config/v1beta1"
+	"k8s.io/utils/cpuset"
+)
+
+// CPU manager policy names (see k8s.io/kubernetes/pkg/kubelet/cm/cpumanager).
+const (
+	CPUManagerPolicyNone   = "none"
+	CPUManagerPolicyStatic = "static"
+
+	strictCPUReservationOption = "strict-cpu-reservation"
+)
+
+// CPUManagerConfig is the subset of the kubelet configuration which affects the CPU manager state.
+type CPUManagerConfig struct {
+	// Policy is the CPU manager policy (normalized, "none" if not set).
+	Policy string
+	// StrictCPUReservation is the value of the "strict-cpu-reservation" policy option.
+	StrictCPUReservation bool
+	// ReservedCPUs is the explicit set of reserved CPUs (reservedSystemCPUs), might be empty.
+	ReservedCPUs cpuset.CPUSet
+	// NumReservedCPUs is the number of reserved CPUs.
+	//
+	// If ReservedCPUs is empty, kubelet reserves this many CPUs picked by the topology.
+	NumReservedCPUs int
+}
+
+// CPUManagerConfigFromKubelet extracts the CPU manager configuration from the kubelet configuration.
+func CPUManagerConfigFromKubelet(cfg *kubeletconfig.KubeletConfiguration) (CPUManagerConfig, error) {
+	reservedCPUs, err := cpuset.Parse(cfg.ReservedSystemCPUs)
+	if err != nil {
+		return CPUManagerConfig{}, fmt.Errorf("failed to parse reservedSystemCPUs %q: %w", cfg.ReservedSystemCPUs, err)
+	}
+
+	result := CPUManagerConfig{
+		Policy:       cmp.Or(cfg.CPUManagerPolicy, CPUManagerPolicyNone),
+		ReservedCPUs: reservedCPUs,
+	}
+
+	if value, ok := cfg.CPUManagerPolicyOptions[strictCPUReservationOption]; ok {
+		result.StrictCPUReservation, err = strconv.ParseBool(value)
+		if err != nil {
+			return CPUManagerConfig{}, fmt.Errorf("failed to parse %s policy option %q: %w", strictCPUReservationOption, value, err)
+		}
+	}
+
+	if !reservedCPUs.IsEmpty() {
+		// kubelet overrides the CPU reservation with the explicit set
+		result.NumReservedCPUs = reservedCPUs.Size()
+
+		return result, nil
+	}
+
+	// kubelet takes the ceiling of the sum of kube and system reserved CPU quantities
+	var reservedQuantity resource.Quantity
+
+	for _, reserved := range []map[string]string{cfg.KubeReserved, cfg.SystemReserved} {
+		value, ok := reserved["cpu"]
+		if !ok {
+			continue
+		}
+
+		quantity, err := resource.ParseQuantity(value)
+		if err != nil {
+			return CPUManagerConfig{}, fmt.Errorf("failed to parse reserved CPU quantity %q: %w", value, err)
+		}
+
+		reservedQuantity.Add(quantity)
+	}
+
+	result.NumReservedCPUs = int(math.Ceil(float64(reservedQuantity.MilliValue()) / 1000))
+
+	return result, nil
+}
+
+// cpuManagerCheckpoint is the CPU manager state file format (v2).
+type cpuManagerCheckpoint struct {
+	PolicyName    string                       `json:"policyName"`
+	DefaultCPUSet string                       `json:"defaultCpuSet"`
+	Entries       map[string]map[string]string `json:"entries,omitempty"`
+}
+
+func validateCPUManagerState(raw []byte, cfg *kubeletconfig.KubeletConfiguration, machine Machine) error {
+	config, err := CPUManagerConfigFromKubelet(cfg)
+	if err != nil {
+		return err
+	}
+
+	return ValidateCPUManagerState(raw, config, machine)
+}
+
+// ValidateCPUManagerState checks whether the kubelet would load the CPU manager state with the given configuration.
+//
+// It mirrors the checks done by the kubelet on startup (see k8s.io/kubernetes/pkg/kubelet/cm/cpumanager/policy_static.go).
+//
+//nolint:gocyclo,cyclop
+func ValidateCPUManagerState(raw []byte, cfg CPUManagerConfig, machine Machine) error {
+	var checkpoint cpuManagerCheckpoint
+
+	if err := json.Unmarshal(raw, &checkpoint); err != nil {
+		return fmt.Errorf("failed to parse the s
```

**File**: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/cpu_manager_test.go` (added, +345/-0)
```diff
@@ -0,0 +1,345 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package kubeletstate_test
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	kubeletconfig "k8s.io/kubelet/config/v1beta1"
+	"k8s.io/utils/cpuset"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/k8s/internal/kubeletstate"
+)
+
+func TestCPUManagerConfigFromKubelet(t *testing.T) {
+	t.Parallel()
+
+	for _, test := range []struct {
+		name string
+
+		cfg kubeletconfig.KubeletConfiguration
+
+		expected      kubeletstate.CPUManagerConfig
+		expectedError string
+	}{
+		{
+			name: "defaults",
+			expected: kubeletstate.CPUManagerConfig{
+				Policy:       kubeletstate.CPUManagerPolicyNone,
+				ReservedCPUs: cpuset.New(),
+			},
+		},
+		{
+			name: "reserved by quantity",
+			cfg: kubeletconfig.KubeletConfiguration{
+				CPUManagerPolicy: kubeletstate.CPUManagerPolicyStatic,
+				KubeReserved:     map[string]string{"cpu": "100m", "memory": "1Gi"},
+				SystemReserved:   map[string]string{"cpu": "1500m"},
+			},
+			expected: kubeletstate.CPUManagerConfig{
+				Policy:          kubeletstate.CPUManagerPolicyStatic,
+				ReservedCPUs:    cpuset.New(),
+				NumReservedCPUs: 2,
+			},
+		},
+		{
+			name: "reserved explicitly",
+			cfg: kubeletconfig.KubeletConfiguration{
+				CPUManagerPolicy:        kubeletstate.CPUManagerPolicyStatic,
+				CPUManagerPolicyOptions: map[string]string{"strict-cpu-reservation": "true", "full-pcpus-only": "true"},
+				ReservedSystemCPUs:      "0,2,16,18",
+				KubeReserved:            map[string]string{"cpu": "100m"},
+			},
+			expected: kubeletstate.CPUManagerConfig{
+				Policy:               kubeletstate.CPUManagerPolicyStatic,
+				StrictCPUReservation: true,
+				ReservedCPUs:         cpuset.New(0, 2, 16, 18),
+				NumReservedCPUs:      4,
+			},
+		},
+		{
+			name: "invalid reserved CPUs",
+			cfg: kubeletconfig.KubeletConfiguration{
+				ReservedSystemCPUs: "0-",
+			},
+			expectedError: `failed to parse reservedSystemCPUs "0-"`,
+		},
+		{
+			name: "invalid policy option",
+			cfg: kubeletconfig.KubeletConfiguration{
+				CPUManagerPolicyOptions: map[string]string{"strict-cpu-reservation": "yes"},
+			},
+			expectedError: `failed to parse strict-cpu-reservation policy option "yes"`,
+		},
+		{
+			name: "invalid quantity",
+			cfg: kubeletconfig.KubeletConfiguration{
+				SystemReserved: map[string]string{"cpu": "two"},
+			},
+			expectedError: `failed to parse reserved CPU quantity "two"`,
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			actual, err := kubeletstate.CPUManagerConfigFromKubelet(&test.cfg)
+
+			if test.expectedError != "" {
+				require.ErrorContains(t, err, test.expectedError)
+
+				return
+			}
+
+			require.NoError(t, err)
+
+			assert.Equal(t, test.expected.Policy, actual.Policy)
+			assert.Equal(t, test.expected.StrictCPUReservation, actual.StrictCPUReservation)
+			assert.Equal(t, test.expected.NumReservedCPUs, actual.NumReservedCPUs)
+			assert.True(t, test.expected.ReservedCPUs.Equals(actual.ReservedCPUs), "expected %s, got %s", test.expected.ReservedCPUs, actual.ReservedCPUs)
+		})
+	}
+}
+
+//nolint:maintidx
+func TestValidateCPUManagerState(t *testing.T) {
+	t.Parallel()
+
+	// 8 CPUs, 0-1 reserved
+	machine := kubeletstate.Machine{
+		OnlineCPUs: cpuset.New(0, 1, 2, 3, 4, 5, 6, 7),
+	}
+
+	staticConfig := func(reserved cpuset.CPUSet, strict bool) kubeletstate.CPUManagerConfig {
+		return kubeletstate.CPUManagerConfig{
+			Policy:               kubeletstate.CPUManagerPolicyStatic,
+			StrictCPUReservation: strict,
+			ReservedCPUs:         reserved,
+			NumReservedCPUs:      reserved.Size(),
+		}
+	}
+
+	byQuantityConfig := func(num int, strict bool) kubeletstate.CPUManagerConfig {
+		return kubeletstate.CPUManagerConfig{
+			Policy:
```

**File**: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/kubeletstate.go` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+// Package kubeletstate validates the state files persisted by the kubelet resource managers (CPU manager, memory manager).
+//
+// The kubelet validates the persisted state against the current configuration and the machine topology on startup,
+// and refuses to start if they don't match (e.g. the policy changed, or the set of reserved CPUs changed).
+// The state files carry everything the kubelet checks them against, so this package re-implements the
+// kubelet checks to remove the state files the kubelet would reject before it is started.
+package kubeletstate
+
+import (
+	"errors"
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+
+	"go.uber.org/zap"
+	kubeletconfig "k8s.io/kubelet/config/v1beta1"
+	"k8s.io/utils/cpuset"
+)
+
+// Machine describes the machine topology the kubelet validates the resource manager state against.
+type Machine struct {
+	// OnlineCPUs is the set of online CPUs.
+	OnlineCPUs cpuset.CPUSet
+	// NUMANodes is the set of NUMA nodes.
+	NUMANodes cpuset.CPUSet
+}
+
+// DiscoverMachine reads the machine topology from sysfs the same way kubelet (cadvisor) does.
+func DiscoverMachine() (Machine, error) {
+	onlineCPUs, err := readSysfsList("/sys/devices/system/cpu/online")
+	if err != nil {
+		return Machine{}, fmt.Errorf("failed to read online CPUs: %w", err)
+	}
+
+	numaNodes, err := readSysfsList("/sys/devices/system/node/online")
+	if err != nil {
+		if !errors.Is(err, os.ErrNotExist) {
+			return Machine{}, fmt.Errorf("failed to read NUMA nodes: %w", err)
+		}
+
+		// no NUMA information available, cadvisor falls back to a single NUMA node
+		numaNodes = cpuset.New(0)
+	}
+
+	return Machine{
+		OnlineCPUs: onlineCPUs,
+		NUMANodes:  numaNodes,
+	}, nil
+}
+
+func readSysfsList(path string) (cpuset.CPUSet, error) {
+	raw, err := os.ReadFile(path)
+	if err != nil {
+		return cpuset.CPUSet{}, err
+	}
+
+	set, err := cpuset.Parse(strings.TrimSpace(string(raw)))
+	if err != nil {
+		return cpuset.CPUSet{}, fmt.Errorf("failed to parse %q: %w", path, err)
+	}
+
+	return set, nil
+}
+
+// stateFile describes a state file persisted by one of the kubelet resource managers.
+type stateFile struct {
+	// name is the file name (in the kubelet state directory).
+	name string
+	// validate returns an error if the kubelet would refuse to load the state.
+	validate func(raw []byte, cfg *kubeletconfig.KubeletConfiguration, machine Machine) error
+}
+
+var stateFiles = []stateFile{
+	{
+		name:     "cpu_manager_state",
+		validate: validateCPUManagerState,
+	},
+	{
+		name:     "memory_manager_state",
+		validate: validateMemoryManagerState,
+	},
+}
+
+// Cleanup removes the resource manager state files in the kubelet state directory which the kubelet
+// would refuse to load with the given configuration on this machine.
+//
+// The kubelet re-creates the removed state files on startup.
+func Cleanup(stateDir string, cfg *kubeletconfig.KubeletConfiguration, machine Machine, logger *zap.Logger) error {
+	for _, file := range stateFiles {
+		path := filepath.Join(stateDir, file.name)
+
+		raw, err := os.ReadFile(path)
+		if err != nil {
+			if errors.Is(err, os.ErrNotExist) {
+				continue // nothing to validate, kubelet will create the state
+			}
+
+			return fmt.Errorf("failed to read %s: %w", file.name, err)
+		}
+
+		validationErr := file.validate(raw, cfg, machine)
+		if validationErr == nil {
+			continue
+		}
+
+		logger.Info(
+			"removing kubelet state file, as kubelet would refuse to load it",
+			zap.String("file", file.name),
+			zap.NamedError("reason", validationErr),
+		)
+
+		if err = os.Remove(path); err != nil {
+			return fmt.Errorf("failed to remove %s: %w", file.name, err)
+		}
+	}
+
+	return nil
+}
```

**File**: `internal/app/machined/pkg/controllers/k8s/internal/kubeletstate/kubeletstate_test.go` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+// This Source Code Form is subject to the terms of the Mozilla Public
+// License, v. 2.0. If a copy of the MPL was not distributed with this
+// file, You can obtain one at http://mozilla.org/MPL/2.0/.
+
+package kubeletstate_test
+
+import (
+	"os"
+	"path/filepath"
+	"runtime"
+	"slices"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"go.uber.org/zap/zaptest"
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/api/resource"
+	kubeletconfig "k8s.io/kubelet/config/v1beta1"
+	"k8s.io/utils/cpuset"
+
+	"github.com/siderolabs/talos/internal/app/machined/pkg/controllers/k8s/internal/kubeletstate"
+)
+
+func TestDiscoverMachine(t *testing.T) {
+	t.Parallel()
+
+	if runtime.GOOS != "linux" {
+		t.Skip("sysfs is only available on Linux")
+	}
+
+	machine, err := kubeletstate.DiscoverMachine()
+	require.NoError(t, err)
+
+	assert.False(t, machine.OnlineCPUs.IsEmpty())
+	assert.False(t, machine.NUMANodes.IsEmpty())
+}
+
+func TestCleanup(t *testing.T) {
+	t.Parallel()
+
+	const (
+		cpuManagerState    = "cpu_manager_state"
+		memoryManagerState = "memory_manager_state"
+
+		staticCPUState    = `{"policyName":"static","defaultCpuSet":"1,3-15,17,19-31","checksum":1902567528}`
+		staticMemoryState = `{"policyName":"Static","machineState":{"0":{"numberOfAssignments":0,"memoryMap":{` +
+			`"memory":{"total":68719476736,"systemReserved":1073741824,"allocatable":67645734912,"reserved":0,"free":67645734912}},"cells":[0]}},"entries":{},"checksum":1}`
+	)
+
+	machine := kubeletstate.Machine{
+		OnlineCPUs: cpuset.New(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31),
+		NUMANodes:  cpuset.New(0),
+	}
+
+	staticConfig := func(reservedCPUs, reservedMemory string) *kubeletconfig.KubeletConfiguration {
+		return &kubeletconfig.KubeletConfiguration{
+			CPUManagerPolicy:        kubeletstate.CPUManagerPolicyStatic,
+			CPUManagerPolicyOptions: map[string]string{"strict-cpu-reservation": "true"},
+			ReservedSystemCPUs:      reservedCPUs,
+			MemoryManagerPolicy:     kubeletconfig.StaticMemoryManagerPolicy,
+			ReservedMemory: []kubeletconfig.MemoryReservation{
+				{
+					NumaNode: 0,
+					Limits: corev1.ResourceList{
+						corev1.ResourceMemory: resource.MustParse(reservedMemory),
+					},
+				},
+			},
+			SystemReserved: map[string]string{"memory": reservedMemory},
+		}
+	}
+
+	for _, test := range []struct {
+		name string
+
+		states map[string]string
+		cfg    *kubeletconfig.KubeletConfiguration
+
+		expectedRemoved []string
+	}{
+		{
+			name: "no state",
+			cfg:  staticConfig("0,2,16,18", "1Gi"),
+		},
+		{
+			name:   "unchanged",
+			states: map[string]string{cpuManagerState: staticCPUState, memoryManagerState: staticMemoryState},
+			cfg:    staticConfig("0,2,16,18", "1Gi"),
+		},
+		{
+			name:            "policy changed",
+			states:          map[string]string{cpuManagerState: staticCPUState, memoryManagerState: staticMemoryState},
+			cfg:             &kubeletconfig.KubeletConfiguration{},
+			expectedRemoved: []string{cpuManagerState, memoryManagerState},
+		},
+		{
+			name:            "reserved CPUs changed",
+			states:          map[string]string{cpuManagerState: staticCPUState, memoryManagerState: staticMemoryState},
+			cfg:             staticConfig("0,2,4,6,16,18,20,22", "1Gi"),
+			expectedRemoved: []string{cpuManagerState},
+		},
+		{
+			name:            "reserved memory changed",
+			states:          map[string]string{cpuManagerState: staticCPUState, memoryManagerState: staticMemoryState},
+			cfg:             staticConfig("0,2,16,18", "2Gi"),
+			expectedRemoved: []string{memoryManagerState},
+		},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Parallel()
+
+			dir := t.TempDir()
+
+			for name, state := range test.states {
+				require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(state), 0o600))
+			}
+
+			require.NoError(t, kubeletstate.Cleanup(dir, test.cfg, m
```

#### Recent Merged Pull Requests:
- **PR #14514** (2026-09-30): fix: reject impersonation header without impersonator role (@smira)
- **PR #14509** (2026-09-30): fix: validate ExtensionServiceConfig name (@smira)
- **PR #14507** (closed): chore: update go-kubernetes to v0.2.42 (@oscrx)
- **PR #14498** (2026-09-30): feat: update etcd to 3.7.2 (@smira)
- **PR #14497** (2026-09-30): feat: override the kubelet's image GC thresholds (@smira)
- **PR #14496** (2026-09-29): release(v1.14.2): prepare release (@smira)
- **PR #14495** (2026-09-29): fix: VirtualMachineDomainStatus ctrl must use OpenPersistent (@majabojarska)
- **PR #14493** (2026-09-29): backports: for v1.14.2 (@smira)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
