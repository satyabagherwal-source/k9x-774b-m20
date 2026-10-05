# Forensic Learning Record (Deep Inspection): Orange-OpenSource/hurl

> **Canonical Artifact**: `07_PROJECT_LEARNING/orange-opensource-hurl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Orange-OpenSource/hurl](https://github.com/Orange-OpenSource/hurl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:47.470Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Orange-OpenSource/hurl`
- **Description**: Hurl, run and test HTTP requests with plain text.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 19229 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/check/license.py`
```
#!/usr/bin/env python3
"""Check Rust direct and transitive dependencies licenses.

This script checks that there is no dependencies with unauthorized license (GPL like).

Examples:
    $ python3 bin/check/license.py
"""

import json
import subprocess
from typing import List, Tuple


def main():
    deps = get_deps()
    check_licenses(deps)


def is_authorized(name: str) -> bool:
    for licence in [
        "MIT",
        "Apache-2.0",
        "Zlib",
        "CC0-1.0",
        "MPL-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "Unicode-3.0",
        "ISC",
    ]:
        if licence in name:
            return True
    return False


def is_forbidden(name: str) -> bool:
    for licence in ["GPL"]:
        if licence in name:
            return True
    return False


def check_licenses(deps: List[Tuple[str, str, str, str]]):
    authorized = []
    forbidden = []
    unknown = []
    for dep in deps:
        lic = dep[3]
        if is_authorized(lic):
            authorized.append(dep)
        elif is_forbidden(lic):
            forbidden.append(dep)
        else:
            unknown.append(dep)
    print("Authorized:")
    for name, repository, version, lic in authorized:
        name_str = f"\x1b[1;34m{name}\x1b[0m"
        lic_str = f"\x1b[1;32m{lic}\x1b[0m"
        print(f"  {name_str} {version} {repository}: {lic_str}")

    print("Forbidden:")
    for name, repository, version, lic in forbidden:
        name_str = f"\x1b[1;34m{name}\x1b[0m"
        lic_str = f"\x1b[1;31m{lic}\x1b[0m"
        print(f"  {name_str} {version} {repository}: {lic_str}")

    print("Unknown:")
    for name, repository, version, lic in unknown:
        name_str = f"\x1b[1;34m{name}\x1b[0m"
        lic_str = f"\x1b[1;33m{lic}\x1b[0m"
        print(f"  {name_str} {version} {repository}: {lic_str}")

    if len(forbidden) > 0:
        print("There are forbidden licenses")
        exit(1)

    if len(unknown) > 0:
        print("There are unknown licenses")
        exit(2)


