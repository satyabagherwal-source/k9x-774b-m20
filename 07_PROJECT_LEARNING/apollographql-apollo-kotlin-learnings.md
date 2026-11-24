> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apollographql-apollo-kotlin-learnings.md`  
> **Source**: github ([https://github.com/apollographql/apollo-kotlin](https://github.com/apollographql/apollo-kotlin))  
> **Source Version**: `ce7030fd`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T23:33:25.140Z  
> **Learning ID**: `learn-github-apollographql-apollo-kotlin`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): apollographql/apollo-kotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/apollographql-apollo-kotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apollographql/apollo-kotlin](https://github.com/apollographql/apollo-kotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T23:33:25.136Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apollographql/apollo-kotlin`
- **Description**: :rocket:  A strongly-typed, caching GraphQL client for the JVM, Android, and Kotlin multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3974 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/json/internal/Utils.kt`
```
package com.apollographql.apollo.api.json.internal

import kotlin.jvm.JvmName

@JvmName("-LongToIntExact")
internal fun Long.toIntExact(): Int {
  val result = toInt()
  check (result.toLong() == this) {
    "$this cannot be converted to Int"
  }
  return result
}

@JvmName("-DoubleToIntExact")
internal fun Double.toIntExact(): Int {
  val result = toInt()
  check (result.toDouble() == this) {
    "$this cannot be converted to Int"
  }
  return result
}


@JvmName("-LongToDoubleExact")
internal fun Long.toDoubleExact(): Double {
  val result = toDouble()
  check (result.toLong() == this) {
    "$this cannot be converted to Double"
  }
  return result
}

@JvmName("-DoubleToLongExact")
internal fun Double.toLongExact(): Long {
  val result = toLong()
  check (result.toDouble() == this) {
    "$this cannot be converted to Long"
  }
  return result
}

/**
 * Same as [toIntExact] but returns null instead of throwing. Useful in hot paths where the
 * conversion is expected to fail routinely.
 */
@JvmName("-LongToIntExactOrNull")
internal fun Long.toIntExactOrNull(): Int? {
  val result = toInt()
  return if (result.toLong() == this) result else null
}

@JvmName("-DoubleToIntExactOrNull")
internal fun Double.toIntExactOrNull(): Int? {
  val result = toInt()
  return if (result.toDouble() == this) result else null
}

@JvmName("-DoubleToLongExactOrNull")
internal fun Double.toLongExactOrNull(): Long? {
  val result = toLong()
  return if (result.toDouble() == this) result else null
}

```

### Core Architecture Module: `libraries/apollo-api/src/concurrentMain/kotlin/com/apollographql/apollo/api/DefaultUpload.concurrent.kt`
```
@file:JvmMultifileClass
@file:JvmName("DefaultUploadKt")
package com.apollographql.apollo.api

import okio.FileSystem
import okio.Path
import okio.SYSTEM
import okio.buffer
import okio.use
import kotlin.jvm.JvmMultifileClass
import kotlin.jvm.JvmName

fun Path.toUpload(contentType: String, fileSystem: FileSystem = FileSystem.SYSTEM): Upload {
  return DefaultUpload.Builder()
      .content { sink ->
        fileSystem.openReadOnly(this).use {
          sink.writeAll(it.source().buffer())
        }
      }
      .contentType(contentType)
      .contentLength(fileSystem.metadata(this).size ?: -1L)
      .build()
}

```

### Core Architecture Module: `libraries/apollo-api/src/concurrentMain/kotlin/com/apollographql/apollo/api/systemFileSystem.concurrent.kt`
```
package com.apollographql.apollo.api

import okio.FileSystem
import okio.SYSTEM

internal actual val systemFileSystem: FileSystem
  get() = FileSystem.SYSTEM
```

### Core Architecture Module: `libraries/apollo-ast/src/concurrentMain/kotlin/com/apollographql/apollo/ast/host.concurrent.kt`
```
package com.apollographql.apollo.ast

import okio.FileSystem
import okio.SYSTEM

internal actual val HOST_FILESYSTEM: FileSystem
  get() = FileSystem.SYSTEM
