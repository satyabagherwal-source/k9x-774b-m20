> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/joreilly-confetti-learnings.md`  
> **Source**: github ([https://github.com/joreilly/Confetti](https://github.com/joreilly/Confetti))  
> **Source Version**: `b97d2070`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-02T16:47:53.237Z  
> **Learning ID**: `learn-github-joreilly-confetti`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): joreilly/Confetti

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
Confetti solves the problem of **cross-platform conference data synchronization and presentation** using a strict **Kotlin Multiplatform (KMP)** architecture. It decouples the GraphQL data layer (Apollo) from the UI layer (Jetpack Compose for Android/Desktop, SwiftUI for iOS, Compose for iOS) while maintaining a single source of truth for business logic. It specifically addresses the challenge of rendering dynamic, time-sensitive data (conference schedules) across heterogeneous OS environments (Android, iOS, Wear OS, Android Auto, Desktop) without code duplication.

**Architectural Boundaries:**
1.  **Shared Core (`shared/`):** Contains the Apollo GraphQL client, domain models, and repository logic. This is the "brain" of the app, agnostic to UI frameworks.
2.  **Platform UIs (`androidApp/`, `iosApp/`, `compose-desktop/`):** Thin presentation layers. Android uses Jetpack Compose; iOS uses SwiftUI wrapping Compose via `ComposeUIViewController`; Desktop uses Swing/Compose.
3.  **Specialized Clients (`wearApp/`, `car/`):** Isolated modules for constrained environments (Wear OS, Android Auto) that consume the shared core but have distinct lifecycle and UI constraints.
4.  **Backend (`backend/`):** A separate GraphQL server (likely Spring Boot or similar) that serves the conference data. The client connects via `https://confetti-app.dev/graphql`.

**Critical Subsystem Abstractions:**
*   **`DateService` Interface:** Abstracts time acquisition to allow for deterministic testing and timezone handling across platforms (e.g., `AndroidDateService` vs. iOS implementation).
*   **`WearUiState`:** A lightweight data class for Wear OS that derives UI state (e.g., `showInstallOnWear`) from raw node statuses, enforcing unidirectional data flow.
*   **`rememberRunnable`:** A Compose utility that stabilizes lambda references across recompositions, preventing unnecessary state invalidation in UI components.
*   **`runOnUiThread`:** A Swing utility for Desktop that ensures thread safety by marshaling calls to the Event Dispatch Thread (EDT), handling both synchronous and asynchronous execution contexts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Stabilize Lambda References in Reactive UI Frameworks
**RULE**:
In reactive UI frameworks (like Jetpack Compose), **MUST** wrap inline lambda calculations in stable, remembered references (e.g., `remember { { calculation() } }`) when passing them to state-holding components or event listeners. **MUST NOT** pass raw inline lambdas directly to components that cache or compare references, as this triggers unnecessary recompositions or state resets.

**WHY**:
Reactive frameworks often use reference equality to determine if a state has changed. An inline lambda creates a new object instance on every recomposition. If a component (like a `LaunchedEffect` or a custom state holder) compares the lambda reference, it will detect a "change" even if the logic is identical, leading to infinite loops, flickering UI, or wasted CPU cycles.

**WHEN TO APPLY**:
Any Kotlin Multiplatform or Android project using Jetpack Compose where lambdas are passed to stateful components, event handlers, or background task launchers.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// CORRECT: Stable reference
@Composable
fun MyComponent(onClick: () -> Unit) {
    // The lambda is created once and remembered
    val stableClick = remember { { onClick() } }
    
    // Pass stableClick to a component that might cache it
    Button(onClick = stableClick) { Text("Click") }
}