def get_deps() -> List[Tuple[str, str, str, str]]:
    """Returns a list of crates name and licenses"""
    p = subprocess.run(
        [
            "cargo",
            "metadata",
            "--format-version",
            "1",
        ],
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        print("Error calling cargo metadata")
        exit(1)
    data = json.loads(p.stdout)
    packages = data["packages"]
    licenses = [
        (p["name"], p["repository"], p["version"], p["license"]) for p in packages
    ]
    return licenses


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/check/rust_version.py`
```
#!/usr/bin/env python3
import argparse
import datetime
import json
import os
import sys

import requests


def get_latest_release(token: str | None) -> None | tuple[str, datetime]:
    """Returns the latest Rust release available."""
    url = "https://api.github.com/repos/rust-lang/rust/releases"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        sys.stderr.write(f"Error GET {url} {r.status_code}\n")
        sys.stderr.write(f"{r.text}\n")
        return None

    releases = json.loads(r.text)
    latest_release = releases[0]
    version = latest_release["tag_name"]
    date_str = latest_release["published_at"]
    date = datetime.datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%SZ")
    return version, date


def get_current_version() -> str:
    """Returns the current Rust version used by the project."""
    return os.popen("cargo --version").read().split(" ")[1]


def main():
    parser = argparse.ArgumentParser(
        description="Check if Hurl uses the latest Rust version"
    )
    parser.add_argument(
        "num_days_before_error",
        type=int,
        metavar="NUM_DAYS_BEFORE_ERROR",
        help="Interval in days before raising an error if Hurl is not using latest Rust",
    )
    parser.add_argument("--token", help="GitHub authentication token")
    args = parser.parse_args()

    num_days_before_error = args.num_days_before_error
    token = args.token

    ret = get_latest_release(token=token)
    if not ret:
        sys.exit(2)

    latest_version, date = ret
    current_version = get_current_version()
    if current_version < latest_version:
        sys.stderr.write(
            f"Rust version must be updated from {current_version} to the latest version {latest_version}\n"
        )
        days_before_now = datetime.datetime.now() - date
        if days_before_now > datetime.timedelta(days=num_days_before_error):
            sys.exit(1)
    else:
        sys.stderr.write(f"Latest Rust version: {latest_version}\n")
        sys.stderr.write(f"Hurl Rust version:   {current_version}\n")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/coverage_uncovered_lines.py`
```
#!/usr/bin/env python3
import sys

from bs4 import BeautifulSoup

COVERAGE_DIR = "target/coverage"


def uncovered_lines(src_file):
    html_file = COVERAGE_DIR + "/" + src_file + ".html"
    sys.stderr.write(html_file + "\n")
    html = open(html_file).read()
    soup = BeautifulSoup(html, "html.parser")
    elements = soup.select('div[role="row"]')
    lines = []
    for element in elements:
        line = parse_row(element)
        if line is not None:
            lines.append(line)
    return lines


def parse_row(element):
    uncovered = element.select(".has-background-danger-light")
    if len(uncovered) > 0:
        line_number = element.select("div:first-child")[0]["id"]
        line = uncovered[0].select("pre")[0].text
        return line_number, line
    return None


def main():
    sys.stderr.write("Extracting uncovered lines\n")
    for src_file in sys.argv[1:]:
        lines = uncovered_lines(src_file)
        if len(lines) > 0:
            print(src_file)
            for line_number, line in lines:
                print("%s %s" % (line_number, line))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/release/changelog_extract.py`
```
#!/usr/bin/env python3
# bin/release/changelog_extract.py 1.8.0
import sys


def extract(changelog_file, version):
    print_line = False
    for line in open(changelog_file).readlines():
        if "CHANGELOG" in line and line.startswith("["):
            if line[1:].startswith(version):
                print_line = True
            else:
                print_line = False
        if print_line:
            print(line.rstrip())


def main():
    if len(sys.argv) < 2:
        print("usage:")
        print("  bin/release/changelog_extract.py 1.8.0")
        sys.exit(1)

    version = sys.argv[1]
    extract("CHANGELOG.md", version)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/release/get_release_note.py`
```
#!/usr/bin/env python3
"""Create Release note from GitHub Issues and Pull Requests for a given version

Example:
    $ python3 bin/release/get_release_note.py 1.7.0

"""

import argparse
import datetime
import json
import sys
from typing import List, Optional

import requests

hurl_repo_url = "https://github.com/Orange-OpenSource/hurl"


class Pull:
    def __init__(
        self,
        url: str,
        description: str,
        author: str,
        tags: Optional[List[str]] = None,
        issues: Optional[List[int]] = None,
    ):
        if tags is None:
            tags = []
        if issues is None:
            issues = []
        self.url = url
        self.description = description
        self.author = author
        self.tags = tags
        self.issues = issues

    def __repr__(self):
        return 'Pull("%s", "%s", "%s", "%s", %s)' % (
            self.url,
            self.description,
            self.author,
            str(self.tags),
            str(self.issues),
        )

    def __eq__(self, other):
        """Overrides the default implementation"""
        if isinstance(other, Pull):
            if self.url != other.url:
                return False
            if self.description != other.description:
                return False
            if self.author != other.author:
                return False
            if self.tags != other.tags:
                return False
            if self.issues != other.issues:
                return False
            return True
        return False


class Issue:
    def __init__(self, number: int, tags: List[str], author: str, pulls: List[Pull]):
        self.number = number
        self.tags = tags
        self.author = author
        self.pulls = pulls

    def __repr__(self):
        return (
            'Issue(\n    number=%s,\n    tag=["%s"],\n    author="%s",\n    pulls=[%s]\n)'
            % (
                self.number,
                ",".join(['"%s"' % t for t in self.tags]),
                self.author,
                ",".join([str(p) for p in self.pulls]),
            )
        )


def release_note(milestone: str, token: Optional[str]) -> str:
    """return markdown release note for the given milestone"""
    date = datetime.datetime.now()

    query = """\
query {
    repository(owner:"Orange-OpenSource", name:"hurl") {
        milestones(query:"MILESTONE", first:1) {
            edges {
                node {
                    issues(last:100, states:CLOSED) {
                        edges {
                            node {
                                title
                                number
                                url
                                author {
                                    login
                                }
                                closedByPullRequestsReferences(includeClosedPrs:true, first:5) {
                                    edges {
                                        node {
                                            title
                                            url
                                            author {
                                                login
                                            }
                                        }
                                    }
                                }
                                labels(first:5) {
                                    edges {
                                        node {
                                            name
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
"""
    query = query.replace("MILESTONE", milestone)
    payload = github_graphql(token=token, query=query)
    response = json.loads(payload)
    issues_dict = response["data"]["repository"]["milestones"]["edges"][0]["node"][
        "issues"
    ]["edges"]
    issues = []
    for issue_dict in issues_dict:
        number = issue_dict["node"]["number"]
        author_issue = issue_dict["node"]["author"]["login"]
        tags_dict = issue_dict["node"]["labels"]["edges"]
        tags = [t["node"]["name"] for t in tags_dict]

        pulls = []
        pulls_dict = issue_dict["node"]["closedByPullRequestsReferences"]["edges"]
        for pull_dict in pulls_dict:
            title = pull_dict["node"]["title"]
            url = pull_dict["node"]["url"]
            author_pull = pull_dict["node"]["author"]["login"]
            pull = Pull(description=title, url=url, author=author_pull)
            pulls.append(pull)

        issue = Issue(number=number, tags=tags, author=author_issue, pulls=pulls)
        issues.append(issue)

    pulls = pulls_from_issues(issues)
    authors = [
        author
        for author in authors_from_issues(issues)
        if author not in ["jcamiel", "lepapareil", "fabricereix"]
    ]
    return generate_md(milestone, date, pulls, authors)


def pulls_from_issues(issues: List[Issue]) -> List[Pull]:
    """return list of pulls from list of issues"""
    pulls: dict[str, Pull] = {}
    for issue in issues:
        for pull in issue.pulls:
            if pull.url in pulls:
                saved_pull = pulls[pull.url]
                for tag in issue.tags:
                    if tag not in saved_pull.tags:
                        saved_pull.tags.append(tag)
                saved_pull.issues.append(issue.number)
            else:
                if pull.url.startswith("https://github.com/Orange-OpenSource/hurl"):
                    pull.tags = issue.tags
                    pull.issues.append(issue.number)
                    pulls[pull.url] = pull

    return list(pulls.values())


def authors_from_issues(issues: List[Issue]) -> List[str]:
    """return list of unique authors from a list of issues"""
    authors = []
    for issue in issues:
        if issue.author not in authors:
            authors.append(issue.author)
        for pull in issue.pulls:
            if pull.author not in authors:
                authors.append(pull.author)
    return authors


def generate_md(
    milestone: str, date: datetime.datetime, pulls: List[Pull], authors: List[str]
) -> str:
    """Generate Markdown"""

    s = "[%s (%s)](%s)" % (
        milestone,
        date.strftime("%Y-%m-%d"),
        hurl_repo_url + "/blob/master/CHANGELOG.md#" + milestone,
    )
    s += "\n========================================================================================================================"
    s += "\n\nThanks to"
    for author in authors:
        s += "\n[@%s](https://github.com/%s)," % (author, author)

    categories = {
        "breaking": "Breaking Changes",
        "enhancement": "Enhancements",
        "bug": "Bugs Fixed",
        "security": "Security Issues Fixed",
        "deprecation": "Deprecations",
    }

    for category in categories:
        category_pulls = [pull for pull in pulls if category in pull.tags]
        if len(category_pulls) > 0:
            s += "\n\n" + categories[category] + ":" + "\n\n"
        for pull in category_pulls:
            issues = " ".join(
                "[#%s](%s/issues/%s)" % (issue, hurl_repo_url, issue)
                for issue in pull.issues
            )
            s += "* %s %s\n" % (pull.description, issues)

    s += "\n"
    return s


def github_graphql(token: Optional[str], query: str) -> str:
    """Execute a GraphQL query using GitHub API."""
    url = "https://api.github.com/graphql"
    query_json = {"query": query}
    body = json.dumps(query_json)
    sys.stderr.write("* POST %s\n" % url)
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.post(url, data=body, headers=headers)
    if r.status_code != 200:
        raise Exception("HTTP Error %s - %s" % (r.status_code, r.text))
    return r.text


def main():
    parser = argparse
```

### Core Architecture Module: `bin/update_crates.py`
```
#!/usr/bin/env python3
import argparse
import datetime as dt
import re
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path

import requests as req
import tomllib


class Color(StrEnum):
    """Helper enum to print ANSI escape codes."""

    GREY = "\033[0;37m"
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    RESET = "\033[0m"


class Crate:
    """A Rust crate: a compilation unit"""

    name: str
    version: str
    latest_version: str | None
    repository: str | None
    owner_repo: str | None
    updated_at: datetime | None

    def __init__(self, name: str, version: str):
        self.name = name
        self.version = version
        self.latest_version = None
        self.repository = None
        self.owner_repo = None
        self.updated_at = None

    def __str__(self):
        return f"Crate name={self.name} version={self.version}"

    def fetch_info(self) -> bool:
        """Update crate's repository and owner repo from <crates.io>"""
        self.repository = None
        self.owner_repo = None
        self.updated_at = None
        self.latest_version = None
        crate_url = f"https://crates.io/api/v1/crates/{self.name}"
        headers = {"User-Agent": "Contact: https://github.com/Orange-OpenSource/hurl"}
        crate_object = req.get(url=crate_url, headers=headers)
        if crate_object.status_code != 200:
            return False
        crate = crate_object.json()["crate"]
        self.repository = crate["repository"]
        self.updated_at = dt.datetime.fromisoformat(crate["updated_at"])
        self.latest_version = crate["max_stable_version"]
        if self.repository and self.repository.startswith("https://github.com/"):
            self.owner_repo = self.repository.removeprefix("https://github.com/")
        return True

    def get_release_body(self, version: str, token: str) -> str | None:
        """Get the release body for a given version"""
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        tags = req.get(
            url=f"https://api.github.com/repos/{self.owner_repo}/git/refs/tags",
            headers=headers,
        )
        if tags.status_code != 200:
            return None
        tag_version = next((tag for tag in tags.json() if version in tag["ref"]), None)
        if not tag_version:
            return None
        tag_name = tag_version["ref"].removeprefix("refs/tags/")
        release = req.get(
            url=f"https://api.github.com/repos/{self.owner_repo}/releases/tags/{tag_name}",
            headers=headers,
        )
        if release.status_code != 200:
            return None
        return release.json().get("body", None)


@dataclass
class CrateUpdate:
    """Represents a crate update."""

    crate: Crate
    old_version: str
    new_version: str


@dataclass
class CargoLockUpdate:
    """Represents a update to a `Cargo.lock` file"""

    added: list[Crate]
    removed: list[Crate]
    updated: list[CrateUpdate]


class CargoLock:
    """Represents a `Cargo.lock` file"""

    lock_file: Path
    packages: list[Crate]

    def __init__(self, lock_file: Path):
        self.lock_file = lock_file
        self.packages = []
        with open(lock_file, "rb") as f:
            data = tomllib.load(f)
            for package in data["package"]:
                package = Crate(name=package["name"], version=package["version"])
                self.packages.append(package)

    def update(self) -> CargoLockUpdate:
        """Updates this lock file and return a `CargoLockUpdate` instance"""
        subprocess.run(["cargo", "update"], check=True, capture_output=True)
        updated_lock = CargoLock(lock_file=self.lock_file)
        current_pkgs = {c.name: c for c in self.packages}
        updated_pkgs = {c.name: c for c in updated_lock.packages}

        # Computes the package diffs
        added = []
        updated = []
        removed = []
        for name, crate in updated_pkgs.items():
            if crate.name not in current_pkgs:
                added.append(crate)
            elif crate.version != current_pkgs[crate.name].version:
                update = CrateUpdate(
                    crate=crate,
                    old_version=current_pkgs[crate.name].version,
                    new_version=crate.version,
                )
                updated.append(update)
        for name, crate in current_pkgs.items():
            if name not in updated_pkgs:
                removed.append(crate)

        # Update the self instance
        self.packages = updated_lock.packages
        return CargoLockUpdate(added=added, removed=removed, updated=updated)


class LocalCrate:
    """A local Rust crate"""

    toml_file: Path
    dependencies: list[Crate]

    def __init__(self, toml_file: Path):
        self.toml_file = toml_file
        self.dependencies = []
        with open(self.toml_file, "rb") as f:
            data = tomllib.load(f)
            self.collect_dependencies(node=data)

    def collect_dependencies(self, node):
        """Walk the toml metadata and collect dependencies"""
        if isinstance(node, dict):
            for key, value in node.items():
                if key not in {"dependencies", "build-dependencies"}:
                    self.collect_dependencies(node=value)
                    continue
                for dependency, version in value.items():
                    if isinstance(version, dict):
                        # Ignore local dependencies
                        if version.get("path"):
                            continue
                        version = version["version"]
                    self.dependencies.append(Crate(name=dependency, version=version))
        elif isinstance(node, list):
            for i, item in enumerate(node):
                self.collect_dependencies(node=item)

    def update_dependency(self, crate: Crate, actual_version: str, latest_version: str):
        """Update the dependency of this crate in its toml file."""
        toml = self.toml_file.read_text()
        name = crate.name
        escaped_name = re.escape(name)
        escaped_actual_version = re.escape(actual_version)
        toml = re.sub(
            rf'^{escaped_name}.*=.*{{.*version.*=.*"{escaped_actual_version}"',
            f'{name} = {{ version = "{latest_version}"',
            toml,
            count=0,
            flags=re.MULTILINE,
        )
        toml = re.sub(
            rf'^{escaped_name}.*=.*"{escaped_actual_version}"',
            f'{name} = "{latest_version}"',
            toml,
            count=0,
            flags=re.MULTILINE,
        )
        self.toml_file.write_text(toml)

    def __str__(self):
        return f"LocalCrate toml_file={self.toml_file}"


def print_release_note(crate: Crate, version: str, token: str):
    """Prints a crate release, for a given version"""
    note = f"<{crate.repository}>\n\n"
    release_body = crate.get_release_body(version=version, token=token)
    if release_body:
        note += f"~~~\n{release_body}\n~~~\n"
    note = textwrap.indent(note, "    ")
    print(f"\n{note}")


def semver(version: str) -> bool:
    """Returns a semver string without metadata part"""
    index = version.find("+")
    if index != -1:
        return version[:index]
    else:
        return version


def update_local_crates(
    local_crates: list[LocalCrate], cooldown_days: int, check: bool, token: str | None
):
    """Updates a list of local crates and returns the number of update crates"""
    # now = datetime.now(dt.timezone.utc)
    updated_count = 0

    # Update direct dependencies if any major, minor, update changes (this can bring some breaking changes)
    for local_crate in local_crates:
        print("\n--------------------------------------------------------")
     
```

### Core Architecture Module: `contrib/npm/check_publish.py`
```
#!/usr/bin/env python3
"""
Examples:
    $ python3 contrib/npm/check_archive.py 1.6.1
"""

import hashlib
import json
import sys
from pathlib import Path
from urllib import request


def bold(text: str) -> str:
    return f"\x1b[1m{text}\x1b[0m"


def bold_blue(text: str) -> str:
    return f"\x1b[1;34m{text}\x1b[0m"


def bold_green(text: str) -> str:
    return f"\x1b[1;32m{text}\x1b[0m"


def bold_red(text: str) -> str:
    return f"\x1b[1;31m{text}\x1b[0m"


def check_archive(hurl_version: str, package_version: str):
    print(bold_blue("Checking archives:"))
    path = Path("contrib/npm/hurl/platform.json")
    platforms = json.loads(path.read_text())

    for platform in platforms:
        target = platform["rust_target"]
        extension = platform["archive_extension"]
        expected_checksum = platform["checksum"]
        url = f"https://github.com/Orange-OpenSource/hurl/releases/download/{hurl_version}/hurl-{hurl_version}-{target}{extension}"
        print(f"  Downloading: {bold(url)}")
        with request.urlopen(url) as response:
            if response.status != 200:
                print(bold_red("  Checksum KO"))
                sys.exit(1)
            body = response.read()

        m = hashlib.sha256()
        m.update(body)
        actual_checksum = m.hexdigest()
        print(f"  Checksum:    {bold(actual_checksum)}")

        if actual_checksum != expected_checksum:
            print(
                bold_red(
                    f"  Checksum KO, please update {target} checksum in contrib/npm/hurl/platform.json"
                )
            )
            sys.exit(1)
        else:
            print(bold_green("  Checksum OK"))
        print()


def check_version(hurl_version: str, package_version: str):
    print(bold_blue("Checking version:"))
    path = Path("contrib/npm/hurl/package.json")
    package = json.loads(path.read_text())
    expected_hurl_version = hurl_version
    actual_hurl_version = package["hurlBinaryVersion"]
    expected_package_version = package_version
    actual_package_version = package["version"]

    if actual_hurl_version != expected_hurl_version:
        print(
            bold_red(
                f"  Hurl version KO actual={actual_hurl_version} expected={expected_hurl_version}, please update "
                f"hurlBinaryVersion in contrib/npm/hurl/package.json"
            )
        )
        sys.exit(1)
    else:
        print(bold_green("  Hurl version OK"))

    if actual_package_version != expected_package_version:
        print(
            bold_red(
                f"  Package version KO actual={actual_package_version} expected={expected_package_version}, please update "
                f"version in contrib/npm/hurl/package.json"
            )
        )
        sys.exit(1)
    else:
        print(bold_green("  Package version OK"))


def check_manual(hurl_version: str, package_version: str):
    print(bold_blue("Checking manual:"))
    print()
    pass


def main(hurl_version: str, package_version):
    check_version(hurl_version, package_version)
    check_manual(hurl_version, package_version)
    check_archive(hurl_version, package_version)

    print(bold("Everything looks OK!"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

```

### Core Architecture Module: `contrib/npm/hurl/archive.js`
```
/*
 * Hurl (https://hurl.dev)
 * Copyright (C) 2024 Orange
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require('stream');
const tar = require("tar");
const extract = require("extract-zip");


/**
 * Install executables in a folder.
 * @param url url of a tar archive (or zip archive on Windows) containing executable
 * @param dir installation folder
 * @param checksum SHA256 checksum of the archive
 */
function install(url, dir, checksum) {
    console.log(`Downloading release from ${url} to ${dir}`);

    // Install a fresh bin directory.
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, {recursive: true});
    }
    fs.mkdirSync(dir, {recursive: true});

    fetch(url)
        .then(res => {
            if (!res.ok) {
                console.error(`Error fetching release ${url}: ${res.statusText}`);
                process.exit(1);
            }

            // Check archive extension.
            const isWindows = url.endsWith(".zip");
            const isUnixLike = url.endsWith(".tar.gz");
            if (!isWindows && !isUnixLike) {
                console.error("Error: unsupported archive type");
                process.exit(1);
            }

            const archive = isWindows ? "archive.zip" : "archive.tar.gz";
            const archivePath = path.join(dir, archive);
            const fileStream = fs.createWriteStream(archivePath);
            const readable = Readable.fromWeb(res.body);

            return new Promise((resolve, reject) => {
                readable.pipe(fileStream)
                    .on("finish", () => {
                        try {
                            verifyCheckSumSync(archivePath, checksum);
                        } catch (e) {
                            return reject(e);
                        }

                        const extractor = isWindows
                            ? extract(archivePath, { dir })
                            : tar.x({ strip: 1, C: dir, file: archivePath });

                        extractor.then(resolve).catch(reject);
                    })
                    .on("error", reject);
            });
        })
        .then(() => {
            console.log(`Archive has been installed to ${dir}!`);
        })
        .catch(e => {
            console.error(`Installation failed: ${e.message}`);
            process.exit(1);
        });
}

/**
 * Exits process with error if the SHA256 checksum of file is not equal to the expected checksum.
 * @param file input file
 * @param expectedChecksum expected checksum
 */
function verifyCheckSumSync(file, expectedChecksum) {
    const checksum = sha256(file);
    if (expectedChecksum !== checksum) {
        console.error(`Downloaded archive checksum didn't match the expected checksum (actual: ${checksum}, expected ${expectedChecksum}`);
        process.exit(1);
    }
}

/**
 * Returns the SHA256 checksum of a file.
 * @param file input file
 * @returns checksum as a string of hex digits
 */
function sha256(file) {
    const data = fs.readFileSync(file);
    return crypto.createHash("sha256").update(data).digest("hex").toLowerCase();
}


exports.install = install;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5207** (2026-09-14): **Publishing `hurl` crate breaks Windows builds: build script references `../../bin/windows/logo.ico`, which is outside the crate and not shipped to crates.io**
  *Symptoms*: ### What is the current *bug* behavior?  Building the `hurl` crate (and by extension `hurl_core`) as a dependency **from crates.io** fails on Windows. The `hurl` build script tries to compile a Windows resource that embeds `../../bin/windows/logo.ico`, but that icon lives at the workspace root, outside the `packages/hurl` crate directory, so it is **not included in the published crate**. The build script then panics because `rc.exe` cannot find the file:      error RC2135 : file not found: ../../bin/windows/logo.ico      thread 'main' panicked at build.rs:29:19:     called `Result::unwrap()` on an `Err` value: Custom { kind: Other, error: "Could not compile resource file" }  Using a `git` dependency works only because a git checkout brings the whole repo, so `../../bin/windows/logo.ico` resolves. The published crate has no such file, so it cannot build on Windows.  Note: this icon only sets the resource icon on the Windows `hurl.exe`. It is irrelevant to library consumers, yet it hard-fails their builds.  ### Steps to reproduce  1. On a Windows machine with the MSVC toolchain (so `rc.exe` from the Windows SDK is used). 2. Create a new Rust project: `cargo new repro && cd repro`. 3. Add the crates.io dependencies to `Cargo.toml`:        [dependencies]        hurl = "8.0.1"        hurl_core = "8.0.1" 4. Run `cargo build`. 5. The build fails while running the custom build command for `hurl v8.0.1` with `RC2135 : file not found: ../../bin/windows/logo.ico` and the `build.rs` pani
  **Post-Mortem & Fix Analysis**:
  > Hi @brenordv thanks fort the issue.We're going to make the icon optionnal (option 1 of your proposal), in the next Hurl version
  > > Hi [@brenordv](https://github.com/brenordv) thanks fort the issue.We're going to make the icon optionnal (option 1 of your proposal), in the next Hurl version  Thank you, @jcamiel! I really appreciate the help!  

- **Issue #5141** (2026-08-06): **Hurl debug curl command are not valid when request binary body contains NUL (\x00) char**
  *Symptoms*: Given this Hurl file:  ```hurl POST http://localhost:8000/post-bytes-null Content-Type: application/octet-stream base64,AAECAw==;  # printf '\x00\x01\x02\x03' | base64 HTTP 200 ```  The request body sent is `\x00\x01\x02\x03` but the curl command produced by Hurl (with `--verbose` or `--curl`) is:  ```shell $ curl --header 'Content-Type: application/octet-stream' --data $'\x00\x01\x02\x03' 'http://localhost:8000/post-bytes-null' ```  Because of the way of bash treats NUL-C terminated string, this does not work.  In this case (and only in this case), we could print the following curl command:  ```shell $ printf '\x00\x01\x02\x03' | curl --header 'Content-Type: application/octet-stream' --data-binary @- 'http://localhost:8000/post-bytes-null' ```       

- **Issue #5094** (2026-06-16): **npm package depending on vulnerable tar version CVE-2026-53655**
  *Symptoms*: https://github.com/advisories/GHSA-vmf3-w455-68vh  https://github.com/Orange-OpenSource/hurl/blob/1e1eb773078cfe95027394f0bb7c34973d480364/contrib/npm/hurl/package.json#L27
  **Post-Mortem & Fix Analysis**:
  > Ho @WestonThayer  Fixed with the 8.0.2 version: <https://www.npmjs.com/package/@orangeopensource/hurl/v/8.0.2> Thanks!  

- **Issue #5091** (2026-06-19): **Incorrect recorded headers when connecting to proxy with CONNECT**
  *Symptoms*: Given this curl call:  ```shell $ curl --verbose --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem https://127.0.0.1:8002/hello  ```   The HTTP headers sequences is:  ``` > CONNECT 127.0.0.1:8002 HTTP/1.1 > Host: 127.0.0.1:8002 > User-Agent: curl/8.7.1 > Proxy-Connection: Keep-Alive >  < HTTP/1.1 200 Connection established <  > GET /hello HTTP/1.1 > Host: 127.0.0.1:8002 > User-Agent: curl/8.7.1 > Accept: */* > < HTTP/1.1 200 OK < Server: Werkzeug/3.1.8 Python/3.14.0 < Date: Sat, 13 Jun 2026 15:13:25 GMT < Content-Type: text/html; charset=utf-8 < Content-Length: 12 < Connection: close <  ```  With Hurl, request headers are not well recorded:  ```shell $ echo "GET https://127.0.0.1:8002/hello" | hurl --verbosity brief --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem > CONNECT 127.0.0.1:8002 HTTP/1.1 > Host: 127.0.0.1:8002 > Proxy-Connection: Keep-Alive > > GET /hello HTTP/1.1 > Host: 127.0.0.1:8002 > Proxy-Connection: Keep-Alive > Host: 127.0.0.1:8002 > Accept: */* > User-Agent: hurl/8.1.0 > < HTTP/1.1 200 OK < Server: Werkzeug/3.1.8 Python/3.14.0 < Date: Sat, 13 Jun 2026 15:15:58 GMT < Content-Type: text/html; charset=utf-8 < Content-Length: 12 < Connection: close < Hello World! ```  And:  ```shell $ echo "GET https://127.0.0.1:8002/hello" | hurl --verbosity brief --proxy http://127.0.0.1:3128 --cacert tests_ssl/certs/server/cert.pem --json | jq '.entries[0].calls[0].request.headers' | pbcopy [   {     "name": "Host",     "value": "12

- **Issue #5028** (2026-06-24): **Accept options variables like `111xxx` or `truexxx`**
  *Symptoms*: Some Options variables  are rejected while being "usual":  ```hurl GET http://localhost:8000 [Options] variable: foo=aa11 variable: bar=11aa ```  ``` $ hurl /tmp/test.hurl error: Parsing literal   --> /tmp/test.hurl:4:17    |  4 | variable: bar=11aa    |                 ^ expecting 'line_terminator'    | ```  And   ```hurl GET http://localhost:8000 [Options] variable: foo=true_is_true ```  ``` $ hurl /tmp/test.hurl error: Parsing literal   --> /tmp/test.hurl:3:19    |  3 | variable: foo=true_is_true    |                   ^ expecting 'line_terminator'    |  ```  
  **Post-Mortem & Fix Analysis**:
  > @fabricereix I think it's reasonable that these two Hurl snippets work (without quoting the variable value to force the string type)

- **Issue #5007** (2026-05-04): **IPv4 integration test is failing with libcurl 8.20.0**
  *Symptoms*: Integration integration/hurl/tests_failed/ipv4/ipv4.sh is failing with libcurl 8.20.0 (see our ArchLinux tests).  A local IPv6 only server is listening and using `--ipv4` should fail.  A mail has been seen on libcurl mailing list for feedbacks => <https://curl.se/mail/lib-2026-05/0000.html>  Waiting for an anlysis, we disable this test.  

- **Issue #4995** (2026-04-28): **jsonpath functions don't support underscores**
  *Symptoms*: ### What is the current *bug* behavior? Fields with an underscore are rejected in jsonpath functions. `@.foo_bar` generates an error, which can be worked around with `@['foo_bar']`  ### Steps to reproduce Using this JSON response: ```json {   "foo_bar": "a",   "items": [     {       "foo": "b",       "foo_bar": "c"     }   ] } ```  with these asserts: ```hurl [Asserts] jsonpath "$.foo_bar" == "a"  # OK jsonpath "$.items[?(@.foo == 'b')]" exists  # OK jsonpath "$.items[?search(@.foo, 'b')].foo" == "b"  # OK jsonpath "$.items[?(@.foo_bar == 'c')]" exists  # FAILS jsonpath "$.items[?search(@.foo_bar, 'c')].foo_bar" == "c"  # FAILS ```  generates this error: ``` JSONPath expression '$.items[?search(@.foo_bar, 'c')].foo_bar' is not valid ```  ### What is the expected *correct* behavior? If I'm reading the RFC correctly, it should be allowed.  ### Execution context  - Hurl Version (`hurl --version`): ``` hurl 8.0.0 (x86_64-apple-darwin24.0) libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.64.0 Features (libcurl):  alt-svc AsynchDNS HSTS HTTP2 IPv6 Largefile libz NTLM SPNEGO SSL UnixSockets Features (built-in): brotli ```  ### Possible fixes  I think the issue is in: https://github.com/Orange-OpenSource/hurl/blob/9743695283efb8b15bead06b86aaf077d7280d25/packages/hurl/src/jsonpath/parser/singular_query.rs#L86-L90  since `is_alphanumeric` does not include `_`
  **Post-Mortem & Fix Analysis**:
  > Thanks @verigak for reporting the bug. We will release a `8.0.1` to include the fix.
  > @verigak  The new release is out! 
  > Thanks, that was fast!

- **Issue #4993** (2026-09-11): **`count` filter report errors for valid `jsonpath` requests (as per RFC 9535) which used to work in `v7.*.*`**
  *Symptoms*: ### What is the current *bug* behavior?  `count` filter report errors for valid `jsonpath` requests:  ``` {"success":true,"users":[{"name":"guest","roles":null},{"name":"root","roles":["admin"]}]}   error: Filter error   --> .../acl_users.hurl:17:50    |    | GET http://localhost:5080/api/v1/users    | ... 17 | jsonpath "$.users[?(@.name == 'root')].roles[*]" count == 1    |                                                  ^^^^^ invalid filter input type    |                                                           actual:   string    |                                                           expected: list, bytes or nodeset    |  error: Filter error   --> .../acl_users.hurl:19:51    |    | GET http://localhost:5080/api/v1/users    | ... 19 | jsonpath "$.users[?(@.name == 'guest')].roles[*]" count == 0    |                                                   ^^^^^ missing value to apply filter    | ```  ### Steps to reproduce  ``` GET http://localhost:5080/api/v1/users Authorization: Bearer {{admin_token}} HTTP 200 [Asserts] jsonpath "$.success" == true jsonpath "$.users" count == 2 jsonpath "$.users[*].name" contains "root" jsonpath "$.users[*].name" contains "guest" jsonpath "$.users[?(@.name == 'root')].roles[*]" count == 1 jsonpath "$..users[?(@.name == 'root')].roles[*]" contains "admin" jsonpath "$.users[?(@.name == 'guest')].roles[*]" count == 0 ```  Have the endpoint return the following JSON:  ``` {"success":true,"users":[{"name":"guest","roles":null},{"name":"root",
  **Post-Mortem & Fix Analysis**:
  > Hi @linkdd   Unfortunately the 8.0.0 comes with breaking changes (more information why we've done this here => <http://hurl.dev/blog/2026/04/27/announcing-hurl-8.0.0.html#brand-new-jsonpath-rfc-9535-support>). In particular, in order to minimise the breaking changes with all the existing Hurl files and also be coherent with other Hurl queries, we have make some changes to how results are processed:  - empty array in jsonpath.com → None value in Hurl 8.0.0     `jsonpath "$.store.book[5].title" not exists` - single-element array in jsonpath.com → the element itself in Hurl 8.0.0     `jsonpath "$.store.book[1].title" == "Sword of Honour"` - multiple elements in jsonpath.com → the full array of elements in Hurl 8.0.0     `jsonpath "$.store.book[0,2]" count == 2`  In your case the query `jsonpath "$.users[?(@.name == 'root')].roles[*]" count == 1` is OK in Hurl 7.0.0 but it's returing only one element in Hurl 8.0.0 (not a list of one element any more):  Before:  ``` jsonpath "$.users[?(@.na
  > So, how do I assert that an endpoint returns : - an empty array and not null - an array with 1 element, not 2, not 0  An API wrongly returning null instead of an empty array would pass the test `not exists`. Same for an API wrongly returning a string instead of an array of 1 string, it would pass the test `exists`, and an API returning an array with more than 1 string would also pass the test `exists`.
  > Hi @linkdd  If I retake your JSON response with an additional user who has an empty array value for the role ``` {     "success": true,     "users": [         {             "name": "root",             "roles": [ "admin" ]         },         {             "name": "guest",             "roles": null         },         {             "name": "bob",             "roles": []         }     ] } ```  The JSONpath expressions can be simplified without using the `[*]` part. ``` jsonpath "$.users[?(@.name == 'root')].roles" count == 1 jsonpath "$.users[?(@.name == 'root')].roles" nth 0 == "admin" jsonpath "$.users[?(@.name == 'guest')].roles" == null jsonpath "$.users[?(@.name == 'bob')].roles" count == 0   ```     

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

### Incident Patch 1: `a9403df6` (2026-09-23)
**Commit Message**: Fix credentials leaking using --header and following redirection.

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect.hurl` (modified, +28/-0)
```diff
@@ -74,6 +74,20 @@ header "Location" not exists
 `Followed redirect without Authorization nor Cookie header!`
 
 
+# Yet another way to express headers with `[Options]` section.
+GET http://localhost:8000/follow-redirect-basic-auth?change_host=true
+[Options]
+header: Authorization:Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=
+header: Cookie:fruit=lemon
+HTTP 200
+[Asserts]
+redirects count == 1
+redirects nth 0 location == "http://127.0.0.1:8000/followed-redirect-basic-auth"
+url == "http://127.0.0.1:8000/followed-redirect-basic-auth"
+header "Location" not exists
+`Followed redirect without Authorization nor Cookie header!`
+
+
 # Same has previous but the host doesn't change during redirection.
 # Back checks will insure that `Authorization` and `Cookie` header are forwarded.
 GET http://localhost:8000/follow-redirect-basic-auth?change_host=false
@@ -102,6 +116,20 @@ header "Location" not exists
 `Followed redirect with Authorization and Cookie header!`
 
 
+# Yet another way to express headers with `[Options]` section.
+GET http://localhost:8000/follow-redirect-basic-auth?change_host=false
+[Options]
+header: Authorization:Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=
+header: Cookie:fruit=lemon
+HTTP 200
+[Asserts]
+redirects count == 1
+redirects nth 0 location == "http://localhost:8000/followed-redirect-basic-auth"
+url == "http://localhost:8000/followed-redirect-basic-auth"
+header "Location" not exists
+`Followed redirect with Authorization and Cookie header!`
+
+
 # Another kinds of user authentication with `--user` in `[Options]` section:
 GET http://localhost:8000/follow-redirect-basic-auth?change_host=true
 [Options]
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.curl` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+curl --header 'Authorization: Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=' --header 'Cookie: fruit=lemon' --location 'http://localhost:8000/follow-redirect-leak/host-a-step-1'
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.hurl` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+GET http://localhost:8000/follow-redirect-leak/host-a-step-1
+HTTP 200
+[Asserts]
+redirects count == 2
+redirects nth 0 location == "http://127.0.0.1:8000/follow-redirect-leak/host-b-step-2"
+redirects nth 1 location == "http://localhost:8000/follow-redirect-leak/host-a-step-3"
+url == "http://localhost:8000/follow-redirect-leak/host-a-step-3"
+header "Location" not exists
+`Followed redirect!`
+
+
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.out` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Followed redirect!
\ No newline at end of file
```

**File**: `integration/hurl/tests_ok/follow_redirect/follow_redirect_leak.ps1` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Set-StrictMode -Version latest
+$ErrorActionPreference = 'Stop'
+
+hurl --location `
+  --header 'Authorization: Basic Ym9iQGVtYWlsLmNvbTpzZWNyZXQ=' `
+  --header 'Cookie: fruit=lemon' `
+  tests_ok/follow_redirect/follow_redirect_leak.hurl
```

---

### Incident Patch 2: `e2840637` (2026-09-25)
**Commit Message**: Fix hurl.dev ssl integration test.

**File**: `integration/hurl/tests_ssl/keepalive.hurl` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ HTTP 200
 [Asserts]
 header "Connection" not exists
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
 
@@ -25,7 +25,7 @@ GET https://hurl.dev
 HTTP 200
 [Asserts]
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
 
```

**File**: `integration/hurl/tests_ssl/letsencrypt.hurl` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ GET https://hurl.dev
 HTTP 200
 [Asserts]
 certificate "Subject" replace " = " "=" replace ";" ", " == "CN=hurl.dev"
-certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=YR2$"
+certificate "Issuer"  replace " = " "=" replace ";" ", " matches "^C=US, O=Let's Encrypt, CN=.*$"
 certificate "Expire-Date" isDate
 certificate "Expire-Date" daysAfterNow > 15
 certificate "Serial-Number" matches /^([\da-f]{2}:){17}[\da-f]{2}$/
```

---

### Incident Patch 3: `8c77755d` (2026-09-14)
**Commit Message**: Fix micro typo in semantique JSON spec.

**File**: `docs/spec/runner/assert_json_body.md` (modified, +16/-13)
```diff
@@ -108,12 +108,12 @@ We will use this expected JSON below:
  
 Expected value
    
-   24    "age": 22
+    24    "age": 22
 
 
 Actual Value
 
-        "age": 20
+    "age": 20
 
 
 Explicit jsonpath assert error
@@ -135,8 +135,12 @@ Explicit jsonpath assert error
 
 
     23 |   "is_alive": true,
-       |    ^^^^^^^^  Missing expected key $.is_alive 
+       |    ^^^^^^^^ missing expected key <is_alive> at $.is_alive 
        
+> We output the name of the key rendered because the source code can be templatized:
+> 
+>     23 |   "{{some_key}}": true,
+>        |    ^^^^^^^^ missing expected key <is_alive> at $.is_alive
 
 Explicit jsonpath assert error
 
@@ -150,7 +154,7 @@ Explicit jsonpath assert error
     20 |  {
        |  ...
     47 |  }
-       |  ^ Unexpected actual key <country> at $.country
+       |  ^ unexpected actual key <country> at $.country
 
 
 The line number matches the line for which it could be added in the source Hurl file.
@@ -174,7 +178,8 @@ Expected array
     45      ]
 
 Actual array
-           "children": [
+
+        "children": [
               "Thomas",
               "Trevor"
            ]
@@ -196,8 +201,6 @@ Explicit jsonpath assert error
         |
 
 
-
-
 ### case 5 - mismatch value in array of objects
 
 
@@ -264,9 +267,9 @@ Actual array
 Assert JSON Body Error
 
     44  |    "Trevor" 
-        |    ^^^^^^^^ Missing expected array element at $.children[2] 
-        |  actual: nothing
-        |  expected string <Trevor>
+        |    ^^^^^^^^ missing expected array element at $.children[2] 
+        |  actual:   nothing
+        |  expected: string <Trevor>
 
 
 Explicit jsonpath assert error
@@ -289,19 +292,19 @@ Expected array
     45      ]
 
 Actual array
+
            "children": [
               "Catherine",
               "Thomas",
               "Trevor",
               "Bob"
            ]
 
-
 Assert JSON Body Error
 
     45 |   ]
        |   ^ unexpected actual array element at $.children[3]
-       |  actual:  string <Bob>   
+       |  actual:   string <Bob>   
        |  expected: nothing
 
 
@@ -318,7 +321,7 @@ Explicit jsonpath assert error
  
 Expected value
    
-   24    "age": 22
+    24    "age": 22
 
 
 Actual Value
```

---

### Incident Patch 4: `02a95808` (2026-09-09)
**Commit Message**: Fix symlinks escaping file root.

**File**: `integration/hurl/tests_failed/fileroot/fileroot.err` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:3:9
+   |
+   | GET http://localhost:8000/fileroot-ko
+   | ...
+ 3 | output: authorized.bin
+   |         ^^^^^^^^^^^^^^ unauthorized access to file authorized.bin, check --file-root option
+   |
+
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:8:6
+   |
+   | POST http://localhost:8000/fileroot-ko
+ 8 | file,authorized.bin;
+   |      ^^^^^^^^^^^^^^ unauthorized access to file authorized.bin, check --file-root option
+   |
+
+error: Unauthorized file access
+  --> tests_failed/fileroot/fileroot.hurl:14:9
+   |
+   | GET http://localhost:8000/fileroot-ko
+   | ...
+14 | output: authorized_dir/output.bin
+   |         ^^^^^^^^^^^^^^^^^^^^^^^^^ unauthorized access to file authorized_dir/output.bin, check --file-root option
+   |
+
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.exit` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+3
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.hurl` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+GET http://localhost:8000/fileroot-ko
+[Options]
+output: authorized.bin
+HTTP 200
+
+
+POST http://localhost:8000/fileroot-ko
+file,authorized.bin;
+HTTP 200
+
+
+GET http://localhost:8000/fileroot-ko
+[Options]
+output: authorized_dir/output.bin
+HTTP 200
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.ps1` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+Set-StrictMode -Version latest
+$ErrorActionPreference = 'Stop'
+
+# We test that a symlink cannot access outside the file-root (directory containing the Hurl file by default)
+# Symlinks can be a file, or a directory containing a file that doesn't exist yet.
+
+$unauthorized = Join-Path $env:TEMP 'unauthorized.bin'
+$unauthorizedDir = Join-Path $env:TEMP 'unauthorized_dir'
+Remove-Item -Path $unauthorizedDir -Recurse -Force -ErrorAction SilentlyContinue
+New-Item -Path $unauthorized -Force -ItemType File | Out-Null
+New-Item -Path $unauthorizedDir -Force -ItemType Directory | Out-Null
+New-Item -Path tests_failed/fileroot/authorized.bin -Force -ItemType SymbolicLink -Target $unauthorized | Out-Null
+New-Item -Path tests_failed/fileroot/authorized_dir -Force -ItemType SymbolicLink -Target $unauthorizedDir | Out-Null
+hurl --continue-on-error tests_failed/fileroot/fileroot.hurl
```

**File**: `integration/hurl/tests_failed/fileroot/fileroot.py` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+from app import app
+
+
+@app.route("/fileroot-ko", methods=["GET", "POST"])
+def fileroot_ko():
+    return "Error!"
```

---

### Incident Patch 5: `0f1b49b7` (2026-09-09)
**Commit Message**: Fix output_type configuration.

**File**: `packages/hurl/src/cli/options/args.rs` (modified, +1/-1)
```diff
@@ -797,7 +797,7 @@ fn output(arg_matches: &ArgMatches, default_value: Option<Output>) -> Option<Out
 fn output_type(arg_matches: &ArgMatches, default_value: OutputType) -> OutputType {
     if has_flag(arg_matches, "json") {
         OutputType::Json
-    } else if has_flag(arg_matches, "no_output") || has_flag(arg_matches, "test") {
+    } else if has_flag(arg_matches, "no_output") {
         OutputType::NoOutput
     } else {
         default_value
```

**File**: `packages/hurl/src/cli/options/env_vars.rs` (modified, +0/-2)
```diff
@@ -651,8 +651,6 @@ fn no_jsonpath_coercion(env_vars: &EnvVars, default_value: bool) -> bool {
 fn output_type(env_vars: &EnvVars, default_value: OutputType) -> OutputType {
     if let Some(true) = env_vars.no_output() {
         OutputType::NoOutput
-    } else if let Some(true) = env_vars.test() {
-        OutputType::NoOutput
     } else {
         default_value
     }
```

**File**: `packages/hurl/src/cli/options/mod.rs` (modified, +8/-1)
```diff
@@ -289,6 +289,13 @@ fn resolve_implicit(context: &RunContext, default_options: CliOptions) -> CliOpt
     if let BoolOpt::Auto = options.parallel {
         options.parallel = BoolOpt::Set(options.test);
     }
+    // No output for test mode
+    if let OutputType::ResponseBody = options.output_type
+        && options.test
+    {
+        options.output_type = OutputType::NoOutput;
+    }
+
     // If stdout is not a terminal, disable prettifying
     if let PrettyMode::Automatic = options.pretty
         && !context.is_stdout_term()
@@ -765,7 +772,7 @@ mod tests {
         assert!(opts.test);
         assert!(opts.progress_bar.get());
         assert!(opts.parallel.get());
-        //assert_eq!(opts.output_type, OutputType::NoOutput);
+        assert_eq!(opts.output_type, OutputType::NoOutput);
     }
 
     #[test]
```

---

### Incident Patch 6: `0e427288` (2026-09-03)
**Commit Message**: Fix integration test for cookie value on curl 8.22 due to <https://github.com/curl/curl/pull/22730>

curl 8.22 changes cookie managment for PSL. A cookie that set Domain=localhost for request on localhost becomes host only. So in curl 8.22, such a request changes a cookie from subdomain to host only.

**File**: `integration/hurl/tests_ok/captures/captures_to_json.out.pattern` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"cookies":[{"domain":".localhost","expires":<<<\d+>>>,"https":false,"include_subdomain":true,"name":"foo","path":"/bar","value":"value1"}],"entries":[{"asserts":[{"line":2,"success":true},{"line":2,"success":true},{"line":12,"success":true},{"line":13,"success":true},{"line":14,"success":true},{"line":15,"success":true},{"line":16,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[],"url":"http://localhost:8000/captures"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"12"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Header1","value":"value1"},{"name":"Header2","value":"Hello Bob!"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"},{"name":"param3","value":"Bob"},{"name":"data1","value":"Hello world!"},{"name":"data2","value":"Hello world!"}],"curl_cmd":"curl 'http://localhost:8000/captures'","index":1,"line":1,"time":<<<\d+>>>},{"asserts":[{"line":23,"success":true},{"line":23,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"}],"url":"http://localhost:8000/captures-check?param1=value1&param2=Bob"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"0"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[],"curl_cmd":"curl 'http://localhost:8000/captures-check?param1=value1&param2=Bob'","index":2,"line":19,"time":<<<\d+>>>},{"asserts":[{"line":30,"success":true},{"line":30,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[{"name":"param1","value":"value1"},{"name":"param2","value":"Bob"}],"url":"http://localhost:8000/captures-check?param1=value1&param2=Bob"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"0"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"name":"Server","value":"Flask Server"},{"name":"Via","value":"waitress"}],"http_version":"HTTP/1.1","status":200},"timings":{"app_connect":<<<\d+>>>,"begin_call":"<<<.*?>>>","connect":<<<\d+>>>,"end_call":"<<<.*?>>>","name_lookup":<<<\d+>>>,"pre_transfer":<<<\d+>>>,"start_transfer":<<<\d+>>>,"total":<<<\d+>>>}}],"captures":[],"curl_cmd":"curl 'http://localhost:8000/captures-check?param1=value1&param2=Bob'","index":3,"line":26,"time":<<<\d+>>>},{"asserts":[{"line":34,"success":true},{"line":34,"success":true},{"line":38,"success":true}],"calls":[{"request":{"cookies":[],"headers":[{"name":"Host","value":"localhost:8000"},{"name":"Accept","value":"*/*"},{"name":"User-Agent","value":"hurl/<<<.*?>>>"}],"method":"GET","query_string":[],"url":"http://localhost:8000/captures-xml"},"response":{"cookies":[],"headers":[{"name":"Content-Length","value":"166"},{"name":"Content-Type","value":"text/html; charset=utf-8"},{"name":"Date","value":"<<<.*?>>>"},{"n
```

**File**: `integration/hurl/tests_ok/captures/captures_verbose.err.pattern` (modified, +2/-2)
```diff
@@ -92,7 +92,7 @@
 [1;34m*[0m [1mExecuting entry 4[0m
 [1;34m*[0m
 [1;34m*[0m [1mCookie store:[0m
-[1;34m*[0m #HttpOnly_.localhost	TRUE	/bar	FALSE	<<<\d+>>>	foo	value1
+[1;34m*[0m #HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/bar	FALSE	<<<\d+>>>	foo	value1
 [1;34m*[0m
 [1;34m*[0m [1mRequest:[0m
 [1;34m*[0m GET http://localhost:8000/captures-json
@@ -136,7 +136,7 @@
 [1;34m*[0m location: true
 [1;34m*[0m
 [1;34m*[0m [1mCookie store:[0m
-[1;34m*[0m #HttpOnly_.localhost	TRUE	/bar	FALSE	<<<\d+>>>	foo	value1
+[1;34m*[0m #HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/bar	FALSE	<<<\d+>>>	foo	value1
 [1;34m*[0m
 [1;34m*[0m [1mRequest:[0m
 [1;34m*[0m GET http://localhost:8000/redirect-to-captures-json
```

**File**: `integration/hurl/tests_ok/cookie/cookie_jar.out.pattern` (modified, +3/-3)
```diff
@@ -3,6 +3,6 @@
 
 # Cookies for file <tests_ok/cookie/cookie_jar.hurl>
 #HttpOnly_localhost	FALSE	/accounts	FALSE	<<<(18\d{8}|3409338181)>>>	LSID	DQAAAKEaem_vYg
-#HttpOnly_.localhost	TRUE	/	FALSE	<<<(18\d{8}|3409338181)>>>	HSID	AYQEVnDKrdst
-#HttpOnly_.localhost	TRUE	/	FALSE	<<<(18\d{8}|3409338181)>>>	SSID	Ap4PGTEq
-.localhost	TRUE	/	FALSE	<<<(18\d{8}|3093675001)>>>	foo	"a b c"
+#HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3409338181)>>>	HSID	AYQEVnDKrdst
+#HttpOnly_<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3409338181)>>>	SSID	Ap4PGTEq
+<<<\.?>>>localhost	<<<(TRUE|FALSE)>>>	/	FALSE	<<<(18\d{8}|3093675001)>>>	foo	"a b c"
```

---

### Incident Patch 7: `9572cc7c` (2026-09-02)
**Commit Message**: Fix CodeQL access on invalid pointer warnings.

**File**: `packages/hurl/src/http/easy_ext.rs` (modified, +10/-9)
```diff
@@ -65,10 +65,14 @@ pub fn cert_info(easy: &Easy) -> Result<Option<CertInfo>, Error> {
         let Some(certinfo) = certinfo.as_ref() else {
             return Ok(None);
         };
-        if certinfo.num_of_certs <= 0 || certinfo.certinfo.is_null() {
+        if certinfo.num_of_certs <= 0 {
             return Ok(None);
         }
-        let slist = *certinfo.certinfo;
+        // `certinfo.certinfo` is a list of `num_of_certs` certificates, we read the first one,
+        // `as_ref` returning `None` when the array is null.
+        let Some(&slist) = certinfo.certinfo.as_ref() else {
+            return Ok(None);
+        };
         let data = to_list(slist);
         let value = extract_pem_from_certinfo(&data);
 
@@ -221,15 +225,12 @@ pub fn netrc_file(easy: &mut Easy, filename: &str) -> Result<(), Error> {
 fn to_list(slist: *mut curl_slist) -> Vec<String> {
     let mut data = vec![];
     let mut cur = slist;
-    loop {
-        if cur.is_null() {
-            break;
-        }
-        unsafe {
-            let ret = CStr::from_ptr((*cur).data).to_bytes();
+    unsafe {
+        while let Some(node) = cur.as_ref() {
+            let ret = CStr::from_ptr(node.data).to_bytes();
             let value = String::from_utf8_lossy(ret);
             data.push(value.to_string());
-            cur = (*cur).next;
+            cur = node.next;
         }
     }
     data
```

---

### Incident Patch 8: `6ed01cf9` (2026-08-31)
**Commit Message**: Minor typo fix to test the CodeQL config file.

**File**: `art/branding.md` (modified, +1/-1)
```diff
@@ -11,4 +11,4 @@
 
 - pink: #ff0288
 - logo text (light mode): #333333
-- logo text (dark mode): #dedede
\ No newline at end of file
+- logo text (dark mode): #dedede
```

---

### Incident Patch 9: `1eb9d621` (2026-08-25)
**Commit Message**: Fix XSS: HTML escape all debug tables values (headers, captures etc...)

**File**: `integration/hurl/tests_failed/html_report_injection/html_report_injection.err.pattern` (modified, +1/-1)
```diff
@@ -34,4 +34,4 @@ error: Assert body value
    | ^^^^^^^^^^^^^ actual value is <<script>alert('Hi')</script>>
    |
 
-* Writing HTML report to build/injection/report
+* Writing HTML report to build/tests_failed_injection/report
```

**File**: `integration/hurl/tests_failed/html_report_injection/html_report_injection.ps1` (modified, +8/-4)
```diff
@@ -1,16 +1,20 @@
 Set-StrictMode -Version latest
 $ErrorActionPreference = 'Stop'
 
-if (Test-Path -Path build/injection/report) {
-    Remove-Item -Recurse -Force build/injection/report
+if (Test-Path -Path build/tests_failed_injection/report) {
+    Remove-Item -Recurse -Force build/tests_failed_injection/report
 }
 
 
 # We test a Hurl file that triggers a runtime error and want to check that any HTML files
 # in the report has a plain "<script>" tag.
 $ErrorActionPreference = 'Continue'
-hurl --verbose --report-html build/injection/report tests_failed/html_report_injection/html_report_injection.hurl
+hurl --verbose --report-html build/tests_failed_injection/report tests_failed/html_report_injection/html_report_injection.hurl
 
-Select-String -Path build/injection/report/store -Pattern "<script>"
+$files = @(Get-ChildItem -File -Recurse build/tests_failed_injection/report/store)
+
+foreach ($file in $files) {
+    Get-Content $file | Select-String -CaseSensitive "<script>"
+}
 
 exit 1
```

**File**: `integration/hurl/tests_failed/html_report_injection/html_report_injection.sh` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
 #!/bin/bash
 set -Eeuo pipefail
 
-rm -rf build/injection/report
+rm -rf build/tests_failed_injection/report
 
 # We test a Hurl file that triggers a runtime error and want to check that any HTML files
 # in the report has a plain "<script>" tag.
 set +eo pipefail
-hurl --verbose --report-html build/injection/report tests_failed/html_report_injection/html_report_injection.hurl
+hurl --verbose --report-html build/tests_failed_injection/report tests_failed/html_report_injection/html_report_injection.hurl
 
-grep -r '<script>' build/injection/report/store
+grep -r '<script>' build/tests_failed_injection/report/store
 
 exit 1
```

**File**: `integration/hurl/tests_ok/html_report_injection/html_report_injection.hurl` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+GET http://localhost:8000/evil-headers
+X-Bar: <script>alert('Hello')</script>
+HTTP 200
```

**File**: `integration/hurl/tests_ok/html_report_injection/html_report_injection.out` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Hello world!
\ No newline at end of file
```

---

### Incident Patch 10: `d946d46a` (2026-08-25)
**Commit Message**: Fix libcurl-8.18 downgrade on Windows vcpkg

**File**: `bin/install_prerequisites_windows.ps1` (modified, +7/-7)
```diff
@@ -4,7 +4,7 @@ $ErrorActionPreference = 'Stop'
 write-host -foregroundcolor Cyan "----- install system prerequisites -----"
 
 # install python 3.11
-choco install --confirm python311
+choco install --confirm --no-progress python311
 if ($LASTEXITCODE) { Throw }
 
 # install proxy
@@ -36,23 +36,23 @@ Get-Process -Name 'squid' -ErrorAction SilentlyContinue | Stop-Process -Force
 
 # install jq
 echo "==== install jq"
-choco install --confirm jq
+choco install --confirm --no-progress jq
 if ($LASTEXITCODE) { Throw }
 
 # update vcpkg install
 $vcpkg_dir=((Get-command vcpkg).Source | Split-Path)
 $lib_dir="$vcpkg_dir\installed\x64-windows\bin"
+git -C $vcpkg_dir pull
 & "$vcpkg_dir\bootstrap-vcpkg.bat"
+vcpkg upgrade --no-dry-run
+if ($LASTEXITCODE) { Throw }
 # Downgrade to 8.19.0 => https://github.com/Orange-OpenSource/hurl/issues/5105
-git -C $vcpkg_dir checkout 4f326c4072038c8624c36a8ba5ed23f616adda53
+git -C "$vcpkg_dir" restore --source=4f326c4072038c8624c36a8ba5ed23f616adda53 --worktree ports/curl
+git -C "$vcpkg_dir" restore --source=4f326c4072038c8624c36a8ba5ed23f616adda53 --worktree ports/zlib
 
 # install libxml and libcurl
 vcpkg install --recurse curl[core,sspi,http2,non-http,ssl]:x64-windows
 vcpkg install --recurse libxml2[core,iconv]:x64-windows
 
-vcpkg update
-if ($LASTEXITCODE) { Throw }
-vcpkg upgrade --no-dry-run
-if ($LASTEXITCODE) { Throw }
 vcpkg integrate install
 if ($LASTEXITCODE) { Throw }
```

#### Recent Merged Pull Requests:
- **PR #5312** (2026-09-26): Update crates (@hurl-bot)
- **PR #5311** (2026-09-25): Fix credentials leaking using --header and following redirection. (@jcamiel)
- **PR #5309** (2026-09-25): Fix hurl.dev ssl integration test. (@jcamiel)
- **PR #5308** (2026-09-25): Update crates (@hurl-bot)
- **PR #5307** (2026-09-21): Update actions (@hurl-bot)
- **PR #5306** (2026-09-21): Update crates (@hurl-bot)
- **PR #5305** (2026-09-19): Update crates (@hurl-bot)
- **PR #5303** (2026-09-18): Update crates (@hurl-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
