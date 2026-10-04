# Forensic Learning Record (Deep Inspection): import-ai/omnibox

> **Canonical Artifact**: `07_PROJECT_LEARNING/import-ai-omnibox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/import-ai/omnibox](https://github.com/import-ai/omnibox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:28:13.899Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `import-ai/omnibox`
- **Description**: Anywhere, anything to memory, memory to anything.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1514 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/env_variable_diff.py`
```
#!/usr/bin/env python3
import re
import sys


def load_env_vars(env_path):
    env_vars = set()
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            m = re.match(r'^([A-Za-z_][A-Za-z0-9_]+)\s*=', line)
            if m:
                env_vars.add(m.group(1))
    return env_vars


def load_docker_compose_vars(compose_path):
    compose_vars = set()
    with open(compose_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Match ${VAR} or ${VAR:-default}
            matches = re.findall(r'\${([A-Za-z_][A-Za-z0-9_]*)(?::-?[^}]*)?}', line)
            # Match $VAR but $$VAR excluded
            matches += [m for m in re.findall(r'\$(\w+)', line) if not line.strip().startswith('$$')]
            compose_vars.update(matches)
    return compose_vars


def load_vars_from_file(file_path):
    if file_path.endswith('.env'):
        return load_env_vars(file_path)
    if file_path.endswith('.yml') or file_path.endswith('.yaml'):
        return load_docker_compose_vars(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_path}.")


def main():
    if len(sys.argv) != 3:
        print(f"Usage: python3 {sys.argv[0]} <first_file> <second_file>")
        sys.exit(1)
    first_vars = load_vars_from_file(sys.argv[1])
    second_vars = load_vars_from_file(sys.argv[2])
    first_only = sorted(first_vars - second_vars)
    second_only = sorted(second_vars - first_vars)
    if first_only or second_only:
        if first_only:
            print(f"Variables only in {sys.argv[1]}:")
            for var in first_only:
                print(var)
        if first_only and second_only:
            print()
        if second_only:
            print(f"Variables only in {sys.argv[2]}:")
            for var in second_only:
                print(var)
    else:
        print("No differences found.")

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `scripts/minio_migrator.py`
```
#!/usr/bin/env python3

"""
MinIO Migration Script

This script migrates objects from one MinIO bucket to another, with support for:
- Moving objects between different MinIO instances
- Moving or copying objects (with --move flag)
- Preserving all object metadata (content type, custom headers, etc.)
- Dry run mode to preview changes
- Automatic bucket creation if destination doesn't exist
- Organizing objects into folders based on filename length

Usage examples:
1. Copy between buckets on same instance:
   python minio_migrate.py --source-access-key KEY1 --source-secret-key SECRET1 --source-bucket old --dest-bucket new

2. Move between different MinIO instances:
   python minio_migrate.py --source-host host1:9000 --source-access-key KEY1 --source-secret-key SECRET1 \
                          --dest-host host2:9000 --dest-access-key KEY2 --dest-secret-key SECRET2 \
                          --source-bucket old --dest-bucket new --move

3. Dry run to preview changes:
   python minio_migrate.py --source-access-key KEY --source-secret-key SECRET --dry-run
"""

from minio import Minio
from minio.error import S3Error
from argparse import ArgumentParser, Namespace
from io import BytesIO


def get_args() -> Namespace:
    parser = ArgumentParser(description="Migrate objects from one Minio bucket to another")
    
    # Source MinIO instance
    parser.add_argument("--source-host", default="localhost:9000", help="Source Minio server address")
    parser.add_argument("--source-secure", action='store_true', help="Use HTTPS for source Minio server")
    parser.add_argument("--source-access-key", required=True, help="Source Minio access key")
    parser.add_argument("--source-secret-key", required=True, help="Source Minio secret key")
    parser.add_argument("--source-bucket", default="default", help="Source bucket name")
    
    # Destination MinIO instance
    parser.add_argument("--dest-host", help="Destination Minio server address (defaults to source host)")
    parser.add_argument("--dest-secure", action='store_true', help="Use HTTPS for destination Minio server")
    parser.add_argument("--dest-access-key", help="Destination Minio access key (defaults to source key)")
    parser.add_argument("--dest-secret-key", help="Destination Minio secret key (defaults to source key)")
    parser.add_argument("--dest-bucket", default="newbucket", help="Destination bucket name")
    
    # Migration options
    parser.add_argument("--move", action='store_true', help="Move objects (delete from source after copy)")
    parser.add_argument("--dry-run", action='store_true', help="Show what would be done without actually doing it")
    
    return parser.parse_args()


