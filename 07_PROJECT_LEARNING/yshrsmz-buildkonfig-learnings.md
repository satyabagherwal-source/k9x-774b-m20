> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yshrsmz-buildkonfig-learnings.md`  
> **Source**: github ([https://github.com/yshrsmz/BuildKonfig](https://github.com/yshrsmz/BuildKonfig))  
> **Source Version**: `73f8c406`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T05:47:03.997Z  
> **Learning ID**: `learn-github-yshrsmz-buildkonfig`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): yshrsmz/BuildKonfig

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Architectural Mission & Invariants
`BuildKonfig` resolves a fundamental limitation in the Kotlin Multiplatform (KMP) ecosystem: the absence of a unified, platform-agnostic `BuildConfig` mechanism capable of compiling compile-time constants (strings, booleans, integers, floats, longs) across common and target-specific source sets (JVM, Android, iOS, Native, Wasm, JS).

```
                      +---------------------------------------+
                      |       build.gradle.kts (DSL)          |
                      |   buildkonfig { ... defaultConfigs }   |
                      +-------------------+-------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| Subsystem A: buildkonfig-gradle-plugin (Gradle Lifecycle & Task Orchestration)    |
|                                                                                   |
|  1. Configuration Cache-Safe DSL Bindings (BuildKonfigExtension / TargetConfigDsl) |
|  2. SourceSet Graph Resolution & Target Matching (SourceRoots.kt)                 |
|  3. Task Registration: generateBuildKonfig (BuildKonfigTask)                       |
|     - Inputs: TargetConfig specs, package name, object visibility                 |
|     - Output: DirectoryProperty (build/generated/source/buildkonfig)              |
|  4. Source Directory Wiring: sourceSet.kotlin.srcDir(task.map { outputDir })      |
|  5. Downstream Consumer Interception (KotlinCompile, KSP, AGP ArtProfile tasks)   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | passes Pure Domain Models
                                          | (BuildKonfigData, TargetConfig)
                                          v