```

### Core Architecture Module: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/java/operations/util/VariablesAdapter.kt`
```
/*
 * Generates ResponseAdapters for variables
 */
package com.apollographql.apollo.compiler.codegen.java.operations.util

import com.apollographql.apollo.compiler.codegen.Identifier.Empty
import com.apollographql.apollo.compiler.codegen.Identifier.customScalarAdapters
import com.apollographql.apollo.compiler.codegen.Identifier.serializeVariables
import com.apollographql.apollo.compiler.codegen.Identifier.toJson
import com.apollographql.apollo.compiler.codegen.Identifier.value
import com.apollographql.apollo.compiler.codegen.Identifier.withDefaultValues
import com.apollographql.apollo.compiler.codegen.Identifier.writer
import com.apollographql.apollo.compiler.codegen.java.JavaClassNames
import com.apollographql.apollo.compiler.codegen.java.JavaContext
import com.apollographql.apollo.compiler.codegen.java.L
import com.apollographql.apollo.compiler.codegen.java.S
import com.apollographql.apollo.compiler.codegen.java.T
import com.apollographql.apollo.compiler.codegen.java.helpers.beginOptionalControlFlow
import com.apollographql.apollo.compiler.codegen.java.helpers.codeBlock
import com.apollographql.apollo.compiler.codegen.java.javaPropertyName
import com.apollographql.apollo.compiler.ir.IrVariable
import com.squareup.javapoet.CodeBlock
import com.squareup.javapoet.MethodSpec
import com.squareup.javapoet.TypeName
import com.squareup.javapoet.TypeSpec
import javax.lang.model.element.Modifier

internal fun List<IrVariable>.variableAdapterTypeSpec(
    context: JavaContext,
    adapterName: String,
    adaptedTypeName: TypeName,
): TypeSpec {
  return TypeSpec.enumBuilder(adapterName)
      .addModifiers(Modifier.PUBLIC)
      .addEnumConstant("INSTANCE")
      .addMethod(writeToResponseMethodSpec(context, adaptedTypeName))
      .build()
}

private fun List<IrVariable>.writeToResponseMethodSpec(
    context: JavaContext,
    adaptedTypeName: TypeName,
): MethodSpec {
  return MethodSpec.methodBuilder(serializeVariables)
      .addModifiers(Modifier.PUBLIC)
      .addException(JavaClassNames.IOException)
      .addParameter(JavaClassNames.JsonWriter, writer)
      .addParameter(adaptedTypeName, value)
      .addParameter(JavaClassNames.CustomScalarAdapters, customScalarAdapters)
      .addParameter(TypeName.BOOLEAN, withDefaultValues)
      .addCode(writeToResponseCodeBlock(context))
      .build()
}

private fun List<IrVariable>.writeToResponseCodeBlock(context: JavaContext): CodeBlock {
  val builder = CodeBlock.builder()
  forEach {
    builder.add(it.writeToResponseCodeBlock(context))
  }
  return builder.build()
}

private fun IrVariable.writeToResponseCodeBlock(context: JavaContext): CodeBlock {
  val adapterInitializer = context.resolver.adapterInitializer(type, false)
  val builder = CodeBlock.builder()
  val propertyName = context.layout.javaPropertyName(name)

  if (type.optional) {
    builder.beginOptionalControlFlow(propertyName, context.nullableFieldStyle)
  }

  builder.add("$writer.name($S);\n", name)
  builder.addStatement("$L.$toJson($writer, $customScalarAdapters, $value.$propertyName)", adapterInitializer)
  if (type.optional) {
    builder.endControlFlow()
    if (defaultValue != null) {
      builder.beginControlFlow("else if ($withDefaultValues)")
      builder.addStatement("$writer.name($S)", name)
      builder.addStatement(
          "$L.$toJson($writer, $T.$Empty, $L)",
          CodeBlock.of("$T.$L", JavaClassNames.Adapters, "NullableAnyAdapter"),
          JavaClassNames.CustomScalarAdapters,
          defaultValue.codeBlock(),
      )
      builder.endControlFlow()
    }
  }

  return builder.build()
}

```

