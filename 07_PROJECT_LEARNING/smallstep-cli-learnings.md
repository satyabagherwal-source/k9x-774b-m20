# Forensic Learning Record (Deep Inspection): smallstep/cli

> **Canonical Artifact**: `07_PROJECT_LEARNING/smallstep-cli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/smallstep/cli](https://github.com/smallstep/cli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:16:27.147Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `smallstep/cli`
- **Description**: 🧰  A zero trust swiss army knife for working with X509, OAuth, JWT, OATH OTP, etc.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4336 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `command/ca/provisioner/webhook/add.go`
```
package webhook

import (
	"fmt"

	"github.com/urfave/cli"

	"github.com/smallstep/cli-utils/errs"
	"github.com/smallstep/linkedca"

	"github.com/smallstep/cli/flags"
	"github.com/smallstep/cli/utils"
)

func addCommand() cli.Command {
	return cli.Command{
		Name:   "add",
		Action: cli.ActionFunc(addAction),
		Usage:  "add a webhook to a provisioner",
		UsageText: `**step ca provisioner webhook add** <provisioner_name> <webhook_name>
[**--url**=<url>] [**--kind**=<kind>] [**--bearer-token-file**=<filename>]
[**--basic-auth-username**=<username>] [**--basic-auth-password-file**=<filename>]
[**--disable-tls-client-auth**] [**--cert-type**=<cert-type>]
[**--admin-cert**=<file>] [**--admin-key**=<file>] [**--admin-subject**=<subject>]
[**--admin-provisioner**=<name>] [**--admin-password-file**=<file>]
[**--ca-url**=<uri>] [**--root**=<file>] [**--context**=<name>] [**--ca-config**=<file>]`,
		Flags: []cli.Flag{
			urlFlag,
			kindFlag,
			bearerTokenFileFlag,
			basicAuthUsernameFlag,
			basicAuthPasswordFileFlag,
			disableTLSClientAuthFlag,
			certTypeFlag,

			flags.AdminCert,
			flags.AdminKey,
			flags.AdminSubject,
			flags.AdminProvisioner,
			flags.AdminPasswordFile,
			flags.CaURL,
			flags.Root,
			flags.Context,
			flags.CaConfig,
		},
		Description: `**step ca provisioner webhook add** adds a webhook to a provisioner.

The command will print the webhook ID and secret that must be used to verify all requests from step CA.

## POSITIONAL ARGUMENTS

<provisioner_name>
: The name of the provisioner.

<webhook_name>
: The name of the webhook.

## EXAMPLES

Create a webhook without an Authorization header:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com
'''

Create a webhook with a bearer token:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com --bearer-token-file token.txt
'''

Create a webhook with basic authentication:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com --basic-auth-username user --basic-auth-password-file pass.txt
'''

Create a webhook that will never send a client certificate to the webhook server:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com --disable-tls-client-auth
'''

Create a webhook that will only be called when signing x509 certificates:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com --cert-type X509
'''`,
	}
}

func addAction(ctx *cli.Context) (err error) {
	if err := errs.NumberOfArguments(ctx, 2); err != nil {
		return err
	}

	args := ctx.Args()

	provisionerName := args.Get(0)

	kind := linkedca.Webhook_Kind(linkedca.Webhook_Kind_value[ctx.String("kind")])
	if kind == linkedca.Webhook_NO_KIND {
		kind = linkedca.Webhook_ENRICHING
	}

	wh := &linkedca.Webhook{
		Name: args.Get(1),
		Url:  ctx.String("url"),
		Kind: kind,
	}

	if ctx.IsSet("bearer-token-file") {
		bearerTkn, err := utils.ReadStringPasswordFromFile(ctx.String("bearer-token-file"))
		if err != nil {
			return err
		}
		wh.Auth = &linkedca.Webhook_BearerToken{
			BearerToken: &linkedca.BearerToken{
				BearerToken: bearerTkn,
			},
		}
	} else if ctx.IsSet("basic-auth-username") || ctx.IsSet("basic-auth-password-file") {
		var password string
		if ctx.IsSet("basic-auth-password-file") {
			password, err = utils.ReadStringPasswordFromFile(ctx.String("basic-auth-password-file"))
			if err != nil {
				return err
			}
		}
		wh.Auth = &linkedca.Webhook_BasicAuth{
			BasicAuth: &linkedca.BasicAuth{
				Username: ctx.String("basic-auth-username"),
				Password: password,
			},
		}
	}

	if ctx.IsSet("disable-tls-client-auth") {
		wh.DisableTlsClientAuth = ctx.Bool("disable-tls-client-auth")
	}

	if ctx.IsSet("cert-type") {
		certType, ok := linkedca.Webhook_CertType_value[ctx.String("cert-type")]
		if !ok {
			return errs.InvalidFlagValue(ctx, "cert-type", ctx.String("cert-type"), "ALL, X509, and SSH")
		}
		wh.CertType = linkedca.Webhook_CertType(certType)
	} else {
		wh.CertType = linkedca.Webhook_ALL
	}

	client, err := newCRUDClient(ctx, ctx.String("ca-config"))
	if err != nil {
		return err
	}

	if wh, err = client.CreateProvisionerWebhook(provisionerName, wh); err != nil {
		return err
	}

	fmt.Printf("Webhook ID: %s\nSecret: %s\n", wh.Id, wh.Secret)

	return nil
}

```

### Core Architecture Module: `command/ca/provisioner/webhook/remove.go`
```
package webhook

import (
	"github.com/urfave/cli"

	"github.com/smallstep/cli-utils/errs"

	"github.com/smallstep/cli/flags"
)

func removeCommand() cli.Command {
	return cli.Command{
		Name:   "remove",
		Action: cli.ActionFunc(removeAction),
		Usage:  "remove a webhook from a provisioner",
		UsageText: `**step ca provisioner webhook remove** <provisioner_name> <webhook_name>
[**--admin-cert**=<file>] [**--admin-key**=<file>] [**--admin-subject**=<subject>]
[**--admin-provisioner**=<name>] [**--admin-password-file**=<file>]
[**--ca-url**=<uri>] [**--root**=<file>] [**--context**=<name>] [**--ca-config**=<file>]`,
		Flags: []cli.Flag{
			flags.AdminCert,
			flags.AdminKey,
			flags.AdminSubject,
			flags.AdminProvisioner,
			flags.AdminPasswordFile,
			flags.CaURL,
			flags.Root,
			flags.Context,
			flags.CaConfig,
		},
		Description: `**step ca provisioner webhook remove** removes a webhook from a provisioner.

## POSITIONAL ARGUMENTS

<provisioner_name>
: The name of the provisioner.

<webhook_name>
: The name of the webhook.

## EXAMPLES

Remove a webhook:
'''
step ca provisioner webhook remove my_provisioner my_webhook
'''`,
	}
}

func removeAction(ctx *cli.Context) (err error) {
	if err := errs.NumberOfArguments(ctx, 2); err != nil {
		return err
	}

	args := ctx.Args()

	provisionerName := args.Get(0)

	client, err := newCRUDClient(ctx, ctx.String("ca-config"))
	if err != nil {
		return err
	}

	return client.DeleteProvisionerWebhook(provisionerName, args.Get(1))
}

```

### Core Architecture Module: `command/ca/provisioner/webhook/update.go`
```
package webhook

import (
	"errors"
	"fmt"

	"github.com/urfave/cli"

	"github.com/smallstep/certificates/ca"
	"github.com/smallstep/cli-utils/errs"
	"github.com/smallstep/linkedca"

	"github.com/smallstep/cli/flags"
	"github.com/smallstep/cli/utils"
)

func updateCommand() cli.Command {
	return cli.Command{
		Name:   "update",
		Action: cli.ActionFunc(updateAction),
		Usage:  "update a webhook attached to a provisioner",
		UsageText: `**step ca provisioner webhook update** <provisioner_name> <webhook_name>
[**--url**=<url>] [**--kind**=<kind>] [**--bearer-token-file**=<filename>]
[**--basic-auth-username**=<username>] [**--basic-auth-password-file**=<filename>]
[**--disable-tls-client-auth**] [**--cert-type**=<cert-type>]
[**--admin-cert**=<file>] [**--admin-key**=<file>] [**--admin-subject**=<subject>]
[**--admin-provisioner**=<name>] [**--admin-password-file**=<file>]
[**--ca-url**=<uri>] [**--root**=<file>] [**--context**=<name>] [**--ca-config**=<file>]`,
		Flags: []cli.Flag{
			// General webhook flags
			urlFlag,
			kindFlag,
			bearerTokenFileFlag,
			basicAuthUsernameFlag,
			basicAuthPasswordFileFlag,
			disableTLSClientAuthFlag,
			certTypeFlag,

			flags.AdminCert,
			flags.AdminKey,
			flags.AdminSubject,
			flags.AdminProvisioner,
			flags.AdminPasswordFile,
			flags.CaURL,
			flags.Root,
			flags.Context,
			flags.CaConfig,
		},
		Description: `**step ca provisioner webhook update** updates a webhook attached to a provisioner.

## POSITIONAL ARGUMENTS

<provisioner_name>
: The name of the provisioner.

<webhook_name>
: The name of the webhook.

## EXAMPLES

Change a webhook's url:
'''
step ca provisioner webhook update my_provisioner my_webhook --url https://example.com
'''

Configure a webhook to send a bearer token to the server:
'''
step ca provisioner webhook update my_provisioner my_webhook --bearer-token-file token.txt
'''

Change the password sent to the webhook with basic authentication:
'''
step ca provisioner webhook update my_provisioner my_webhook --basic-auth-password-file my_pass.txt
'''

Configure the webhook to be called only when signing x509 certificates, not SSH certificates:
'''
step ca provisioner webhook update my_provisioner my_webhook --cert-type X509
'''`,
	}
}

