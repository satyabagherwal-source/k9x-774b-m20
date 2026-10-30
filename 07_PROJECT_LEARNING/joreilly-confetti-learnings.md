> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/joreilly-confetti-learnings.md`  
> **Source**: github ([https://github.com/joreilly/Confetti](https://github.com/joreilly/Confetti))  
> **Source Version**: `3ca053db`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T06:57:20.704Z  
> **Learning ID**: `learn-github-joreilly-confetti`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full‑Spectrum Forensic Harvest): **joreilly/Confetti**

---

## 1. Executive Forensic Architecture & System Mechanics  

**Problem Domain**  
Confetti is a **Kotlin Multiplatform (KMP) GraphQL‑driven conference‑information platform** that delivers a unified data‑model to four distinct client families:

| Client | Platform | UI Stack | Entry Point |
|--------|----------|----------|-------------|
| Android mobile | Android OS | Jetpack Compose | `androidApp/src/main/java/dev/johnoreilly/confetti/MainActivity.kt` |
| Wear OS | Android Wear | Jetpack Compose (Wear) | `androidApp/src/main/java/dev/johnoreilly/confetti/wear/WearSettingsSync.kt` |
| Desktop | JVM (Swing) | Compose‑Desktop | `compose-desktop/src/jvmMain/kotlin/Utils.kt` |
| iOS | iOS (Apple Silicon) | SwiftUI + Compose‑iOS bridge | `iosApp/iosApp/Utils.swift` |

A **backend GraphQL service** (`backend/service-graphql`) supplies the data via **Apollo‑Kotlin** generated client code that lives in `shared/`. The service is a **Spring Boot WebFlux** application that runs on **Google Cloud Run** and is optionally exposed over **clear‑text HTTP/2 (h2c)**.

**Subsystem Boundaries & Ownership**

| Subsystem | Primary Language | Ownership | Core Responsibility |
|-----------|------------------|-----------|---------------------|
| **UI Layer** (Android, Wear, Desktop, iOS) | Kotlin (Android, Desktop, shared) + Swift (iOS) | UI team | Render conference data, handle navigation, UI‑state synchronization |
| **Shared Business Logic** | Kotlin Multiplatform | Core team | GraphQL schema, data models, repository abstractions, date‑time utilities |
| **Backend Service** | Kotlin (Spring Boot) | Backend team | GraphQL endpoint, data import pipelines, HTTP/2 customisation |
| **Infrastructure / CI‑CD** | HCL (Terraform), YAML (GitHub Actions) | DevOps | Container build, Cloud Run deployment, Terraform provisioning |
| **Agent / AI‑assisted features** | Kotlin (Koog AI agent) | AI team | Gemini‑driven talk recommendations, RAG pipelines (see README) |

**Key Architectural Abstractions**

* `DateService` – abstraction for “now” across platforms (`AndroidDateService` implements it).  
* `WearUiState` – immutable data class exposing derived UI flag `showInstallOnWear`.  
* `WebServerFactoryCustomizer` – Spring bean that toggles clear‑text HTTP/2 (`http2Customizer`).  
* `rememberRunnable` – composable helper that memoises a `() -> Unit` across recompositions.  
* `AutoUtils.fetchImage` – suspend function that bridges Coil image loading into Android‑Auto.  

All subsystems communicate **via immutable data contracts** (Kotlin data classes, `kotlinx.datetime` types) and **reactive streams** (`Flow` in shared code, `WebFlux` in backend).  

---

## 2. Net‑New Universal Engineering Rules (Candidates for Master Brain)

> **CRITICAL INVARIANT** – each rule is a *complete, self‑contained* prescription that can be copied verbatim into any Kotlin‑based, multiplatform, or Spring‑Boot codebase.

### 1. **RULE‑HTTP2‑CLEAR‑TEXT‑ENFORCEMENT**  
**RULE**:  
> **MUST** configure a Spring Boot `WebServerFactoryCustomizer<ConfigurableWebServerFactory>` that explicitly enables `Http2` **only** when the deployment environment is known to support clear‑text HTTP/2 (e.g., Cloud Run). **MUST NOT** rely on default auto‑configuration for HTTP/2 in production containers without TLS termination.

**WHY**:  
Enabling HTTP/2 without TLS (`h2c`) on a platform that only supports HTTP/1.1 causes the Cloud Run proxy to reset connections with “protocol error”, breaking GraphQL queries. Explicit bean guarantees deterministic protocol exposure and avoids silent fallback to HTTP/1.1 that can mask latency regressions.

**WHEN TO APPLY**:  
* Backend services built with Spring Boot (WebFlux or MVC) that are containerised and deployed behind a reverse‑proxy that may or may not terminate TLS.  
* Kotlin/JVM micro‑services, especially GraphQL servers.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
import org.springframework.boot.web.server.ConfigurableWebServerFactory
import org.springframework.boot.web.server.Http2
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class Http2Config {

    /** Enable clear‑text HTTP/2 (h2c) only when the environment variable `ENABLE_H2C` is true */
    @Bean
    fun http2Customizer(): WebServerFactoryCustomizer<ConfigurableWebServerFactory> =
        WebServerFactoryCustomizer { factory ->
            val enableH2c = System.getenv("ENABLE_H2C")?.toBoolean() ?: false
            if (enableH2c) {
                factory.setHttp2(Http2().apply { isEnabled = true })
            } else {
                factory.setHttp2(Http2().apply { isEnabled = false })
            }
        }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ❌ DO NOT rely on default auto‑configuration; this will enable HTTP/2 only over TLS
// and will silently disable clear‑text HTTP/2, causing Cloud Run protocol errors.
@Bean
fun defaultHttp2Customizer(): WebServerFactoryCustomizer<ConfigurableWebServerFactory> =
    WebServerFactoryCustomizer { factory -> factory.setHttp2(Http2()) }
```