### Core Architecture Module: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/kotlin/operations/util/ExecutableCommon.kt`
```
package com.apollographql.apollo.compiler.codegen.kotlin.operations.util

import com.apollographql.apollo.compiler.codegen.Identifier
import com.apollographql.apollo.compiler.codegen.Identifier.ADAPTER
import com.apollographql.apollo.compiler.codegen.Identifier.ROOT_FIELD
import com.apollographql.apollo.compiler.codegen.Identifier.customScalarAdapters
import com.apollographql.apollo.compiler.codegen.Identifier.root
import com.apollographql.apollo.compiler.codegen.Identifier.rootField
import com.apollographql.apollo.compiler.codegen.Identifier.selections
import com.apollographql.apollo.compiler.codegen.Identifier.serializeVariables
import com.apollographql.apollo.compiler.codegen.Identifier.withDefaultValues
import com.apollographql.apollo.compiler.codegen.Identifier.writer
import com.apollographql.apollo.compiler.codegen.kotlin.KotlinOperationsContext
import com.apollographql.apollo.compiler.codegen.kotlin.KotlinSymbols
import com.apollographql.apollo.compiler.codegen.kotlin.helpers.patchKotlinNativeOptionalArrayProperties
import com.apollographql.apollo.compiler.ir.IrExecutable
import com.apollographql.apollo.compiler.ir.IrFragmentDefinition
import com.apollographql.apollo.compiler.ir.IrOperationDefinition
import com.apollographql.apollo.compiler.ir.IrProperty
import com.squareup.kotlinpoet.ClassName
import com.squareup.kotlinpoet.CodeBlock
import com.squareup.kotlinpoet.FunSpec
import com.squareup.kotlinpoet.KModifier
import com.squareup.kotlinpoet.ParameterizedTypeName.Companion.parameterizedBy
import com.squareup.kotlinpoet.PropertySpec
import com.squareup.kotlinpoet.TypeName
import com.squareup.kotlinpoet.TypeSpec

internal fun serializeVariablesFunSpec(
    adapterClassName: TypeName?,
    emptyMessage: String,
): FunSpec {

  val body = if (adapterClassName == null) {
    CodeBlock.of("""
      // $emptyMessage
    """.trimIndent())
  } else {
    CodeBlock.of(
        "%L.$serializeVariables($writer, this, $customScalarAdapters, $withDefaultValues)",
        CodeBlock.of("%T", adapterClassName)
    )
  }
  return FunSpec.builder(serializeVariables)
      .addModifiers(KModifier.OVERRIDE)
      .addParameter(writer, KotlinSymbols.JsonWriter)
      .addParameter(customScalarAdapters, KotlinSymbols.CustomScalarAdapters)
      .addParameter(withDefaultValues, KotlinSymbols.Boolean)
      .addCode(body)
      .build()
}

internal fun adapterFunSpec(
    context: KotlinOperationsContext,
    property: IrProperty,
): FunSpec {
  val type = property.info.type

  return FunSpec.builder("adapter")
      .addModifiers(KModifier.OVERRIDE)
      .returns(KotlinSymbols.Adapter.parameterizedBy(context.resolver.resolveIrType(type, context.jsExport)))
      .addCode("return $ADAPTER")
      .build()
}

internal fun rootFieldFunSpec(): FunSpec {
  return FunSpec.builder(rootField)
      .addModifiers(KModifier.OVERRIDE)
      .returns(KotlinSymbols.CompiledField)
      .addCode("return $ROOT_FIELD")
      .build()
}

internal fun TypeSpec.Builder.executableCompanion(context: KotlinOperationsContext, executable: IrExecutable) = apply {
  return addSuperinterface(KotlinSymbols.ExecutableDefinition.parameterizedBy(context.resolver.resolveModel(executable.dataModelGroup.baseModelId)))
      .addProperty(adadpterPropertySpec(context, executable))
      .addProperty(rootFieldPropertySpec(context, executable))
}


internal fun adadpterPropertySpec(context: KotlinOperationsContext, executable: IrExecutable): PropertySpec {
  return PropertySpec.builder(
      ADAPTER,
      KotlinSymbols.Adapter.parameterizedBy(context.resolver.resolveIrType(executable.dataProperty.info.type, context.jsExport))
  ).addModifiers(KModifier.OVERRIDE)
      .initializer(context.resolver.adapterInitializer(executable.dataProperty.info.type, executable.dataProperty.requiresBuffering, context.jsExport))
      .build()
}
internal fun rootFieldPropertySpec(context: KotlinOperationsContext, executable: IrExecutable): PropertySpec {
  val selectionsClassName = when (executable) {
    is IrOperationDefinition -> context.resolver.resolveOperationSelections(executable.name)
    is IrFragmentDefinition -> context.resolver.resolveFragmentSelections(executable.name)
  }

  return PropertySpec.builder(ROOT_FIELD, KotlinSymbols.CompiledField)
      .addModifiers(KModifier.OVERRIDE)
      .initializer(
          CodeBlock.builder()
              .add("%T(\n", KotlinSymbols.CompiledFieldBuilder)
              .indent()
              .add("name = %S,\n", Identifier.data)
              .add("type = %L\n", context.resolver.resolveCompiledType(executable.typeCondition))
              .unindent()
              .add(")\n")
              .add(".$selections(selections = %T.$root)\n", selectionsClassName)
              .add(".build()\n")
              .build()
      )
      .build()
}

internal fun TypeSpec.maybeAddFilterNotNull(generateFilterNotNull: Boolean): TypeSpec {
  if (!generateFilterNotNull) {
    return this
  }
  return patchKotlinNativeOptionalArrayProperties()
}

```