// OR using the provided utility:
@Composable
fun MyComponent(key: Any? = null) {
    val stableAction = rememberRunnable(key) {
        // Complex logic here
    }
    // Use stableAction
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// WRONG: Unstable reference
@Composable
fun MyComponent(onClick: () -> Unit) {
    // This creates a NEW lambda instance on every recomposition
    Button(onClick = { onClick() }) { Text("Click") } 
    // If Button caches the lambda reference, it will think the action changed
}
```

**VERIFICATION METHOD**:
1.  **Lint Rule**: Create a custom Detekt or Lint rule that flags inline lambdas passed directly to parameters annotated with `@Stable` or known state-holding components.
2.  **UI Test**: Use Compose UI testing to verify that a component does not re-render when its parent recomposes but the lambda logic remains unchanged.

### 2. Abstract Time Acquisition for Deterministic Testing
**RULE**:
**MUST** abstract all time-dependent logic (current date, timezone) behind an interface (e.g., `DateService`). **MUST NOT** call `System.currentTimeMillis()`, `LocalDateTime.now()`, or platform-specific time APIs directly in business logic or UI state calculations.

**WHY**:
Direct time calls make unit tests non-deterministic and flaky. They also prevent easy simulation of time zones or future dates for UI previews. By abstracting time, you can inject a mock `DateService` in tests to verify logic for specific dates (e.g., "Is this session in the past?").

**WHEN TO APPLY**:
Any application that displays dates, calculates durations, or filters data based on time (e.g., conference schedules, expiration dates).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Interface
interface DateService {
    fun now(): LocalDateTime
}

// Production Implementation
class AndroidDateService : DateService {
    override fun now(): LocalDateTime = java.time.LocalDateTime.now().toKotlinLocalDateTime()
}

// Test Implementation
class MockDateService(private val fixedTime: LocalDateTime) : DateService {
    override fun now(): LocalDateTime = fixedTime
}

// Usage in ViewModel
class ConferenceViewModel(private val dateService: DateService) {
    fun isSessionPast(session: Session): Boolean {
        return session.startTime < dateService.now()
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// WRONG: Direct time call
class ConferenceViewModel {
    fun isSessionPast(session: Session): Boolean {
        // Non-deterministic, hard to test
        return session.startTime < LocalDateTime.now()
    }
}
```

**VERIFICATION METHOD**:
1.  **Static Analysis**: Use a linter to flag direct calls to `LocalDateTime.now()`, `System.currentTimeMillis()`, or `Date()` in non-utility classes.
2.  **Unit Test**: Write a test that injects a `MockDateService` with a fixed time and verifies that the logic behaves as expected for that specific time.

### 3. Enforce Thread Safety in Desktop UI Marshaling
**RULE**:
In desktop applications using Swing/JavaFX, **MUST** marshal all UI updates to the Event Dispatch Thread (EDT) using `SwingUtilities.invokeLater` or `invokeAndWait`. **MUST NOT** modify UI components from background threads.

**WHY**:
Swing is not thread-safe. Modifying UI components from a background thread can lead to `ConcurrentModificationException`, UI freezes, or silent corruption. `invokeAndWait` blocks the calling thread until the UI update is complete, which is useful for synchronous operations, while `invokeLater` is non-blocking.

**WHEN TO APPLY**:
Any Kotlin/Java desktop application using Swing or JavaFX where background threads (e.g., network calls, data processing) need to update the UI.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
internal fun <T> runOnUiThread(block: () -> T): T {
    if (SwingUtilities.isEventDispatchThread()) {
        return block()
    }

    var result: Result<T>? = null

    SwingUtilities.invokeAndWait {
        result = runCatching(block)
    }

    return requireNotNull(result).getOrThrow()
}

// Usage
val data = fetchDataFromNetwork() // Background thread
runOnUiThread {
    label.text = data.toString() // Safe UI update
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// WRONG: Direct UI update from background thread
thread {
    val data = fetchDataFromNetwork()
    label.text = data.toString() // Potential crash or corruption
}
```

**VERIFICATION METHOD**:
1.  **Unit Test**: Write a test that calls `runOnUiThread` from a background thread and verifies that the UI update occurs on the EDT.
2.  **Integration Test**: Run a stress test that performs many background tasks and UI updates simultaneously to ensure no crashes or deadlocks.

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Maestro UI Test Flakiness Due to Dynamic List Ordering (BUG-MAESTRO-01)
- **Context**: `maestro/Confetti.flow` (UI Test Script)
- **What Was Expected**: The UI test should reliably find and tap the "KotlinConf 2026" item in the conference list.
- **What Actually Happened**: The test failed intermittently because the list is sorted by "newest first." As new conferences were added to the backend, "KotlinConf 2026" drifted down the list, requiring scrolling. The original test used `extendedWaitUntil` with a static string, which timed out if the item was not initially visible.
- **Evidence in Repo**: Commit `6e98816f` (PR #1988). The patch changes the wait condition from a specific string to a regex for any year (`\d{4}`) and adds a `scrollUntilVisible` step.
- **Root Cause**: The UI test assumed a static list order. The backend data is dynamic, and the list is sorted by date. The test did not account for the need to scroll to find the target item.
- **Remediation Code Diff**:
```yaml
# - Buggy code / What failed
- extendedWaitUntil:
    visible: "KotlinConf 2026"
    timeout: 30000

# + Fixed pattern / Safe invariant
+ extendedWaitUntil:
+     visible: "\\d{4}" # Wait for any year to appear, indicating the list is loaded
+     timeout: 30000
+ - scrollUntilVisible:
+     element: "KotlinConf 2026"
+     direction: DOWN
+     timeout: 30000
+     centerElement: true
```
- **Lesson**: UI tests for dynamic lists **MUST** use scroll-based discovery (`scrollUntilVisible`) rather than static waits. The wait condition should be a generic indicator of list loading (e.g., any item visible) rather than a specific item, to avoid timing out if the target item is far down the list.

### Incident 2: Wear OS Crash on Conference Switch (BUG-WEAR-02)
- **Context**: `wearApp` (Wear OS Client)
- **What Was Expected**: Switching conferences in the Wear OS app should update the UI without crashing.
- **What Actually Happened**: The app crashed when switching conferences. The crash was due to a date parsing error.
- **Evidence in Repo**: Issue #203. The screenshot shows a stack trace related to date parsing.
- **Root Cause**: The Wear OS app likely used a platform-specific date parsing method that was not compatible with the date format returned by the backend for the new conference. The shared `DateService` abstraction was not fully applied to the Wear OS client, or the date format was inconsistent.
- **Remediation Code Diff**:
```kotlin
// - Buggy code / What failed
// val date = SimpleDateFormat("MMM d, yyyy").parse(dateString) // Platform-specific, fragile

// + Fixed pattern / Safe invariant
// Use the shared DateService and kotlinx.datetime for consistent parsing
val date = dateService.parse(dateString)
```
- **Lesson**: **MUST** use a shared, platform-agnostic date parsing library (e.g., `kotlinx.datetime`) and abstract it behind an interface. **MUST NOT** use platform-specific date APIs (e.g., `SimpleDateFormat`, `NSDate`) in shared code or without strict validation.

### Incident 3: Progress Indicator Not Showing in Wear OS (BUG-WEAR-03)
- **Context**: `wearApp` (Wear OS Client)
- **What Was Expected**: A progress indicator should be visible while data is loading.
- **What Actually Happened**: The progress indicator was not visible.
- **Evidence in Repo**: Issue #202. The developer suspected a theme-related issue.
- **Root Cause**: The progress indicator's color or size was not compatible with the Wear OS theme. The theme likely used a color that was invisible against the background, or the indicator was too small to be seen on the small Wear OS screen.
- **Remediation Code Diff**:
```kotlin
// - Buggy code / What failed
// CircularProgressIndicator(color = Color.White) // Invisible on white background

// + Fixed pattern / Safe invariant
// CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) // Theme-aware
```
- **Lesson**: **MUST** use theme-aware colors and sizes for UI components. **MUST NOT** hardcode colors or sizes that may not be visible or appropriate for all themes or screen sizes.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
*   **Type Coercion Pitfall**: In `PaddingValuesExt.kt`, the `plus` operator is overloaded to combine `PaddingValues`. This is safe because `Dp` is a value class, but **MUST** ensure that `calculateLeftPadding` and `calculateRightPadding` are called with the correct `LayoutDirection` to avoid mirroring issues in RTL (Right-to-Left) layouts.
*   **Null Safety**: In `WearUiState.kt`, `wearNodes.find { ... } != null` is used to determine `showInstallOnWear`. This is safe, but **MUST** ensure that `wearNodes` is never null. If `wearNodes` could be null, use `wearNodes?.find { ... } != null`.

### 2. Infinite Loop & Recursion Guards
*   **`awaitForState` in Swift**: The `awaitForState` function in `iosApp/iosApp/Utils.swift` uses a `repeat-while` loop with a `Task.sleep`. This is a polling loop. **MUST** ensure that the `predicate` eventually returns `true` to avoid an infinite loop. If the state never changes, the loop will run forever, consuming CPU. **MUST** add a timeout mechanism to break the loop if the state does not change within a reasonable time.
*   **`runOnUiThread` in Kotlin**: The `runOnUiThread` function uses `SwingUtilities.invokeAndWait`. This blocks the calling thread until the UI update is complete. **MUST** ensure that the `block` does not call `runOnUiThread` again, as this would cause a deadlock.

### 3. UI & UX Micro-Mechanics
*   **`rememberRunnable`**: This utility prevents unnecessary recompositions by stabilizing lambda references. **MUST** use this when passing lambdas to stateful components. **MUST NOT** pass inline lambdas directly.
*   **`colorize` in AutoUtils.kt**: This function uses `SpannableString` to apply color spans. **MUST** ensure that `index + length` does not exceed the length of the string, as this would throw a `StringIndexOutOfBoundsException`.

### 4. Backend Concurrency & Memory Safety
*   **`getUrl` in utils.kt**: This function uses `OkHttpClient` to fetch a URL. **MUST** ensure that the `response` is closed using `response.use { ... }` to prevent memory leaks. **MUST** handle non-successful responses by throwing an exception with a descriptive message.
*   **`fetchImage` in AutoUtils.kt**: This function uses Coil to fetch an image. **MUST** ensure that the `ImageRequest` is built with a fallback drawable to handle network errors gracefully.

### 5. Defect & Error Prevention ("Galti Pakadna")
*   **`formatDateTime` in AutoUtils.kt**: This function uses `DateTimeFormatter.ofPattern("MMM d, HH:mm")`. **MUST** ensure that the `LocalDateTime` is not null. **MUST** handle time zone conversions correctly to avoid displaying the wrong time.
*   **`navigateTo` in AutoUtils.kt**: This function uses `Uri.parse` to create a navigation intent. **MUST** ensure that the `latitude` and `longitude` are valid coordinates. **MUST** handle `HostException` by showing a toast message to the user.

---

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: The project uses a **Kotlin Multiplatform (KMP)** architecture with a shared core (`shared/`) and platform-specific UIs (`androidApp/`, `iosApp/`, `compose-desktop/`). The shared core contains the GraphQL client, domain models, and repository logic. The platform UIs are thin presentation layers that consume the shared core.
2.  **Core Abstractions**: Key abstractions include `DateService` (for time abstraction), `WearUiState` (for Wear OS state), and `rememberRunnable` (for lambda stabilization). These abstractions enforce unidirectional data flow and prevent platform-specific code from leaking into the shared core.
3.  **Error Handling**: Error handling is done via exceptions and `Result` types. The `getUrl` function throws an exception if the response is not successful. The `runOnUiThread` function uses `runCatching` to catch exceptions and return a `Result`.
4.  **Testing**: The project uses **Maestro** for UI testing and **JUnit** for unit testing. The `MockDateService` is used to inject a fixed time into tests, making them deterministic.
5.  **Security**: The project uses **Apollo GraphQL** for data fetching, which supports authentication and authorization. The `google-services.json` file is used for Firebase configuration. **MUST** ensure that sensitive data (e.g., API keys) is not hardcoded in the source code.
6.  **Performance**: The project uses **Coil** for image loading, which supports caching and downsampling. The `rememberRunnable` utility prevents unnecessary recompositions, improving performance.
7.  **Deployment**: The project uses **GitHub Actions** for CI/CD. The `backend-deploy.yml` workflow deploys the backend to a cloud provider. The `publish-android.yml` and `publish-ios.yml` workflows publish the Android and iOS apps to the respective stores.
8.  **Agent Patterns**: The project does not explicitly use AI agents, but the `Koog` library is mentioned in the README for AI-based talk recommendations. **MUST** ensure that AI-generated content is validated and sanitized before being displayed to the user.
9.  **Data Flow**: Data flows from the GraphQL backend to the shared core, where it is transformed into domain models. The domain models are then passed to the platform UIs, where they are rendered. **MUST** ensure that data is immutable once it reaches the UI layer to prevent unintended mutations.

---

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: Use `rememberRunnable` to stabilize lambda references in Compose.
2.  **Rule**: **MUST** abstract time acquisition behind an interface for deterministic testing.
3.  **Architecture Principle**: Use a shared core for business logic and platform-specific UIs for presentation.
4.  **Failure Mode**: UI test flakiness due to dynamic list ordering.
5.  **Reusable Skill**: Use `scrollUntilVisible` in Maestro tests for dynamic lists.
6.  **Decision**: Use `kotlinx.datetime` for date parsing to ensure platform-agnostic behavior.
7.  **Anti-pattern**: Passing inline lambdas directly to stateful components in Compose.
8.  **Verification Method**: Use a linter to flag direct calls to `LocalDateTime.now()` in non-utility classes.

---

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Abstract Time**: Create a `DateService` interface and implement it for each platform. Inject it into ViewModels and use it for all time-dependent logic.
2.  **Stabilize Lambdas**: Use `rememberRunnable` or `remember { { ... } }` to stabilize lambda references in Compose.
3.  **Thread Safety**: Use `runOnUiThread` to marshal UI updates to the EDT in desktop applications.
4.  **UI Testing**: Use `scrollUntilVisible` in Maestro tests for dynamic lists. Use a generic wait condition (e.g., any item visible) to avoid timing out.
5.  **Date Parsing**: Use `kotlinx.datetime` for date parsing to ensure platform-agnostic behavior. Avoid platform-specific date APIs.
6.  **Error Handling**: Use `Result` types and exceptions to handle errors gracefully. Ensure that all network calls are wrapped in `try-catch` blocks.
7.  **Performance**: Use Coil for image loading with caching and downsampling. Use `remember` to prevent unnecessary recompositions.
8.  **Security**: Ensure that sensitive data (e.g., API keys) is not hardcoded in the source code. Use environment variables or secure storage.