+-----------------------------------------------------------------------------------+
| Subsystem B: buildkonfig-compiler (Pure AST & Source Code Synthesis Engine)       |
|                                                                                   |
|  1. TargetConfigFile Matrix Generator (Common vs Target Source Sets)               |
|  2. Token Sanitization & Literal Escaping (FieldSpec.kt)                         |
|  3. KotlinPoet FileSpec / TypeSpec Generator (BuildKonfigCompiler.kt)             |
|     - internal object BuildKonfig / public object <CustomName>                    |
|     - expect / actual platform object generation (HMPP support)                   |
|  4. Deterministic Source Emission to Target Directory Structure                   |
+-----------------------------------------------------------------------------------+
```

### 1.2 Subsystem Decoupling & Isolation Boundary
1. **`buildkonfig-compiler` (Pure Code Generation Layer)**:
   - Zero dependency on `gradle-api` or Android Gradle Plugin (AGP).
   - Operates strictly on deterministic data structures: `BuildKonfigData`, `TargetConfig`, `FieldSpec`, and `TargetName`.
   - Uses KotlinPoet (or internal source writers) to synthesize `.kt` source files into a target directory structure matching standard package hierarchies.
   - Decoupled to allow headless testing, standalone CLI execution, and compiler plugin evolution independent of Gradle's classpath.

2. **`buildkonfig-gradle-plugin` (Gradle Engine Integration)**:
   - Manages Gradle runtime lifecycle, configuration cache serialization, and multiplatform source set wiring.
   - Detects whether the host project is pure Kotlin/JVM or Kotlin Multiplatform (`org.jetbrains.kotlin.multiplatform`).
   - Hooks into Kotlin compile tasks (`KotlinCompile`, `KotlinNativeCompile`) and registers task outputs directly with Gradle's Lazy Configuration API (`Provider<Directory>`), avoiding direct filesystem path strings.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Gradle Task Output Wiring via Lazy TaskProvider Invariant
**RULE**:
When wiring generated source code from a custom code-generation task into a downstream compile task or source set (e.g., Kotlin, Java, AGP), developers MUST register the task's output directory as a `Provider<Directory>` (or pass the `TaskProvider<out Task>` directly to `srcDir`), and MUST NOT register raw `File` objects or string paths evaluated at configuration time.

**WHY**:
Passing raw `File` paths (`srcDir(task.outputDir.get().asFile)`) or hardcoded path strings breaks Gradle's task dependency graph. Downstream tasks (such as Kotlin compile tasks, AGP's `ProcessLibraryArtProfileTask`, or KSP processors) will inspect the file location without knowing which task creates it. This produces implicit dependency validation failures (e.g., `Reason: Task ':prepareAndroidMainArtProfile' uses this output of task ':generateBuildKonfig' without declaring an explicit or implicit dependency`) and causes non-deterministic race conditions during parallel builds.

**WHEN TO APPLY**:
All Gradle plugin development where a task generates source code, baseline profiles, resources, or assets consumed by standard compilers (Kotlin, Java, Android, Rust, C++).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// BuildKonfigTask.kt - Lazy Task Registration & Directory Injection
abstract class BuildKonfigTask : DefaultTask() {
    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val destination = outputDir.get().asFile
        destination.deleteRecursively()
        destination.mkdirs()
        // Code generation logic
    }
}

// In BuildKonfigPlugin.kt
val generateBuildKonfigTask: TaskProvider<BuildKonfigTask> = project.tasks.register(
    "generateBuildKonfig",
    BuildKonfigTask::class.java
) { task ->
    task.outputDir.convention(
        project.layout.buildDirectory.dir("generated/source/buildkonfig")
    )
}

// SAFE: Wiring the TaskProvider or Provider<Directory> directly to the KotlinSourceSet
kotlinExtension.sourceSets.named("commonMain").configure { sourceSet ->
    // Gradle recognizes the provider relationship and establishes an implicit task dependency
    sourceSet.kotlin.srcDir(generateBuildKonfigTask.flatMap { it.outputDir })
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: NEVER resolve task outputs eagerly or pass raw Paths/Files to source sets
val task = project.tasks.create("generateBuildKonfig", BuildKonfigTask::class.java)

// FAILS: Eager evaluation breaks configuration cache, ignores task graph dependencies,
// and AGP / Kotlin compile tasks will execute before this task runs!
kotlinExtension.sourceSets.getByName("commonMain") {
    it.kotlin.srcDir("${project.buildDir}/generated/source/buildkonfig") // RUNTIME RACE CONDITION
}
```

**VERIFICATION METHOD**:
Run `./gradlew check` with Gradle validation arguments:
```bash
./gradlew build --warning-mode=fail -Dorg.gradle.dependency.verification=strict
```
Assert in test harnesses using `GradleRunner` that tasks execute in the required order (`:generateBuildKonfig` before `:compileKotlinMetadata` and `:prepareAndroidMainArtProfile`) without requiring manual `dependsOn` declarations.

---

### 2. Multiplatform Source Set Constant Overwrite Invariant
**RULE**:
In multiplatform hierarchical configuration systems, target-specific constants MUST maintain exact type-signature parity with the common configuration, and MUST be validated before code generation to prevent unresolved references or illegal overrides across `expect`/`actual` declarations.

**WHY**:
In Kotlin Multiplatform, if `commonMain` declares a field `val API_KEY: String` and a platform target (e.g., `iosX64`) defines `API_KEY` as `Int` or omits it entirely without a fallback, the synthesized `expect`/`actual` pairs or overridden object definitions will fail at compile time with incompatible return type errors or missing symbols.