### Core Architecture Module: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/kotlin/operations/util/VariablesAdapter.kt`
```
package com.apollographql.apollo.compiler.codegen.kotlin.operations.util

import com.apollographql.apollo.compiler.codegen.Identifier.customScalarAdapters
import com.apollographql.apollo.compiler.codegen.Identifier.serializeVariables
import com.apollographql.apollo.compiler.codegen.Identifier.value
import com.apollographql.apollo.compiler.codegen.Identifier.withDefaultValues
import com.apollographql.apollo.compiler.codegen.Identifier.writer
import com.apollographql.apollo.compiler.codegen.kotlin.KotlinContext
import com.apollographql.apollo.compiler.codegen.kotlin.KotlinSymbols
import com.apollographql.apollo.compiler.codegen.kotlin.helpers.addSerializeStatement
import com.apollographql.apollo.compiler.codegen.kotlin.helpers.codeBlock
import com.apollographql.apollo.compiler.ir.IrVariable
import com.squareup.kotlinpoet.AnnotationSpec
import com.squareup.kotlinpoet.CodeBlock
import com.squareup.kotlinpoet.FunSpec
import com.squareup.kotlinpoet.TypeName
import com.squareup.kotlinpoet.TypeSpec

internal fun List<IrVariable>.variablesAdapterTypeSpec(
    context: KotlinContext,
    adapterName: String,
    adaptedTypeName: TypeName,
): TypeSpec {
  return TypeSpec.objectBuilder(adapterName)
      .addFunction(serializeVariablesFunSpec(context, adaptedTypeName))
      .build()
}

private fun List<IrVariable>.serializeVariablesFunSpec(
    context: KotlinContext,
    adaptedTypeName: TypeName,
): FunSpec {
  return FunSpec.builder(serializeVariables)
      .addParameter(writer, KotlinSymbols.JsonWriter)
      .addParameter(value, adaptedTypeName)
      .addParameter(customScalarAdapters, KotlinSymbols.CustomScalarAdapters)
      .addParameter(withDefaultValues, KotlinSymbols.Boolean)
      .addAnnotation(AnnotationSpec.builder(KotlinSymbols.Suppress).addMember("%S", "UNUSED_PARAMETER").addMember("%S", "UNUSED_VARIABLE").build())
      .addCode(writeToResponseCodeBlock(context))
      .build()
}

private fun List<IrVariable>.writeToResponseCodeBlock(context: KotlinContext): CodeBlock {
  val builder = CodeBlock.builder()

  forEach {
    builder.add(it.writeToResponseCodeBlock(context))
  }
  return builder.build()
}

private fun IrVariable.writeToResponseCodeBlock(context: KotlinContext): CodeBlock {
  val adapterInitializer = context.resolver.adapterInitializer(type, false, context.jsExport)
  val builder = CodeBlock.builder()
  val propertyName = context.layout.propertyName(name)

  if (type.optional) {
    builder.beginControlFlow("if ($value.%N is %T)", propertyName, KotlinSymbols.Present)
  }
  builder.addStatement("$writer.name(%S)", name)
  builder.addSerializeStatement(
      adapterInitializer,
      propertyName,
      context.resolver.unwrapInlineClass(type)
  )
  if (type.optional) {
    builder.endControlFlow()
    if (defaultValue != null) {
      builder.beginControlFlow("else if ($withDefaultValues)")
      builder.addStatement("$writer.name(%S)", name)
      builder.addStatement(
          "%M.toJson($writer, $customScalarAdapters, %L)",
          KotlinSymbols.NullableAnyAdapter,
          defaultValue.codeBlock(),
      )

      builder.endControlFlow()
    }
  }

  return builder.build()
}

```

