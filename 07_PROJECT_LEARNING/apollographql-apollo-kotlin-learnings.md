# Forensic Learning Record (Deep Inspection): apollographql/apollo-kotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/apollographql-apollo-kotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apollographql/apollo-kotlin](https://github.com/apollographql/apollo-kotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:30.639Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apollographql/apollo-kotlin`
- **Description**: :rocket:  A strongly-typed, caching GraphQL client for the JVM, Android, and Kotlin multiplatform.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3977 stars

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

### Core Architecture Module: `libraries/apollo-mpp-utils/src/commonMain/kotlin/com/apollographql/apollo/mpp/utils.kt`
```
@file:JvmName("-utils")

package com.apollographql.apollo.mpp

import kotlin.jvm.JvmName

expect fun currentTimeMillis(): Long


```

### Core Architecture Module: `libraries/apollo-mpp-utils/src/jsMain/kotlin/com/apollographql/apollo/mpp/utils.kt`
```
package com.apollographql.apollo.mpp

import com.apollographql.apollo.annotations.ApolloInternal
import kotlin.js.Date

actual fun currentTimeMillis(): Long {
  return Date().getTime().toLong()
}


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7035** (2026-09-29): **Add support for empty objects and empty interfaces**
  *Symptoms*: See https://github.com/graphql/graphql-spec/pull/1228, https://github.com/graphql/graphql-spec/pull/1229  This is gated by a parser flag. Technically, schema validation should be gated as well but for the sake of simplicity, I'm just relaxing the check since this is only used at build time and as a client, we can rely on the server to handle the details of schema validation.
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview has no changes  The preview was not built because there were no changes.  **Build ID**: 3cae39aa83fa6ced058278ca **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/3cae39aa83fa6ced058278ca/logs)  ---  ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260928-8fa2c544-7035-41a53f0a80939ad5)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

- **Issue #7032** (2026-09-25): **[4.x] Fix Java codegen referencing unavaiable symbols**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview has no changes  The preview was not built because there were no changes.  **Build ID**: b0756bb22b62505f67f72842 **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/b0756bb22b62505f67f72842/logs)  ---  ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260924-8fa2c544-7032-c1795bb5a11ae525)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

- **Issue #7031** (2026-09-25): **Fix JavaCodegen referencing inexistant symbols**
  *Symptoms*: Only reference the adapters we have available.
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview ready  The preview is ready to be viewed. [View the preview](https://www.apollographql.com/docs/deploy-preview/3a0465c2131919ea964d9eb2)  File Changes  <details> <summary>0 new, 7 changed, 0 removed</summary>  ``` * (developer-tools)/kotlin/(latest)/index.mdx * (developer-tools)/kotlin/(latest)/advanced/apollo-ast.mdx * (developer-tools)/kotlin/(latest)/advanced/compiler-plugins.mdx * (developer-tools)/kotlin/(latest)/advanced/http-engine.mdx * (developer-tools)/kotlin/(latest)/advanced/no-runtime.mdx * (developer-tools)/kotlin/(latest)/testing/apollo-debug-server.mdx * (developer-tools)/kotlin/(latest)/testing/mocking-graphql-responses.mdx ```  </details>  **Build ID**: 3a0465c2131919ea964d9eb2 **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/3a0465c2131919ea964d9eb2/logs)  **URL**: [https://www.apollographql.com/docs/deploy-preview/3a0465c2131919ea964d9eb2](https://www.apollographql.com/docs/deploy-preview/3a0465c2131919ea964d9eb2)  ---

- **Issue #7030** (2026-09-16): **Bump version to 5.2.1 SNAPSHOT**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview ready  The preview is ready to be viewed. [View the preview](https://www.apollographql.com/docs/deploy-preview/2b47bb2324f022cc3a02817a)  File Changes  <details> <summary>0 new, 7 changed, 0 removed</summary>  ``` * (developer-tools)/kotlin/(latest)/index.mdx * (developer-tools)/kotlin/(latest)/advanced/apollo-ast.mdx * (developer-tools)/kotlin/(latest)/advanced/compiler-plugins.mdx * (developer-tools)/kotlin/(latest)/advanced/http-engine.mdx * (developer-tools)/kotlin/(latest)/advanced/no-runtime.mdx * (developer-tools)/kotlin/(latest)/testing/apollo-debug-server.mdx * (developer-tools)/kotlin/(latest)/testing/mocking-graphql-responses.mdx ```  </details>  **Build ID**: 2b47bb2324f022cc3a02817a **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/2b47bb2324f022cc3a02817a/logs)  **URL**: [https://www.apollographql.com/docs/deploy-preview/2b47bb2324f022cc3a02817a](https://www.apollographql.com/docs/deploy-preview/2b47bb2324f022cc3a02817a)  ---

- **Issue #7029** (2026-09-16): **Version is now 5.2.0-SNAPSHOT**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview has no changes  The preview was not built because there were no changes.  **Build ID**: 7dec9c7f8676dff66507cedf **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/7dec9c7f8676dff66507cedf/logs)  ---  ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260916-8fa2c544-7029-96f91a5ffb1f96cf)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

- **Issue #7028** (2026-09-16): **Default to allowing empty selection sets**
  *Symptoms*: The proposal is RFC3 now. Make `allowEmptySelectionSets` default to true and deprecate it. This also mirrors graphql-js: https://github.com/graphql/graphql-js/pull/4852
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview ready  The preview is ready to be viewed. [View the preview](https://www.apollographql.com/docs/deploy-preview/5381d4ae3216e1b5b8b49522)  File Changes  <details> <summary>0 new, 1 changed, 0 removed</summary>  ``` * (developer-tools)/kotlin/(latest)/advanced/plugin-configuration.mdx ```  </details>  **Build ID**: 5381d4ae3216e1b5b8b49522 **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/5381d4ae3216e1b5b8b49522/logs)  **URL**: [https://www.apollographql.com/docs/deploy-preview/5381d4ae3216e1b5b8b49522](https://www.apollographql.com/docs/deploy-preview/5381d4ae3216e1b5b8b49522)  ---  ### ✅ AI Style Review — No Issues Found  The pull request does not have any style issues.  **Duration**: 3553ms **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260916-8fa2c544-7028-5e7b8971517c0f84)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not alway

- **Issue #7027** (2026-09-16): **Fix @catch handling of malformed response data**
  *Symptoms*: Fixes #7014  Malformed response data could be swallowed by `@catch` adapters because they caught all `ApolloException`s, including parsing errors such as `JsonDataException`.  This narrows the adapters to catch `ApolloGraphQLException`, allowing malformed response data to propagate as a parsing failure while preserving GraphQL error handling.  Adds regression coverage for fragmented queries and both `NULL` and `RESULT` catch behavior.
  **Post-Mortem & Fix Analysis**:
  > @AvikMakwana: Thank you for submitting a pull request! Before we can merge it, you'll need to sign the Apollo Contributor License Agreement here: https://contribute.apollographql.com/
  > ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260915-8fa2c544-7027-1f9c9cd2fd5b3bce)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

- **Issue #7026** (2026-09-14): **Add exposeServiceCapabilities**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### ✅ Docs preview has no changes  The preview was not built because there were no changes.  **Build ID**: b13ce05b33bf47fe10769f5e **Build Logs**: [View logs](https://www.apollographql.com/docs/deploy-preview/b13ce05b33bf47fe10769f5e/logs)  ---  ### ✅ AI Style Review — No Changes Detected  No MDX files were changed in this pull request.  **Review Log**: [View detailed log](https://docs.access.apollographql.com/docs/internal/ai-reviews/20260914-8fa2c544-7026-2b06077431a93c2c)  > This review is AI-generated. Please use common sense when accepting these suggestions, as they may not always be accurate or appropriate for your specific context.

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

### Incident Patch 1: `dd2e5dc6` (2026-09-25)
**Commit Message**: Fix JavaCodegen referencing inexistant symbols (#7031)

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/java/JavaResolver.kt` (modified, +5/-3)
```diff
@@ -197,9 +197,11 @@ internal class JavaResolver(
     } else if (type.nullable) {
       val initializer = adapterInitializer(type.nullable(false), requiresBuffering)
 
-      val match = Regex("com\\.apollographql\\.apollo\\.api\\.Adapters\\.([a-zA-Z]*)Adapter").matchEntire(initializer.toString())
-      if (match != null) {
-        nullableAdapterCodeBlock(match.groupValues[1])
+      val match = Regex("com\\.apollographql\\.apollo\\.api\\.Adapters\\.([a-zA-Z]*)Adapter").matchEntire(initializer.toString())?.groupValues?.get(1)
+      if (match != null &&
+          (match in setOf("String", "Int", "Double", "Boolean", "Any") || match == "Long" && nullableFieldStyle !in setOf(JavaNullable.APOLLO_OPTIONAL, JavaNullable.GUAVA_OPTIONAL, JavaNullable.JAVA_OPTIONAL))) {
+        // For those we have them as fields
+        nullableAdapterCodeBlock(match)
       } else {
         CodeBlock.of("new $T<>($L)", getOptionalOrNullableAdapterClassName(), adapterInitializer(type.nullable(false), requiresBuffering))
       }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/TestOperation.graphql` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ query TestQuery {
   nullableListOfNonNullTimestamp
   nullableListOfNullableTimestamp
   nullableLong
+  nullableFloat
 }
 
 query ScalarWithGenericType {
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/custom_scalar_type/TestQuery.java.expected` (modified, +14/-5)
```diff
@@ -15,6 +15,7 @@ import com.apollographql.apollo.api.json.JsonWriter;
 import com.example.custom_scalar_type.adapter.TestQuery_ResponseAdapter;
 import com.example.custom_scalar_type.selections.TestQuerySelections;
 import java.io.IOException;
+import java.lang.Float;
 import java.lang.Long;
 import java.lang.Object;
 import java.lang.Override;
@@ -26,7 +27,7 @@ import java.util.List;
 public class TestQuery implements Query<TestQuery.Data> {
   public static ExecutableDefinition<Data> definition = new Definition();
 
-  public static final String OPERATION_ID = "d84dc611bfd89c2610e876828a73c8cc888caa7e8056e020339919d484be8590";
+  public static final String OPERATION_ID = "ab392dcf31fc40a50aa171d889e97a082599dddfbe4946b2674204af36031a39";
 
   /**
    * The minimized GraphQL document being sent to the server to save a few bytes.
@@ -49,9 +50,10 @@ public class TestQuery implements Query<TestQuery.Data> {
    *   nullableListOfNonNullTimestamp
    *   nullableListOfNullableTimestamp
    *   nullableLong
+   *   nullableFloat
    * }
    */
-  public static final String OPERATION_DOCUMENT = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp nullableLong }";
+  public static final String OPERATION_DOCUMENT = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp nullableLong nullableFloat }";
 
   public static final String OPERATION_NAME = "TestQuery";
 