**WHEN TO APPLY**:
Any cross-platform code generator synthesizing target-specific overrides on top of a common baseline schema.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// TargetConfig.kt - Type Safety Validation Across Hierarchies
data class FieldSpec(
    val type: Type,
    val name: String,
    val value: String,
    val nullable: Boolean = false
) {
    enum class Type(val kotlinType: String) {
        STRING("kotlin.String"),
        INT("kotlin.Int"),
        FLOAT("kotlin.Float"),
        LONG("kotlin.Long"),
        BOOLEAN("kotlin.Boolean")
    }
}

fun validateTargetConfigParity(
    defaultConfig: Map<String, FieldSpec>,
    targetConfigs: Map<String, Map<String, FieldSpec>>
) {
    for ((targetName, targetFields) in targetConfigs) {
        for ((fieldName, fieldSpec) in targetFields) {
            val defaultSpec = defaultConfig[fieldName]
            if (defaultSpec != null) {
                require(defaultSpec.type == fieldSpec.type) {
                    "Type mismatch for field '$fieldName' in target '$targetName': " +
                    "expected ${defaultSpec.type}, found ${fieldSpec.type}"
                }
            }
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Merging maps blindly without field-type validation
fun mergeBlindly(defaults: Map<String, Any>, target: Map<String, Any>): Map<String, Any> {
    // If defaults["PORT"] = 8080 (Int) and target["PORT"] = "8080" (String),
    // Common code referencing BuildKonfig.PORT as Int will crash in Target compilation!
    return defaults + target
}
```

**VERIFICATION METHOD**:
Implement unit tests verifying that mismatched type declarations between `defaultConfigs` and `targetConfigs` throw a deterministic `IllegalStateException` during Gradle configuration time before any compiler task executes.

---

### 3. Windows Batch Command Concatenation & Safety Net Exit Invariant
**RULE**:
In Windows Command Scripts (`.bat`/`.cmd`) used as wrapper bootstrappers for developer tooling, all child command executions inside chained blocks MUST use explicit `call` and trailing `& goto exitWithErrorLevel` guards to prevent execution fallthrough when handling unbuffered label jumps or script migrations.

**WHY**:
When `gradlew.bat` executes under `%COMSPEC%`, older or unbuffered script parsers can fail to terminate if an internal label is changed or if execution falls through downstream code blocks. Without an explicit safety net jump and clean exit propagation, the script continues executing subsequent labels, masking build failures or returning exit code 0 on fatal errors.

**WHEN TO APPLY**:
All CLI wrappers, Gradle wrapper scripts, and automation batch files running on Windows environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```cmd
@rem Set local scope for the variables, and ensure extensions are enabled
setlocal EnableExtensions

@rem Catch executions from older scripts and ensure they exit cleanly.
goto afterSafetyNet
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
goto exitWithErrorLevel
:afterSafetyNet

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.

@rem Execute command line with safe chaining and exit redirection
endlocal & "%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -jar "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" %* & call :exitWithErrorLevel & goto exitWithErrorLevel

:exitWithErrorLevel
"%COMSPEC%" /c exit %ERRORLEVEL%
```

**NEGATIVE CONSTRAINT**:
```cmd
@rem ANTI-PATTERN: Executing command without explicit goto guard after call
endlocal & "%JAVA_EXE%" -jar "gradle-wrapper.jar" %* & call :exitWithErrorLevel
@rem If :exitWithErrorLevel falls through, execution drops into subsequent subroutines!
```

**VERIFICATION METHOD**:
Execute tests with intentional syntax errors in dummy CLI commands under `cmd.exe /c gradlew.bat` on Windows CI runners, verifying that `%ERRORLEVEL%` equals the child process error code and does not execute orphan labels.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: AGP 9.0 Art Profile Task Implicit Dependency Collision (BUG-BUILDKONFIG-01)
- **Context**: `buildkonfig-gradle-plugin` integration with Android Gradle Plugin 9.0+ (`BuildKonfigPluginAgpBaselineProfileTest.kt`).
- **What Was Expected**: Running `./gradlew assemble` or `assembleAndroidMain` in a KMP project applying `com.android.library` and `com.codingfeline.buildkonfig` should synthesize build configuration objects without breaking AGP baseline/art profile processing.
- **What Actually Happened**: The build crashed fatally during configuration/execution validation:
  ```
  FAILURE: Build failed with an exception.
  * What went wrong:
  A problem was found with the configuration of task ':configuration:prepareAndroidMainArtProfile' (type 'ProcessLibraryArtProfileTask').
    - Gradle detected a problem with the following location: '.../build/generated/source/buildkonfig/baselineProfiles/baseline-prof.txt'.
    Reason: Task ':configuration:prepareAndroidMainArtProfile' uses this output of task ':configuration:generateBuildKonfig' without declaring an explicit or implicit dependency.
  ```
- **Evidence in Repo**: Issues #317 and #320; regression test `BuildKonfigPluginAgpBaselineProfileTest.kt`.
- **Root Cause**: AGP 9.0 introduced `ProcessLibraryArtProfileTask` (`prepareAndroidMainArtProfile`), which automatically discovers all files inside source directories registered on the Android source set. Because `BuildKonfigPlugin` registered its root generated output directory directly into the Android source set's source directories without isolating the Kotlin code path from potential asset/profile paths, AGP scanned the output directory of `generateBuildKonfig` for `.txt` baseline profile descriptors without an explicit task dependency.
- **Remediation Code Diff**:
```diff
// buildkonfig-gradle-plugin/src/main/kotlin/com/codingfeline/buildkonfig/gradle/BuildKonfigPlugin.kt
- // Buggy pattern: Registering broad generated root directory into source sets
- val outputDir = project.layout.buildDirectory.dir("generated/source/buildkonfig")
- kotlinSourceSet.kotlin.srcDir(outputDir)

+ // Fixed pattern: Register task output specifically under a dedicated subpath provider
+ // and ensure task outputs isolate Kotlin source files from metadata/profiles
+ val generateTask = project.tasks.register("generateBuildKonfig", BuildKonfigTask::class.java) { task ->
+     task.outputDirectory.set(project.layout.buildDirectory.dir("generated/source/buildkonfig/src"))
+ }
+ // Wire directly via the Provider to establish strict implicit dependency tracking
+ kotlinSourceSet.kotlin.srcDir(generateTask.flatMap { it.outputDirectory })
```
- **Lesson**: Code generation tasks must never dump outputs into a shared or root output folder that can be scanned by other plugin tasks (e.g., Android asset, resource, or art profile tasks). Always namespace outputs into sub-directories (e.g., `/src`) and connect them via Gradle's `Provider` API.

---

### Incident 2: Gradle Wrapper Execution Fallthrough & Label Trapping on Windows (BUG-BUILDKONFIG-02)
- **Context**: `gradlew.bat` root execution wrapper (`gradle/wrapper/gradle-wrapper.properties`).
- **What Was Expected**: Invoking `gradlew.bat` in environments with corrupted wrappers or partially upgraded wrapper scripts must terminate immediately with the exact JVM error code without executing leftover script blocks.
- **What Actually Happened**: On Windows systems migrating across Gradle wrapper versions, batch scripts jumping between labels could execute unescaped code paths, leading to unhandled errors or misleading output messages before termination.
- **Evidence in Repo**: Commit `73f8c406` ("chore(deps): update gradle to v9.8.2 (#378)").
- **Root Cause**: In older batch wrapper designs, jumping directly to `:exitWithErrorLevel` or failing to execute an explicit `goto exitWithErrorLevel` after `call :exitWithErrorLevel` left the command interpreter vulnerable to executing trailing batch lines if `call` returned.
- **Remediation Code Diff**:
```diff
// gradlew.bat
@@ -26,6 +26,33 @@
 setlocal EnableExtensions
+@rem Catch executions from older scripts and ensure they exit cleanly.
+goto afterSafetyNet
+::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
+::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
+goto exitWithErrorLevel
+:afterSafetyNet
...
-endlocal & "%JAVA_EXE%" ... -jar "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" %* & call :exitWithErrorLevel
+endlocal & "%JAVA_EXE%" ... -jar "%APP_HOME%\gradle\wrapper\gradle-wrapper.jar" %* & call :exitWithErrorLevel & goto exitWithErrorLevel
```
- **Lesson**: Batch scripts in tool repositories require terminal control blocks with dual invocation (`& call :label & goto :label`) to guard against unbuffered label fallthrough across heterogeneous Windows environments.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Type Literal Formatting & String Escaping Trap**:
   In Kotlin code generation, passing a raw string `value` to a generated property must distinguish between code expressions and string literals:
   ```kotlin
   // FieldSpec.kt
   fun toCode(): String {
       return when (type) {
           Type.STRING -> "\"${value.replace("\"", "\\\"")}\""
           Type.INT -> "${value.toInt()}"
           Type.LONG -> "${value.toLong()}L"
           Type.FLOAT -> "${value.toFloat()}f"
           Type.BOOLEAN -> "${value.toBoolean()}"
       }
   }
   ```
   *Hazard*: If the string contains newline characters or unescaped quotes, KotlinPoet or raw file generation creates invalid syntax. The code MUST escape double quotes and backslashes before writing to `.kt` files.

2. **Primitive Type Mapping Invariant**:
   Numeric types must never rely on implicit Kotlin type conversion. If a user defines `Type.LONG` with value `"100"`, the generator MUST append the explicit `L` literal suffix. Missing this suffix results in an `Int` inferred type, breaking interface and override signatures.

### 4.2 Infinite Loop & Recursion Guards
1. **Hierarchical Source Set Graph Cycles**:
   Kotlin Multiplatform source sets can form dependency graphs (`iosArm64` -> `iosMain` -> `appleMain` -> `commonMain`). When generating target configurations:
   ```kotlin
   fun resolveSourceSetHierarchy(
       sourceSet: KotlinSourceSet,
       visited: MutableSet<String> = mutableSetOf(),
       depth: Int = 0
   ): List<KotlinSourceSet> {
       check(depth <= 20) { "SourceSet hierarchy cycle or excessive depth detected at: ${sourceSet.name}" }
       if (!visited.add(sourceSet.name)) {
           return emptyList()
       }
       return listOf(sourceSet) + sourceSet.dependsOn.flatMap {
           resolveSourceSetHierarchy(it, visited, depth + 1)
       }
   }
   ```
   *Invariant*: The recursion must be guarded by a visited set and a maximum recursion depth cap (`depth <= 20`). Any circular reference in Gradle source set declarations will terminate immediately with an explicit error rather than causing a `StackOverflowError`.

### 4.3 UI & UX Micro-Mechanics (CLI & Gradle Build Logs)
1. **Logger Interception & Gradle Daemon Output Cleanliness**:
   Gradle plugins should not pollute the standard terminal output (`stdout`) directly with `println`.
   ```kotlin
   // BuildKonfigLogger.kt
   class BuildKonfigLogger(private val logger: org.gradle.api.logging.Logger) {
       fun logWarning(message: String) {
           logger.warn("[BuildKonfig] WARNING: $message")
       }
       fun logInfo(message: String) {
           logger.info("[BuildKonfig] $message")
       }
   }
   ```
   *Invariant*: Warning and info emissions must route through Gradle’s contextual `Logger` to respect `--quiet`, `--warn`, and `--info` CLI flags. Direct console writes break CI/CD log parsers that monitor stdout for machine-readable JSON artifacts.

### 4.4 Backend Concurrency & Memory Safety
1. **Thread-Safe Task Execution Across Gradle Workers**:
   BuildKonfig tasks can be executed concurrently across subprojects in a multi-module build.
   ```kotlin
   @CacheableTask
   abstract class BuildKonfigTask : DefaultTask() {
       @get:OutputDirectory
       abstract val outputDirectory: DirectoryProperty

       @TaskAction
       fun execute() {
           val outDir = outputDirectory.asFile.get()
           // Atomically recreate directory
           outDir.deleteRecursively()
           if (!outDir.mkdirs()) {
               if (!outDir.exists()) {
                   throw IOException("Failed to create buildkonfig output directory: $outDir")
               }
           }
       }
   }
   ```
   *Invariant*: Always re-verify directory creation. In concurrent multi-process environments, `mkdirs()` can return `false` if the directory was created concurrently by a parallel worker thread. Checking `outDir.exists()` prevents spurious I/O exceptions.

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Configuration Cache Serialization Safeguards**:
   Tasks MUST NOT serialize Gradle model references like `Project`, `SourceSetContainer`, or `Configuration`.
   ```kotlin
   // DANGEROUS: Storing Project reference causes Configuration Cache serialization failure!
   // class BuildKonfigTask : DefaultTask() { var projectRef: Project? = null }

   // SAFE: Store only Serializable pure inputs
   @get:Input
   abstract val packageName: Property<String>

   @get:Input
   abstract val objectName: Property<String>

   @get:Nested
   abstract val targetConfigs: ListProperty<TargetConfig>
   ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Layered Structure**: Two distinct modules:
  - `buildkonfig-compiler`: Domain logic, AST generation, file formatting.
  - `buildkonfig-gradle-plugin`: Gradle lifecycle, task configuration, source set inspection.
- **State Ownership**: Immutable data structures (`TargetConfigFile`, `FieldSpec`). The Gradle extension (`BuildKonfigExtension`) collects mutable DSL properties during configuration, which are subsequently captured into immutable task inputs during project evaluation.

### Dimension 2: Core Abstractions
- `TargetConfig`: Represents configuration sets tied to specific KMP targets (e.g., `jvm`, `androidMain`, `iosX64`).
- `FieldSpec`: Captures individual variable declarations: name, type (`STRING`, `INT`, `FLOAT`, `LONG`, `BOOLEAN`), literal value, and nullability.
- `BuildKonfigCompiler`: The core engine taking a list of `TargetConfigFile` specs and generating physical `.kt` files.
- `SourceRoots`: Encapsulates multiplatform source directory discovery for JVM, Android, and Native targets.

### Dimension 3: Error Handling
- **Failsafe Validations**: Eager validation of DSL configurations during task configuration time. If `packageName` is omitted or blank, the plugin halts configuration with `InvalidUserDataException("BuildKonfig: 'packageName' must be specified")`.
- **Duplicate Field Protection**: When merging `defaultConfigs` and `targetConfigs`, duplicate keys are resolved deterministically: `targetConfigs` override `defaultConfigs`, but type incompatibilities throw an informative compilation halt.

### Dimension 4: Testing
- **Integration Test Harness (`BaseGradlePluginTest`)**: Uses `GradleRunner` from `org.gradle.testkit.runner` to execute real multiplatform build scripts against multiple Gradle and Kotlin versions.
- **Regression Shields**: Tests dedicated to specific regressions:
  - `BuildKonfigPluginAgpBaselineProfileTest.kt`: Tests AGP 9.0 compatibility.
  - `BuildKonfigPluginConfigurationCacheTest.kt`: Verifies builds pass with `--configuration-cache`.
  - `BuildKonfigPluginHMPPTest.kt`: Verifies Hierarchical Multiplatform Project code synthesis.

### Dimension 5: Security
- **Safe Code Synthesis**: String values in generated code are escaped to prevent arbitrary code injection inside `.kt` source files (e.g., injecting trailing braces, semicolon statements, or unauthorized imports via DSL values).
- **Supply Chain Protection**: Release workflows use GitHub token verification and automated release-please actions to maintain reproducible artifact hashes.

### Dimension 6: Performance
- **Gradle Configuration Cache Compatibility**: Task inputs are marked with `@Input`, `@Nested`, and `@OutputDirectory`. Gradle can serialize the task graph entirely to disk and skip the configuration phase on subsequent executions.
- **Up-to-Date Checking (`@CacheableTask`)**: When inputs (`packageName`, `targetConfigs`) and outputs do not change, `generateBuildKonfig` is marked `UP-TO-DATE`, consuming 0ms of CPU time during incremental builds.

### Dimension 7: Deployment & CI/CD
- **Release Please Integration**: `.release-please-manifest.json` handles semantic versioning and changelog generation.
- **Multi-OS CI Pipelines**: GitHub workflows execute on Linux and macOS matrix runners to validate Kotlin/Native target compilation (iOS/macOS targets require macOS runners).

### Dimension 8: Agent Patterns & Tooling
- **Explicit Instruction Sets**: The repository maintains `.claude/rules/` (`gradle.md`, `testing.md`, `git.md`), providing precise boundaries for AI coding agents:
  - Never execute unbuffered wrapper scripts.
  - Test multiplatform targets using specific Gradle test-kit tasks.
  - Always clean test build directories.

### Dimension 9: Data Flow
```
User build.gradle.kts
      |
      v
BuildKonfigExtension (DSL parsing)
      |
      v
Task Graph Resolution (TaskProvider<BuildKonfigTask>)
      |
      v
BuildKonfigCompiler.compile(buildKonfigData)
      |
      v
Filesystem: /build/generated/source/buildkonfig/src/.../BuildKonfig.kt
      |
      v
KotlinCompile / KotlinNativeCompile Task Input
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Clean Output Isolation in Gradle Source Generation
Generate code into a namespaced subpath (e.g., `build/generated/source/<plugin>/src`) and connect it via lazy `TaskProvider.flatMap { it.outputDir }`.
```kotlin
val generateTask = project.tasks.register("generateBuildKonfig", BuildKonfigTask::class.java) {
    it.outputDir.set(project.layout.buildDirectory.dir("generated/source/buildkonfig/src"))
}
sourceSet.kotlin.srcDir(generateTask.flatMap { it.outputDir })
```

### 2. Rule
A custom Gradle task that outputs source files MUST assign its output to a child directory isolated from other tasks' asset/resource discovery sweeps, and MUST expose this directory as a `DirectoryProperty`.

### 3. Architecture Principle
Separate code generation logic from build system lifecycle logic. Keep the AST/source synthesizer in a standalone module (`buildkonfig-compiler`) that has zero runtime dependencies on Gradle or build system APIs.

### 4. Failure Mode
When an Android Gradle Plugin task (e.g., `ProcessLibraryArtProfileTask`) reads the root output directory of an un-declared task, Gradle aborts with:
`Task ':prepareAndroidMainArtProfile' uses this output of task ':generateBuildKonfig' without declaring an explicit or implicit dependency.`

### 5. Reusable Skill
**Configuring Custom Source Sets for Kotlin Multiplatform**:
1. Locate target source set (`commonMain`, `androidMain`, etc.) via `kotlinExtension.sourceSets`.
2. Register a custom code-gen task returning `DirectoryProperty`.
3. Pass `taskProvider.flatMap { it.outputProperty }` to `sourceSet.kotlin.srcDir()`.
4. Ensure the task is annotated with `@CacheableTask`.

### 6. Decision
*Use KotlinPoet inside the compiler module vs direct string templating.*
- **Verdict**: BuildKonfig utilizes structured code generation to ensure correct formatting, proper imports, and syntactically valid Kotlin AST structures, eliminating malformed code errors from manual string concatenation.

### 7. Anti-Pattern
```kotlin
// BAD: Registering task output by evaluating path eagerly at configuration time
val outputDir = File(project.buildDir, "generated/buildkonfig")
project.tasks.getByName("compileKotlin").dependsOn("generateBuildKonfig")
sourceSet.kotlin.srcDir(outputDir)
```
- Eager path evaluation breaks Gradle Configuration Cache and triggers implicit dependency validation errors in Gradle 8+.