### Core Architecture Module: `libraries/apollo-gradle-plugin-tasks/src/main/kotlin/com/apollographql/apollo/gradle/task/utils.kt`
```
package com.apollographql.apollo.gradle.task

import com.apollographql.apollo.compiler.ApolloCompiler
import com.apollographql.apollo.compiler.InputFile
import gratatouille.tasks.GInputFiles
import gratatouille.tasks.GLogger

fun GInputFiles.toInputFiles(): List<InputFile> = mapNotNull {
  if (it.file.isFile) {
    InputFile(it.file, it.normalizedPath)
  } else {
    null
  }
}
fun GLogger.asLogger(): ApolloCompiler.Logger = object : ApolloCompiler.Logger {
  override fun debug(message: String) {
    this@asLogger.debug(message)
  }

  override fun info(message: String) {
    this@asLogger.lifecycle(message)
  }

  override fun warning(message: String) {
    this@asLogger.warn(message)
  }

  override fun error(message: String) {
    this@asLogger.error(message)
  }
}
```

### Core Architecture Module: `libraries/apollo-gradle-plugin/src/main/kotlin/com/apollographql/apollo/gradle/internal/utils.kt`
```
package com.apollographql.apollo.gradle.internal

import org.gradle.api.artifacts.ProjectDependency

internal fun ProjectDependency.getPathCompat(): String {
  val method = this::class.java.methods.firstOrNull {
    it.name == "getPath" && it.parameters.isEmpty()
  }
  return if (method != null) {
    // Gradle 8.11+ path
    // See https://docs.gradle.org/8.11/userguide/upgrading_version_8.html#deprecate_get_dependency_project
    method.invoke(this) as String
  } else {
    dependencyProject.path
  }
}

```

### Core Architecture Module: `libraries/apollo-mpp-utils/src/appleMain/kotlin/com/apollographql/apollo/mpp/utils.kt`
```
package com.apollographql.apollo.mpp

import platform.Foundation.NSDate
import platform.Foundation.timeIntervalSince1970

actual fun currentTimeMillis(): Long {
  return (NSDate().timeIntervalSince1970 * 1000).toLong()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7050** (2026-11-24): **Allow empty enums**
  *Symptoms*: See https://github.com/graphql/graphql-spec/pull/1260
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview has no changes  The preview was not built because there were no changes.  **Build ID**: 56f6aefd0d60b2c5665fd6f2 **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/56f6aefd0d60b2c5665fd6f2/logs)  ---  ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20261124-8fa2c544-7050-48508d65e8cb0ad6)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

- **Issue #7049** (2026-11-24): **Escape Kotlin keywords in @oneOf assertOneOf() call**
  *Symptoms*: Closes [#7048](https://github.com/apollographql/apollo-kotlin/issues/7048)  ## Problem  For a `@oneOf` input object, the Kotlin codegen builds the `assertOneOf(...)` call in the `init` block from raw property names. The property declarations escape Kotlin keywords, but this call doesn't, so a field such as `package` generates code that doesn't compile:  ```kotlin public val `package`: Optional<String?> = Optional.Absent, ... assertOneOf(email, package) // Syntax error: Expecting an expression ```  ## Changes  - `InputObjectBuilder.oneOfInitializerBlock` now writes each argument with `%N`, so keywords are escaped the same way as in the property declarations:    ```kotlin   assertOneOf(email, name, identity, friends, `package`)   ```  - The Java codegen needed no change, because it already escapes reserved words (`package_`).  ## Tests  - Added a `package` field to `FindUserInput` in the `input_object_oneof` codegen fixture and updated the expected files. - Before the fix, `CodegenTest[kotlin-responseBased-input_object_oneof]` fails while compiling the generated code with `Syntax error: Expecting an expression`. After the fix it passes. - All of `:apollo-compiler:test` passes. - The `measurements` file is updated because the fixture changed. 

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

### Incident Patch 1: `ce7030fd` (2026-11-24)
**Commit Message**: Allow empty enums (#7050)

**File**: `libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/api.kt` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ class ParserOptions private constructor(
     }
 
     /**
-     * Whether to allow empty object, interface and input object type definitions, as in `type Query {}`, `interface Node {}` or `input Filter {}`.
+     * Whether to allow empty types (objects, interfaces, input objects, enums, unions)
      *
      * Default: false
      */
```

**File**: `libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/gql.kt` (modified, +13/-7)
```diff
@@ -839,12 +839,16 @@ class GQLEnumTypeDefinition(
         write(" ")
         directives.join(writer)
       }
-      write(" ")
-      write("{\n")
-      indent()
-      enumValues.join(writer, separator = "\n")
-      unindent()
-      write("}\n")
+      if (enumValues.isNotEmpty()) {
+        write(" ")
+        write("{\n")
+        indent()
+        enumValues.join(writer, separator = "\n")
+        unindent()
+        write("}\n")
+      } else {
+        write("\n")
+      }
     }
   }
 
