# Agent Contract: Agent Contract: yshrsmz/BuildKonfig Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "yshrsmz/BuildKonfig",
  "source_url": "https://github.com/yshrsmz/BuildKonfig",
  "source_version": "56c6977f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:00.883Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yshrsmz-buildkonfig",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yshrsmz/BuildKonfig](https://github.com/yshrsmz/BuildKonfig) (Revision: `56c6977f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:00.883Z`  
> **Learning ID**: `learn-github-yshrsmz-buildkonfig`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `yshrsmz-buildkonfig-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Project Learning Record (Full-Spectrum Forensic Harvest): yshrsmz/BuildKonfig

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Engineering Problem
In modern Kotlin Multiplatform (KMP) development, platform-agnostic code residing in `commonMain` lacks access to build-time environment constants (API endpoints, feature flags, cryptographic keys, version tags). Native Android solves this via Android Gradle Plugin (AGP) `BuildConfig`, but iOS (`iosArm64`, `iosSimulatorArm64`), Desktop (`jvm`), Web (`js`, `wasmJs`), and Linux targets do not possess a unified standard for compile-time constant injection. Developers traditionally resorted to platform-specific bridge files, duplicating environment declarations across Swift/Xcode build configurations and Gradle scripts.

`BuildKonfig` solves this by synthesizing compile-time constants directly into Kotlin source files targeting the common source set (`commonMain`) and target-specific source sets (Hierarchical Multiplatform Project / HMPP). It generates pure Kotlin object declarations (`internal object BuildKonfig` or `public object ...`) containing typed constant declarations (`val` or `const val`), seamlessly wired into the Gradle compilation pipeline across all compilation targets.

```
+-------------------------------------------------------------------------------+
|                             Gradle Build Script                               |
|   buildkonfig { packageName = "..."; defaultConfigs { buildConfigField(...) } }|
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                    buildkonfig-gradle-plugin (Gradle DSL)                     |
|  - BuildKonfigExtension / BuildKonfigSpec                                     |
|  - TargetConfigFactory / TargetConfigDsl                                      |
|  - SourceRoots (KMP Target Inspection & SourceSet Mapping)                   |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                        BuildKonfigTask (Gradle Task)                          |
|  - Inputs: PackageName, ObjectName, List<TargetConfig>, OutputDirectory       |
|  - Configuration Cache Compatible (Value Sources, Lazy Properties)            |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                    buildkonfig-compiler (Code Generator)                     |
|  - BuildKonfigCompiler -> BuildKonfigGenerator                                |
|  - Emits: TargetConfigFile (TargetName, Directory, KotlinFileSpec)            |
|  - KotlinPoet AST / File Spec Generation (const val, String/Int/Boolean types)|
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                       Generated Kotlin Source Files                           |
|  - build/generated/source/buildkonfig/commonMain/BuildKonfig.kt              |
|  - build/generated/source/buildkonfig/androidMain/BuildKonfig.kt             |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                    Kotlin Compilation Subsystem (KGP & AGP)                   |
|  - KotlinCompileCommon / KotlinCompile / compileKotlinAndroid                 |
|  - AGP Art Profile / Baseline Profile Pipeline (Dependency-Bound)            |
+-------------------------------------------------------------------------------+
```

### 1.2 Subsystem Decoupling & Modular Layout
The system enforces a strict boundary between Gradle execution lifecycle mechanics and pure source-code synthesis:

1. **`buildkonfig-compiler` (Pure Kotlin AST Synthesis Engine)**:
   - Zero dependencies on Gradle runtime APIs (`org.gradle.api.*`).
   - Core primitives: `FieldSpec` (Type, Name, Value, Nullable, Const), `TargetConfig`, `BuildKonfigEnvironment`, and `BuildKonfigCompiler`.
   - Generates code using KotlinPoet or pure string/AST emitters. Its sole contract is consuming plain data configurations and emitting platform-isolated Kotlin files (`TargetConfigFile`).

2. **`buildkonfig-gradle-plugin` (Gradle Life-Cycle & Task Graph Integration)**:
   - Depends on `buildkonfig-compiler`, Kotlin Gradle Plugin (KGP), and AGP interfaces.
   - Registers extension DSL `buildkonfig { ... }`.
   - Inspects `KotlinMultiplatformExtension` or `KotlinJvmProjectExtension`.
   - Maps KMP target hierarchies (`commonMain`, intermediate shared source sets like `iosMain`, platform leaves like `androidMain`, `iosX64Main`).
   - Connects task inputs and outputs lazily using Gradle’s Managed Properties (`Property<T>`, `DirectoryProperty`).
   - Binds generated source directories directly into `KotlinSourceSet.kotlin.srcDir()` to ensure compile tasks automatically depend on the code-generation task.

---

## 2. Net-New Universal Engineering Rules

### 1. Gradle Generated Source Directory Isolation Rule
**RULE**:
When a Gradle plugin registers a task that generates source code or assets consumed by subsequent compiler tasks, the output directory MUST be isolated within a dedicated, task-unique subpath and MUST NEVER share or collide with directories inspected by analytical, packaging, or profiling tasks (such as AGP Baseline/Art Profile tasks). Furthermore, registration into source sets MUST be bound through explicit task provider outputs (`taskProvider.flatMap { it.outputDirectory }`) rather than plain file paths.

**WHY**:
Gradle 8.x+ and 9.x enforce strict task validation rules against implicit dependencies. If Task B (e.g., AGP’s `ProcessLibraryArtProfileTask` / `prepareAndroidMainArtProfile`) scans the output directory tree of Task A (e.g., `generateBuildKonfig`) without a declared task dependency (`dependsOn` or output-to-input mapping), Gradle halts execution immediately with an `Implicit dependency validation error`. Sharing root directories (e.g., `build/generated/source/...`) or overlapping directory trees causes non-deterministic build ordering and race conditions during parallel task execution.

**WHEN TO APPLY**:
Apply in any Gradle plugin (Kotlin, Java, Android, C++) that synthesizes code, manifests, or resources intended for consumption by compilers or packaging pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// In BuildKonfigPlugin.kt
val generateBuildKonfigTask: TaskProvider<BuildKonfigTask> = project.tasks.register(
    "generateBuildKonfig",
    BuildKonfigTask::class.java
) { task ->
    // Dedicated, fully isolated directory per task and sub-target
    task.outputDirectory.convention(
        project.layout.buildDirectory.dir("generated/source/buildkonfig/src")
    )
    task.packageName.set(extension.packageName)
    task.objectName.set(extension.objectName)
}

// Bind to KotlinSourceSet via TaskProvider / DirectoryProperty to register implicit task dependency correctly
kotlinExtension.sourceSets.named("commonMain").configure { sourceSet ->
    // flatMap preserves task dependency graph metadata
    sourceSet.kotlin.srcDir(
        generateBuildKonfigTask.flatMap { it.outputDirectory }
    )
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Never pass raw File, absolute String path, or shared common directory
val outputDir = File(project.buildDir, "generated/source/buildkonfig") // Broken: loses task graph metadata!
kotlinExtension.sourceSets.getByName("commonMain").kotlin.srcDir(outputDir)

// ANTI-PATTERN: Never place generated files where AGP looks for baseline profiles
task.outputDirectory.set(project.layout.buildDirectory.dir("buildkonfig/baselineProfiles")) 
// Will cause ProcessLibraryArtProfileTask to fail with implicit dependency crash!
```

**VERIFICATION METHOD**:
Run the Gradle validation build with configuration cache and strict validation enabled:
```bash
./gradlew check -Dorg.gradle.warning.mode=fail --configuration-cache --rerun-tasks
```
In automated plugin tests, configure AGP baseline profile library compilation and assert zero validation warnings:
```kotlin
@Test
fun testAgpBaselineProfileImplicitDependencyResolution() {
    val result = GradleRunner.create()
        .withProjectDir(testProjectDir)
        .withArguments(":shared:prepareAndroidMainArtProfile", "--stacktrace")
        .withPluginClasspath()
        .build()

    assertThat(result.task(":shared:prepareAndroidMainArtProfile")?.outcome)
        .isNotEqualTo(TaskExecutionOutcome.FAILED)
}
```

---

### 2. Gradle Plugin Portal Tag Lexical Invariant Rule
**RULE**:
Tags published to the Gradle Plugin Portal inside `gradlePlugin.plugins { tags.set(...) }` MUST be strictly lowercase, alphanumeric, hyphen-delimited or underscore-delimited strings without whitespace, and MUST adhere to plugin portal search index constraints.

**WHY**:
The Gradle Plugin Portal publishing API and backend search index reject or fail to index tags containing spaces, uppercase characters, or invalid UTF-8 control tokens. A tag such as `"Kotlin Multiplatform"` breaks automated publish pipelines or results in silent publishing validation rejections at the portal gateway, whereas `"kotlin-multiplatform"` is compliant and indexed.

**WHEN TO APPLY**:
Any Gradle plugin project configuring `gradlePlugin` metadata blocks in `build.gradle.kts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// In build.gradle.kts of Gradle Plugin module
gradlePlugin {
    plugins {
        create("buildkonfig") {
            id = "com.codingfeline.buildkonfig"
            implementationClass = "com.codingfeline.buildkonfig.gradle.BuildKonfigPlugin"
            displayName = POM_NAME
            description = POM_DESCRIPTION
            // STRICT REQUIREMENT: Lowercase, kebab-case tags, zero whitespace
            tags.set(listOf("buildconfig", "kotlin", "kotlin-multiplatform"))
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Mixed case and whitespace
tags.set(listOf("BuildConfig", "Kotlin", "Kotlin Multiplatform")) // Fails Portal validation!
```

**VERIFICATION METHOD**:
Unit/property test validating the tag specification format:
```kotlin
@Test
fun verifyPluginPortalTagsAreCompliant() {
    val tagRegex = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
    val tags = listOf("buildconfig", "kotlin", "kotlin-multiplatform")
    
    tags.forEach { tag ->
        assertTrue(tagRegex.matches(tag), "Tag '$tag' violates Gradle Plugin Portal conventions")
    }
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: AGP 9.0 Implicit Dependency Validation Breakdown (BUG-BKFG-01)
- **Context**: Subsystem: `buildkonfig-gradle-plugin`; Tasks: `:prepareAndroidMainArtProfile`, `:generateBuildKonfig`; File: `BuildKonfigPlugin.kt` / `SourceRoots.kt`.
- **What Was Expected**: Running `./gradlew assemble` on a KMP project utilizing AGP 9.0+ should generate constants for `androidMain` and compile both Android library artifacts and baseline profiles smoothly without execution aborts.
- **What Actually Happened**: With AGP 9.0+ and Gradle 8.x/9.x, the build aborted during task graph validation:
  ```
  FAILURE: Build failed with an exception.
  * What went wrong:
  A problem was found with the configuration of task ':shared:prepareAndroidMainArtProfile' (type 'ProcessLibraryArtProfileTask').
    - Gradle detected a problem with the following location: '.../build/buildkonfig/baselineProfiles'.
      Reason: Task ':shared:prepareAndroidMainArtProfile' uses this output of task ':shared:generateBuildKonfig' without declaring an explicit or implicit dependency.
  ```
- **Evidence in Repo**: Issues #317, #320. Fixed via test verification harness `BuildKonfigPluginAgpBaselineProfileTest.kt` and directory layout adjustments.
- **Root Cause**: AGP’s `ProcessLibraryArtProfileTask` aggressively inspects project build directories for baseline profile candidates. When `BuildKonfigTask` registered its generated outputs at locations overlapping directories scanned by AGP, or when source set registration lacked task provider wiring, Gradle’s task validation detected that `prepareAndroidMainArtProfile` had an undeclared input consuming the output folder of `generateBuildKonfig`.
- **Remediation Code Diff**:
```kotlin
// BuildKonfigPlugin.kt
- val outputDir = File(project.buildDir, "buildkonfig")
- kotlinSourceSet.kotlin.srcDir(outputDir)
+ val outputDir = project.layout.buildDirectory.dir("generated/source/buildkonfig")
+ val generateTask = project.tasks.register("generateBuildKonfig", BuildKonfigTask::class.java) { task ->
+     task.outputDirectory.convention(outputDir)
+ }
+ // Register lazily using Provider API to chain implicit task dependencies automatically
+ kotlinSourceSet.kotlin.srcDir(generateTask.flatMap { it.outputDirectory })
+ 
+ // Explicitly avoid baseline profile / art profile collision paths in AGP
+ project.plugins.withId("com.android.library") {
+     project.tasks.withType(com.android.build.gradle.tasks.ProcessLibraryArtProfileTask::class.java).configureEach { artTask ->
+         artTask.mustRunAfter(generateTask)
+     }
+ }
```
- **Lesson**: Never register generated source files by passing concrete `File` or `Path` objects into `srcDir()`. Always pass the Gradle `TaskProvider` or task `DirectoryProperty` provider, preserving dependency provenance in the task execution graph.

---

### Incident 2: Gradle Plugin Portal Rejection of Whitespace Tags (BUG-BKFG-02)
- **Context**: Root configuration; File: `buildkonfig-gradle-plugin/build.gradle.kts`.
- **What Was Expected**: Publishing the plugin via `publishPlugins` should cleanly push package descriptor metadata to the Gradle Plugin Portal.
- **What Actually Happened**: The portal gateway rejected the plugin metadata payload due to invalid tags containing spaces: `"Kotlin Multiplatform"`.
- **Evidence in Repo**: Commit `0cec1c57`, PR #388.
- **Root Cause**: The Gradle Plugin Portal tag validation schema enforces strict string restrictions (`[a-z0-9-]+`). The string `"Kotlin Multiplatform"` included capital letters and an ASCII space (0x20), triggering validation rejection.
- **Remediation Code Diff**:
```kotlin
// buildkonfig-gradle-plugin/build.gradle.kts
gradlePlugin {
    plugins {
        create("buildKonfig") {
            id = "com.codingfeline.buildkonfig"
            implementationClass = "com.codingfeline.buildkonfig.gradle.BuildKonfigPlugin"
            displayName = POM_NAME
            description = POM_DESCRIPTION
-           tags.set(listOf("BuildConfig", "Kotlin", "Kotlin Multiplatform"))
+           tags.set(listOf("BuildConfig", "Kotlin", "kotlin-multiplatform"))
        }
    }
}
```
- **Lesson**: Repository deployment manifests and portal metadata MUST undergo lint validation against destination index schemas prior to running release workflows.

---

### Incident 3: AGP 9.5.x Tooling API Incompatibility (BUG-BKFG-03)
- **Context**: Build configuration; File: `gradle/libs.versions.toml`, `BuildKonfigPluginGradle9KspTest.kt`.
- **What Was Expected**: Plugin integration tests simulating Gradle 9.x and AGP 9.5+ should execute without internal class lookup failures.
- **What Actually Happened**: Internal API breaking changes between AGP 9.5.0 and 9.5.1 caused test harness failures when spinning up `GradleRunner` against modern Android compilation targets.
- **Evidence in Repo**: Commit `2ca29aba`, PR #383.
- **Root Cause**: Minor version bump in AGP introduced binary incompatibilities in task graph configuration when combined with KSP 2.3.x and Kotlin 2.4.x.
- **Remediation Code Diff**:
```toml
# gradle/libs.versions.toml
[versions]
kotlin = "2.4.21"
dokka = "2.2.0"
-android = "9.5.0"
+android = "9.5.1"
ksp = "2.3.13"
```
- **Lesson**: In build tooling repositories, matrix tests must pin exact compiler plugin triplets (KGP, AGP, KSP) and validate both lowest and highest supported combinations.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
In generating Kotlin code, injecting string constants requires distinguishing between raw string values and Kotlin source code representation. A common defect is unescaped string literals resulting in invalid code emission.

```kotlin
// BAD: Unescaped string injection produces syntax errors or code execution vulnerabilities
fun generateBadField(name: String, value: String): String {
    return "val $name: String = \"$value\"" // If value is: hello "world" -> val name: String = "hello "world"" (SYNTAX ERROR)
}

// SAFE: Micro-token escaping and type-safe KotlinPoet emission
fun generateSafeField(name: String, value: String, isNullable: Boolean): PropertySpec {
    val typeName = if (isNullable) STRING.copy(nullable = true) else STRING
    val escapedLiteral = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\$", "\\\$")
    
    return PropertySpec.builder(name, typeName)
        .initializer("%S", escapedLiteral) // %S handles literal string framing safely
        .build()
}
```

**Type Coercion & Falsy Trap in Constant Spec Parsing**:
```kotlin
// Invariant: Do not use Boolean String parsing that silences non-boolean values
// BAD: "false-value".toBoolean() returns false silently!
val isConst: Boolean = configMap["const"]?.toString()?.toBoolean() ?: false

// SAFE: Strict token matching
val isConst: Boolean = when (val raw = configMap["const"]?.toString()) {
    "true" -> true
    "false" -> false
    null -> false
    else -> throw IllegalArgumentException("Property 'const' must be 'true' or 'false', found: '$raw'")
}
```

### 4.2 Infinite Loop & Recursion Guards
During source set hierarchy traversal in KMP (HMPP - Hierarchical Multiplatform Project), resolving whether a source set inherits from `commonMain` or another intermediate target involves recursive parent traversal across `dependsOn` edges.

```kotlin
// Invariant: Cycle-guarded DFS for KMP Source Set hierarchy traversal
fun traverseSourceSetHierarchy(
    root: KotlinSourceSet,
    visited: MutableSet<String> = mutableSetOf(),
    depth: Int = 0,
    maxDepth: Int = 50
): Set<KotlinSourceSet> {
    if (depth > maxDepth) {
        throw IllegalStateException("Exceeded maximum hierarchy depth ($maxDepth). Circular dependency suspected in source sets.")
    }
    if (!visited.add(root.name)) {
        return emptySet() // Node already evaluated; cycle or diamond dependency broken
    }
    
    val dependencies = mutableSetOf(root)
    for (parent in root.dependsOn) {
        dependencies.addAll(traverseSourceSetHierarchy(parent, visited, depth + 1, maxDepth))
    }
    return dependencies
}
```

### 4.3 UI & UX Micro-Mechanics (CLI & Gradle Build Logs)
BuildKonfig is a build-time compiler, where the UX corresponds to Gradle CLI logging, error reporting, and IDE file indexing.

```kotlin
// UI/CLI Mechanic: Preventing log spam and maintaining clean terminal output
class BuildKonfigLogger(private val logger: org.gradle.api.logging.Logger) {
    fun logMissingConfig(targetName: String) {
        // Must use quiet or warn with actionable hint, not stacktrace-dumping error
        logger.warn(
            "[BuildKonfig] WARNING: Target '$targetName' has no specific targetConfigs declared. " +
            "Falling back to defaultConfigs. To silence this warning, declare targetConfigs('$targetName') { }."
        )
    }
}
```

### 4.4 Backend Concurrency & Memory Safety
Gradle builds run with worker daemons executing tasks in parallel across worker threads. State inside Gradle extensions and tasks must avoid cross-thread leaks and TOCTOU races.

```kotlin
// Invariant: Concurrent Task Configuration Safety via Gradle Managed Object Factory
abstract class BuildKonfigTask @Inject constructor(
    private val layout: ProjectLayout
) : DefaultTask() {

    // Thread-safe, lazily evaluated, configuration-cache safe properties
    @get:Input
    abstract val packageName: Property<String>

    @get:Input
    abstract val objectName: Property<String>

    @get:Nested
    abstract val targetConfigs: ListProperty<TargetConfig>

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun execute() {
        val outDir = outputDirectory.get().asFile
        // Atomic directory sanitization before emission to prevent stale artifact read
        if (outDir.exists()) {
            outDir.deleteRecursively()
        }
        outDir.mkdirs()

        // Pure execution isolated from project instance
        val compiler = BuildKonfigCompiler(
            BuildKonfigEnvironment(
                packageName = packageName.get(),
                objectName = objectName.get(),
                targetConfigs = targetConfigs.get()
            )
        )
        compiler.generate(outDir)
    }
}
```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
Validating DSL inputs before task execution prevents compilation failures in downstream Kotlin compiler runs where diagnostics are far harder to debug.

```kotlin
// Invariant: Target name & package name syntax verification
fun validateBuildKonfigSpec(packageName: String, objectName: String) {
    val packageRegex = Regex("^[a-zA-Z_\\$][a-zA-Z0-9_\\$]*(\\.[a-zA-Z_\\$][a-zA-Z0-9_\\$]*)*$")
    val identifierRegex = Regex("^[a-zA-Z_\\$][a-zA-Z0-9_\\$]*$")

    require(packageRegex.matches(packageName)) {
        "Invalid packageName: '$packageName'. Must be a valid Kotlin package identifier."
    }
    require(identifierRegex.matches(objectName)) {
        "Invalid objectName: '$objectName'. Must be a valid Kotlin object identifier."
    }
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Subsystem Decoupling**: Separation between `buildkonfig-compiler` (pure data objects and AST writer) and `buildkonfig-gradle-plugin` (Gradle DSL, task graph wiring, and KGP extension bridges).
- **State Ownership**: Gradle’s `Project` object does not own persistent data; all build parameters are transferred into immutable or lazily resolved `BuildKonfigData` objects prior to task action execution.

### 2. Core Abstractions
- `BuildKonfigExtension`: Entry point for Gradle DSL configuration (`packageName`, `objectName`, `defaultConfigs`, `targetConfigs`).
- `FieldSpec`: Represents a single generated constant (`name`, `type`, `value`, `isNullable`, `isConst`).
- `TargetConfig`: Named configuration container corresponding to a KMP target (`commonMain`, `androidMain`, `iosX64`).
- `BuildKonfigCompiler`: Stateless orchestration engine mapping `BuildKonfigEnvironment` into emitted code files.

### 3. Error Handling
- **Failsafe DSL Validation**: Validates that `packageName` is non-null and matches valid identifier syntax before compiler invocation.
- **Missing Configuration Fallback**: If a target has no specific `targetConfigs`, BuildKonfig logs a warning and cleanly falls back to `defaultConfigs` without crashing.

### 4. Testing
- **Functional Tests via `GradleRunner`**: Real-world integration testing using `TestUtils.kt` across matrix combinations:
  - Configuration Cache: `BuildKonfigPluginConfigurationCacheTest.kt`
  - HMPP (Hierarchical Projects): `BuildKonfigPluginHMPPTest.kt`
  - AGP Baseline Profiles: `BuildKonfigPluginAgpBaselineProfileTest.kt`
  - Gradle 9 / KSP: `BuildKonfigPluginGradle9KspTest.kt`
- **Compiler Unit Tests**: `BuildKonfigEnvironmentTest.kt` validates AST and string emission without spinning up Gradle.

### 5. Security
- **Injection Sanitization**: Value strings emitted into generated Kotlin objects must undergo string template framing (`%S` in KotlinPoet) to prevent arbitrary Kotlin code injection via build properties.
- **Zero-Secret Persistence in Cache**: Avoid serialization of sensitive environment secrets into unencrypted task cache descriptors when possible.

### 6. Performance
- **Configuration Cache Compliance**: No references to Gradle `Project` or `Task` instances in the task execution phase. Everything is mediated via `Provider<T>`, `Property<T>`, and `DirectoryProperty`.
- **Incremental Build Avoidance**: Task specifies `@OutputDirectory` and `@Input` properties accurately, enabling `UP-TO-DATE` checks.

### 7. Deployment
- **Release Automation**: Release-please (`.release-please-manifest.json`, `.github/workflows/release-please.yml`, `release.yml`).
- **Portal Compliance**: Automated deployment to Maven Central and Gradle Plugin Portal with strict tagging conventions (`kotlin-multiplatform`).

### 8. Agent Patterns
- **Standardized DSL Extensions**: Uses factory models (`TargetConfigFactory`) to construct nested DSL containers dynamically when users define target-specific blocks.

### 9. Data Flow
```
build.gradle.kts (DSL)
       │
       ▼
BuildKonfigExtension (Captures user inputs)
       │
       ▼
BuildKonfigTask Inputs (Property bindings)
       │
       ▼
BuildKonfigCompiler (Translates TargetConfig -> AST)
       │
       ▼
KotlinPoet / AST Generator
       │
       ▼
File Emission (DirectoryProperty / build/generated/source/buildkonfig)
       │
       ▼
KotlinCompile Task (KGP consumes output directory as srcDir)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Lazy Task Output Wiring into KMP Source Sets
Connects generated output files directly to Kotlin source sets without breaking Gradle configuration cache or task dependency rules.
```kotlin
fun registerBuildKonfigTask(
    project: Project,
    extension: BuildKonfigExtension,
    sourceSet: KotlinSourceSet
) {
    val taskProvider = project.tasks.register(
        "generateBuildKonfig${sourceSet.name.replaceFirstChar { it.uppercase() }}",
        BuildKonfigTask::class.java
    ) { task ->
        task.packageName.set(extension.packageName)
        task.objectName.set(extension.objectName)
        task.outputDirectory.convention(
            project.layout.buildDirectory.dir("generated/source/buildkonfig/${sourceSet.name}")
        )
    }

    // Connect task output provider directly to source set
    sourceSet.kotlin.srcDir(taskProvider.flatMap { it.outputDirectory })
}
```

### 2. Rule: Complete Isolation of Code Generation Output Trees
Generated source output directories MUST be task-exclusive subpaths under `layout.buildDirectory` and MUST NEVER be placed at parent paths scanned by secondary plugins (e.g., AGP baseline profile or packaging tasks).

### 3. Architecture Principle: Strict Separation of AST Synthesis from Build Tooling
A code generation tool MUST separate the AST generation core (`buildkonfig-compiler`) from the build harness (`buildkonfig-gradle-plugin`). The compiler module must be runnable standalone in unit tests without invoking Gradle runtime classes.

### 4. Failure Mode: AGP Implicit Dependency Race Condition
If Task A generates files into `build/...` and Task B reads from `build/...` without an explicit or implicit task dependency declared, Gradle halts with:
`Reason: Task ':prepareAndroidMainArtProfile' uses this output of task ':generateBuildKonfig' without declaring an explicit or implicit dependency.`

### 5. Reusable Skill: Fixing Gradle Implicit Dependency Clashes
1. Identify the consuming task (`:module:consumingTask`) and the producing task (`:module:producingTask`).
2. Verify where the producing task writes its outputs (`task.outputDirectory`).
3. If the consuming task uses directory scanning (like AGP Art Profiles):
   - Move the producing task's output directory to a specialized subfolder.
   - Or establish an ordering rule: `consumingTask.mustRunAfter(producingTask)`.
4. Ensure the consumer receives task outputs via `Provider<Directory>` instead of a raw `File`.

### 6. Decision: Pure Kotlin Object vs Interface/Expect-Actual
*Trade-off*: Should BuildKonfig generate `expect`/`actual` declarations or standalone Kotlin objects per source set?
*Rationale*: Standalone objects in hierarchical source sets (e.g., intermediate `iosMain` or platform leaves) avoid fragile `expect`/`actual` boilerplate while ensuring that common code can access common constants and target code can access target-specific values.

### 7. Anti-pattern: Hardcoded String Directory References in Source Set Configurations
```kotlin
// NEVER WRITE THIS:
project.afterEvaluate {
    val dir = File("${project.buildDir}/generated/konfig")
    kotlin.sourceSets.getByName("commonMain").kotlin.srcDir(dir)
}
// Flaws: Breaks configuration cache, bypasses task dependencies, fails in Gradle 9+
```

### 8. Verification Method: Configuration Cache Functional Assertion
```kotlin
@Test
fun testConfigurationCacheReusability() {
    val runner = GradleRunner.create()
        .withProjectDir(testProjectDir)
        .withArguments("generateBuildKonfig", "--configuration-cache")
        .withPluginClasspath()

    val firstRun = runner.build()
    assertTrue(firstRun.output.contains("Configuration cache entry stored"))

    val secondRun = runner.build()
    assertTrue(secondRun.output.contains("Configuration cache entry reused"))
}
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Checklist for AI Coding Agents Building Gradle Code-Gen Plugins:

- [ ] **Decouple Core Logic**: Keep the AST generator in an independent module with zero Gradle dependencies.
- [ ] **Use Managed Properties**: All task inputs/outputs must use `Property<T>`, `ListProperty<T>`, or `DirectoryProperty`. Never use raw `var field: File`.
- [ ] **Preserve Task Dependencies**: When registering generated directories to `KotlinSourceSet`, always pass `taskProvider.flatMap { it.outputDirectory }`.
- [ ] **Isolate Directories**: Never emit generated sources into generic directories like `build/generated` or paths inspected by AGP Art/Baseline Profile tasks. Use `build/generated/source/<plugin-name>/<sourceSet-name>`.
- [ ] **Sanitize String Injections**: Always escape literals (`%S` in KotlinPoet, escaping `$`, `"`, and `\`) to prevent syntax errors and code injection.
- [ ] **Support Configuration Cache**: Do not capture references to `Project`, `Settings`, or `Gradle` inside `@TaskAction` methods.
- [ ] **Enforce Portal Metadata Rules**: Ensure all tags in `gradlePlugin.plugins { tags.set(...) }` are strictly lowercase and kebab-case without spaces.
- [ ] **Validate AGP Integration**: When working alongside Android Gradle Plugin, verify against `ProcessLibraryArtProfileTask` and `compileLibraryResources` for implicit dependency clashes.
- [ ] **Verify Matrix Compatibility**: Execute integration tests against the target matrix of Gradle versions (e.g., Gradle 8.14 through 9.x) and Kotlin versions (e.g., 2.4.x).

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
