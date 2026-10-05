# Forensic Learning Record (Deep Inspection): alexellis/k3sup

> **Canonical Artifact**: `07_PROJECT_LEARNING/alexellis-k3sup-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alexellis/k3sup](https://github.com/alexellis/k3sup))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:06:15.153Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alexellis/k3sup`
- **Description**: bootstrap K3s over SSH in < 60s 🚀
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 7434 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/get-config.go`
```
package cmd

import (
	"fmt"
	"log"
	"net"

	"github.com/alexellis/k3sup/pkg"
	operator "github.com/alexellis/k3sup/pkg/operator"

	"github.com/spf13/cobra"
)

// MakeGetConfig creates the get-config command
func MakeGetConfig() *cobra.Command {
	var command = &cobra.Command{
		Use:   "get-config",
		Short: "Get kubeconfig from an existing K3s installation",
		Long: `Create a local kubeconfig for use with kubectl from your local machine.

` + pkg.SupportMessageShort + `
`,
		Example: `  # Get the kubeconfig and save it to ./kubeconfig in the local
  # directory under the default context
  k3sup get-config --host HOST \
    --local-path ./kubeconfig

  # Merge kubeconfig into local file under custom context
  k3sup get-config \
    --host HOST \
    --merge \
    --local-path $HOME/.kube/kubeconfig \
    --context k3s-prod-eu-1

  # Get kubeconfig from local installation directly on a server
  # where you ran "k3sup install --local"
  k3sup get-config --local`,
		SilenceUsage: true,
	}

	command.Flags().IP("ip", net.ParseIP("127.0.0.1"), "Public IP of node")
	command.Flags().String("user", "root", "Username for SSH login")
	command.Flags().String("host", "", "Public hostname of node")
	command.Flags().String("ssh-key", "~/.ssh/id_rsa", "The ssh key to use for remote login")
	command.Flags().Int("ssh-port", 22, "The port on which to connect for ssh")
	command.Flags().Bool("sudo", true, "Use sudo for kubeconfig retrieval. e.g. set to false when using the root user and no sudo is available.")
	command.Flags().String("local-path", "kubeconfig", "Local path to save the kubeconfig file")
	command.Flags().String("context", "default", "Set the name of the kubeconfig context.")
	command.Flags().Bool("merge", false, `Merge the config with existing kubeconfig if it already exists.
Provide the --local-path flag with --merge if a kubeconfig already exists in some other directory`)
	command.Flags().Bool("print-command", false, "Print a command that you can use with SSH to manually recover from an error")
	command.Flags().Bool("local", false, "Perform a local get-config without using ssh")

	command.PreRunE = func(command *cobra.Command, args []string) error {
		local, err := command.Flags().GetBool("local")
		if err != nil {
			return err
		}

		if !local {
			_, err = command.Flags().GetString("host")
			if err != nil {
				return err
			}

			if _, err := command.Flags().GetIP("ip"); err != nil {
				return err
			}

			if _, err := command.Flags().GetInt("ssh-port"); err != nil {
				return err
			}
		}
		return nil
	}

	command.RunE = func(command *cobra.Command, args []string) error {
		localKubeconfig, _ := command.Flags().GetString("local-path")
		useSudo, err := command.Flags().GetBool("sudo")
		if err != nil {
			return err
		}

		sudoPrefix := ""
		if useSudo {
			sudoPrefix = "sudo "
		}

		local, _ := command.Flags().GetBool("local")

		ip, err := command.Flags().GetIP("ip")
		if err != nil {
			return err
		}

		host, err := command.Flags().GetString("host")
		if err != nil {
			return err
		}
		if len(host) == 0 {
			host = ip.String()
		}

		log.Println(host)

		printCommand, err := command.Flags().GetBool("print-command")
		if err != nil {
			return err
		}

		merge, err := command.Flags().GetBool("merge")
		if err != nil {
			return err
		}
		context, err := command.Flags().GetString("context")
		if err != nil {
			return err
		}

		getConfigcommand := fmt.Sprintf("%scat /etc/rancher/k3s/k3s.yaml\n", sudoPrefix)

		if local {
			operator := operator.ExecOperator{}

			if err = obtainKubeconfig(operator, getConfigcommand, host, context, localKubeconfig, merge); err != nil {
				return err
			}

			return nil
		}

		fmt.Println("Public IP: " + host)

		port, _ := command.Flags().GetInt("ssh-port")
		user, _ := command.Flags().GetString("user")
		sshKey, _ := command.Flags().GetString("ssh-key")

		sshKeyPath := expandPath(sshKey)
		address := fmt.Sprintf("%s:%d", host, port)

		sshOperator, sshOperatorDone, errored, err := connectOperator(user, address, sshKeyPath)
		if errored {
			return err
		}

		if sshOperatorDone != nil {
			defer sshOperatorDone()
		}

		if printCommand {
			fmt.Printf("ssh: %s\n", getConfigcommand)
		}

		if err = obtainKubeconfig(sshOperator, getConfigcommand, host, context, localKubeconfig, merge); err != nil {
			return err
		}

		return nil
	}

	return command
}

```

### Core Architecture Module: `cmd/get.go`
```
package cmd

import (
	"github.com/alexellis/k3sup/pkg"
	"github.com/spf13/cobra"
)

// MakeGet creates the get parent command
func MakeGet() *cobra.Command {
	var command = &cobra.Command{
		Use:   "get",
		Short: "Helper for downloading K3sup Pro",
		Long: `Helper for downloading K3sup Pro.

` + pkg.SupportMessageShort + `
`,
		SilenceUsage: true,
	}

	return command
}

```

### Core Architecture Module: `cmd/get_pro.go`
```
// Copyright Alex Ellis, OpenFaaS Ltd 2025
// Inspired by update command in openfaas/faas-cli
package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"runtime"
	"strings"

	"github.com/alexellis/arkade/pkg/archive"
	"github.com/alexellis/arkade/pkg/env"
	goexecute "github.com/alexellis/go-execute/v2"
	"github.com/google/go-containerregistry/pkg/crane"
	v1 "github.com/google/go-containerregistry/pkg/v1"

	"github.com/spf13/cobra"
)

// MakeGetPro creates the 'get pro' command
func MakeGetPro() *cobra.Command {
	c := &cobra.Command{
		Use:   "pro",
		Short: "Download the latest k3sup pro binary",
		Long: `The latest release version of k3sup-pro will be downloaded from a remote 
container registry.

This command will download and install k3sup-pro to /usr/local/bin by default.`,
		Example: `  # Download to the default location
  k3sup get pro

  # Download a specific version of k3sup pro
  k3sup get pro --version v0.10.0

  # Download to a custom location
  k3sup get pro --path /tmp/`,
		RunE:    runGetProE,
		PreRunE: preRunGetProE,
	}

	c.Flags().Bool("verbose", false, "Enable verbose output")
	c.Flags().String("path", "/usr/local/bin/", "Custom installation path")
	c.Flags().String("version", "latest", "Specific version to download")

	return c
}

func preRunGetProE(cmd *cobra.Command, args []string) error {
	version, _ := cmd.Flags().GetString("version")

	if len(version) == 0 {
		return fmt.Errorf(`version must be specified, or use "latest"`)
	}

	return nil
}

func runGetProE(cmd *cobra.Command, args []string) error {
	verbose, _ := cmd.Flags().GetBool("verbose")
	customPath, _ := cmd.Flags().GetString("path")
	version, _ := cmd.Flags().GetString("version")

	// Use the provided path or default to /usr/local/bin/
	var binaryPath string
	if customPath != "/usr/local/bin/" {
		binaryPath = customPath
		if verbose {
			fmt.Printf("Using custom binary path: %s\n", binaryPath)
		}
	} else {
		binaryPath = "/usr/local/bin/"
		if verbose {
			fmt.Printf("Using default binary path: %s\n", binaryPath)
		}
	}

	arch, operatingSystem := getClientArch()
	downloadArch, downloadOS := getDownloadArch(arch, operatingSystem)

	imageRef := fmt.Sprintf("ghcr.io/openfaasltd/k3sup-pro:%s", version)

	fmt.Printf("Downloading: %s (%s/%s)\n", imageRef, downloadOS, downloadArch)

	tmpTarDir, err := os.MkdirTemp(os.TempDir(), "k3sup-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tmpTarDir)

	tmpTar := path.Join(tmpTarDir, "k3sup-pro.tar")

	f, err := os.Create(tmpTar)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", tmpTar, err)
	}
	defer f.Close()

	img, err := crane.Pull(imageRef, crane.WithPlatform(&v1.Platform{Architecture: downloadArch, OS: downloadOS}))
	if err != nil {
		return fmt.Errorf("pulling %s: %w", imageRef, err)
	}

	if err := crane.Export(img, f); err != nil {
		return fmt.Errorf("exporting %s: %w", imageRef, err)
	}

	if verbose {
		fmt.Printf("Wrote OCI filesystem to: %s\n", tmpTar)
	}

	tarFile, err := os.Open(tmpTar)
	if err != nil {
		return fmt.Errorf("failed to open %s: %w", tmpTar, err)
	}
	defer tarFile.Close()

	// Extract to temporary directory first
	tmpExtractDir, err := os.MkdirTemp(os.TempDir(), "k3sup-extract-*")
	if err != nil {
		return fmt.Errorf("failed to create extract directory: %w", err)
	}
	defer os.RemoveAll(tmpExtractDir)

	gzipped := false
	if err := archive.Untar(tarFile, tmpExtractDir, gzipped, true); err != nil {
		return fmt.Errorf("failed to untar %s: %w", tmpTar, err)
	}

	binaryName := "k3sup-pro"
	if runtime.GOOS == "windows" {
		binaryName = "k3sup-pro.exe"
	}

	newBinary := path.Join(tmpExtractDir, binaryName)
	if err := os.Chmod(newBinary, 0755); err != nil {
		return fmt.Errorf("failed to chmod %s: %w", newBinary, err)
	}

	// Verify the extracted binary works
	if verbose {
		fmt.Println("Verifying extracted binary..")
	}
	task := goexecute.ExecTask{
		Command: newBinary,
		Args:    []string{"version"},
	}

	res, err := task.Execute(context.Background())
	if err != nil {
		return fmt.Errorf("failed to execute extracted binary: %w", err)
	}

	if res.ExitCode != 0 {
		return fmt.Errorf("extracted binary test failed: %s", res.Stderr)
	}

	if verbose {
		fmt.Printf("New binary version check:\n%s", res.Stdout)
	}

	// Install to target path
	targetBinary := path.Join(binaryPath, binaryName)

	// Ensure target directory exists
	if err := os.MkdirAll(binaryPath, 0755); err != nil {
		return fmt.Errorf("failed to create target directory %s: %w", binaryPath, err)
	}

	if err := copyFile(newBinary, targetBinary); err != nil {
		return fmt.Errorf("failed to copy binary to %s: %w", targetBinary, err)
	}
	if err := os.Chmod(targetBinary, 0755); err != nil {
		return fmt.Errorf("failed to chmod %s: %w", targetBinary, err)
	}
	fmt.Printf("Installed: %s.. OK.\n", targetBinary)

	// Final version check
	finalTask := goexecute.ExecTask{
		Command: targetBinary,
		Args:    []string{"version"},
	}

	finalRes, err := finalTask.Execute(context.Background())
	if err != nil {
		return fmt.Errorf("failed to execute updated binary: %w", err)
	}

	if finalRes.ExitCode == 0 {
		fmt.Println("Installation completed successfully!")
		if !verbose {
			fmt.Print(finalRes.Stdout)
		}
	}

	return nil
}

func getClientArch() (arch string, os string) {
	if runtime.GOOS == "windows" {
		return runtime.GOARCH, runtime.GOOS
	}

	return env.GetClientArch()
}

func getDownloadArch(clientArch, clientOS string) (arch string, os string) {
	downloadArch := strings.ToLower(clientArch)
	downloadOS := strings.ToLower(clientOS)

	if downloadArch == "x86_64" {
		downloadArch = "amd64"
	} else if downloadArch == "aarch64" {
		downloadArch = "arm64"
	}

	return downloadArch, downloadOS
}

// copyFile copies a file from src to dst
func copyFile(src, dst string) error {
	sf, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sf.Close()

	df, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer df.Close()

	_, err = io.Copy(df, sf)
	return err
}

```

### Core Architecture Module: `cmd/install.go`
```
package cmd

import (
	"bytes"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/alexellis/k3sup/pkg"
	operator "github.com/alexellis/k3sup/pkg/operator"

	"errors"

	homedir "github.com/mitchellh/go-homedir"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
	"golang.org/x/term"
)

var kubeconfig []byte

type k3sExecOptions struct {
	Datastore    string
	Token        string
	ExtraArgs    string
	FlannelIPSec bool
	NoExtras     bool
}

// PinnedK3sChannel will track the stable channel of the K3s API,
// so for production use, you should pin to a specific version
// such as v1.19
// Channels API available at:
// https://update.k3s.io/v1-release/channels
const PinnedK3sChannel = "stable"

const getScript = "curl -sfL https://get.k3s.io"