def main():
    args = get_args()
    
    # Set defaults for destination if not provided
    dest_host = args.dest_host or args.source_host
    dest_access_key = args.dest_access_key or args.source_access_key
    dest_secret_key = args.dest_secret_key or args.source_secret_key
    
    # Create source MinIO client
    source_client = Minio(
        args.source_host,
        access_key=args.source_access_key,
        secret_key=args.source_secret_key,
        secure=args.source_secure,
    )
    
    # Create destination MinIO client
    dest_client = Minio(
        dest_host,
        access_key=dest_access_key,
        secret_key=dest_secret_key,
        secure=args.dest_secure,
    )

    source_bucket = args.source_bucket
    dest_bucket = args.dest_bucket

    # Check if destination bucket exists
    dest_exists = dest_client.bucket_exists(dest_bucket)
    print(f"Destination bucket '{dest_bucket}' exists: {dest_exists}")
    
    if not dest_exists:
        if args.dry_run:
            print(f"[DRY RUN] Would create destination bucket '{dest_bucket}'")
        else:
            dest_client.make_bucket(dest_bucket)
            print(f"Created destination bucket '{dest_bucket}'")

    # Check if source bucket exists
    if not source_client.bucket_exists(source_bucket):
        print(f"Error: Source bucket '{source_bucket}' does not exist")
        return

    objects = source_client.list_objects(source_bucket, prefix="", recursive=False)
    total_objects = 0
    copied_objects = 0
    failed_objects = 0
    
    for obj in objects:
        total_objects += 1
        name = obj.object_name
        if name is None:
            print("Warning: Object name is None, skipping.")
            failed_objects += 1
            continue
            
        if '/' in name:  # skip files already in folders
            print(f"Skipping {name} (already in a folder)")
            continue
            
        # Decide target folder inside dest_bucket
        if len(name) == 16:
            target = f"resources/{name}"
        else:
            target = f"attachments/{name}"
            
        try:
            if args.dry_run:
                # Get object metadata for dry run info
                obj_stat = source_client.stat_object(source_bucket, name)
                metadata_count = len(obj_stat.metadata) if obj_stat.metadata else 0
                metadata_info = f" (preserving {metadata_count} metadata fields)" if metadata_count > 0 else " (no metadata)"
                
                print(f"[DRY RUN] Would copy {name} to {dest_bucket}/{target}{metadata_info}")
                if args.move:
                    print(f"[DRY RUN] Would delete {name} from {source_bucket}")
            else:
                # Get object metadata first
                obj_stat = source_client.stat_object(source_bucket, name)
                
                # Get object from source
                response = source_client.get_object(source_bucket, name)
                
                # Read the data from response
                data = response.read()
                response.close()
                
                # Preserve all metadata - convert to proper format for MinIO
                metadata = None
                if obj_stat.metadata:
                    # Convert metadata to the format expected by MinIO
                    metadata = {}
                    if hasattr(obj_stat.metadata, 'items'):
                        for key, value in obj_stat.metadata.items():
                            # Ensure values are in the correct format (str, List[str], or Tuple[str])
                            if isinstance(value, (list, tuple)):
                                metadata[key] = value
                            else:
                                metadata[key] = str(value)
                    elif isinstance(obj_stat.metadata, dict):
                        for key, value in obj_stat.metadata.items():
                            if isinstance(value, (list, tuple)):
                                metadata[key] = value
                            else:
                                metadata[key] = str(value)
                
                content_type = obj_stat.content_type or 'application/octet-stream'
                
                # Upload to destination with preserved metadata
                put_args = {
                    'bucket_name': dest_bucket,
                    'object_name': target,
                    'data': BytesIO(data),
                    'length': len(data),
                    'content_type': content_type
                }
                if metadata:
                    put_args['metadata'] = metadata
                
                dest_client.put_object(**put_args)
                
                # Log what was copied with metadata info
                metadata_info = f" (with {len(metadata)} metadata fields)" if metadata else " (no metadata)"
                print(f"Copied {name} to {dest_bucket}/{target}{metadata_info}")
                copied_objects += 1
                
                # If move operation, delete from source
                if args.move:
                    source_client.remove_object(source_bucket, name)
                    print(f"Deleted {name} from {source_bucket}")
                    
        except S3Error as err:
            print(f"Error processing {name}: {err}")
            failed_objects += 1
        except Exception as err:
            print(f"Unexpected error processing {name}: {err}")
            failed_objects += 1
    
    # Print summary
    print(f"\nMigration summary:")
    print(f"Total objects processed: {total_objects}")
    if not args.dry_run:
        print(f"Successfully copied: {copied_objects}")
        print(f"Failed: {failed_objects}")
        if args.move:
            print(f"Operation: MOVE (objects deleted from source)")
        else:
            print(f"Operation: COPY (objects remain in source)")
    else:
        print("DRY RUN - No actual changes made")


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #157** (2026-09-23): **chore: bump service images to v0.1.51**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.51 - update web/backend/wizard submodule pointers to v0.1.51  ## Validation - git diff --check - docker compose config skipped: Docker unavailable  ## Submodules - web e37227fc506a85b4d573a21545c5e03482ce0771 - backend 06402a3cc8ecd983f5f7e7aa417fb15411c30db9 - wizard 8461f299270fbcaf280e6325dca763a592946e38