func updateAction(ctx *cli.Context) (err error) {
	if err := errs.NumberOfArguments(ctx, 2); err != nil {
		return err
	}

	args := ctx.Args()

	provisionerName := args.Get(0)

	client, err := newCRUDClient(ctx, ctx.String("ca-config"))
	if err != nil {
		return err
	}

	prov, err := client.GetProvisioner(ca.WithProvisionerName(provisionerName))
	if err != nil {
		return err
	}
	var wh *linkedca.Webhook
	for _, pwh := range prov.Webhooks {
		if pwh.Name == args.Get(1) {
			wh = pwh
			break
		}
	}
	if wh == nil {
		return fmt.Errorf("provisioner %q does not have a webhook with the name %q", provisionerName, args.Get(1))
	}

	if ctx.IsSet("kind") {
		kind := linkedca.Webhook_Kind(linkedca.Webhook_Kind_value[ctx.String("kind")])
		if kind == linkedca.Webhook_NO_KIND {
			return errors.New("invalid webhook kind")
		}
		wh.Kind = kind
	}

	if ctx.IsSet("url") {
		wh.Url = ctx.String("url")
	}

	if ctx.IsSet("bearer-token-file") {
		bearerTkn, err := utils.ReadStringPasswordFromFile(ctx.String("bearer-token-file"))
		if err != nil {
			return err
		}
		wh.Auth = &linkedca.Webhook_BearerToken{
			BearerToken: &linkedca.BearerToken{
				BearerToken: bearerTkn,
			},
		}
	} else if ctx.IsSet("basic-auth-username") || ctx.IsSet("basic-auth-password-file") {
		wba, _ := wh.GetAuth().(*linkedca.Webhook_BasicAuth)
		if wba == nil {
			wba = &linkedca.Webhook_BasicAuth{
				BasicAuth: &linkedca.BasicAuth{},
			}
		}
		if wba.BasicAuth == nil {
			wba.BasicAuth = &linkedca.BasicAuth{}
		}

		if ctx.IsSet("basic-auth-username") {
			wba.BasicAuth.Username = ctx.String("basic-auth-username")
		}
		if ctx.IsSet("basic-auth-password-file") {
			password, err := utils.ReadStringPasswordFromFile(ctx.String("basic-auth-password-file"))
			if err != nil {
				return err
			}
			wba.BasicAuth.Password = password
		}
		wh.Auth = wba
	}

	if ctx.IsSet("disable-tls-client-auth") {
		wh.DisableTlsClientAuth = ctx.Bool("disable-tls-client-auth")
	}

	if ctx.IsSet("cert-type") {
		certType, ok := linkedca.Webhook_CertType_value[ctx.String("cert-type")]
		if !ok {
			return errs.InvalidFlagValue(ctx, "cert-type", ctx.String("cert-type"), "ALL, X509, and SSH")
		}
		wh.CertType = linkedca.Webhook_CertType(certType)
	}

	if _, err = client.UpdateProvisionerWebhook(provisionerName, wh); err != nil {
		return err
	}

	return nil
}

```

### Core Architecture Module: `command/ca/provisioner/webhook/webhook.go`
```
package webhook

import (
	"errors"
	"fmt"
	"os"

	"github.com/urfave/cli"

	"github.com/smallstep/certificates/authority/config"
	"github.com/smallstep/certificates/ca"
	"github.com/smallstep/cli-utils/errs"
	"github.com/smallstep/cli-utils/ui"
	"github.com/smallstep/linkedca"

	"github.com/smallstep/cli/utils/cautils"
)

// Command returns the webhook subcommand.
func Command() cli.Command {
	return cli.Command{
		Name:      "webhook",
		Usage:     "create and manage webhooks for a provisioner",
		UsageText: "step ca provisioner webhook <subcommand> [arguments] [global-flags] [subcommand-flags]",
		Subcommands: cli.Commands{
			addCommand(),
			updateCommand(),
			removeCommand(),
		},
		Description: `**step ca provisioner webhook** command group provides facilities for managing the webhooks attached to a provisioner

Administrators can attach webhooks to provisioners to retrieve additional data that will be available when rendering certificate templates.
Webhooks can also be used to disallow signing certificates for unknown entities.

Any data returned from the webhook server will be added to the template context under the path "Webhooks.<name>".
Implementations of webhook servers must conform to the step-ca documentation at https://smallstep.com/docs/step-ca/templates for parsing and verifying request bodies and forming valid response bodies.

## EXAMPLES

Add a new webhook to a provisioner:
'''
step ca provisioner webhook add my_provisioner my_webhook --url https://example.com
'''

Change a webhook's url:
'''
step ca provisioner webhook update my_provisioner my_webhook --url https://example.com
'''

Remove a webhook:
'''
step ca provisioner webhook remove my_provisioner my_webhook
'''
		`,
	}
}

var (
	urlFlag = cli.StringFlag{
		Name:  "url",
		Usage: `The url of the webhook server.`,
	}
	kindFlag = cli.StringFlag{
		Name:  "kind",
		Usage: `The kind of webhook. Default is ENRICHING.`,
	}
	bearerTokenFileFlag = cli.StringFlag{
		Name:  "bearer-token-file",
		Usage: `The token to be set in the Authorization header of the request to the webhook server.`,
	}
	basicAuthUsernameFlag = cli.StringFlag{
		Name:  "basic-auth-username",
		Usage: `The username portion of the Authorization header of the request to the webhook server when using basic authentication.`,
	}
	basicAuthPasswordFileFlag = cli.StringFlag{
		Name:  "basic-auth-password-file",
		Usage: `The password porition of the Authorization header of the request to the webhook server when using basic authentication.`,
	}
	disableTLSClientAuthFlag = cli.BoolFlag{
		Name:  "disable-tls-client-auth",
		Usage: `The CA will not send a client certificate when requested by the webhook server.`,
	}
	certTypeFlag = cli.StringFlag{
		Name:  "cert-type",
		Usage: `Whether to call this webhook when signing X509 certificates, SSH certificates, or ALL certificates. Default is ALL.`,
	}
)

type crudClient interface {
	GetProvisioner(...ca.ProvisionerOption) (*linkedca.Provisioner, error)
	CreateProvisionerWebhook(provisionerName string, wh *linkedca.Webhook) (*linkedca.Webhook, error)
	UpdateProvisionerWebhook(provisionerName string, wh *linkedca.Webhook) (*linkedca.Webhook, error)
	DeleteProvisionerWebhook(provisionerName string, webhookName string) error
}

func newCRUDClient(cliCtx *cli.Context, cfgFile string) (crudClient, error) {
	// os.Stat("") probably returns os.ErrNotExist, but this behavior is
	// undocumented so we'll handle this case separately.
	if cfgFile == "" {
		return cautils.NewAdminClient(cliCtx)
	}

	_, err := os.Stat(cfgFile)
	switch {
	case errors.Is(err, os.ErrNotExist):
		return cautils.NewAdminClient(cliCtx)
	case err == nil:
		ui.PrintSelected("CA Configuration", cfgFile)
		cfg, err := config.LoadConfiguration(cfgFile)
		if err != nil {
			return nil, fmt.Errorf("error loading configuration: %w", err)
		}
		if cfg.AuthorityConfig.EnableAdmin {
			return cautils.NewAdminClient(cliCtx)
		}
		return nil, errors.New("the admin API must be enabled to use webhooks")
	default:
		return nil, errs.FileError(err, cfgFile)
	}
}

```

### Core Architecture Module: `internal/crlutil/crl_extensions.go`
```
package crlutil

import (
	"bytes"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

var (
	oidExtensionReasonCode               = asn1.ObjectIdentifier{2, 5, 29, 21}
	oidExtensionCRLNumber                = asn1.ObjectIdentifier{2, 5, 29, 20}
	oidExtensionAuthorityKeyID           = asn1.ObjectIdentifier{2, 5, 29, 35}
	oidExtensionIssuingDistributionPoint = asn1.ObjectIdentifier{2, 5, 29, 28}
)

func parseReasonCode(b []byte) string {
	var reasonCode asn1.Enumerated
	if _, err := asn1.Unmarshal(b, &reasonCode); err != nil {
		return sanitizeBytes(b)
	}
	switch reasonCode {
	case 0:
		return "Unspecified"
	case 1:
		return "Key Compromise"
	case 2:
		return "CA Compromise"
	case 3:
		return "Affiliation Changed"
	case 4:
		return "Superseded"
	case 5:
		return "Cessation Of Operation"
	case 6:
		return "Certificate Hold"
	case 8:
		return "Remove From CRL"
	case 9:
		return "Privilege Withdrawn"
	case 10:
		return "AA Compromise"
	default:
		return fmt.Sprintf("ReasonCode(%d): unknown", reasonCode)
	}
}

// RFC 5280,  4.2.1.1
type authorityKeyID struct {
	ID []byte `asn1:"optional,tag:0"`
}

// RFC 5280, 5.2.5
type distributionPoint struct {
	DistributionPoint          distributionPointName `asn1:"optional,tag:0"`
	OnlyContainsUserCerts      bool                  `asn1:"optional,tag:1"`
	OnlyContainsCACerts        bool                  `asn1:"optional,tag:2"`
	OnlySomeReasons            asn1.BitString        `asn1:"optional,tag:3"`
	IndirectCRL                bool                  `asn1:"optional,tag:4"`
	OnlyContainsAttributeCerts bool                  `asn1:"optional,tag:5"`
}

type distributionPointName struct {
	FullName     []asn1.RawValue  `asn1:"optional,tag:0"`
	RelativeName pkix.RDNSequence `asn1:"optional,tag:1"`
}

func (d distributionPoint) FullNames() []string {
	var names []string
	for _, v := range d.DistributionPoint.FullName {
		switch v.Class {
		case 2:
			names = append(names, fmt.Sprintf("URI:%s", v.Bytes))
		default:
			names = append(names, fmt.Sprintf("Class(%d):%s", v.Class, v.Bytes))
		}
	}
	return names
}

type Extension struct {
	Name    string   `json:"-"`
	Details []string `json:"-"`
	json    map[string]any
}

func (e *Extension) MarshalJSON() ([]byte, error) {
	return json.Marshal(e.json)
}

func (e *Extension) AddDetailf(format string, args ...any) {
	e.Details = append(e.Details, fmt.Sprintf(format, args...))
}

func (e *Extension) AddDetail(detail string) {
	e.Details = append(e.Details, detail)
}

func newExtension(e pkix.Extension) Extension {
	var ext Extension
	switch {
	case e.Id.Equal(oidExtensionReasonCode):
		ext.Name = "X509v3 CRL Reason Code:"
		value := parseReasonCode(e.Value)
		ext.AddDetail(value)
		ext.json = map[string]any{
			"crl_reason_code": value,
		}

	case e.Id.Equal(oidExtensionCRLNumber):
		ext.Name = "X509v3 CRL Number:"
		var n *big.Int
		if _, err := asn1.Unmarshal(e.Value, &n); err == nil {
			ext.AddDetail(n.String())
			ext.json = map[string]any{
				"crl_number": n.String(),
			}
		} else {
			ext.AddDetail(sanitizeBytes(e.Value))
			ext.json = map[string]any{
				"crl_number": e.Value,
			}
		}

	case e.Id.Equal(oidExtensionAuthorityKeyID):
		var v authorityKeyID
		ext.Name = "X509v3 Authority Key Identifier:"
		ext.json = map[string]any{
			"authority_key_id": hex.EncodeToString(e.Value),
		}
		if _, err := asn1.Unmarshal(e.Value, &v); err == nil {
			var s strings.Builder
			for _, b := range v.ID {
				fmt.Fprintf(&s, ":%02X", b)
			}
			ext.AddDetail("keyid" + s.String())
		} else {
			ext.AddDetail(sanitizeBytes(e.Value))
		}
	case e.Id.Equal(oidExtensionIssuingDistributionPoint):
		ext.Name = "X509v3 Issuing Distribution Point:"

		var v distributionPoint
		if _, err := asn1.Unmarshal(e.Value, &v); err != nil {
			ext.AddDetail(sanitizeBytes(e.Value))
			ext.json = map[string]any{
				"issuing_distribution_point": e.Value,
			}
		} else {
			names := v.FullNames()
			if len(names) > 0 {
				ext.AddDetail("Full Name:")
				for _, n := range names {
					ext.AddDetail("    " + n)
				}
			}
			js := map[string]any{
				"full_names": names,
			}

			// Only one of this should be set to true. But for inspect we
			// will allow more than one.
			if v.OnlyContainsUserCerts {
				ext.AddDetail("Only User Certificates")
				js["only_user_certificates"] = true
			}
			if v.OnlyContainsCACerts {
				ext.AddDetail("Only CA Certificates")
				js["only_ca_certificates"] = true
			}
			if v.OnlyContainsAttributeCerts {
				ext.AddDetail("Only Attribute Certificates")
				js["only_attribute_certificates"] = true
			}
			if len(v.OnlySomeReasons.Bytes) > 0 {
				ext.AddDetailf("Reasons: %x", v.OnlySomeReasons.Bytes)
				js["only_some_reasons"] = v.OnlySomeReasons.Bytes
			}

			ext.json = map[string]any{
				"issuing_distribution_point": js,
			}
		}
	default:
		ext.Name = e.Id.String()
		ext.AddDetail(sanitizeBytes(e.Value))
		ext.json = map[string]any{
			ext.Name: e.Value,
		}
	}

	if e.Critical {
		ext.Name += " critical"
		ext.json["critical"] = true
	}

	return ext
}

func sanitizeBytes(b []byte) string {
	value := bytes.Runes(b)
	sanitized := make([]rune, len(value))
	for i, r := range value {
		if strconv.IsPrint(r) && r != '�' {
			sanitized[i] = r
		} else {
			sanitized[i] = '.'
		}
	}
	return string(sanitized)
}

```

### Core Architecture Module: `internal/crlutil/crlutil.go`
```
package crlutil

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"
	"fmt"
	"math/big"
	"strconv"
	"time"

	"github.com/pkg/errors"
	"go.step.sm/crypto/mldsa"
)