@@ -179,6 +181,8 @@ public class TestQuery implements Query<TestQuery.Data> {
 
     public Long nullableLong;
 
+    public Float nullableFloat;
+
     private transient volatile int $hashCode;
 
     private transient volatile boolean $hashCodeMemoized;
@@ -188,7 +192,7 @@ public class TestQuery implements Query<TestQuery.Data> {
     public Data(Hero hero, Object nonNullTimestamp, Object nullableTimestamp,
         List<Object> nonNullListOfNonNullTimestamp, List<Object> nonNullListOfNullableTimestamp,
         List<Object> nullableListOfNonNullTimestamp, List<Object> nullableListOfNullableTimestamp,
-        Long nullableLong) {
+        Long nullableLong, Float nullableFloat) {
       this.hero = hero;
       this.nonNullTimestamp = nonNullTimestamp;
       this.nullableTimestamp = nullableTimestamp;
@@ -197,6 +201,7 @@ public class TestQuery implements Query<TestQuery.Data> {
       this.nullableListOfNonNullTimestamp = nullableListOfNonNullTimestamp;
       this.nullableListOfNullableTimestamp = nullableListOfNullableTimestamp;
       this.nullableLong = nullableLong;
+      this.nullableFloat = nullableFloat;
     }
 
     @Override
@@ -213,7 +218,8 @@ public class TestQuery implements Query<TestQuery.Data> {
          &&((this.nonNullListOfNullableTimestamp == null) ? (that.nonNullListOfNullableTimestamp == null) : this.nonNullListOfNullableTimestamp.equals(that.nonNullListOfNullableTimestamp))
          &&((this.nullableListOfNonNullTimestamp == null) ? (that.nullableListOfNonNullTimestamp == null) : this.nullableListOfNonNullTimestamp.equals(that.nullableListOfNonNullTimestamp))
          &&((this.nullableListOfNullableTimestamp == null) ? (that.nullableListOfNullableTimestamp == null) : this.nullableListOfNullableTimestamp.equals(that.nullableListOfNullableTimestamp))
-         &&((this.nullableLong == null) ? (that.nullableLong == null) : this.nullableLong.equals(that.nullableLong));
+         &&((this.nullableLong == null) ? (that.nullableLong == null) : this.nullableLong.equals(that.nullableLong))
+         &&((this.nullableFloat == null) ? (that.nullableFloat == null) : this.nullableFloat.equals(that.nullableFloat));
       }
       return false;
     }
@@ -238,6 +244,8 @@ public class TestQuery implements Query<TestQuery.Data> {
         __h ^= (nullableListOfNullableTimestamp == null) ? 0 : nullableListOfNullableTimestamp.hashCode();
         __h *= 1000003;
         __h ^= (nullableLong == null) ? 0 : nullableLong.hashCode();
+        __h *= 1000003;
+        __h ^= (nullableFloat == null) ? 0 : nullableFloat.hashCode();
         $hashCode = __h;
         $hashCodeMemoized = true;
       }
@@ -255,7 +263,8 @@ public class TestQuery implements Query<TestQuery.Data> {
           + "nonNullListOfNullableTimestamp=" + nonNullListOfNullableTimestamp + ", "
           + "nullableListOfNonNullTimestamp=" + nullableListOfNonNullTimestamp + ", "
           + "nullableListOfNullableTimestamp=" + nullableListOfNullableTimestamp + ", "
-          + "nullableLong=" + nullableLong
+          + "nullableLong=" + nullableLong + ", "
+          + "nullableFloat=" + nullableFloat
           + "}";
       }
       return $toString;
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/custom_scalar_type/adapter/TestQuery_ResponseAdapter.java.expected` (modified, +9/-2)
```diff
@@ -16,6 +16,7 @@ import com.apollographql.apollo.api.json.JsonReader;
 import com.apollographql.apollo.api.json.JsonWriter;
 import com.example.custom_scalar_type.TestQuery;
 import java.io.IOException;
+import java.lang.Float;
 import java.lang.Long;
 import java.lang.Object;
 import java.lang.Override;
@@ -29,7 +30,7 @@ public class TestQuery_ResponseAdapter {
   public enum Data implements Adapter<TestQuery.Data> {
     INSTANCE;
 
-    private static final List<String> RESPONSE_NAMES = Arrays.asList("hero", "nonNullTimestamp", "nullableTimestamp", "nonNullListOfNonNullTimestamp", "nonNullListOfNullableTimestamp", "nullableListOfNonNullTimestamp", "nullableListOfNullableTimestamp", "nullableLong");
+    private static final List<String> RESPONSE_NAMES = Arrays.asList("hero", "nonNullTimestamp", "nullableTimestamp", "nonNullListOfNonNullTimestamp", "nonNullListOfNullableTimestamp", "nullableListOfNonNullTimestamp", "nullableListOfNullableTimestamp", "nullableLong", "nullableFloat");
 
     @SuppressWarnings("unchecked")
     @Override
@@ -43,6 +44,7 @@ public class TestQuery_ResponseAdapter {
       List<Object> _nullableListOfNonNullTimestamp = null;
       List<Object> _nullableListOfNullableTimestamp = null;
       Long _nullableLong = null;
+      Float _nullableFloat = null;
 
       loop:
       while(true) {
@@ -55,6 +57,7 @@ public class TestQuery_ResponseAdapter {
           case 5: _nullableListOfNonNullTimestamp = new NullableAdapter<>(new ListAdapter<>(Adapters.AnyAdapter)).fromJson(reader, customScalarAdapters); break;
           case 6: _nullableListOfNullableTimestamp = new NullableAdapter<>(new ListAdapter<>(Adapters.NullableAnyAdapter)).fromJson(reader, customScalarAdapters); break;
           case 7: _nullableLong = Adapters.NullableLongAdapter.fromJson(reader, customScalarAdapters); break;
+          case 8: _nullableFloat = new NullableAdapter<>(Adapters.FloatAdapter).fromJson(reader, customScalarAdapters); break;
           default: break loop;
         }
       }
@@ -71,7 +74,8 @@ public class TestQuery_ResponseAdapter {
         _nonNullListOfNullableTimestamp,
         _nullableListOfNonNullTimestamp,
         _nullableListOfNullableTimestamp,
-        _nullableLong
+        _nullableLong,
+        _nullableFloat
       );
     }
 
@@ -101,6 +105,9 @@ public class TestQuery_ResponseAdapter {
 
       writer.name("nullableLong");
       Adapters.NullableLongAdapter.toJson(writer, customScalarAdapters, value.nullableLong);
+
+      writer.name("nullableFloat");
+      new NullableAdapter<>(Adapters.FloatAdapter).toJson(writer, customScalarAdapters, value.nullableFloat);
     }
   }
 
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/custom_scalar_type/selections/TestQuerySelections.java.expected` (modified, +3/-1)
```diff
@@ -12,6 +12,7 @@ import com.apollographql.apollo.api.CompiledSelection;
 import com.example.custom_scalar_type.type.Character;
 import com.example.custom_scalar_type.type.CharacterID;
 import com.example.custom_scalar_type.type.Date;
+import com.example.custom_scalar_type.type.GraphQLFloat;
 import com.example.custom_scalar_type.type.GraphQLString;
 import com.example.custom_scalar_type.type.Long;
 import com.example.custom_scalar_type.type.Timestamp;
@@ -41,6 +42,7 @@ public class TestQuerySelections {
     new CompiledField.Builder("nonNullListOfNullableTimestamp", new CompiledNotNullType(new CompiledListType(Timestamp.type))).build(),
     new CompiledField.Builder("nullableListOfNonNullTimestamp", new CompiledListType(new CompiledNotNullType(Timestamp.type))).build(),
     new CompiledField.Builder("nullableListOfNullableTimestamp", new CompiledListType(Timestamp.type)).build(),
-    new CompiledField.Builder("nullableLong", Long.type).build()
+    new CompiledField.Builder("nullableLong", Long.type).build(),
+    new CompiledField.Builder("nullableFloat", GraphQLFloat.type).build()
   );
 }
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/custom_scalar_type/type/GraphQLFloat.java.expected` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+//
+// AUTO-GENERATED FILE. DO NOT MODIFY.
+//
+// This class was automatically generated by Apollo GraphQL version '$VERSION'.
+//
+package com.example.custom_scalar_type.type;
+
+import com.apollographql.apollo.api.CustomScalarType;
+
+public class GraphQLFloat {
+  public static CustomScalarType type = new CustomScalarType("Float", "java.lang.Float");
+}
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/used-coordinates.json.expected` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
         "Character": {},
         "Timestamp": {},
         "Long": {},
+        "Float": {},
         "CharacterID": {},
         "String": {},
         "Date": {},
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/kotlin/responseBased/custom_scalar_type/TestQuery.kt.expected` (modified, +5/-2)
```diff
@@ -17,6 +17,7 @@ import com.example.Timestamp
 import com.example.custom_scalar_type.adapter.TestQuery_ResponseAdapter
 import com.example.custom_scalar_type.selections.TestQuerySelections
 import com.example.custom_scalar_type.type.scalar.CharacterID
+import com.example.custom_scalar_type.type.scalar.Float
 import com.example.custom_scalar_type.type.scalar.Long
 import java.util.Date
 import kotlin.Any
@@ -59,6 +60,7 @@ public class TestQuery() : Query<TestQuery.Data> {
     public val nullableListOfNonNullTimestamp: List<Timestamp>?,
     public val nullableListOfNullableTimestamp: List<Timestamp?>?,
     public val nullableLong: Long?,
+    public val nullableFloat: Float?,
   ) : Query.Data {
     public fun nonNullListOfNullableTimestampFilterNotNull(): List<Timestamp> = nonNullListOfNullableTimestamp.filterNotNull()
 
@@ -107,7 +109,7 @@ public class TestQuery() : Query<TestQuery.Data> {
         .build()
 
     public const val OPERATION_ID: String =
-        "d84dc611bfd89c2610e876828a73c8cc888caa7e8056e020339919d484be8590"
+        "ab392dcf31fc40a50aa171d889e97a082599dddfbe4946b2674204af36031a39"
 
     /**
      * The minimized GraphQL document being sent to the server to save a few bytes.
@@ -131,11 +133,12 @@ public class TestQuery() : Query<TestQuery.Data> {
      *   nullableListOfNonNullTimestamp
      *   nullableListOfNullableTimestamp
      *   nullableLong
+     *   nullableFloat
      * }
      * ```
      */
     public val OPERATION_DOCUMENT: String
-      get() = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp nullableLong }"
+      get() = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp nullableLong nullableFloat }"
 
     public const val OPERATION_NAME: String = "TestQuery"
   }
```

---

### Incident Patch 2: `82763c14` (2026-09-16)
**Commit Message**: Fix @catch handling of malformed response data (#7027)

**File**: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/Adapters.kt` (modified, +2/-2)
```diff
@@ -430,7 +430,7 @@ private class CatchToResultAdapter<T>(private val wrappedAdapter: Adapter<T>) :
   override fun fromJson(reader: JsonReader, customScalarAdapters: CustomScalarAdapters): FieldResult<T> {
     return try {
       FieldResult.Success(wrappedAdapter.fromJson(reader, customScalarAdapters))
-    } catch (e: ApolloException) {
+    } catch (e: ApolloGraphQLException) {
       FieldResult.Failure(e)
     }
   }
@@ -451,7 +451,7 @@ private class CatchToNullAdapter<T>(private val wrappedAdapter: Adapter<T>) : Ad
   override fun fromJson(reader: JsonReader, customScalarAdapters: CustomScalarAdapters): T? {
     return try {
       wrappedAdapter.fromJson(reader, customScalarAdapters)
-    } catch (e: ApolloException) {
+    } catch (e: ApolloGraphQLException) {
       null
     }
   }
```

**File**: `libraries/apollo-api/src/commonTest/kotlin/test/JsonTest.kt` (modified, +21/-0)
```diff
@@ -5,12 +5,17 @@ package test
 import com.apollographql.apollo.annotations.ApolloInternal
 import com.apollographql.apollo.api.AnyAdapter
 import com.apollographql.apollo.api.CustomScalarAdapters
+import com.apollographql.apollo.api.IntAdapter
 import com.apollographql.apollo.api.LongAdapter
+import com.apollographql.apollo.api.catchToNull
+import com.apollographql.apollo.api.catchToResult
+import com.apollographql.apollo.api.errorAware
 import com.apollographql.apollo.api.json.MapJsonReader
 import com.apollographql.apollo.api.json.MapJsonWriter
 import com.apollographql.apollo.api.json.buildJsonString
 import com.apollographql.apollo.api.json.jsonReader
 import com.apollographql.apollo.api.json.readAny
+import com.apollographql.apollo.exception.JsonDataException
 import com.apollographql.apollo.exception.JsonEncodingException
 import okio.Buffer
 import kotlin.test.Test
@@ -88,4 +93,20 @@ class JsonTest {
       assertEquals("Unexpected value at path [foo]", e.message)
     }
   }
+
+  @Test
+  fun catchToResultThrowsOnMalformedData() {
+    val adapter = IntAdapter.errorAware().catchToResult()
+    assertFailsWith<JsonDataException> {
+      adapter.fromJson(Buffer().writeUtf8("null").jsonReader(), CustomScalarAdapters.Empty)
+    }
+  }
+
+  @Test
+  fun catchToNullThrowsOnMalformedData() {
+    val adapter = IntAdapter.errorAware().catchToNull()
+    assertFailsWith<JsonDataException> {
+      adapter.fromJson(Buffer().writeUtf8("null").jsonReader(), CustomScalarAdapters.Empty)
+    }
+  }
 }
```

**File**: `tests/catch/src/main/graphql/nested/operation.graphql` (modified, +10/-0)
```diff
@@ -9,3 +9,13 @@ query GetF {
     f @catch(to: THROW)
   }
 }
+
+fragment FooFragment on Foo {
+  f @catch(to: THROW)
+}
+
+query GetFFragmented {
+  foo {
+    ...FooFragment
+  }
+}
```

**File**: `tests/catch/src/test/kotlin/test/NestedTest.kt` (modified, +15/-1)
```diff
@@ -1,5 +1,6 @@
 package test
 
+import nested.GetFFragmentedQuery
 import nested.GetFQuery
 import nested.GetFooQuery
 import kotlin.test.Test
@@ -34,6 +35,19 @@ class NestedTest {
 
     assertNull(response.data)
     assertNotNull(response.exception)
-    assertTrue(response.exception!!.message!!.contains("Expected a name but was NULL at path data.foo.f"))
+    assertTrue(response.exception!!.message!!.contains("was NULL at path data.foo.f"))
+  }
+
+  @Test
+  fun serverSendsNullWithoutErrorFragmented() {
+    val response = GetFFragmentedQuery().parseResponse("""
+      {
+        "data": { "foo": { "f": null } }
+      }
+    """.trimIndent())
+
+    assertNull(response.data)
+    assertNotNull(response.exception)
+    assertTrue(response.exception!!.message!!.contains("was NULL at path data.foo.f"))
   }
 }
```

---

### Incident Patch 3: `7763ff5f` (2026-09-14)
**Commit Message**: Add guidance to the Garbage Collection doc (#7025)

* Add guidance to the Garbage Collection doc

* Apply suggestion from @BoD

**File**: `docs/source/caching/garbage-collection.mdx` (modified, +8/-1)
```diff
@@ -9,7 +9,7 @@ The garbage collection feature allows to remove unused data from the normalized
 A field is considered stale if its **received date** is older than its (client controlled) max age, or if its (server controlled)
 **expiration date** has passed.
 
-See [](./expiration/) for more information about staleness.
+See [expiration](./expiration/) for more information about staleness.
 
 Stale fields can be removed from the cache by calling the [`ApolloStore.removeStaleFields()`](https://apollographql.github.io/apollo-kotlin-normalized-cache/kdoc/normalized-cache/com.apollographql.cache.normalized/remove-stale-fields.html) function.
 
@@ -48,3 +48,10 @@ Unreachable records can be removed from the cache by calling the [`ApolloStore.r
 ## `ApolloStore.garbageCollect()`
 
 The [`ApolloStore.garbageCollect()`](https://apollographql.github.io/apollo-kotlin-normalized-cache/kdoc/normalized-cache/com.apollographql.cache.normalized/garbage-collect.html) function is a convenience to remove all stale fields, dangling references, and unreachable records from the cache.
+
+# Guidance
+
+We recommend calling `ApolloStore.garbageCollect()` periodically to keep the cache size under control. The frequency depends on your application's needs and the amount of data being cached.
+
+Since the garbage collection process can potentially be resource-intensive and time-consuming, run it in a background task during periods of low activity in your application,
+for instance by using [WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent) on Android.
```

---

### Incident Patch 4: `c145295b` (2026-09-04)
**Commit Message**: Fix the KDoc of `Service.addTypename` (#7017)

**File**: `libraries/apollo-gradle-plugin/src/main/kotlin/com/apollographql/apollo/gradle/api/Service.kt` (modified, +10/-8)
```diff
@@ -442,14 +442,16 @@ interface Service {
    * If a field is monomorphic, no '__typename' will be added.
    * This adds the bare minimum amount of __typename but the logic is substantially more complex than `ifAbstract`.
    *
-   * - "ifFragments" (deprecated): Add '__typename' for every selection set that contains fragments (inline or named)
-   * This causes cache misses when introducing fragments where no fragment was present before. This is deprecated and
-   * will be removed in a future version.
-   *
-   * Apollo Kotlin requires __typename to handle polymorphism and parsing fragments. By default, __typename is added on
-   * every composite field selection set. When using the cache, this also ensures that cache keys can read __typename.
-   * If you're not using the cache or do not use __typename in your cache keys, you can use "ifAbstract" or "ifPolymorphic"
-   * to reduce the number of __typename and the size of the network response.
+   * - "ifFragments" (default): Add '__typename' for every selection set that directly contains an inline or named fragment.
+   *
+   * The default, "ifFragments", is kept for backwards compatibility. It automatically adds
+   * __typename to selection sets that directly contain an inline or named fragment, rather than to
+   * every composite field. This can cause cache misses when a cache entry written without
+   * __typename is later read by a query that requires it (see #3965).
+   *
+   * If you use the normalized cache, set "always" so that __typename is added on every composite
+   * field selection set and cache keys can always read it. If you do not use the cache,
+   * "ifAbstract" or "ifPolymorphic" reduce the number of __typename and the response size.
    *
    * Default value: "ifFragments"
    */
```

---

### Incident Patch 5: `1a3105c7` (2026-08-21)
**Commit Message**: fix(compiler): report capitalized field issues once per field (#7011)

checkCapitalizedFields checks every fragment definition on its own, and then
follows fragment spreads into those same definitions, so a capitalized field
inside a fragment is reported once per path that reaches it plus once for the
definition itself.

The spread target is always either one of the definitions already checked in
the same pass or a fragment from an upstream module that was validated when
that module was compiled, so following spreads can never surface an issue the
direct pass misses. It only duplicates them.

Not following spreads also removes the traversal that produced them. The
recursion enumerated every simple path through the fragment graph, carrying a
List<String> of visited fragments that was rebuilt as 'checkedFragments + name'
at each spread, so membership was linear and the list was copied per spread. On
a module with 149 fragments and 478 spreads this call went from 8.4ms to
0.017ms with checkFragmentsOnly on, and from 13.2ms to 0.06ms with it off.

The existing capitalized_fields_allowed_with_fragment_spread fixture does not
catch the duplicate because it only runs with checkFragmentsOn

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/internal/checkCapitalizedFields.kt` (modified, +13/-12)
```diff
@@ -15,13 +15,17 @@ import com.apollographql.apollo.ast.UpperCaseField
 internal fun checkCapitalizedFields(definitions: List<GQLDefinition>, checkFragmentsOnly: Boolean): List<Issue> {
   val scope = object : ValidationScope {
     override val issues = mutableListOf<Issue>()
-    override val fragmentsByName = definitions.filterIsInstance<GQLFragmentDefinition>().associateBy { it.name }
   }
 
+  /**
+   * Every fragment definition is checked here, on its own. Fragment spreads are therefore not
+   * followed: the spread target is either one of these definitions, and already checked, or it
+   * belongs to an upstream module and was checked when that module was compiled.
+   */
   definitions.forEach { definition ->
     when {
-      definition is GQLOperationDefinition && !checkFragmentsOnly -> scope.checkCapitalizedFields(definition.selections, emptyList())
-      definition is GQLFragmentDefinition -> scope.checkCapitalizedFields(definition.selections, emptyList())
+      definition is GQLOperationDefinition && !checkFragmentsOnly -> scope.checkCapitalizedFields(definition.selections)
+      definition is GQLFragmentDefinition -> scope.checkCapitalizedFields(definition.selections)
     }
   }
 
@@ -31,7 +35,7 @@ internal fun checkCapitalizedFields(definitions: List<GQLDefinition>, checkFragm
 /**
  * Fields named with a capital first letter clash with the corresponding model name, unless flatten.
  */
-private fun ValidationScope.checkCapitalizedFields(selections: List<GQLSelection>, checkedFragments: List<String>) {
+private fun ValidationScope.checkCapitalizedFields(selections: List<GQLSelection>) {
   selections.forEach {
     when (it) {
       is GQLField -> {
@@ -61,22 +65,19 @@ private fun ValidationScope.checkCapitalizedFields(selections: List<GQLSelection
               )
           )
         }
-        checkCapitalizedFields(it.selections, checkedFragments)
+        checkCapitalizedFields(it.selections)
       }
 
-      is GQLInlineFragment -> checkCapitalizedFields(it.selections, checkedFragments)
-      // it might be that the fragment is defined in an upstream module. In that case, it is validated
-      // already, no need to check it again
-      is GQLFragmentSpread -> if (!checkedFragments.contains(it.name)) {
-        fragmentsByName[it.name]?.let { fragment -> checkCapitalizedFields(fragment.selections, checkedFragments + it.name) }
-      }
+      is GQLInlineFragment -> checkCapitalizedFields(it.selections)
+      // The spread target is checked on its own: either it is one of the definitions checked
+      // above, or it is defined in an upstream module and was validated there.
+      is GQLFragmentSpread -> Unit
     }
   }
 }
 
 private interface ValidationScope {
   val issues: MutableList<Issue>
-  val fragmentsByName: Map<String, GQLFragmentDefinition>
 }
 
 private fun isFirstLetterUpperCase(name: String): Boolean {
```

**File**: `libraries/apollo-compiler/src/test/kotlin/com/apollographql/apollo/compiler/CheckCapitalizedFieldsTest.kt` (modified, +3/-1)
```diff
@@ -16,7 +16,9 @@ class CheckCapitalizedFieldsTest(name: String, private val graphQLFile: File) {
 
   @Test
   fun testValidation() = checkExpected(graphQLFile) { _ ->
-    val checkFragmentsOnly = graphQLFile.name != "capitalized_fields_disallowed.graphql"
+    // The "disallowed" fixtures are checked with checkFragmentsOnly = false so that operations
+    // are checked too, which is what happens when flattenModels is off.
+    val checkFragmentsOnly = !graphQLFile.name.startsWith("capitalized_fields_disallowed")
 
     checkCapitalizedFields(graphQLFile.toGQLDocument().definitions, checkFragmentsOnly = checkFragmentsOnly).serialize()
   }
```

**File**: `libraries/apollo-compiler/src/test/validation/operation/capitalized_fields/capitalized_fields_disallowed_with_fragment_spread.expected` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+UpperCaseField (2:3)
+Capitalized field 'Horse' is not supported as it causes name clashes with the generated models. Use an alias instead or the 'flattenModels' or 'decapitalizeFields' compiler option.
+------------
+UpperCaseField (9:3)
+Capitalized field 'Cow' is not supported as it causes name clashes with the generated models. Use an alias instead or the 'flattenModels' or 'decapitalizeFields' compiler option.
\ No newline at end of file
```

**File**: `libraries/apollo-compiler/src/test/validation/operation/capitalized_fields/capitalized_fields_disallowed_with_fragment_spread.graphql` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+query TestQuery {
+  Horse {
+    Donkey
+    ...HorseFragment
+  }
+}
+
+fragment HorseFragment on Horse {
+  Cow {
+    Moo
+  }
+}
```

---

### Incident Patch 6: `5314131b` (2026-08-18)
**Commit Message**: WebSocket tests: fix a race condition (#7005)

**File**: `libraries/apollo-runtime/src/jvmTest/kotlin/RetryWebSocketsTest.kt` (modified, +1/-1)
```diff
@@ -47,10 +47,10 @@ class RetryWebSocketsTest {
                   .build()
           )
           .build().use { apolloClient ->
+            val serverWriter = mockServer.enqueueWebSocket(keepAlive = false)
             apolloClient.subscription(FooSubscription())
                 .toFlow()
                 .test {
-                  val serverWriter = mockServer.enqueueWebSocket(keepAlive = false)
                   var serverReader = mockServer.awaitWebSocketRequest()
 
                   serverReader.awaitMessage() // connection_init
```

---

### Incident Patch 7: `6b0463f3` (2026-08-18)
**Commit Message**: Benchmarks: increase firebase timeout and serialize JMH benchmarks  (#7004)

* Benchmarks: increase firebase timeout

* Run JMH benchmarks one after the other

**File**: `.github/workflows/run-benchmarks.yml` (modified, +3/-1)
```diff
@@ -31,7 +31,9 @@ jobs:
           GOOGLE_SERVICES_JSON: ${{ secrets.APOLLO_KOTLIN_GOOGLE_SERVICES_JSON }}
       - run: |
           # Run the native, ast and compiler benchmarks
-          ./gradlew -p tests :native-benchmarks:allTests :ast-benchmark:jmhBenchmark :compiler-benchmark:jmhBenchmark
+          ./gradlew -p tests :native-benchmarks:allTests :ast-benchmark:jmhBenchmark
+          # Cannot run concurrently with the above (see https://github.com/Kotlin/kotlinx-benchmark/issues/391)
+          ./gradlew -p tests :compiler-benchmark:jmhBenchmark
       - run: |
           # Upload all the results to Datadog and update the benchmarks issue
           ./scripts/upload-benchmarks.main.kts
```

**File**: `gradle/libraries.toml` (modified, +3/-2)
```diff
@@ -38,6 +38,7 @@ kotlin-plugin = "2.3.10"
 kotlin-plugin-latest = "2.3.10"
 kotlinx-coroutines = "1.10.2"
 kotlinx-datetime = "0.7.1"
+kotlinx-benchmark = "0.4.17"
 #noinspection NewerVersionAvailable requires KGP 2.2
 kotlinx-serialization-runtime = "1.8.1"
 #noinspection GradleDependency,NewerVersionAvailable compatibility with native consumers
@@ -144,8 +145,8 @@ kotlin-test = { group = "org.jetbrains.kotlin", name = "kotlin-test" } # use sam
 # Please, make sure that the standard library has the version in the range [2.1.0 .. 2.1.255]. Adjust your project's settings if necessary.
 kotlin-stdlib-js = { group = "org.jetbrains.kotlin", name = "kotlin-stdlib-js", version.ref = "kotlin-plugin" }
 kotlin-stdlib-wasm-js = { group = "org.jetbrains.kotlin", name = "kotlin-stdlib-wasm-js", version.ref = "kotlin-plugin" }
-kotlinx-benchmark-runtime = "org.jetbrains.kotlinx:kotlinx-benchmark-runtime:0.4.14"
-kotlinx-benchmark = "org.jetbrains.kotlinx:kotlinx-benchmark-plugin:0.4.14"
+kotlinx-benchmark-runtime = { module = "org.jetbrains.kotlinx:kotlinx-benchmark-runtime", version.ref = "kotlinx-benchmark" }
+kotlinx-benchmark = { module="org.jetbrains.kotlinx:kotlinx-benchmark-plugin", version.ref = "kotlinx-benchmark" }
 kotlinx-browser = "org.jetbrains.kotlinx:kotlinx-browser:0.3"
 androidx-benchmark-macro = "androidx.benchmark:benchmark-macro-junit4:1.4.1"
 kotlinx-coroutines = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-core", version.ref = "kotlinx-coroutines" }
```

---

### Incident Patch 8: `0022b36f` (2026-08-18)
**Commit Message**: Benchmarks: increase firebase timeout (#7003)

**File**: `scripts/run-firebase-benchmarks.main.kts` (modified, +1/-1)
```diff
@@ -180,7 +180,7 @@ fun runTest(projectId: String, testApk: String): String {
       "--app",
       appApk,
       "--timeout",
-      "30m"
+      "45m"
   )
 
   directoriesToPull.let {
```

---

### Incident Patch 9: `e7a7fc35` (2026-07-22)
**Commit Message**: Fix plugin code snipped in cache migration guide (#6991)

**File**: `docs/source/caching/migration-guide.md` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ apollo {
     // ...
 
     // Add this
-    plugin("com.apollographql.cache:normalized-cache-apollo-compiler-plugin:$cacheVersion") {
+    plugin("com.apollographql.cache:normalized-cache-apollo-compiler-plugin:$cacheVersion")
     pluginArgument("com.apollographql.cache.packageName", packageName.get())
   }
 }
```

---

### Incident Patch 10: `3e97da7e` (2026-07-15)
**Commit Message**: Fix CatchToResult toJson (#6984)

* Add regression tests for composing FieldResult.Failure fields

CatchToResultAdapter.toJson writes nothing for a Failure, leaving the JsonWriter with a dangling field name: composing any  later sibling throws an IllegalStateException, and a Failure in the last position is silently omitted from the output.

The new UserResultAndProduct operation provides the failure-followed-by-sibling shape; the tests assert the correct behavior (writing the null the server sent) and fail until the adapter is fixed.

* Fix for FieldResult.Failure not being written by writing the null the server sent for the errored field

Closes #6983

* Add comment

---------

Co-authored-by: Martin Bonnin <[REDACTED_EMAIL]>

**File**: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/Adapters.kt` (modified, +5/-1)
```diff
@@ -437,7 +437,11 @@ private class CatchToResultAdapter<T>(private val wrappedAdapter: Adapter<T>) :
   override fun toJson(writer: JsonWriter, customScalarAdapters: CustomScalarAdapters, value: FieldResult<T>) {
     when (value) {
       is FieldResult.Success -> wrappedAdapter.toJson(writer, customScalarAdapters, value.getOrThrow())
-      else -> Unit // ignore errors
+      /**
+       * Write the null the server sent for the errored field, so that the enclosing object stays well-formed.
+       * When writing to the cache, the errors are transmitted out of band.
+       */
+      else -> writer.nullValue()
     }
   }
 }
```

**File**: `tests/catch/src/main/graphql/shared/operations.graphql` (modified, +9/-0)
```diff
@@ -46,5 +46,14 @@ query PriceNull {
   }
 }
 
+query UserResultAndProduct {
+  user @catch(to: RESULT) {
+    name
+  }
+  product {
+    price
+  }
+}
+
 
 
```

**File**: `tests/catch/src/test/kotlin/test/CatchResultTest.kt` (modified, +44/-0)
```diff
@@ -1,15 +1,22 @@
 package test
 
+import com.apollographql.apollo.api.CustomScalarAdapters
+import com.apollographql.apollo.api.Error
+import com.apollographql.apollo.api.FieldResult
+import com.apollographql.apollo.api.Query
 import com.apollographql.apollo.api.graphQLErrorOrNull
 import com.apollographql.apollo.api.getOrNull
 import com.apollographql.apollo.api.getOrThrow
+import com.apollographql.apollo.api.json.MapJsonWriter
+import com.apollographql.apollo.exception.ApolloGraphQLException
 import result.PriceNullQuery
 import result.ProductIgnoreErrorsQuery
 import result.ProductNullQuery
 import result.ProductQuery
 import result.ProductResultQuery
 import result.UserNullQuery
 import result.UserQuery
+import result.UserResultAndProductQuery
 import result.UserResultQuery
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -107,4 +114,41 @@ class CatchResultTest {
     assertNull(response.data?.product?.getOrNull()?.price)
     assertNull(response.errors)
   }
+
+  @Test
+  fun composeFailureFollowedBySibling() {
+    val data = UserResultAndProductQuery.Data(
+        user = userFailure,
+        product = FieldResult.Success(UserResultAndProductQuery.Product(price = FieldResult.Success("10"))),
+    )
+
+    assertEquals(
+        mapOf("user" to null, "product" to mapOf("price" to "10")),
+        UserResultAndProductQuery().compose(data)
+    )
+  }
+
+  @Test
+  fun composeFailureAsLastField() {
+    val data = UserResultQuery.Data(user = userFailure)
+
+    assertEquals(mapOf("user" to null), UserResultQuery().compose(data))
+  }
+
+  @Test
+  fun composeRoundTripsParsedFailure() {
+    val data = UserResultQuery().parseResponse(userNameError).data!!
+
+    assertEquals(mapOf("user" to mapOf("name" to null)), UserResultQuery().compose(data))
+  }
+}
+
+private val userFailure = FieldResult.Failure(
+    ApolloGraphQLException(Error.Builder("cannot resolve user").path(listOf("user")).build())
+)
+
+private fun <D : Query.Data> Query<D>.compose(data: D): Any? {
+  val writer = MapJsonWriter()
+  adapter().toJson(writer, CustomScalarAdapters.Empty, data)
+  return writer.root()
 }
```

---

### Incident Patch 11: `b87c1a8b` (2026-07-13)
**Commit Message**: Fix cache initialization in migration documentation (#6982)

**File**: `docs/source/migration/5.0.mdx` (modified, +1/-1)
```diff
@@ -267,7 +267,7 @@ val apolloClient = ApolloClient.Builder()
                 DefaultHttpEngine {
                   OkHttpClient.Builder()
                       // Make sure to use a different directory for your cache as the format changed
-                      .cache(directory = File(application.cacheDir, "http_cache2"), maxSize = 10_000_000)
+                      .cache(cache = Cache(directory = File(application.cacheDir, "http_cache2"), maxSize = 10_000_000))
                       .build()
                 }
             )
```

---

### Incident Patch 12: `ed2f96de` (2026-07-06)
**Commit Message**: Fix K/N ABI (#6978)

On native, making a function parameter nullable is a binary breaking change.
To fix that, we introduce back the non-nullable version as hidden.

**File**: `libraries/apollo-api/api/apollo-api.api` (modified, +2/-0)
```diff
@@ -574,6 +574,8 @@ public final class com/apollographql/apollo/api/Error {
 }
 
 public final class com/apollographql/apollo/api/Error$Builder {
+	public final synthetic fun -locations (Ljava/util/List;)Lcom/apollographql/apollo/api/Error$Builder;
+	public final synthetic fun -path (Ljava/util/List;)Lcom/apollographql/apollo/api/Error$Builder;
 	public fun <init> (Ljava/lang/String;)V
 	public final fun build ()Lcom/apollographql/apollo/api/Error;
 	public final fun extensions (Ljava/util/Map;)Lcom/apollographql/apollo/api/Error$Builder;
```

**File**: `libraries/apollo-api/api/apollo-api.klib.api` (modified, +2/-0)
```diff
@@ -1090,8 +1090,10 @@ final class com.apollographql.apollo.api/Error { // com.apollographql.apollo.api
 
         final fun build(): com.apollographql.apollo.api/Error // com.apollographql.apollo.api/Error.Builder.build|build(){}[0]
         final fun extensions(kotlin.collections/Map<kotlin/String, kotlin/Any?>?): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.extensions|extensions(kotlin.collections.Map<kotlin.String,kotlin.Any?>?){}[0]
+        final fun locations(kotlin.collections/List<com.apollographql.apollo.api/Error.Location>): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.locations|locations(kotlin.collections.List<com.apollographql.apollo.api.Error.Location>){}[0]
         final fun locations(kotlin.collections/List<com.apollographql.apollo.api/Error.Location>?): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.locations|locations(kotlin.collections.List<com.apollographql.apollo.api.Error.Location>?){}[0]
         final fun nonStandardFields(kotlin.collections/Map<kotlin/String, kotlin/Any?>?): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.nonStandardFields|nonStandardFields(kotlin.collections.Map<kotlin.String,kotlin.Any?>?){}[0]
+        final fun path(kotlin.collections/List<kotlin/Any>): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.path|path(kotlin.collections.List<kotlin.Any>){}[0]
         final fun path(kotlin.collections/List<kotlin/Any>?): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.path|path(kotlin.collections.List<kotlin.Any>?){}[0]
         final fun putExtension(kotlin/String, kotlin/Any?): com.apollographql.apollo.api/Error.Builder // com.apollographql.apollo.api/Error.Builder.putExtension|putExtension(kotlin.String;kotlin.Any?){}[0]
     }
```

**File**: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/Error.kt` (modified, +16/-0)
```diff
@@ -1,6 +1,8 @@
 package com.apollographql.apollo.api
 
 import com.apollographql.apollo.annotations.ApolloDeprecatedSince
+import kotlin.jvm.JvmName
+import kotlin.jvm.JvmSynthetic
 
 /**
  * Represents an error response returned from the GraphQL server
@@ -48,10 +50,24 @@ constructor(
       this.locations = locations
     }
 
+    @JvmName("-locations")
+    @JvmSynthetic
+    @Deprecated("synthetic function for compatibility with the cache linked against Apollo 4", level = DeprecationLevel.HIDDEN)
+    fun locations(locations: List<Location>) = apply {
+      this.locations = locations
+    }
+
     fun path(path: List<Any>?) = apply {
       this.path = path
     }
 
+    @JvmName("-path")
+    @JvmSynthetic
+    @Deprecated("synthetic function for compatibility with the cache linked against Apollo 4", level = DeprecationLevel.HIDDEN)
+    fun path(path: List<Any>) = apply {
+      this.path = path
+    }
+
     @Deprecated("Use extensions() instead", ReplaceWith("extensions(mapOf(name to value))"))
     @ApolloDeprecatedSince(ApolloDeprecatedSince.Version.v5_0_0)
     fun putExtension(name: String, value: Any?) = apply {
```

---

### Incident Patch 13: `e3717675` (2026-07-03)
**Commit Message**: Mention apollo-adapters in the migration guide (#6977)

**File**: `docs/source/migration/5.0.mdx` (modified, +4/-0)
```diff
@@ -37,6 +37,10 @@ plugins {
 }
 ```
 
+## `apollo-adapters`
+
+The `apollo-adapters` artifact is moved to a separate repo. You can find it at [apollographql/apollo-kotlin-adapters](https://github.com/apollographql/apollo-kotlin-adapters). Read more in the [Apollo Kotlin Galaxy page](../advanced/galaxy.mdx)
+
 ## `apollo-gradle-plugin`
 
 ### `operationOutputGenerator` and `operationIdGenerator` are removed.
```

---

### Incident Patch 14: `d7afd3dc` (2026-06-22)
**Commit Message**: Signal a proper error in case null is returned in an unexpected position (#6971)

**File**: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/json/MapJsonReader.kt` (modified, +1/-2)
```diff
@@ -194,9 +194,8 @@ constructor(
       is Long -> value.toString()
       is Double -> value.toString()
       is String -> value
-      null -> "null"
       is JsonNumber -> value.value
-      else -> error("Expected a String but got $value instead")
+      else -> throw JsonDataException("Expected a String but got $value instead")
     }.also {
       advanceIterator()
     }
```

**File**: `tests/models-fixtures/graphql/operations.graphql` (modified, +7/-0)
```diff
@@ -151,3 +151,10 @@ query InlineAndNamedFragment {
         }
     }
 }
+
+query GetFoo {
+  foo
+  ...queryDetails
+}
+
+fragment queryDetails on Query { foo }
\ No newline at end of file
```

**File**: `tests/models-fixtures/graphql/schema.graphqls` (modified, +2/-0)
```diff
@@ -22,6 +22,8 @@ type Query {
     starship ( id: ID!): Starship
 
     allPlanets(after: String, first: Int, before: String, last: Int): PlanetsConnection
+
+    foo: String!
 }
 
 """
```

**File**: `tests/models-operation-based/src/commonTest/kotlin/test/ParseResponseBodyTest.kt` (modified, +29/-0)
```diff
@@ -1,16 +1,21 @@
 package test
 
 import codegen.models.AllPlanetsQuery
+import codegen.models.GetFooQuery
 import com.apollographql.apollo.api.composeJsonResponse
+import com.apollographql.apollo.api.json.BufferedSourceJsonReader
 import com.apollographql.apollo.api.json.buildJsonString
 import com.apollographql.apollo.api.json.jsonReader
 import com.apollographql.apollo.api.json.readAny
+import com.apollographql.apollo.api.parseResponse
 import com.apollographql.apollo.api.toApolloResponse
+import com.apollographql.apollo.exception.JsonDataException
 import okio.Buffer
 import testFixtureToJsonReader
 import testFixtureToUtf8
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertIs
 
 class ParseResponseBodyTest {
   /**
@@ -64,4 +69,28 @@ class ParseResponseBodyTest {
 
     assertEquals(expectedMap, actualMap)
   }
+
+  @Test
+  @Throws(Exception::class)
+  fun throwsOnInvalidServerResponse() {
+    val reader = BufferedSourceJsonReader(
+        /**
+         * This is an invalid response. `foo` should not be null.
+         */
+        Buffer().writeUtf8(
+            """
+        {
+          "data": {
+            "__typename": "Query",
+            "foo": null
+          }
+        }
+        """.trimIndent()
+        )
+    )
+
+    val response = GetFooQuery().parseResponse(reader)
+    assertEquals(null, response.data)
+    assertIs<JsonDataException>(response.exception)
+  }
 }
```

---

### Incident Patch 15: `d300e06f` (2026-06-11)
**Commit Message**: Add NullableLongAdapter (#6968)

**File**: `libraries/apollo-api/api/apollo-api.api` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ public final class com/apollographql/apollo/api/Adapters {
 	public static final field NullableBooleanAdapter Lcom/apollographql/apollo/api/NullableAdapter;
 	public static final field NullableDoubleAdapter Lcom/apollographql/apollo/api/NullableAdapter;
 	public static final field NullableIntAdapter Lcom/apollographql/apollo/api/NullableAdapter;
+	public static final field NullableLongAdapter Lcom/apollographql/apollo/api/NullableAdapter;
 	public static final field NullableStringAdapter Lcom/apollographql/apollo/api/NullableAdapter;
 	public static final field StringAdapter Lcom/apollographql/apollo/api/Adapter;
 	public static final field UploadAdapter Lcom/apollographql/apollo/api/Adapter;
```

**File**: `libraries/apollo-api/api/apollo-api.klib.api` (modified, +2/-0)
```diff
@@ -1476,6 +1476,8 @@ final val com.apollographql.apollo.api/NullableDoubleAdapter // com.apollographq
     final fun <get-NullableDoubleAdapter>(): com.apollographql.apollo.api/NullableAdapter<kotlin/Double> // com.apollographql.apollo.api/NullableDoubleAdapter.<get-NullableDoubleAdapter>|<get-NullableDoubleAdapter>(){}[0]
 final val com.apollographql.apollo.api/NullableIntAdapter // com.apollographql.apollo.api/NullableIntAdapter|{}NullableIntAdapter[0]
     final fun <get-NullableIntAdapter>(): com.apollographql.apollo.api/NullableAdapter<kotlin/Int> // com.apollographql.apollo.api/NullableIntAdapter.<get-NullableIntAdapter>|<get-NullableIntAdapter>(){}[0]
+final val com.apollographql.apollo.api/NullableLongAdapter // com.apollographql.apollo.api/NullableLongAdapter|{}NullableLongAdapter[0]
+    final fun <get-NullableLongAdapter>(): com.apollographql.apollo.api/NullableAdapter<kotlin/Long> // com.apollographql.apollo.api/NullableLongAdapter.<get-NullableLongAdapter>|<get-NullableLongAdapter>(){}[0]
 final val com.apollographql.apollo.api/NullableStringAdapter // com.apollographql.apollo.api/NullableStringAdapter|{}NullableStringAdapter[0]
     final fun <get-NullableStringAdapter>(): com.apollographql.apollo.api/NullableAdapter<kotlin/String> // com.apollographql.apollo.api/NullableStringAdapter.<get-NullableStringAdapter>|<get-NullableStringAdapter>(){}[0]
 final val com.apollographql.apollo.api/StringAdapter // com.apollographql.apollo.api/StringAdapter|{}StringAdapter[0]
```

**File**: `libraries/apollo-api/src/commonMain/kotlin/com/apollographql/apollo/api/Adapters.kt` (modified, +3/-0)
```diff
@@ -276,6 +276,9 @@ val NullableBooleanAdapter = BooleanAdapter.nullable()
 @JvmField
 val NullableAnyAdapter = AnyAdapter.nullable()
 
+@JvmField
+val NullableLongAdapter = LongAdapter.nullable()
+
 /*
  * Global instances of optional adapters for built-in scalar types
  */
```

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/java/JavaResolver.kt` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ internal class JavaResolver(
 
   fun adapterInitializer(type: IrType, requiresBuffering: Boolean): CodeBlock {
     return if (type.optional) {
-      return CodeBlock.of("new $T<>($L)", getOptionalAdapterClassName(), adapterInitializer(type.optional(false), requiresBuffering))
+      CodeBlock.of("new $T<>($L)", getOptionalAdapterClassName(), adapterInitializer(type.optional(false), requiresBuffering))
     } else if (type.catchTo != IrCatchTo.NoCatch) {
       error("Java codegen does not support @catch")
     } else if (type.nullable) {
```

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/kotlin/KotlinResolver.kt` (modified, +1/-0)
```diff
@@ -217,6 +217,7 @@ internal class KotlinResolver(
           KotlinSymbols.IntAdapter.canonicalName -> KotlinSymbols.NullableIntAdapter
           KotlinSymbols.DoubleAdapter.canonicalName -> KotlinSymbols.NullableDoubleAdapter
           KotlinSymbols.AnyAdapter.canonicalName -> KotlinSymbols.NullableAnyAdapter
+          KotlinSymbols.LongAdapter.canonicalName -> KotlinSymbols.NullableLongAdapter
           else -> null
         }
         if (nonNullableBuiltin != null) {
```

**File**: `libraries/apollo-compiler/src/main/kotlin/com/apollographql/apollo/compiler/codegen/kotlin/KotlinSymbols.kt` (modified, +1/-0)
```diff
@@ -105,6 +105,7 @@ internal object KotlinSymbols {
   val NullableDoubleAdapter = MemberName(apolloApiPackageName, "NullableDoubleAdapter")
   val NullableIntAdapter = MemberName(apolloApiPackageName, "NullableIntAdapter")
   val NullableStringAdapter = MemberName(apolloApiPackageName, "NullableStringAdapter")
+  val NullableLongAdapter = MemberName(apolloApiPackageName, "NullableLongAdapter")
 
 
   val DataBuilderScope = ClassName(apolloApiPackageName, "DataBuilderScope")
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/TestOperation.graphql` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ query TestQuery {
   nonNullListOfNullableTimestamp
   nullableListOfNonNullTimestamp
   nullableListOfNullableTimestamp
+  nullableLong
 }
 
 query ScalarWithGenericType {
```

**File**: `libraries/apollo-compiler/src/test/graphql/com/example/custom_scalar_type/java/operationBased/custom_scalar_type/TestQuery.java.expected` (modified, +15/-5)
```diff
@@ -15,6 +15,7 @@ import com.apollographql.apollo.api.json.JsonWriter;
 import com.example.custom_scalar_type.adapter.TestQuery_ResponseAdapter;
 import com.example.custom_scalar_type.selections.TestQuerySelections;
 import java.io.IOException;
+import java.lang.Long;
 import java.lang.Object;
 import java.lang.Override;
 import java.lang.String;
@@ -25,7 +26,7 @@ import java.util.List;
 public class TestQuery implements Query<TestQuery.Data> {
   public static ExecutableDefinition<Data> definition = new Definition();
 
-  public static final String OPERATION_ID = "60b4c0088b4e38080bd241601da65e11cc8fedf8a7d91571a4f4d39ccccb084f";
+  public static final String OPERATION_ID = "d84dc611bfd89c2610e876828a73c8cc888caa7e8056e020339919d484be8590";
 
   /**
    * The minimized GraphQL document being sent to the server to save a few bytes.
@@ -47,9 +48,10 @@ public class TestQuery implements Query<TestQuery.Data> {
    *   nonNullListOfNullableTimestamp
    *   nullableListOfNonNullTimestamp
    *   nullableListOfNullableTimestamp
+   *   nullableLong
    * }
    */
-  public static final String OPERATION_DOCUMENT = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp }";
+  public static final String OPERATION_DOCUMENT = "query TestQuery { hero { id name birthDate appearanceDates fieldWithUnsupportedType profileLink links } nonNullTimestamp nullableTimestamp nonNullListOfNonNullTimestamp nonNullListOfNullableTimestamp nullableListOfNonNullTimestamp nullableListOfNullableTimestamp nullableLong }";
 
   public static final String OPERATION_NAME = "TestQuery";
 
@@ -175,6 +177,8 @@ public class TestQuery implements Query<TestQuery.Data> {
 
     public List<Object> nullableListOfNullableTimestamp;
 
+    public Long nullableLong;
+
     private transient volatile int $hashCode;
 
     private transient volatile boolean $hashCodeMemoized;
@@ -183,14 +187,16 @@ public class TestQuery implements Query<TestQuery.Data> {
 
     public Data(Hero hero, Object nonNullTimestamp, Object nullableTimestamp,
         List<Object> nonNullListOfNonNullTimestamp, List<Object> nonNullListOfNullableTimestamp,
-        List<Object> nullableListOfNonNullTimestamp, List<Object> nullableListOfNullableTimestamp) {
+        List<Object> nullableListOfNonNullTimestamp, List<Object> nullableListOfNullableTimestamp,
+        Long nullableLong) {
       this.hero = hero;
       this.nonNullTimestamp = nonNullTimestamp;
       this.nullableTimestamp = nullableTimestamp;
       this.nonNullListOfNonNullTimestamp = nonNullListOfNonNullTimestamp;
       this.nonNullListOfNullableTimestamp = nonNullListOfNullableTimestamp;
       this.nullableListOfNonNullTimestamp = nullableListOfNonNullTimestamp;
       this.nullableListOfNullableTimestamp = nullableListOfNullableTimestamp;
+      this.nullableLong = nullableLong;
     }
 
     @Override
@@ -206,7 +212,8 @@ public class TestQuery implements Query<TestQuery.Data> {
          &&((this.nonNullListOfNonNullTimestamp == null) ? (that.nonNullListOfNonNullTimestamp == null) : this.nonNullListOfNonNullTimestamp.equals(that.nonNullListOfNonNullTimestamp))
          &&((this.nonNullListOfNullableTimestamp == null) ? (that.nonNullListOfNullableTimestamp == null) : this.nonNullListOfNullableTimestamp.equals(that.nonNullListOfNullableTimestamp))
          &&((this.nullableListOfNonNullTimestamp == null) ? (that.nullableListOfNonNullTimestamp == null) : this.nullableListOfNonNullTimestamp.equals(that.nullableListOfNonNullTimestamp))
-         &&((this.nullableListOfNullableTimestamp == null) ? (that.nullableListOfNullableTimestamp == null) : this.nullableListOfNullableTimestamp.equals(that.nullableListOfNullableTimestamp));
+         &&((this.nullableListOfNullableTimestamp == null) ? (that.nullableListOfNullableTimestamp == null) : this.nullableListOfNullableTimestamp.equals(that.nullableListOfNullableTimestamp))
+         &&((this.nullableLong == null) ? (that.nullableLong == null) : this.nullableLong.equals(that.nullableLong));
       }
       return false;
     }
@@ -229,6 +236,8 @@ public class TestQuery implements Query<TestQuery.Data> {
         __h ^= (nullableListOfNonNullTimestamp == null) ? 0 : nullableListOfNonNullTimestamp.hashCode();
         __h *= 1000003;
         __h ^= (nullableListOfNullableTimestamp == null) ? 0 : nullableListOfNullableTimestamp.hashCode();
+        __h *= 1000003;
+        __h ^= (nullableLong == null) ? 0 : nullableLong.hashCode();
         $hashCode = __h;
         $hashCodeMemoized = true;
       }
@@ -245,7 +254,8 @@ public class TestQuery implements Query<TestQuery.Data> {
           + "nonNullListOfNonNullTimestamp=" + nonNullListOfNonNullTimestamp + ", "
           + "nonNullListOfNullableTimestamp=" + nonNullListOfNullableTimestamp + ", "
           + "nulla
```

#### Recent Merged Pull Requests:
- **PR #7035** (2026-09-29): Add support for empty objects and empty interfaces (@martinbonnin)
- **PR #7032** (2026-09-25): [4.x] Fix Java codegen referencing unavaiable symbols (@martinbonnin)
- **PR #7031** (2026-09-25): Fix JavaCodegen referencing inexistant symbols (@martinbonnin)
- **PR #7030** (2026-09-16): Bump version to 5.2.1 SNAPSHOT (@martinbonnin)
- **PR #7029** (2026-09-16): Version is now 5.2.0-SNAPSHOT (@martinbonnin)
- **PR #7028** (2026-09-16): Default to allowing empty selection sets (@martinbonnin)
- **PR #7027** (2026-09-16): Fix @catch handling of malformed response data (@AvikMakwana)
- **PR #7026** (2026-09-14): Add exposeServiceCapabilities (@martinbonnin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
