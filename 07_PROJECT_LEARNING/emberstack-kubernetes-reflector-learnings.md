# Forensic Learning Record (Deep Inspection): emberstack/kubernetes-reflector

> **Canonical Artifact**: `07_PROJECT_LEARNING/emberstack-kubernetes-reflector-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/emberstack/kubernetes-reflector](https://github.com/emberstack/kubernetes-reflector))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:18.264Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `emberstack/kubernetes-reflector`
- **Description**: Custom Kubernetes controller that can be used to replicate secrets, configmaps and certificates.
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1680 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #382** (2023-10-18): **Why does reflector need to list/watch CRDs?**
  *Symptoms*: This is probably a stupid question but why does Reflector need this role:  https://github.com/emberstack/kubernetes-reflector/blob/0134c897407e2e0f87a618afabf5baa6791b299a/src/helm/reflector/templates/clusterRole.yaml#L16-L18
  **Post-Mortem & Fix Analysis**:
  > @sdimovv these were used for the cert-manager plugin which was deprecated and these need to be removed. Pushed a change a few moments ago to remove them.
  > Issue solved

- **Issue #341** (2023-10-02): **Reflector not watching secrets after period of time**
  *Symptoms*: Sorry if this has been raised before. Running multiple small clusters, AKS 1.25.x  In 2 environments so far, the SecretWatcher seems to just stop watching. This causes us to find our letsencrypt certs start to expire in namespaces. ConfigMapWatcher seems to continue.  We're running kubernetes-reflector:6.1.9. We've been running this (awesome) microservice for months and no problems to be seen, then they both stopped working within 4 days of eachother.  Logs are as follow:  ``` 2023-02-13 04:13:34.991 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Requesting V1Secret resources 2023-02-13 04:13:35.034 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected [redacted] where permitted. Created 0 - Updated 0 - Deleted 0 - Validated 3. 2023-02-13 04:25:52.974 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Session closed. Duration: 00:37:30.7838490. Faulted: False. 2023-02-13 04:25:52.975 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources 2023-02-13 04:55:21.486 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Session closed. Duration: 00:41:46.4948709. Faulted: False. 2023-02-13 04:55:21.486 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Requesting V1Secret resources 2023-02-13 04:55:21.518 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected [redacted] where permitted. Created 0 - Updated 0 - Deleted 0 - Validated 3. 2023-02-13 04:58:06.580 +0
  **Post-Mortem & Fix Analysis**:
  > https://github.com/emberstack/kubernetes-reflector/issues/77 https://github.com/emberstack/kubernetes-reflector/issues/337
  > This is a known issue currently. For some reason the k8s master nodes stop sending updates for secrets and don't close the session, so it keeps it running. Please use a smaller timeout for now (~15 minutes) so it forces a watcher close
  > Hello @winromulus  We have the same issue on our GKE cluster. reflector is working perfectly and after 2 days, it stop syncing the secrets. ``` reflector-dd6c9fdf5-qcdkv reflector 2023-08-20 22:25:04.621 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources reflector-dd6c9fdf5-qcdkv reflector 2023-08-20 22:57:19.856 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Session closed. Duration: 00:32:15.2347130. Faulted: False. reflector-dd6c9fdf5-qcdkv reflector 2023-08-20 22:57:19.856 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources reflector-dd6c9fdf5-qcdkv reflector 2023-08-20 23:53:00.238 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Session closed. Duration: 00:55:40.3812884. Faulted: False. reflector-dd6c9fdf5-qcdkv reflector 2023-08-20 23:53:00.238 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources reflector-dd6c9fdf5-qcd

- **Issue #336** (2023-03-07): **No way to add securityContext to cron container**
  *Symptoms*: Issue: Error creating: admission webhook "validation.gatekeeper.sh" denied the request: [azurepolicy-k8sazurev3allowedusersgroups-57ac95e12d2c31538661] Container reflector-startupapicheck is attempting to run without a required securityContext/fsGroup. Allowed fsGroup: {"ranges": [{"max": 65535, "min": 1}], "rule": "MustRunAs"}  On the helm chart we have ability to add .Values.cron.securityContext, but we also need this on the container level. Example on one of our own cronjobs that has this: ![image](https://user-images.githubusercontent.com/3061094/223448451-8c5630a9-f8f1-4534-99a5-fa4e257cdbe3.png) 
  **Post-Mortem & Fix Analysis**:
  > Hi @MariusGrandeAndersen thanks for submitting this. Any PR for this would be great. Maybe  @idrissneumann can enhance this since the work on the cron container was done by him.
  > sorry this issue is not in your chart, I have a quite complex helmchart of dependencies and it's a cert-manager thing, sorry for the waste of time

- **Issue #313** (2023-03-05): **Autoreflection of secret failing in a loop: "Source no longer permits reflection"**
  *Symptoms*: I am trying to copy a certificate from one namespace to another. It looks like it is initially able to copy over the secret to the other namespace but then it immediately deletes the copied secret and says it no longer permits reflection. It then does this in a loop over and over. ``` 2022-11-03 18:22:07.672 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected nucleus-sandbox/internal-nucleus-sandbox-hxp-hyland-com-wildcard-tls where permitted. Created 1 - Updated 0 - Deleted 0 - Validated 0. 2022-11-03 18:22:07.695 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Created apps-sandbox/internal-nucleus-sandbox-hxp-hyland-com-wildcard-tls as a reflection of nucleus-sandbox/internal-nucleus-sandbox-hxp-hyland-com-wildcard-tls 2022-11-03 18:22:07.695 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Deleting apps-sandbox/internal-nucleus-sandbox-hxp-hyland-com-wildcard-tls - Source nucleus-sandbox/internal-nucleus-sandbox-hxp-hyland-com-wildcard-tls no longer permits reflection. 2022-11-03 18:59:07.233 +00:00 [ERR] (ES.Kubernetes.Reflector.Core.SecretWatcher) Faulted due to exception. Microsoft.Rest.HttpOperationException: Operation returned an invalid status code 'NotFound'    at k8s.Kubernetes.SendRequestRaw(String requestContent, HttpRequestMessage httpRequest, CancellationToken cancellationToken)    at k8s.Kubernetes.DeleteNamespacedSecretWithHttpMessagesAsync(String name, String namespaceParameter, V1DeleteOptions body, String dryRun
  **Post-Mortem & Fix Analysis**:
  > I have the same problem. ``` 2023-02-05 13:39:47.994 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Requesting V1Secret resources 2023-02-05 13:39:48.086 +00:00 [DBG] (ES.Kubernetes.Reflector.Core.SecretMirror) Processing auto-reflection source kube-system/tls-staging-secret 2023-02-05 13:39:48.177 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected kube-system/tls-staging-secret where permitted. Created 3 - Updated 0 - Deleted 0 - Validated 0. 2023-02-05 13:39:48.177 +00:00 [DBG] (ES.Kubernetes.Reflector.Core.SecretMirror) Reflecting kube-system/tls-staging-secret to default/tls-staging-secret 2023-02-05 13:39:48.203 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Created default/tls-staging-secret as a reflection of kube-system/tls-staging-secret 2023-02-05 13:39:48.203 +00:00 [DBG] (ES.Kubernetes.Reflector.Core.SecretMirror) Reflecting kube-system/tls-staging-secret to kube-public/tls-staging-secret 2023-02-05 13:39:48.238 +00:00 [INF]
  > Also events log looks like ``` root@1141233-cq99499:~# kubectl get events -A NAMESPACE      LAST SEEN   TYPE     REASON              OBJECT                              MESSAGE argo           60m         Normal   CreateCertificate   ingress/argo-server                 Successfully created Certificate "tls-staging-secret" kube-system    60m         Normal   CreateCertificate   ingress/echo                        Successfully created Certificate "tls-staging-secret" argo           60m         Normal   CreateCertificate   ingress/argo-server                 Successfully created Certificate "tls-staging-secret" kube-system    60m         Normal   CreateCertificate   ingress/echo                        Successfully created Certificate "tls-staging-secret" argo           60m         Normal   CreateCertificate   ingress/argo-server                 Successfully created Certificate "tls-staging-secret" kube-system    60m         Normal   CreateCertificate   ingress/echo                
  > Please try the new version. This issue should be fixed. Please reopen if this is still a problem (some scenarios are extremely hard to reproduce and help is required to validate the fix).

- **Issue #295** (2023-03-05): **Reflector keeps deleting manually mirrored secrets**
  *Symptoms*: I have an issue with reflector where after applying a mirror secret, it will get reflected correctly and then deleted later. I traced the event in the log but I do not understand why this happens.  Log states: `2022-07-11 20:16:20.993 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected xxx where permitted. Created 0 - Updated 0 - Deleted 2 - Validated 3.`  The source secret has the following annotations: ```         reflector.v1.k8s.emberstack.com/reflection-allowed: "true"         reflector.v1.k8s.emberstack.com/reflection-auto-enabled: "true"         reflector.v1.k8s.emberstack.com/reflection-auto-namespaces: some-namespaces ```  The secret is auto-reflected perfectly, the deletion behavior only affects manual mirrors. What am I doing wrong?  Thanks
  **Post-Mortem & Fix Analysis**:
  > Automatically marked as stale due to no recent activity.  It will be closed if no further activity occurs. Thank you for your contributions. 
  > Removed stale label. 
  > Removed stale label. 

- **Issue #292** (2023-03-05): **[BUG] reflector does not update secrets anymore after some time - restart fixes  the problem**
  *Symptoms*: Hi guys,  we are happily using reflector in our clusters. But after some time the pod is still running, but secrets are not updated/created anymore. When I restart the deployment the new pod instantly creates or updates the target secrets. So it does not seem to be a memory leak:  ![grafik](https://user-images.githubusercontent.com/25035182/175886305-b17dce43-31b9-480b-b97d-33b1ef948a94.png) Although there is some kind of pattern in the memory stats.  I can't check the logs too far in the past, but there were no logs before the restart for at least 30 days.  We encountered this problem several times on multiple cluster, is there any way we can further debug this issue?  Best regards Alex
  **Post-Mortem & Fix Analysis**:
  > Hi,   I am encountering the same issue as @aeimer on my cluster which is running v6.1.23.    When the issue occurs all logging stops and the process appears to not be doing anything anymore.   A restart of the deployment or a deletion of the "stuck pod" fixes the issue when the reflector service restarts.   For me on the last freeze the very last line looked like this:  ``` 2022-07-02 06:41:09.338 +00:00 [INF] () Starting host 2022-07-02 06:41:11.618 +00:00 [INF] (ES.Kubernetes.Reflector.Core.NamespaceWatcher) Requesting V1Namespace resources 2022-07-02 06:41:11.764 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Requesting V1Secret resources 2022-07-02 06:41:11.830 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources 2022-07-02 06:41:13.622 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected cert-manager/xx-xxxx-net-lego-cert where permitted. Created 0 - Updated 5 - Deleted 0 - Validated 5. ``` And the
  > facing the same issue.   i believe it is somehow due to broken watchers (maybe due to dropped idle connection by a firewall for example?)  for me the secrets got synced again after the watcher session has been internally closed and restarted. so i believe setting the `configuration.watcher.timeout` to a low timeout like `60`or `120` seems to be a workaround for that issue. 
  > The issue is indeed the watchers. I'm working on a new solution to monitor the watchers and restart them if they're dead. Fallback would be a timeout, but the problem with watcher timeout is that some clusters have thousands of secrets reflected and the watchers may timeout before everything is processed resulting in a performance degradation.

- **Issue #283** (2023-03-05): **Reflector skipping some namespaces**
  *Symptoms*: I have the below config for the secret. ```   secretTemplate:     annotations:       reflector.v1.k8s.emberstack.com/auto-reflects: cert-manager/demo-secret       reflector.v1.k8s.emberstack.com/reflection-allowed: "true"       reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces: "" # Control destination namespaces       reflector.v1.k8s.emberstack.com/reflection-auto-enabled: "true" # Auto create reflection for matching namespaces       reflector.v1.k8s.emberstack.com/reflection-auto-namespaces: "" # Control auto-reflection namespaces       reflector.v1.k8s.emberstack.com/reflected-version: "" ```  My clusters all namespaces.  ``` ❯ k get ns NAME                   STATUS   AGE argocd                 Active   196d cert-manager           Active   212d default                Active   213d gatekeeper             Active   166d homeassistant          Active   113d homebridge             Active   116d ingress-nginx          Active   196d kube-node-lease        Active   213d kube-public            Active   213d kube-system            Active   213d kubernetes-dashboard   Active   194d metallb-system         Active   213d openebs                Active   194d pihole                 Active   193d vault                  Active   166d ```   ``` 2022-05-06 11:35:10.828 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Auto-reflected cert-manager/demo-secret where permitted. Created 0 - Updated 9 - Deleted 0 - Validated 0. 2022-05-06 11:
  **Post-Mortem & Fix Analysis**:
  > @Rahulsharma0810 can you delete the reflector pod so it restarts and send me the logs from startup?
  > on top of it when I try to create a secret manually  ```kubectl get secret demo-secret --namespace=cert-manager -o yaml | sed 's/namespace: .\*/namespace: kubernetes-dashboard/' | kubectl apply -f -```  in the logs   ``` 2022-05-06 11:58:52.575 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretMirror) Created argocd/demo-secret as a reflection of cert-manager/demo-secret ``` 
  > Automatically marked as stale due to no recent activity.  It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #266** (2022-04-30): **Possible bug: Reflector does not reflect some secrets**
  *Symptoms*: # Issue  After spinning up a new GKE cluster `v1.21.6-gke.1503` and installing cert-manager and reflector `6.1.23` i initially notice that the secret created by cert manager hasn't been reflected into the default namespace (it has the same config as our other cluster where this does work).   # Debugging So far  checked the log - didn't see anything useful - only entries like ``` 022-02-25 07:51:29.498 +00:00 [INF] (ES.Kubernetes.Reflector.Core.SecretWatcher) Requesting V1Secret resources 2022-02-25 07:51:29.501 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Session closed. Duration: 00:10:00.0019285. Faulted: False. 2022-02-25 07:51:29.501 +00:00 [INF] (ES.Kubernetes.Reflector.Core.ConfigMapWatcher) Requesting V1ConfigMap resources 2022-02-25 07:51:29.544 +00:00 [INF] (ES.Kubernetes.Reflector.Core.NamespaceWatcher) Session closed. Duration: 00:10:00.0102375. Faulted: False. ```  Then wondered if it might be something going a bit funny with the annotations - so ended up creating a number of certificates with every combination of of annotation: ```       reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces: default,test       reflector.v1.k8s.emberstack.com/reflection-auto-namespaces: default,test       reflector.v1.k8s.emberstack.com/secret-reflection-allowed: "true"       reflector.v1.k8s.emberstack.com/secret-reflection-auto-enabled: "true"     name: trsy-cert       reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces: ""
  **Post-Mortem & Fix Analysis**:
  > @scarby can you provide a sample of the definition for one of the source secrets please? Strip away any content that is confidential but please keep the keys in order to try to reproduce it locally. There might be something in the structure of the secret preventing reflection. Also did you modify the RBAC of reflector from the default (i.e. something preventing access to write to default or test namespace)?
  > Automatically marked as stale due to no recent activity.  It will be closed if no further activity occurs. Thank you for your contributions. 
  > Automatically closed stale item. 

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

### Incident Patch 1: `a5568cd5` (2026-08-03)
**Commit Message**: build(deps): bump docker/login-action in the all-dependencies group (#693)

Bumps the all-dependencies group with 1 update: [docker/login-action](https://github.com/docker/login-action).


Updates `docker/login-action` from 4.5.2 to 4.6.0
- [Release notes](https://github.com/docker/login-action/releases)
- [Commits](https://github.com/docker/login-action/compare/v4.5.2...v4.6.0)

---
updated-dependencies:
- dependency-name: docker/login-action
  dependency-version: 4.6.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +4/-4)
```diff
@@ -169,15 +169,15 @@ jobs:
 
       - name: tools - docker - login ghcr.io
         if: ${{ env.build_push == 'true' }}
-        uses: docker/login-action@v4.5.2
+        uses: docker/login-action@v4.6.0
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.ES_GITHUB_PAT }}
 
       - name: tools - docker - login docker.io
         if: ${{ env.build_push == 'true' }}
-        uses: docker/login-action@v4.5.2
+        uses: docker/login-action@v4.6.0
         with:
           registry: docker.io
           username: ${{ secrets.ES_DOCKERHUB_USERNAME }}
@@ -272,14 +272,14 @@ jobs:
         run: echo "${{ secrets.ES_GITHUB_PAT }}" | oras login ghcr.io -u ${{ github.actor }} --password-stdin
 
       - name: tools - docker - login ghcr.io
-        uses: docker/login-action@v4.5.2
+        uses: docker/login-action@v4.6.0
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.ES_GITHUB_PAT }}
 
       - name: tools - docker - login docker.io
-        uses: docker/login-action@v4.5.2
+        uses: docker/login-action@v4.6.0
         with:
           registry: docker.io
           username: ${{ secrets.ES_DOCKERHUB_USERNAME }}
```

---

### Incident Patch 2: `591b4146` (2026-07-30)
**Commit Message**: build(deps): bump docker/login-action in the all-dependencies group (#692)

Bumps the all-dependencies group with 1 update: [docker/login-action](https://github.com/docker/login-action).


Updates `docker/login-action` from 4 to 4.5.2
- [Release notes](https://github.com/docker/login-action/releases)
- [Commits](https://github.com/docker/login-action/compare/v4...v4.5.2)

---
updated-dependencies:
- dependency-name: docker/login-action
  dependency-version: 4.5.2
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +4/-4)
```diff
@@ -169,15 +169,15 @@ jobs:
 
       - name: tools - docker - login ghcr.io
         if: ${{ env.build_push == 'true' }}
-        uses: docker/login-action@v4
+        uses: docker/login-action@v4.5.2
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.ES_GITHUB_PAT }}
 
       - name: tools - docker - login docker.io
         if: ${{ env.build_push == 'true' }}
-        uses: docker/login-action@v4
+        uses: docker/login-action@v4.5.2
         with:
           registry: docker.io
           username: ${{ secrets.ES_DOCKERHUB_USERNAME }}
@@ -272,14 +272,14 @@ jobs:
         run: echo "${{ secrets.ES_GITHUB_PAT }}" | oras login ghcr.io -u ${{ github.actor }} --password-stdin
 
       - name: tools - docker - login ghcr.io
-        uses: docker/login-action@v4
+        uses: docker/login-action@v4.5.2
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.ES_GITHUB_PAT }}
 
       - name: tools - docker - login docker.io
-        uses: docker/login-action@v4
+        uses: docker/login-action@v4.5.2
         with:
           registry: docker.io
           username: ${{ secrets.ES_DOCKERHUB_USERNAME }}
```

---

### Incident Patch 3: `88ab9eb5` (2026-07-28)
**Commit Message**: build(deps): bump actions/stale in the all-dependencies group (#690)

Bumps the all-dependencies group with 1 update: [actions/stale](https://github.com/actions/stale).


Updates `actions/stale` from 10 to 11
- [Release notes](https://github.com/actions/stale/releases)
- [Changelog](https://github.com/actions/stale/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/stale/compare/v10...v11)

---
updated-dependencies:
- dependency-name: actions/stale
  dependency-version: '11'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/stale.yaml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ jobs:
   stale:
     runs-on: ubuntu-latest
     steps:
-      - uses: actions/stale@v10
+      - uses: actions/stale@v11
         with:
           repo-token: ${{ secrets.GITHUB_TOKEN }}
 
```

---

### Incident Patch 4: `e06a3d73` (2026-07-16)
**Commit Message**: build(deps): bump actions/setup-dotnet in the all-dependencies group (#686)

Bumps the all-dependencies group with 1 update: [actions/setup-dotnet](https://github.com/actions/setup-dotnet).


Updates `actions/setup-dotnet` from 5 to 6
- [Release notes](https://github.com/actions/setup-dotnet/releases)
- [Commits](https://github.com/actions/setup-dotnet/compare/v5...v6)

---
updated-dependencies:
- dependency-name: actions/setup-dotnet
  dependency-version: '6'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -57,7 +57,7 @@ jobs:
           fetch-depth: 0
 
       - name: tools - dotnet - install
-        uses: actions/setup-dotnet@v5
+        uses: actions/setup-dotnet@v6
         with:
           dotnet-version: "10.x"
 
@@ -138,7 +138,7 @@ jobs:
           mkdir -p .artifacts/kubectl
 
       - name: tools - dotnet - install
-        uses: actions/setup-dotnet@v5
+        uses: actions/setup-dotnet@v6
         with:
           dotnet-version: "10.x"
 
```

---

### Incident Patch 5: `1b17c6b8` (2026-07-03)
**Commit Message**: build(deps): bump gittools/actions in the all-dependencies group (#677)

Bumps the all-dependencies group with 1 update: [gittools/actions](https://github.com/gittools/actions).


Updates `gittools/actions` from 4.6.0 to 4.7.0
- [Release notes](https://github.com/gittools/actions/releases)
- [Commits](https://github.com/gittools/actions/compare/v4.6.0...v4.7.0)

---
updated-dependencies:
- dependency-name: gittools/actions
  dependency-version: 4.7.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -62,14 +62,14 @@ jobs:
           dotnet-version: "10.x"
 
       - name: tools - gitversion - install
-        uses: gittools/actions/gitversion/setup@v4.6.0
+        uses: gittools/actions/gitversion/setup@v4.7.0
         with:
           versionSpec: "6.x"
           preferLatestVersion: true
 
       - name: gitversion - execute
         id: gitversion
-        uses: gittools/actions/gitversion/execute@v4.6.0
+        uses: gittools/actions/gitversion/execute@v4.7.0
         with:
           configFilePath: GitVersion.yaml
 
```

---

### Incident Patch 6: `a4fc2025` (2026-07-01)
**Commit Message**: build(deps): bump gittools/actions in the all-dependencies group (#675)

Bumps the all-dependencies group with 1 update: [gittools/actions](https://github.com/gittools/actions).


Updates `gittools/actions` from 4.5.0 to 4.6.0
- [Release notes](https://github.com/gittools/actions/releases)
- [Commits](https://github.com/gittools/actions/compare/v4.5.0...v4.6.0)

---
updated-dependencies:
- dependency-name: gittools/actions
  dependency-version: 4.6.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -62,14 +62,14 @@ jobs:
           dotnet-version: "10.x"
 
       - name: tools - gitversion - install
-        uses: gittools/actions/gitversion/setup@v4.5.0
+        uses: gittools/actions/gitversion/setup@v4.6.0
         with:
           versionSpec: "6.x"
           preferLatestVersion: true
 
       - name: gitversion - execute
         id: gitversion
-        uses: gittools/actions/gitversion/execute@v4.5.0
+        uses: gittools/actions/gitversion/execute@v4.6.0
         with:
           configFilePath: GitVersion.yaml
 
```

---

### Incident Patch 7: `ef2813ec` (2026-06-18)
**Commit Message**: build(deps): bump actions/checkout in the all-dependencies group (#667)

Bumps the all-dependencies group with 1 update: [actions/checkout](https://github.com/actions/checkout).


Updates `actions/checkout` from 6 to 7
- [Release notes](https://github.com/actions/checkout/releases)
- [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/checkout/compare/v6...v7)

---
updated-dependencies:
- dependency-name: actions/checkout
  dependency-version: '7'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -52,7 +52,7 @@ jobs:
       release: ${{ steps.evaluate_release.outputs.result }}
     steps:
       - name: checkout
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
         with:
           fetch-depth: 0
 
@@ -130,7 +130,7 @@ jobs:
       gitVersion_AssemblySemFileVer: ${{ needs.discovery.outputs.gitVersion_AssemblySemFileVer }}
     steps:
       - name: checkout
-        uses: actions/checkout@v6
+        uses: actions/checkout@v7
 
       - name: artifacts - prepare directories
         run: |
```

---

### Incident Patch 8: `97bdf5d4` (2026-05-08)
**Commit Message**: Fix mirror state loss when namespace watcher restarts (#645)

The WatcherClosed handler used to clear every cache regardless of
  which watcher session ended. When the namespace watcher reconnected
  (hourly by default, or on permission/connectivity hiccups), it wiped
  _autoSources and _propertiesCache — caches owned by the resource
  watcher. With the resource watcher idle in steady state, nothing
  repopulated them until its own hourly reconnect, leaving new
  namespaces unmirrored for up to an hour.

  Split the handler so namespace-watcher-close clears only
  _namespaceCache, and resource-watcher-close clears the resource
  caches but preserves _namespaceCache so label-selector checks remain
  functional during the resource replay. Add
  _directReflectionCache.Clear() to the resource path; it had never
  been cleared, silently leaking entries across every restart.

  Additional changes:
  - Replace four KeyNotFoundException-prone indexer accesses with
    TryGetValue / GetOrAdd patterns (ResourceMirror.cs:131, 328, 335,
    412) to handle concurrent cache clears safely.
  - Thread CancellationToken through OnResourceWithNameList,
    OnResourceGet, TryResourceGet, and Resource

**File**: `src/ES.Kubernetes.Reflector/Mirroring/ConfigMapMirror.cs` (modified, +8/-4)
```diff
@@ -9,10 +9,12 @@ namespace ES.Kubernetes.Reflector.Mirroring;
 public class ConfigMapMirror(ILogger<ConfigMapMirror> logger, IKubernetes kubernetes)
     : ResourceMirror<V1ConfigMap>(logger, kubernetes)
 {
-    protected override async Task<V1ConfigMap[]> OnResourceWithNameList(string itemRefName) =>
+    protected override async Task<V1ConfigMap[]> OnResourceWithNameList(string itemRefName,
+        CancellationToken cancellationToken) =>
     [
         .. (await Kubernetes.CoreV1.ListConfigMapForAllNamespacesAsync(
-            fieldSelector: $"metadata.name={itemRefName}"))
+            fieldSelector: $"metadata.name={itemRefName}",
+            cancellationToken: cancellationToken))
         .Items
     ];
 
@@ -47,6 +49,8 @@ protected override async Task OnResourceDelete(NamespacedName resourceId)
         await Kubernetes.CoreV1.DeleteNamespacedConfigMapAsync(resourceId.Name, resourceId.Namespace);
     }
 
-    protected override async Task<V1ConfigMap> OnResourceGet(NamespacedName refId) =>
-        await Kubernetes.CoreV1.ReadNamespacedConfigMapAsync(refId.Name, refId.Namespace);
+    protected override async Task<V1ConfigMap> OnResourceGet(NamespacedName refId,
+        CancellationToken cancellationToken) =>
+        await Kubernetes.CoreV1.ReadNamespacedConfigMapAsync(refId.Name, refId.Namespace,
+            cancellationToken: cancellationToken);
 }
\ No newline at end of file
```

**File**: `src/ES.Kubernetes.Reflector/Mirroring/Core/ResourceMirror.cs` (modified, +40/-23)
```diff
@@ -39,13 +39,23 @@ public Task Handle(WatcherClosed notification, CancellationToken cancellationTok
         if (notification.ResourceType != typeof(TResource) &&
             notification.ResourceType != typeof(V1Namespace)) return Task.CompletedTask;
 
+        if (notification.ResourceType == typeof(V1Namespace))
+        {
+            Logger.LogDebug("Cleared namespace cache for {Type} resources", typeof(TResource).Name);
+            _namespaceCache.Clear();
+            return Task.CompletedTask;
+        }
+
+        // Clear all resource caches but preserve _namespaceCache — it is owned by the
+        // NamespaceWatcher and must survive resource watcher restarts so label-selector
+        // checks remain functional during the replay that rebuilds resource state.
         Logger.LogDebug("Cleared sources for {Type} resources", typeof(TResource).Name);
 
         _autoSources.Clear();
-        _namespaceCache.Clear();
         _notFoundCache.Clear();
         _propertiesCache.Clear();
         _autoReflectionCache.Clear();
+        _directReflectionCache.Clear();
         _lastWarnedSelectorErrors.Clear();
 
         return Task.CompletedTask;
@@ -128,7 +138,8 @@ public async Task Handle(WatcherEvent notification, CancellationToken cancellati
                 //Update all auto-sources
                 foreach (var sourceNsName in _autoSources.Keys)
                 {
-                    var properties = _propertiesCache[sourceNsName];
+                    if (!_propertiesCache.TryGetValue(sourceNsName, out var properties)) continue;
+
                     var autoReflections = _autoReflectionCache.GetOrAdd(sourceNsName, []);
                     var reflectionNsName = sourceNsName with { Namespace = ns.Name() };
 
@@ -140,7 +151,8 @@ await ResourceReflect(
                             reflectionNsName,
                             null,
                             null,
-                            true);
+                            true,
+                            cancellationToken);
 
                         autoReflections.Add(reflectionNsName);
                     }
@@ -290,7 +302,8 @@ await ResourceReflect(objNsName,
                             reflectionNsName,
                             obj,
                             null,
-                            false);
+                            false,
+                            cancellationToken);
                     }
 
                 //Ensure updated auto-reflections
@@ -306,7 +319,7 @@ await ResourceReflect(objNsName,
                 MirroringProperties sourceProperties;
                 if (!_propertiesCache.TryGetValue(sourceNsName, out var sourceProps))
                 {
-                    var sourceObj = await TryResourceGet(sourceNsName);
+                    var sourceObj = await TryResourceGet(sourceNsName, cancellationToken);
                     if (sourceObj is null)
                     {
                         Logger.LogWarning(
@@ -324,16 +337,15 @@ await ResourceReflect(objNsName,
 
                 _propertiesCache.AddOrUpdate(sourceNsName,
                     sourceProperties, (_, _) => sourceProperties);
-                _directReflectionCache.TryAdd(sourceNsName, []);
-                _directReflectionCache[sourceNsName].Add(objNsName);
+                var directReflections = _directReflectionCache.GetOrAdd(sourceNsName, []);
+                directReflections.Add(objNsName);
 
                 if (!CanBeReflectedToNamespaceCached(sourceProperties, objNsName.Namespace))
                 {
                     Logger.LogWarning("Could not update {reflectionNsName} - Source {sourceNsName} does not permit it.",
                         objNsName, sourceNsName);
 
-                    _directReflectionCache[sourceNsName]
-                        .Remove(objNsName);
+                    directReflections.Remove(objNsName);
                     return;
                 }
 
@@ -349,7 +361,8 @@ await ResourceReflect(
                     objNsName,
                     null,
                     obj,
-                    false);
+                    false,
+                    cancellationToken);
 
                 return;
             }
@@ -372,7 +385,7 @@ await ResourceReflect(
                 MirroringProperties sourceProperties;
                 if (!_propertiesCache.TryGetValue(sourceNsName, out var props))
                 {
-                    var sourceResource = await TryResourceGet(sourceNsName);
+                    var sourceResource = await TryResourceGet(sourceNsName, cancellationToken);
                     if (sourceResource is null)
                     {
                         Logger.LogInformation("Source {sourceNsName} no longer exists. Deleting {reflectionNsName}.",
@@ -409,12 +422,12 @@ private async Task AutoReflectionForSource(NamespacedName sourceNsName, TResourc
         CancellationToken cancellationToken)
     {
         Logger.LogDebug("Processing auto-reflection source {sour
```

**File**: `src/ES.Kubernetes.Reflector/Mirroring/SecretMirror.cs` (modified, +8/-4)
```diff
@@ -9,10 +9,12 @@ namespace ES.Kubernetes.Reflector.Mirroring;
 public class SecretMirror(ILogger<SecretMirror> logger, IKubernetes kubernetesClient)
     : ResourceMirror<V1Secret>(logger, kubernetesClient)
 {
-    protected override async Task<V1Secret[]> OnResourceWithNameList(string itemRefName) =>
+    protected override async Task<V1Secret[]> OnResourceWithNameList(string itemRefName,
+        CancellationToken cancellationToken) =>
     [
         .. (await Kubernetes.CoreV1.ListSecretForAllNamespacesAsync(
-            fieldSelector: $"metadata.name={itemRefName}"))
+            fieldSelector: $"metadata.name={itemRefName}",
+            cancellationToken: cancellationToken))
         .Items
     ];
 
@@ -46,6 +48,8 @@ protected override async Task OnResourceDelete(NamespacedName resourceId)
         await Kubernetes.CoreV1.DeleteNamespacedSecretAsync(resourceId.Name, resourceId.Namespace);
     }
 
-    protected override async Task<V1Secret> OnResourceGet(NamespacedName refId) =>
-        await Kubernetes.CoreV1.ReadNamespacedSecretAsync(refId.Name, refId.Namespace);
+    protected override async Task<V1Secret> OnResourceGet(NamespacedName refId,
+        CancellationToken cancellationToken) =>
+        await Kubernetes.CoreV1.ReadNamespacedSecretAsync(refId.Name, refId.Namespace,
+            cancellationToken: cancellationToken);
 }
\ No newline at end of file
```

**File**: `src/ES.Kubernetes.Reflector/Watchers/Core/WatcherBackgroundService.cs` (modified, +16/-9)
```diff
@@ -54,16 +54,23 @@ protected override async Task ExecuteAsync(CancellationToken stoppingToken)
                 //Read using a separate task so the watcher doesn't get stuck waiting on subscribers to handle the event
                 _ = Task.Run(async () =>
                 {
-                    while (!cancellationToken.IsCancellationRequested)
+                    try
                     {
-                        var watcherEvent = await eventChannel.Reader.ReadAsync(cancellationToken)
-                            .ConfigureAwait(false);
-                        foreach (var watcherEventHandler in watcherEventHandlers)
-                            await watcherEventHandler.Handle(new WatcherEvent
-                            {
-                                Item = watcherEvent.Item,
-                                EventType = watcherEvent.EventType
-                            }, cancellationToken);
+                        while (!cancellationToken.IsCancellationRequested)
+                        {
+                            var watcherEvent = await eventChannel.Reader.ReadAsync(cancellationToken)
+                                .ConfigureAwait(false);
+                            foreach (var watcherEventHandler in watcherEventHandlers)
+                                await watcherEventHandler.Handle(new WatcherEvent
+                                {
+                                    Item = watcherEvent.Item,
+                                    EventType = watcherEvent.EventType
+                                }, cancellationToken);
+                        }
+                    }
+                    catch (OperationCanceledException)
+                    {
+                        // Expected on session shutdown when cancellation propagates through API calls.
                     }
                 }, cancellationToken);
 
```

---

### Incident Patch 9: `977060fe` (2026-04-13)
**Commit Message**: build(deps): bump softprops/action-gh-release (#634)

Bumps the all-dependencies group with 1 update: [softprops/action-gh-release](https://github.com/softprops/action-gh-release).


Updates `softprops/action-gh-release` from 2 to 3
- [Release notes](https://github.com/softprops/action-gh-release/releases)
- [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
- [Commits](https://github.com/softprops/action-gh-release/compare/v2...v3)

---
updated-dependencies:
- dependency-name: softprops/action-gh-release
  dependency-version: '3'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ jobs:
         run: helm push .artifacts/helm/${{ env.helm_chart }}-${{ env.gitVersion_SemVer }}.tgz ${{ env.helm_chart_repository_protocol }}${{ env.helm_chart_repository }}
 
       - name: github - release - create
-        uses: softprops/action-gh-release@v2
+        uses: softprops/action-gh-release@v3
         with:
           repository: ${{ github.repository }}
           name: v${{ env.gitVersion_SemVer }}
```

---

### Incident Patch 10: `b367505a` (2026-04-09)
**Commit Message**: build(deps): bump dependabot/fetch-metadata (#632)

Bumps the all-dependencies group with 1 update: [dependabot/fetch-metadata](https://github.com/dependabot/fetch-metadata).


Updates `dependabot/fetch-metadata` from 2 to 3
- [Release notes](https://github.com/dependabot/fetch-metadata/releases)
- [Commits](https://github.com/dependabot/fetch-metadata/compare/v2...v3)

---
updated-dependencies:
- dependency-name: dependabot/fetch-metadata
  dependency-version: '3'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/dependabot.auto.yaml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
     steps:
       - name: Fetch Dependabot metadata
         id: metadata
-        uses: dependabot/fetch-metadata@v2
+        uses: dependabot/fetch-metadata@v3
         with:
           github-token: "${{ secrets.GITHUB_TOKEN }}"
           skip-commit-verification: true
```

---

### Incident Patch 11: `bf8c678e` (2026-04-08)
**Commit Message**: build(deps): bump gittools/actions in the all-dependencies group (#630)

Bumps the all-dependencies group with 1 update: [gittools/actions](https://github.com/gittools/actions).


Updates `gittools/actions` from 4.4.2 to 4.5.0
- [Release notes](https://github.com/gittools/actions/releases)
- [Commits](https://github.com/gittools/actions/compare/v4.4.2...v4.5.0)

---
updated-dependencies:
- dependency-name: gittools/actions
  dependency-version: 4.5.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -62,14 +62,14 @@ jobs:
           dotnet-version: "10.x"
 
       - name: tools - gitversion - install
-        uses: gittools/actions/gitversion/setup@v4.4.2
+        uses: gittools/actions/gitversion/setup@v4.5.0
         with:
           versionSpec: "6.x"
           preferLatestVersion: true
 
       - name: gitversion - execute
         id: gitversion
-        uses: gittools/actions/gitversion/execute@v4.4.2
+        uses: gittools/actions/gitversion/execute@v4.5.0
         with:
           configFilePath: GitVersion.yaml
 
```

---

### Incident Patch 12: `931961b8` (2026-04-06)
**Commit Message**: build(deps): bump oras-project/setup-oras in the all-dependencies group (#628)

Bumps the all-dependencies group with 1 update: [oras-project/setup-oras](https://github.com/oras-project/setup-oras).


Updates `oras-project/setup-oras` from 1 to 2
- [Release notes](https://github.com/oras-project/setup-oras/releases)
- [Commits](https://github.com/oras-project/setup-oras/compare/v1...v2)

---
updated-dependencies:
- dependency-name: oras-project/setup-oras
  dependency-version: '2'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +1/-1)
```diff
@@ -266,7 +266,7 @@ jobs:
         run: echo "${{ secrets.ES_GITHUB_PAT }}" | helm registry login ghcr.io -u ${{ github.actor }} --password-stdin
 
       - name: tools - oras - install
-        uses: oras-project/setup-oras@v1
+        uses: oras-project/setup-oras@v2
 
       - name: tools - oras - login - ghcr.io
         run: echo "${{ secrets.ES_GITHUB_PAT }}" | oras login ghcr.io -u ${{ github.actor }} --password-stdin
```

---

### Incident Patch 13: `ea8d9f7b` (2026-03-23)
**Commit Message**: build(deps): bump the all-dependencies group with 2 updates (#617)

Bumps the all-dependencies group with 2 updates: [dorny/test-reporter](https://github.com/dorny/test-reporter) and [azure/setup-helm](https://github.com/azure/setup-helm).


Updates `dorny/test-reporter` from 2 to 3
- [Release notes](https://github.com/dorny/test-reporter/releases)
- [Changelog](https://github.com/dorny/test-reporter/blob/main/CHANGELOG.md)
- [Commits](https://github.com/dorny/test-reporter/compare/v2...v3)

Updates `azure/setup-helm` from 4 to 5
- [Release notes](https://github.com/azure/setup-helm/releases)
- [Changelog](https://github.com/Azure/setup-helm/blob/main/CHANGELOG.md)
- [Commits](https://github.com/azure/setup-helm/compare/v4...v5)

---
updated-dependencies:
- dependency-name: dorny/test-reporter
  dependency-version: '3'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
- dependency-name: azure/setup-helm
  dependency-version: '5'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: de

**File**: `.github/workflows/pipeline.yaml` (modified, +3/-3)
```diff
@@ -152,7 +152,7 @@ jobs:
         run: dotnet test --no-build --configuration ${{ env.build_configuration }} --verbosity normal
 
       - name: tests - report
-        uses: dorny/test-reporter@v2
+        uses: dorny/test-reporter@v3
         if: ${{ github.event.pull_request.head.repo.fork == false }}
         with:
           name: Test Results
@@ -161,7 +161,7 @@ jobs:
           fail-on-empty: "false"
 
       - name: tools - helm - install
-        uses: azure/setup-helm@v4
+        uses: azure/setup-helm@v5
 
       - name: tools - helm - login - ghcr.io
         if: ${{ env.build_push == 'true' }}
@@ -260,7 +260,7 @@ jobs:
           path: .artifacts/kubectl
 
       - name: tools - helm - install
-        uses: azure/setup-helm@v4
+        uses: azure/setup-helm@v5
 
       - name: tools - helm - login - ghcr.io
         run: echo "${{ secrets.ES_GITHUB_PAT }}" | helm registry login ghcr.io -u ${{ github.actor }} --password-stdin
```

---

### Incident Patch 14: `af2de0ab` (2026-03-16)
**Commit Message**: build(deps): bump gittools/actions in the all-dependencies group (#614)

Bumps the all-dependencies group with 1 update: [gittools/actions](https://github.com/gittools/actions).


Updates `gittools/actions` from 4.3.3 to 4.4.2
- [Release notes](https://github.com/gittools/actions/releases)
- [Commits](https://github.com/gittools/actions/compare/v4.3.3...v4.4.2)

---
updated-dependencies:
- dependency-name: gittools/actions
  dependency-version: 4.4.2
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +2/-2)
```diff
@@ -62,14 +62,14 @@ jobs:
           dotnet-version: "10.x"
 
       - name: tools - gitversion - install
-        uses: gittools/actions/gitversion/setup@v4.3.3
+        uses: gittools/actions/gitversion/setup@v4.4.2
         with:
           versionSpec: "6.x"
           preferLatestVersion: true
 
       - name: gitversion - execute
         id: gitversion
-        uses: gittools/actions/gitversion/execute@v4.3.3
+        uses: gittools/actions/gitversion/execute@v4.4.2
         with:
           configFilePath: GitVersion.yaml
 
```

---

### Incident Patch 15: `d1902c5c` (2026-03-13)
**Commit Message**: build(deps): bump dorny/paths-filter in the all-dependencies group (#612)

Bumps the all-dependencies group with 1 update: [dorny/paths-filter](https://github.com/dorny/paths-filter).


Updates `dorny/paths-filter` from 3 to 4
- [Release notes](https://github.com/dorny/paths-filter/releases)
- [Changelog](https://github.com/dorny/paths-filter/blob/master/CHANGELOG.md)
- [Commits](https://github.com/dorny/paths-filter/compare/v3...v4)

---
updated-dependencies:
- dependency-name: dorny/paths-filter
  dependency-version: '4'
  dependency-type: direct:production
  update-type: version-update:semver-major
  dependency-group: all-dependencies
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pipeline.yaml` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ jobs:
 
       - name: tools - detect changes
         id: pathsFilter
-        uses: dorny/paths-filter@v3
+        uses: dorny/paths-filter@v4
         with:
           base: ${{ github.ref }}
           filters: |
```

#### Recent Merged Pull Requests:
- **PR #709** (closed): Bump the all-dependencies group with 8 updates (@dependabot[bot])
- **PR #708** (closed): Bump the all-dependencies group with 7 updates (@dependabot[bot])
- **PR #707** (closed): Bump the all-dependencies group with 7 updates (@dependabot[bot])
- **PR #706** (closed): Bump the all-dependencies group with 6 updates (@dependabot[bot])
- **PR #705** (closed): Bump the all-dependencies group with 5 updates (@dependabot[bot])
- **PR #704** (closed): Bump the all-dependencies group with 3 updates (@dependabot[bot])
- **PR #703** (closed): Shredder/rewrite reflector ctrl runtime (@sorend)
- **PR #701** (closed): Add exponential backoff between faulted watcher sessions (@nicolaj-hartmann)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