// CRL is the JSON representation of a certificate revocation list.
type CRL struct {
	Version             *big.Int             `json:"version"`
	SignatureAlgorithm  SignatureAlgorithm   `json:"signature_algorithm"`
	Issuer              DistinguishedName    `json:"issuer"`
	ThisUpdate          time.Time            `json:"this_update"`
	NextUpdate          time.Time            `json:"next_update"`
	RevokedCertificates []RevokedCertificate `json:"revoked_certificates"`
	Extensions          []Extension          `json:"extensions,omitempty"`
	Signature           *Signature           `json:"signature"`
	AuthorityKeyID      []byte
	Raw                 []byte
}

// pemCRLPrefix is the magic string that indicates that we have a PEM encoded
// CRL.
var pemCRLPrefix = []byte("-----BEGIN X509 CRL")

// pemType is the type of a PEM encoded CRL.
var pemType = "X509 CRL"

func ParseCRL(b []byte) (*CRL, error) {
	if bytes.HasPrefix(b, pemCRLPrefix) {
		block, _ := pem.Decode(b)
		if block != nil && block.Type == pemType {
			b = block.Bytes
		}
	}

	crl, err := x509.ParseRevocationList(b)
	if err != nil {
		return nil, errors.Wrap(err, "error parsing crl")
	}

	certs := make([]RevokedCertificate, len(crl.RevokedCertificateEntries))
	for i, c := range crl.RevokedCertificateEntries {
		certs[i] = newRevokedCertificate(c)
	}

	var issuerKeyID []byte
	extensions := make([]Extension, len(crl.Extensions))
	for i, e := range crl.Extensions {
		extensions[i] = newExtension(e)
		if e.Id.Equal(oidExtensionAuthorityKeyID) {
			var v authorityKeyID
			if _, err := asn1.Unmarshal(e.Value, &v); err == nil {
				issuerKeyID = v.ID
			}
		}
	}

	sa := newSignatureAlgorithm(crl.SignatureAlgorithm)

	return &CRL{
		Version:             crl.Number.Add(crl.Number, big.NewInt(1)),
		SignatureAlgorithm:  sa,
		Issuer:              newDistinguishedName(crl.Issuer),
		ThisUpdate:          crl.ThisUpdate,
		NextUpdate:          crl.NextUpdate,
		RevokedCertificates: certs,
		Extensions:          extensions,
		Signature: &Signature{
			SignatureAlgorithm: sa,
			Value:              crl.Signature,
			Valid:              false,
			Reason:             "",
		},
		AuthorityKeyID: issuerKeyID,
		Raw:            crl.RawTBSRevocationList,
	}, nil
}

func (c *CRL) Verify(ca *x509.Certificate) bool {
	now := time.Now()
	if now.After(c.NextUpdate) {
		c.Signature.Reason = "CRL has expired"
		return false
	}
	if now.After(ca.NotAfter) {
		c.Signature.Reason = "CA certificate has expired"
		return false
	}

	if !c.VerifySignature(ca) {
		c.Signature.Reason = "Signature does not match"
		return false
	}

	return true
}

func (c *CRL) VerifySignature(ca *x509.Certificate) bool {
	var sum []byte
	var hash crypto.Hash
	if hash = c.SignatureAlgorithm.hash; hash > 0 {
		h := hash.New()
		h.Write(c.Raw)
		sum = h.Sum(nil)
	}

	sig := c.Signature.Value
	switch pub := ca.PublicKey.(type) {
	case *ecdsa.PublicKey:
		return ecdsa.VerifyASN1(pub, sum, sig)
	case *rsa.PublicKey:
		switch c.SignatureAlgorithm.algo {
		case x509.SHA256WithRSAPSS, x509.SHA384WithRSAPSS, x509.SHA512WithRSAPSS:
			return rsa.VerifyPSS(pub, hash, sum, sig, &rsa.PSSOptions{
				SaltLength: rsa.PSSSaltLengthAuto,
			}) == nil
		default:
			return rsa.VerifyPKCS1v15(pub, hash, sum, sig) == nil
		}
	case ed25519.PublicKey:
		return ed25519.Verify(pub, c.Raw, sig)
	case *mldsa.PublicKey:
		return mldsa.Verify(pub, c.Raw, sig, nil) == nil
	default:
		return false
	}
}

func PrintCRL(crl *CRL) {
	fmt.Println("Certificate Revocation List (CRL):")
	fmt.Println("    Data:")
	fmt.Printf("        Valid: %v\n", crl.Signature.Valid)
	if crl.Signature.Reason != "" {
		fmt.Printf("        Reason: %s\n", crl.Signature.Reason)
	}
	fmt.Printf("        Version: %d (0x%x)\n", crl.Version, crl.Version.Add(crl.Version, big.NewInt(-1)))
	fmt.Println("    Signature algorithm:", crl.SignatureAlgorithm)
	fmt.Println("        Issuer:", crl.Issuer)
	fmt.Println("        Last Update:", crl.ThisUpdate.UTC())
	fmt.Println("        Next Update:", crl.NextUpdate.UTC())
	fmt.Println("        CRL Extensions:")
	for _, e := range crl.Extensions {
		fmt.Println(spacer(12) + e.Name)
		for _, s := range e.Details {
			fmt.Println(spacer(16) + s)
		}
	}
	if len(crl.RevokedCertificates) == 0 {
		fmt.Println(spacer(8) + "No Revoked Certificates.")
	} else {
		fmt.Println(spacer(8) + "Revoked Certificates:")
		for _, crt := range crl.RevokedCertificates {
			fmt.Printf(spacer(12)+"Serial Number: %s (0x%X)\n", crt.SerialNumber, crt.SerialNumberBytes)
			fmt.Println(spacer(16)+"Revocation Date:", crt.RevocationTime.UTC())
			if len(crt.Extensions) > 0 {
				fmt.Println(spacer(16) + "CRL Entry Extensions:")
				for _, e := range crt.Extensions {
					fmt.Println(spacer(20) + e.Name)
					for _, s := range e.Details {
						fmt.Println(spacer(24) + s)
					}
				}
			}
		}
	}

	fmt.Println("    Signature Algorithm:", crl.Signature.SignatureAlgorithm)
	printBytes(crl.Signature.Value, spacer(8))
}

// Signature is the JSON representation of a CRL signature.
type Signature struct {
	SignatureAlgorithm SignatureAlgorithm `json:"signature_algorithm"`
	Value              []byte             `json:"value"`
	Valid              bool               `json:"valid"`
	Reason             string             `json:"reason,omitempty"`
}

// DistinguishedName is the JSON representation of the CRL issuer.
type DistinguishedName struct {
	Country            []string         `json:"country,omitempty"`
	Organization       []string         `json:"organization,omitempty"`
	OrganizationalUnit []string         `json:"organizational_unit,omitempty"`
	Locality           []string         `json:"locality,omitempty"`
	Province           []string         `json:"province,omitempty"`
	StreetAddress      []string         `json:"street_address,omitempty"`
	PostalCode         []string         `json:"postal_code,omitempty"`
	SerialNumber       string           `json:"serial_number,omitempty"`
	CommonName         string           `json:"common_name,omitempty"`
	ExtraNames         map[string][]any `json:"extra_names,omitempty"`
	dn                 pkix.Name
}

// String returns the one line representation of the distinguished name.
func (d DistinguishedName) String() string {
	return d.dn.String()
}

func newDistinguishedName(dn pkix.Name) DistinguishedName {
	var extraNames map[string][]any
	if len(dn.ExtraNames) > 0 {
		extraNames = make(map[string][]any)
		for _, tv := range dn.ExtraNames {
			oid := tv.Type.String()
			if s, ok := tv.Value.(string); ok {
				extraNames[oid] = append(extraNames[oid], s)
				continue
			}
			if b, err := asn1.Marshal(tv.Value); err == nil {
				extraNames[oid] = append(extraNames[oid], b)
				continue
			}
			extraNames[oid] = append(extraNames[oid], escapeValue(tv.Value))
		}
	}

	return DistinguishedName{
		Country:            dn.Country,
		Organization:       dn.Organization,
		OrganizationalUnit: dn.OrganizationalUnit,
		Locality:           dn.Locality,
		Province:           dn.Province,
		StreetAddress:      dn.StreetAddress,
		PostalCode:         dn.PostalCode,
		SerialNumber:       dn.SerialNumber,
		CommonName:         dn.CommonName,
		ExtraNames:         extraNames,
	}
}