- **Issue #156** (2026-09-17): **chore: bump service images to v0.1.50**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.50 - update web/backend/wizard submodule pointers to v0.1.50  ## Submodules - web `235022eb5b254f4b8e04bf90e6e6d4ce85e29489` (v0.1.50) - backend `c84042e3738d42b500c2809462b2b15abdbf9ee7` (v0.1.50) - wizard `9e1c44ce7e6c3b536bbf744344658432774078aa` (v0.1.50)  ## Validation - git diff --check - docker compose config skipped (Docker unavailable)

- **Issue #155** (2026-09-10): **chore: bump service images to v0.1.49**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.49 - update web/backend/wizard submodule pointers to v0.1.49  ## Submodule commits - web: 776d9332d7433652827a92ac296927b116de54de - backend: 107c449c8f5375ba8f9e85db1d609fe8d1294c2a - wizard: fe111bdb4c0594d662521c2fba445d3cec68a340  ## Validation - git diff --check - docker compose config: skipped (docker is not installed in the release environment)

- **Issue #154** (2026-09-08): **chore: bump service images to v0.1.48**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.48 - update web/backend/wizard submodule pointers to v0.1.48  ## Validation - git diff --check - skipped: docker unavailable

- **Issue #153** (2026-09-05): **release(v0.1.48-beta.1): Sync submodules**
  *Symptoms*: 

- **Issue #152** (2026-09-05): **chore: bump service images to v0.1.47**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.47 - update web/backend/wizard submodule pointers to v0.1.47  ## Validation - git diff --check - docker compose config skipped: Docker unavailable

- **Issue #151** (2026-08-31): **chore: bump service images to v0.1.46**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.46 - update web/backend/wizard submodule pointers to v0.1.46  ## Validation - git diff --check - verified each submodule HEAD matches the v0.1.46 tag commit - docker compose config skipped because Docker is unavailable

- **Issue #150** (2026-08-20): **chore: bump service images to v0.1.45**
  *Symptoms*: ## Summary - bump web/backend/wizard image tags to v0.1.45 - update web/backend/wizard submodule pointers to v0.1.45  ## Validation - git diff --check - verified web/backend/wizard submodules resolve to exact v0.1.45 tags - docker compose config skipped because Docker is unavailable in the release environment

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