// MakeInstall creates the install command
func MakeInstall() *cobra.Command {
	var command = &cobra.Command{
		Use:   "install",
		Short: "Install k3s on a server via SSH",
		Long: `Install k3s on a server via SSH.

` + pkg.SupportMessageShort + `
`,
		Example: `  # Simple installation of stable version, outputting a
  # kubeconfig to the working directory
  k3sup install --ip IP --user USER

  # Merge kubeconfig into local file under custom context
  k3sup install \
    --host HOST \
    --merge \
    --local-path $HOME/.kube/kubeconfig \
    --context k3s-prod-eu-1

  # Only download kubeconfig
  k3sup install --ip IP \
    --user USER \
    --skip-install

  # Install a specific version on local machine without using SSH
  k3sup install --local --k3s-version v1.25.1

  # Install, passing extra args to K3s
  k3sup install --local --k3s-extra-args="--data-dir /mnt/ssd/k3s"

  # Start a cluster with embedded etcd
  k3sup install --host HOST --cluster

  # Install from a specific channel
  k3sup install --host HOST --k3s-channel [latest|stable]

  # Use a custom path to your SSH key
  k3sup install --host HOST \
    --ssh-key $HOME/ec2-key.pem`,
		SilenceUsage: true,
	}

	command.Flags().IP("ip", net.ParseIP("127.0.0.1"), "Public IP of node")
	command.Flags().String("user", "root", "Username for SSH login")

	command.Flags().String("host", "", "Public hostname of node on which to install agent")

	command.Flags().String("ssh-key", "~/.ssh/id_rsa", "The ssh key to use for remote login")
	command.Flags().Int("ssh-port", 22, "The port on which to connect for ssh")
	command.Flags().Bool("sudo", true, "Use sudo for installation. e.g. set to false when using the root user and no sudo is available.")
	command.Flags().Bool("skip-install", false, "Skip the k3s installer")

	command.Flags().String("local-path", "kubeconfig", "Local path to save the kubeconfig file")
	command.Flags().String("context", "default", "Set the name of the kubeconfig context.")
	command.Flags().Bool("no-extras", false, `Disable "servicelb" and "traefik"`)

	command.Flags().Bool("ipsec", false, "Enforces and/or activates optional extra argument for k3s: flannel-backend option: ipsec")
	command.Flags().Bool("merge", false, `Merge the config with existing kubeconfig if it already exists.
Provide the --local-path flag with --merge if a kubeconfig already exists in some other directory`)
	command.Flags().Bool("local", false, "Perform a local install without using ssh")
	command.Flags().Bool("cluster", false, "Form a cluster using embedded etcd (requires K8s >= 1.19)")

	command.Flags().Bool("print-command", false, "Print a command that you can use with SSH to manually recover from an error")
	command.Flags().String("datastore", "", "connection-string for the k3s datastore to enable HA - i.e. \"mysql://username:password@tcp(hostname:3306)/database-name\"")
	command.Flags().String("token", "", "the token used to encrypt the datastore, must be the same token for all nodes")

	command.Flags().String("k3s-version", "", "Set a version to install, overrides k3s-channel")
	command.Flags().String("k3s-extra-args", "", "Additional arguments to pass to k3s installer, wrapped in quotes (e.g. --k3s-extra-args '--disable servicelb')")
	command.Flags().String("k3s-channel", PinnedK3sChannel, "Release channel: stable, latest, or pinned v1.19")

	command.Flags().String("tls-san", "", "Use an additional IP or hostname for the API server")

	command.PreRunE = func(command *cobra.Command, args []string) error {

		local, err := command.Flags().GetBool("local")
		if err != nil {
			return err
		}

		if !local {
			_, err = command.Flags().GetString("host")
			if err != nil {
				return err
			}

			if _, err := command.Flags().GetIP("ip"); err != nil {
				return err
			}

			if _, err := command.Flags().GetInt("ssh-port"); err != nil {
				return err
			}
		}
		return nil
	}

	command.RunE = func(command *cobra.Command, args []string) error {

		fmt.Printf("Running: k3sup install\n")

		localKubeconfig, _ := command.Flags().GetString("local-path")

		skipInstall, err := command.Flags().GetBool("skip-install")
		if err != nil {
			return err
		}

		tlsSAN, _ := command.Flags().GetString("tls-san")

		useSudo, err := command.Flags().GetBool("sudo")
		if err != nil {
			return err
		}

		sudoPrefix := ""
		if useSudo {
			sudoPrefix = "sudo "
		}

		k3sVersion, err := command.Flags().GetString("k3s-version")
		if err != nil {
			return err
		}
		k3sExtraArgs, err := command.Flags().GetString("k3s-extra-args")
		if err != nil {
			return err
		}
		k3sChannel, err := command.Flags().GetString("k3s-channel")
		if err != nil {
			return err
		}
		k3sNoExtras, err := command.Flags().GetBool("no-extras")
		if err != nil {
			return err
		}

		flannelIPSec, _ := command.Flags().GetBool("ipsec")

		local, _ := command.Flags().GetBool("local")

		ip, err := command.Flags().GetIP("ip")
		if err != nil {
			return err
		}

		host, err := command.Flags().GetString("host")
		if err != nil {
			return err
		}
		if len(host) == 0 {
			host = ip.String()
		}

		log.Println(host)

		cluster, _ := command.Flags().GetBool("cluster")
		datastore, _ := command.Flags().GetString("datastore")
		printCommand, err := command.Flags().GetBool("print-command")
		if err != nil {
			return err
		}

		merge, err := command.Flags().GetBool("merge")
		if err != nil {
			return err
		}
		context, err := command.Flags().GetString("context")
		if err != nil {
			return err
		}

		token, err := command.Flags().GetString("token")
		if err != nil {
			return err
		}
		if len(datastore) > 0 {
			if strings.Index(datastore, "ssl-mode=REQUIRED") > -1 {
				return fmt.Errorf("remove ssl-mode=REQUIRED from your datastore string, it is not supported by the k3s syntax")
			}
			if strings.Index(datastore, "mysql") > -1 && strings.Index(datastore, "tcp") == -1 {
				return fmt.Errorf("you must specify the mysql host as tcp(host:port) or tcp(ip:port), see the k3s docs for more: https://rancher.com/docs/k3s/latest/en/installation/ha")
			}

			if token == "" {
				return fmt.Errorf("you must provide the token when using an external datastore. Make sure to use the same token as other nodes")
			}
		}

		installk3sExec := makeInstallExec(cluster, host, tlsSAN,
			k3sExecOptions{
				Datastore:    datastore,
				Token:        token,
				FlannelIPSec: flannelIPSec,
				NoExtras:     k3sNoExtras,
				ExtraArgs:    k3sExtraArgs,
			})

		if len(k3sVersion) == 0 && len(k3sChannel) == 0 {
			return fmt.Errorf("give a value for --k3s-version or --k3s-channel")
		}

		installStr := createVersionStr(k3sVersion, k3sChannel)

		installK3scommand := fmt.Sprintf("%s | %s %s sh -\n", getScript, installk3sExec, installStr)

		getConfigcommand := fmt.Sprintf("%scat /etc/rancher/k3s/k3s.yaml\n", sudoPrefix)

		if local {
			operator := operator.ExecOperator{}

			if !skipInstall {
				fmt.Printf("Executing: %s\n", installK3scommand)

				res, err := operator.Execute(installK3scommand)
				if err != nil {
					return err
				}

				if res.ExitCode != 0 {
					if len(res.StdErr) > 0 {
						fmt.Printf("stderr: %q", res.StdErr)
					}
				}

				if len(res.StdOut) > 0 {
					fmt.Printf("stdout: %q", res.StdOut)
				}
			} else {
				fmt.Printf("Skipping local installation\n")
			}

			if err = obtainKubeconfig(operator, getConfigcommand, host, context, localKubeconfig, merge); err != nil {
				return err
			}

			return nil
		}

		fmt.Println("Public IP: " + host)

		port, _ := command.Flags().GetInt("ssh-port")
		user, _ := command.Flags().GetString("user")
		sshKey, _ := command.Flags().GetString("ssh-key")

		sshKeyPath := expandPath(sshKey)
		address := fmt.Sprintf("%s:%d", host, port)

		sshOperator, sshOperatorDone, errored, err := connectOperator(user, address, sshKeyPath)
		if errored {
			return err
		}

		if sshOperatorDone != nil {

			defer sshOperatorDone()
		}

		if !skipInstall {

			if printCommand {
				fmt.Printf("ssh: %s\n", installK3scommand)
			}

			res, err := sshOperator.Execute(installK3scommand)

			if err != nil {
				return fmt.Errorf("error received processing command: %s", err)
			}

			fmt.Printf("Result: %s %s\n", string(res.StdOut), string(res.StdErr))
		}

		if printCommand {
			fmt.Printf("ssh: %s\n", getConfigcommand)
		}

		if err = obtainKubeconfig(sshOperator, getConfigcommand, host, context, localKubeconfig, merge); err != nil {
			return err
		}

		return nil
	}

	return command
}

type DoneFunc func()