// RevokedCertificate is the JSON representation of a certificate in a CRL.
type RevokedCertificate struct {
	SerialNumber      string      `json:"serial_number"`
	RevocationTime    time.Time   `json:"revocation_time"`
	Extensions        []Extension `json:"extensions,omitempty"`
	SerialNumberBytes []byte      `json:"-"`
}

func newRevokedCertificate(c x509.RevocationListEntry) RevokedCertificate {
	extensions := make([]Extension, len(c.Extensions))

	for i, e := range c.Extensions {
		extensions[i] = newExtension(e)
	}

	return RevokedCertificate{
		SerialNumber:      c.SerialNumber.String(),
		RevocationTime:    c.RevocationTime.UTC(),
		Extensions:        extensions,
		SerialNumberBytes: c.SerialNumber.Bytes(),
	}
}

func spacer(i int) string {
	return fmt.Sprintf("%"+strconv.Itoa(i)+"s", "")
}

func printBytes(bs []byte, prefix string) {
	for i, b := range bs {
		if i == 0 {
			fmt.Print(prefix)
		} else if (i % 16) == 0 {
			fmt.Print("\n" + prefix)
		}
		fmt.Printf("%02x", b)
		if i != len(bs)-1 {
			fmt.Print(":")
		}
	}
	fmt.Println()
}

func escapeValue(v any) string {
	s := fmt.Sprint(v)
	escaped := make([]rune, 0, len(s))

	for k, c := range s {
		escape := false

		switch c {
		case ',', '+', '"', '\\', '<', '>', ';':
			escape = true

		case ' ':
			escape = k == 0 || k == len(s)-1

		case '#':
			escape = k == 0
		}

		if escape {
			escaped = append(escaped, '\\', c)
		} else {
			escaped = append(escaped, c)
		}
	}

	return string(escaped)
}

```

### Core Architecture Module: `internal/crlutil/signature_algorithms.go`
```
// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package crlutil

import (
	"crypto"
	"crypto/x509"
	"encoding/asn1"
)

// OIDs for signature algorithms
var (
	oidSignatureMD2WithRSA      = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 2}
	oidSignatureMD5WithRSA      = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 4}
	oidSignatureSHA1WithRSA     = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 5}
	oidSignatureSHA256WithRSA   = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 11}
	oidSignatureSHA384WithRSA   = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 12}
	oidSignatureSHA512WithRSA   = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 13}
	oidSignatureRSAPSS          = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 1, 10}
	oidSignatureDSAWithSHA1     = asn1.ObjectIdentifier{1, 2, 840, 10040, 4, 3}
	oidSignatureDSAWithSHA256   = asn1.ObjectIdentifier{2, 16, 840, 1, 101, 3, 4, 3, 2}
	oidSignatureECDSAWithSHA1   = asn1.ObjectIdentifier{1, 2, 840, 10045, 4, 1}
	oidSignatureECDSAWithSHA256 = asn1.ObjectIdentifier{1, 2, 840, 10045, 4, 3, 2}
	oidSignatureECDSAWithSHA384 = asn1.ObjectIdentifier{1, 2, 840, 10045, 4, 3, 3}
	oidSignatureECDSAWithSHA512 = asn1.ObjectIdentifier{1, 2, 840, 10045, 4, 3, 4}
	oidSignatureEd25519         = asn1.ObjectIdentifier{1, 3, 101, 112}
)

type signatureAlgorithmDetails struct {
	oid  stringer
	hash crypto.Hash
}

type stringer interface {
	String() string
}

type oidUnknown struct{}

func (o oidUnknown) String() string {
	return "unknown"
}

var signatureAlgorithmMap = map[x509.SignatureAlgorithm]signatureAlgorithmDetails{
	x509.MD2WithRSA:                {oidSignatureMD2WithRSA, crypto.Hash(0)}, // no value for MD2
	x509.MD5WithRSA:                {oidSignatureMD5WithRSA, crypto.MD5},
	x509.SHA1WithRSA:               {oidSignatureSHA1WithRSA, crypto.SHA1},
	x509.SHA256WithRSA:             {oidSignatureSHA256WithRSA, crypto.SHA256},
	x509.SHA384WithRSA:             {oidSignatureSHA384WithRSA, crypto.SHA384},
	x509.SHA512WithRSA:             {oidSignatureSHA512WithRSA, crypto.SHA512},
	x509.SHA256WithRSAPSS:          {oidSignatureRSAPSS, crypto.SHA256},
	x509.SHA384WithRSAPSS:          {oidSignatureRSAPSS, crypto.SHA384},
	x509.SHA512WithRSAPSS:          {oidSignatureRSAPSS, crypto.SHA512},
	x509.DSAWithSHA1:               {oidSignatureDSAWithSHA1, crypto.SHA1},
	x509.DSAWithSHA256:             {oidSignatureDSAWithSHA256, crypto.SHA256},
	x509.ECDSAWithSHA1:             {oidSignatureECDSAWithSHA1, crypto.SHA1},
	x509.ECDSAWithSHA256:           {oidSignatureECDSAWithSHA256, crypto.SHA256},
	x509.ECDSAWithSHA384:           {oidSignatureECDSAWithSHA384, crypto.SHA384},
	x509.ECDSAWithSHA512:           {oidSignatureECDSAWithSHA512, crypto.SHA512},
	x509.PureEd25519:               {oidSignatureEd25519, crypto.Hash(0)},
	x509.UnknownSignatureAlgorithm: {oidUnknown{}, crypto.Hash(0)},
}

type SignatureAlgorithm struct {
	Name string `json:"name"`
	OID  string `json:"oid"`
	algo x509.SignatureAlgorithm
	hash crypto.Hash
}

func (s SignatureAlgorithm) String() string {
	if s.Name == "" {
		return s.OID
	}
	return s.Name
}

func newSignatureAlgorithm(xsa x509.SignatureAlgorithm) SignatureAlgorithm {
	sa := SignatureAlgorithm{
		Name: xsa.String(),
		algo: xsa,
	}

	if sad, ok := signatureAlgorithmMap[xsa]; ok {
		sa.OID = sad.oid.String()
		sa.hash = sad.hash
	} else {
		sa.OID = "unknown"
	}

	return sa
}

```

### Core Architecture Module: `internal/cryptoutil/cryptoutil.go`
```
package cryptoutil

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/smallstep/cli/internal/plugin"
	"go.step.sm/crypto/jose"
	"go.step.sm/crypto/kms"
	"go.step.sm/crypto/kms/apiv1"
	"go.step.sm/crypto/mldsa"
	"go.step.sm/crypto/pemutil"
)

// IsKMS returns true if the given uri is a KMS URI. It will return false if a
// file exists with the same name, even if the path matches a KMS uri pattern.
func IsKMS(rawuri string) bool {
	if _, err := os.Stat(rawuri); err == nil {
		return false
	}

	typ, err := kms.TypeOf(rawuri)
	if err != nil || typ == apiv1.DefaultKMS {
		return false
	}
	return true
}

func isFilename(name string) bool {
	_, err := os.Stat(name)
	return err == nil
}

// Attestor is the interface implemented by step-kms-plugin using the key, sign,
// and attest commands.
type Attestor interface {
	crypto.Signer
	Attest() ([]byte, error)
}

func PublicKey(kmsURI, name string, opts ...pemutil.Options) (crypto.PublicKey, error) {
	if isFilename(name) {
		s, err := pemutil.Read(name, opts...)
		if err != nil {
			return nil, err
		}
		if pub, ok := s.(crypto.PublicKey); ok {
			return pub, nil
		}
		return nil, fmt.Errorf("file %s does not contain a valid public key", name)
	}

	k, err := newKMSPublicKey(kmsURI, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get public key: %w", err)
	}

	return k.Public(), nil
}

// CreateSigner reads a key from a file with a given name or creates a signer
// with the given kms and name uri.
func CreateSigner(kmsURI, name string, opts ...pemutil.Options) (crypto.Signer, error) {
	if isFilename(name) {
		s, err := pemutil.Read(name, opts...)
		if err != nil {
			return nil, err
		}
		if sig, ok := s.(crypto.Signer); ok {
			return sig, nil
		}
		return nil, fmt.Errorf("file %s does not contain a valid private key", name)
	}

	return newKMSSigner(kmsURI, name)
}

// LoadCertificate returns a x509.Certificate from a kms or file
func LoadCertificate(kmsURI, certPath string) ([]*x509.Certificate, error) {
	if isFilename(certPath) {
		s, err := pemutil.ReadCertificateBundle(certPath)
		if err != nil {
			return nil, fmt.Errorf("file %s does not contain a valid certificate: %w", certPath, err)
		}
		return s, nil
	}

	name, err := plugin.LookPath("kms")
	if err != nil {
		return nil, err
	}

	args := []string{"certificate"}
	if kmsURI != "" {
		args = append(args, "--kms", kmsURI)
	}
	args = append(args, certPath)

	// Get public key
	cmd := exec.Command(name, args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, exitError(cmd, err)
	}

	cert, err := pemutil.ParseCertificateBundle(out)
	if err != nil {
		return nil, err
	}

	return cert, nil
}

// LoadJSONWebKey returns a jose.JSONWebKey from a KMS or a file.
func LoadJSONWebKey(kmsURI, name string, opts ...jose.Option) (*jose.JSONWebKey, error) {
	if isFilename(name) {
		return jose.ReadKey(name, opts...)
	}

	signer, err := newKMSSigner(kmsURI, name)
	if err != nil {
		return nil, err
	}

	jwk := &jose.JSONWebKey{
		Key: jose.NewOpaqueSigner(signer),
		Use: "sig",
	}

	// Get default signing algorithm for each key type:
	switch pub := signer.Public().(type) {
	case *ecdsa.PublicKey:
		switch pub.Curve {
		case elliptic.P256():
			jwk.Algorithm = jose.ES256
		case elliptic.P384():
			jwk.Algorithm = jose.ES384
		case elliptic.P521():
			jwk.Algorithm = jose.ES512
		default:
			return nil, fmt.Errorf("unsupported elliptic curve %q", pub.Curve.Params().Name)
		}
	case *rsa.PublicKey:
		jwk.Algorithm = jose.RS256
	case ed25519.PublicKey:
		jwk.Algorithm = jose.EdDSA
	default:
		return nil, fmt.Errorf("unsupported key type %T", pub)
	}

	kid, err := jose.Thumbprint(jwk)
	if err != nil {
		return nil, err
	}
	jwk.KeyID = kid

	return jwk, nil
}

// CreateAttestor creates an attestor that will use `step-kms-plugin` with the
// given kms and name.
func CreateAttestor(kmsURI, name string) (Attestor, error) {
	return newKMSSigner(kmsURI, name)
}