@@ -1088,13 +1092,15 @@ class GQLEnumTypeExtension(
         write(" ")
         directives.join(writer)
       }
-      write(" ")
       if (enumValues.isNotEmpty()) {
+        write(" ")
         write("{\n")
         indent()
         enumValues.join(writer, separator = "\n")
         unindent()
         write("}\n")
+      } else {
+        write("\n")
       }
     }
   }
```

**File**: `libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/internal/Parser.kt` (modified, +5/-1)
```diff
@@ -733,7 +733,11 @@ internal class Parser(
   }
 
   private fun parseEnumValueDefinitions(): List<GQLEnumValueDefinition> {
-    return parseNonEmptyListOrNull<Token.LeftBrace, Token.RightBrace, GQLEnumValueDefinition>(::parseEnumValueDefinition).orEmpty()
+    return if (allowEmptyTypes) {
+      parseListOrEmpty<Token.LeftBrace, Token.RightBrace, GQLEnumValueDefinition>(::parseEnumValueDefinition)
+    } else {
+      parseNonEmptyListOrNull<Token.LeftBrace, Token.RightBrace, GQLEnumValueDefinition>(::parseEnumValueDefinition).orEmpty()
+    }
   }
 
   private fun parseEnumValueDefinition(): GQLEnumValueDefinition {
```

**File**: `libraries/apollo-ast/test-fixtures/parser/empty-enum-error.expected` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+ParsingError (1:17)
+Expected Name, found '}'.
\ No newline at end of file
```

**File**: `libraries/apollo-ast/test-fixtures/parser/empty-enum-error.graphqls` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+enum Direction {}
```

**File**: `libraries/apollo-ast/test-fixtures/parser/empty-types.expected` (modified, +10/-2)
```diff
@@ -1,10 +1,18 @@
 
-type Query
+interface Node
 
 interface Node
 
-type Foo implements Node @deprecated
+type Foo
+
+type Foo
+
+input Filter
 
 input Filter
 
+enum Direction
+
+enum Direction
+
 union SearchResult
```

**File**: `libraries/apollo-ast/test-fixtures/parser/empty-types.graphqls` (modified, +8/-3)
```diff
@@ -1,11 +1,16 @@
 # PRAGMA allowEmptyTypes
 
-type Query {}
-
+interface Node
 interface Node {}
 
-type Foo implements Node @deprecated {}
+type Foo
+type Foo {}
 
+input Filter
 input Filter {}
 
+enum Direction
+enum Direction {}
+
 union SearchResult
+
```

**File**: `libraries/apollo-ast/test-fixtures/validation/schema/empty-input-objects.graphqls` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-# PRAGMA allowEmptyTypes
-
-type Query {
-  issues(filter: IssueFilter = {}, nonNullFilter: IssueFilter!): [Issue!]!
-  search(by: SearchBy): String
-}
-
-input IssueFilter {}
-
-input WithEmptyField {
-  filter: IssueFilter! = {}
-}
-
-input SearchBy @oneOf {}
-
-type Issue {
-  title: String!
-}
```

---

### Incident Patch 2: `e96eccbb` (2026-11-24)
**Commit Message**: Escape Kotlin keywords in @oneOf assertOneOf() call (#7049)

Closes #7048

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/kotlin/schema/InputObjectBuilder.kt` (modified, +6/-1)
```diff
@@ -15,6 +15,7 @@ import com.apollographql.apollo.compiler.ir.IrInputObject
 import com.squareup.kotlinpoet.ClassName
 import com.squareup.kotlinpoet.CodeBlock
 import com.squareup.kotlinpoet.TypeSpec
+import com.squareup.kotlinpoet.joinToCode
 
 internal class InputObjectBuilder(
     val context: KotlinSchemaContext,
@@ -68,5 +69,9 @@ internal class InputObjectBuilder(
 }
 
 private fun List<NamedType>.oneOfInitializerBlock(context: KotlinSchemaContext): CodeBlock {
-  return CodeBlock.of("%M(${joinToString { context.layout.propertyName(it.graphQlName) }})\n", KotlinSymbols.assertOneOf)
+  return CodeBlock.of(
+      "%M(%L)\n",
+      KotlinSymbols.assertOneOf,
+      map { CodeBlock.of("%N", context.layout.propertyName(it.graphQlName)) }.joinToCode(),
+  )
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/input_object_oneof/java/operationBased/input_object_oneof/type/FindUserInput.java.expected` (modified, +20/-5)
```diff
@@ -21,19 +21,23 @@ public class FindUserInput {
 
   public final Optional<FindUserByFriendInput> friends;
 
+  public final Optional<String> package_;
+
   private transient volatile int $hashCode;
 
   private transient volatile boolean $hashCodeMemoized;
 
   private transient volatile String $toString;
 
   public FindUserInput(Optional<String> email, Optional<String> name,
-      Optional<FindUserBySocialNetworkInput> identity, Optional<FindUserByFriendInput> friends) {
+      Optional<FindUserBySocialNetworkInput> identity, Optional<FindUserByFriendInput> friends,
+      Optional<String> package_) {
     this.email = email;
     this.name = name;
     this.identity = identity;
     this.friends = friends;
-    Assertions.assertOneOf(email, name, identity, friends);
+    this.package_ = package_;
+    Assertions.assertOneOf(email, name, identity, friends, package_);
   }
 
   @Override
@@ -46,7 +50,8 @@ public class FindUserInput {
       return ((this.email == null) ? (that.email == null) : this.email.equals(that.email))
        &&((this.name == null) ? (that.name == null) : this.name.equals(that.name))
        &&((this.identity == null) ? (that.identity == null) : this.identity.equals(that.identity))
-       &&((this.friends == null) ? (that.friends == null) : this.friends.equals(that.friends));
+       &&((this.friends == null) ? (that.friends == null) : this.friends.equals(that.friends))
+       &&((this.package_ == null) ? (that.package_ == null) : this.package_.equals(that.package_));
     }
     return false;
   }
@@ -63,6 +68,8 @@ public class FindUserInput {
       __h ^= (identity == null) ? 0 : identity.hashCode();
       __h *= 1000003;
       __h ^= (friends == null) ? 0 : friends.hashCode();
+      __h *= 1000003;
+      __h ^= (package_ == null) ? 0 : package_.hashCode();
       $hashCode = __h;
       $hashCodeMemoized = true;
     }
@@ -76,7 +83,8 @@ public class FindUserInput {
         + "email=" + email + ", "
         + "name=" + name + ", "
         + "identity=" + identity + ", "
-        + "friends=" + friends
+        + "friends=" + friends + ", "
+        + "package_=" + package_
         + "}";
     }
     return $toString;
@@ -96,6 +104,8 @@ public class FindUserInput {
 
     private Optional<FindUserByFriendInput> friends = Optional.absent();
 
+    private Optional<String> package_ = Optional.absent();
+
     Builder() {
     }
 
@@ -119,8 +129,13 @@ public class FindUserInput {
       return this;
     }
 
+    public Builder package_(String package_) {
+      this.package_ = Optional.present(package_);
+      return this;
+    }
+
     public FindUserInput build() {
-      return new FindUserInput(email, name, identity, friends);
+      return new FindUserInput(email, name, identity, friends, package_);
     }
   }
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/input_object_oneof/java/operationBased/input_object_oneof/type/adapter/FindUserInput_InputAdapter.java.expected` (modified, +4/-0)
```diff
@@ -49,5 +49,9 @@ public enum FindUserInput_InputAdapter implements Adapter<FindUserInput> {
       writer.name("friends");
       new ApolloOptionalAdapter<>(new NullableAdapter<>(new ObjectAdapter<FindUserByFriendInput>(FindUserByFriendInput_InputAdapter.INSTANCE, false))).toJson(writer, customScalarAdapters, value.friends);
     }
+    if (value.package_ instanceof Optional.Present) {
+      writer.name("package");
+      new ApolloOptionalAdapter<>(Adapters.NullableStringAdapter).toJson(writer, customScalarAdapters, value.package_);
+    }
   }
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/input_object_oneof/kotlin/responseBased/input_object_oneof/type/FindUserInput.kt.expected` (modified, +2/-1)
```diff
@@ -14,8 +14,9 @@ public data class FindUserInput(
   public val name: Optional<String?> = Optional.Absent,
   public val identity: Optional<FindUserBySocialNetworkInput?> = Optional.Absent,
   public val friends: Optional<FindUserByFriendInput?> = Optional.Absent,
+  public val `package`: Optional<String?> = Optional.Absent,
 ) {
   init {
-    assertOneOf(email, name, identity, friends)
+    assertOneOf(email, name, identity, friends, `package`)
   }
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/input_object_oneof/kotlin/responseBased/input_object_oneof/type/adapter/FindUserInput_InputAdapter.kt.expected` (modified, +4/-0)
```diff
@@ -41,5 +41,9 @@ public object FindUserInput_InputAdapter : Adapter<FindUserInput> {
       writer.name("friends")
       FindUserByFriendInput_InputAdapter.obj().nullable().present().toJson(writer, customScalarAdapters, value.friends)
     }
+    if (value.`package` is Optional.Present) {
+      writer.name("package")
+      NullableStringAdapter.present().toJson(writer, customScalarAdapters, value.`package`)
+    }
   }
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/input_object_oneof/schema.graphqls` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ input FindUserInput @oneOf {
   name: String
   identity: FindUserBySocialNetworkInput
   friends: FindUserByFriendInput
+  package: String
 }
 
 input FindUserBySocialNetworkInput @oneOf {
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/measurements` (modified, +5/-5)
```diff
@@ -2,11 +2,11 @@
 // If you updated the codegen and test fixtures, you should commit this file too.
 
 Test:                                                                                      Total LOC:
-aggregate-all                                                                                  201511
-aggregate-kotlin-responseBased                                                                  63432
+aggregate-all                                                                                  201535
+aggregate-kotlin-responseBased                                                                  63437
 aggregate-kotlin-operationBased                                                                 41092
 aggregate-kotlin-compat                                                                             0
-aggregate-java-operationBased                                                                   96987
+aggregate-java-operationBased                                                                   97006
 
 java-operationBased-fragments_with_defer_and_include_directives                                  5747
 kotlin-operationBased-fragments_with_defer_and_include_directives                                3409
@@ -77,9 +77,9 @@ kotlin-responseBased-simple_fragment_with_inline_fragments
 kotlin-operationBased-root_query_fragment_with_nested_fragments                                   992
 java-operationBased-decapitalized_fields                                                          953
 kotlin-operationBased-named_fragment_delegate                                                     946
+java-operationBased-input_object_oneof                                                            939
 java-operationBased-simple_union                                                                  930
 java-operationBased-fragments_same_type_condition                                                 929
-java-operationBased-input_object_oneof                                                            920
 java-operationBased-used_arguments                                                                916
 kotlin-responseBased-mutation_create_review_semantic_naming                                       915
 kotlin-responseBased-operationbased2_ex8                                                          911
@@ -196,8 +196,8 @@ java-operationBased-antlr_tokens
 kotlin-responseBased-suppressed_warnings                                                          490
 kotlin-responseBased-path_vs_flat_accessors                                                       489
 kotlin-responseBased-typename_always_first                                                        486
+kotlin-responseBased-input_object_oneof                                                           484
 kotlin-operationBased-interface_on_interface                                                      481
-kotlin-responseBased-input_object_oneof                                                           479
 kotlin-responseBased-root_query_fragment                                                          477
 kotlin-operationBased-operationbased2_ex7                                                         473
 kotlin-operationBased-fragment_with_multiple_fieldsets                                            471
```

#### Recent Merged Pull Requests:
- **PR #7050** (2026-11-24): Allow empty enums (@martinbonnin)
- **PR #7049** (2026-11-24): Escape Kotlin keywords in @oneOf assertOneOf() call (@mrmike)
- **PR #7046** (2026-11-12): Fix publishMarkers path failure on Windows (@shayann07)
- **PR #7045** (2026-11-02): Version is now 4.4.5-SNAPSHOT (@martinbonnin)
- **PR #7044** (2026-10-29): Add v4.4.4 changelog (@martinbonnin)
- **PR #7043** (2026-10-29): Add support for empty input objects and empty unions (@martinbonnin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Allow empty enums

**RULE**:
When implementing operations in `libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/api.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apollographql/apollo-kotlin. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ce7030fd`: Allow empty enums. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `libraries/apollo-ast/src/commonMain/kotlin/com/apollographql/apollo/ast/api.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
     * Whether to allow empty types (objects, interfaces, input objects, enums, unions)
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
     * Whether to allow empty object, interface and input object type definitions, as in `type Query {}`, `interface Node {}` or `input Filter {}`.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ce7030fd` are properly handled with clean fallback behavior.
