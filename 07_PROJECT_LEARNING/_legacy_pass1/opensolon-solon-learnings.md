# Forensic Learning Record (Deep Inspection): opensolon/solon

> **Canonical Artifact**: `07_PROJECT_LEARNING/opensolon-solon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/opensolon/solon](https://github.com/opensolon/solon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:42:04.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `opensolon/solon`
- **Description**: 🔥 Java enterprise application development framework for full scenario: Restrained, Efficient, Open, Ecologicalll!!! 700% higher concurrency 50% memory savings Startup is 10 times faster. Packing 90% smaller; Compatible with java8 ~ java26; Supports LTS. (Replaceable spring)
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2794 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #431** (2026-08-10): **[BUG] WebDAV Path Traversal Vulnerability**
  *Symptoms*: ### Affected Versions *您当前正在使用我们框架的哪个版本？* <=4.0.4  ### Problem Statement *简要描述您碰到的问题。* A path traversal vulnerability (CWE-22) exists in the LocalFileSystem.realPath() method of the Solon WebDAV module (solon-web-webdav). The vulnerability allows unauthenticated remote attackers to read, write, delete, list, copy, and move arbitrary files on the server filesystem by sending crafted HTTP requests with ../ path traversal sequences to any configured WebDAV endpoint.  ### Reproduce *请详细告诉我们如何复现您遇到的问题，并附上可复现的代码示例*  1. Target Server Setup ```java package webdav; import org.noear.solon.Solon; import org.noear.solon.core.handle.Context; import org.noear.solon.core.handle.MethodType; import org.noear.solon.web.webdav.WebdavAbstractHandler; import org.noear.solon.web.webdav.FileSystem; import org.noear.solon.web.webdav.impl.LocalFileSystem; import java.io.File; import java.net.ServerSocket;  public class WebdavServer {     public static void main(String[] args) throws Exception {         int port;         try (ServerSocket ss = new ServerSocket(0)) { port = ss.getLocalPort(); }         File webdavRoot = new File(System.getProperty("java.io.tmpdir"), "webdav_test");         webdavRoot.mkdirs();         new File(webdavRoot, "NORMAL.txt").createNewFile();         System.out.println("PORT=" + port);         System.out.println("ROOT=" + webdavRoot.getAbsolutePath());          WebdavAbstractHandler handler = new WebdavAbstractHandler(true) {             public String user(Context ctx) { retu
  **Post-Mortem & Fix Analysis**:
  > 要不要提交个 pr?
  > 已经提交了，https://github.com/opensolon/solon/pull/432
  > 请问可以申请一个CVE ID吗，类似 https://github.com/opensolon/solon/issues/421 的流程 可以在 Security -> Advisories 里新建 repository security advisory，然后在 advisory 页面里点 Request CVE。我同样整理了 advisory 内容，供参考：  ## Title  WebDAV Path Traversal Vulnerability  ## Summary  A path traversal vulnerability (CWE-22) exists in the LocalFileSystem.realPath() method of the Solon WebDAV module (solon-web-webdav). The vulnerability allows unauthenticated remote attackers to read, write, delete, list, copy, and move arbitrary files on the server filesystem by sending crafted HTTP requests with ../ path traversal sequences to any configured WebDAV endpoint.  ## CWE  CWE-22: Improper Limitation of a Pathname to a Restricted Directory  ## Affected components  - solon-projects/solon-web/solon-web-webdav/src/main/java/org/noear/solon/web/webdav/impl/LocalFileSystem.java  ## Affected versions  I locally confirmed the behavior in 4.0.4, and the main branch before https://github.com/opensolon/solon/pull/432 was merged.  ## Attack sce

- **Issue #425** (2026-07-31): **[BUG]Solon 的 @BindProps 不支持通过父对象自动绑定嵌套对象**
  *Symptoms*: 你好大佬，下面这种方式，无法绑定VertxWsProperty stomp;对象的属性值，是不支持吗？solon:3.10.7 非常期待你的回复，谢谢~~ ``` @Data @Component @BindProps(prefix = "vertx") public class VertxProperty {     VertxWsProperty stomp;     Boolean cluster; }  @Getter @Setter public class VertxWsProperty {     private int port = 18081;     private String path = "/ws/stomp"; } ``` app.yml ``` vertx:   cluster: false   stomp:     port: 18081     path: /ws/stomp ``` 
  **Post-Mortem & Fix Analysis**:
  > 是可以绑下级的，单测是 ok 的。。。你可以提交一个能复现问题的 demo 项目，帮你检查一下
  > 没有新的反馈，先关闭了

- **Issue #423** (2026-07-31): **[BUG]**
  *Symptoms*: #### 关联版本 *您当前正在使用我们框架的哪个版本？* 3.10.0  ### 问题描述 *简要描述您碰到的问题。* mcporter请求的时候ide中有返回值，但是mcporter确实空对象{}  ### 如何复现 *请详细告诉我们如何复现您遇到的问题，并附上可复现的代码示例*  1. mcpserver 就是官方例子 2. mcporter call demo1.queryGroupMember groupId=123 imId=ab --output json ```java //可在此输入示例代码 ```  ### 预期结果 *请告诉我们您预期会发生什么。*  ### 实际结果 *请告诉我们实际发生了什么。*  ### 截图或视频 *如果可以的话，上传任何关于 Bug 的截图。*   
  **Post-Mortem & Fix Analysis**:
  > 你先用新版本试试。  如果不行，可以提交个 pr 优化下。  ---  solon-ai 的问题，麻烦下次发到 solon-ai 仓库。
  > solon v4.0.0 的 mcp-sdk 已升级到 v1.1.3 。。。可以再试试

- **Issue #421** (2026-05-13): **[BUG]  solon-cache-jedis / solon-sessionstate-jedis 默认 JavabinSerializer 路径存在无白名单的 Java 反序列化**
  *Symptoms*: #### 关联版本 *您当前正在使用我们框架的哪个版本？*  - `main`（2026-04-23 本地复查） - `org.noear:solon-cache:3.9.4` - `org.noear:solon-cache:3.10.4-M2`  ### 问题描述 *简要描述您碰到的问题。*  `solon-cache-jedis` 和 `solon-sessionstate-jedis` 当前默认接入 `JavabinSerializer`，这条路径会通过 `ObjectInputStreamEx` 调 `ObjectInputStream.readObject()`，但这里没有 `setObjectInputFilter`，也没有类白名单。  当前 `main` 上我确认到：  - `solon-cache-jedis` 的 `RedisCacheService` 构造器默认 `_serializer = JavabinSerializer.instance` - `solon-sessionstate-jedis` 的 `JedisSessionState` 构造器默认 `this.serializer = JavabinSerializer.instance` - `JavabinSerializer.deserializeDo(...)` 经 `ObjectInputStreamEx` 调 `readObject()` - `ObjectInputStreamEx.resolveClass(...)` 只做 `Class.forName(name, false, loader)`，没有额外过滤  这意味着在 Redis-backed cache/session 场景下，一旦攻击者能够污染会被应用读取的后端值，后续正常读取就会进入默认 `JavabinSerializer` 的 Java 原生反序列化路径。  还有一个更关键的问题：`JavabinSerializer.deserialize(String dta, Type toType)` 里的 `toType` 只用于解析 classloader，不做运行时类型约束。即使调用方传 `String.class`，payload 类仍然会先被 `readObject()` 反序列化，然后才在返回处抛 `ClassCastException`。也就是说，`Class<T>` 参数不是安全边界。  这不是 #334 那条 Snack / `ONode` 路径的问题，这里是 `java-bin` 默认反序列化路径本身的问题。  ### 如何复现 *请详细告诉我们如何复现您遇到的问题，并附上可复现的代码示例*  我本地直接在真实 Redis backend 上验证了两条模块默认读路径，而不是只验证单独的 serializer 调用：  1. `solon-cache-jedis`: `RedisCacheService.get(key, String.class)` 2. `solon-sessionstate-jedis`: `JedisSessionState.sessionGet(sid, field, String.class)`  两条路径的验证方式都是：  1. 先向真实 Redis 写入一段 Base64 编码的 Java 序列化字节 2. 再通过模块默认读路径取出该值 3. 观察 Redis `MONITOR` 中的实际 `GET` / `HGET` 4. 观察 Java 侧
  **Post-Mortem & Fix Analysis**:
  > 感谢提交建议。。。要不要提交个 pr 完善一下？  同时可以考虑把它放到 solon-serialization 模块下面（其它地方要用的，可以用复这个模块）
  > 明白，我在 solon-serialization 模块下新加一个 SafeJavabinSerializer（默认走 ObjectInputFilter 白名单），solon-cache-jedis / solon-sessionstate-jedis 的默认 serializer 切到这个新类。老 JavabinSerializer 标 @Deprecated 。这样对吗？提 PR 前先确认下结构。
  > @qhwang996 ok 的。  ---  项目 star 下：）。。。我们社区最近在搞 SolonCode CLI ，可以关注下。

- **Issue #410** (2026-02-06): **配置文件加载问题，体外配置无法覆盖内部默认配置[BUG]**
  *Symptoms*: #### 关联版本 3.9.1  ### 问题描述 日志输出不可控  ### 如何复现 在3.7.2及之后的版本出现日志相关配置文件不起效果，不知道是不是配置文件加载的问题  1. 当使用3.7.1及之前的版本时候solon.logging.appender.file.enable是生效的 <img width="516" height="345" alt="Image" src="https://github.com/user-attachments/assets/cc97ba48-2665-4cfd-8fb4-f5d43a116b42" /> 日志文件输出： <img width="1590" height="2177" alt="Image" src="https://github.com/user-attachments/assets/e810947b-19af-4296-81ac-ef7e1a88d1da" /> 控制台输出： <img width="2049" height="3068" alt="Image" src="https://github.com/user-attachments/assets/36aa86f1-9b69-417d-901c-39128e11c654" />  2. 当使用3.7.2及之后的版本时候solon.logging.appender.file.enable就不生效了 日志文件输出： <img width="2814" height="12374" alt="Image" src="https://github.com/user-attachments/assets/6fa0991c-b1c9-410f-b6a0-36d62a1b2cec" /> 控制台输出： <img width="2064" height="3068" alt="Image" src="https://github.com/user-attachments/assets/8bf5b5cb-b3f3-417b-8e6c-69c54add9d16" />  3.除此之外包括level的配置也不生效，仅遵守app.yml的配置，后续加载的config.yml无法覆盖app.yml的level  java： <img width="2217" height="1236" alt="Image" src="https://github.com/user-attachments/assets/49ec6fc6-b76c-4a49-af0e-4e7531a160a0" />   ### 预期结果 体外配置应该能正常覆盖内置配置  ### 实际结果 *请告诉我们实际发生了什么。*  ### 截图或视频 *如果可以的话，上传任何关于 Bug 的截图。*   
  **Post-Mortem & Fix Analysis**:
  > 把你内部的配置，和外部的配置。。。发出来看下（它是以 key 为单位进行替换的）
  > > 把你内部的配置，和外部的配置。。。发出来看下（它是以 key 为单位进行替换的）  <img width="516" height="543" alt="Image" src="https://github.com/user-attachments/assets/90cda33d-5642-444d-9df2-42e9e6056a9f" />  <img width="1231" height="642" alt="Image" src="https://github.com/user-attachments/assets/e1044f1b-3ed6-4c52-b0a8-098b2106e775" />
  > > 把你内部的配置，和外部的配置。。。发出来看下（它是以 key 为单位进行替换的）  测了一下好像其他的配置项没有问题，只有日志相关的有

- **Issue #409** (2026-04-02): **[BUG] solon:3.8.1 solon-openapi3-knife4j 配置请求头参数不展示**
  *Symptoms*: #### 关联版本 *您当前正在使用我们框架的哪个版本？* solon:3.8.1  solon-openapi3-knife4j ### 问题描述 *简要描述您碰到的问题。* 启动后访问地址http://localhost:8001/client/doc.html 调试请求头部没有出现accessToken这个参数  ```java package com.xxx.bff.app.config;  import com.github.xiaoymin.knife4j.solon.extension.OpenApiExtensionResolver; import com.soco.common.core.result.Result; import io.swagger.v3.oas.models.OpenAPI; import io.swagger.v3.oas.models.Components; import io.swagger.v3.oas.models.media.StringSchema; import io.swagger.v3.oas.models.parameters.Parameter; import io.swagger.v3.oas.models.security.SecurityScheme; import io.swagger.v3.oas.models.security.SecurityRequirement; import org.noear.solon.annotation.Bean; import org.noear.solon.annotation.Configuration; import org.noear.solon.annotation.Inject; import org.noear.solon.docs.DocDocket;  import java.util.List;  @Configuration public class DocConfig {       // knife4j 的配置，由它承载     @Inject     OpenApiExtensionResolver openApiExtensionResolver;      /**      * 商城API文档配置      */     @Bean("mallApi")     public DocDocket mallApi() {         // 创建 accessToken 请求头参数         Parameter accessTokenParam = new Parameter()                 .name("accessToken")                 .description("用户token")                 .in("header")                 .required(false)                 .schema(new StringSchema());          return new DocDocket()                 .vendorExtensions(openApiExtensionResolver.buildExtensions())                 .groupName("商城管理")                 .schemes("HTTP")     
  **Post-Mortem & Fix Analysis**:
  > 要不要提交个 pr 完善下？
  > app.yml的配置以及DocConfig 配置差不多了吧  # Knife4j/Swagger config knife4j:   enable: true   basic:     enable: false   setting:     enable-dynamic-parameter: true     enable-open-api: false     enable-swagger-models: false     enable-footer: false  maven         <dependency>             <groupId>org.noear</groupId>             <artifactId>solon-openapi3-knife4j</artifactId>         </dependency>   <img width="966" height="1049" alt="Image" src="https://github.com/user-attachments/assets/1b97bb85-c076-415e-a0b8-2aec408ddff8" />
  > 3.8.4-M7 试一下。。。刚合进了一个 pr

- **Issue #408** (2026-01-05): **[BUG] SolonMcp v3.8.0 STREAMABLE_STATELESS模式 和 MCP Inspector v0.18.0有兼容问题，无法连接测试**
  *Symptoms*: #### 关联版本 *您当前正在使用我们框架的哪个版本？* SolonMcp v3.8.0  ### 问题描述 升级到v3.8.0版本，使用STREAMABLE_STATELESS模式，通过MCP Inspector v0.18.0连接失败 后端报错： ERROR 2025-12-31 10:57:17.995 #75044 [-smarthttp-12] reactor.core.publisher.Operators#console:  Operator called default onErrorDropped reactor.core.Exceptions$ErrorCallbackNotImplemented: io.modelcontextprotocol.spec.McpError: Missing handler for request type: logging/setLevel Caused by: io.modelcontextprotocol.spec.McpError: Missing handler for request type: logging/setLevel 	at io.modelcontextprotocol.server.DefaultMcpStatelessServerHandler.handleRequest(DefaultMcpStatelessServerHandler.java:35) 	at io.modelcontextprotocol.server.transport.WebRxStatelessServerTransport.lambda$doHandlePost$2(WebRxStatelessServerTransport.java:113) 	at reactor.core.publisher.FluxFlatMap.trySubscribeScalarMap(FluxFlatMap.java:153) 	at reactor.core.publisher.MonoFlatMap.subscribeOrReturn(MonoFlatMap.java:53) 	at reactor.core.publisher.Flux.subscribe(Flux.java:8876) 	at reactor.core.publisher.Flux.subscribeWith(Flux.java:9012) 	at reactor.core.publisher.Flux.subscribe(Flux.java:8856) 	at reactor.core.publisher.Flux.subscribe(Flux.java:8780) 	at reactor.core.publisher.Flux.subscribe(Flux.java:8698) 	at org.noear.solon.web.rx.integration.RxHandlerImpl.lambda$handle$4(RxHandlerImpl.java:88) 	at org.noear.solon.rx.impl.CompletableImpl.subscribe(CompletableImpl.java:75) 	at org.noear.solon.rx.impl.CompletableImpl.lambda$doOnError$0(CompletableImpl.java:98) 	at org.noear.solon
  **Post-Mortem & Fix Analysis**:
  > MCP Inspector 是用什么方式链接 mcp-server 的？  ---  solon-ai 相关的问题。后面发到 solon-ai 仓库
  > > MCP Inspector 是用什么方式链接 mcp-server 的？  使用streamable-http协议连接MCP，截图中可以看到  > solon-ai 相关的问题。后面发到 solon-ai 仓库  好的  
  > 从代码上看，是合理的（以下是 sdk 代码）。。。可能 MCP Inspector 是用来测试完整 STREAMABLE 协议了。。。可以不用管它，日常使用是 ok 的。   这是产生那个异常的代码：  ``` return Mono.error(new McpError("Missing handler for request type: " + request.method())); ```   STREAMABLE_STATELESS 的话，有些功能不支持。。。//如果 sdk 有新的变化，我们会持续跟进的。    ```java 	public DefaultMcpStatelessServerHandler(Map<String, McpStatelessRequestHandler<?>> requestHandlers, 											Map<String, McpStatelessNotificationHandler> notificationHandlers) { 		this.requestHandlers = requestHandlers; 		this.notificationHandlers = notificationHandlers; 	}  	@Override 	public Mono<McpSchema.JSONRPCResponse> handleRequest(McpTransportContext transportContext, 														 McpSchema.JSONRPCRequest request) { 		McpStatelessRequestHandler<?> requestHandler = this.requestHandlers.get(request.method()); 		if (requestHandler == null) { 			return Mono.error(new McpError("Missing handler for request type: " + request.method())); 		} 		return requestHandler.handle(transportContext, request.params()) 				.m

- **Issue #405** (2025-12-20): **[BUG] RCE vulnerability in Solon Fury**
  *Symptoms*: ### Affected Versions <=3.7.3  ### Problem Statement Solon uses Apache fury protocol. However, I found that the default blacklist can be bypassed, and multiple modules (e.g., org.noear.solon.core) that introduce this protocol are vulnerable to remote code execution (RCE) attacks. An attacker can achieve RCE by sending carefully crafted serialized data.  ### Reproduce  We can use the same example (demo7001-simple-protostuff) (detailed in https://github.com/opensolon/solon/issues/402) to reproduce the vulnerability with different gadget chains.   #### Attacker Side  Use the following code to launch the attack:  ```python file_path = "path/to/InjectionObject.ser" with open(file_hessian_1,"rb") as f: body= f.read() print(len(body)) burp0_url = "http://127.0.0.1:8081/user/getUser" burp0_cookies = {"_jpanonym": "\"OWQ0ZTEzNzBlMWFlYTY2NzhhMDMxOWM5MmYzMjc0MzgjMTY2NTU2NDE1MzAwOCMzMTUzNjAwMCNPR1ZpTk RVd05qWXpZbU0xTkRCaU0yRXlabVpoTlRrek5HUXpabVk1TmpJPQ==\"", "Hm_lvt_bfe2407e37bbaa8dc195c5db42daf96a": "1665564182"} ct = "application/fury" burp0_headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:102.0)  Gecko/20100101 Firefox/102.0", "Accept":  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0. 8",  "Accept-Language": "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en- US;q=0.3,en;q=0.2", "Accept-Encoding": "deflate",  "Connection": "close", "Content-Type": ct, "Upgrade-Insecure-Requests":  "1",  "Sec-Fetch-Dest": "document", "Sec-Fetch-
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈！pr 已合并
  > Can you assign a CVE ID to this vulnerability? Thank you very much!
  > @noear  您好，能为这个漏洞分配一个CVE ID吗？我看您为后续的漏洞报告分配了，是否可以为这两个也分配一下，感谢！

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

### Incident Patch 1: `12debb09` (2026-09-29)
**Commit Message**: !426 fix(staticfiles): RFC 3986 percent-decode in FileStaticRepository.find (IJMHZ4)

Merge pull request !426 from dyrnq/fix/iijmhz4-percent-decode

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/main/java/org/noear/solon/web/staticfiles/repository/FileStaticRepository.java` (modified, +37/-1)
```diff
@@ -19,6 +19,7 @@
 
 import java.io.File;
 import java.net.URL;
+import java.nio.charset.StandardCharsets;
 
 /**
  * 文件型静态仓库（支持位置例：/user/ 或 file:///user/）
@@ -60,8 +61,14 @@ public URL find(String relativePath) throws Exception {
             return null;
         }
 
+        // RFC 3986 percent-decode：path 来自 ctx.pathNew()，rawpath 模式下
+        // 可能仍是 %E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95 等 UTF-8 转义形式；
+        // 注意 '+' 永远是字面量（与 URLDecoder form-encoded 不同），且无 '%' 时
+        // 直接返回原字符串避免无谓分配
+        String decoded = decodePath(relativePath);
+
         File baseFile = new File(location).getCanonicalFile();
-        File file = new File(baseFile, relativePath).getCanonicalFile();
+        File file = new File(baseFile, decoded).getCanonicalFile();
 
         // 边界防御：目标规范路径必须在基础目录之内且为常规文件
         if (file.getPath().startsWith(baseFile.getPath() + File.separator) || file.equals(baseFile)) {
@@ -72,4 +79,33 @@ public URL find(String relativePath) throws Exception {
 
         return null;
     }
+
+    /**
+     * RFC 3986 percent-decode：'%xx' 解码为字节，其余字符（含 '+'）按字面量原样保留。
+     * 与 {@link java.net.URLDecoder} 的 form-encoded 语义不同 —— 后者会把 '+' 转成空格，
+     * 这对 URL path 是错误的（RFC 3986 §3.3 path 里 '+' 是 pchar/sub-delim）。
+     */
+    private static String decodePath(String path) {
+        if (path.indexOf('%') < 0) {
+            return path;
+        }
+
+        int length = path.length();
+        byte[] buf = new byte[length];
+        int pos = 0;
+        for (int i = 0; i < length; i++) {
+            char ch = path.charAt(i);
+            if (ch == '%' && i + 2 < length) {
+                int hi = Character.digit(path.charAt(i + 1), 16);
+                int lo = Character.digit(path.charAt(i + 2), 16);
+                if (hi >= 0 && lo >= 0) {
+                    buf[pos++] = (byte) ((hi << 4) + lo);
+                    i += 2;
+                    continue;
+                }
+            }
+            buf[pos++] = (byte) ch;
+        }
+        return new String(buf, 0, pos, StandardCharsets.UTF_8);
+    }
 }
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/RepositoryTest.java` (modified, +216/-0)
```diff
@@ -87,6 +87,222 @@ public void testFileStaticRepository() throws Exception {
         repo.preheat("hello.txt", false);
     }
 
+    /**
+     * IJMHZ4：rawpath 模式下 ctx.pathNew() 会带 %xx 转义，FileStaticRepository
+     * 必须按 RFC 3986 percent-decode 后再落盘查找。覆盖中/空/井号/数字/正负号等。
+     */
+    @Test
+    public void testFileStaticRepositoryPercentDecode() throws Exception {
+        File tempDir = new File(System.getProperty("java.io.tmpdir"), "solon_repo_decode_" + System.currentTimeMillis());
+        tempDir.mkdirs();
+        tempDir.deleteOnExit();
+
+        // 中英混合
+        File cn = new File(tempDir, "中文测试.txt");
+        writeUtf8(cn, "cn");
+        // 空格
+        File space = new File(tempDir, "edge space.txt");
+        writeUtf8(space, "sp");
+        // # 号（RFC 3986 fragment 分隔符；server 端不应传过来，但作为文件名字面是合法的）
+        File hash = new File(tempDir, "edge#hash.txt");
+        writeUtf8(hash, "ha");
+        // 数字
+        File num = new File(tempDir, "file123.txt");
+        writeUtf8(num, "nu");
+        // 四合一：中文 + 空格 + # + 数字（IJMHZ4 描述的具体 case）
+        File combo = new File(tempDir, "中文 测试 123 #.txt");
+        writeUtf8(combo, "co");
+        // 只含空格的对照组文件（用来验证 '+' 不被当空格用 —— URLDecoder 会把 '+' 当 ' '）
+        File spaceOnly = new File(tempDir, "a b.txt");
+        writeUtf8(spaceOnly, "so");
+        // 真·含字面 '+' 的文件（验证 RFC 3986 把 '+' 当字面量能命中）
+        File plus = new File(tempDir, "a+b.txt");
+        writeUtf8(plus, "pl");
+
+        FileStaticRepository repo = new FileStaticRepository(tempDir.getAbsolutePath());
+
+        // 收集所有断言失败，一次性暴露（JUnit 默认首个失败就停，掩盖其他 bug）
+        java.util.List<String> failures = new java.util.ArrayList<>();
+        check(failures, () -> assertNotNull(repo.find("中文测试.txt"),         "decoded 中文"));
+        check(failures, () -> assertNotNull(repo.find("edge space.txt"),       "decoded space"));
+        check(failures, () -> assertNotNull(repo.find("edge#hash.txt"),        "decoded hash"));
+        check(failures, () -> assertNotNull(repo.find("file123.txt"),          "decoded digits"));
+        check(failures, () -> assertNotNull(repo.find("中文 测试 123 #.txt"),  "decoded combo"));
+        check(failures, () -> assertNotNull(repo.find("a+b.txt"),              "decoded plus (literal)"));
+
+        // raw 形式（IJMHZ4 修复目标）
+        check(failures, () -> assertNotNull(repo.find("%E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95.txt"),         "raw 中文"));
+        check(failures, () -> assertNotNull(repo.find("edge%20space.txt"),                              "raw space"));
+        check(failures, () -> assertNotNull(repo.find("%E4%B8%AD%E6%96%87%20%E6%B5%8B%E8%AF%95%20123%20%23.txt"), "raw combo"));
+        check(failures, () -> assertNotNull(repo.find("a%2Bb.txt"),                                     "raw plus via %2B"));
+
+        // '+' 必须是字面量 —— 不当空格
+        check(failures, () -> assertNotNull(repo.find("a b.txt"),   "control: space-only file is findable"));
+        check(failures, () -> assertNotNull(repo.find("a+b.txt"),  "RFC 3986: '+' literal, hits 'a+b.txt'"));
+        check(failures, () -> assertNotNull(repo.find("a%2Bb.txt"), "raw %2B decodes to literal '+'"));
+
+        assertTrue(failures.isEmpty(), String.join("\n", failures));
+    }
+
+    /**
+     * IJMHZ4 安全防御 + Spring 对照：decode 后路径不能越出 base 目录，
+     * 同时 pin 与 Spring 框架一致的安全语义。
+     *
+     * <p>参照 Spring 测试：
+     * <ul>
+     *   <li>PathResourceResolverTests.checkResource —— hex 大小写都拒（%2E%2E / %2e%2e）</li>
+     *   <li>PathResourceResolverTests.ignoreInvalidEscapeSequence (gh-23463) —— %foo% 不抛</li>
+     *   <li>ResourceHttpRequestHandlerTests.shouldRejectPathWithTraversal —— 双重编码 %2F%2F%2E%2E%2F%2F</li>
+     *   <li>UriUtilsTests.decode —— idempotent（无 % 时原样返回）</li>
+     * </ul>
+     */
+    @Test
+    public void testFileStaticRepositoryPercentDecodeSecurity() throws Exception {
+        File tempDir = new File(System.getProperty("java.io.tmpdir"), "solon_repo_decode_sec_" + System.currentTimeMillis());
+        tempDir
```

---

### Incident Patch 2: `debc483c` (2026-09-29)
**Commit Message**: fix(staticfiles): RFC 3986 percent-decode in FileStaticRepository.find (IJMHZ4)

FileStaticRepository.find() 收到 ctx.pathNew() 后直接 new File(baseFile,
relativePath) 落盘查找，未做 URL decoding。当 rawpath 模式下 path 是
%E4%B8%AD%E6%96%87... 形式时，落盘找不到中文 / 空格 / # / 数字文件名，
返回 null，客户端 404（IJMHZ4）。

修复：对 relativePath 做 RFC 3986 percent-decode（+ 永远是字面量，与
URLDecoder form-encoded 不同），fast-path 跳过无 % 的路径，无回归风险。

参考 Spring StringUtils.uriDecode 语义。

测试：
+ testFileStaticRepositoryPercentDecode (IJMHZ4 核心 case)
+ testFileStaticRepositoryPercentDecodeSecurity (防御 + Spring parity)
+ testFileStaticRepositoryPercentDecodeCharsetMatrix (字符矩阵)

兼容性：
- decoded 路径 100% 兼容原行为（fast-path）
- 与 Spring PathResourceResolver 等级一致：malformed % 不抛 IAE
- 与 Spring UriUtils.decode 等级有差异：后者对 malformed % 抛 IAE；
  本修复选择 PathResourceResolver 的容忍行为，避免单条错误 URL 把整站搞挂

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/main/java/org/noear/solon/web/staticfiles/repository/FileStaticRepository.java` (modified, +37/-1)
```diff
@@ -19,6 +19,7 @@
 
 import java.io.File;
 import java.net.URL;
+import java.nio.charset.StandardCharsets;
 
 /**
  * 文件型静态仓库（支持位置例：/user/ 或 file:///user/）
@@ -60,8 +61,14 @@ public URL find(String relativePath) throws Exception {
             return null;
         }
 
+        // RFC 3986 percent-decode：path 来自 ctx.pathNew()，rawpath 模式下
+        // 可能仍是 %E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95 等 UTF-8 转义形式；
+        // 注意 '+' 永远是字面量（与 URLDecoder form-encoded 不同），且无 '%' 时
+        // 直接返回原字符串避免无谓分配
+        String decoded = decodePath(relativePath);
+
         File baseFile = new File(location).getCanonicalFile();
-        File file = new File(baseFile, relativePath).getCanonicalFile();
+        File file = new File(baseFile, decoded).getCanonicalFile();
 
         // 边界防御：目标规范路径必须在基础目录之内且为常规文件
         if (file.getPath().startsWith(baseFile.getPath() + File.separator) || file.equals(baseFile)) {
@@ -72,4 +79,33 @@ public URL find(String relativePath) throws Exception {
 
         return null;
     }
+
+    /**
+     * RFC 3986 percent-decode：'%xx' 解码为字节，其余字符（含 '+'）按字面量原样保留。
+     * 与 {@link java.net.URLDecoder} 的 form-encoded 语义不同 —— 后者会把 '+' 转成空格，
+     * 这对 URL path 是错误的（RFC 3986 §3.3 path 里 '+' 是 pchar/sub-delim）。
+     */
+    private static String decodePath(String path) {
+        if (path.indexOf('%') < 0) {
+            return path;
+        }
+
+        int length = path.length();
+        byte[] buf = new byte[length];
+        int pos = 0;
+        for (int i = 0; i < length; i++) {
+            char ch = path.charAt(i);
+            if (ch == '%' && i + 2 < length) {
+                int hi = Character.digit(path.charAt(i + 1), 16);
+                int lo = Character.digit(path.charAt(i + 2), 16);
+                if (hi >= 0 && lo >= 0) {
+                    buf[pos++] = (byte) ((hi << 4) + lo);
+                    i += 2;
+                    continue;
+                }
+            }
+            buf[pos++] = (byte) ch;
+        }
+        return new String(buf, 0, pos, StandardCharsets.UTF_8);
+    }
 }
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/RepositoryTest.java` (modified, +216/-0)
```diff
@@ -87,6 +87,222 @@ public void testFileStaticRepository() throws Exception {
         repo.preheat("hello.txt", false);
     }
 
+    /**
+     * IJMHZ4：rawpath 模式下 ctx.pathNew() 会带 %xx 转义，FileStaticRepository
+     * 必须按 RFC 3986 percent-decode 后再落盘查找。覆盖中/空/井号/数字/正负号等。
+     */
+    @Test
+    public void testFileStaticRepositoryPercentDecode() throws Exception {
+        File tempDir = new File(System.getProperty("java.io.tmpdir"), "solon_repo_decode_" + System.currentTimeMillis());
+        tempDir.mkdirs();
+        tempDir.deleteOnExit();
+
+        // 中英混合
+        File cn = new File(tempDir, "中文测试.txt");
+        writeUtf8(cn, "cn");
+        // 空格
+        File space = new File(tempDir, "edge space.txt");
+        writeUtf8(space, "sp");
+        // # 号（RFC 3986 fragment 分隔符；server 端不应传过来，但作为文件名字面是合法的）
+        File hash = new File(tempDir, "edge#hash.txt");
+        writeUtf8(hash, "ha");
+        // 数字
+        File num = new File(tempDir, "file123.txt");
+        writeUtf8(num, "nu");
+        // 四合一：中文 + 空格 + # + 数字（IJMHZ4 描述的具体 case）
+        File combo = new File(tempDir, "中文 测试 123 #.txt");
+        writeUtf8(combo, "co");
+        // 只含空格的对照组文件（用来验证 '+' 不被当空格用 —— URLDecoder 会把 '+' 当 ' '）
+        File spaceOnly = new File(tempDir, "a b.txt");
+        writeUtf8(spaceOnly, "so");
+        // 真·含字面 '+' 的文件（验证 RFC 3986 把 '+' 当字面量能命中）
+        File plus = new File(tempDir, "a+b.txt");
+        writeUtf8(plus, "pl");
+
+        FileStaticRepository repo = new FileStaticRepository(tempDir.getAbsolutePath());
+
+        // 收集所有断言失败，一次性暴露（JUnit 默认首个失败就停，掩盖其他 bug）
+        java.util.List<String> failures = new java.util.ArrayList<>();
+        check(failures, () -> assertNotNull(repo.find("中文测试.txt"),         "decoded 中文"));
+        check(failures, () -> assertNotNull(repo.find("edge space.txt"),       "decoded space"));
+        check(failures, () -> assertNotNull(repo.find("edge#hash.txt"),        "decoded hash"));
+        check(failures, () -> assertNotNull(repo.find("file123.txt"),          "decoded digits"));
+        check(failures, () -> assertNotNull(repo.find("中文 测试 123 #.txt"),  "decoded combo"));
+        check(failures, () -> assertNotNull(repo.find("a+b.txt"),              "decoded plus (literal)"));
+
+        // raw 形式（IJMHZ4 修复目标）
+        check(failures, () -> assertNotNull(repo.find("%E4%B8%AD%E6%96%87%E6%B5%8B%E8%AF%95.txt"),         "raw 中文"));
+        check(failures, () -> assertNotNull(repo.find("edge%20space.txt"),                              "raw space"));
+        check(failures, () -> assertNotNull(repo.find("%E4%B8%AD%E6%96%87%20%E6%B5%8B%E8%AF%95%20123%20%23.txt"), "raw combo"));
+        check(failures, () -> assertNotNull(repo.find("a%2Bb.txt"),                                     "raw plus via %2B"));
+
+        // '+' 必须是字面量 —— 不当空格
+        check(failures, () -> assertNotNull(repo.find("a b.txt"),   "control: space-only file is findable"));
+        check(failures, () -> assertNotNull(repo.find("a+b.txt"),  "RFC 3986: '+' literal, hits 'a+b.txt'"));
+        check(failures, () -> assertNotNull(repo.find("a%2Bb.txt"), "raw %2B decodes to literal '+'"));
+
+        assertTrue(failures.isEmpty(), String.join("\n", failures));
+    }
+
+    /**
+     * IJMHZ4 安全防御 + Spring 对照：decode 后路径不能越出 base 目录，
+     * 同时 pin 与 Spring 框架一致的安全语义。
+     *
+     * <p>参照 Spring 测试：
+     * <ul>
+     *   <li>PathResourceResolverTests.checkResource —— hex 大小写都拒（%2E%2E / %2e%2e）</li>
+     *   <li>PathResourceResolverTests.ignoreInvalidEscapeSequence (gh-23463) —— %foo% 不抛</li>
+     *   <li>ResourceHttpRequestHandlerTests.shouldRejectPathWithTraversal —— 双重编码 %2F%2F%2E%2E%2F%2F</li>
+     *   <li>UriUtilsTests.decode —— idempotent（无 % 时原样返回）</li>
+     * </ul>
+     */
+    @Test
+    public void testFileStaticRepositoryPercentDecodeSecurity() throws Exception {
+        File tempDir = new File(System.getProperty("java.io.tmpdir"), "solon_repo_decode_sec_" + System.currentTimeMillis());
+        tempDir
```

---

### Incident Patch 3: `321f9d86` (2026-09-28)
**Commit Message**: !425 solon-web-staticfiles: 修复 pathPrefixAsFile=true 单文件映射的路径匹配错误（IJNNFJ）

Merge pull request !425 from dyrnq/fix/static-mappings-pathprefix-as-file

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/main/java/org/noear/solon/web/staticfiles/StaticMappings.java` (modified, +4/-0)
```diff
@@ -74,6 +74,10 @@ public static URL find(String path) throws Exception {
         URL rst = null;
         for (StaticLocation m : locationMap.values()) {
             if (path.startsWith(m.pathPrefix)) {
+                //单文件 mapping 必须是精确匹配 —— 否则会被 .gz/.br 后缀误命中（IJNNFJ）
+                if (m.pathPrefixAsFile && !path.equals(m.pathPrefix)) {
+                    continue;
+                }
                 if (m.repositoryIncPrefix) {
                     //path = /demo/file.htm
                     //relativePath = demo/file.htm （没有'/'开头）
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/RepositoryTest.java` (modified, +12/-0)
```diff
@@ -133,5 +133,17 @@ public void testStaticLocation() {
         assertTrue(loc2.pathPrefixAsFile);
         assertSame(dummy, loc2.repository);
         assertTrue(loc2.repositoryIncPrefix);
+
+        StaticLocation loc3 = new StaticLocation("/doc.html.gz", dummy, true);
+        assertEquals("/doc.html.gz", loc3.pathPrefix);
+        assertTrue(loc3.pathPrefixAsFile);
+        assertSame(dummy, loc3.repository);
+        assertTrue(loc3.repositoryIncPrefix);
+
+        StaticLocation loc4 = new StaticLocation("/doc.html.br", dummy, true);
+        assertEquals("/doc.html.br", loc4.pathPrefix);
+        assertTrue(loc4.pathPrefixAsFile);
+        assertSame(dummy, loc4.repository);
+        assertTrue(loc4.repositoryIncPrefix);
     }
 }
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/StaticResourceHandlerTest.java` (modified, +248/-0)
```diff
@@ -14,15 +14,18 @@
 import org.noear.solon.web.staticfiles.repository.ClassPathStaticRepository;
 import org.noear.solon.web.staticfiles.repository.FileStaticRepository;
 
+import java.io.ByteArrayInputStream;
 import java.io.ByteArrayOutputStream;
 import java.io.File;
 import java.io.FileOutputStream;
+import java.io.IOException;
 import java.io.OutputStream;
 import java.lang.reflect.Field;
 import java.net.URI;
 import java.util.Date;
 import java.util.HashMap;
 import java.util.Map;
+import java.util.zip.GZIPInputStream;
 import java.util.zip.GZIPOutputStream;
 
 import static org.junit.jupiter.api.Assertions.*;
@@ -116,6 +119,13 @@ public String contentType() {
         public OutputStream outputStream() {
             return outputStream;
         }
+
+        @Override
+        public GZIPOutputStream outputStreamAsGzip() throws IOException {
+            headerSet("Vary", "Accept-Encoding");
+            headerSet("Content-Encoding", "gzip");
+            return new GZIPOutputStream(outputStream(), 4096, true);
+        }
     }
 
     private ClassPathStaticRepository repo;
@@ -306,4 +316,242 @@ public void testGzipAndBrCompressedFiles() throws Exception {
             GzipProps.enable(prevEnable);
         }
     }
+
+    /**
+     * 集成验证 pathPrefixAsFile=true 的 gzip 协商行为（IJNNFJ）。
+     *
+     * 注册单文件 mapping（如 Knife4jPlugin 注册的 /doc.html），
+     * 请求带 Accept-Encoding: gzip 时：
+     *
+     *   - 修复前（bug）：StaticMappings.find("/doc.html.gz") 错误返回 doc.html URL，
+     *     StaticResourceHandler 错配 Content-Encoding: gzip 并以 raw HTML 输出，
+     *     客户端 gunzip 失败 → ERR_CONTENT_DECODING_FAILED。
+     *
+     *   - 修复后：StaticMappings.find("/doc.html.gz") 返回 null，
+     *     StaticResourceHandler 跳过预压缩分支，
+     *     回退到 outputFile → outputStream → requiredGzip → outputStreamAsGzip，
+     *     客户端拿到的是真 gzip 流，能正常解压。
+     *
+     * 本测试在响应里同时断言「响应头 + body 类型 + 长度关系」三个维度，
+     * 三者同时不匹配 = bug 复发；任一不匹配都立即 fail。
+     */
+    @Test
+    public void testPathPrefixAsFile_gzipNegotiation() throws Exception {
+        boolean prevEnable = GzipProps.enable();
+        long prevMinSize = GzipProps.minSize();
+        GzipProps.enable(true);
+        GzipProps.minSize(0);   // 让小文件也走 gzip 路径
+
+        try {
+            // 1. 注册单文件 mapping（pathPrefixAsFile=true）
+            File tempDir = new File(System.getProperty("java.io.tmpdir"),
+                    "solon_ppaf_gz_test_" + System.currentTimeMillis());
+            tempDir.mkdirs();
+            tempDir.deleteOnExit();
+
+            File htmlFile = new File(tempDir, "doc.html");
+            // 构造一个 > 4096 字节的 HTML，确保即使 minSize 被 load() 重置为默认 4096 也能走 gzip
+            StringBuilder sb = new StringBuilder();
+            sb.append("<!DOCTYPE html><html><head><title>knife4j ui</title></head><body>");
+            for (int i = 0; i < 200; i++) {
+                sb.append("<p>line ").append(i).append(" : some content padding for size</p>");
+            }
+            sb.append("</body></html>");
+            byte[] htmlContent = sb.toString().getBytes();
+            try (FileOutputStream fos = new FileOutputStream(htmlFile)) {
+                fos.write(htmlContent);
+            }
+
+            FileStaticRepository fileRepo = new FileStaticRepository(tempDir.getAbsolutePath());
+            StaticMappings.add("/doc.html", fileRepo);
+            StaticResourceHandler handler = new StaticResourceHandler();
+
+            // 2. Accept-Encoding: gzip + /doc.html
+            TestContext ctx = new TestContext();
+            ctx.setPath("/doc.html");
+            ctx.headers.put("Accept-Encoding", "gzip");
+            handler.handle(ctx);
+
+            assertTrue(ctx.getHandled(), "应被处理");
+
+            // ===== 维度 1: 响应头 =====
+            // IJNNFJ bug 的关键特征：Content-Encoding: gzip 错配 raw HTML。
+            // 修复后这条 header 仍然存在（runtime compress 路径），所以单看 header 不能区分。
+            // 但 Vary 必须有，否则下游 CDN 缓存会被错配。
+            assertEquals("gzip", ctx.headerOfResponse("Cont
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/org/noear/solon/web/staticfiles/StaticMappingsTest.java` (modified, +116/-2)
```diff
@@ -5,8 +5,12 @@
 import org.junit.jupiter.api.Test;
 import org.noear.solon.test.SolonTest;
 import org.noear.solon.web.staticfiles.repository.ClassPathStaticRepository;
+import org.noear.solon.web.staticfiles.repository.FileStaticRepository;
 
+import java.io.File;
+import java.io.FileOutputStream;
 import java.net.URL;
+import java.util.zip.GZIPOutputStream;
 
 import static org.junit.jupiter.api.Assertions.*;
 
@@ -17,19 +21,55 @@ public class StaticMappingsTest {
     private StaticRepository repo2;
     private StaticRepository repoRoot;
     private StaticRepository fileRepo;
+    private StaticRepository gzFileRepo;
+
+    /**
+     * 每个测试都新建独立的临时目录、写入 doc.html.gz、跑完删除 —— 不在
+     * src/test/resources/ 下放静态 fixture，避免污染 classpath 资源树。
+     * 单测很轻，生成/清理成本可忽略。
+     */
+    private File gzTempDir;
 
     @BeforeEach
-    public void setup() {
+    public void setup() throws Exception {
         repo1 = new ClassPathStaticRepository("META-INF/resources/");
         repo2 = new ClassPathStaticRepository("META-INF/resources/webjars/");
         repoRoot = new ClassPathStaticRepository("");
         fileRepo = new ClassPathStaticRepository("META-INF/resources/");
+
+        gzTempDir = new File(System.getProperty("java.io.tmpdir"),
+                "solon_mappings_gz_" + System.currentTimeMillis());
+        gzTempDir.mkdirs();
+
+        File gz = new File(gzTempDir, "doc.html.gz");
+        try (FileOutputStream fos = new FileOutputStream(gz);
+             GZIPOutputStream gzos = new GZIPOutputStream(fos)) {
+            gzos.write("<html>gzip fixture</html>".getBytes());
+        }
+
+        gzFileRepo = new FileStaticRepository(gzTempDir.getAbsolutePath());
+
         StaticMappings.locationMap.clear();
     }
 
     @AfterEach
     public void tearDown() {
         StaticMappings.locationMap.clear();
+        if (gzTempDir != null && gzTempDir.exists()) {
+            deleteRecursive(gzTempDir);
+        }
+    }
+
+    private static void deleteRecursive(File f) {
+        if (f.isDirectory()) {
+            File[] children = f.listFiles();
+            if (children != null) {
+                for (File c : children) {
+                    deleteRecursive(c);
+                }
+            }
+        }
+        f.delete();
     }
 
     @Test
@@ -74,4 +114,78 @@ public void testMappings() throws Exception {
 
         new StaticMappings();
     }
-}
+
+    /**
+     * 单文件映射（pathPrefixAsFile=true）应只匹配精确路径，
+     * 不得用 startsWith 把 /doc.html.gz /doc.htmlANYTHING /doc.html/anything 等
+     * 误匹配为 /doc.html。详见 IJNNFJ。
+     */
+    @Test
+    public void testPathPrefixAsFile_exactMatch() throws Exception {
+        StaticMappings.addDo("/doc.html", fileRepo, false);
+
+        // 精确匹配：返回注册的文件 URL
+        assertNotNull(StaticMappings.find("/doc.html"));
+
+        // 编码协商后缀（.gz / .br）不应匹配单文件 mapping
+        // 这是 StaticResourceHandler 错配 Content-Encoding 的根因
+        assertNull(StaticMappings.find("/doc.html.gz"));
+        assertNull(StaticMappings.find("/doc.html.br"));
+
+        // 任何以注册路径开头的请求都不应匹配
+        assertNull(StaticMappings.find("/doc.htmlANYTHING"));
+        assertNull(StaticMappings.find("/doc.html_bak"));
+        assertNull(StaticMappings.find("/doc.html/anything"));
+        assertNull(StaticMappings.find("/doc.html/"));
+    }
+
+    /**
+     * 路径前缀映射（pathPrefixAsFile=false）行为保持不变：
+     * 任何以 pathPrefix 开头的请求都进入匹配。
+     *
+     * .gz 兄弟文件由 setup() 动态生成在 gzTempDir 下，测试通过
+     * FileStaticRepository(gzTempDir) 访问 —— 不污染 classpath。
+     */
+    @Test
+    public void testPathPrefix_notAsFile_unchanged() throws Exception {
+        StaticMappings.add("/res/", gzFileRepo);
+        StaticMappings.add("/webjars/", repo2);
+
+        // 子路径匹配（gzFileRepo 含 doc.html.gz，repo2 含 webjars/hello.html）
+        assertNotNull(StaticMappings.find("/res/doc.html.gz"));
+        assertNotNull(StaticMappings.find("/webjars/hello.html"));
+
+        // 兄弟路径不匹配
+        assertNull(StaticMappings.find("/other/doc.h
```

---

### Incident Patch 4: `53ed49de` (2026-09-28)
**Commit Message**: solon-web-staticfiles: 修复 pathPrefixAsFile=true 单文件映射的路径匹配错误（IJNNFJ）

IJNNFJ：knife4j 注册的 /doc.html 在 Accept-Encoding: gzip 时被错配
Content-Encoding: gzip + raw body，浏览器 gunzip 失败。

根因：StaticMappings.find 对 pathPrefixAsFile=true 的 mapping 用 startsWith 匹配，
/doc.html.gz / /doc.htmlANYTHING 等都错误命中注册到 /doc.html 的资源。

修复：在 if (path.startsWith(m.pathPrefix)) 块顶部对 pathPrefixAsFile=true 加精确
路径守卫（path.equals(m.pathPrefix)），不匹配 continue。原结构与注释保留。

新增测试：
- StaticMappingsTest：testPathPrefixAsFile_exactMatch、
  testPathPrefix_notAsFile_unchanged、testPathPrefixAsFile_dotSuffixes_findBehavior
- StaticResourceHandlerTest：testPathPrefixAsFile_gzipNegotiation、
  testPathPrefixAsFile_nonMatchingPrefixNotEaten、
  testPathPrefixAsFile_withGzSibling_runtimeCompresses
- RepositoryTest：testStaticLocation 加 loc3/loc4 覆盖 .gz/.br 后缀构造器

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/main/java/org/noear/solon/web/staticfiles/StaticMappings.java` (modified, +4/-0)
```diff
@@ -74,6 +74,10 @@ public static URL find(String path) throws Exception {
         URL rst = null;
         for (StaticLocation m : locationMap.values()) {
             if (path.startsWith(m.pathPrefix)) {
+                //单文件 mapping 必须是精确匹配 —— 否则会被 .gz/.br 后缀误命中（IJNNFJ）
+                if (m.pathPrefixAsFile && !path.equals(m.pathPrefix)) {
+                    continue;
+                }
                 if (m.repositoryIncPrefix) {
                     //path = /demo/file.htm
                     //relativePath = demo/file.htm （没有'/'开头）
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/RepositoryTest.java` (modified, +12/-0)
```diff
@@ -133,5 +133,17 @@ public void testStaticLocation() {
         assertTrue(loc2.pathPrefixAsFile);
         assertSame(dummy, loc2.repository);
         assertTrue(loc2.repositoryIncPrefix);
+
+        StaticLocation loc3 = new StaticLocation("/doc.html.gz", dummy, true);
+        assertEquals("/doc.html.gz", loc3.pathPrefix);
+        assertTrue(loc3.pathPrefixAsFile);
+        assertSame(dummy, loc3.repository);
+        assertTrue(loc3.repositoryIncPrefix);
+
+        StaticLocation loc4 = new StaticLocation("/doc.html.br", dummy, true);
+        assertEquals("/doc.html.br", loc4.pathPrefix);
+        assertTrue(loc4.pathPrefixAsFile);
+        assertSame(dummy, loc4.repository);
+        assertTrue(loc4.repositoryIncPrefix);
     }
 }
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/features/web/staticfiles/StaticResourceHandlerTest.java` (modified, +248/-0)
```diff
@@ -14,15 +14,18 @@
 import org.noear.solon.web.staticfiles.repository.ClassPathStaticRepository;
 import org.noear.solon.web.staticfiles.repository.FileStaticRepository;
 
+import java.io.ByteArrayInputStream;
 import java.io.ByteArrayOutputStream;
 import java.io.File;
 import java.io.FileOutputStream;
+import java.io.IOException;
 import java.io.OutputStream;
 import java.lang.reflect.Field;
 import java.net.URI;
 import java.util.Date;
 import java.util.HashMap;
 import java.util.Map;
+import java.util.zip.GZIPInputStream;
 import java.util.zip.GZIPOutputStream;
 
 import static org.junit.jupiter.api.Assertions.*;
@@ -116,6 +119,13 @@ public String contentType() {
         public OutputStream outputStream() {
             return outputStream;
         }
+
+        @Override
+        public GZIPOutputStream outputStreamAsGzip() throws IOException {
+            headerSet("Vary", "Accept-Encoding");
+            headerSet("Content-Encoding", "gzip");
+            return new GZIPOutputStream(outputStream(), 4096, true);
+        }
     }
 
     private ClassPathStaticRepository repo;
@@ -306,4 +316,242 @@ public void testGzipAndBrCompressedFiles() throws Exception {
             GzipProps.enable(prevEnable);
         }
     }
+
+    /**
+     * 集成验证 pathPrefixAsFile=true 的 gzip 协商行为（IJNNFJ）。
+     *
+     * 注册单文件 mapping（如 Knife4jPlugin 注册的 /doc.html），
+     * 请求带 Accept-Encoding: gzip 时：
+     *
+     *   - 修复前（bug）：StaticMappings.find("/doc.html.gz") 错误返回 doc.html URL，
+     *     StaticResourceHandler 错配 Content-Encoding: gzip 并以 raw HTML 输出，
+     *     客户端 gunzip 失败 → ERR_CONTENT_DECODING_FAILED。
+     *
+     *   - 修复后：StaticMappings.find("/doc.html.gz") 返回 null，
+     *     StaticResourceHandler 跳过预压缩分支，
+     *     回退到 outputFile → outputStream → requiredGzip → outputStreamAsGzip，
+     *     客户端拿到的是真 gzip 流，能正常解压。
+     *
+     * 本测试在响应里同时断言「响应头 + body 类型 + 长度关系」三个维度，
+     * 三者同时不匹配 = bug 复发；任一不匹配都立即 fail。
+     */
+    @Test
+    public void testPathPrefixAsFile_gzipNegotiation() throws Exception {
+        boolean prevEnable = GzipProps.enable();
+        long prevMinSize = GzipProps.minSize();
+        GzipProps.enable(true);
+        GzipProps.minSize(0);   // 让小文件也走 gzip 路径
+
+        try {
+            // 1. 注册单文件 mapping（pathPrefixAsFile=true）
+            File tempDir = new File(System.getProperty("java.io.tmpdir"),
+                    "solon_ppaf_gz_test_" + System.currentTimeMillis());
+            tempDir.mkdirs();
+            tempDir.deleteOnExit();
+
+            File htmlFile = new File(tempDir, "doc.html");
+            // 构造一个 > 4096 字节的 HTML，确保即使 minSize 被 load() 重置为默认 4096 也能走 gzip
+            StringBuilder sb = new StringBuilder();
+            sb.append("<!DOCTYPE html><html><head><title>knife4j ui</title></head><body>");
+            for (int i = 0; i < 200; i++) {
+                sb.append("<p>line ").append(i).append(" : some content padding for size</p>");
+            }
+            sb.append("</body></html>");
+            byte[] htmlContent = sb.toString().getBytes();
+            try (FileOutputStream fos = new FileOutputStream(htmlFile)) {
+                fos.write(htmlContent);
+            }
+
+            FileStaticRepository fileRepo = new FileStaticRepository(tempDir.getAbsolutePath());
+            StaticMappings.add("/doc.html", fileRepo);
+            StaticResourceHandler handler = new StaticResourceHandler();
+
+            // 2. Accept-Encoding: gzip + /doc.html
+            TestContext ctx = new TestContext();
+            ctx.setPath("/doc.html");
+            ctx.headers.put("Accept-Encoding", "gzip");
+            handler.handle(ctx);
+
+            assertTrue(ctx.getHandled(), "应被处理");
+
+            // ===== 维度 1: 响应头 =====
+            // IJNNFJ bug 的关键特征：Content-Encoding: gzip 错配 raw HTML。
+            // 修复后这条 header 仍然存在（runtime compress 路径），所以单看 header 不能区分。
+            // 但 Vary 必须有，否则下游 CDN 缓存会被错配。
+            assertEquals("gzip", ctx.headerOfResponse("Cont
```

**File**: `solon-projects/solon-web/solon-web-staticfiles/src/test/java/org/noear/solon/web/staticfiles/StaticMappingsTest.java` (modified, +116/-2)
```diff
@@ -5,8 +5,12 @@
 import org.junit.jupiter.api.Test;
 import org.noear.solon.test.SolonTest;
 import org.noear.solon.web.staticfiles.repository.ClassPathStaticRepository;
+import org.noear.solon.web.staticfiles.repository.FileStaticRepository;
 
+import java.io.File;
+import java.io.FileOutputStream;
 import java.net.URL;
+import java.util.zip.GZIPOutputStream;
 
 import static org.junit.jupiter.api.Assertions.*;
 
@@ -17,19 +21,55 @@ public class StaticMappingsTest {
     private StaticRepository repo2;
     private StaticRepository repoRoot;
     private StaticRepository fileRepo;
+    private StaticRepository gzFileRepo;
+
+    /**
+     * 每个测试都新建独立的临时目录、写入 doc.html.gz、跑完删除 —— 不在
+     * src/test/resources/ 下放静态 fixture，避免污染 classpath 资源树。
+     * 单测很轻，生成/清理成本可忽略。
+     */
+    private File gzTempDir;
 
     @BeforeEach
-    public void setup() {
+    public void setup() throws Exception {
         repo1 = new ClassPathStaticRepository("META-INF/resources/");
         repo2 = new ClassPathStaticRepository("META-INF/resources/webjars/");
         repoRoot = new ClassPathStaticRepository("");
         fileRepo = new ClassPathStaticRepository("META-INF/resources/");
+
+        gzTempDir = new File(System.getProperty("java.io.tmpdir"),
+                "solon_mappings_gz_" + System.currentTimeMillis());
+        gzTempDir.mkdirs();
+
+        File gz = new File(gzTempDir, "doc.html.gz");
+        try (FileOutputStream fos = new FileOutputStream(gz);
+             GZIPOutputStream gzos = new GZIPOutputStream(fos)) {
+            gzos.write("<html>gzip fixture</html>".getBytes());
+        }
+
+        gzFileRepo = new FileStaticRepository(gzTempDir.getAbsolutePath());
+
         StaticMappings.locationMap.clear();
     }
 
     @AfterEach
     public void tearDown() {
         StaticMappings.locationMap.clear();
+        if (gzTempDir != null && gzTempDir.exists()) {
+            deleteRecursive(gzTempDir);
+        }
+    }
+
+    private static void deleteRecursive(File f) {
+        if (f.isDirectory()) {
+            File[] children = f.listFiles();
+            if (children != null) {
+                for (File c : children) {
+                    deleteRecursive(c);
+                }
+            }
+        }
+        f.delete();
     }
 
     @Test
@@ -74,4 +114,78 @@ public void testMappings() throws Exception {
 
         new StaticMappings();
     }
-}
+
+    /**
+     * 单文件映射（pathPrefixAsFile=true）应只匹配精确路径，
+     * 不得用 startsWith 把 /doc.html.gz /doc.htmlANYTHING /doc.html/anything 等
+     * 误匹配为 /doc.html。详见 IJNNFJ。
+     */
+    @Test
+    public void testPathPrefixAsFile_exactMatch() throws Exception {
+        StaticMappings.addDo("/doc.html", fileRepo, false);
+
+        // 精确匹配：返回注册的文件 URL
+        assertNotNull(StaticMappings.find("/doc.html"));
+
+        // 编码协商后缀（.gz / .br）不应匹配单文件 mapping
+        // 这是 StaticResourceHandler 错配 Content-Encoding 的根因
+        assertNull(StaticMappings.find("/doc.html.gz"));
+        assertNull(StaticMappings.find("/doc.html.br"));
+
+        // 任何以注册路径开头的请求都不应匹配
+        assertNull(StaticMappings.find("/doc.htmlANYTHING"));
+        assertNull(StaticMappings.find("/doc.html_bak"));
+        assertNull(StaticMappings.find("/doc.html/anything"));
+        assertNull(StaticMappings.find("/doc.html/"));
+    }
+
+    /**
+     * 路径前缀映射（pathPrefixAsFile=false）行为保持不变：
+     * 任何以 pathPrefix 开头的请求都进入匹配。
+     *
+     * .gz 兄弟文件由 setup() 动态生成在 gzTempDir 下，测试通过
+     * FileStaticRepository(gzTempDir) 访问 —— 不污染 classpath。
+     */
+    @Test
+    public void testPathPrefix_notAsFile_unchanged() throws Exception {
+        StaticMappings.add("/res/", gzFileRepo);
+        StaticMappings.add("/webjars/", repo2);
+
+        // 子路径匹配（gzFileRepo 含 doc.html.gz，repo2 含 webjars/hello.html）
+        assertNotNull(StaticMappings.find("/res/doc.html.gz"));
+        assertNotNull(StaticMappings.find("/webjars/hello.html"));
+
+        // 兄弟路径不匹配
+        assertNull(StaticMappings.find("/other/doc.h
```

---

### Incident Patch 5: `99e1fbfc` (2026-09-27)
**Commit Message**: !424 fix(solon-server-netahttp): 修复响应 body 不发送导致客户端挂死的 bug

Merge pull request !424 from dyrnq/fix/neta-http-close

**File**: `solon-projects/solon-server/solon-server-netahttp/src/main/java/org/noear/solon/server/netahttp/http/NetaHttpContext.java` (modified, +1/-0)
```diff
@@ -451,6 +451,7 @@ public FullHttpResponse commitResponse() {
         ByteBuf contentBuf = ByteBufAllocator.DEFAULT.heapBuffer(bodyBytes.length);
         if (bodyBytes.length > 0) {
             contentBuf.writeBytes(bodyBytes);
+            contentBuf.markWriter(); // writeBytes 只推进 writerIndex；readableBytes() 依赖 markedWriterIndex，必须 markWriter() 才计入可读区
         }
 
         // 重新构造 response，确保 content 正确绑定
```

---

### Incident Patch 6: `ec7a8854` (2026-09-27)
**Commit Message**: fix(solon-server-netahttp): 修复响应 body 不发送导致客户端挂死的 bug

netahttp 在构造 FullHttpResponse 时手工填充 ByteBuf，但漏调 markWriter()，
导致 HttpResponseEncoder 看到的 content.readableBytes() 为 0，
只编码了 headers 就发出 TCP；客户端按 Content-Length 等待 body，
等到超时才断开。

修复方式：commitResponse() 写入 body 后调用 contentBuf.markWriter()，
将 writerIndex 提交到 markedWriterIndex，使 readableBytes() 正确返回 body 长度。

去掉冗余的 .get()：body 字节流是否到达 wire 取决于 content 是否有可读字节，
与 worker 是否阻塞无关；TCP write 由 transport 线程异步消费 snd-queue 完成。
实测 150 路并发（/get + /bytes/4096 + /uuid）全部 200。

修复后 15 个端点全部返回正确 body（266B JSON 等），
不再出现 HTTP 200 + 0 字节 + max-time 三件套。

**File**: `solon-projects/solon-server/solon-server-netahttp/src/main/java/org/noear/solon/server/netahttp/http/NetaHttpContext.java` (modified, +1/-0)
```diff
@@ -451,6 +451,7 @@ public FullHttpResponse commitResponse() {
         ByteBuf contentBuf = ByteBufAllocator.DEFAULT.heapBuffer(bodyBytes.length);
         if (bodyBytes.length > 0) {
             contentBuf.writeBytes(bodyBytes);
+            contentBuf.markWriter(); // writeBytes 只推进 writerIndex；readableBytes() 依赖 markedWriterIndex，必须 markWriter() 才计入可读区
         }
 
         // 重新构造 response，确保 content 正确绑定
```

---

### Incident Patch 7: `cded400e` (2026-09-21)
**Commit Message**: !423 fix(gzip): 修复 solon-server gzip 输出流未收尾，导致客户端解压失败的问题

Merge pull request !423 from dyrnq/fix/gzip-output-finish

**File**: `solon-projects/solon-server/solon-server/src/main/java/org/noear/solon/server/util/OutputUtils.java` (modified, +6/-0)
```diff
@@ -178,6 +178,12 @@ public void outputStreamAsGzip(Context ctx, InputStream stream) throws IOExcepti
         //支持 gzip
         GZIPOutputStream gzipOut = ctx.outputStreamAsGzip();
         IoUtil.transferTo(stream, gzipOut);
+
+        //收尾：写出结束块 + CRC32/ISIZE。缺了它 gzip 流不完整，客户端会报解压失败
+        //（只 finish 不 close，避免连带关掉底层的响应流）
+        //失败时不收尾：让客户端看到明确的解压失败，好过静默收到被截断的内容
+        gzipOut.finish();
+        gzipOut.flush();
     }
 
     /**
```

**File**: `solon-projects/solon-server/solon-server/src/test/java/features/OutputUtilsTest.java` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package features;
+
+import org.junit.jupiter.api.Test;
+import org.noear.solon.core.handle.ContextEmpty;
+import org.noear.solon.core.util.IoUtil;
+import org.noear.solon.server.util.OutputUtils;
+
+import java.io.ByteArrayInputStream;
+import java.io.ByteArrayOutputStream;
+import java.io.IOException;
+import java.io.OutputStream;
+import java.util.Random;
+import java.util.zip.GZIPInputStream;
+import java.util.zip.GZIPOutputStream;
+
+import static org.junit.jupiter.api.Assertions.assertArrayEquals;
+import static org.junit.jupiter.api.Assertions.assertEquals;
+
+/**
+ * @author dyrnq 2026/9/20 created
+ */
+public class OutputUtilsTest {
+
+    /**
+     * 模拟 gzip 压缩输出（同 ContextBase::outputStreamAsGzip）
+     */
+    private static class GzipContext extends ContextEmpty {
+        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
+
+        @Override
+        public OutputStream outputStream() {
+            return buffer;
+        }
+
+        @Override
+        public GZIPOutputStream outputStreamAsGzip() throws IOException {
+            headerSet("Vary", "Accept-Encoding");
+            headerSet("Content-Encoding", "gzip");
+            return new GZIPOutputStream(outputStream(), 4096, true);
+        }
+
+        public byte[] outputBytes() {
+            return buffer.toByteArray();
+        }
+    }
+
+    /**
+     * 解压输出内容
+     */
+    private static byte[] ungzip(byte[] bytes) throws IOException {
+        try (GZIPInputStream gzipIn = new GZIPInputStream(new ByteArrayInputStream(bytes))) {
+            return IoUtil.transferToBytes(gzipIn);
+        }
+    }
+
+    @Test
+    public void outputStreamAsGzip_case1() throws IOException {
+        //可压缩内容（重复度很高）
+        byte[] data = new byte[12000];
+        for (int i = 0; i < data.length; i++) {
+            data[i] = (byte) ('a' + (i % 26));
+        }
+
+        GzipContext ctx = new GzipContext();
+        OutputUtils.global().outputStreamAsGzip(ctx, new ByteArrayInputStream(data));
+
+        assertEquals("gzip", ctx.headerOfResponse("Content-Encoding"));
+
+        //输出必须是完整的 gzip 流：缺了结束块和 CRC32/ISIZE 时，这里会抛 EOFException
+        assertArrayEquals(data, ungzip(ctx.outputBytes()));
+    }
+
+    @Test
+    public void outputStreamAsGzip_case2() throws IOException {
+        //不可压缩内容（压缩后比原文还大）
+        byte[] data = new byte[8192];
+        new Random(1).nextBytes(data);
+
+        GzipContext ctx = new GzipContext();
+        OutputUtils.global().outputStreamAsGzip(ctx, new ByteArrayInputStream(data));
+
+        assertArrayEquals(data, ungzip(ctx.outputBytes()));
+    }
+
+    @Test
+    public void outputStreamAsGzip_case3() throws IOException {
+        //空内容，也要能解出一个空流
+        byte[] data = new byte[0];
+
+        GzipContext ctx = new GzipContext();
+        OutputUtils.global().outputStreamAsGzip(ctx, new ByteArrayInputStream(data));
+
+        assertArrayEquals(data, ungzip(ctx.outputBytes()));
+    }
+}
```

---

### Incident Patch 8: `c0c1ef46` (2026-08-28)
**Commit Message**: Merge pull request #435 from iamsanjaymalakar/fix-filepool-randomaccessfile-leak

fix(maven-plugin): close all pooled RandomAccessFiles in FilePool.close

**File**: `solon-projects/solon-tool/solon-maven-plugin/src/main/java/org/noear/solon/maven/plugin/tools/data/RandomAccessDataFile.java` (modified, +15/-1)
```diff
@@ -262,16 +262,30 @@ public void release(RandomAccessFile file) {
 
 		public void close() throws IOException {
 			this.available.acquireUninterruptibly(this.size);
+			IOException first = null;
 			try {
 				RandomAccessFile pooledFile = this.files.poll();
 				while (pooledFile != null) {
-					pooledFile.close();
+					try {
+						pooledFile.close();
+					}
+					catch (IOException e) {
+						if (first == null) {
+							first = e;
+						}
+						else {
+							first.addSuppressed(e);
+						}
+					}
 					pooledFile = this.files.poll();
 				}
 			}
 			finally {
 				this.available.release(this.size);
 			}
+			if (first != null) {
+				throw first;
+			}
 		}
 
 	}
```

---

### Incident Patch 9: `6c713754` (2026-08-26)
**Commit Message**: fix(maven-plugin): close all pooled RandomAccessFiles in FilePool.close

**File**: `solon-projects/solon-tool/solon-maven-plugin/src/main/java/org/noear/solon/maven/plugin/tools/data/RandomAccessDataFile.java` (modified, +15/-1)
```diff
@@ -262,16 +262,30 @@ public void release(RandomAccessFile file) {
 
 		public void close() throws IOException {
 			this.available.acquireUninterruptibly(this.size);
+			IOException first = null;
 			try {
 				RandomAccessFile pooledFile = this.files.poll();
 				while (pooledFile != null) {
-					pooledFile.close();
+					try {
+						pooledFile.close();
+					}
+					catch (IOException e) {
+						if (first == null) {
+							first = e;
+						}
+						else {
+							first.addSuppressed(e);
+						}
+					}
 					pooledFile = this.files.poll();
 				}
 			}
 			finally {
 				this.available.release(this.size);
 			}
+			if (first != null) {
+				throw first;
+			}
 		}
 
 	}
```

#### Recent Merged Pull Requests:
- **PR #435** (2026-08-28): fix(maven-plugin): close all pooled RandomAccessFiles in FilePool.close (@iamsanjaymalakar)
- **PR #432** (2026-08-10): fix: path traversal detect in realPath (@CyanM0un)
- **PR #430** (2026-08-08): 修复 solon-sessionstate-jwt JWT 默认密钥硬编码问题 (@28Hus)
- **PR #424** (closed): docs: migrate 4 README files to a single NRG template (@andriishin)
- **PR #422** (2026-04-23): 新增 javabin 安全序列化模块和接入入口 (#421) (@qhwang996)
- **PR #412** (closed): Bump org.apache.avro:avro from 1.11.4 to 1.11.5 in /__hatch/solon-serialization-avro (@dependabot[bot])
- **PR #404** (2025-12-20): update blacklist (@CFionaBF)
- **PR #403** (2025-12-18): add blacklist (@CFionaBF)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