// IsKMSSigner returns true if the given signer uses the step-kms-plugin signer.
func IsKMSSigner(signer crypto.Signer) (ok bool) {
	_, ok = signer.(*kmsSigner)
	return
}

// IsX509Signer returns true if the given signer is supported by Go's
// crypto/x509 package to sign X509 certificates. This methods returns true for
// ECDSA, RSA, Ed25519, and ML-DSA keys, but if the kms is `sshagentkms:` it
// will only return true for Ed25519 keys.
//
// TODO(hs): introspect the KMS key to verify that it can actually be used for
// signing? E.g. for Google Cloud KMS RSA keys can be used for signing or
// decryption, but only one of those at a time. Trying to use a signing key to
// decrypt data will result in an error from Cloud KMS.
func IsX509Signer(signer crypto.Signer) bool {
	pub := signer.Public()
	if ks, ok := signer.(*kmsSigner); ok {
		if strings.HasPrefix(strings.ToLower(ks.kms), "sshagentkms:") {
			_, ok = pub.(ed25519.PublicKey)
			return ok
		}
	}
	switch pub.(type) {
	case *ecdsa.PublicKey, *rsa.PublicKey, ed25519.PublicKey, *mldsa.PublicKey:
		return true
	default:
		return false
	}
}

type kmsSigner struct {
	crypto.PublicKey
	name     string
	kms, key string
}

type kmsPublicKey struct {
	crypto.PublicKey
	name     string
	kms, key string
}

// exitError returns the error displayed on stderr after running the given
// command.
func exitError(cmd *exec.Cmd, err error) error {
	if ee, ok := errors.AsType[*exec.ExitError](err); ok {
		return fmt.Errorf("command %q failed with:\n%s", cmd.String(), ee.Stderr)
	}
	return fmt.Errorf("command %q failed with: %w", cmd.String(), err)
}

// newKMSSigner creates a signer using `step-kms-plugin` as the signer.
func newKMSSigner(kmsURI, key string) (*kmsSigner, error) {
	name, err := plugin.LookPath("kms")
	if err != nil {
		return nil, err
	}

	args := []string{"key"}
	if kmsURI != "" {
		args = append(args, "--kms", kmsURI)
	}
	args = append(args, key)

	// Get public key
	cmd := exec.Command(name, args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, exitError(cmd, err)
	}

	pub, err := pemutil.Parse(out)
	if err != nil {
		return nil, err
	}

	return &kmsSigner{
		PublicKey: pub,
		name:      name,
		kms:       kmsURI,
		key:       key,
	}, nil
}

// newKMSPublicKey creates a signer using `step-kms-plugin` as the signer.
func newKMSPublicKey(kmsURI, key string) (*kmsPublicKey, error) {
	name, err := plugin.LookPath("kms")
	if err != nil {
		return nil, err
	}

	args := []string{"key"}
	if kmsURI != "" {
		args = append(args, "--kms", kmsURI)
	}
	args = append(args, key)

	// Get public key
	cmd := exec.Command(name, args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, exitError(cmd, err)
	}

	pub, err := pemutil.Parse(out)
	if err != nil {
		return nil, err
	}

	return &kmsPublicKey{
		PublicKey: pub,
		name:      name,
		kms:       kmsURI,
		key:       key,
	}, nil
}

// Public returns the KMS public key
func (s *kmsPublicKey) Public() crypto.PublicKey {
	return s.PublicKey
}

// Public implements crypto.Signer and returns the public key.
func (s *kmsSigner) Public() crypto.PublicKey {
	return s.PublicKey
}

// Sign implements crypto.Signer using the `step-kms-plugin`.
func (s *kmsSigner) Sign(_ io.Reader, digest []byte, opts crypto.SignerOpts) (signature []byte, err error) {
	args := []string{"sign", "--format", "base64"}
	if s.kms != "" {
		args = append(args, "--kms", s.kms)
	}
	if _, ok := s.PublicKey.(*rsa.PublicKey); ok {
		if o, pss := opts.(*rsa.PSSOptions); pss {
			// The --salt-length argument requires step-kms-plugin v0.12.0
			args = append(args, "--pss", "--salt-length", strconv.Itoa(o.SaltLength))
		}
		switch opts.HashFunc() {
		case crypto.SHA256:
			args = append(args, "--alg", "SHA256")
		case crypto.SHA384:
			args = append(args, "--alg", "SHA384")
		case crypto.SHA512:
			args = append(args, "--alg", "SHA512")
		default:
			return nil, fmt.Errorf("unsupported hash function %q", opts.HashFunc().String())
		}
	}
	args = append(args, s.key)

	//nolint:gosec // arguments controlled by step.
	cmd := exec.Command(s.name, args...)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	go func() {
		defer stdin.Close()
		stdin.Write(digest)
	}()
	out, err := cmd.Output()
	if err != nil {
		return nil, exitError(cmd, err)
	}
	return base64.StdEncoding.DecodeString(string(out))
}

// Attest returns an attestation certificate using the `step-kms-plugin attest`
// command.
func (s *kmsSigner) Attest() ([]byte, error) {
	args := []string{"attest"}
	if s.kms != "" {
		args = append(args, "--kms", s.kms)
	}
	args = append(args, s.key)

	//nolint:gosec // arguments controlled by step.
	cmd := exec.Command(s.name, args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, exitError(cmd, err)
	}
	return out, nil
}

```

### Core Architecture Module: `internal/sliceutil/sliceutil.go`
```
package sliceutil

// RemoveValues remove the given values from the given slice and returns the
// updated one. It retains the order of elements in the source slice.
func RemoveValues[T comparable](slice, values []T) []T {
	if len(slice) == 0 {
		return slice
	}
	keys := make(map[T]struct{}, len(slice))
	for _, v := range values {
		keys[v] = struct{}{}
	}

	var i int
	for _, v := range slice {
		if _, ok := keys[v]; !ok {
			slice[i] = v
			i++
		}
	}
	return slice[:i]
}

// RemoveDuplicates returns a new slice of T with duplicate values removed. It
// retains the order of elements in the source slice.
func RemoveDuplicates[T comparable](slice []T) []T {
	if len(slice) <= 1 {
		return slice
	}

	keys := make(map[T]struct{}, len(slice))
	ret := make([]T, 0, len(slice))
	for _, v := range slice {
		if _, ok := keys[v]; ok {
			continue
		}
		keys[v] = struct{}{}
		ret = append(ret, v)
	}
	return ret
}

```

### Core Architecture Module: `internal/sshutil/agent.go`
```
package sshutil