// connectOperator
//
// Try SSH agent without parsing key files, will succeed if the user
// has already added a key to the SSH Agent, or if using a configured
// smartcard.
//
// If the initial connection attempt fails fall through to the using
// the supplied/default private key file
// DoneFunc should be called by the caller to close the SSH connection when done
func connectOperator(user string, address string, sshKeyPath string) (*operator.SSHOperator, DoneFunc, bool, error) {
	var sshOperator *operator.SSHOperator
	var initialSSHErr error
	var closeSSHAgentFunc func() error

	doneFunc := func() {
		if sshOperator != nil {
			sshOperator.Close()
		}
		if closeSSHAgentFunc != nil {
			closeS
```

### Core Architecture Module: `cmd/join.go`
```
package cmd

import (
	"fmt"
	"net"
	"os"
	"path"
	"runtime"
	"strings"

	"errors"

	"github.com/alexellis/k3sup/pkg"
	operator "github.com/alexellis/k3sup/pkg/operator"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
)

// MakeJoin creates the join command
func MakeJoin() *cobra.Command {
	var command = &cobra.Command{
		Use:   "join",
		Short: "Install the k3s agent on a remote host and join it to an existing server",
		Long: `Install the k3s agent on a remote host and join it to an existing server

` + pkg.SupportMessageShort + `
`,
		Example: `  # Install K3s joining a cluster as an agent
  k3sup join \
    --user AGENT_USER \
    --ip AGENT_IP \
    --server-ip IP \
    --server-user SERVER_USER

  # Install K3s joining a cluster as another server
  k3sup join \
    --user AGENT_USER \
    --ip AGENT_IP \
    --server \
    --server-ip IP \
    --server-user SERVER_USER

  # Join whilst specifying a channel for the k3sup version
  k3sup join --user pi \
    --server-host HOST \
    --host HOST \
    --k3s-channel latest`,
		SilenceUsage: true,
	}

	command.Flags().IP("ip", net.ParseIP("127.0.0.1"), "Public IP of node on which to install agent")
	command.Flags().IP("server-ip", net.ParseIP("127.0.0.1"), "Public IP of an existing k3s server")

	command.Flags().String("host", "", "Public hostname of node on which to install agent")
	command.Flags().String("server-host", "", "Public hostname of an existing k3s server")
	command.Flags().String("server-url", "", "If different from server-ip or server-host, the URL of the server to join")

	command.Flags().String("user", "root", "Username for SSH login")
	command.Flags().String("server-user", "root", "Server username for SSH login (Default to --user)")

	command.Flags().String("ssh-key", "~/.ssh/id_rsa", "The ssh key to use for remote login")
	command.Flags().Int("ssh-port", 22, "The port on which to connect for ssh")
	command.Flags().Int("server-ssh-port", 22, "The port on which to connect to server for ssh (Default to --ssh-port)")
	command.Flags().Bool("skip-install", false, "Skip the k3s installer")
	command.Flags().Bool("sudo", true, "Use sudo for installation. e.g. set to false when using the root user and no sudo is available.")

	command.Flags().Bool("server", false, "Join the cluster as a server rather than as an agent for the embedded etcd mode")
	command.Flags().Bool("no-extras", false, `Disable "servicelb" and "traefik", when using --server flag`)
	command.Flags().Bool("print-command", false, "Print a command that you can use with SSH to manually recover from an error")
	command.Flags().String("node-token-path", "", "file containing --node-token")
	command.Flags().String("node-token", "", "prefetched token used by nodes to join the cluster")

	command.Flags().String("k3s-extra-args", "", "Additional arguments to pass to k3s installer, wrapped in quotes (e.g. --k3s-extra-args '--node-taint key=value:NoExecute')")
	command.Flags().String("k3s-version", "", "Set a version to install, overrides k3s-channel")
	command.Flags().String("k3s-channel", PinnedK3sChannel, "Release channel: stable, latest, or i.e. v1.19")

	command.Flags().String("tls-san", "", "Use an additional IP or hostname for the API server, when using --server flag")

	command.Flags().String("server-data-dir", "/var/lib/rancher/k3s/", "Override the path used to fetch the node-token from the server")

	command.RunE = func(command *cobra.Command, args []string) error {
		fmt.Printf("Running: k3sup join\n")

		ip, err := command.Flags().GetIP("ip")
		if err != nil {
			return err
		}

		var nodeToken string

		if command.Flags().Changed("node-token") {
			nodeToken, _ = command.Flags().GetString("node-token")
		} else if command.Flags().Changed("node-token-path") {
			nodeTokenPath, _ := command.Flags().GetString("node-token-path")
			if len(nodeTokenPath) > 0 {
				data, err := os.ReadFile(nodeTokenPath)
				if err != nil {
					return err
				}

				nodeToken = strings.TrimSpace(string(data))
			}
		}

		host, err := command.Flags().GetString("host")
		if err != nil {
			return err
		}
		if len(host) == 0 {
			host = ip.String()
		}

		dataDir, err := command.Flags().GetString("server-data-dir")
		if err != nil {
			return err
		}

		if len(dataDir) == 0 {
			return fmt.Errorf("--server-data-dir must be set")
		}

		if !strings.HasPrefix(dataDir, "/") {
			return fmt.Errorf("--server-data-dir must begin with /")
		}

		serverIP, err := command.Flags().GetIP("server-ip")
		if err != nil {
			return err
		}

		serverHost, err := command.Flags().GetString("server-host")
		if err != nil {
			return err
		}
		if len(serverHost) == 0 {
			serverHost = serverIP.String()
		}

		serverURL, err := command.Flags().GetString("server-url")
		if err != nil {
			return err
		}

		fmt.Printf("Joining %s => %s\n", host, serverHost)
		if len(serverURL) > 0 {
			fmt.Printf("Server join URL: %s\n", serverURL)
		}

		user, _ := command.Flags().GetString("user")

		serverUser := user
		if command.Flags().Changed("server-user") {
			serverUser, _ = command.Flags().GetString("server-user")
		}

		sshKey, _ := command.Flags().GetString("ssh-key")
		server, err := command.Flags().GetBool("server")
		if err != nil {
			return err
		}

		port, _ := command.Flags().GetInt("ssh-port")
		serverPort := port
		if command.Flags().Changed("server-ssh-port") {
			serverPort, _ = command.Flags().GetInt("server-ssh-port")
		}

		k3sVersion, err := command.Flags().GetString("k3s-version")
		if err != nil {
			return err
		}
		k3sExtraArgs, err := command.Flags().GetString("k3s-extra-args")
		if err != nil {
			return err
		}
		k3sChannel, err := command.Flags().GetString("k3s-channel")
		if err != nil {
			return err
		}

		if len(k3sVersion) == 0 && len(k3sChannel) == 0 {
			return fmt.Errorf("give a value for --k3s-version or --k3s-channel")
		}

		printCommand, err := command.Flags().GetBool("print-command")
		if err != nil {
			return err
		}

		useSudo, err := command.Flags().GetBool("sudo")
		if err != nil {
			return err
		}
		sudoPrefix := ""
		if useSudo {
			sudoPrefix = "sudo "
		}
		sshKeyPath := expandPath(sshKey)

		if len(nodeToken) == 0 {
			address := fmt.Sprintf("%s:%d", serverHost, serverPort)

			sshOperator, sshOperatorDone, errored, err := connectOperator(serverUser, address, sshKeyPath)
			if errored {
				return err
			}

			if sshOperatorDone != nil {
				defer sshOperatorDone()
			}

			getTokenCommand := fmt.Sprintf("%scat %s\n", sudoPrefix, path.Join(dataDir, "/server/node-token"))
			if printCommand {
				fmt.Printf("ssh: %s\n", getTokenCommand)
			}

			streamToStdio := false
			res, err := sshOperator.ExecuteStdio(getTokenCommand, streamToStdio)

			if err != nil {
				return fmt.Errorf("unable to get join-token from server: %w", err)
			}

			if len(res.StdErr) > 0 {
				fmt.Printf("Error or warning getting node-token: %s\n", res.StdErr)
			} else {
				fmt.Printf("Received node-token from %s.. ok.\n", serverHost)
			}

			// Explicit close of the SSH connection as early as possible
			// which complements the defer
			if sshOperatorDone != nil {
				sshOperatorDone()
			}

			nodeToken = strings.TrimSpace(string(res.StdOut))
		}

		if server {

			tlsSan, _ := command.Flags().GetString("tls-san")
			noExtras, _ := command.Flags().GetBool("no-extras")

			err = setupAdditionalServer(serverHost, host, port, user, sshKeyPath, nodeToken, k3sExtraArgs, k3sVersion, k3sChannel, tlsSan, printCommand, serverURL, noExtras)
		} else {
			err = setupAgent(serverHost, host, port, user, sshKeyPath, nodeToken, k3sExtraArgs, k3sVersion, k3sChannel, printCommand, serverURL)
		}

		if err == nil {
			fmt.Printf("\n%s\n", pkg.SupportMessageShort)
		}

		return err
	}

	command.PreRunE = func(command *cobra.Command, args []string) error {

		_, err := command.Flags().GetIP("ip")
		if err != nil {
			return err
		}

		_, err = command.Flags().GetIP("server-ip")
		if err != nil {
			return err
		}

		_, err = command.Flags().GetString("host")
		if err != nil {
			return err
		}

		_, err = command.Flags().GetString("server-host")
		if err != nil {
			return err
		}

		_, err = command.Flags().GetInt("ssh-port")
		if err != nil {
			return err
		}

		tlsSan, err := command.Flags().GetString("tls-san")
		if err != nil {
			return err
		}

		noExtras, err := command.Flags().GetBool("no-extras")
		if err != nil {
			return err
		}

		if len(tlsSan) > 0 || noExtras {
			server, err := command.Flags().GetBool("server")
			if err != nil {
				return err
			}

			if !server {
				if noExtras {
					return fmt.Errorf("--no-extras can only be used with --server")
				}
				return fmt.Errorf("--tls-san can only be used with --server")
			}

		}

		return nil
	}

	return command
}

func setupAdditionalServer(serverHost, host string, port int, user, sshKeyPath, joinToken, k3sExtraArgs, k3sVersion, k3sChannel, tlsSAN string, printCommand bool, serverURL string, noExtras bool) error {
	address := fmt.Sprintf("%s:%d", host, port)

	var sshOperator *operator.SSHOperator
	var initialSSHErr error
	if runtime.GOOS != "windows" {

		var sshAgentAuthMethod ssh.AuthMethod
		sshAgentAuthMethod, initialSSHErr = sshAgentOnly()
		if initialSSHErr == nil {
			// Try SSH agent without parsing key files, will succeed if the user
			// has already added a key to the SSH Agent, or if using a configured
			// smartcard
			config := &ssh.ClientConfig{
				User:            user,
				Auth:            []ssh.AuthMethod{sshAgentAuthMethod},
				HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			}

			sshOperator, initialSSHErr = operator.NewSSHOperator(address, config)
		}
	} else {
		initialSSHErr = errors.New("ssh-agent unsupported on windows")
	}

	// If the initial connection attempt fails fall through to the using
	// the supplied/default private key file
	if initialSSHErr != nil {
		publicKeyFileAuth, closeSSHAgent, err := loadPublickey(sshKeyPath)
		if err != nil {
			return fmt.Errorf("unable to load the ssh key with path %q: %w", sshKeyPath, e
```

### Core Architecture Module: `cmd/node-token.go`
```
package cmd

import (
	"fmt"
	"net"
	"os"
	"path"
	"strings"

	"github.com/alexellis/k3sup/pkg"
	ssh "github.com/alexellis/k3sup/pkg/operator"

	"github.com/spf13/cobra"
)

// MakeNodeToken creates the node-token command
func MakeNodeToken() *cobra.Command {
	var command = &cobra.Command{
		Use:   "node-token",
		Short: "Retrieve the node token from a server",
		Long: `Retrieve the node token from a server required for a
server or agent to join the cluster.

` + pkg.SupportMessageShort + `
`,
		Example: `  # Get the node token from the server and pipe it to a file
  k3sup node-token --ip IP --user USER > token.txt
`,
		SilenceUsage: true,
	}

	command.Flags().IP("ip", net.ParseIP("127.0.0.1"), "Public IP of node")
	command.Flags().String("user", "root", "Username for SSH login")

	command.Flags().String("host", "", "Public hostname of node on which to install agent")

	command.Flags().Bool("local", false, "Use local machine instead of ssh client")
	command.Flags().String("ssh-key", "~/.ssh/id_rsa", "The ssh key to use for remote login")
	command.Flags().Int("ssh-port", 22, "The port on which to connect for ssh")
	command.Flags().Bool("sudo", true, "Use sudo for installation. e.g. set to false when using the root user and no sudo is available.")

	command.Flags().Bool("print-command", false, "Print the command to be executed")
	command.Flags().String("server-data-dir", "/var/lib/rancher/k3s/", "Override the path used to fetch the node-token from the server")

	command.PreRunE = func(command *cobra.Command, args []string) error {
		local, err := command.Flags().GetBool("local")
		if err != nil {
			return err
		}

		if !local {
			_, err = command.Flags().GetString("host")
			if err != nil {
				return err
			}

			if _, err := command.Flags().GetIP("ip"); err != nil {
				return err
			}

			if _, err := command.Flags().GetInt("ssh-port"); err != nil {
				return err
			}
		}
		return nil
	}

	command.RunE = func(command *cobra.Command, args []string) error {

		fmt.Fprintf(os.Stderr, "Fetching: /etc/rancher/k3s/k3s.yaml\n")

		useSudo, err := command.Flags().GetBool("sudo")
		if err != nil {
			return err
		}

		sudoPrefix := ""
		if useSudo {
			sudoPrefix = "sudo "
		}

		local, _ := command.Flags().GetBool("local")

		ip, err := command.Flags().GetIP("ip")
		if err != nil {
			return err
		}

		host, err := command.Flags().GetString("host")
		if err != nil {
			return err
		}
		if len(host) == 0 {
			host = ip.String()
		}

		port, _ := command.Flags().GetInt("ssh-port")
		user, _ := command.Flags().GetString("user")
		sshKey, _ := command.Flags().GetString("ssh-key")

		dataDir, _ := command.Flags().GetString("server-data-dir")

		sshKeyPath := expandPath(sshKey)
		address := fmt.Sprintf("%s:%d", host, port)
		if !local {
			fmt.Fprintf(os.Stderr, "Remote: %s\n", address)
		}

		printCommand := false

		getTokenCommand := fmt.Sprintf("%scat %s\n", sudoPrefix, path.Join(dataDir, "/server/node-token"))
		if printCommand {
			fmt.Printf("ssh: %s\n", getTokenCommand)
		}

		var operator ssh.CommandOperator
		if local {
			operator = ssh.ExecOperator{}
		} else {
			sshOperator, sshOperatorDone, errored, err := connectOperator(user, address, sshKeyPath)
			if errored {
				return err
			}
			operator = sshOperator

			if sshOperatorDone != nil {
				defer sshOperatorDone()
			}
		}

		nodeToken, err := obtainNodeToken(operator, getTokenCommand, host)
		if err != nil {
			return err
		}

		if len(nodeToken) == 0 {
			return fmt.Errorf("no node token found")
		}

		fmt.Println(nodeToken)
		return nil
	}

	return command
}

func obtainNodeToken(operator ssh.CommandOperator, command, host string) (string, error) {
	res, err := operator.ExecuteStdio(command, false)
	if err != nil {
		return "", fmt.Errorf("error received processing command: %s", err)
	}

	return strings.TrimSpace(string(res.StdOut)), nil

}

```

### Core Architecture Module: `cmd/plan.go`
```
package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/alexellis/k3sup/pkg"
	"github.com/spf13/cobra"
)

func MakePlan() *cobra.Command {
	var command = &cobra.Command{
		Use:   "plan",
		Short: "Plan an installation of K3s.",
		Long: `Generate a bash script or plan of installation commands for K3s for a 
Highly Available (HA) Kubernetes cluster.

Examples JSON input file:

[{"hostname": "node-1", "ip": "192.168.128.102"},
{"hostname": "node-2", "ip": "192.168.128.103"},
{"hostname": "node-3", "ip": "192.168.128.104"}]

` + pkg.SupportMessageShort + `
`,
		Example: `  # Generate an installation script where the first
  # 3 available hosts are dedicated as servers, with a custom user.
  # The remaining hosts are added as agents.
  k3sup plan hosts.json --servers 3 --user ubuntu

  # Override the TLS SAN, for HA with 5 servers specified
  k3sup plan hosts.json --servers 5 --tls-san $SAN_IP
`,
		SilenceUsage: true,
	}

	command.Flags().Int("servers", 3, "Number of servers to use from the devices file")
	command.Flags().String("local-path", "kubeconfig", "Where to save the kubeconfig file")
	command.Flags().String("context", "default", "Name of the kubeconfig context to use")
	command.Flags().String("user", "root", "Username for SSH login")

	command.Flags().String("ssh-key", "", "Path to the private key for SSH login")
	command.Flags().String("tls-san", "", "SAN for TLS certificates, can be a comma-separated list")
	command.Flags().String("server-k3s-extra-args", "", "Extra arguments to be passed into the k3s server")
	command.Flags().String("agent-k3s-extra-args", "", "Extra arguments to be passed into the k3s agent")

	// Background
	command.Flags().Bool("background", false, "Run the installation in the background for all agents/nodes after the first server is up")

	command.Flags().Int("limit", 0, "Maximum number of nodes to use from the devices file, 0 to use all devices")

	command.Flags().Bool("merge", true, `Merge the config with existing kubeconfig if it already exists.
Provide the --local-path flag with --merge if a kubeconfig already exists in some other directory`)

	command.RunE = func(cmd *cobra.Command, args []string) error {

		if len(args) == 0 {
			return fmt.Errorf("give a path to a JSON file containing a list of devices")
		}

		nodeLimit, _ := cmd.Flags().GetInt("limit")
		name := args[0]
		data, err := os.ReadFile(name)
		if err != nil {
			return err
		}

		background, _ := cmd.Flags().GetBool("background")
		merge, _ := cmd.Flags().GetBool("merge")

		var hosts []Host
		if err = json.Unmarshal(data, &hosts); err != nil {
			return err
		}

		serverK3sExtraArgs, _ := cmd.Flags().GetString("server-k3s-extra-args")
		agentK3sExtraArgs, _ := cmd.Flags().GetString("agent-k3s-extra-args")

		servers, _ := cmd.Flags().GetInt("servers")
		kubeconfig, _ := cmd.Flags().GetString("local-path")
		contextName, _ := cmd.Flags().GetString("context")
		user, _ := cmd.Flags().GetString("user")
		tlsSan, _ := cmd.Flags().GetString("tls-san")

		tlsSanStr := ""
		if len(tlsSan) > 0 {
			tlsSanStr = fmt.Sprintf(` \
--tls-san %s`, tlsSan)
		}

		sshKey, _ := cmd.Flags().GetString("ssh-key")

		sshKeySt := ""
		if len(sshKey) > 0 {
			sshKeySt = fmt.Sprintf(` \
--ssh-key %s`, sshKey)
		}

		mergeStr := ""
		if merge {
			if _, err := os.Stat(kubeconfig); err == nil {
				mergeStr = " \n--merge"
			}
		}

		bgStr := ""
		if background {
			bgStr = " &"
		}

		serversAdded := 0
		var primaryServer Host
		script := "#!/bin/sh\n\n"

		serverExtraArgsSt := ""
		if len(serverK3sExtraArgs) > 0 {
			serverExtraArgsSt = fmt.Sprintf(` \
--k3s-extra-args "%s"`, serverK3sExtraArgs)
		}
		agentExtraArgsSt := ""
		if len(agentK3sExtraArgs) > 0 {
			agentExtraArgsSt = fmt.Sprintf(` \
--k3s-extra-args "%s"`, agentK3sExtraArgs)
		}

		for i, host := range hosts {
			if serversAdded == 0 {

				script += `echo "Setting up primary server 1"
`

				script += fmt.Sprintf(`k3sup install --host %s \
--user %s \
--cluster \
--local-path %s \
--context %s%s%s%s%s
`,
					host.IP,
					user,
					kubeconfig,
					contextName,
					tlsSanStr,
					serverExtraArgsSt,
					sshKeySt,
					mergeStr)

				script += fmt.Sprintf(`
echo "Fetching the server's node-token into memory"

export NODE_TOKEN=$(k3sup node-token --host %s --user %s%s)
`, host.IP, user, sshKeySt)

				serversAdded = 1
				primaryServer = host
			} else if serversAdded < servers {
				script += fmt.Sprintf("\necho \"Setting up additional server: %d\"\n", serversAdded+1)

				script += fmt.Sprintf(`k3sup join \
--host %s \
--server-host %s \
--server \
--node-token "$NODE_TOKEN" \
--user %s%s%s%s%s
`, host.IP, primaryServer.IP, user, tlsSanStr, serverExtraArgsSt, sshKeySt, bgStr)

				serversAdded++
			} else {
				script += fmt.Sprintf("\necho \"Setting up worker: %d\"\n", (i+1)-serversAdded)

				script += fmt.Sprintf(`k3sup join \
--host %s \
--server-host %s \
--node-token "$NODE_TOKEN" \
--user %s%s%s%s
`, host.IP, primaryServer.IP, user, agentExtraArgsSt, sshKeySt, bgStr)
			}

			if nodeLimit > 0 && i+1 >= nodeLimit {
				break
			}
		}

		fmt.Printf("%s\n", script)

		return nil
	}

	return command
}

type Host struct {
	Hostname string `json:"hostname"`
	IP       string `json:"ip"`
}

```

### Core Architecture Module: `cmd/pro.go`
```
package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func MakePro() *cobra.Command {
	var command = &cobra.Command{
		Use:   "pro",
		Short: "Learn about K3sup Pro",
		Long: `K3sup Pro is built for professionals, teams, and homelabs:

  - IaaC/GitOps workflow with plan and apply commands
  - Parallel installation across many nodes
  - Rolling upgrades and day-2 operations
  - Uninstall, exec, and get-config across your fleet
  - Pre-download K3s binaries for efficient installations across many nodes
  - Integrates directly with https://slicervm.com

Learn more at https://github.com/alexellis/k3sup#k3sup-pro`,
		SilenceUsage: true,
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println(cmd.Long)
		},
	}

	return command
}

```

### Core Architecture Module: `cmd/ready.go`
```
package cmd

import (
	"fmt"
	"os"
	"strings"
	"time"

	execute "github.com/alexellis/go-execute/v2"
	"github.com/alexellis/k3sup/pkg"
	"github.com/spf13/cobra"
)

func MakeReady() *cobra.Command {
	var command = &cobra.Command{
		Use:   "ready",
		Short: "Check if a cluster is ready using kubectl.",
		Long: `Check if the K3s cluster is ready using kubectl to query the nodes.

` + pkg.SupportMessageShort + `
`,
		Example: `  # Check from a local file, with the context "default"
  k3sup ready \
    --context default \
    --kubeconfig ./kubeconfig

  # Check a merged kubeconfig with a custom context
  k3sup ready \
    --context e2e \
    --kubeconfig $HOME/.kube/config
`,
		SilenceUsage: true,
	}

	command.Flags().Int("attempts", 25, "Number of attempts to check for readiness")
	command.Flags().Duration("pause", time.Second*2, "Pause between checking cluster for readiness")
	command.Flags().String("kubeconfig", "$HOME/.kube/config", "Path to the kubeconfig file")
	command.Flags().String("context", "default", "Name of the kubeconfig context to use")
	command.Flags().Bool("quiet", false, "Suppress output from each attempt")

	command.RunE = func(cmd *cobra.Command, args []string) error {

		attempts, _ := cmd.Flags().GetInt("attempts")
		pause, _ := cmd.Flags().GetDuration("pause")
		kubeconfig, _ := cmd.Flags().GetString("kubeconfig")
		contextName, _ := cmd.Flags().GetString("context")
		quiet, _ := cmd.Flags().GetBool("quiet")

		if len(kubeconfig) == 0 {
			return fmt.Errorf("kubeconfig cannot be empty")
		}

		if len(contextName) == 0 {
			return fmt.Errorf("context cannot be empty")
		}

		kubeconfig = os.ExpandEnv(kubeconfig)

		// Inspired by Kind: https://github.com/kubernetes-sigs/kind/blob/main/pkg/cluster/internal/create/actions/waitforready/waitforready.go
		for i := 0; i < attempts; i++ {
			if !quiet {
				fmt.Printf("Checking for nodes to be ready: %d/%d \n", i+1, attempts)
			}

			task := execute.ExecTask{
				Command: "kubectl",
				Args: []string{
					"get",
					"nodes",
					"--kubeconfig=" + kubeconfig,
					"--context=" + contextName,
					"-o=jsonpath='{.items..status.conditions[-1:].status}'",
				},
				StreamStdio: false,
			}

			res, err := task.Execute(cmd.Context())
			if err != nil {
				return err
			}

			if strings.Contains(res.Stderr, "context was not found") {
				return fmt.Errorf("context %s not found in %s", contextName, kubeconfig)
			}

			if res.ExitCode == 0 {
				parts := strings.Split(strings.TrimSpace(res.Stdout), " ")

				ready := true
				for _, part := range parts {
					trimmed := strings.TrimSpace(part)
					trimmed = strings.Trim(trimmed, "'")

					// Note: The command is returning a single quoted string
					if len(trimmed) > 0 && trimmed != "True" {
						ready = false
						break
					}
				}

				if ready {
					if !quiet {
						fmt.Printf("All node(s) are ready\n")
					}
					break
				}
			}
			time.Sleep(pause)
		}

		// Wait until the default service account is created. This was causing a failure during CI.
		for i := 0; i < attempts; i++ {
			if !quiet {
				fmt.Printf("Looking for default service account: %d/%d \n", i+1, attempts)
			}

			task := execute.ExecTask{
				Command: "kubectl",
				Args: []string{
					"get",
					"serviceaccount",
					"default",
					"--kubeconfig=" + kubeconfig,
					"--context=" + contextName,
				},
				StreamStdio: false,
			}

			res, err := task.Execute(cmd.Context())
			if err != nil {
				return err
			}

			if res.ExitCode == 0 {
				if !quiet {
					fmt.Printf("Default service account is ready\n")
				}
				break
			}
			time.Sleep(pause)
		}

		return nil
	}
	return command
}

```

### Core Architecture Module: `cmd/update.go`
```
package cmd

import (
	"fmt"

	"github.com/alexellis/k3sup/pkg"
	"github.com/spf13/cobra"
)

func MakeUpdate() *cobra.Command {
	var command = &cobra.Command{
		Use:   "update",
		Short: "Print update instructions",
		Long: `Print instructions for updating your version of k3sup.

` + pkg.SupportMessageShort + `
`,
		Example:      `  k3sup update`,
		SilenceUsage: false,
	}
	command.Run = func(cmd *cobra.Command, args []string) {
		fmt.Println(k3supUpdate)
	}
	return command
}

const k3supUpdate = `You can update k3sup with the following:

# Use arkade, for a quick installation:
arkade get k3sup

# Remove cached versions of tools
rm -rf $HOME/.k3sup

# For Linux/MacOS:
curl -SLfs https://get.k3sup.dev | sudo sh

# For Windows (using Git Bash)
curl -SLfs https://get.k3sup.dev | sh

# Or download from GitHub: https://github.com/alexellis/k3sup/releases

` + pkg.SupportMessageShort

```

### Core Architecture Module: `cmd/version.go`
```
package cmd

import (
	"fmt"

	"github.com/alexellis/k3sup/pkg"
	"github.com/morikuni/aec"
	"github.com/spf13/cobra"
)

var (
	Version   string
	GitCommit string
)

func PrintK3supASCIIArt() {
	k3supLogo := aec.GreenF.Apply(k3supFigletStr)

	fmt.Print(k3supLogo)
}

func MakeVersion() *cobra.Command {
	var command = &cobra.Command{
		Use:   "version",
		Short: "Print the version",
		Example: `  k3sup version
` + pkg.SupportMessageShort + `
`,
		SilenceUsage: false,
	}
	command.Run = func(cmd *cobra.Command, args []string) {
		PrintK3supASCIIArt()
		if len(Version) == 0 {
			fmt.Println("Version: dev")
		} else {
			fmt.Println("Version:", Version)
		}
		fmt.Println("Git Commit:", GitCommit)

	}
	return command
}

const k3supFigletStr = ` _    _____                    ____ _____ 
| | _|___ / ___ _   _ _ __    / ___| ____|
| |/ / |_ \/ __| | | | '_ \  | |   |  _|  
|   < ___) \__ \ |_| | |_) | | |___| |___ 
|_|\_\____/|___/\__,_| .__/   \____|_____|
                     |_|                  

bootstrap K3s over SSH in < 60s 🚀
`

```

### Core Architecture Module: `main.go`
```
package main

import (
	"os"

	"github.com/alexellis/k3sup/cmd"
	"github.com/alexellis/k3sup/pkg"
	"github.com/spf13/cobra"
)

func main() {

	cmdInstall := cmd.MakeInstall()
	cmdVersion := cmd.MakeVersion()
	cmdJoin := cmd.MakeJoin()
	cmdUpdate := cmd.MakeUpdate()
	cmdReady := cmd.MakeReady()
	cmdPlan := cmd.MakePlan()
	cmdNodeToken := cmd.MakeNodeToken()
	cmdGetConfig := cmd.MakeGetConfig()
	cmdGet := cmd.MakeGet()
	cmdGetPro := cmd.MakeGetPro()
	cmdPro := cmd.MakePro()

	printk3supASCIIArt := cmd.PrintK3supASCIIArt

	var rootCmd = &cobra.Command{
		Use: "k3sup",
		Run: func(cmd *cobra.Command, args []string) {
			printk3supASCIIArt()
			cmd.Help()
		},
		Long: pkg.SupportMessageShort,
	}

	rootCmd.AddCommand(cmdInstall)
	rootCmd.AddCommand(cmdVersion)
	rootCmd.AddCommand(cmdJoin)
	rootCmd.AddCommand(cmdUpdate)
	rootCmd.AddCommand(cmdReady)
	rootCmd.AddCommand(cmdPlan)
	rootCmd.AddCommand(cmdNodeToken)
	rootCmd.AddCommand(cmdGetConfig)

	cmdGet.AddCommand(cmdGetPro)
	rootCmd.AddCommand(cmdGet)
	rootCmd.AddCommand(cmdPro)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #462** (2026-07-09): **Update upload-assets action to 0.5.0**
  *Symptoms*: ## Why do you need this?  ## Description This change updates `alexellis/upload-assets` from `0.4.1` to `0.5.0` in `.github/workflows/publish.yaml`.  ## How Has This Been Tested? This change only updates the GitHub Actions release upload action version in `.github/workflows/publish.yaml`.  The action has no breaking changes.  ## Types of changes - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to change)  ## Checklist: - [x] My code follows the code style of this project. - [ ] My change requires a change to the documentation. - [ ] I have updated the documentation accordingly. - [x] I've read the [CONTRIBUTION](https://github.com/alexellis/arkade/blob/master/CONTRIBUTING.md) guide - [x] I have signed-off my commits with `git commit -s` - [ ] I have added tests to cover my changes. - [ ] All new and existing tests passed. 
  **Post-Mortem & Fix Analysis**:
  > # AI Pull Request Overview  Disclaimer: This review was generated by automated AI and may contain errors. Do not trust its outputs without human verification.  ## Summary  - Updates the release upload GitHub Action from `alexellis/upload-assets@0.4.1` to `@0.5.0`. - The existing `GITHUB_TOKEN` environment variable and `asset_paths` input remain unchanged. - The scoped diff is limited to `.github/workflows/publish.yaml`. - No concrete blocking findings were identified from the scoped workflow change.  ### Approval rating (1-10)  9/10. Low-risk dependency bump in a release workflow; no specific regression is visible from the scoped diff.  ### Summary per file <details> <summary>Summary per file</summary>  | File path | Summary | |-----------|---------| | `.github/workflows/publish.yaml` | Bumps release asset upload action from `0.4.1` to `0.5.0`. |  </details>  ## Overall Assessment  The pull request is narrowly scoped and only changes the version of the release asset upload action used 

- **Issue #460** (2026-03-25): **SSH Handshake Failed**
  *Symptoms*: **Expected behaviour**  It should create 1 master 4 nodes. This scirpt was running about a year ago without errors. Now I have to setup the cluster but it fails with the famous error message "ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain". I've tried it without --server-user and without. Also with and without --ssh-key. A normal ssh <node|master> works without any issues.  **Current behaviour**  The ssh connection didn't come up and no k3s was installed.  **To Reproduce**  Include full unabridged instructions that anyone can use to reproduce the problem  ``` k3sup install \ 	--user root \ 	--ssh-key ${SSH_KEY} \ 	--ip ${MASTER01} \ 	--datastore="${DATASTORE}" \ 	--token=${TOKEN} \ 	--k3s-extra-args "--flannel-backend=none --cluster-cidr=${CLUSTER_CIDR} --service-cidr=${SERVICE_CIDR} --disable traefik --disable-network-policy --node-ip=${MASTER01}" \ 	--context="${CONTEXT}" \ 	--local-path="${KUBE_CONFIG_PATH}"  for IP in $NODES; do 	k3sup join \ 		--user root \ 		--server-user root \ 		--server-ip ${MASTER01} \ 		--ip ${IP} done ```  **Screenshots / console output**  ``` ❯ ./install-k3s.sh Running: k3sup install 2026/03/25 15:54:43 10.2.0.14 Public IP: 10.2.0.14 Error: unable to connect to 10.2.0.14:22 over ssh: ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain Running: k3sup join Joining 10.2.0.15 => 10.2.0.14 Error: unable to connect to 10.

- **Issue #457** (2025-08-20): **Add K3sup Pro to readme and k3sup pro get command**
  *Symptoms*: ## Description  Add K3sup Pro to readme and k3sup pro get command  ## How Has This Been Tested?  ```bash $ go build && ./k3sup get pro  Downloading: ghcr.io/openfaasltd/k3sup-pro:latest (darwin/arm64) Installed: /usr/local/bin/k3sup-pro.. OK. Installation completed successfully!  _  ______               ___ ___  ___   | |/ /__ /____  _ _ __  | _ \ _ \/ _ \  | ' < |_ (_-< || | '_ \ |  _/   / (_) | |_|\_\___/__/\_,_| .__/ |_| |_|_\\___/                   |_|                     Boostrap & update K3s with SSH 🚀  Version: 0.0.1-rc7 Git Commit: aa9b70e6fdb5a16cb6151471bd68f4e7a0315144 ```

- **Issue #456** (2025-07-09): **get.k3sup.dev unavailable**
  *Symptoms*: **Expected behaviour**  To receive the install script via `curl -sLS https://get.k3sup.dev`  **Current behaviour**  ```bash curl -sLS https://get.k3sup.dev -v * Could not resolve host: get.k3sup.dev * Closing connection curl: (6) Could not resolve host: get.k3sup.dev ```  **To Reproduce**  Run: `curl -sLS https://get.k3sup.dev`  **Versions:**  - OS: Ubuntu-24.04  - K3sup Version: latest  **Additional context**  Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Hi Lukas, if Hetzner Cloud is using K3sup they should be sponsoring me. Likewise for yourself, all this infrastructure maintenance costs time and money.  The domain is being moved to a new provider and I've just checked, the download script is resolving to the new location now.  Cheers,  Alex 

- **Issue #453** (2025-03-12): **Give the option to avoid usage of `ssh.InsecureIgnoreHostKey` when connecting to ssh**
  *Symptoms*: **What do you want?**  [Avoid the usage on `ssh.InsecureIngoreHostKey`in the config for the ssh client.](https://github.com/alexellis/k3sup/blob/9f541feda9b7ad040337fbb7aae1256612cf7f77/cmd/install.go#L371)  **Why do you want this?**  [InsecureIgnoreHostKey returns a function that can be used for ClientConfig.HostKeyCallback to accept any host key. It should not be used for production code.](https://github.com/golang/crypto/blob/eccd6366d1be82f8df741718dcdd586eea618221/ssh/client.go#L244-L246). Using it for production code is against security first principles   **Recommended solution**  Not sure about this: I haven't checked yet if there is the possibility for writing an default `HostKeyCallback` that will work for every scenarios. And if not, from the little investigation I've done so far it's still unclear to me how to provide a way to "inject" through k3sup flags a user defined callback (you can figure out why :))  **Additional context**  Please, consider this as my offer to contribute with a PR for adding the feature. I've yet no recommended solutions. Glad to either discuss together for one, or receiving specific implementation requirements I'd have just to contribute to, writing the code.
  **Post-Mortem & Fix Analysis**:
  > > [InsecureIgnoreHostKey returns a function that can be used for ClientConfig.HostKeyCallback to accept any host key. It should not be used for production code.](https://github.com/golang/crypto/blob/eccd6366d1be82f8df741718dcdd586eea618221/ssh/client.go#L244-L246). Using it for production code is against security first principles  The concept of k3sup is to be able to use automation / quickly created VMs to perform a HA installation.  Are you suggesting that you are willing to log into each VM, and download its Host key footprint, and to manually insert it into your trust store, before running k3sup?  How else do you envision this workflow?
  > I'll get this closed out as I haven't heard back from you. If anyone else has additional reasoning/justification please open a new issue with it.

- **Issue #450** (2025-02-19): **How to configure traefik?**
  *Symptoms*: When deploying the k3s node with traefik, is there a way to change:  1. the default TLS options  2. disable port 80 on the loadbalancer 3. change the websecure port to something other than 443?
  **Post-Mortem & Fix Analysis**:
  > Hi @mattfysh if this is the route you'd like go down, then the pre-installed Traefik is probably not the best option for you.  Instead, install with `--no-traefik` and then use `arkade install traefik` and pass in the various `--set` arguments you wish to use, or simply install Traefik in a completely customised fashion using its values.yaml file.  We cannot support you with Traefik directly, but I'm sure you can find what you need in their docs.  Alex
  > this seems to work, given that k3s allows you to customize bundled components. the only thing I couldn't use was `asDefault` which appears to be a traefik v3 feature, whereas k3s has bundled v2  **traefik-config.yaml** ```yaml apiVersion: helm.cattle.io/v1 kind: HelmChartConfig metadata:   name: traefik   namespace: kube-system spec:   valuesContent: |-     ports:       web:         expose:           default: false       websecure:         # asDefault: true         exposedPort: 31111     tlsOptions:       default:         labels: {}         sniStrict: true         alpnProtocols: ['http/1.1']  ```  ```shell scp traefik-config.yaml $SERVER:/home/debian/traefik-config.yaml  ssh $SERVER sudo \   mv traefik-config.yaml /var/lib/rancher/k3s/server/manifests/traefik-config.yaml ```  it seems to survive `k3sup install` upgrades too 🎉

- **Issue #448** (2025-01-28): **`k3sup plan` seems to ignore `--ssh-key /path/to/ssh-key`**
  *Symptoms*: I ran `k3sup plan devices.json --user niels --ssh-key ~/.ssh/niels ... > bootstrap.sh` but the resulting `bootstrap.sh` did not include the same `-ssh-key` flag in any of the commands generated.  Executing the `bootstrap.sh` thus resulted in error `unable to load the ssh key with path ...`  <!--- Provide a general summary of the issue in the Title above -->  ## Why do you need this?  <!--- How has this issue affected you? What are you trying to accomplish? --> <!--- Providing context helps us come up with a solution that is most useful in the real world --> <!--- Is this request for work, a client, your employer or for fun? -->  `k3sup plan` is a really helpfull feature that prepares a `bootstrap.sh` file to provision the k3s cluster. It is strictly a convenience to be able to just edit the `devices.json` and use `k3sup plan` to quickly setup a new cluster. The `--ssh-key` flag allows an easy method to swap production and test keys for different clusters.  ## Expected Behaviour <!--- If you're describing a bug, tell us what should happen --> <!--- If you're suggesting a change/improvement, tell us how it should work -->  Providing the `--ssh-key` flag in `k3sup plan` should also include the same flag in the created `bootstrap.sh` script.  ## Current Behaviour <!--- If describing a bug, tell us what happens instead of the expected behavior --> <!--- If suggesting a change/improvement, explain the difference from current behavior -->  Providing the `--ssh-key` flag in `k3sup pl
  **Post-Mortem & Fix Analysis**:
  > Looks a bit like #436, except that was fixed in https://github.com/alexellis/k3sup/commit/b7bb7cb246eb639629f204c2aca2b446bfb4b244  An unknown here is what version is being used - previously there was an issue template to help capture this but it looks like GH changes have caused that to go away.  0.13.7 included the change, but 0.13.7 only made it to pre-release.  0.13.8 was released last week.  
  > @rgee0 you're right, I wonder if they completely turned off "legacy" markdown-based issue templates in favour of their [new YAML flavoured ones](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)? I don't remember seeing an announcement or warning about this.  I've edited @niro1987's issue so he can provide full context, version numbers and such, including of course the full exact command for a repro.
  > It seems this is fixed in [0.13.8](https://github.com/alexellis/k3sup/releases/tag/0.13.8)?

- **Issue #446** (2025-01-03): **Disable sha256 check for k3s about sha256sum-amd64.txt**
  *Symptoms*: <!--- Provide a general summary of the issue in the Title above -->  ## Why do you need this? EDU <!--- How has this issue affected you? What are you trying to accomplish? --> i don't need check the sha256 <!--- Providing context helps us come up with a solution that is most useful in the real world --> y <!--- Is this request for work, a client, your employer or for fun? --> for fun ## Expected Behaviour <!--- If you're describing a bug, tell us what should happen --> [INFO]  Using v1.27.3+k3s1 as release No need this logical: **[INFO]  Downloading hash https://github.com/k3s-io/k3s/releases/download/v1.27.3+k3s1/sha256sum-amd64.txt** [INFO]  Skipping binary downloaded, installed k3s matches hash [INFO]  Finding available k3s-selinux versions <!--- If you're suggesting a change/improvement, tell us how it should work -->  ## Current Behaviour <!--- If describing a bug, tell us what happens instead of the expected behavior --> Check the sha256 <!--- If suggesting a change/improvement, explain the difference from current behavior --> unstable network will cause the sha256sum-amd64.txt file download faild. ## Possible Solution <!--- Not obligatory, but suggest a fix/reason for the bug, --> <!--- or ideas how to implement the addition or change -->   ## Steps to Reproduce <!--- Provide a link to a live example, or an unambiguous set of steps to --> <!--- reproduce this bug. Include code to reproduce, if relevant --> 1. 2. 3. 4.  ## Your Envir

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

### Incident Patch 1: `18852ec8` (2025-06-26)
**Commit Message**: Fixes in README

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +10/-8)
```diff
@@ -17,8 +17,8 @@ How do you say it? Ketchup, as in tomato.
 - [k3sup 🚀 (said 'ketchup')](#k3sup--said-ketchup)
   - [Contents:](#contents)
   - [What's this for? 💻](#whats-this-for-)
-  - [Do you love `k3sup`?](#do-you-love-k3sup)
-    - [Uses](#uses)
+  - [Are you a `k3sup` user?](#are-you-a-k3sup-user)
+    - [Use-cases](#use-cases)
     - [Bootstrapping Kubernetes](#bootstrapping-kubernetes)
   - [Download `k3sup` (tl;dr)](#download-k3sup-tldr)
     - [A note for Windows users](#a-note-for-windows-users)
@@ -45,7 +45,6 @@ How do you say it? Ketchup, as in tomato.
   - [Troubleshooting and support](#troubleshooting-and-support)
     - [Maybe the problem is with K3s?](#maybe-the-problem-is-with-k3s)
     - [Common issues](#common-issues)
-    - [Support and k3sup for commercial use](#support-and-k3sup-for-commercial-use)
     - [Getting access to your KUBECONFIG](#getting-access-to-your-kubeconfig)
     - [Smart cards and 2FA](#smart-cards-and-2fa)
     - [Misc note on `iptables`](#misc-note-on-iptables)
@@ -58,7 +57,7 @@ You may wonder why a tool like this needs to exist when you can do this sort of
 
 k3sup was developed to automate what can be a very manual and confusing process for many developers, who are already short on time. Once you've provisioned a VM with your favourite tooling, `k3sup` means you are only 60 seconds away from running `kubectl get pods` on your own computer. If you are a local computer, you can bypass SSH with `k3sup install --local`
 
-## Do you use `k3sup`?
+## Are you a `k3sup` user?
 
 `k3sup` was created by [Alex Ellis](https://github.com/users/alexellis/sponsorship) - the founder of [OpenFaaS &reg;](https://www.openfaas.com/) & [inlets](https://inlets.dev/). 
 
@@ -68,13 +67,16 @@ k3sup was developed to automate what can be a very manual and confusing process
 
 Want to see continued development? [Sponsor alexellis on GitHub](https://github.com/users/alexellis/sponsorship)
 
-### Uses
+### Use-cases
+
+K3sup runs from your local machine, without ever having to log into a remote server.
 
 * Bootstrap Kubernetes with k3s onto any VM with `k3sup install` - either manually, during CI or through `cloud-init`
-* Get from zero to `kubectl` with `k3s` on Raspberry Pi (RPi), VMs, AWS EC2, Packet bare-metal, DigitalOcean, Civo, Scaleway, and others
-* Build a HA, multi-master (server) cluster
-* Fetch the KUBECONFIG from an existing `k3s` cluster
+* Get from zero to `kubectl` with `k3s` on bare-metal, Raspberry Pi (RPi), VMs, AWS EC2, Google Cloud, DigitalOcean, Civo, Linode, Scaleway, and others
+* Build a Highly-Available (HA), multi-master (server) cluster
+* Fetch the KUBECONFIG from an existing cluster with `k3sup get-config`
 * Join nodes into an existing `k3s` cluster with `k3sup join`
+* Build a massive cluster for automation and scale-out testing using `k3sup plan` and a JSON file with IP addresses
 
 ### Bootstrapping Kubernetes
 
```

---

### Incident Patch 2: `5d97659e` (2025-06-26)
**Commit Message**: Fix Makefile for Linux target when run on an Arm64 Mac

The k3sup binary is for Linux amd64, but was being created for
Linux arm64 and not Linux amd64.

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ gofmt:
 dist:
 	mkdir -p bin/
 	rm -rf bin/k3sup*
-	CGO_ENABLED=0 GOOS=linux go build -ldflags $(LDFLAGS) -o bin/k3sup
+	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags $(LDFLAGS) -o bin/k3sup
 	GOARM=7 GOARCH=arm CGO_ENABLED=0 GOOS=linux go build -ldflags $(LDFLAGS) -o bin/k3sup-armhf
 	GOARCH=arm64 CGO_ENABLED=0 GOOS=linux go build -ldflags $(LDFLAGS) -o bin/k3sup-arm64
 	CGO_ENABLED=0 GOOS=darwin go build -ldflags $(LDFLAGS) -o bin/k3sup-darwin
```

---

### Incident Patch 3: `9f541fed` (2025-02-01)
**Commit Message**: Cancel concurrent builds

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `.github/workflows/build.yaml` (modified, +4/-0)
```diff
@@ -10,6 +10,10 @@ on:
 
 jobs:
   build:
+    concurrency: 
+      group: ${{ github.ref }}
+      cancel-in-progress: true
+
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@master
```

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -13,6 +13,6 @@ require (
 
 require (
 	github.com/inconshreveable/mousetrap v1.1.0 // indirect
-	github.com/spf13/pflag v1.0.5 // indirect
+	github.com/spf13/pflag v1.0.6 // indirect
 	golang.org/x/sys v0.29.0 // indirect
 )
```

**File**: `go.sum` (modified, +2/-15)
```diff
@@ -1,9 +1,5 @@
-github.com/alexellis/go-execute/v2 v2.0.0 h1:e2fB9kZcPG0yg65XHL1/t6efcCUdt32AMbr/mv7A2tc=
-github.com/alexellis/go-execute/v2 v2.0.0/go.mod h1:FMdRnUTiFAmYXcv23txrp3VYZfLo24nMpiIneWgKHTQ=
 github.com/alexellis/go-execute/v2 v2.2.1 h1:4Ye3jiCKQarstODOEmqDSRCqxMHLkC92Bhse743RdOI=
 github.com/alexellis/go-execute/v2 v2.2.1/go.mod h1:FMdRnUTiFAmYXcv23txrp3VYZfLo24nMpiIneWgKHTQ=
-github.com/cpuguy83/go-md2man/v2 v2.0.2/go.mod h1:tgQtvFlXSQOSOSIRvRPT7W67SCa46tRHOmNcaadrF8o=
-github.com/cpuguy83/go-md2man/v2 v2.0.3/go.mod h1:tgQtvFlXSQOSOSIRvRPT7W67SCa46tRHOmNcaadrF8o=
 github.com/cpuguy83/go-md2man/v2 v2.0.4/go.mod h1:tgQtvFlXSQOSOSIRvRPT7W67SCa46tRHOmNcaadrF8o=
 github.com/inconshreveable/mousetrap v1.1.0 h1:wN+x4NVGpMsO7ErUn/mUI3vEoE6Jt13X2s0bqwp9tc8=
 github.com/inconshreveable/mousetrap v1.1.0/go.mod h1:vpF70FUmC8bwa3OWnCshd2FqLfsEA9PFc4w1p2J65bw=
@@ -12,24 +8,15 @@ github.com/mitchellh/go-homedir v1.1.0/go.mod h1:SfyaCUpYCn1Vlf4IUYiD9fPX4A5wJrk
 github.com/morikuni/aec v1.0.0 h1:nP9CBfwrvYnBRgY6qfDQkygYDmYwOilePFkwzv4dU8A=
 github.com/morikuni/aec v1.0.0/go.mod h1:BbKIizmSmc5MMPqRYbxO4ZU0S0+P200+tUnFx7PXmsc=
 github.com/russross/blackfriday/v2 v2.1.0/go.mod h1:+Rmxgy9KzJVeS9/2gXHxylqXiyQDYRxCVz55jmeOWTM=
-github.com/spf13/cobra v1.7.0 h1:hyqWnYt1ZQShIddO5kBpj3vu05/++x6tJ6dg8EC572I=
-github.com/spf13/cobra v1.7.0/go.mod h1:uLxZILRyS/50WlhOIKD7W6V5bgeIt+4sICxh6uRMrb0=
-github.com/spf13/cobra v1.8.0 h1:7aJaZx1B85qltLMc546zn58BxxfZdR/W22ej9CFoEf0=
-github.com/spf13/cobra v1.8.0/go.mod h1:WXLWApfZ71AjXPya3WOlMsY9yMs7YeiHhFVlvLyhcho=
 github.com/spf13/cobra v1.8.1 h1:e5/vxKd/rZsfSJMUX1agtjeTDf+qv1/JdBF8gg5k9ZM=
 github.com/spf13/cobra v1.8.1/go.mod h1:wHxEcudfqmLYa8iTfL+OuZPbBZkmvliBWKIezN3kD9Y=
-github.com/spf13/pflag v1.0.5 h1:iy+VFUOCP1a+8yFto/drg2CJ5u0yRoB7fZw3DKv/JXA=
 github.com/spf13/pflag v1.0.5/go.mod h1:McXfInJRrz4CZXVZOBLb0bTZqETkiAhM9Iw0y3An2Bg=
-golang.org/x/crypto v0.17.0 h1:r8bRNjWL3GshPW3gkd+RpvzWrZAwPS49OmTGZ/uhM4k=
-golang.org/x/crypto v0.17.0/go.mod h1:gCAAfMLgwOJRpTjQ2zCCt2OcSfYMTeZVSRtQlPC7Nq4=
+github.com/spf13/pflag v1.0.6 h1:jFzHGLGAlb3ruxLB8MhbI6A8+AQX/2eW4qeyNZXNp2o=
+github.com/spf13/pflag v1.0.6/go.mod h1:McXfInJRrz4CZXVZOBLb0bTZqETkiAhM9Iw0y3An2Bg=
 golang.org/x/crypto v0.32.0 h1:euUpcYgM8WcP71gNpTqQCn6rC2t6ULUPiOzfWaXVVfc=
 golang.org/x/crypto v0.32.0/go.mod h1:ZnnJkOaASj8g0AjIduWNlq2NRxL0PlBrbKVyZ6V/Ugc=
-golang.org/x/sys v0.15.0 h1:h48lPFYpsTvQJZF4EKyI4aLHaev3CxivZmv7yZig9pc=
-golang.org/x/sys v0.15.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
 golang.org/x/sys v0.29.0 h1:TPYlXGxvx1MGTn2GiZDhnjPA9wZzZeGKHHmKhHYvgaU=
 golang.org/x/sys v0.29.0/go.mod h1:/VUhepiaJMQUp4+oa/7Zr1D23ma6VTLIYjOOTFZPUcA=
-golang.org/x/term v0.15.0 h1:y/Oo/a/q3IXu26lQgl04j/gjuBDOBlx7X6Om1j2CPW4=
-golang.org/x/term v0.15.0/go.mod h1:BDl952bC7+uMoWR75FIrCDx79TPU9oHkTZ9yRbYOrX0=
 golang.org/x/term v0.28.0 h1:/Ts8HFuMR2E6IP/jlo7QVLZHggjKQbhu/7H0LJFr3Gg=
 golang.org/x/term v0.28.0/go.mod h1:Sw/lC2IAUZ92udQNf3WodGtn4k/XoLyZoh8v/8uiwek=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `vendor/github.com/spf13/pflag/.editorconfig` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+root = true
+
+[*]
+charset = utf-8
+end_of_line = lf
+indent_size = 4
+indent_style = space
+insert_final_newline = true
+trim_trailing_whitespace = true
+
+[*.go]
+indent_style = tab
```

**File**: `vendor/github.com/spf13/pflag/.golangci.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+linters:
+    disable-all: true
+    enable:
+        - nolintlint
```

**File**: `vendor/github.com/spf13/pflag/flag.go` (modified, +18/-11)
```diff
@@ -160,7 +160,7 @@ type FlagSet struct {
 	args              []string // arguments after flags
 	argsLenAtDash     int      // len(args) when a '--' was located when parsing, or -1 if no --
 	errorHandling     ErrorHandling
-	output            io.Writer // nil means stderr; use out() accessor
+	output            io.Writer // nil means stderr; use Output() accessor
 	interspersed      bool      // allow interspersed option/non-option args
 	normalizeNameFunc func(f *FlagSet, name string) NormalizedName
 
@@ -255,13 +255,20 @@ func (f *FlagSet) normalizeFlagName(name string) NormalizedName {
 	return n(f, name)
 }
 
-func (f *FlagSet) out() io.Writer {
+// Output returns the destination for usage and error messages. os.Stderr is returned if
+// output was not set or was set to nil.
+func (f *FlagSet) Output() io.Writer {
 	if f.output == nil {
 		return os.Stderr
 	}
 	return f.output
 }
 
+// Name returns the name of the flag set.
+func (f *FlagSet) Name() string {
+	return f.name
+}
+
 // SetOutput sets the destination for usage and error messages.
 // If output is nil, os.Stderr is used.
 func (f *FlagSet) SetOutput(output io.Writer) {
@@ -358,7 +365,7 @@ func (f *FlagSet) ShorthandLookup(name string) *Flag {
 	}
 	if len(name) > 1 {
 		msg := fmt.Sprintf("can not look up shorthand which is more than one ASCII character: %q", name)
-		fmt.Fprintf(f.out(), msg)
+		fmt.Fprintf(f.Output(), msg)
 		panic(msg)
 	}
 	c := name[0]
@@ -482,7 +489,7 @@ func (f *FlagSet) Set(name, value string) error {
 	}
 
 	if flag.Deprecated != "" {
-		fmt.Fprintf(f.out(), "Flag --%s has been deprecated, %s\n", flag.Name, flag.Deprecated)
+		fmt.Fprintf(f.Output(), "Flag --%s has been deprecated, %s\n", flag.Name, flag.Deprecated)
 	}
 	return nil
 }
@@ -523,7 +530,7 @@ func Set(name, value string) error {
 // otherwise, the default values of all defined flags in the set.
 func (f *FlagSet) PrintDefaults() {
 	usages := f.FlagUsages()
-	fmt.Fprint(f.out(), usages)
+	fmt.Fprint(f.Output(), usages)
 }
 
 // defaultIsZeroValue returns true if the default value for this flag represents
@@ -758,7 +765,7 @@ func PrintDefaults() {
 
 // defaultUsage is the default function to print a usage message.
 func defaultUsage(f *FlagSet) {
-	fmt.Fprintf(f.out(), "Usage of %s:\n", f.name)
+	fmt.Fprintf(f.Output(), "Usage of %s:\n", f.name)
 	f.PrintDefaults()
 }
 
@@ -844,7 +851,7 @@ func (f *FlagSet) AddFlag(flag *Flag) {
 	_, alreadyThere := f.formal[normalizedFlagName]
 	if alreadyThere {
 		msg := fmt.Sprintf("%s flag redefined: %s", f.name, flag.Name)
-		fmt.Fprintln(f.out(), msg)
+		fmt.Fprintln(f.Output(), msg)
 		panic(msg) // Happens only if flags are declared with identical names
 	}
 	if f.formal == nil {
@@ -860,7 +867,7 @@ func (f *FlagSet) AddFlag(flag *Flag) {
 	}
 	if len(flag.Shorthand) > 1 {
 		msg := fmt.Sprintf("%q shorthand is more than one ASCII character", flag.Shorthand)
-		fmt.Fprintf(f.out(), msg)
+		fmt.Fprintf(f.Output(), msg)
 		panic(msg)
 	}
 	if f.shorthands == nil {
@@ -870,7 +877,7 @@ func (f *FlagSet) AddFlag(flag *Flag) {
 	used, alreadyThere := f.shorthands[c]
 	if alreadyThere {
 		msg := fmt.Sprintf("unable to redefine %q shorthand in %q flagset: it's already used for %q flag", c, f.name, used.Name)
-		fmt.Fprintf(f.out(), msg)
+		fmt.Fprintf(f.Output(), msg)
 		panic(msg)
 	}
 	f.shorthands[c] = flag
@@ -909,7 +916,7 @@ func VarP(value Value, name, shorthand, usage string) {
 func (f *FlagSet) failf(format string, a ...interface{}) error {
 	err := fmt.Errorf(format, a...)
 	if f.errorHandling != ContinueOnError {
-		fmt.Fprintln(f.out(), err)
+		fmt.Fprintln(f.Output(), err)
 		f.usage()
 	}
 	return err
@@ -1060,7 +1067,7 @@ func (f *FlagSet) parseSingleShortArg(shorthands string, args []string, fn parse
 	}
 
 	if flag.ShorthandDeprecated != "" {
-		fmt.Fprintf(f.out(), "Flag shorthand -%s has been deprecated, %s\n", flag.Shorthand, flag.ShorthandDeprecated)
+		fmt.Fprintf(f.Output(), "Flag shorthand -%s has been deprecated, %s\n", flag.Shorthand, flag.ShorthandDeprecated)
 	}
 
 	err = fn(flag, value)
```

**File**: `vendor/github.com/spf13/pflag/ip.go` (modified, +3/-0)
```diff
@@ -16,6 +16,9 @@ func newIPValue(val net.IP, p *net.IP) *ipValue {
 
 func (i *ipValue) String() string { return net.IP(*i).String() }
 func (i *ipValue) Set(s string) error {
+	if s == "" {
+		return nil
+	}
 	ip := net.ParseIP(strings.TrimSpace(s))
 	if ip == nil {
 		return fmt.Errorf("failed to parse IP: %q", s)
```

**File**: `vendor/github.com/spf13/pflag/ipnet_slice.go` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+package pflag
+
+import (
+	"fmt"
+	"io"
+	"net"
+	"strings"
+)
+
+// -- ipNetSlice Value
+type ipNetSliceValue struct {
+	value   *[]net.IPNet
+	changed bool
+}
+
+func newIPNetSliceValue(val []net.IPNet, p *[]net.IPNet) *ipNetSliceValue {
+	ipnsv := new(ipNetSliceValue)
+	ipnsv.value = p
+	*ipnsv.value = val
+	return ipnsv
+}
+
+// Set converts, and assigns, the comma-separated IPNet argument string representation as the []net.IPNet value of this flag.
+// If Set is called on a flag that already has a []net.IPNet assigned, the newly converted values will be appended.
+func (s *ipNetSliceValue) Set(val string) error {
+
+	// remove all quote characters
+	rmQuote := strings.NewReplacer(`"`, "", `'`, "", "`", "")
+
+	// read flag arguments with CSV parser
+	ipNetStrSlice, err := readAsCSV(rmQuote.Replace(val))
+	if err != nil && err != io.EOF {
+		return err
+	}
+
+	// parse ip values into slice
+	out := make([]net.IPNet, 0, len(ipNetStrSlice))
+	for _, ipNetStr := range ipNetStrSlice {
+		_, n, err := net.ParseCIDR(strings.TrimSpace(ipNetStr))
+		if err != nil {
+			return fmt.Errorf("invalid string being converted to CIDR: %s", ipNetStr)
+		}
+		out = append(out, *n)
+	}
+
+	if !s.changed {
+		*s.value = out
+	} else {
+		*s.value = append(*s.value, out...)
+	}
+
+	s.changed = true
+
+	return nil
+}
+
+// Type returns a string that uniquely represents this flag's type.
+func (s *ipNetSliceValue) Type() string {
+	return "ipNetSlice"
+}
+
+// String defines a "native" format for this net.IPNet slice flag value.
+func (s *ipNetSliceValue) String() string {
+
+	ipNetStrSlice := make([]string, len(*s.value))
+	for i, n := range *s.value {
+		ipNetStrSlice[i] = n.String()
+	}
+
+	out, _ := writeAsCSV(ipNetStrSlice)
+	return "[" + out + "]"
+}
+
+func ipNetSliceConv(val string) (interface{}, error) {
+	val = strings.Trim(val, "[]")
+	// Emtpy string would cause a slice with one (empty) entry
+	if len(val) == 0 {
+		return []net.IPNet{}, nil
+	}
+	ss := strings.Split(val, ",")
+	out := make([]net.IPNet, len(ss))
+	for i, sval := range ss {
+		_, n, err := net.ParseCIDR(strings.TrimSpace(sval))
+		if err != nil {
+			return nil, fmt.Errorf("invalid string being converted to CIDR: %s", sval)
+		}
+		out[i] = *n
+	}
+	return out, nil
+}
+
+// GetIPNetSlice returns the []net.IPNet value of a flag with the given name
+func (f *FlagSet) GetIPNetSlice(name string) ([]net.IPNet, error) {
+	val, err := f.getFlagType(name, "ipNetSlice", ipNetSliceConv)
+	if err != nil {
+		return []net.IPNet{}, err
+	}
+	return val.([]net.IPNet), nil
+}
+
+// IPNetSliceVar defines a ipNetSlice flag with specified name, default value, and usage string.
+// The argument p points to a []net.IPNet variable in which to store the value of the flag.
+func (f *FlagSet) IPNetSliceVar(p *[]net.IPNet, name string, value []net.IPNet, usage string) {
+	f.VarP(newIPNetSliceValue(value, p), name, "", usage)
+}
+
+// IPNetSliceVarP is like IPNetSliceVar, but accepts a shorthand letter that can be used after a single dash.
+func (f *FlagSet) IPNetSliceVarP(p *[]net.IPNet, name, shorthand string, value []net.IPNet, usage string) {
+	f.VarP(newIPNetSliceValue(value, p), name, shorthand, usage)
+}
+
+// IPNetSliceVar defines a []net.IPNet flag with specified name, default value, and usage string.
+// The argument p points to a []net.IPNet variable in which to store the value of the flag.
+func IPNetSliceVar(p *[]net.IPNet, name string, value []net.IPNet, usage string) {
+	CommandLine.VarP(newIPNetSliceValue(value, p), name, "", usage)
+}
+
+// IPNetSliceVarP is like IPNetSliceVar, but accepts a shorthand letter that can be used after a single dash.
+func IPNetSliceVarP(p *[]net.IPNet, name, shorthand string, value []net.IPNet, usage string) {
+	CommandLine.VarP(newIPNetSliceValue(value, p), name, shorthand, usage)
+}
+
+// IPNetSlice defines a []net.IPNet flag with specified name, default value, and usage string.
+// The return value is the address of a []net.IPNet variable that stores the value of that flag.
+func (f *FlagSet) IPNetSlice(name string, value []net.IPNet, usage string) *[]net.IPNet {
+	p := []net.IPNet{}
+	f.IPNetSliceVarP(&p, name, "", value, usage)
+	return &p
+}
+
+// IPNetSliceP is like IPNetSlice, but accepts a shorthand letter that can be used after a single dash.
+func (f *FlagSet) IPNetSliceP(name, shorthand string, value []net.IPNet, usage string) *[]net.IPNet {
+	p := []net.IPNet{}
+	f.IPNetSliceVarP(&p, name, shorthand, value, usage)
+	return &p
+}
+
+// IPNetSlice defines a []net.IPNet flag with specified name, default value, and usage string.
+// The return value is the address of a []net.IP variable that stores the value of the flag.
+func IPNetSlice(name string, value []net.IPNet, usage string) *[]net.IPNet {
+	return CommandLine.IPNetSliceP(name, "", value, usage)
+}
+
+// IPNetSliceP is like IPNetSlice, but accepts a shorthand letter that can be used after a single dash.
+func IPNetSliceP(name, shorthand stri
```

---

### Incident Patch 4: `69f4cef6` (2024-04-14)
**Commit Message**: fix example and make it valid JSON

Fix the given JSON in the long command help text and show a valid
JSON document.

resolves #432

Signed-off-by: Marcus Franke <[REDACTED_EMAIL]>

**File**: `cmd/plan.go` (modified, +4/-2)
```diff
@@ -20,9 +20,11 @@ Input file format, in JSON:
 
 [{
 	"hostname": "node-1",
-	"ip": "192.168.128.100",
+	"ip": "192.168.128.100"
+},
+{
 	"hostname": "node-2",
-	"ip": "192.168.128.101",
+	"ip": "192.168.128.101"
 }]
 
 ` + pkg.SupportMessageShort + `
```

---

### Incident Patch 5: `3a028671` (2023-10-09)
**Commit Message**: Fix typo

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ The `k3sup` tool is a client application which you can run on your own computer.
 
 ## Pre-requisites for k3sup servers and agents
 
-Some Linux hosts are configured to allow `sudo` to run without having to repeat your password. For those which are not already configured that way, you'll nee to make the following changes if you wish to use `k3sup`:
+Some Linux hosts are configured to allow `sudo` to run without having to repeat your password. For those which are not already configured that way, you'll need to make the following changes if you wish to use `k3sup`:
 
 ```bash
 # sudo visudo
```

---

### Incident Patch 6: `35232db2` (2023-08-29)
**Commit Message**: Remove rebuild and cgo

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +6/-6)
```diff
@@ -20,12 +20,12 @@ gofmt:
 dist:
 	mkdir -p bin/
 	rm -rf bin/k3sup*
-	CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup
-	GOARM=7 GOARCH=arm CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-armhf
-	GOARCH=arm64 CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-arm64
-	CGO_ENABLED=0 GOOS=darwin go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-darwin
-	GOARCH=arm64 CGO_ENABLED=0 GOOS=darwin go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-darwin-arm64
-	GOOS=windows CGO_ENABLED=0 go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup.exe
+	CGO_ENABLED=0 GOOS=linux go build  -ldflags $(LDFLAGS) -o bin/k3sup
+	GOARM=7 GOARCH=arm CGO_ENABLED=0 GOOS=linux go build  -ldflags $(LDFLAGS) -o bin/k3sup-armhf
+	GOARCH=arm64 CGO_ENABLED=0 GOOS=linux go build  -ldflags $(LDFLAGS) -o bin/k3sup-arm64
+	CGO_ENABLED=0 GOOS=darwin go build  -ldflags $(LDFLAGS) -o bin/k3sup-darwin
+	GOARCH=arm64 CGO_ENABLED=0 GOOS=darwin go build  -ldflags $(LDFLAGS) -o bin/k3sup-darwin-arm64
+	GOOS=windows CGO_ENABLED=0 go build  -ldflags $(LDFLAGS) -o bin/k3sup.exe
 
 .PHONY: hash
 hash:
```

---

### Incident Patch 7: `f6129ae5` (2022-12-20)
**Commit Message**: Revert sponsorship policy

Personal users were ignoring the policy, along with commercial
ones, even deleting it from the issue template.

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `.github/ISSUE_TEMPLATE.md` (modified, +2/-8)
```diff
@@ -1,9 +1,3 @@
-## Are you a GitHub Sponsor?
-
-Only sponsors may open issues, all other issues (unless previously discussed agreed upon with a maintainer) will be closed without comment.
-
-Check at [https://github.com/sponsors/alexellis](https://github.com/sponsors/alexellis)
-
 <!--- Provide a general summary of the issue in the Title above -->
 
 ## Why do you need this?
@@ -57,9 +51,9 @@ uname -a
 cat /etc/os-release
 ```
 
-## "Be part of the solution"
+## Do you want to work on this?
 
-Subject to approval, are you willing to work on a Pull Request for this issue or feature request?
+Subject to design approval, are you willing to work on a Pull Request for this issue or feature request?
 
 - [ ] Yes
 - [ ] No
```

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +0/-7)
```diff
@@ -1,9 +1,3 @@
-## Are you a GitHub Sponsor?
-
-Only sponsors may Pull Requests (PRs), all other PRs (unless previously discussed agreed upon with a maintainer) will be closed without comment.
-
-Check at [https://github.com/sponsors/alexellis](https://github.com/sponsors/alexellis)
-
 <!--- Provide a general summary of the issue in the Title above -->
 
 ## Why do you need this?
@@ -16,7 +10,6 @@ If you have no approval from a maintainer, close this PR and raise an issue.
 ## Description
 <!--- Describe your changes in detail -->
 
-
 ## How Has This Been Tested?
 <!--- Please describe in detail how you tested your changes. -->
 <!--- Include details of your testing environment, and the tests you ran to -->
```

**File**: `README.md` (modified, +3/-13)
```diff
@@ -56,17 +56,15 @@ You may wonder why a tool like this needs to exist when you can do this sort of
 
 k3sup was developed to automate what can be a very manual and confusing process for many developers, who are already short on time. Once you've provisioned a VM with your favourite tooling, `k3sup` means you are only 60 seconds away from running `kubectl get pods` on your own computer. If you are a local computer, you can bypass SSH with `k3sup install --local`
 
-## Do you love `k3sup`?
+## Do you use `k3sup`?
 
 <a href="https://github.com/sponsors/alexellis/">
 <img alt="Sponsor this project" src="https://github.com/alexellis/alexellis/blob/master/sponsor-today.png" width="90%">
 </a>
 
-`k3sup` was created by [Alex Ellis](https://github.com/users/alexellis/sponsorship) - the founder of [OpenFaaS &reg;](https://www.openfaas.com/) & [inlets](https://inlets.dev/).
+`k3sup` was created by [Alex Ellis](https://github.com/users/alexellis/sponsorship) - the founder of [OpenFaaS &reg;](https://www.openfaas.com/) & [inlets](https://inlets.dev/). 
 
-If you've benefitted from his open source projects or blog posts in some way, then and join dozens of other developers sponsoring him today.
-
-You can use K3sup for free under the terms of the license, however a monthly GitHub sponsorship is required to receive any form of support such as Issues or Pull Requests.
+If you use k3sup for personal or commercial use, sponsor Alex for continued maintenance and development of the project.
 
 [Sponsor alexellis on GitHub](https://github.com/users/alexellis/sponsorship)
 
@@ -704,14 +702,6 @@ The most common problem is that you missed a step, fortunately it's relatively e
 
 > Note: Passing `--no-deploy` to `--k3s-extra-args` was deprecated by the K3s installer in K3s 1.17. Use `--disable` instead or `--no-extras`.
 
-### Support and k3sup for commercial use
-
-* K3sup doesn't use a declarative YAML file to setup all my hosts. This is by design, feel free to write a very short bash script instead, it will be equivalent, since `k3sup install/join` can be run multiple times without side-effects. 
-* You want to setup a cluster using an SSH bastion host. This is a premium feature and requires a license.
-* You want to install K3s into an airgapped environment. This is a premium feature and requires a license.
-
-Finally, if you need any form of technical support, you must [first become a GitHub Sponsor](https://github.com/sponsors/alexellis) before raising an issue. All changes to K3sup must be proposed in an issue before a PR is sent, PRs without approved issues will be closed without comment.
-
 ### Getting access to your KUBECONFIG
 
 You may have run into an issue where `sudo` access is required for `kubectl` access.
```

---

### Incident Patch 8: `769a8e8a` (2022-10-21)
**Commit Message**: Fix tests with extra parameter

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `cmd/join_test.go` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ func Test_makeJoinServerExec(t *testing.T) {
 	}
 	for _, tc := range tests {
 		t.Run(tc.title, func(t *testing.T) {
-			got := makeJoinExec(tc.serverIP, tc.joinToken, tc.installStr, tc.k3sExtraArgs, tc.serverAgent)
+			got := makeJoinExec(tc.serverIP, tc.joinToken, tc.installStr, tc.k3sExtraArgs, tc.serverAgent, "")
 
 			if got != tc.installk3sExec {
 				t.Errorf("want: %s, got: %s", tc.installk3sExec, got)
@@ -72,7 +72,7 @@ func Test_makeJoinAgentExec(t *testing.T) {
 
 	for _, tc := range tests {
 		t.Run(tc.title, func(t *testing.T) {
-			got := makeJoinExec(tc.serverIP, tc.joinToken, tc.installStr, tc.k3sExtraArgs, tc.serverAgent)
+			got := makeJoinExec(tc.serverIP, tc.joinToken, tc.installStr, tc.k3sExtraArgs, tc.serverAgent, "")
 
 			if got != tc.installk3sExec {
 				t.Errorf("want: %s, got: %s", tc.installk3sExec, got)
```

---

### Incident Patch 9: `e3ff08cf` (2022-10-03)
**Commit Message**: Fix issue with string being quoted in ready command

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `cmd/ready.go` (modified, +15/-5)
```diff
@@ -36,13 +36,15 @@ func MakeReady() *cobra.Command {
 	command.Flags().Duration("pause", time.Second*2, "Pause between checking cluster for readiness")
 	command.Flags().String("kubeconfig", "$HOME/.kube/config", "Path to the kubeconfig file")
 	command.Flags().String("context", "default", "Name of the kubeconfig context to use")
+	command.Flags().Bool("quiet", false, "Suppress output from each attempt")
 
 	command.RunE = func(cmd *cobra.Command, args []string) error {
 
 		attempts, _ := cmd.Flags().GetInt("attempts")
 		pause, _ := cmd.Flags().GetDuration("pause")
 		kubeconfig, _ := cmd.Flags().GetString("kubeconfig")
 		contextName, _ := cmd.Flags().GetString("context")
+		quiet, _ := cmd.Flags().GetBool("quiet")
 
 		if len(kubeconfig) == 0 {
 			return fmt.Errorf("kubeconfig cannot be empty")
@@ -56,7 +58,10 @@ func MakeReady() *cobra.Command {
 
 		// Inspired by Kind: https://github.com/kubernetes-sigs/kind/blob/master/pkg/cluster/internal/create/actions/waitforready/waitforready.go
 		for i := 0; i < attempts; i++ {
-			fmt.Printf("Checking cluster status: %d/%d \n", i+1, attempts)
+			if !quiet {
+				fmt.Printf("Checking cluster status: %d/%d \n", i+1, attempts)
+			}
+
 			task := execute.ExecTask{
 				Command: "kubectl",
 				Args: []string{
@@ -73,24 +78,29 @@ func MakeReady() *cobra.Command {
 			if err != nil {
 				return err
 			}
-			// fmt.Println(res.Stdout, res.Stderr, res.ExitCode)
 
 			if strings.Contains(res.Stderr, "context was not found") {
 				return fmt.Errorf("context %s not found in %s", contextName, kubeconfig)
 			}
 
 			if res.ExitCode == 0 {
-				parts := strings.Split(res.Stdout, " ")
+				parts := strings.Split(strings.TrimSpace(res.Stdout), " ")
+
 				ready := true
 				for _, part := range parts {
 					trimmed := strings.TrimSpace(part)
-					if len(trimmed) > 0 && trimmed != "True" {
+
+					// Note: The command is returning a single quoted string
+					if len(trimmed) > 0 && trimmed != "'True'" {
 						ready = false
+						break
 					}
 				}
 
 				if ready {
-					fmt.Printf("Cluster is ready\n")
+					if !quiet {
+						fmt.Printf("All node(s) are ready\n")
+					}
 					break
 				}
 			}
```

---

### Incident Patch 10: `3c61b1f2` (2022-10-03)
**Commit Message**: Fix ready command

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `cmd/ready.go` (modified, +13/-14)
```diff
@@ -68,32 +68,31 @@ func MakeReady() *cobra.Command {
 				},
 				StreamStdio: false,
 			}
+
 			res, err := task.Execute()
 			if err != nil {
 				return err
 			}
 			// fmt.Println(res.Stdout, res.Stderr, res.ExitCode)
 
-			if res.ExitCode == 0 {
-				fmt.Printf("Cluster is ready\n")
-				return nil
-			}
-
 			if strings.Contains(res.Stderr, "context was not found") {
 				return fmt.Errorf("context %s not found in %s", contextName, kubeconfig)
 			}
 
-			parts := strings.Split(res.Stdout, " ")
-			ready := true
-			for _, part := range parts {
-				trimmed := strings.TrimSpace(part)
-				if len(trimmed) > 0 && trimmed != "True" {
-					ready = false
+			if res.ExitCode == 0 {
+				parts := strings.Split(res.Stdout, " ")
+				ready := true
+				for _, part := range parts {
+					trimmed := strings.TrimSpace(part)
+					if len(trimmed) > 0 && trimmed != "True" {
+						ready = false
+					}
 				}
-			}
 
-			if ready {
-				break
+				if ready {
+					fmt.Printf("Cluster is ready\n")
+					break
+				}
 			}
 			time.Sleep(pause)
 		}
```

---

### Incident Patch 11: `ab5652e8` (2022-09-29)
**Commit Message**: Fix issue with join token for Windows users:

Ref: #392

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `cmd/join.go` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ package cmd
 import (
 	"fmt"
 	"net"
-	"path/filepath"
+	"path"
 	"runtime"
 	"strings"
 
@@ -218,7 +218,7 @@ func MakeJoin() *cobra.Command {
 
 		defer sshOperator.Close()
 
-		getTokenCommand := fmt.Sprintf("%scat %s\n", sudoPrefix, filepath.Join(dataDir, "/server/node-token"))
+		getTokenCommand := fmt.Sprintf("%scat %s\n", sudoPrefix, path.Join(dataDir, "/server/node-token"))
 		if printCommand {
 			fmt.Printf("ssh: %s\n", getTokenCommand)
 		}
```

---

### Incident Patch 12: `1b360850` (2022-08-29)
**Commit Message**: Fix #314

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ k3sup install \
   --context my-k3s
 ```
 
-Here we set a context of `my-k3s` and also merge into our main local `KUBECONFIG` file, so we could run `kubectl config set-context my-k3s` or `kubectx my-k3s`.
+Here we set a context of `my-k3s` and also merge into our main local `KUBECONFIG` file, so we could run `kubectl config use-context my-k3s` or `kubectx my-k3s`.
 
 ### 😸 Join some agents to your Kubernetes server
 
```

**File**: `cmd/install.go` (modified, +1/-1)
```diff
@@ -414,7 +414,7 @@ func writeConfig(path string, data []byte, context string, suppressMessage bool)
 
 # Test your cluster with:
 export KUBECONFIG=%s
-kubectl config set-context %s
+kubectl config use-context %s
 kubectl get node -o wide
 
 %s
```

---

### Incident Patch 13: `c0a48331` (2022-08-26)
**Commit Message**: Fix parsing of host field

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `cmd/install.go` (modified, +3/-7)
```diff
@@ -89,7 +89,6 @@ func MakeInstall() *cobra.Command {
 	command.Flags().String("user", "root", "Username for SSH login")
 
 	command.Flags().String("host", "", "Public hostname of node on which to install agent")
-	command.Flags().String("host-ip", "", "Public hostname of an existing k3s server")
 
 	command.Flags().String("ssh-key", "~/.ssh/id_rsa", "The ssh key to use for remote login")
 	command.Flags().Int("ssh-port", 22, "The port on which to connect for ssh")
@@ -124,12 +123,7 @@ Provide the --local-path flag with --merge if a kubeconfig already exists in som
 		}
 
 		if !local {
-			_, err := command.Flags().GetIP("ip")
-			if err != nil {
-				return err
-			}
-
-			_, err = command.Flags().GetIP("host")
+			_, err = command.Flags().GetString("host")
 			if err != nil {
 				return err
 			}
@@ -198,13 +192,15 @@ Provide the --local-path flag with --merge if a kubeconfig already exists in som
 		if err != nil {
 			return err
 		}
+
 		host, err := command.Flags().GetString("host")
 		if err != nil {
 			return err
 		}
 		if len(host) == 0 {
 			host = ip.String()
 		}
+
 		log.Println(host)
 
 		cluster, _ := command.Flags().GetBool("cluster")
```

---

### Incident Patch 14: `0c77d99a` (2022-06-29)
**Commit Message**: Add build for darwin arm64 and adjust get accordingly

Signed-off-by: Czékus Máté <[REDACTED_EMAIL]>
Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +2/-1)
```diff
@@ -21,9 +21,10 @@ dist:
 	mkdir -p bin/
 	rm -rf bin/k3sup*
 	CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup
-	CGO_ENABLED=0 GOOS=darwin go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-darwin
 	GOARM=7 GOARCH=arm CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-armhf
 	GOARCH=arm64 CGO_ENABLED=0 GOOS=linux go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-arm64
+	CGO_ENABLED=0 GOOS=darwin go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-darwin
+	GOARCH=arm64 CGO_ENABLED=0 GOOS=darwin go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup-darwin-arm64
 	GOOS=windows CGO_ENABLED=0 go build -a -ldflags $(LDFLAGS) -installsuffix cgo -o bin/k3sup.exe
 
 .PHONY: hash
```

**File**: `get.sh` (modified, +12/-1)
```diff
@@ -68,7 +68,18 @@ getPackage() {
     suffix=""
     case $uname in
     "Darwin")
-    suffix="-darwin"
+        arch=$(uname -m)
+        echo $arch
+        case $arch in
+        "x86_64")
+        suffix="-darwin"
+        ;;
+        esac
+        case $arch in
+        "arm64")
+        suffix="-darwin-arm64"
+        ;;
+        esac
     ;;
     "MINGW"*)
     suffix=".exe"
```

---

### Incident Patch 15: `89c545d7` (2022-05-04)
**Commit Message**: Fix 376

Provides alternatives to the token generation for MacOS

Fixes: 376

Signed-off-by: Alex Ellis (OpenFaaS Ltd) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +9/-1)
```diff
@@ -252,8 +252,16 @@ export DATASTORE="mysql://doadmin:80624d3936dfc8d2e80593@tcp(db-mysql-lon1-90578
 You can prefix this command with `  ` two spaces, to prevent it being cached in your bash history.
 
 Generate a token used to encrypt data (If you already have a running node this can be retrieved by logging into a running node and looking in `/var/lib/rancher/k3s/server/token`)
-```bash 
+
+```bash
+# Best option for a token:
+export TOKEN=$(openssl rand -base64 64)
+
+# Fallback for no openssl, on a Linux host:
 export TOKEN=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 64)
+
+# Failing that, then try:
+export TOKEN=$(head -c 64 /dev/urandom|shasum| cut -d - -f 1)
 ```
 
 
```

#### Recent Merged Pull Requests:
- **PR #462** (2026-07-09): Update upload-assets action to 0.5.0 (@welteki)
- **PR #457** (2025-08-20): Add K3sup Pro to readme and k3sup pro get command (@alexellis)
- **PR #440** (closed): Add `--merge` flag to `plan` command (@DaruZero)
- **PR #433** (2024-05-15): fix example and make it valid JSON (@Comradin)
- **PR #426** (closed): Edited build script (@captainlettuce)
- **PR #425** (2023-12-29): Add --no-extras flag to join command (@rgee0)
- **PR #423** (2023-12-19): Bump golang.org/x/crypto from 0.13.0 to 0.17.0 (@dependabot[bot])
- **PR #418** (closed): Add extra debug log for ssh-agent issues (@Nezteb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