### Incident Patch 1: `702512ce` (2026-08-28)
**Commit Message**: chore(readme): fix star history chart (#149)

The star history chart in the README is currently broken because the old service can no longer fetch GitHub stargazer data reliably. Switch the chart and its link to a working provider so the chart is displayed again.

Co-authored-by: OctoBored <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -59,4 +59,4 @@ bash scripts/dev.sh up -d --build
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=import-ai/omnibox&type=date&legend=top-left)](https://www.star-history.com/#import-ai/omnibox&type=date&legend=top-left)
+[![Star History Chart](https://star-history.dera.page/svg?repos=import-ai/omnibox&type=date&legend=top-left)](https://star-history.dera.page/#import-ai/omnibox&type=date&legend=top-left)
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -61,4 +61,4 @@ bash scripts/dev.sh up -d --build
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=import-ai/omnibox&type=date&legend=top-left)](https://www.star-history.com/#import-ai/omnibox&type=date&legend=top-left)
+[![Star History Chart](https://star-history.dera.page/svg?repos=import-ai/omnibox&type=date&legend=top-left)](https://star-history.dera.page/#import-ai/omnibox&type=date&legend=top-left)
```

---

### Incident Patch 2: `7a4fa414` (2025-11-18)
**Commit Message**: Merge pull request #80 from import-ai/fix/callback

fix(callback): Fix callback

**File**: `backend` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 1a19362b5bbac395f8fef16c31676a5a9aabc209
+Subproject commit 11a9a502c650962094c79ef58be71df8e235315a
```

**File**: `compose.yaml` (modified, +4/-4)
```diff
@@ -2,7 +2,7 @@ name: omnibox
 
 services:
   web:
-    image: ghcr.io/import-ai/omnibox-web:0.1.10
+    image: ghcr.io/import-ai/omnibox-web:0.1.11
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
     ports:
@@ -13,7 +13,7 @@ services:
         condition: service_healthy
 
   backend:
-    image: ghcr.io/import-ai/omnibox-backend:0.1.10
+    image: ghcr.io/import-ai/omnibox-backend:0.1.11
     restart: always
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
@@ -32,7 +32,7 @@ services:
         condition: service_healthy
 
   wizard:
-    image: ghcr.io/import-ai/omnibox-wizard:0.1.9
+    image: ghcr.io/import-ai/omnibox-wizard:0.1.11
     restart: always
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
@@ -50,7 +50,7 @@ services:
       start_period: 5s
 
   wizard-worker:
-    image: ghcr.io/import-ai/omnibox-wizard:0.1.9
+    image: ghcr.io/import-ai/omnibox-wizard:0.1.11
     restart: always
     environment:
       ENV: prod
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit ba12e56d04ab2d500afedbeb9fc4c9fc4630b1e4
+Subproject commit 2311379537ef3aa955e7388bcd25dfad3e12d091
```

---

### Incident Patch 3: `330292ef` (2025-11-18)
**Commit Message**: fix(callback): Fix callback

**File**: `backend` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 1a19362b5bbac395f8fef16c31676a5a9aabc209
+Subproject commit 11a9a502c650962094c79ef58be71df8e235315a
```

**File**: `compose.yaml` (modified, +4/-4)
```diff
@@ -2,7 +2,7 @@ name: omnibox
 
 services:
   web:
-    image: ghcr.io/import-ai/omnibox-web:0.1.10
+    image: ghcr.io/import-ai/omnibox-web:0.1.11
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
     ports:
@@ -13,7 +13,7 @@ services:
         condition: service_healthy
 
   backend:
-    image: ghcr.io/import-ai/omnibox-backend:0.1.10
+    image: ghcr.io/import-ai/omnibox-backend:0.1.11
     restart: always
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
@@ -32,7 +32,7 @@ services:
         condition: service_healthy
 
   wizard:
-    image: ghcr.io/import-ai/omnibox-wizard:0.1.9
+    image: ghcr.io/import-ai/omnibox-wizard:0.1.11
     restart: always
     volumes:
       - '/etc/localtime:/etc/localtime:ro'
@@ -50,7 +50,7 @@ services:
       start_period: 5s
 
   wizard-worker:
-    image: ghcr.io/import-ai/omnibox-wizard:0.1.9
+    image: ghcr.io/import-ai/omnibox-wizard:0.1.11
     restart: always
     environment:
       ENV: prod
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit ba12e56d04ab2d500afedbeb9fc4c9fc4630b1e4
+Subproject commit 2311379537ef3aa955e7388bcd25dfad3e12d091
```

---

### Incident Patch 4: `e001abd9` (2025-11-11)
**Commit Message**: Merge pull request #77 from import-ai/fix/doc

chore(doc): Update README_zh again

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@
 ### 部署
 
 ```shell
-git clone https://github.com/import-ai/omnibox.git
+GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/import-ai/omnibox.git
 cd omnibox
 cp example.env .env
 bash scripts/compose.sh up -d
```

---

### Incident Patch 5: `24298496` (2025-11-05)
**Commit Message**: patch(v0.1.9): Fix backend and wizard

**File**: `backend` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit a7fd16f06e6f3f5cd834120a9cd36acced6a5a87
+Subproject commit 5cc99f5c1bced619b50ad174ebabbcb97357c5c0
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit eacd85a2269c145f08acbfe4a6322bd8c9bcd5f1
+Subproject commit 223208dd378d40c281c30766d9283092179be123
```

---

### Incident Patch 6: `c6961c73` (2025-10-28)
**Commit Message**: fix(emails): Fix email binding, fix collect

**File**: `backend` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 2224d22bb18759d758e0bbc7e0d20bc6a7ab7e79
+Subproject commit 268df92fa1fb8e29ee6034f16cd97974464c82e4
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit bf3d56838f74852ecff2c2d251cc37e1baec88f3
+Subproject commit 20602acc5670d384fdff8cb6312abec83041a0b4
```

---

### Incident Patch 7: `d90b0dd1` (2025-10-28)
**Commit Message**: patch(v0.1.7): Fix lazy load

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit bbb54557263ed0661f72191198ca72bfaf685428
+Subproject commit bf3d56838f74852ecff2c2d251cc37e1baec88f3
```

---

### Incident Patch 8: `176b60e0` (2025-10-28)
**Commit Message**: patch(v0.1.7): Fix collect img

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit f3a1e408cb3b0c18a8a32c7d465394883655bfce
+Subproject commit bbb54557263ed0661f72191198ca72bfaf685428
```

---

### Incident Patch 9: `83acb7a5` (2025-10-26)
**Commit Message**: Merge pull request #67 from import-ai/fix/wizard

fix(wizard): Fix pdf parsing, update README

**File**: `README.md` (modified, +14/-11)
```diff
@@ -7,6 +7,10 @@
 
 English | [简体中文](./README_zh.md)
 
+## Docs
+
+[OmniBox Docs](https://www.omnibox.pro/docs/?utm_source=gh_readme_en)
+
 ## Introduction
 
 OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All you need to do is collect, then ask.
@@ -19,7 +23,8 @@ OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All y
 4. Q&A and writing based on both Internet and local databases.
 5. **Flash**: Quick capture of fleeting ideas on iOS with support for voice recordings and text notes.
 6. **Share**: Seamless file sharing to OmniBox directly from iOS.
-7. User and team system, permissions, sharing management, multi-tenancy, multi-language, dark mode, mobile responsiveness, and more.
+7. **WeChat Bot**: Save files, webpages, videos, voice messages, text, and chat records to OmniBox anytime, anywhere via WeChat.
+8. User and team system, permissions, sharing management, multi-tenancy, multi-language, dark mode, mobile responsiveness, and more.
 
 ### Screenshots
 
@@ -92,13 +97,11 @@ OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All y
 
 ## Quick Start
 
-Welcome to our online service: [omnibox.pro](https://www.omnibox.pro), supporting email registration and WeChat login.
+Welcome to our online service: [omnibox.pro](https://www.omnibox.pro/?utm_source=gh_readme_en), supporting login via Email, Google and WeChat.
 
 ### Browser Extension
 
-[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gckiocdfdaofgabchobljcdimjieookl?label=Google%20Chrome&color=yellow)](https://chromewebstore.google.com/detail/save-to-omnibox/gckiocdfdaofgabchobljcdimjieookl)
-[![Mozilla Add-on Version](https://img.shields.io/amo/v/save-to-omnibox?label=Mozilla%20Firefox&color=%23f72f54)
-](https://addons.mozilla.org/en-US/firefox/addon/save-to-omnibox/)
+[Browser Extension Installation | OmniBox Docs](https://www.omnibox.pro/docs/collect/browser-extension)
 
 ### Deployment
 
@@ -118,10 +121,10 @@ cp example.env .env
 bash scripts/dev.sh up -d --build
 ```
 
-## TODO
+## Roadmap
 
-1. RSS subscription
-2. Agent, folder, and document public sharing
-3. WeChat Mini Program
-4. Increase writing length limit (currently can write up to 5000 words)
-5. API
+- [x] Agent, folder, and document public sharing
+- [x] WeChat Bot
+- [x] Open API
+- [ ] WeChat Mini Program
+- [ ] RSS Subscription
```

**File**: `README_zh.md` (modified, +15/-12)
```diff
@@ -1,4 +1,4 @@
-# OmniBox - 小黑
+# 小黑 - OmniBox
 
 [![omnibox-web](https://img.shields.io/github/v/release/import-ai/omnibox-web?color=brightgreen&label=Web&sort=semver)](https://github.com/import-ai/omnibox-web/releases)
 [![omnibox-backend](https://img.shields.io/github/v/release/import-ai/omnibox-backend?color=blue&label=Backend&sort=semver)](https://github.com/import-ai/omnibox-backend/releases)
@@ -7,11 +7,15 @@
 
 [English](./README.md) | 简体中文
 
+## 文档
+
+[小黑帮助文档](https://www.omnibox.pro/docs/zh-cn/?utm_source=gh_readme_zh)
+
 ## 简介
 
 > “小黑”取自《爱情公寓》中的“楼下小黑”
 
-OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，你需要做的只有收集，然后提问。
+小黑（OmniBox）是一个简单、跨平台 All in One 的 AI 知识中枢，收集、整理、应用、分享，一应俱全。
 
 ### 核心特性
 
@@ -21,7 +25,8 @@ OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，
 4. 基于互联网和本地的数据库进行问答、写作
 5. **闪记**：iOS 端快速记录灵感，支持语音录制和文字笔记
 6. **分享**：iOS 端无缝分享文件至小黑
-7. 用户、团队系统、权限、分享管理、多租户、多语言、暗色模式、移动端自适应等
+7. **微信助手**：在微信中随时随地将文件、网页、视频、语音、文字、聊天记录保存至小黑
+8. 用户、团队系统、权限、分享管理、多租户、多语言、暗色模式、移动端自适应等
 
 ### 截图
 
@@ -94,13 +99,11 @@ OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，
 
 ## 快速开始
 
-欢迎使用我们的在线服务：[omnibox.pro](https://www.omnibox.pro)，支持邮箱注册以及微信登录。
+欢迎使用我们的在线服务：[omnibox.pro](https://www.omnibox.pro/?utm_source=gh_readme_zh)，支持邮箱注册以及谷歌、微信登录。
 
 ### 浏览器插件
 
-[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gckiocdfdaofgabchobljcdimjieookl?label=Google%20Chrome&color=yellow)](https://chromewebstore.google.com/detail/save-to-omnibox/gckiocdfdaofgabchobljcdimjieookl)
-[![Mozilla Add-on Version](https://img.shields.io/amo/v/save-to-omnibox?label=Mozilla%20Firefox&color=%23f72f54)
-](https://addons.mozilla.org/en-US/firefox/addon/save-to-omnibox/)
+[浏览器插件安装 | 小黑帮助文档](https://www.omnibox.pro/docs/zh-cn/collect/browser-extension)
 
 ### 部署
 
@@ -122,8 +125,8 @@ bash scripts/dev.yaml up -d --build
 
 ## 迭代计划
 
-1. RSS 订阅
-2. Agent、文件夹、文档公开分享
-3. 微信小程序
-4. 提升写作的长度上限（目前最多能写 5000 字）
-5. API
+- [x] Agent、文件夹、文档公开分享
+- [x] 微信助手
+- [x] Open API
+- [ ] 微信小程序
+- [ ] 订阅
```

**File**: `compose/help.yaml` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-services:
-  help:
-    image: ghcr.io/import-ai/omnibox-help:${HELP:-main}
-    volumes:
-      - '/etc/localtime:/etc/localtime:ro'
-    ports:
-      - ${OB_HELP_PORT:-6000}:80
-    restart: always
-    depends_on:
-      backend:
-        condition: service_healthy
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 144cddc9114bb85ef5ef5fbf29bb588c8258b711
+Subproject commit f3a1e408cb3b0c18a8a32c7d465394883655bfce
```

---

### Incident Patch 10: `d07374be` (2025-10-26)
**Commit Message**: fix(wizard): Fix pdf parsing, update README

**File**: `README.md` (modified, +14/-11)
```diff
@@ -7,6 +7,10 @@
 
 English | [简体中文](./README_zh.md)
 
+## Docs
+
+[OmniBox Docs](https://www.omnibox.pro/docs/?utm_source=gh_readme_en)
+
 ## Introduction
 
 OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All you need to do is collect, then ask.
@@ -19,7 +23,8 @@ OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All y
 4. Q&A and writing based on both Internet and local databases.
 5. **Flash**: Quick capture of fleeting ideas on iOS with support for voice recordings and text notes.
 6. **Share**: Seamless file sharing to OmniBox directly from iOS.
-7. User and team system, permissions, sharing management, multi-tenancy, multi-language, dark mode, mobile responsiveness, and more.
+7. **WeChat Bot**: Save files, webpages, videos, voice messages, text, and chat records to OmniBox anytime, anywhere via WeChat.
+8. User and team system, permissions, sharing management, multi-tenancy, multi-language, dark mode, mobile responsiveness, and more.
 
 ### Screenshots
 
@@ -92,13 +97,11 @@ OmniBox (小黑) is a simple, cross-platform, all-in-one AI knowledge hub. All y
 
 ## Quick Start
 
-Welcome to our online service: [omnibox.pro](https://www.omnibox.pro), supporting email registration and WeChat login.
+Welcome to our online service: [omnibox.pro](https://www.omnibox.pro/?utm_source=gh_readme_en), supporting login via Email, Google and WeChat.
 
 ### Browser Extension
 
-[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gckiocdfdaofgabchobljcdimjieookl?label=Google%20Chrome&color=yellow)](https://chromewebstore.google.com/detail/save-to-omnibox/gckiocdfdaofgabchobljcdimjieookl)
-[![Mozilla Add-on Version](https://img.shields.io/amo/v/save-to-omnibox?label=Mozilla%20Firefox&color=%23f72f54)
-](https://addons.mozilla.org/en-US/firefox/addon/save-to-omnibox/)
+[Browser Extension Installation | OmniBox Docs](https://www.omnibox.pro/docs/collect/browser-extension)
 
 ### Deployment
 
@@ -118,10 +121,10 @@ cp example.env .env
 bash scripts/dev.sh up -d --build
 ```
 
-## TODO
+## Roadmap
 
-1. RSS subscription
-2. Agent, folder, and document public sharing
-3. WeChat Mini Program
-4. Increase writing length limit (currently can write up to 5000 words)
-5. API
+- [x] Agent, folder, and document public sharing
+- [x] WeChat Bot
+- [x] Open API
+- [ ] WeChat Mini Program
+- [ ] RSS Subscription
```

**File**: `README_zh.md` (modified, +15/-12)
```diff
@@ -1,4 +1,4 @@
-# OmniBox - 小黑
+# 小黑 - OmniBox
 
 [![omnibox-web](https://img.shields.io/github/v/release/import-ai/omnibox-web?color=brightgreen&label=Web&sort=semver)](https://github.com/import-ai/omnibox-web/releases)
 [![omnibox-backend](https://img.shields.io/github/v/release/import-ai/omnibox-backend?color=blue&label=Backend&sort=semver)](https://github.com/import-ai/omnibox-backend/releases)
@@ -7,11 +7,15 @@
 
 [English](./README.md) | 简体中文
 
+## 文档
+
+[小黑帮助文档](https://www.omnibox.pro/docs/zh-cn/?utm_source=gh_readme_zh)
+
 ## 简介
 
 > “小黑”取自《爱情公寓》中的“楼下小黑”
 
-OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，你需要做的只有收集，然后提问。
+小黑（OmniBox）是一个简单、跨平台 All in One 的 AI 知识中枢，收集、整理、应用、分享，一应俱全。
 
 ### 核心特性
 
@@ -21,7 +25,8 @@ OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，
 4. 基于互联网和本地的数据库进行问答、写作
 5. **闪记**：iOS 端快速记录灵感，支持语音录制和文字笔记
 6. **分享**：iOS 端无缝分享文件至小黑
-7. 用户、团队系统、权限、分享管理、多租户、多语言、暗色模式、移动端自适应等
+7. **微信助手**：在微信中随时随地将文件、网页、视频、语音、文字、聊天记录保存至小黑
+8. 用户、团队系统、权限、分享管理、多租户、多语言、暗色模式、移动端自适应等
 
 ### 截图
 
@@ -94,13 +99,11 @@ OmniBox（小黑）是一个简单、跨平台 All in One 的 AI 知识中枢，
 
 ## 快速开始
 
-欢迎使用我们的在线服务：[omnibox.pro](https://www.omnibox.pro)，支持邮箱注册以及微信登录。
+欢迎使用我们的在线服务：[omnibox.pro](https://www.omnibox.pro/?utm_source=gh_readme_zh)，支持邮箱注册以及谷歌、微信登录。
 
 ### 浏览器插件
 
-[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gckiocdfdaofgabchobljcdimjieookl?label=Google%20Chrome&color=yellow)](https://chromewebstore.google.com/detail/save-to-omnibox/gckiocdfdaofgabchobljcdimjieookl)
-[![Mozilla Add-on Version](https://img.shields.io/amo/v/save-to-omnibox?label=Mozilla%20Firefox&color=%23f72f54)
-](https://addons.mozilla.org/en-US/firefox/addon/save-to-omnibox/)
+[浏览器插件安装 | 小黑帮助文档](https://www.omnibox.pro/docs/zh-cn/collect/browser-extension)
 
 ### 部署
 
@@ -122,8 +125,8 @@ bash scripts/dev.yaml up -d --build
 
 ## 迭代计划
 
-1. RSS 订阅
-2. Agent、文件夹、文档公开分享
-3. 微信小程序
-4. 提升写作的长度上限（目前最多能写 5000 字）
-5. API
+- [x] Agent、文件夹、文档公开分享
+- [x] 微信助手
+- [x] Open API
+- [ ] 微信小程序
+- [ ] 订阅
```

**File**: `compose/help.yaml` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-services:
-  help:
-    image: ghcr.io/import-ai/omnibox-help:${HELP:-main}
-    volumes:
-      - '/etc/localtime:/etc/localtime:ro'
-    ports:
-      - ${OB_HELP_PORT:-6000}:80
-    restart: always
-    depends_on:
-      backend:
-        condition: service_healthy
```

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 144cddc9114bb85ef5ef5fbf29bb588c8258b711
+Subproject commit f3a1e408cb3b0c18a8a32c7d465394883655bfce
```

---

### Incident Patch 11: `ea531bd7` (2025-10-23)
**Commit Message**: Merge pull request #65 from import-ai/fix/v0.1.7

fix(v0.1.7): Fix audio extract

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 3292188f6f080f2097d31f8093043ba99cc788c2
+Subproject commit 144cddc9114bb85ef5ef5fbf29bb588c8258b711
```

---

### Incident Patch 12: `631496ee` (2025-10-23)
**Commit Message**: fix(v0.1.7): Fix audio extract

**File**: `wizard` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 3292188f6f080f2097d31f8093043ba99cc788c2
+Subproject commit 144cddc9114bb85ef5ef5fbf29bb588c8258b711
```

#### Recent Merged Pull Requests:
- **PR #157** (2026-09-23): chore: bump service images to v0.1.51 (@omnibox-bot)
- **PR #156** (2026-09-17): chore: bump service images to v0.1.50 (@omnibox-bot)
- **PR #155** (2026-09-10): chore: bump service images to v0.1.49 (@omnibox-bot)
- **PR #154** (2026-09-08): chore: bump service images to v0.1.48 (@omnibox-bot)
- **PR #153** (2026-09-05): release(v0.1.48-beta.1): Sync submodules (@LucienShui)
- **PR #152** (2026-09-05): chore: bump service images to v0.1.47 (@omnibox-bot)
- **PR #151** (2026-08-31): chore: bump service images to v0.1.46 (@omnibox-bot)
- **PR #150** (2026-08-20): chore: bump service images to v0.1.45 (@omnibox-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