import (
	"bytes"
	"net"
	"runtime"
	"time"

	"github.com/pkg/errors"
	"github.com/smallstep/cli/internal/cast"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

type options struct {
	filterBySignatureKey func(*agent.Key) bool
	removeExpiredKey     func(*Agent, *agent.Key) bool
}

func newOptions(opts []AgentOption) *options {
	o := new(options)
	for _, fn := range opts {
		fn(o)
	}
	return o
}

// AgentOption is the type used for variadic options in Agent methods.
type AgentOption func(o *options)

// WithSignatureKey filters certificate not signed by the given signing keys.
func WithSignatureKey(keys []ssh.PublicKey) AgentOption {
	signingKeys := make([][]byte, len(keys))
	for i, k := range keys {
		signingKeys[i] = k.Marshal()
	}
	return func(o *options) {
		o.filterBySignatureKey = func(k *agent.Key) bool {
			cert, err := ParseCertificate(k.Marshal())
			if err != nil {
				return false
			}
			b := cert.SignatureKey.Marshal()
			for _, sb := range signingKeys {
				if bytes.Equal(b, sb) {
					return true
				}
			}
			return false
		}
	}
}

// WithCertsOnly filters only those keys accompanied by a certificate.
func WithCertsOnly() AgentOption {
	return func(o *options) {
		o.filterBySignatureKey = func(k *agent.Key) bool {
			_, err := ParseCertificate(k.Marshal())
			return err == nil
		}
	}
}

// WithRemoveExpiredCerts will remove the expired certificates automatically.
func WithRemoveExpiredCerts(t time.Time) AgentOption {
	unixNow := t.Unix()
	return func(o *options) {
		o.removeExpiredKey = func(a *Agent, k *agent.Key) bool {
			if cert, err := ParseCertificate(k.Marshal()); err == nil {
				if before := cast.Int64(cert.ValidBefore); cert.ValidBefore != uint64(ssh.CertTimeInfinity) && (unixNow >= before || before < 0) {
					if err := a.Remove(k); err == nil {
						return true
					}
				}
			}
			return false
		}
	}
}

// ErrNotFound is the error returned if a something is not found.
var ErrNotFound = errors.New("not found")

// Agent represents a client to an ssh.Agent.
type Agent struct {
	agent.ExtendedAgent
	Conn net.Conn
}

// DialAgent returns an ssh.Agent client. It uses the SSH_AUTH_SOCK to connect
// to the agent.
func DialAgent() (*Agent, error) {
	return dialAgent()
}

// Close closes the connection to the agent.
func (a *Agent) Close() error {
	return a.Conn.Close()
}

// AuthMethod returns the ssh.Agent as an ssh.AuthMethod.
func (a *Agent) AuthMethod() ssh.AuthMethod {
	return ssh.PublicKeysCallback(a.Signers)
}

// HasKeys returns if a key filtered with the given options exists.
func (a *Agent) HasKeys(opts ...AgentOption) (bool, error) {
	o := newOptions(opts)
	keys, err := a.List()
	if err != nil {
		return false, errors.Wrap(err, "error listing keys")
	}
	for _, key := range keys {
		if o.removeExpiredKey != nil && o.removeExpiredKey(a, key) {
			continue
		}
		if o.filterBySignatureKey == nil || o.filterBySignatureKey(key) {
			return true, nil
		}
	}
	return false, nil
}

// ListKeys returns the list of keys in the agent.
func (a *Agent) ListKeys(opts ...AgentOption) ([]*agent.Key, error) {
	o := newOptions(opts)
	keys, err := a.List()
	if err != nil {
		return nil, errors.Wrap(err, "error listing keys")
	}
	var list []*agent.Key
	for _, key := range keys {
		if o.removeExpiredKey != nil && o.removeExpiredKey(a, key) {
			continue
		}
		if o.filterBySignatureKey == nil || o.filterBySignatureKey(key) {
			list = append(list, key)
		}
	}
	return list, nil
}

// ListCertificates returns the list of certificates in the agent.
func (a *Agent) ListCertificates(opts ...AgentOption) ([]*ssh.Certificate, error) {
	keys, err := a.ListKeys(opts...)
	if err != nil {
		return nil, err
	}
	var list []*ssh.Certificate
	for _, key := range keys {
		if cert, err := ParseCertificate(key.Marshal()); err == nil {
			list = append(list, cert)
		}
	}
	return list, nil
}

// GetKey retrieves a key from the agent by the given comment.
func (a *Agent) GetKey(comment string, opts ...AgentOption) (*agent.Key, error) {
	o := newOptions(opts)
	keys, err := a.List()
	if err != nil {
		return nil, errors.Wrap(err, "error listing keys")
	}
	for _, key := range keys {
		if key.Comment == comment {
			if o.removeExpiredKey != nil && o.removeExpiredKey(a, key) {
				continue
			}
			if o.filterBySignatureKey == nil || o.filterBySignatureKey(key) {
				return key, nil
			}
		}
	}
	return nil, ErrNotFound
}

// GetSigner returns a signer that has a key with the given comment.
func (a *Agent) GetSigner(comment string, opts ...AgentOption) (ssh.Signer, error) {
	key, err := a.GetKey(comment, opts...)
	if err != nil {
		return nil, err
	}

	signers, err := a.Signers()
	if err != nil {
		return nil, errors.Wrap(err, "error listing signers")
	}

	keyBytes := key.Marshal()
	for _, sig := range signers {
		if bytes.Equal(keyBytes, sig.PublicKey().Marshal()) {
			return sig, nil
		}
	}

	return nil, ErrNotFound
}

// RemoveKeys removes the keys with the given comment from the agent.
func (a *Agent) RemoveKeys(comment string, opts ...AgentOption) (bool, error) {
	o := newOptions(opts)
	keys, err := a.List()
	if err != nil {
		return false, errors.Wrap(err, "error listing keys")
	}

	var removed bool
	for _, key := range keys {
		if key.Comment == comment {
			if o.filterBySignatureKey == nil || o.filterBySignatureKey(key) {
				if err := a.Remove(key); err != nil {
					return false, errors.Wrap(err, "error removing key")
				}
				removed = true
			}
		}
	}

	return removed, nil
}

// RemoveAllKeys removes from the agent all the keys matching the given options.
func (a *Agent) RemoveAllKeys(opts ...AgentOption) (bool, error) {
	o := newOptions(opts)
	keys, err := a.List()
	if err != nil {
		return false, errors.Wrap(err, "error listing keys")
	}

	var removed bool
	for _, key := range keys {
		if o.filterBySignatureKey == nil || o.filterBySignatureKey(key) {
			if err := a.Remove(key); err != nil {
				return false, errors.Wrap(err, "error removing key")
			}
			removed = true
		}
	}

	return removed, nil
}

// AddCertificate adds the given certificate to the agent.
func (a *Agent) AddCertificate(subject string, cert *ssh.Certificate, priv any) error {
	var (
		lifetime uint64
		now      = cast.Uint64(time.Now().Unix())
	)
	switch {
	case cert.ValidBefore == ssh.CertTimeInfinity:
		// 0 indicates that the certificate should never expire from the agent.
		lifetime = 0
	case cert.ValidBefore <= now:
		return errors.New("error adding certificate to ssh agent - certificate is already expired")
	default:
		lifetime = cert.ValidBefore - now
	}

	// Windows SSH agent fails with a lifetime
	if runtime.GOOS == "windows" {
		lifetime = 0
	}

	return errors.Wrap(a.Add(agent.AddedKey{
		PrivateKey:   priv,
		Certificate:  cert,
		Comment:      subject,
		LifetimeSecs: cast.Uint32(lifetime),
	}), "error adding key to agent")
}

```

### Core Architecture Module: `internal/sshutil/agent_unix.go`
```
//go:build aix || darwin || dragonfly || freebsd || linux || netbsd || openbsd || solaris

package sshutil

import (
	"net"
	"os"

	"github.com/pkg/errors"
	"golang.org/x/crypto/ssh/agent"
)

// dialAgent returns an ssh.Agent client. It uses the SSH_AUTH_SOCK to connect
// to the agent.
func dialAgent() (*Agent, error) {
	socket := os.Getenv("SSH_AUTH_SOCK")
	conn, err := net.Dial("unix", socket) // #nosec G704 -- SSH_AUTH_SOCK points to a local Unix domain socket path
	if err != nil {
		return nil, errors.Wrap(err, "error connecting with ssh-agent")
	}
	return &Agent{
		ExtendedAgent: agent.NewClient(conn),
		Conn:          conn,
	}, nil
}

```

### Core Architecture Module: `internal/sshutil/agent_windows.go`
```
package sshutil

import (
	"context"
	"fmt"
	"net"
	"os"

	"github.com/Microsoft/go-winio"
	"github.com/pkg/errors"
	"golang.org/x/crypto/ssh/agent"
)

// dialAgent returns an ssh.Agent client. It uses the SSH_AUTH_SOCK to connect
// to the agent.
func dialAgent() (*Agent, error) {
	// Override the default windows openssh-ssh-agent pipe
	if socket := os.Getenv("SSH_AUTH_SOCK"); socket != "" {
		// Attempt unix sockets for environments like cygwin.
		if conn, err := net.Dial("unix", socket); err == nil { // #nosec G704 -- SSH_AUTH_SOCK points to a local Unix domain socket path
			return &Agent{
				ExtendedAgent: agent.NewClient(conn),
				Conn:          conn,
			}, nil
		}

		// Connect to Windows pipe at the supplied address
		conn, err := winio.DialPipeContext(context.Background(), socket)
		if err != nil {
			return nil, errors.Wrap(err, fmt.Sprintf("failed to connect to SSH agent at SSH_AUTH_SOCK=%s", socket))
		}

		return &Agent{
			ExtendedAgent: agent.NewClient(conn),
			Conn:          conn,
		}, nil
	}

	pipeName := determineWindowsPipeName()
	conn, err := winio.DialPipeContext(context.Background(), pipeName)
	if err != nil {
		return nil, errors.Wrap(err, "error connecting with ssh-agent")
	}

	return &Agent{
		ExtendedAgent: agent.NewClient(conn),
		Conn:          conn,
	}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1601** (2026-03-31): **[Bug]: Cannot sign using cloudkms: since v0.30.1**
  *Symptoms*: ### Steps to Reproduce  I use step-cli 0.29.0 with step-kms-plugin 0.16.1. I can sign certificates like this: ``` step certificate sign   --kms "cloudkms:"  \   --not-after 1h \   example.csr \   intermediate.crt   "projects/..." > example.crt ```  However, if I update step-cli to 0.30.1 (keeping step-kms-plugin 0.16.1) and execute the same command I get this message: ``` Error: cloudkms: does not implement a CertificateManager ```  ### Your Environment  * OS - Linux * `step` CLI Version - 0.30.1  ### Expected Behavior  I should be able to sign the same way as with the previous version.  ### Actual Behavior  I get an error message with the newer version.  ### Additional Context  _No response_  ### Contributing  Vote on this issue by adding a 👍 reaction. To contribute a fix for this issue, leave a comment (and link to your pull request, if you've opened one already). 
  **Post-Mortem & Fix Analysis**:
  > Hi @GBBx, I need to take a closer look at what’s going on. One change introduced in the latest version of step is that the `--kms` flag is no longer required, although it should still be supported. As a fallback, this should work:  ``` step certificate sign hello.csr issuer.crt cloudkms:projects/.../cryptoKeyVersions/1 ```
  > Thank you @maraino , it worked.

- **Issue #1543** (2026-01-09): **[Bug]: Number of architectures built for rpm and deb went from 8 to 2**
  *Symptoms*: When we made this change in Nov 2024 (64865322e16c8fcd24bd1ce4d696cbe048949a00):  ``` --- a/.goreleaser.yml +++ b/.goreleaser.yml @@ -53,11 +53,9 @@ builds:      # - the name of the output binary is step-cli      << : *BUILD      id: nfpm -    goos: -      - linux -    goarch: -      - amd64 -      - arm64 +    targets: +      - linux_amd64 +      - linux_arm64      binary: step-cli ```  After this change, the number of supported architectures for step-cli rpm and deb builds went from 8 to 2.     Before 64865322:   - targets was inherited from &BUILD (all Linux architectures)   - goos/goarch were explicitly set to linux + amd64/arm64   - Since targets takes precedence, GoReleaser used the inherited targets → many architectures    After 64865322:   - targets was explicitly set to linux_amd64, linux_arm64   - This overrides the inherited targets from &BUILD → only 2 architectures  Here's 0.28.0 from our GCS bucket:  <img width="877" height="403" alt="Image" src="https://github.com/user-attachments/assets/64cc31fa-8446-460f-950a-fa6cf1618d31" />  And here's 0.28.2:  <img width="881" height="251" alt="Image" src="https://github.com/user-attachments/assets/31f36537-309e-44db-b349-9703330da34f" />  My [proposed fix](https://github.com/smallstep/cli/pull/1544) is to build rpms and debs for all the same arches that we already build binaries for.

- **Issue #1579** (2026-03-05): **[Bug]: step crypto key format --force asks for confirmation before overwriting files**
  *Symptoms*: ### Steps to Reproduce  Run something like  ``` step crypto key format \     --force \     --ssh \     --out=certs/ssh_user_ca_key.pub \     certs/ssh_user_ca_key.pem ```  ### Your Environment  Docker `smallstep/step-ca:0.29.0-hsm`  ### Expected Behavior  File should be overwritten without asking for confirmation  ### Actual Behavior  Command asks for y/n confirmation  ### Additional Context  _No response_  ### Contributing  Vote on this issue by adding a 👍 reaction. To contribute a fix for this issue, leave a comment (and link to your pull request, if you've opened one already). 

- **Issue #1503** (2025-10-14): **[Bug]: `utils/read.go` `ReadPasswordFromFile` does not support pipes and file descriptors**
  *Symptoms*: ### Steps to Reproduce  Run `step ca init` using a file descriptor as a password file:  ``` step ca init --kms azurekms \ --helm \ --deployment-type=standalone \ --name=Smallstep \                                                                                                                                                                                                                                             --kms-root='azurekms:name=my-root-key;vault=my-kv' \                                                                                                                                                                                                           --kms-intermediate='azurekms:name=my-intermediate-key;vault=my-kv' \ --dns=lima-default \ --dns=localhost \ --dns=127.0.0.1 \ --address=:8443 \ --provisioner=admin \ --provisioner-password-file=<(printf "%s\n" "testpassword123") ```   ### Your Environment  * OS - Linux * `step` CLI Version - Smallstep CLI/0.28.7 (linux/amd64)   ### Expected Behavior   - `step ca init` prints initializes and prints the Helm values.   ### Actual Behavior  - `step ca init` asks for the Provisioner password interactively    ### Additional Context  Perfect! Now I've found the issue. The problem is on **line 62-64** of the jose/generate.go file:  ```go func GenerateDefaultKeyPair(passphrase []byte) (*JSONWebKey, *JSONWebEncryption, error) { 	if len(passphrase) == 0 { 		return nil, nil, errors.New("step-jose: password cannot be empty when e
  **Post-Mortem & Fix Analysis**:
  > The analysis might be a red herring.  Closing for now.  Going to open a new issue for the KMS mode password problem.

- **Issue #1497** (2025-10-12): **[Bug]: Error no certs found when trying to add the caBundle to the client cert pool due to certificate tags not in the certificate text(bundle)**
  *Symptoms*: Also dont know if this in the correct project.. we might need to move this bug ticket.. ### Steps to Reproduce  On mac or linux run step ca init. 1. get the root pem file. 2. https://go.dev/play/p/Di8eQE7Or17 and put the pem file into this golang playground and hit go..  Updates to the bug. I understand what is going on..  If you only put the root cert in the caBundle section, when the client tries to append the cert to the pool it will fail because it is not wrapped in -----BEGIN CERTIFICATE-----   -----END CERTIFICATE-----   This is why i think i am getting no certificate errors.   I am new to all of this smallstep / kubernetes / go.. but i am going to try to do a code a fix. I sort of don't know how i am just now finding this, unless i am doing something wrong.   So i forked the issuer project and iss.Spec.CABundle is actually the cert and not the PEM text.. soo. i dont know where when you apply the yaml file it gets converted to the actual cert binary.. but on the issuer side we need to convert it back over the PEM format in order for the below client code to work.  So the issue is the issuer is not sending down PEM data it is sending down the actual cert. Need to check if there is a different api on the client to call then getTransportFromCABundle api that takes the cert bytes..  this is where it failing..  smallstep go client.go func getTransportFromCABundle(bundle []byte) (http.RoundTripper, error) { 	pool := x509.NewCertPool() 	if !pool.AppendCertsFromPEM(bundle) { 		
  **Post-Mortem & Fix Analysis**:
  > Hi @bradmesserle, the Go playground has a different time: https://go.dev/play/#:~:text=In%20the%20playground%20the%20time,on%20CPU%20and%20memory%20usage.   Anything that relies on a realistic time will this fail.
  > I opened a ticket on the step-issuer code base and committed a code fix :)

- **Issue #1492** (2025-11-12): **[Bug]: Trying to following the mTLS YubiKey tutorial**
  *Symptoms*: ### Steps to Reproduce  I am trying to follow the mTLS Yubikey tutorial and I can run the command before and have it generate a certificate for usage but when i try to use it with my acme device attestation setup i am having an issue where i know the pin is correct but it is giving the following erorr:  step ca certificate --attestation-uri 'yubikey:slot-id=9a' \    --kms 'yubikey:?pin-value=****' \    --provisioner acme-da **** ****.crt ✔ Provisioner: acme-da (ACME) error signing key authorization: command "/Users/dhaanpaa/go/bin/step-kms-plugin sign --format base64 yubikey:slot-id=9a" failed with: Error: verify pin: smart card error 6983: authentication method blocked  ### Your Environment  * OS - OS X 15.7.1 * `step` CLI Version - Smallstep CLI/0.28.7 * Yubikey 5 NFC  ### Expected Behavior  To have a mTLS certficate ready for re importing back to a yubikey  ### Actual Behavior  Unable to get an attested certificate  ### Additional Context  _No response_  ### Contributing  Vote on this issue by adding a 👍 reaction. To contribute a fix for this issue, leave a comment (and link to your pull request, if you've opened one already). 
  **Post-Mortem & Fix Analysis**:
  > Issue occurs with a YubiKey 5.4.3 firmware key
  > ref: https://github.com/FiloSottile/yubikey-agent/issues/132
  > The problem is that you have locked your YubiKey due to pin retries. There seems to be an issue that setting the pin in flag `--kms 'yubikey:?pin-value=****'` doesn't properly work and the pin has to be set in the `--attestation-uri 'yubikey:slot-id=9a?pin-value=****'`  Right now the only option is to reset the YubiKey. After that will need to create a key in the 9a slot:  ``` step kms create yubikey:slot-id=9a?pin-value=*** ```  And you will be able to sign like this: ``` step ca certificate --attestation-uri 'yubikey:slot-id=9a?pin-value=******' --kms 'yubikey:' --provisioner acme-da **** yubikey.crt ```  

- **Issue #1461** (2025-07-28): **[Bug]: `make -w binary-darwin-arm64` results in an amd64 -binary**
  *Symptoms*: ### Steps to Reproduce  1. checkout 2. `make -j8 -w binary-darwin-arm64`  ### Your Environment  * go version `go1.24.5` darwin/arm64 * GNU Make 3.81 * macOS 15.5 (24F74)  ### Expected Behavior  Go should output an arm64 -binary.  ### Actual Behavior  Go outputs an amd64 -binary.  ``` % file output/binary/darwin-arm64/step  step: Mach-O 64-bit executable x86_64 % ./output/binary/darwin-arm64/step zsh: bad CPU type in executable: step ```  ### Additional Context   The `Makefile` references the target here:  https://github.com/smallstep/cli/blob/6bc838deba11fd4c1ffbcc8aaf19aa650ca77418/Makefile#L231   ### Contributing  Vote on this issue by adding a 👍 reaction. To contribute a fix for this issue, leave a comment (and link to your pull request, if you've opened one already). 

- **Issue #1453** (2025-07-21): **[Bug]: Cannot create CSR with capi KMS with P-521 key**
  *Symptoms*: ### Steps to Reproduce  1. `step-kms-plugin create capi:key=test1 --kty EC --crv p-521` 2. `step certificate create --csr --kms capi: --key capi:key=test1 test1 test1.csr ""`  ### Your Environment  * OS - Windows Server 2025 * `step` CLI Version - Smallstep CLI/0.28.6 (windows/amd64)  ### Expected Behavior  `Your certificate signing request has been saved in test1.csr.`  ### Actual Behavior  `error creating certificate request: x509: signature returned by signer is invalid: x509: ECDSA verification failure`.  ### Additional Context  This succeeds with P-256 and P-384.  ### Contributing  Vote on this issue by adding a 👍 reaction. To contribute a fix for this issue, leave a comment (and link to your pull request, if you've opened one already). 

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

### Incident Patch 1: `c512b829` (2026-09-08)
**Commit Message**: Fix typo in kty flag

Co-authored-by: Herman Slatman <[REDACTED_EMAIL]>

**File**: `flags/flags.go` (modified, +3/-3)
```diff
@@ -40,13 +40,13 @@ If unset, default is EC.
     :  Create an **RSA** key pair
 
 	**ML-DSA-44**
-	:  Create a ML-DSA key pair using the **ML-DSA-44** parameter set.
+	:  Create an ML-DSA key pair using the **ML-DSA-44** parameter set.
 
 	**ML-DSA-65**
-	:  Create a ML-DSA key pair using the **ML-DSA-65** parameter set.
+	:  Create an ML-DSA key pair using the **ML-DSA-65** parameter set.
 
 	**ML-DSA-87**
-	:  Create a ML-DSA key pair using the **ML-DSA-87** parameter set.
+	:  Create an ML-DSA key pair using the **ML-DSA-87** parameter set.
 	`,
 	}
 
```

---

### Incident Patch 2: `e76ae138` (2026-09-04)
**Commit Message**: Fix test case

**File**: `internal/sshutil/sshutil_test.go` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ func Test_parseECDSA(t *testing.T) {
 
 		got, err := parseECDSA(b)
 		require.Error(t, err)
-		require.EqualError(t, err, "failed to create key: crypto/ecdh: invalid public key")
+		require.EqualError(t, err, "failed to create key: ecdsa: invalid uncompressed public key")
 		require.Nil(t, got)
 	})
 }
```

---

### Incident Patch 3: `075e8457` (2026-06-11)
**Commit Message**: Fix release workflow leaving permanent draft releases on GitHub (#1652)

The release workflow was creating a GitHub draft release before
goreleaser ran. goreleaser preserves the draft state of releases it
didn't create itself, so every release was left as a permanent draft.

Removes the pre-goreleaser softprops/action-gh-release step entirely
and lets goreleaser own the full lifecycle: create draft, upload
assets, publish. Also renames the job from create_release to
release_metadata (it only computes tag/version metadata now) and
tightens workflow-level permissions from contents:write to
contents:read.

Change-Type: fix
Release-Note: no
Audience: operator
Impact: medium
Breaking: false

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +13/-23)
```diff
@@ -7,7 +7,7 @@ on:
     - 'v*' # Push events to matching v*, i.e. v1.0, v20.15.10
 
 permissions:
-  contents: write
+  contents: read
 
 jobs:
   ci:
@@ -18,10 +18,10 @@ jobs:
     uses: ./.github/workflows/ci.yml
     secrets: inherit
 
-  create_release:
-    name: Create Release
+  release_metadata:
+    name: Release Metadata
     permissions:
-      contents: write
+      contents: read
     needs: ci
     runs-on: ubuntu-latest
     env:
@@ -58,53 +58,43 @@ jobs:
         run: |
           echo "DOCKER_TAGS=${{ env.DOCKER_TAGS }},${{ env.DOCKER_IMAGE }}:latest" >> "${GITHUB_ENV}"
           echo "DOCKER_TAGS_DEBIAN=${{ env.DOCKER_TAGS_DEBIAN }},${{ env.DOCKER_IMAGE }}:${DEBIAN_TAG}" >> "${GITHUB_ENV}"
-      - name: Create Release
-        id: create_release
-        uses: softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda # v3.0.0
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-        with:
-          tag_name: ${{ github.ref_name }}
-          name: Release ${{ github.ref_name }}
-          draft: true
-          prerelease: ${{ steps.is_prerelease.outputs.IS_PRERELEASE }}
 
   goreleaser:
-    needs: create_release
+    needs: release_metadata
     permissions:
       id-token: write
       contents: write
       packages: write
     uses: smallstep/workflows/.github/workflows/goreleaser.yml@main
     with:
       enable-packages-upload: true
-      is-prerelease: ${{ needs.create_release.outputs.is_prerelease == 'true' }}
+      is-prerelease: ${{ needs.release_metadata.outputs.is_prerelease == 'true' }}
     secrets: inherit
 
   build_upload_docker:
     name: Build & Upload Docker Images
-    needs: create_release
+    needs: release_metadata
     permissions:
       id-token: write
       contents: read
     uses: smallstep/workflows/.github/workflows/docker-buildx-push.yml@main
     with:
       platforms: linux/amd64,linux/386,linux/arm,linux/arm64
-      tags: ${{ needs.create_release.outputs.docker_tags }}
+      tags: ${{ needs.release_metadata.outputs.docker_tags }}
       docker_image: smallstep/step-cli
       docker_file: docker/Dockerfile
     secrets: inherit
 
   build_upload_docker_debian:
     name: Build & Upload Docker Images using Debian
-    needs: create_release
+    needs: release_metadata
     permissions:
       id-token: write
       contents: read
     uses: smallstep/workflows/.github/workflows/docker-buildx-push.yml@main
     with:
       platforms: linux/amd64,linux/386,linux/arm,linux/arm64
-      tags: ${{ needs.create_release.outputs.docker_tags_debian }}
+      tags: ${{ needs.release_metadata.outputs.docker_tags_debian }}
       docker_image: smallstep/step-cli
       docker_file: docker/Dockerfile.debian
     secrets: inherit
@@ -116,8 +106,8 @@ jobs:
     permissions:
       contents: read
     runs-on: ubuntu-latest
-    needs: create_release
-    if: needs.create_release.outputs.is_prerelease == 'false'
+    needs: release_metadata
+    if: needs.release_metadata.outputs.is_prerelease == 'false'
     steps:
       - name: Checkout
         uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
@@ -179,7 +169,7 @@ jobs:
 
           mv manifest.json.new manifest.json
 
-          git add . && git commit -a -m "step-cli ${{ needs.create_release.outputs.vversion }} reference update"
+          git add . && git commit -a -m "step-cli ${{ needs.release_metadata.outputs.vversion }} reference update"
       - name: Push changes
         uses: ad-m/github-push-action@881a6320fdb16eb5318c5054f31c218aec2b324c # v1.3.0
         with:
```

---

### Incident Patch 4: `27f49f39` (2026-06-10)
**Commit Message**: Fix release workflow to work with immutable releases setting (#1650)

A repo setting change enabled immutable releases, which prevents
uploading assets to a release once it's published. Creating the
release as a draft here lets goreleaser upload all assets first,
then publish as its final step.

Change-Type: fix
Release-Note: no
Audience: internal
Impact: medium
Breaking: false

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ jobs:
         with:
           tag_name: ${{ github.ref_name }}
           name: Release ${{ github.ref_name }}
-          draft: false
+          draft: true
           prerelease: ${{ steps.is_prerelease.outputs.IS_PRERELEASE }}
 
   goreleaser:
```

---

### Incident Patch 5: `00b371a6` (2026-06-09)
**Commit Message**: Merge pull request #1647 from smallstep/fix/proxycommand-deadlock-1641

Fix proxycommand hang when server closes before stdin closes

**File**: `command/ssh/proxycommand.go` (modified, +15/-9)
```diff
@@ -6,7 +6,6 @@ import (
 	"net"
 	"os"
 	"strings"
-	"sync"
 	"time"
 
 	"github.com/pkg/errors"
@@ -228,6 +227,10 @@ func getBastion(ctx *cli.Context, user, host string) (*api.SSHBastionResponse, e
 }
 
 func proxyDirect(host, port string) error {
+	return proxyDirectWithIO(host, port, os.Stdin, os.Stdout)
+}
+
+func proxyDirectWithIO(host, port string, stdin io.Reader, stdout io.Writer) error {
 	address := net.JoinHostPort(host, port)
 	addr, err := net.ResolveTCPAddr("tcp", address)
 	if err != nil {
@@ -238,22 +241,25 @@ func proxyDirect(host, port string) error {
 	if err != nil {
 		return errors.Wrapf(err, "error connecting to %s", address)
 	}
+	defer conn.Close()
 
-	var wg sync.WaitGroup
-	wg.Add(1)
+	// Return as soon as either direction finishes. Waiting for both can
+	// deadlock when the server closes the connection while stdin stays open.
+	// See smallstep/cli#1641. Buffered so the slower goroutine never blocks
+	// sending after we've stopped receiving.
+	done := make(chan struct{}, 2)
 	go func() {
-		io.Copy(conn, os.Stdin)
+		io.Copy(conn, stdin)
 		conn.CloseWrite()
-		wg.Done()
+		done <- struct{}{}
 	}()
-	wg.Add(1)
 	go func() {
-		io.Copy(os.Stdout, conn)
+		io.Copy(stdout, conn)
 		conn.CloseRead()
-		wg.Done()
+		done <- struct{}{}
 	}()
 
-	wg.Wait()
+	<-done
 	return nil
 }
 
```

**File**: `command/ssh/proxycommand_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package ssh
+
+import (
+	"bytes"
+	"io"
+	"net"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+)
+
+// Test_proxyDirectWithIO_serverClosesBeforeStdin reproduces smallstep/cli#1641:
+// when the server closes the connection before the client has closed stdin, the
+// proxycommand must still return promptly. Previously it would block in
+// wg.Wait() forever because the stdin->conn goroutine stayed blocked reading a
+// stdin that never reaches EOF (the ssh client keeps it open until the
+// proxycommand exits).
+func Test_proxyDirectWithIO_serverClosesBeforeStdin(t *testing.T) {
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer ln.Close()
+
+	// Server sends some data and immediately closes the connection.
+	go func() {
+		conn, err := ln.Accept()
+		if err != nil {
+			return
+		}
+		conn.Write([]byte("hello"))
+		conn.Close()
+	}()
+
+	host, port, err := net.SplitHostPort(ln.Addr().String())
+	require.NoError(t, err)
+
+	// stdin that never reaches EOF, simulating the ssh client keeping the
+	// proxycommand's stdin open for the lifetime of the session.
+	stdinR, stdinW := io.Pipe()
+	defer stdinW.Close() // write end intentionally left open during the call
+
+	var stdout bytes.Buffer
+	done := make(chan error, 1)
+	go func() {
+		done <- proxyDirectWithIO(host, port, stdinR, &stdout)
+	}()
+
+	select {
+	case err := <-done:
+		require.NoError(t, err)
+		require.Equal(t, "hello", stdout.String())
+	case <-time.After(5 * time.Second):
+		t.Fatal("proxyDirectWithIO did not return after the server closed the connection")
+	}
+}
```

---

### Incident Patch 6: `5b50ed3b` (2026-06-09)
**Commit Message**: Fix proxycommand hang when server closes before stdin closes

proxyDirect waited for both copy goroutines via wg.Wait(). When the
server closes the connection mid-session, the stdin->conn goroutine
stays blocked reading a stdin that never reaches EOF (the ssh client
holds the proxycommand's stdin open until it exits), deadlocking until
an OS-level timeout reaps the process.

Return as soon as either direction finishes instead. Extracted a
testable proxyDirectWithIO and added a regression test.

Fixes #1641

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `command/ssh/proxycommand.go` (modified, +15/-9)
```diff
@@ -6,7 +6,6 @@ import (
 	"net"
 	"os"
 	"strings"
-	"sync"
 	"time"
 
 	"github.com/pkg/errors"
@@ -228,6 +227,10 @@ func getBastion(ctx *cli.Context, user, host string) (*api.SSHBastionResponse, e
 }
 
 func proxyDirect(host, port string) error {
+	return proxyDirectWithIO(host, port, os.Stdin, os.Stdout)
+}
+
+func proxyDirectWithIO(host, port string, stdin io.Reader, stdout io.Writer) error {
 	address := net.JoinHostPort(host, port)
 	addr, err := net.ResolveTCPAddr("tcp", address)
 	if err != nil {
@@ -238,22 +241,25 @@ func proxyDirect(host, port string) error {
 	if err != nil {
 		return errors.Wrapf(err, "error connecting to %s", address)
 	}
+	defer conn.Close()
 
-	var wg sync.WaitGroup
-	wg.Add(1)
+	// Return as soon as either direction finishes. Waiting for both can
+	// deadlock when the server closes the connection while stdin stays open.
+	// See smallstep/cli#1641. Buffered so the slower goroutine never blocks
+	// sending after we've stopped receiving.
+	done := make(chan struct{}, 2)
 	go func() {
-		io.Copy(conn, os.Stdin)
+		io.Copy(conn, stdin)
 		conn.CloseWrite()
-		wg.Done()
+		done <- struct{}{}
 	}()
-	wg.Add(1)
 	go func() {
-		io.Copy(os.Stdout, conn)
+		io.Copy(stdout, conn)
 		conn.CloseRead()
-		wg.Done()
+		done <- struct{}{}
 	}()
 
-	wg.Wait()
+	<-done
 	return nil
 }
 
```

**File**: `command/ssh/proxycommand_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package ssh
+
+import (
+	"bytes"
+	"io"
+	"net"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+)
+
+// Test_proxyDirectWithIO_serverClosesBeforeStdin reproduces smallstep/cli#1641:
+// when the server closes the connection before the client has closed stdin, the
+// proxycommand must still return promptly. Previously it would block in
+// wg.Wait() forever because the stdin->conn goroutine stayed blocked reading a
+// stdin that never reaches EOF (the ssh client keeps it open until the
+// proxycommand exits).
+func Test_proxyDirectWithIO_serverClosesBeforeStdin(t *testing.T) {
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer ln.Close()
+
+	// Server sends some data and immediately closes the connection.
+	go func() {
+		conn, err := ln.Accept()
+		if err != nil {
+			return
+		}
+		conn.Write([]byte("hello"))
+		conn.Close()
+	}()
+
+	host, port, err := net.SplitHostPort(ln.Addr().String())
+	require.NoError(t, err)
+
+	// stdin that never reaches EOF, simulating the ssh client keeping the
+	// proxycommand's stdin open for the lifetime of the session.
+	stdinR, stdinW := io.Pipe()
+	defer stdinW.Close() // write end intentionally left open during the call
+
+	var stdout bytes.Buffer
+	done := make(chan error, 1)
+	go func() {
+		done <- proxyDirectWithIO(host, port, stdinR, &stdout)
+	}()
+
+	select {
+	case err := <-done:
+		require.NoError(t, err)
+		require.Equal(t, "hello", stdout.String())
+	case <-time.After(5 * time.Second):
+		t.Fatal("proxyDirectWithIO did not return after the server closed the connection")
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #1714** (2026-10-05): Bump github.com/slackhq/nebula from 1.11.1 to 1.11.2 (@dependabot[bot])
- **PR #1712** (2026-09-25): Release v0.31.0 (@maraino)
- **PR #1711** (2026-09-25): Update changelog for 0.30.4 through 0.31.0 (@maraino)
- **PR #1709** (2026-09-22): Bump go.step.sm/crypto from 0.90.0 to 0.91.0 (@dependabot[bot])
- **PR #1708** (2026-09-21): Bump github.com/fxamacker/cbor/v2 from 2.9.3 to 2.9.4 (@dependabot[bot])
- **PR #1703** (2026-09-18): Bump golang.org/x/crypto from 0.56.0 to 0.57.0 (@dependabot[bot])
- **PR #1702** (closed): Bump golang.org/x/sys from 0.47.0 to 0.48.0 (@dependabot[bot])
- **PR #1701** (closed): Bump google.golang.org/grpc from 1.83.1 to 1.83.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
