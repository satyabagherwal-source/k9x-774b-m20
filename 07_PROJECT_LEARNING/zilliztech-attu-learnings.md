# Forensic Learning Record (Deep Inspection): zilliztech/attu

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-attu-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/attu](https://github.com/zilliztech/attu))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:20:56.721Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/attu`
- **Description**: The Best GUI for Milvus
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3187 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #979** (2025-12-24): **Can't delete a partition**
  *Symptoms*: **Describe the bug:**  I can't delete a partition from a collection.  **Steps to reproduce:** 1.Add a partition(eg: 111) from a collection; 2.Delete the partition just now 3.The message indicated successful deletion, but no actual deletion occurred.  <img width="1418" height="341" alt="Image" src="https://github.com/user-attachments/assets/78b34596-051b-4ea2-8a7c-97db4ac39aaa" />  **Attu version:** 2.6.3  **Milvus version:** 2.6.7
  **Post-Mortem & Fix Analysis**:
  > https://github.com/zilliztech/attu/releases/tag/v2.6.4

- **Issue #977** (2025-12-24): **Edit timezone fail**
  *Symptoms*: **Describe the bug:** Edit timezone fail <img width="1569" height="850" alt="Image" src="https://github.com/user-attachments/assets/8e74cada-7cf0-4047-a83e-ae76181b3d16" />  **Steps to reproduce:** 1.create new database 2.edit the propertites -> timezone 3. select  "Beijing, Shanghai, Singapore, Manila, Taipei, Hong Kong"  4. show fail  **Attu version:** 2.6.3   
  **Post-Mortem & Fix Analysis**:
  > what's your milvus version? 
  > 2.6.6
  > https://github.com/zilliztech/attu/releases/tag/v2.6.4

- **Issue #785** (2025-03-06): **bug 点击创建用户的时候会提示Cannot read properties of undefined (reading 'roles')**
  *Symptoms*: **Describe the bug:**  点击创建用户的时候会提示Cannot read properties of undefined (reading 'roles') 真实的原因是因为注册用户密码不符合要求 导致下一个接口异常 中间少了注册的接口判断  **Steps to reproduce:**  ![Image](https://github.com/user-attachments/assets/b17b1bea-ef6a-4454-a5b4-10718012b64e)  1.curl 'http://127.0.0.1:8000/api/v1/users' \   -H 'Accept: application/json, text/plain, */*' \   -H 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5' \   -H 'Connection: keep-alive' \   -H 'Content-Type: application/json' \   -H 'DNT: 1' \   -H 'Origin: http://127.0.0.1:8000' \   -H 'Sec-Fetch-Dest: empty' \   -H 'Sec-Fetch-Mode: cors' \   -H 'Sec-Fetch-Site: same-origin' \   -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0' \   -H 'milvus-client-id: 5xzqfe' \   -H 'sec-ch-ua: "Not(A:Brand";v="99", "Microsoft Edge";v="133", "Chromium";v="133"' \   -H 'sec-ch-ua-mobile: ?0' \   -H 'sec-ch-ua-platform: "macOS"' \   -H 'x-attu-database: test' \   --data-raw '{"username":"test","password":"test","roles":["test","admin"]}' {     "data": {         "extra_info": {},         "error_code": "IllegalArgument",         "reason": "invalid password length: invalid parameter[4 out of range 6 <= value <= 72]",         "code": 1100,         "retriable": false,         "detail": "invalid password length: invalid parameter[4 out of range 6 <= value <= 72]"     },     "statusCode": 200 } 2.curl 'http://127.0.0.1:8000/api/v1/
  **Post-Mortem & Fix Analysis**:
  > 这里的根本原因是你的password太短了，导致了milvus创建用户失败，下个版本attu会做一些提示和限制。 
  > > 这里的根本原因是你的password太短了，导致了milvus创建用户失败，下个版本attu会做一些提示和限制。  是的 我修复了
  > 我已经修了：）

- **Issue #519** (2024-05-29): **Blank page when clicking on "Vector Search"**
  *Symptoms*: **Describe the bug:** Hey,   When you are in the view of the Collection Overview, if you click on the button "Vector Search" next to the status of the collection, it will redirect you to a blank page and won't load anything. The solution to fix that is to restart Attu.  This doesn't happen if if click on Vector Search next to the "Overview" button.    **Steps to reproduce:** 1. Connect to Milvus DB 2. Click on an exisiting collection you have  3. In the Overview tab, next to "status", click on the "Vector Search" button.   **Attu version:** 2.4.0   <img width="1204" alt="image" src="https://github.com/zilliztech/attu/assets/6506810/fc80fef1-809a-46a0-b8be-61c0af403f05"> 
  **Post-Mortem & Fix Analysis**:
  > Oh, electron version's problem. 

- **Issue #496** (2024-05-28): **Filter Expression bug of varchar in/not in logic**
  *Symptoms*: **Describe the bug:** In Advanced Filter, when select a VarChar column, use in/not in Logic, Value use ["a", "b"], the expression will add "" to Value.  Ex. bot_id, VarChar in/not in, Logic ["a", "b"], Value the above expression will be: bot_id in "["a", "b"]", it's falut.  ![WX20240507-192922@2x](https://github.com/zilliztech/attu/assets/436187/d2487d9e-59c0-4b8d-9283-633724b4f1ea)  **Attu version:** v 2.3.10 and earlier version. 

- **Issue #467** (2024-04-09): **attu2.3.9 删除自定义数据库，default数据库下的collection不可见**
  *Symptoms*: **Describe the bug:** V2.4.0-Rc.1版本的milvus搭配attu2.3.9 ,删除了自定义的数据库时，删除成功后，default数据库下的collection 会出现看不到的情况，重新登录attu才能看到default下的collection  **Steps to reproduce:** 1. 2. 3.  **Attu version:** 2.3.9  **Milvus version:** V2.4.0-Rc.1
  **Post-Mortem & Fix Analysis**:
  > Thanks for the ticket, I will fix it soon.   By the way, attu doesn't support all new features for milvus 2.4 yet.

- **Issue #432** (2024-03-25): **sort bug for number: 5.456623109086067e-13 in milvus 2.3.1**
  *Symptoms*: **Describe the bug:**  ![image](https://github.com/zilliztech/attu/assets/27683687/9eb1dbd0-d56b-4370-8f67-3dde9e3b4d95) 
  **Post-Mortem & Fix Analysis**:
  > ok, I will take a look at this. 

- **Issue #410** (2024-03-07): **can't copy "Dynamic Fields" in a collection's one record**
  *Symptoms*: **Describe the bug:** When click 'copy' "Dynamic Fields", after I paste it, the result turns out to be: [object Object], which is unexpected:  **Steps to reproduce:** 1.click 'copy':  <img width="387" alt="image" src="https://github.com/zilliztech/attu/assets/35756575/60bb36c8-bb2f-4348-ac7e-e57828c7779a">  2.paste:  <img width="193" alt="image" src="https://github.com/zilliztech/attu/assets/35756575/27056ed4-4c2b-4e81-887f-d6c66c69b55e">  3.but if a click 3 times of 'Dynamic Fields' then paste, the result is the expected one:  <img width="690" alt="image" src="https://github.com/zilliztech/attu/assets/35756575/3bfb9a84-c318-4b6c-b1e7-6a42bf587e3f">  **Attu version:** 2.3.8 
  **Post-Mortem & Fix Analysis**:
  > thanks! Which version should I use to avoid this bug?

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

### Incident Patch 1: `9ffe1a1a` (2026-09-04)
**Commit Message**: fix(k8s): align Attu volume permissions

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `attu-k8s-deploy.yaml` (modified, +7/-1)
```diff
@@ -30,9 +30,15 @@ spec:
       labels:
         app: attu
     spec:
+      securityContext:
+        runAsNonRoot: true
+        runAsUser: 1000
+        runAsGroup: 1000
+        fsGroup: 1000
+        fsGroupChangePolicy: OnRootMismatch
       containers:
       - name: attu
-        image: zilliz/attu:v3.0.0-beta.6
+        image: zilliz/attu:v3.0.0
         imagePullPolicy: IfNotPresent
         ports:
         - name: attu
```

**File**: `deploy/attu-k8s-deploy.yaml` (modified, +7/-1)
```diff
@@ -30,9 +30,15 @@ spec:
       labels:
         app: attu
     spec:
+      securityContext:
+        runAsNonRoot: true
+        runAsUser: 1000
+        runAsGroup: 1000
+        fsGroup: 1000
+        fsGroupChangePolicy: OnRootMismatch
       containers:
       - name: attu
-        image: zilliz/attu:v3.0.0-beta.6
+        image: zilliz/attu:v3.0.0
         imagePullPolicy: IfNotPresent
         ports:
         - name: attu
```

---

### Incident Patch 2: `dfbc1c4a` (2026-05-13)
**Commit Message**: docs: add local milvus mtls docker guide

Signed-off-by: shanghaikid <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +8/-2)
```diff
@@ -179,12 +179,18 @@ Mount your certificate files and set the corresponding environment variables:
 ```bash
 docker run -d --name attu \
   -p 3000:3000 \
-  -v /path/to/certs:/certs \
+  -v /path/to/certs:/etc/attu/certs:ro \
   -e MILVUS_ADDRESS=milvus:19530 \
   -e MILVUS_SSL=true \
-  zilliz/attu:v3.0.0-beta.1
+  -e MILVUS_TLS_ROOT_CERT_PATH=/etc/attu/certs/ca.pem \
+  -e MILVUS_TLS_PRIVATE_KEY_PATH=/etc/attu/certs/client.key \
+  -e MILVUS_TLS_CERT_CHAIN_PATH=/etc/attu/certs/client.pem \
+  -e MILVUS_TLS_SERVER_NAME=milvus \
+  zilliz/attu:v3.0.0-beta.4
 ```
 
+See [Run Attu with local Milvus mutual TLS in Docker](./docs/milvus-mtls-local-docker.md) for a complete local mTLS setup, including certificate generation, Milvus Docker Compose configuration, and verification.
+
 ### Kubernetes
 
 ```bash
```

**File**: `docs/milvus-mtls-local-docker.md` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+# Run Attu with local Milvus mutual TLS in Docker
+
+This guide shows how to run Attu against a local Milvus standalone deployment with mutual TLS (mTLS) enabled. It is intended for local development and verification.
+
+Tested with:
+
+- `milvusdb/milvus:v3.0-beta`
+- `zilliz/attu:v3.0.0-beta.4`
+- A Docker Compose Milvus deployment using the Docker network named `milvus`
+
+> Do not reuse these self-signed certificate commands for production as-is. For production, use certificates issued and rotated by your organization's CA or secret-management system.
+
+## 1. Generate local TLS certificates
+
+The commands below create a local CA, a Milvus server certificate, and an Attu client certificate under `~/workspace/volumes/milvus/tls`.
+
+The server certificate includes `standalone` in the Subject Alternative Name (SAN), because the Attu container connects to Milvus through Docker DNS at `standalone:19530` in the examples below.
+
+```bash
+CERT_DIR="$HOME/workspace/volumes/milvus/tls"
+mkdir -p "$CERT_DIR"
+
+cat > "$CERT_DIR/openssl.cnf" <<'EOF'
+[ req ]
+default_bits = 2048
+prompt = no
+default_md = sha256
+distinguished_name = dn
+req_extensions = v3_req
+
+[ dn ]
+C = US
+ST = CA
+L = Local
+O = Milvus Local Test
+OU = Attu TLS Test
+CN = milvus-standalone
+
+[ v3_ca ]
+subjectKeyIdentifier = hash
+authorityKeyIdentifier = keyid:always,issuer
+basicConstraints = critical, CA:true
+keyUsage = critical, digitalSignature, cRLSign, keyCertSign
+
+[ v3_req ]
+basicConstraints = CA:false
+keyUsage = critical, digitalSignature, keyEncipherment
+extendedKeyUsage = serverAuth
+subjectAltName = @alt_names
+
+[ alt_names ]
+DNS.1 = milvus-standalone
+DNS.2 = standalone
+DNS.3 = localhost
+DNS.4 = milvus
+DNS.5 = host.docker.internal
+IP.1 = 127.0.0.1
+IP.2 = ::1
+
+[ v3_client ]
+basicConstraints = CA:false
+keyUsage = critical, digitalSignature, keyEncipherment
+extendedKeyUsage = clientAuth
+EOF
+
+openssl genrsa -out "$CERT_DIR/ca.key" 4096
+openssl req -x509 -new -nodes -key "$CERT_DIR/ca.key" -sha256 -days 3650 \
+  -subj "/C=US/ST=CA/L=Local/O=Milvus Local Test/OU=Attu TLS Test/CN=Milvus Local Test CA" \
+  -out "$CERT_DIR/ca.pem" \
+  -extensions v3_ca -config "$CERT_DIR/openssl.cnf"
+
+openssl genrsa -out "$CERT_DIR/server.key" 2048
+openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
+  -subj "/C=US/ST=CA/L=Local/O=Milvus Local Test/OU=Attu TLS Test/CN=milvus-standalone" \
+  -config "$CERT_DIR/openssl.cnf"
+openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
+  -out "$CERT_DIR/server.pem" -days 3650 -sha256 -extensions v3_req -extfile "$CERT_DIR/openssl.cnf"
+
+openssl genrsa -out "$CERT_DIR/client.key" 2048
+openssl req -new -key "$CERT_DIR/client.key" -out "$CERT_DIR/client.csr" \
+  -subj "/C=US/ST=CA/L=Local/O=Milvus Local Test/OU=Attu TLS Test/CN=attu-client" \
+  -config "$CERT_DIR/openssl.cnf"
+openssl x509 -req -in "$CERT_DIR/client.csr" -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
+  -out "$CERT_DIR/client.pem" -days 3650 -sha256 -extensions v3_client -extfile "$CERT_DIR/openssl.cnf"
+
+chmod 755 "$CERT_DIR"
+chmod 644 "$CERT_DIR"/*.pem "$CERT_DIR"/*.key
+ls -l "$CERT_DIR"
+```
+
+Expected files:
+
+- `ca.pem` — CA certificate used by Attu to verify Milvus.
+- `server.pem` / `server.key` — Milvus server certificate and private key.
+- `client.pem` / `client.key` — Attu client certificate and private key for mTLS.
+
+## 2. Enable mTLS in Milvus Docker Compose
+
+In the Milvus `docker-compose.yml`, configure the `standalone` service to enable two-way TLS and point Milvus at the certificate files mounted under `/var/lib/milvus/tls`.
+
+Example `standalone` service fragment:
+
+```yaml
+services:
+  standalone:
+    container_name: milvus-standalone
+    image: milvusdb/milvus:v3.0-beta
+    command: ["milvus", "run", "standalone"]
+    security_opt:
+      - seccomp:unconfined
+    environment:
+      ETCD_ENDPOINTS: etcd:2379
+      MINIO_ADDRESS: minio:9000
+      MQ_TYPE: woodpecker
+      COMMON_SECURITY_TLSMODE: 2
+      PROXY_HTTP_ENABLED: "false"
+      TLS_SERVERPEMPATH: /var/lib/milvus/tls/server.pem
+      TLS_SERVERKEYPATH: /var/lib/milvus/tls/server.key
+      TLS_CAPEMPATH: /var/lib/milvus/tls/ca.pem
+    volumes:
+      - ${DOCKER_VOLUME_DIRECTORY:-.}/volumes/milvus:/var/lib/milvus
+    ports:
+      - "19530:19530"
+      - "9091:9091"
+    depends_on:
+      - etcd
+      - minio
+
+networks:
+  default:
+    name: milvus
+```
+
+Notes:
+
+- `COMMON_SECURITY_TLSMODE: 2` enables Milvus external gRPC mutual TLS.
+- `TLS_SERVERPEMPATH`, `TLS_SERVERKEYPATH`, and `TLS_CAPEMPATH` configure the server cert/key and CA.
+- `PROXY_HTTP_ENABLED: "false"` avoids Milvus trying to share the same port for proxy HTTP and external gRPC when TLS mode is enabled.
+- The Compose network name is `milvus`; Attu joins this network in the `docker run` command below.
+
+Restart Milvus:
```

---

### Incident Patch 3: `2408cd49` (2026-04-08)
**Commit Message**: docs: rewrite nginx deploy guide for Attu v3

**File**: `deploy/nginx/README.md` (modified, +49/-271)
```diff
@@ -1,257 +1,64 @@
-# Nginx Proxy Configuration for Attu
+# Nginx Reverse Proxy for Attu
 
-Nginx configuration files and scripts to run Attu behind an nginx reverse proxy with WebSocket support.
+Nginx configuration to run Attu behind a reverse proxy.
 
-## Quick Start (Testing)
+Attu v3 is a standard HTTP server — no special WebSocket or Socket.IO configuration is required.
 
-For quick testing with Docker containers:
-
-### Root Path Proxy
+## Quick Start
 
 ```bash
-cd nginx
+cd deploy/nginx
 chmod +x run-attu-standalone.sh
 ./run-attu-standalone.sh
 ```
 
-Access attu at `http://localhost:8080`
-
-### Subdirectory Proxy
-
-```bash
-cd nginx
-chmod +x run-attu.sh
-./run-attu.sh
-```
-
-Access attu at `http://localhost:8080/attu`
+Access Attu at `http://localhost:8080`.
 
 ## Production Deployment
 
-### Option 1: Root Path Proxy
-
-If you want to access Attu at the root path (e.g., `https://your-domain.com`):
-
-1. **Copy the configuration**:
-
-   ```bash
-   cp nginx.conf /etc/nginx/sites-available/attu
-   ```
-
-2. **Modify the upstream server**:
-   Edit `/etc/nginx/sites-available/attu` and update the upstream block:
-
-   ```nginx
-   upstream attu_backend {
-       server localhost:3000;  # Change to your attu server address
-       keepalive 64;
-   }
-   ```
-
-3. **Update server settings**:
-
-   ```nginx
-   server {
-       listen 80;
-       server_name your-domain.com;  # Change to your domain
-       # ... rest of configuration
-   }
-   ```
-
-4. **Enable the site**:
-
-   ```bash
-   ln -s /etc/nginx/sites-available/attu /etc/nginx/sites-enabled/
-   nginx -t
-   systemctl reload nginx
-   ```
-
-5. **Start Attu** (if not already running):
-   ```bash
-   docker run -d \
-     --name attu \
-     -p 3000:3000 \
-     -e MILVUS_URL=your-milvus-host:19530 \
-     zilliz/attu:v2.6.3
-   ```
-
-### Option 2: Subdirectory Proxy (Recommended)
-
-If you want to access Attu at a subdirectory (e.g., `https://your-domain.com/attu`):
-
-1. **Copy the configuration**:
-
-   ```bash
-   cp nginx-attu-subpath.conf /etc/nginx/sites-available/attu
-   ```
+### 1. Copy the configuration
 
-2. **Modify the upstream server**:
-   Edit `/etc/nginx/sites-available/attu`:
-
-   ```nginx
-   upstream attu_backend {
-       server localhost:3000;  # Change to your attu server address
-       keepalive 64;
-   }
-   ```
-
-3. **Update the subdirectory path** (if not using `/attu`):
-   Replace all occurrences of `/attu` with your desired path (e.g., `/milvus/attu`):
-
-   ```nginx
-   location /your-path/socket.io/ {
-       rewrite ^/your-path/(.*) /$1 break;
-       # ...
-   }
-   ```
-
-4. **Update server settings**:
-
-   ```nginx
-   server {
-       listen 80;
-       server_name your-domain.com;  # Change to your domain
-       # ... rest of configuration
-   }
-   ```
-
-5. **Enable the site**:
-
-   ```bash
-   ln -s /etc/nginx/sites-available/attu /etc/nginx/sites-enabled/
-   nginx -t
-   systemctl reload nginx
-   ```
-
-6. **Start Attu with HOST_URL**:
-
-   ```bash
-   docker run -d \
-     --name attu \
-     -p 3000:3000 \
-     -e MILVUS_URL=your-milvus-host:19530 \
-     -e HOST_URL=/attu \
-     zilliz/attu:v2.6.3
-   ```
-
-   **Important**: The `HOST_URL` must match the nginx subdirectory path.
-
-### Integrating into Existing Nginx Configuration
-
-If you already have an nginx configuration file, add the following blocks:
-
-**For root path proxy**, add these location blocks to your existing `server` block:
-
-```nginx
-# WebSocket and Socket.IO support
-location /socket.io/ {
-    proxy_pass http://attu_backend;
-    proxy_http_version 1.1;
-    proxy_set_header Upgrade $http_upgrade;
-    proxy_set_header Connection "upgrade";
-    proxy_set_header Host $host;
-    proxy_set_header X-Real-IP $remote_addr;
-    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
-    proxy_set_header X-Forwarded-Proto $scheme;
-    proxy_read_timeout 86400s;
-    proxy_send_timeout 86400s;
-    proxy_buffering off;
-}
-
-# API endpoints
-location /api/ {
-    proxy_pass http://attu_backend;
-    proxy_http_version 1.1;
-    proxy_set_header Host $host;
-    proxy_set_header X-Real-IP $remote_addr;
-    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
-    proxy_set_header X-Forwarded-Proto $scheme;
-    proxy_read_timeout 300s;
-}
-
-# Frontend
-location / {
-    proxy_pass http://attu_backend;
-    proxy_http_version 1.1;
-    proxy_set_header Host $host;
-    proxy_set_header X-Real-IP $remote_addr;
-    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
-    proxy_set_header X-Forwarded-Proto $scheme;
-    proxy_set_header Upgrade $http_upgrade;
-    proxy_set_header Connection $connection_upgrade;
-}
+```bash
+cp nginx.conf /etc/nginx/sites-available/attu
 ```
 
-**For subdirectory proxy**, add these location blocks:
+### 2. Edit the upstream server
 
 ```nginx
-location /attu/socket.io/ {
-    rewrite ^/attu/(.*) /$1 break;
-    proxy_pass http://attu_backend;
-    # 
```

---

### Incident Patch 4: `360005bd` (2025-12-09)
**Commit Message**: fix: attu-k8s-deploy.yaml

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `attu-k8s-deploy.yaml` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+apiVersion: v1
+kind: Service
+metadata:
+  name: my-attu-svc
+  labels:
+    app: attu
+spec:
+  type: ClusterIP
+  ports:
+  - name: attu
+    protocol: TCP
+    port: 3000
+    targetPort: 3000
+  selector:
+    app: attu
+---
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: my-attu
+  labels:
+    app: attu
+spec:
+  replicas: 1
+  selector:
+    matchLabels:
+      app: attu
+  template:
+    metadata:
+      labels:
+        app: attu
+    spec:
+      containers:
+      - name: attu
+        image: zilliz/attu:v2.6
+        imagePullPolicy: IfNotPresent
+        ports:
+        - name: attu
+          containerPort: 3000
+          protocol: TCP
+        env:
+        - name: MILVUS_URL
+          value: "my-release-milvus:19530"
\ No newline at end of file
```

---

### Incident Patch 5: `92575a75` (2025-06-25)
**Commit Message**: fix: can not connect with `http` prefix (#940)

Signed-off-by: shanghaikid <[REDACTED_EMAIL]>

**File**: `client/src/pages/connect/AuthForm.tsx` (modified, +132/-20)
```diff
@@ -31,6 +31,12 @@ type Connection = AuthReq & {
   time: number;
 };
 
+// Utility function to clean address by preserving protocol prefixes
+const cleanAddress = (address: string): string => {
+  // Keep http:// or https:// prefixes, just trim whitespace
+  return address.trim();
+};
+
 // Parse server list from environment variables
 const parseFixedConnections = (): Connection[] => {
   const serverList = MILVUS_SERVERS || '';
@@ -115,16 +121,46 @@ export const AuthForm = () => {
     value: string | boolean
   ) => {
     if (key === 'address' && typeof value === 'string') {
+      // Clean the address by preserving protocol prefixes
+      const cleanedAddress = cleanAddress(value);
+
       // Check if address contains database name (format: address/database)
-      const parts = value.split('/');
-      if (parts.length === 2) {
-        setAuthReq(v => ({
-          ...v,
-          address: parts[0],
-          database: parts[1],
-        }));
-        return;
+      // Handle URLs with protocols like http://127.0.0.1:19530/default
+      if (
+        cleanedAddress.includes('/') &&
+        !cleanedAddress.startsWith('http://') &&
+        !cleanedAddress.startsWith('https://')
+      ) {
+        // Simple format without protocol: address/database
+        const parts = cleanedAddress.split('/');
+        if (parts.length === 2) {
+          setAuthReq(v => ({
+            ...v,
+            address: parts[0],
+            database: parts[1],
+          }));
+          return;
+        }
+      } else if (
+        cleanedAddress.includes('/') &&
+        (cleanedAddress.startsWith('http://') ||
+          cleanedAddress.startsWith('https://'))
+      ) {
+        // URL format with protocol: http://address:port/database or https://address:port/database
+        const urlMatch = cleanedAddress.match(/^(https?:\/\/[^\/]+)\/(.+)$/);
+        if (urlMatch) {
+          setAuthReq(v => ({
+            ...v,
+            address: urlMatch[1],
+            database: urlMatch[2],
+          }));
+          return;
+        }
       }
+
+      // Set the cleaned address without database parsing
+      setAuthReq(v => ({ ...v, address: cleanedAddress }));
+      return;
     }
     setAuthReq(v => ({ ...v, [key]: value }));
   };
@@ -401,12 +437,50 @@ export const AuthForm = () => {
             if (newValue) {
               if (typeof newValue === 'string') {
                 // Handle free text input
-                const [address, database] = newValue.split('/');
-                setAuthReq(v => ({
-                  ...v,
-                  address: address.trim(),
-                  database: database?.trim() || MILVUS_DATABASE,
-                }));
+                const cleanedValue = cleanAddress(newValue);
+
+                // Handle URLs with protocols like http://127.0.0.1:19530/default
+                if (
+                  cleanedValue.includes('/') &&
+                  !cleanedValue.startsWith('http://') &&
+                  !cleanedValue.startsWith('https://')
+                ) {
+                  // Simple format without protocol: address/database
+                  const [address, database] = cleanedValue.split('/');
+                  setAuthReq(v => ({
+                    ...v,
+                    address: address.trim(),
+                    database: database?.trim() || MILVUS_DATABASE,
+                  }));
+                } else if (
+                  cleanedValue.includes('/') &&
+                  (cleanedValue.startsWith('http://') ||
+                    cleanedValue.startsWith('https://'))
+                ) {
+                  // URL format with protocol: http://address:port/database or https://address:port/database
+                  const urlMatch = cleanedValue.match(
+                    /^(https?:\/\/[^\/]+)\/(.+)$/
+                  );
+                  if (urlMatch) {
+                    setAuthReq(v => ({
+                      ...v,
+                      address: urlMatch[1],
+                      database: urlMatch[2],
+                    }));
+                  } else {
+                    setAuthReq(v => ({
+                      ...v,
+                      address: cleanedValue,
+                      database: MILVUS_DATABASE,
+                    }));
+                  }
+                } else {
+                  setAuthReq(v => ({
+                    ...v,
+                    address: cleanedValue,
+                    database: MILVUS_DATABASE,
+                  }));
+                }
               } else {
                 handleClickOnHisotry(newValue);
               }
@@ -423,12 +497,50 @@ export const AuthForm = () => {
               handleClickOnHisotry(matchingConnection);
             } else if (newInputValue) {
               // Handle free text input
-              const [address, database] = newInputValue.split('/');
-              setAuthReq(v => ({
-                ...v,
-                address: address.trim()
```

**File**: `server/src/milvus/milvus.service.ts` (modified, +23/-5)
```diff
@@ -39,13 +39,29 @@ export class MilvusService {
     // Format the address to remove the http prefix
     const milvusAddress = MilvusService.formatAddress(address);
 
-    // if client exists, return the client
+    // if client exists, validate the connection before returning
     if (clientCache.has(clientId)) {
       const cache = clientCache.get(clientId);
-      return {
-        clientId: cache.milvusClient.clientId,
-        database: cache.database,
-      };
+      try {
+        // validate the cached client is still connected and healthy
+        if (checkHealth) {
+          const healthRes = await cache.milvusClient.checkHealth();
+          if (!healthRes.isHealthy) {
+            // remove unhealthy client from cache
+            clientCache.delete(clientId);
+            throw new Error('Cached client is not healthy');
+          }
+        }
+
+        return {
+          clientId: cache.milvusClient.clientId,
+          database: cache.database,
+        };
+      } catch (error) {
+        // if cached client validation fails, remove it and continue with new connection
+        clientCache.delete(clientId);
+        console.warn(`Cached client validation failed for ${clientId}, creating new connection`);
+      }
     }
 
     try {
@@ -120,7 +136,9 @@ export class MilvusService {
         await milvusClient.use({ db_name: db });
         await milvusClient.listDatabases();
       } catch (e) {
+        // ensure proper cleanup on permission failure
         await milvusClient.closeConnection();
+        clientCache.delete(milvusClient.clientId);
         throw HttpErrors(
           HTTP_STATUS_CODE.FORBIDDEN,
           `You don't have permission to access the database: ${db}.`
```

---

### Incident Patch 6: `e0a3758e` (2025-06-20)
**Commit Message**: ui: update search page grid

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/databases/collections/search/Search.tsx` (modified, +1/-11)
```diff
@@ -345,17 +345,6 @@ const Search = (props: CollectionDataProps) => {
                   />
                 );
               },
-              getStyle: d => {
-                const field = collection.schema.fields.find(
-                  f => f.name === key
-                );
-                if (!d || !field) {
-                  return {};
-                }
-                return {
-                  minWidth: getColumnWidth(field),
-                };
-              },
             };
           })
       : [];
@@ -644,6 +633,7 @@ const Search = (props: CollectionDataProps) => {
                 sx={{
                   height: 'calc(100% - 64px)',
                 }}
+                addSpacerColumn={true}
                 toolbarConfigs={[]}
                 colDefinitions={colDefinitions}
                 rows={result}
```

---

### Incident Patch 7: `7cca991e` (2025-06-20)
**Commit Message**: fix: search page refresh error

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/components/advancedSearch/Filter.tsx` (modified, +9/-2)
```diff
@@ -1,4 +1,4 @@
-import { forwardRef, useState, useEffect, useImperativeHandle } from 'react';
+import { forwardRef, useState, useEffect, useImperativeHandle, useRef } from 'react';
 import Chip from '@mui/material/Chip';
 import Tooltip from '@mui/material/Tooltip';
 import { Box } from '@mui/material';
@@ -30,6 +30,9 @@ const Filter = forwardRef((props: FilterProps, ref) => {
   const [initConditions, setInitConditions] = useState<any[]>([]);
   const [isConditionsLegal, setIsConditionsLegal] = useState(false);
   const [filterExpression, setFilterExpression] = useState('');
+  
+  // Use ref to track previous expression to prevent unnecessary updates
+  const prevExpressionRef = useRef<string>('');
 
   const FilterIcon = icons.filter;
 
@@ -57,7 +60,11 @@ const Filter = forwardRef((props: FilterProps, ref) => {
       }
     }
     setIsConditionsLegal(true);
-    generateExpression(flatConditions, setFilterExpression);
+    
+    // Only generate expression if conditions are legal
+    if (flatConditions.length > 0) {
+      generateExpression(flatConditions, setFilterExpression);
+    }
   }, [flatConditions]);
 
   const setFilteredFlatConditions = (conditions: any[]) => {
```

**File**: `client/src/pages/databases/collections/data/OptimizedInput.tsx` (modified, +26/-8)
```diff
@@ -1,4 +1,4 @@
-import { useCallback, useState, useEffect } from 'react';
+import { useCallback, useState, useEffect, useRef } from 'react';
 import { useTranslation } from 'react-i18next';
 import CustomInput from '@/components/customInput/CustomInput';
 import Filter from '@/components/advancedSearch';
@@ -24,32 +24,50 @@ const OptimizedInput = ({
   const { t: collectionTrans } = useTranslation('collection');
   const [localValue, setLocalValue] = useState(value);
 
+  // Use refs to stabilize function calls
+  const onChangeRef = useRef(onChange);
+  const onSubmitRef = useRef(onSubmit);
+  const onKeyDownRef = useRef(onKeyDown);
+
+  // Update refs when props change
+  useEffect(() => {
+    onChangeRef.current = onChange;
+  }, [onChange]);
+
+  useEffect(() => {
+    onSubmitRef.current = onSubmit;
+  }, [onSubmit]);
+
+  useEffect(() => {
+    onKeyDownRef.current = onKeyDown;
+  }, [onKeyDown]);
+
   useEffect(() => {
     setLocalValue(value);
   }, [value]);
 
   const handleChange = useCallback(
     (newValue: string) => {
       setLocalValue(newValue);
-      onChange(newValue);
+      onChangeRef.current(newValue);
     },
-    [onChange]
+    [] // Remove dependencies since we use refs
   );
 
   const handleKeyDown = useCallback(
     (e: any) => {
-      onKeyDown(e);
+      onKeyDownRef.current(e);
     },
-    [onKeyDown]
+    [] // Remove dependencies since we use refs
   );
 
   const handleFilterSubmit = useCallback(
     (expression: string) => {
       setLocalValue(expression);
-      onChange(expression);
-      onSubmit(expression);
+      onChangeRef.current(expression);
+      onSubmitRef.current(expression);
     },
-    [onChange, onSubmit]
+    [] // Remove dependencies since we use refs
   );
 
   return (
```

**File**: `client/src/pages/databases/collections/search/Search.tsx` (modified, +126/-140)
```diff
@@ -1,17 +1,10 @@
-import {
-  useState,
-  useMemo,
-  ChangeEvent,
-  useCallback,
-  useEffect,
-  useRef,
-  useContext,
-} from 'react';
+import { useState, useMemo, ChangeEvent, useCallback, useContext } from 'react';
 import { Typography, AccordionSummary, Checkbox } from '@mui/material';
 import { useTranslation } from 'react-i18next';
 import { DataService, CollectionService } from '@/http';
 import Icons from '@/components/icons/Icons';
 import AttuGrid from '@/components/grid/Grid';
+import Filter from '@/components/advancedSearch';
 import EmptyCard from '@/components/cards/EmptyCard';
 import CustomButton from '@/components/customButton/CustomButton';
 import { getLabelDisplayedRows } from '@/pages/search/Utils';
@@ -20,14 +13,15 @@ import SearchGlobalParams from './SearchGlobalParams';
 import VectorInputBox from './SearchInputBox';
 import StatusIcon, { LoadingType } from '@/components/status/StatusIcon';
 import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
-import OptimizedInput from '../data/OptimizedInput';
+import CustomInput from '@/components/customInput/CustomInput';
 import PartitionsSelector from './PartitionsSelector';
 import {
   formatFieldType,
   cloneObj,
   generateVectorsByField,
   saveCsvAs,
   buildSearchParams,
+  getColumnWidth,
 } from '@/utils';
 import SearchParams from './SearchParams';
 import DataExplorer, { formatMilvusData } from './DataExplorer';
@@ -59,7 +53,7 @@ import {
   CheckboxRow,
   LeftSection,
 } from './StyledComponents';
-import { authContext } from '@/context/Auth';
+import { authContext } from '@/context';
 
 export interface CollectionDataProps {
   collectionName: string;
@@ -74,7 +68,7 @@ const emptyExplorerData: GraphData = {
 };
 
 const Search = (props: CollectionDataProps) => {
-  // context
+  // auth context
   const { isManaged } = useContext(authContext);
 
   // props
@@ -87,45 +81,15 @@ const Search = (props: CollectionDataProps) => {
   const [tableLoading, setTableLoading] = useState<boolean>();
   const [highlightField, setHighlightField] = useState<string>('');
   const [explorerOpen, setExplorerOpen] = useState<boolean>(false);
-  const [localFilterValue, setLocalFilterValue] = useState<string>('');
-
-  // Use ref to track searchParams changes without causing re-renders
-  const searchParamsRef = useRef(searchParams);
-  searchParamsRef.current = searchParams;
-
-  // Memoize collection to avoid unnecessary re-renders
-  const memoizedCollection = useMemo(
-    () => collection,
-    [collection?.collection_name]
-  );
-
-  // Memoize selected fields to avoid recalculation
-  const selectedFields = useMemo(
-    () => searchParams.searchParams.filter(s => s.selected),
-    [searchParams.searchParams]
-  );
-
-  // Memoize enablePartitionsFilter
-  const enablePartitionsFilter = useMemo(
-    () => !collection.schema.enablePartitionKey,
-    [collection.schema.enablePartitionKey]
-  );
 
   // translations
   const { t: searchTrans } = useTranslation('search');
   const { t: btnTrans } = useTranslation('btn');
 
-  // Sync local filter value with searchParams on mount and when searchParams change
-  useEffect(() => {
-    if (searchParams?.globalParams?.filter !== undefined) {
-      setLocalFilterValue(searchParams.globalParams.filter);
-    }
-  }, [searchParams?.globalParams?.filter]);
-
-  // UI functions - optimized with better dependencies
+  // UI functions
   const handleExpand = useCallback(
     (panel: string) => (event: ChangeEvent<{}>, expanded: boolean) => {
-      const s = cloneObj(searchParamsRef.current);
+      const s = cloneObj(searchParams);
       const target = s.searchParams.find((sp: SearchSingleParams) => {
         return sp.field.name === panel;
       });
@@ -135,54 +99,54 @@ const Search = (props: CollectionDataProps) => {
         setSearchParams({ ...s });
       }
     },
-    [setSearchParams]
+    [JSON.stringify(searchParams)]
   );
 
   const handleSelect = useCallback(
     (panel: string) => (event: ChangeEvent<{}>) => {
-      const s = cloneObj(searchParamsRef.current) as SearchParamsType;
+      const s = cloneObj(searchParams) as SearchParamsType;
       const target = s.searchParams.find(sp => {
         return sp.field.name === panel;
       });
       if (target) {
         target.selected = !target.selected;
+
         setSearchParams({ ...s });
       }
     },
-    [setSearchParams]
+    [JSON.stringify(searchParams)]
   );
 
   // update search params
   const updateSearchParamCallback = useCallback(
     (updates: SearchSingleParams, index: number) => {
-      const currentParams = searchParamsRef.current;
       if (
         JSON.stringify(updates) !==
-        JSON.stringify(currentParams.searchParams[index].params)
+        JSON.stringify(searchParams.searchParams[index].params)
       ) {
-        const s = cloneObj(currentParams);
+        const s = cloneObj(searchParams);
         // update the searchParams
         s.searchParams[index].params = updates;
      
```

---

### Incident Patch 8: `d17d3ba2` (2025-06-20)
**Commit Message**: fix: `level` search parameter is for zilliz cloud only (#934)

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/databases/collections/search/Search.tsx` (modified, +6/-0)
```diff
@@ -5,6 +5,7 @@ import {
   useCallback,
   useEffect,
   useRef,
+  useContext,
 } from 'react';
 import { Typography, AccordionSummary, Checkbox } from '@mui/material';
 import { useTranslation } from 'react-i18next';
@@ -58,6 +59,7 @@ import {
   CheckboxRow,
   LeftSection,
 } from './StyledComponents';
+import { authContext } from '@/context/Auth';
 
 export interface CollectionDataProps {
   collectionName: string;
@@ -72,6 +74,9 @@ const emptyExplorerData: GraphData = {
 };
 
 const Search = (props: CollectionDataProps) => {
+  // context
+  const { isManaged } = useContext(authContext);
+
   // props
   const { collections, collectionName, searchParams, setSearchParams } = props;
   const collection = collections.find(
@@ -507,6 +512,7 @@ const Search = (props: CollectionDataProps) => {
                         }) => {
                           updateSearchParamCallback(updates as any, index);
                         }}
+                        isManaged={isManaged}
                       />
                     </StyledAccordionDetails>
                   </StyledAccordion>
```

**File**: `client/src/pages/databases/collections/search/SearchParams.tsx` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@ const SearchParams: FC<SearchParamsProps> = ({
   indexType = '',
   searchParamsForm,
   handleFormChange,
+  isManaged,
   sx = {},
 }) => {
   // Get search params and their configs based on index type
@@ -35,7 +36,7 @@ const SearchParams: FC<SearchParamsProps> = ({
       },
     };
 
-    if (indexType === 'AUTOINDEX') {
+    if (indexType === 'AUTOINDEX' && isManaged) {
       commonParams.level = {
         label: 'level',
         key: 'level',
```

**File**: `client/src/pages/databases/collections/search/Types.ts` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ export interface SearchParamsProps {
     [key in string]: number | string | boolean;
   }) => void;
   sx?: SxProps<Theme>;
+  isManaged: boolean;
 }
 
 export interface SearchResultView {
```

---

### Incident Patch 9: `5b78a7a0` (2025-06-20)
**Commit Message**: ui: set default varchar max length to 1024

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/consts/default.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 export const DEFAULT_ATTU_MAX_CAPACITY = 64;
-export const DEFAULT_ATTU_VARCHAR_MAX_LENGTH = 32;
+export const DEFAULT_ATTU_VARCHAR_MAX_LENGTH = 1024;
 export const DEFAULT_ATTU_ELEMENT_TYPE = 4; // int32
 export const DEFAULT_ATTU_DIM = 128;
 export const MIN_INT64 = `-9223372036854775807`; // safe int64 min value
```

---

### Incident Patch 10: `283db00d` (2025-06-20)
**Commit Message**: pref: improve search page render performance

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/databases/collections/search/Search.tsx` (modified, +124/-78)
```diff
@@ -1,4 +1,11 @@
-import { useState, useMemo, ChangeEvent, useCallback } from 'react';
+import {
+  useState,
+  useMemo,
+  ChangeEvent,
+  useCallback,
+  useEffect,
+  useRef,
+} from 'react';
 import { Typography, AccordionSummary, Checkbox } from '@mui/material';
 import { useTranslation } from 'react-i18next';
 import { DataService, CollectionService } from '@/http';
@@ -75,15 +82,45 @@ const Search = (props: CollectionDataProps) => {
   const [tableLoading, setTableLoading] = useState<boolean>();
   const [highlightField, setHighlightField] = useState<string>('');
   const [explorerOpen, setExplorerOpen] = useState<boolean>(false);
+  const [localFilterValue, setLocalFilterValue] = useState<string>('');
+
+  // Use ref to track searchParams changes without causing re-renders
+  const searchParamsRef = useRef(searchParams);
+  searchParamsRef.current = searchParams;
+
+  // Memoize collection to avoid unnecessary re-renders
+  const memoizedCollection = useMemo(
+    () => collection,
+    [collection?.collection_name]
+  );
+
+  // Memoize selected fields to avoid recalculation
+  const selectedFields = useMemo(
+    () => searchParams.searchParams.filter(s => s.selected),
+    [searchParams.searchParams]
+  );
+
+  // Memoize enablePartitionsFilter
+  const enablePartitionsFilter = useMemo(
+    () => !collection.schema.enablePartitionKey,
+    [collection.schema.enablePartitionKey]
+  );
 
   // translations
   const { t: searchTrans } = useTranslation('search');
   const { t: btnTrans } = useTranslation('btn');
 
-  // UI functions
+  // Sync local filter value with searchParams on mount and when searchParams change
+  useEffect(() => {
+    if (searchParams?.globalParams?.filter !== undefined) {
+      setLocalFilterValue(searchParams.globalParams.filter);
+    }
+  }, [searchParams?.globalParams?.filter]);
+
+  // UI functions - optimized with better dependencies
   const handleExpand = useCallback(
     (panel: string) => (event: ChangeEvent<{}>, expanded: boolean) => {
-      const s = cloneObj(searchParams);
+      const s = cloneObj(searchParamsRef.current);
       const target = s.searchParams.find((sp: SearchSingleParams) => {
         return sp.field.name === panel;
       });
@@ -93,54 +130,54 @@ const Search = (props: CollectionDataProps) => {
         setSearchParams({ ...s });
       }
     },
-    [JSON.stringify(searchParams)]
+    [setSearchParams]
   );
 
   const handleSelect = useCallback(
     (panel: string) => (event: ChangeEvent<{}>) => {
-      const s = cloneObj(searchParams) as SearchParamsType;
+      const s = cloneObj(searchParamsRef.current) as SearchParamsType;
       const target = s.searchParams.find(sp => {
         return sp.field.name === panel;
       });
       if (target) {
         target.selected = !target.selected;
-
         setSearchParams({ ...s });
       }
     },
-    [JSON.stringify(searchParams)]
+    [setSearchParams]
   );
 
   // update search params
   const updateSearchParamCallback = useCallback(
     (updates: SearchSingleParams, index: number) => {
+      const currentParams = searchParamsRef.current;
       if (
         JSON.stringify(updates) !==
-        JSON.stringify(searchParams.searchParams[index].params)
+        JSON.stringify(currentParams.searchParams[index].params)
       ) {
-        const s = cloneObj(searchParams);
+        const s = cloneObj(currentParams);
         // update the searchParams
         s.searchParams[index].params = updates;
         setSearchParams({ ...s });
       }
     },
-    [JSON.stringify(searchParams)]
+    [setSearchParams]
   );
 
   // generate random vectors
   const genRandomVectors = useCallback(() => {
-    const s = cloneObj(searchParams) as SearchParamsType;
+    const s = cloneObj(searchParamsRef.current) as SearchParamsType;
     s.searchParams.forEach((sp: SearchSingleParams) => {
       sp.data = generateVectorsByField(sp.field) as any;
     });
 
     setSearchParams({ ...s });
-  }, [JSON.stringify(searchParams)]);
+  }, [setSearchParams]);
 
   // on vector input change, update the search params
   const onSearchInputChange = useCallback(
     (anns_field: string, value: string) => {
-      const s = cloneObj(searchParams) as SearchParamsType;
+      const s = cloneObj(searchParamsRef.current) as SearchParamsType;
       const target = s.searchParams.find((sp: SearchSingleParams) => {
         return sp.anns_field === anns_field;
       });
@@ -150,36 +187,29 @@ const Search = (props: CollectionDataProps) => {
         setSearchParams({ ...s });
       }
     },
-    [JSON.stringify(searchParams)]
+    [setSearchParams]
   );
 
-  // on filter change
-  const onFilterChange = useCallback(
-    (value: string) => {
-      const s = cloneObj(searchParams) as SearchParamsType;
-      s.globalParams.filter = value;
-      setSearchParams({ ...s });
-
-      return s;
-    },
-    [JSON.stringify(searchParams)]
-  );
+  // on filter change - only update local state, not searchParams
+  c
```

**File**: `client/src/pages/databases/collections/search/SearchGlobalParams.tsx` (modified, +0/-1)
```diff
@@ -199,7 +199,6 @@ const SearchGlobalParams = (props: SearchGlobalProps) => {
                     }),
                   },
                 ],
-                defaultValue: 60,
                 value: searchGlobalParams.rrfParams!.k,
               }}
               checkValid={() => true}
```

---

### Incident Patch 11: `2cf18bde` (2025-06-20)
**Commit Message**: fix: users and properties grid space

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/databases/collections/properties/Properties.tsx` (modified, +1/-0)
```diff
@@ -188,6 +188,7 @@ const Properties = (props: PropertiesProps) => {
     <Box sx={{ height: '100%' }}>
       <AttuGrid
         toolbarConfigs={toolbarConfigs}
+        addSpacerColumn={true}
         colDefinitions={colDefinitions}
         rows={data}
         rowCount={total}
```

**File**: `client/src/pages/user/User.tsx` (modified, +1/-0)
```diff
@@ -253,6 +253,7 @@ const Users = () => {
         colDefinitions={colDefinitions}
         rows={result}
         rowCount={total}
+        addSpacerColumn={true}
         primaryKey="username"
         showPagination={true}
         selected={selectedUser}
```

---

### Incident Patch 12: `06ce6d27` (2025-06-20)
**Commit Message**: fix: wrong field name if create a new vector field

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/dialogs/create/CreateFields.tsx` (modified, +27/-7)
```diff
@@ -136,16 +136,36 @@ const CreateFields: FC<CreateFieldsProps> = ({
   const handleAddNewField = (index: number, type = DataTypeEnum.Int16) => {
     const id = generateId();
 
-    // Count existing scalar fields to generate new index
-    let scalarFieldCount = fields.filter(
-      f => !f.is_primary_key && !VectorTypes.includes(f.data_type)
-    ).length;
-    let name = `scalar_field_${scalarFieldCount}`;
+    // Determine field type and generate appropriate name prefix
+    const isVector = VectorTypes.includes(type);
+    const isPrimaryKey = false; // New fields are never primary keys by default
+    
+    let fieldTypePrefix: string;
+    if (isPrimaryKey) {
+      fieldTypePrefix = 'primary_key';
+    } else if (isVector) {
+      fieldTypePrefix = 'vector';
+    } else {
+      fieldTypePrefix = 'scalar';
+    }
+
+    // Count existing fields of the same type to generate new index
+    let fieldCount = fields.filter(f => {
+      if (isPrimaryKey) {
+        return f.is_primary_key;
+      } else if (isVector) {
+        return VectorTypes.includes(f.data_type);
+      } else {
+        return !f.is_primary_key && !VectorTypes.includes(f.data_type);
+      }
+    }).length;
+    
+    let name = `${fieldTypePrefix}_${fieldCount}`;
 
     const existingNames = new Set(fields.map(f => f.name));
     while (existingNames.has(name)) {
-      scalarFieldCount += 1;
-      name = `scalar_field_${scalarFieldCount}`;
+      fieldCount += 1;
+      name = `${fieldTypePrefix}_${fieldCount}`;
     }
 
     const newDefaultItem: FieldType = {
```

**File**: `server/src/utils/Helper.ts` (modified, +12/-7)
```diff
@@ -44,27 +44,32 @@ export const makeRandomSparse = (dim: number) => {
 export const makeImageUrl = (): string => {
   const sizes = [
     '200x150',
-    '300x200', 
+    '300x200',
     '400x300',
     '500x400',
     '600x450',
     '800x600',
     '1024x768',
-    '1200x800'
+    '1200x800',
   ];
-  
+
   const formats = ['jpg', 'png', 'gif'];
-  
+
   const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
   const randomFormat = formats[Math.floor(Math.random() * formats.length)];
-  
+
   return `https://dummyimage.com/${randomSize}.${randomFormat}`;
 };
 
 export const makeRandomVarChar = (maxLength: number) => {
-  // 20% 的几率返回图片URL
+  // Check if we should generate URL (20% chance)
   if (Math.random() < 0.2) {
-    return makeImageUrl();
+    const imageUrl = makeImageUrl();
+    // Only return URL if it fits within maxLength
+    if (imageUrl.length <= maxLength) {
+      return imageUrl;
+    }
+    // If URL is too long, fall through to generate text instead
   }
 
   const words = [
```

---

### Incident Patch 13: `cca5c231` (2025-06-19)
**Commit Message**: fix: entering text in the search input box is very laggy (#932)

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/pages/databases/collections/search/Search.tsx` (modified, +14/-36)
```diff
@@ -4,7 +4,6 @@ import { useTranslation } from 'react-i18next';
 import { DataService, CollectionService } from '@/http';
 import Icons from '@/components/icons/Icons';
 import AttuGrid from '@/components/grid/Grid';
-import Filter from '@/components/advancedSearch';
 import EmptyCard from '@/components/cards/EmptyCard';
 import CustomButton from '@/components/customButton/CustomButton';
 import { getLabelDisplayedRows } from '@/pages/search/Utils';
@@ -13,15 +12,14 @@ import SearchGlobalParams from './SearchGlobalParams';
 import VectorInputBox from './SearchInputBox';
 import StatusIcon, { LoadingType } from '@/components/status/StatusIcon';
 import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
-import CustomInput from '@/components/customInput/CustomInput';
+import OptimizedInput from '../data/OptimizedInput';
 import PartitionsSelector from './PartitionsSelector';
 import {
   formatFieldType,
   cloneObj,
   generateVectorsByField,
   saveCsvAs,
   buildSearchParams,
-  getColumnWidth,
 } from '@/utils';
 import SearchParams from './SearchParams';
 import DataExplorer, { formatMilvusData } from './DataExplorer';
@@ -527,40 +525,20 @@ const Search = (props: CollectionDataProps) => {
           <SearchResults>
             <Toolbar>
               <div className="left">
-                <CustomInput
-                  type="text"
-                  textConfig={{
-                    label: searchTrans('filterExpr'),
-                    key: 'advFilter',
-                    className: 'textarea',
-                    onChange: onFilterChange,
-                    value: searchParams.globalParams.filter,
-                    disabled: explorerOpen,
-                    variant: 'filled',
-                    required: false,
-                    InputLabelProps: { shrink: true },
-                    InputProps: {
-                      endAdornment: (
-                        <Filter
-                          title={''}
-                          showTitle={false}
-                          fields={collection.schema.scalarFields}
-                          filterDisabled={explorerOpen}
-                          onSubmit={(value: string) => {
-                            onFilterChange(value);
-                          }}
-                          showTooltip={false}
-                        />
-                      ),
-                    },
-                    onKeyDown: (e: any) => {
-                      if (e.key === 'Enter') {
-                        e.preventDefault();
-                        onSearchClicked();
-                      }
-                    },
+                <OptimizedInput
+                  value={searchParams.globalParams.filter}
+                  onChange={onFilterChange}
+                  onKeyDown={(e: any) => {
+                    if (e.key === 'Enter') {
+                      e.preventDefault();
+                      onSearchClicked();
+                    }
+                  }}
+                  disabled={explorerOpen}
+                  fields={collection.schema.scalarFields}
+                  onSubmit={(expression: string) => {
+                    onFilterChange(expression);
                   }}
-                  checkValid={() => true}
                 />
               </div>
               <div className="right">
```

---

### Incident Patch 14: `bb5be7ae` (2025-06-19)
**Commit Message**: fix: disable refresh collections button to prevent multiple fetch (#931)

collections call

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/context/Data.tsx` (modified, +3/-0)
```diff
@@ -19,6 +19,7 @@ export const dataContext = createContext<DataContextType>({
   fetchCollections: async () => {},
   fetchCollection: async () => {},
   batchRefreshCollections: async () => {},
+  isBatchRefreshing: false,
   ui: {
     tree: {
       width: DEFAULT_TREE_WIDTH,
@@ -49,6 +50,7 @@ export const DataProvider = (props: { children: React.ReactNode }) => {
     fetchCollection,
     batchRefreshCollections,
     updateCollections,
+    isBatchRefreshing,
   } = useCollectionsManagement(database);
 
   // WebSocket Hook
@@ -82,6 +84,7 @@ export const DataProvider = (props: { children: React.ReactNode }) => {
         fetchDatabases,
         fetchCollections,
         batchRefreshCollections,
+        isBatchRefreshing,
         ui,
         setUIPref,
       }}
```

**File**: `client/src/context/Types.ts` (modified, +1/-0)
```diff
@@ -107,6 +107,7 @@ export type DataContextType = {
 
   setCollections: Dispatch<SetStateAction<CollectionObject[]>>;
   setDatabase: Dispatch<SetStateAction<string>>;
+  isBatchRefreshing: boolean;
   batchRefreshCollections: (
     collectionNames: string[],
     key?: string
```

**File**: `client/src/context/hooks/useCollectionsManagement.ts` (modified, +21/-1)
```diff
@@ -10,6 +10,7 @@ export function useCollectionsManagement(database: string) {
   const { isAuth } = useContext(authContext);
 
   const [loading, setLoading] = useState(true);
+  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
   const requestIdRef = useRef(0);
   const databaseRef = useRef(database);
 
@@ -109,6 +110,7 @@ export function useCollectionsManagement(database: string) {
       ref.timer = null;
     });
     refreshCollectionsDebounceMapRef.current.clear();
+    setIsBatchRefreshing(false);
   }
 
   useEffect(() => {
@@ -177,12 +179,21 @@ export function useCollectionsManagement(database: string) {
       if (ref.timer) {
         clearTimeout(ref.timer);
       }
+      
+      // Set batch refreshing to true if we have collections to refresh
+      if (filteredCollectionNames.length > 0) {
+        setIsBatchRefreshing(true);
+      }
+      
       function getRandomBatchSize() {
         const weights = [2, 2, 2, 3, 3, 3, 4, 4, 5];
         return weights[Math.floor(Math.random() * weights.length)];
       }
       ref.timer = setTimeout(async () => {
-        if (ref!.names.length === 0) return;
+        if (ref!.names.length === 0) {
+          setIsBatchRefreshing(false);
+          return;
+        }
         try {
           while (ref!.names.length > 0) {
             const batchSize = getRandomBatchSize();
@@ -210,6 +221,14 @@ export function useCollectionsManagement(database: string) {
         }
         ref!.names = [];
         ref!.timer = null;
+        
+        // Check if all maps are empty and set batch refreshing to false
+        const hasActiveRefreshes = Array.from(refreshCollectionsDebounceMapRef.current.values()).some(
+          ref => ref.names.length > 0 || ref.timer !== null
+        );
+        if (!hasActiveRefreshes) {
+          setIsBatchRefreshing(false);
+        }
       }, 200);
     },
     [collections, updateCollections, isAuth] // Removed database dependency
@@ -219,6 +238,7 @@ export function useCollectionsManagement(database: string) {
     collections,
     setCollections,
     loading,
+    isBatchRefreshing,
     fetchCollections,
     fetchCollection,
     batchRefreshCollections,
```

**File**: `client/src/pages/databases/collections/Collections.tsx` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@ const Collections = () => {
     fetchCollections,
     fetchCollection,
     batchRefreshCollections,
+    isBatchRefreshing,
   } = useContext(dataContext);
 
   const navigate = useNavigate();
@@ -289,7 +290,7 @@ const Collections = () => {
         }
       },
       disabled: () => {
-        return loading;
+        return loading || isBatchRefreshing;
       },
       label: btnTrans('refresh'),
     },
```

---

### Incident Patch 15: `6bc42f63` (2025-06-18)
**Commit Message**: pref: improve table rendering (#928)

Signed-off-by: ryjiang <[REDACTED_EMAIL]>

**File**: `client/src/components/MediaPreview/MediaPreview.tsx` (modified, +173/-42)
```diff
@@ -11,47 +11,122 @@ const MediaPreview = (props: { value: string }) => {
     width: 0,
     height: 0,
   });
+  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(
+    new Map()
+  );
+  const [imageError, setImageError] = useState(false);
 
   useEffect(() => {
     if (isImageSource(value)) {
       setImage(value);
-
-      // Create an Image object to get natural dimensions
-      const img = new Image();
-      img.src = value;
-      img.onload = () => {
-        setImageDimensions({
-          width: img.naturalWidth,
-          height: img.naturalHeight,
-        });
-      };
+      setImageError(false); // Reset error state
+      loadImageWithCache(value);
     }
   }, [value]);
 
+  // Cleanup cache when component unmounts or cache gets too large
+  useEffect(() => {
+    const cleanupCache = () => {
+      if (imageCache.size > 50) {
+        // Limit cache to 50 images
+        const entries = Array.from(imageCache.entries());
+        const newCache = new Map(entries.slice(-30)); // Keep last 30 images
+        setImageCache(newCache);
+      }
+    };
+
+    cleanupCache();
+  }, [imageCache.size]);
+
+  // Cleanup on unmount
+  useEffect(() => {
+    return () => {
+      setImageCache(new Map());
+    };
+  }, []);
+
+  const loadImageWithCache = (imageSrc: string) => {
+    console.log('Loading image:', imageSrc); // Debug log
+
+    // Check if image is already cached
+    if (imageCache.has(imageSrc)) {
+      const cachedImg = imageCache.get(imageSrc)!;
+      setImageDimensions({
+        width: cachedImg.naturalWidth,
+        height: cachedImg.naturalHeight,
+      });
+      console.log(
+        'Image loaded from cache:',
+        cachedImg.naturalWidth,
+        'x',
+        cachedImg.naturalHeight
+      );
+      return;
+    }
+
+    // Create an Image object to get natural dimensions with caching
+    const img = new Image();
+
+    // Don't set crossOrigin for external images to avoid CORS issues
+    // The browser will handle CORS automatically if the server allows it
+
+    img.onload = () => {
+      console.log(
+        'Image loaded successfully:',
+        img.naturalWidth,
+        'x',
+        img.naturalHeight
+      );
+      // Cache the loaded image
+      setImageCache(prev => new Map(prev).set(imageSrc, img));
+
+      setImageDimensions({
+        width: img.naturalWidth,
+        height: img.naturalHeight,
+      });
+    };
+
+    img.onerror = () => {
+      console.warn('Failed to load image:', imageSrc);
+      setImageError(true);
+      // Set default dimensions if image fails to load
+      setImageDimensions({
+        width: 200,
+        height: 200,
+      });
+    };
+
+    // Set src after setting up event handlers
+    img.src = imageSrc;
+  };
+
   const handleMouseOver = (e: React.MouseEvent) => {
-    // Use dynamic image dimensions instead of fixed values
+    // Use dynamic image dimensions if available, otherwise use defaults
     const maxDimension = 200;
-    const aspectRatio = imageDimensions.width / imageDimensions.height;
-
-    let imageWidth, imageHeight;
-
-    if (
-      imageDimensions.width > maxDimension ||
-      imageDimensions.height > maxDimension
-    ) {
-      if (aspectRatio > 1) {
-        // Landscape orientation
-        imageWidth = maxDimension;
-        imageHeight = maxDimension / aspectRatio;
+    let imageWidth = maxDimension;
+    let imageHeight = maxDimension;
+
+    if (imageDimensions.width > 0 && imageDimensions.height > 0) {
+      const aspectRatio = imageDimensions.width / imageDimensions.height;
+
+      if (
+        imageDimensions.width > maxDimension ||
+        imageDimensions.height > maxDimension
+      ) {
+        if (aspectRatio > 1) {
+          // Landscape orientation
+          imageWidth = maxDimension;
+          imageHeight = maxDimension / aspectRatio;
+        } else {
+          // Portrait or square orientation
+          imageHeight = maxDimension;
+          imageWidth = maxDimension * aspectRatio;
+        }
       } else {
-        // Portrait or square orientation
-        imageHeight = maxDimension;
-        imageWidth = maxDimension * aspectRatio;
+        // Use original dimensions if they're within the limit
+        imageWidth = imageDimensions.width;
+        imageHeight = imageDimensions.height;
       }
-    } else {
-      // Use original dimensions if they're within the limit
-      imageWidth = imageDimensions.width;
-      imageHeight = imageDimensions.height;
     }
 
     const offset = 10; // Small offset to position the image beside the cursor
@@ -82,6 +157,13 @@ const MediaPreview = (props: { value: string }) => {
         left: `${left}px`,
         zIndex: 1000,
         pointerEvents: 'none',
+        backgroundColor: 'white',
+        border: '1px solid #ccc',
+        borderRadius: '4px',
+        padding: '4px',
+        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
+        minWidth: '50px',
+        minHeight: '50px',
  
```

**File**: `client/src/components/grid/Table.tsx` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ const EnhancedTable: FC<TableType> = props => {
           stickyHeader
           sx={{
             minWidth: '100%',
-            height: hasData ? 'auto' : '100%',
+            height: hasData ? 'auto' : 'fit-content',
           }}
           aria-labelledby="tableTitle"
           size="medium"
```

**File**: `client/src/components/grid/TableEditableHead.tsx` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ import type { TableEditableHeadType } from './Types';
 
 const StyledTableCell = styled(TableCell)(({ theme }) => ({
   paddingLeft: theme.spacing(2),
+  minHeight: 40,
+  maxHeight: 60,
 }));
 
 const StyledTableRow = styled(TableRow)(({ theme }) => ({
```

**File**: `client/src/components/grid/TableHead.tsx` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ const StyledTableHeader = styled(Typography)(({ theme }) => ({
   padding: theme.spacing(1.5, 1),
   fontWeight: 500,
   maxHeight: 45,
+  minHeight: 20,
   fontSize: 13,
   overflow: 'hidden',
   whiteSpace: 'nowrap',
```

**File**: `client/src/pages/databases/collections/Collections.tsx` (modified, +2/-20)
```diff
@@ -313,7 +313,7 @@ const Collections = () => {
       sortType: 'string',
       formatter({ collection_name }) {
         return (
-          <Typography variant="body1" sx={{ width: '10vw' }}>
+          <Box sx={{ maxWidth: '120px' }}>
             <Link
               to={`/databases/${database}/${collection_name}/overview`}
               style={{
@@ -336,12 +336,9 @@ const Collections = () => {
                 }}
               />
             </Link>
-          </Typography>
+          </Box>
         );
       },
-      getStyle: () => {
-        return { minWidth: '10vw' };
-      },
       label: collectionTrans('name'),
     },
     {
@@ -362,9 +359,6 @@ const Collections = () => {
           </Typography>
         );
       },
-      getStyle: () => {
-        return { minWidth: '130px' };
-      },
     },
     {
       id: 'rowCount',
@@ -386,9 +380,6 @@ const Collections = () => {
       formatter(v) {
         return formatNumber(v.rowCount);
       },
-      getStyle: () => {
-        return { minWidth: '100px' };
-      },
     },
     {
       id: 'description',
@@ -406,9 +397,6 @@ const Collections = () => {
       formatter(v) {
         return v.description || '--';
       },
-      getStyle: () => {
-        return { minWidth: '120px' };
-      },
     },
     {
       id: 'createdTime',
@@ -418,9 +406,6 @@ const Collections = () => {
       formatter(data) {
         return new Date(data.createdTime).toLocaleString();
       },
-      getStyle: () => {
-        return { minWidth: '165px' };
-      },
     },
   ];
 
@@ -444,9 +429,6 @@ const Collections = () => {
       formatter(v) {
         return <Aliases aliases={v.aliases} collection={v} />;
       },
-      getStyle: () => {
-        return { minWidth: '100px' };
-      },
     });
   }
 
```

**File**: `client/src/pages/databases/collections/data/CollectionData.tsx` (modified, +36/-13)
```diff
@@ -2,7 +2,6 @@ import { useState, useEffect, useRef, useContext, useCallback } from 'react';
 import { useTranslation } from 'react-i18next';
 import { dataContext } from '@/context';
 import { useQuery } from '@/hooks';
-import { getColumnWidth } from '@/utils';
 import icons from '@/components/icons/Icons';
 import AttuGrid from '@/components/grid/Grid';
 import CustomToolBar from '@/components/grid/ToolBar';
@@ -38,6 +37,7 @@ const CollectionData = (props: CollectionDataProps) => {
   const [selectedData, setSelectedData] = useState<any[]>([]);
   const exprInputRef = useRef<string>(queryState.expr);
   const [, forceUpdate] = useState({});
+  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 
   // UI functions
   const { fetchCollection } = useContext(dataContext);
@@ -63,13 +63,27 @@ const CollectionData = (props: CollectionDataProps) => {
   } = useQuery({
     collection,
     onQueryStart: (expr: string = '') => {
-      setTableLoading(true);
+      // Clear any existing timeout
+      if (loadingTimeoutRef.current) {
+        clearTimeout(loadingTimeoutRef.current);
+      }
+
+      // Set a timeout to show loading after 100ms
+      loadingTimeoutRef.current = setTimeout(() => {
+        setTableLoading(true);
+      }, 100);
+
       if (expr === '') {
         handleFilterReset();
         return;
       }
     },
     onQueryFinally: () => {
+      // Clear the timeout if it exists
+      if (loadingTimeoutRef.current) {
+        clearTimeout(loadingTimeoutRef.current);
+        loadingTimeoutRef.current = null;
+      }
       setTableLoading(false);
     },
     queryState: queryState,
@@ -212,8 +226,26 @@ const CollectionData = (props: CollectionDataProps) => {
     setSelectedData([]);
     exprInputRef.current = queryState.expr;
     forceUpdate({});
+
+    // Clean up timeout on unmount or when collection changes
+    return () => {
+      if (loadingTimeoutRef.current) {
+        clearTimeout(loadingTimeoutRef.current);
+        loadingTimeoutRef.current = null;
+      }
+    };
   }, [collection.collection_name, queryState.expr]);
 
+  // Cleanup timeout on component unmount
+  useEffect(() => {
+    return () => {
+      if (loadingTimeoutRef.current) {
+        clearTimeout(loadingTimeoutRef.current);
+        loadingTimeoutRef.current = null;
+      }
+    };
+  }, []);
+
   return (
     <Root>
       {collection && (
@@ -252,17 +284,6 @@ const CollectionData = (props: CollectionDataProps) => {
                     <CollectionColHeader def={v} collection={collection} />
                   );
                 },
-                getStyle: d => {
-                  const field = collection.schema.fields.find(
-                    f => f.name === i
-                  );
-                  if (!d || !field) {
-                    return {};
-                  }
-                  return {
-                    minWidth: getColumnWidth(field),
-                  };
-                },
                 label: i === DYNAMIC_FIELD ? searchTrans('dynamicFields') : i,
               };
             })}
@@ -272,6 +293,8 @@ const CollectionData = (props: CollectionDataProps) => {
             rows={queryResult.data}
             rowCount={total}
             selected={selectedData}
+            tableHeaderHeight={43.5}
+            rowHeight={43}
             setSelected={onSelectChange}
             page={currentPage}
             onPageChange={handlePageChange}
```

**File**: `server/src/utils/Helper.ts` (modified, +25/-0)
```diff
@@ -41,7 +41,32 @@ export const makeRandomSparse = (dim: number) => {
   return sparseObject;
 };
 
+export const makeImageUrl = (): string => {
+  const sizes = [
+    '200x150',
+    '300x200', 
+    '400x300',
+    '500x400',
+    '600x450',
+    '800x600',
+    '1024x768',
+    '1200x800'
+  ];
+  
+  const formats = ['jpg', 'png', 'gif'];
+  
+  const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
+  const randomFormat = formats[Math.floor(Math.random() * formats.length)];
+  
+  return `https://dummyimage.com/${randomSize}.${randomFormat}`;
+};
+
 export const makeRandomVarChar = (maxLength: number) => {
+  // 20% 的几率返回图片URL
+  if (Math.random() < 0.2) {
+    return makeImageUrl();
+  }
+
   const words = [
     'quick',
     'brown',
```

#### Recent Merged Pull Requests:
- **PR #1031** (2026-09-07): docs: update Chinese README for Attu v3.0 (@shanghaikid)
- **PR #994** (closed): feat: add partition load state display and management (@MonkeyNull)
- **PR #957** (2025-08-27): Update README.md (@anujkumar93)
- **PR #940** (2025-06-25): fix: can not connect with `http` prefix (@shanghaikid)
- **PR #934** (2025-06-20): fix: `level` search parameter is for zilliz cloud only (@shanghaikid)
- **PR #933** (2025-06-20): ui: support disable select all for grid (@shanghaikid)
- **PR #932** (2025-06-19): fix: entering text in the search input box is very laggy (@shanghaikid)
- **PR #931** (2025-06-19): fix: disable the refresh collections button to prevent UI crash when batch refresh collections happening (@shanghaikid)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