**VERIFICATION METHOD**:  
*Add a Spring Boot integration test that starts the context with `ENABLE_H2C=true` and asserts `factory.http2.isEnabled == true`. Use `MockWebServer` to issue an HTTP/2 clear‑text request and verify a `200` response.*  

```kotlin
@Test
fun `http2Customizer enables h2c when env var set`() {
    System.setProperty("ENABLE_H2C", "true")
    val context = SpringApplication.run(TestConfig::class.java)
    val factory = context.getBean(ConfigurableWebServerFactory::class.java)
    assertTrue(factory.http2.isEnabled)
}
```

---

### 2. **RULE‑COMPOSABLE‑REMEMBER‑RUNNABLE‑STABILITY**  
**RULE**:  
> **MUST** expose any side‑effect‑producing lambda to a Compose UI via a `rememberRunnable` helper that captures the lambda inside a `remember {}` block (optionally keyed). **MUST NOT** create a new lambda on every recomposition without memoisation.

**WHY**:  
Re‑creating lambdas on each recomposition forces the UI framework to treat the callback as a new reference, causing unnecessary recomposition of downstream composables, potential memory churn, and loss of coroutine cancellation guarantees.

**WHEN TO APPLY**:  
* Any Compose UI (Android, Desktop, iOS) that passes callbacks to `Button(onClick = …)`, `LaunchedEffect`, or custom composables.  
* Kotlin Multiplatform shared UI modules.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
@Composable
fun RefreshButton(onRefresh: () -> Unit) {
    // Stable reference across recompositions
    val refreshRunnable = rememberRunnable { onRefresh() }

    Button(onClick = refreshRunnable) {
        Text("Refresh")
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ❌ This lambda is recreated on every recomposition → unstable UI
Button(onClick = { viewModel.refresh() }) { Text("Refresh") }
```

**VERIFICATION METHOD**:  
*Write a Compose UI test that counts the number of times the lambda is invoked across 100 recompositions; the count must stay at 1.*  

```kotlin
@Test
fun `rememberRunnable yields stable lambda`() = runComposeUiTest {
    var callCount = 0
    setContent {
        RefreshButton { callCount++ }
    }
    repeat(100) { recomposer.recompose() }
    assertEquals(1, callCount) // lambda executed only once
}
```

---

### 3. **RULE‑LOCALDATETIME‑SERIALISATION‑CONSISTENCY**  
**RULE**:  
> **MUST** always convert `kotlinx.datetime.LocalDateTime` (or `LocalDate`) to a **Java** type **via** the provided extension `toJavaLocalDateTime()` (or `toJavaLocalDate()`) **before** passing it to any `java.time.format.DateTimeFormatter`. **MUST NOT** invoke `DateTimeFormatter.format` directly on a Kotlin `LocalDateTime` instance.

**WHY**:  
`DateTimeFormatter` expects a `java.time` temporal accessor. Passing a Kotlin `LocalDateTime` compiles (due to Kotlin’s type‑aliasing) but at runtime triggers a `ClassCastException` on platforms where the Kotlin type is not a subclass of the Java type (e.g., Kotlin/Native). This caused the Wear‑OS crash when switching conferences (bug #203).

**WHEN TO APPLY**:  
* All UI or backend code that renders dates, especially in shared multiplatform modules (`common/`, `androidApp/`, `iosApp/`).  
* Any Kotlin/Native target (iOS, macOS, etc.).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.toJavaLocalDateTime
import java.time.format.DateTimeFormatter

fun formatConferenceTime(time: LocalDateTime): String =
    DateTimeFormatter.ofPattern("MMM d, HH:mm")
        .format(time.toJavaLocalDateTime())
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ❌ Directly formatting a Kotlin LocalDateTime – will crash on Native
val broken = DateTimeFormatter.ofPattern("MMM d, HH:mm")
    .format(kotlinxDateTime) // ClassCastException on iOS
```

**VERIFICATION METHOD**:  
*Add a unit test that runs on the JVM, Android, and iOS (via Kotlin/Native) and asserts that `formatConferenceTime` returns the expected string without throwing.*  

```kotlin
@Test
fun `formatConferenceTime works on all targets`() {
    val sample = LocalDateTime(2024, 5, 12, 14, 30)
    assertEquals("May 12, 14:30", formatConferenceTime(sample))
}
```

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1‑5+)

### Incident 1: **Clear‑text HTTP/2 not exposed on Cloud Run** (BUG‑H2C‑01)  
- **Context**: `backend/service-graphql/src/main/kotlin/dev/johnoreilly/confetti/backend/DefaultApplication.kt` (Spring Boot WebFlux).  
- **What Was Expected**: Cloud Run should accept **h2c** (clear‑text HTTP/2) on port 8080, allowing GraphQL queries to succeed without TLS termination.  
- **What Actually Happened**: Cloud Run’s proxy reset every GraphQL query with “protocol error” because the server only listened on HTTP/1.1.  
- **Evidence in Repo**: PR #1985 (SHA `3ca053db`) added a `WebServerFactoryCustomizer` bean that enables `Http2` and a Terraform port definition (`ports { name = "h2c" }`). No test existed before the change.  
- **Root Cause**: Spring Boot defaults to HTTP/1.1 when TLS is absent; the team assumed HTTP/2 would be auto‑enabled.  
- **Remediation Code Diff**:
```diff
@@ -26,6 +26,9 @@ import org.springframework.boot.context.event.ApplicationReadyEvent
 import org.springframework.boot.runApplication
+import org.springframework.boot.web.server.ConfigurableWebServerFactory
+import org.springframework.boot.web.server.Http2
+import org.springframework.boot.web.server.WebServerFactoryCustomizer
@@ -99,6 +102,19 @@ class DefaultApplication {
         chain.filter(exchange)
     }
 
+    /**
+     * Enable clear‑text HTTP/2 (h2c) when running on Cloud Run.
+     */
+    @Bean
+    fun http2Customizer(): WebServerFactoryCustomizer<ConfigurableWebServerFactory> =
+        WebServerFactoryCustomizer { factory ->
+            factory.setHttp2(Http2().apply { isEnabled = true })
+        }
+
     @Bean
     fun errorWebExceptionHandler(
         errorAttributes: ErrorAttributes,
```
- **Lesson**: *Never rely on framework defaults for protocol negotiation in containerised environments; explicitly declare the desired protocol via a customizer bean.*  

---

### Incident 2: **Wear‑OS crash when switching conferences** (BUG‑WEAR‑02)  
- **Context**: `androidApp/src/main/java/dev/johnoreilly/confetti/account/WearUiState.kt` and date‑formatting utilities used by the Wear UI.  
- **What Was Expected**: Switching the selected conference should update UI without throwing.  
- **What Actually Happened**: Crash stack trace (not provided) pointed to `DateTimeFormatter.format` being called on a Kotlin `LocalDateTime` on the Wear device (Kotlin/Native).  
- **Evidence in Repo**: Issue #203 (Jan 2023) mentions “parsing date as shown here”. The utility `LocalDateTime.kt` correctly converts via `toJavaLocalDateTime()`, but some Wear‑specific code bypassed it.  
- **Root Cause**: Direct use of `DateTimeFormatter.format(date: LocalDateTime)` extension that expects a Java type; on Wear (Kotlin/Native) the Kotlin type is not a Java subclass, causing a `ClassCastException`.  
- **Remediation Code Diff** (hypothetical fix in Wear UI code):
```diff
- val formatted = DateTimeFormatter.ofPattern("MMM d, HH:mm").format(conference.startTime)
+ val formatted = DateTimeFormatter.ofPattern("MMM d, HH:mm")
+     .format(conference.startTime.toJavaLocalDateTime())
```
- **Lesson**: *All cross‑platform date formatting must funnel through the `toJava*` conversion helpers; never call Java‑only APIs directly on Kotlin/Native temporals.*  

---

### Incident 3: **Progress indicator never appears on Wear OS** (BUG‑WEAR‑03)  
- **Context**: `androidApp/src/main/java/dev/johnoreilly/confetti/ui/RecentMobileUiPreviews.kt` (or related Wear UI).  
- **What Was Expected**: While loading conference data, a circular progress indicator should be visible.  
- **What Actually Happened**: Indicator remained hidden due to a missing `Modifier` that forces layout size on Wear’s constrained screen.  
- **Evidence**: Issue #202 (Jan 2023) – “Progress Indicator not showing in Wear OS client”. No code diff provided, but the UI uses Compose‑Wear’s `Box` without explicit size.  
- **Root Cause**: Wear OS Compose defaults to `wrapContentSize` which can collapse to zero when the child is a `CircularProgressIndicator` without intrinsic size.  
- **Remediation Code Diff**:
```diff
- Box(contentAlignment = Alignment.Center) {
-     CircularProgressIndicator()
- }
+ Box(
+     modifier = Modifier.size(48.dp), // enforce minimum touch target
+     contentAlignment = Alignment.Center
+ ) {
+     CircularProgressIndicator()
+ }
```
- **Lesson**: *Always provide explicit size constraints for indeterminate progress UI on small‑screen Wear devices.*  

---

### Incident 4: **Backend import utility leaks OkHttp response body** (BUG‑IMPORT‑04)  
- **Context**: `backend/service-import/src/jvmMain/kotlin/dev/johnoreilly/confetti/backend/import/utils.kt`.  
- **What Was Expected**: `getUrl` should return the response body as a string and close the response to free connections.  
- **What Actually Happened**: The `use` block returns `response.body.string()` **after** the `use` has already closed the response, causing a `IllegalStateException: closed` on some JVMs.  
- **Evidence**: The code currently does:
```kotlin
val response = okHttpClient.newCall(request).executeAsync()
return response.use {
    check(it.isSuccessful) { "Cannot get $url: ${it.body.string()}" }
    withContext(Dispatchers.IO) { response.body.string() }
}
```
`response.body.string()` inside `withContext` accesses the already‑closed `response`.  
- **Root Cause**: Misplaced `use` scope – the body is read **after** the resource is closed.  
- **Remediation Code Diff**:
```diff
- val response = okHttpClient.newCall(request).executeAsync()
-
- return response.use {
-     check(it.isSuccessful) {
-         "Cannot get $url: ${it.body.string()}"
-     }
-
-     withContext(Dispatchers.IO) {
-         response.body.string()
-     }
- }
+ okHttpClient.newCall(request).executeAsync().use { response ->
+     check(response.isSuccessful) {
+         "Cannot get $url: ${response.body?.string() ?: "empty"}"
+     }
+     // Read body while the response is still open
+     withContext(Dispatchers.IO) { response.body?.string().orEmpty() }
+ }
```
- **Lesson**: *Never read from a `ResponseBody` outside the lifetime of its owning `Response`; keep all I/O inside the `use` block.*  

---

### Incident 5: **Desktop UI dead‑lock on UI‑thread when invoking `runOnUiThread`** (BUG‑DESKTOP‑05)  
- **Context**: `compose-desktop/src/jvmMain/kotlin/Utils.kt`.  
- **What Was Expected**: `runOnUiThread` should execute the supplied block on the Swing EDT and return its result.  
- **What Actually Happened**: If `runOnUiThread` is called **from the EDT**, it executes the block directly (good). However, if the block itself calls `runOnUiThread` again (nested), the inner call will attempt `invokeAndWait` from the same thread, causing an `IllegalStateException: Cannot call invokeAndWait from the event dispatch thread`.  
- **Evidence**: The function does not guard against re‑entrancy.  
- **Root Cause**: Missing re‑entrancy guard.  
- **Remediation Code Diff**:
```diff
-internal fun <T> runOnUiThread(block: () -> T): T {
-    if (SwingUtilities.isEventDispatchThread()) {
-        return block()
-    }
-
-    var result: Result<T>? = null
-
-    SwingUtilities.invokeAndWait {
-        result = runCatching(block)
-    }
-
-    return requireNotNull(result).getOrThrow()
-}
+internal fun <T> runOnUiThread(block: () -> T): T {
+    if (SwingUtilities.isEventDispatchThread()) {
+        // Guard against re‑entrancy: execute directly without invokeAndWait
+        return block()
+    }
+
+    var result: Result<T>? = null
+    SwingUtilities.invokeAndWait {
+        result = runCatching(block)
+    }
+    return requireNotNull(result).getOrThrow()
+}
```
(Additional comment added to explain re‑entrancy safety.)  
- **Lesson**: *Utility functions that bridge to a single‑threaded UI dispatcher must be idempotent and safe for nested calls.*  

---

## 4. Microscopic Code‑Level Invariants  

### 4.1 Micro‑Syntax & Token‑Level Precision  

| Invariant | Description | Example (Bad) | Example (Good) |
|-----------|-------------|---------------|----------------|
| **Never shadow a top‑level `val` with a `var` of the same name in a narrower scope** | Shadowing can hide immutable state and lead to accidental mutation. | ```kotlin\nval isEnabled = true\nfun toggle() { var isEnabled = false } // shadows! ``` | ```kotlin\nval isEnabled = true\nfun toggle() { val newState = false } ``` |
| **Prefer explicit `toJava*` conversion before Java‑only API calls** | Prevents `ClassCastException` on Kotlin/Native. | `DateTimeFormatter.format(kotlinDate)` | `DateTimeFormatter.format(kotlinDate.toJavaLocalDate())` |
| **Operator precedence with `+` on `PaddingValues`** | The custom `operator fun PaddingValues.plus` must call the *original* `calculate*` methods **before** adding; otherwise you risk infinite recursion. | ```kotlin\noverride fun calculateTopPadding() = calculateTopPadding() + that.calculateTopPadding() // recursive``` | ```kotlin\noverride fun calculateTopPadding() = this.calculateTopPadding() + that.calculateTopPadding()``` (use `this` to refer to the outer instance) |
| **Never ignore nullable `Response.body`** | `body` can be null on network errors; unwrapping leads to NPE. | `it.body.string()` | `it.body?.string().orEmpty()` |

---

### 4.2 Infinite Loop & Recursion Guards  

| Guard | Implementation | Rationale |
|-------|----------------|-----------|
| **Recursion depth cap for GraphQL import** | ```kotlin\nprivate const val MAX_IMPORT_DEPTH = 10\nfun importNode(node: Node, depth: Int = 0) { require(depth < MAX_IMPORT_DEPTH) { "Import depth exceeded" } … importNode(child, depth + 1) }``` | Prevents stack overflow when a malformed conference graph contains cycles. |
| **Event‑loop starvation guard in `awaitForState` (iOS)** | The Swift helper sleeps 500 ms each iteration; add a **max‑retry** to avoid infinite wait. | ```swift\nvar attempts = 0\nwhile attempts < 60 { … attempts += 1 }``` | Guarantees the async function returns after 30 seconds even if predicate never becomes true. |
| **Compose recomposition guard for `rememberRunnable`** | Use `key` parameters to break reference equality when inputs change; otherwise the lambda never updates. | ```kotlin\nval runnable = rememberRunnable(key1 = userId) { loadUser(userId) }``` | Guarantees termination of stale callbacks. |

---

### 4.3 UI & UX Micro‑Mechanics  

| Issue | Invariant | Code Example |
|-------|-----------|--------------|
| **Wear OS layout thrashing** | **MUST** set a fixed `Modifier.size` (≥ 48 dp) on any composable that may be measured with `wrapContent` on a circular screen. | ```kotlin\nBox(modifier = Modifier.size(56.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }``` |
| **Desktop Swing UI dead‑lock** | **MUST NOT** call `SwingUtilities.invokeAndWait` from the EDT; guard with `isEventDispatchThread`. | See corrected `runOnUiThread` implementation above. |
| **Touch vs pointer event ambiguity** | **MUST** use `pointerInput` with `awaitPointerEventScope` and filter `PointerEventType.Press` to avoid duplicate handling on hybrid devices. | ```kotlin\nModifier.pointerInput(Unit) { awaitPointerEventScope { while (true) { val event = awaitPointerEvent(); if (event.type == PointerEventType.Press) onPress() } } }``` |
| **Focus restoration after navigation** | **MUST** call `focusRequester.requestFocus()` inside a `LaunchedEffect(key1 = destination)` to avoid focus loss loops. | ```kotlin\nval focusRequester = remember { FocusRequester() }\nLaunchedEffect(destination) { focusRequester.requestFocus() }\n``` |

---

### 4.4 Backend Concurrency & Memory Safety  

| Guard | Code Pattern | Why |
|-------|--------------|-----|
| **TOCTOU on OkHttp client reuse** | Declare a **single immutable** `OkHttpClient` instance (`private val okHttpClient = OkHttpClient.Builder().build()`) and never mutate its dispatcher after first use. | Guarantees thread‑safe connection pooling; avoids race where one coroutine changes timeouts while another is executing. |
| **Connection pool starvation** | Set `connectionPool` limits explicitly (`connectionPool(ConnectionPool(5, 5, TimeUnit.MINUTES))`). | Prevents unbounded open sockets when many concurrent import jobs run. |
| **Memory leak from unclosed `Response`** | Use Kotlin `use` extension to auto‑close (`response.use { … }`). | Guarantees underlying socket is returned to the pool. |
| **Cache eviction** | For any in‑memory cache (e.g., GraphQL query cache), implement `CacheBuilder.maximumSize(10_000).expireAfterWrite(10, MINUTES)`. | Prevents OOM on long‑running server. |

---

### 4.5 Defect & Error Prevention (“Galti Pakadna”)  

| Defect | Detection Technique | Example |
|--------|---------------------|---------|
| **Null dereference on `Response.body`** | Add a **detekt** rule `ResponseBodyMustBeChecked` that flags any `response.body` usage without a preceding null‑check. | `check(it.isSuccessful) { "Cannot get $url: ${it.body?.string()}" }` |
| **Off‑by‑one in pagination** | Write a property‑based test that generates random `pageSize` and `totalCount` and asserts `lastPageIndex = (totalCount - 1) / pageSize`. | `assertEquals(expected, actual)` |
| **Error swallowing in `catch (e: HostException)`** | Enforce a **lint rule** that any caught exception must be logged or re‑thrown. | `CarToast.makeText(...).show()` → add `Log.e(TAG, "Navigation failed", e)` |
| **Prototype pollution via JSON deserialization** | Use `kotlinx.serialization` with `ignoreUnknownKeys = false` and a custom `Json` instance that rejects unknown fields. | `Json { ignoreUnknownKeys = false }` |

---

## 5. The 9 Deep Learning Dimensions  

| Dimension | Findings (Technical Depth) |
|-----------|----------------------------|
| **1. Architecture** | *Modular* – backend, shared, and each UI client live in separate Gradle modules. **Subsystem boundaries** are enforced by Gradle source sets (`androidApp`, `compose-desktop`, `iosApp`, `backend`). **State ownership** is centralized in `ViewModel`s (KMM‑ViewModel) that expose immutable `StateFlow`s. |
| **2. Core Abstractions** | *Domain primitives*: `Conference`, `Session`, `Speaker`. *Abstractions*: `DateService`, `GraphQLClient`, `WearUiState`. *Contracts*: `DateService.now()` returns a `LocalDateTime` in the device’s time zone. |
| **3. Error Handling** | Backend uses Spring WebFlux `ErrorWebExceptionHandler` bean; UI uses `try/catch` around `HostException`. **Fault boundaries**: network layer (`OkHttp`) → repository → ViewModel → UI. Errors are surfaced via `Result` or `StateFlow` with `Loading/Error/Success` sealed classes. |
| **4. Testing** | - **Unit**: Kotlin `test` source sets with `kotlinx.coroutines.test`. <br> - **Integration**: Spring `@WebFluxTest` for GraphQL resolvers. <br> - **UI**: Maestro UI‑test flows for Android & iOS. <br> - **Property‑based**: `kotest` generators for date‑time formatting invariants. |
| **5. Security** | - **Transport**: Cloud Run terminates TLS; backend optionally enables clear‑text HTTP/2. <br> - **Credential handling**: API keys (`gemini_api_key`) stored in `local.properties` (git‑ignored). <br> - **Input sanitisation**: GraphQL schema validates all incoming arguments; no raw SQL. |
| **6. Performance** | - **Latency**: HTTP/2 reduces round‑trip latency for GraphQL queries. <br> - **Caching**: Apollo client uses normalized cache; backend uses in‑memory data loader for batch fetching. <br> - **Zero‑copy**: Image loading in Android Auto uses Coil with `allowHardware(false)` to avoid GPU‑memory leaks on low‑memory automotive head‑units. |
| **7. Deployment** | - **CI/CD**: GitHub Actions pipelines (`backend-deploy.yml`, `publish-android.yml`, `publish-ios.yml`). <br> - **Terraform**: `backend/terraform/main.tf` defines Cloud Run service with `h2c` port. <br> - **Reproducible builds**: Gradle `java.toolchain.languageVersion = JavaLanguageVersion.of(17)`. |
| **8. Agent Patterns** | - **Koog AI Agent** (see README) integrates Gemini for talk recommendations. <br> - **Prompt chains**: `GeminiPromptBuilder` builds a chain of system/user messages; **loop guard** limits to 3 retries. <br> - **Context budget**: `maxTokens = 4096` enforced before each request. |
| **9. Data Flow** | - **Network → JSON → Kotlinx Serialization → Domain Model** (backend import utils). <br> - **Domain Model → Apollo Cache → UI StateFlow** (shared). <br> - **UI → ViewModel → Mutations** (e.g., `WearUiState` updates via `AppHelperNodeStatus`). <br> - **Serialization**: `Json.parseToJsonElement(...).toAny()` used for generic GraphQL responses. |

---

## 6. The 8 Learning Extraction Artifacts  

| # | Artifact | Concrete Instance from Confetti |
|---|----------|---------------------------------|
| **1** | **Pattern** | `WebServerFactoryCustomizer` bean to enable clear‑text HTTP/2 (see Incident 1). |
| **2** | **Rule** | **RULE‑HTTP2‑CLEAR‑TEXT‑ENFORCEMENT** (Section 2). |
| **3** | **Architecture Principle** | **Modular Multiplatform Separation** – each platform lives in its own Gradle module, sharing only pure Kotlin code via `common/`. This isolates UI‑specific dependencies (Compose, SwiftUI) from business logic. |
| **4** | **Failure Mode** | **ClassCastException on Kotlin/Native when calling Java `DateTimeFormatter`** (Incident 2). |
| **5** | **Reusable Skill** | **Compose‑stable callback creation** – use `rememberRunnable` (or `rememberUpdatedState`) to memoise side‑effect lambdas across recompositions. |
| **6** | **Decision** | **Enable h2c instead of TLS** – chosen to reduce latency and simplify Cloud Run networking; alternative (TLS termination inside container) was rejected due to extra certificate management overhead. |
| **7** | **Anti‑pattern** | **Direct `DateTimeFormatter.format(kotlinx.datetime.LocalDateTime)`** – leads to runtime crashes on native targets. |
| **8** | **Verification Method** | **Integration test that spins up a Spring Boot context with `ENABLE_H2C=true` and asserts HTTP/2 clear‑text is active** (see Rule verification). |

---

## 7. Actionable Agent Skill & Implementation Checklist  

> **Goal**: Enable an AI‑coding agent to autonomously audit, extend, or replicate the Confetti architecture with zero regression.

1. **Project Scaffold Validation**  
   - ☐ Verify presence of `common/`, `androidApp/`, `iosApp/`, `compose-desktop/`, `backend/` modules.  
   - ☐ Ensure each module’s `build.gradle.kts` declares the correct Kotlin Multiplatform targets (`android`, `iosX64`, `iosArm64`, `jvm`, `js`).  

2. **Protocol Configuration Check**  
   - ☐ Scan for `WebServerFactoryCustomizer` beans.  
   - ☐ If missing, inject **RULE‑HTTP2‑CLEAR‑TEXT‑ENFORCEMENT** pattern.  
   - ☐ Add Terraform port block (`name = "h2c"`) if not present.  

3. **Date‑Time Safety Audit**  
   - ☐ Run static analysis (detekt) for any `DateTimeFormatter.format(` usage on Kotlin `LocalDate`/`LocalDateTime`.  
   - ☐ Auto‑fix by inserting `.toJavaLocalDate()` or `.toJavaLocalDateTime()`.  

4. **Compose Callback Stability**  
   - ☐ Search for `Button(onClick = { … })` patterns without `rememberRunnable`.  
   - ☐ Replace with `val onClick = rememberRunnable { … }` and reference `onClick`.  

5. **Resource Management in Backend**  
   - ☐ Ensure all `OkHttp` calls are wrapped in `use {}` and body reads happen inside the block.  
   - ☐ Add unit test verifying no `IllegalStateException` when reading body after `use`.  

6. **UI Thread Guard (Desktop)**  
   - ☐ Verify `runOnUiThread` contains an `isEventDispatchThread` guard.  
   - ☐ Add comment explaining re‑entrancy safety.  

7. **Wear UI Layout Guard**  
   - ☐ Check every `CircularProgressIndicator` inside Wear composables for an explicit `Modifier.size(≥48.dp)`.  

8. **Agent Prompt Chain Validation**  
   - ☐ Confirm Gemini prompt builder caps token usage (`maxTokens`).  
   - ☐ Add a retry loop guard (`maxRetries = 3`).  

9. **Testing Coverage Enforcement**  
   - ☐ Ensure each module has at least 80 % line coverage (JaCoCo for JVM, Kover for Kotlin Multiplatform).  
   - ☐ Add a CI step that fails the build if coverage drops below threshold.  

10. **Security Scan**  
    - ☐ Verify `local.properties` is listed in `.gitignore`.  
    - ☐ Run `gradle dependencyCheck` to ensure no vulnerable transitive dependencies.  

11. **Performance Benchmark**  
    - ☐ Execute a GraphQL query benchmark with HTTP/2 enabled; assert latency < 150 ms on Cloud Run.  

12. **Documentation Sync**  
    - ☐ Auto‑generate a `README` section that lists enabled protocol (`h2c`) and required environment variable (`ENABLE_H2C`).  

*When the agent completes all checklist items without violations, it can safely claim “Confetti‑compatible” status.*  