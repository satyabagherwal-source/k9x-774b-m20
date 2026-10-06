# Forensic Learning Record (Deep Inspection): vanniktech/gradle-maven-publish-plugin

> **Canonical Artifact**: `07_PROJECT_LEARNING/vanniktech-gradle-maven-publish-plugin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vanniktech/gradle-maven-publish-plugin](https://github.com/vanniktech/gradle-maven-publish-plugin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:31:50.695Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vanniktech/gradle-maven-publish-plugin`
- **Description**: A Gradle plugin that publishes your Android and Kotlin libraries, including sources and javadoc,  to Maven Central or any other Nexus instance.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1749 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `central-portal/src/main/kotlin/com/vanniktech/maven/publish/portal/DeploymentStatus.kt`
```
package com.vanniktech.maven.publish.portal

/**
 * Response from the Central Portal API status endpoint.
 * See https://central.sonatype.org/publish/publish-portal-api/#verify-status-of-the-deployment
 */
internal data class DeploymentStatusResponse(
  val deploymentId: String,
  val deploymentName: String,
  val deploymentState: DeploymentState,
  val purls: List<String>? = null,
  val errors: Map<String, List<String>>? = null,
)

/**
 * Possible states of a deployment in Maven Central.
 */
internal enum class DeploymentState {
  /**
   * A deployment is uploaded and waiting for processing by the validation service
   */
  PENDING,

  /**
   * A deployment is being processed by the validation service
   */
  VALIDATING,

  /**
   * A deployment has passed validation and is waiting on a user to manually publish via the Central Portal UI
   */
  VALIDATED,

  /**
   * A deployment has been either automatically or manually published and is being uploaded to Maven Central
   */
  PUBLISHING,

  /**
   * A deployment has successfully been uploaded to Maven Central
   */
  PUBLISHED,

  /**
   * A deployment has encountered an error (additional context will be present in an errors field)
   */
  FAILED,
}

```

### Core Architecture Module: `central-portal/src/main/kotlin/com/vanniktech/maven/publish/portal/SonatypeCentralPortal.kt`
```
package com.vanniktech.maven.publish.portal

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.time.Duration.Companion.seconds
import kotlin.time.ExperimentalTime
import kotlin.time.TimeSource
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.asRequestBody
import org.slf4j.Logger
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.converter.scalars.ScalarsConverterFactory

public class SonatypeCentralPortal(
  private val baseUrl: String,
  private val usertoken: String,
  userAgentName: String,
  userAgentVersion: String,
  okhttpTimeoutSeconds: Long,
  private val closeTimeoutSeconds: Long,
  private val pollIntervalMs: Long,
  private val logger: Logger,
) {
  private val service by lazy {
    val moshi = Moshi
      .Builder()
      .add(KotlinJsonAdapterFactory())
      .build()

    val okHttpClient = OkHttpClient
      .Builder()
      .addInterceptor(SonatypeCentralPortalOkHttpInterceptor(usertoken, userAgentName, userAgentVersion))
      .connectTimeout(okhttpTimeoutSeconds, TimeUnit.SECONDS)
      .readTimeout(okhttpTimeoutSeconds, TimeUnit.SECONDS)
      .writeTimeout(okhttpTimeoutSeconds, TimeUnit.SECONDS)
      .build()
    val retrofit = Retrofit
      .Builder()
      .client(okHttpClient)
      .baseUrl(baseUrl)
      .addConverterFactory(ScalarsConverterFactory.create())
      .addConverterFactory(MoshiConverterFactory.create(moshi))
      .build()

    retrofit.create(SonatypeCentralPortalService::class.java)
  }

  public fun deleteDeployment(deploymentId: String) {
    val deleteDeploymentResponse = service.deleteDeployment(deploymentId).execute()
    if (!deleteDeploymentResponse.isSuccessful) {
      throw IOException(
        "Failed to delete deploymentId $deploymentId code: ${deleteDeploymentResponse.code()} msg: ${
          deleteDeploymentResponse.errorBody()?.string()
        }",
      )
    }
  }

  public fun publishDeployment(deploymentId: String) {
    val publishDeploymentResponse = service.publishDeployment(deploymentId).execute()
    if (!publishDeploymentResponse.isSuccessful) {
      throw IOException(
        "Failed to delete deploymentId $deploymentId code: ${publishDeploymentResponse.code()} msg: ${
          publishDeploymentResponse.errorBody()?.string()
        }",
      )
    }
  }

  public fun upload(name: String, publishingType: PublishingType, file: File): String {
    val uploadFile = file.asRequestBody("application/octet-stream".toMediaType())
    val multipart = MultipartBody.Part.createFormData("bundle", file.name, uploadFile)
    val uploadResponse = service.uploadBundle(name, publishingType, multipart).execute()
    if (uploadResponse.isSuccessful) {
      return checkNotNull(uploadResponse.body())
    } else {
      throw IOException("Upload failed: ${uploadResponse.errorBody()?.string()}")
    }
  }

  /**
   * Validates the deployment by polling its status until it reaches `PUBLISHED` or `FAILED`.
   *
   * @param deploymentId The ID of the deployment to validate
   * @param logger An SLF4J logger instance for logging deployment status updates
   * @throws IOException if the deployment fails validation or an API error occurs
   */
  @OptIn(ExperimentalTime::class)
  public fun validateDeployment(deploymentId: String, waitForPublishing: Boolean) {
    val startMark = TimeSource.Monotonic.markNow()
    val timeout = closeTimeoutSeconds.seconds
    var lastState: DeploymentState? = null

    logger.warn("Validating deployment $deploymentId...")

    while (startMark.elapsedNow() < timeout) {
      val statusResponse = service.checkDeploymentStatus(deploymentId).execute()

      if (!statusResponse.isSuccessful) {
        throw IOException(
          "Failed to check deployment status for $deploymentId code: ${statusResponse.code()} msg: ${
            statusResponse.errorBody()?.string()
          }",
        )
      }

      val status = checkNotNull(statusResponse.body()) {
        "Status response body is null for deployment $deploymentId"
      }

      if (status.deploymentState != lastState) {
        lastState = status.deploymentState

        when (status.deploymentState) {
          DeploymentState.PENDING -> {
            logger.warn("Deployment is pending validation")
          }

          DeploymentState.VALIDATING -> {
            logger.warn("Deployment is being validated")
          }

          DeploymentState.VALIDATED -> {
            logger.warn("Deployment has been validated successfully")
            if (!waitForPublishing) {
              return
            }
          }

          DeploymentState.PUBLISHING -> {
            logger.warn("Deployment is being published to Maven Central")
            if (!waitForPublishing) {
              return
            }
          }

          DeploymentState.PUBLISHED -> {
            logger.warn("Deployment has been published to Maven Central")
            return
          }

          DeploymentState.FAILED -> {
            val errorMessages =
              status.errors?.entries?.joinToString("\n") { (publication, errors) ->
                buildString {
                  appendLine("Publication $publication:")
                  errors.forEach { error ->
                    appendLine("* $error")
                  }
                }
              } ?: "No error details available"

            throw IOException(
              "Deployment $deploymentId failed validation:\n$errorMessages",
            )
          }
        }
      }

      Thread.sleep(pollIntervalMs)
    }

    throw IOException(
      "Deployment validation timed out after ${closeTimeoutSeconds}s. " +
        "Last known state: ${lastState ?: "UNKNOWN"}",
    )
  }

  public enum class PublishingType {
    AUTOMATIC,
    USER_MANAGED,
  }
}

```

### Core Architecture Module: `central-portal/src/main/kotlin/com/vanniktech/maven/publish/portal/SonatypeCentralPortalOkHttpInterceptor.kt`
```
package com.vanniktech.maven.publish.portal

import okhttp3.Interceptor
import okhttp3.Response

internal class SonatypeCentralPortalOkHttpInterceptor(
  private val usertoken: String,
  private val userAgentName: String,
  private val userAgentVersion: String,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val requestBuilder = chain.request().newBuilder()

    requestBuilder.addHeader("Accept", "application/json") // request json by default, XML is returned else
    requestBuilder.addHeader("Authorization", "Bearer $usertoken")
    requestBuilder.addHeader("User-Agent", "$userAgentName/$userAgentVersion")

    return chain.proceed(requestBuilder.build())
  }
}

```

### Core Architecture Module: `central-portal/src/main/kotlin/com/vanniktech/maven/publish/portal/SonatypeCentralPortalService.kt`
```
package com.vanniktech.maven.publish.portal

import okhttp3.MultipartBody
import retrofit2.Call
import retrofit2.http.DELETE
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Sonatype Central Portal Publishing based on https://central.sonatype.org/publish/publish-portal-api/
 */
internal interface SonatypeCentralPortalService {
  @DELETE("api/v1/publisher/deployment/{deploymentId}")
  fun deleteDeployment(
    @Path("deploymentId") deploymentId: String,
  ): Call<Unit>

  @POST("api/v1/publisher/deployment/{deploymentId}")
  fun publishDeployment(
    @Path("deploymentId") deploymentId: String,
  ): Call<Unit>

  @Multipart
  @POST("api/v1/publisher/upload")
  fun uploadBundle(
    @Query("name") name: String,
    @Query("publishingType") publishingType: SonatypeCentralPortal.PublishingType,
    @Part input: MultipartBody.Part,
  ): Call<String>

  @POST("api/v1/publisher/status")
  fun checkDeploymentStatus(
    @Query("id") deploymentId: String,
  ): Call<DeploymentStatusResponse>
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/Checksum.kt`
```
package com.vanniktech.maven.publish

/**
 * Checksum types that Gradle generates for published files. [SHA256] and [SHA512] are not read by Gradle or
 * Maven Central and are therefore not published by default.
 */
public enum class Checksum(
  internal val extension: String,
) {
  MD5("md5"),
  SHA1("sha1"),
  SHA256("sha256"),
  SHA512("sha512"),
  ;

  internal companion object {
    val DEFAULT: List<Checksum> = listOf(MD5, SHA1)

    fun fromExtension(extension: String): Checksum = entries.firstOrNull { it.extension == extension }
      ?: throw IllegalArgumentException(
        "Unknown checksum \"$extension\". Valid values are: ${entries.joinToString { it.extension }}.",
      )
  }
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/DeploymentValidation.kt`
```
package com.vanniktech.maven.publish

public enum class DeploymentValidation {
  NONE,
  VALIDATED,
  PUBLISHED,
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/MavenPublishBaseExtension.kt`
```
package com.vanniktech.maven.publish

import com.vanniktech.maven.publish.central.DropMavenCentralDeploymentTask.Companion.registerDropMavenCentralDeploymentTask
import com.vanniktech.maven.publish.central.EnableAutomaticMavenCentralPublishingTask.Companion.registerEnableAutomaticMavenCentralPublishingTask
import com.vanniktech.maven.publish.central.MavenCentralBuildService.Companion.registerMavenCentralBuildService
import com.vanniktech.maven.publish.central.PrepareMavenCentralPublishingTask.Companion.registerPrepareMavenCentralPublishingTask
import com.vanniktech.maven.publish.workaround.DirectorySignatureType
import javax.inject.Inject
import org.gradle.api.Action
import org.gradle.api.Incubating
import org.gradle.api.Project
import org.gradle.api.configuration.BuildFeatures
import org.gradle.api.credentials.PasswordCredentials
import org.gradle.api.plugins.ExtraPropertiesExtension
import org.gradle.api.provider.Property
import org.gradle.api.provider.SetProperty
import org.gradle.api.publish.maven.MavenPom
import org.gradle.api.publish.maven.MavenPublication
import org.gradle.api.publish.maven.tasks.PublishToMavenRepository
import org.gradle.build.event.BuildEventsListenerRegistry
import org.gradle.plugins.signing.Sign
import org.gradle.plugins.signing.SigningPlugin
import org.gradle.plugins.signing.type.pgp.ArmoredSignatureType

public abstract class MavenPublishBaseExtension @Inject constructor(
  private val project: Project,
  private val buildEventsListenerRegistry: BuildEventsListenerRegistry,
  private val buildFeatures: BuildFeatures,
) {
  private val mavenCentral: Property<Boolean> = project.objects.property(Boolean::class.java)
  private val signing: Property<Boolean> = project.objects.property(Boolean::class.java)
  internal val groupId: Property<String> = project.objects
    .property(String::class.java)
    .convention(project.provider { project.group.toString() })
  internal val artifactId: Property<String> = project.objects
    .property(String::class.java)
    .convention(project.provider { project.name.toString() })
  internal val version: Property<String> = project.objects
    .property(String::class.java)
    .convention(project.provider { project.version.toString() })
  private val pomFromProperties: Property<Boolean> = project.objects.property(Boolean::class.java)
  private val platform: Property<Platform> = project.objects.property(Platform::class.java)
  private val excludeSignatureChecksums: Property<Boolean> = project.objects
    .property(Boolean::class.java)
    .convention(project.provider { project.excludeSignatureChecksums() })
  private val checksums: SetProperty<Checksum> = project.objects
    .setProperty(Checksum::class.java)
    .convention(project.provider { project.checksums() })

  /**
   * Sets up Maven Central publishing through Sonatype OSSRH by configuring the target repository. Gradle will then
   * automatically create a `publishAllPublicationsToMavenCentralRepository` task as well as include it in the general
   * `publish` task.
   *
   * When the [automaticRelease] parameter is `true` the created deployment will be released automatically to
   * Maven Central without any additional manual steps needed. When [automaticRelease] is not set or `false`
   * the deployment has to be manually released through the [Central Portal website](https://central.sonatype.com/publishing/deployments).
   *
   * If the current version ends with `-SNAPSHOT` the artifacts will be published to Sonatype's snapshot
   * repository instead.
   *
   * This expects you provide the username and password of a user token through Gradle properties called
   * `mavenCentralUsername` and `mavenCentralPassword`. See [here](https://central.sonatype.org/publish/generate-portal-token/)
   * for how to obtain a user token.
   *
   * When [validateDeployment] is `true` (the default), the plugin will monitor the deployment status after upload
   * and wait until it reaches a terminal state (`PUBLISHED` or `FAILED`). Deployment validation only happens
   * when [automaticRelease] is `true`.
   *
   * @param automaticRelease whether a non SNAPSHOT build should be released automatically at the end of the build
   * @param validateDeployment whether to wait for the deployment to be validated and published at the end of the build
   */
  @Deprecated("Use publishToMavenCentral with DeploymentValidation instead of Boolean")
  public fun publishToMavenCentral(automaticRelease: Boolean, validateDeployment: Boolean) {
    publishToMavenCentral(
      automaticRelease = automaticRelease,
      validateDeployment = if (validateDeployment) DeploymentValidation.VALIDATED else DeploymentValidation.NONE,
    )
  }

  /**
   * Sets up Maven Central publishing through Sonatype OSSRH by configuring the target repository. Gradle will then
   * automatically create a `publishAllPublicationsToMavenCentralRepository` task as well as include it in the general
   * `publish` task.
   *
   * When the [automaticRelease] parameter is `true` the created deployment will be released automatically to
   * Maven Central without any additional manual steps needed. When [automaticRelease] is not set or `false`
   * the deployment has to be manually released through the [Central Portal website](https://central.sonatype.com/publishing/deployments).
   *
   * If the current version ends with `-SNAPSHOT` the artifacts will be published to Sonatype's snapshot
   * repository instead.
   *
   * This expects you provide the username and password of a user token through Gradle properties called
   * `mavenCentralUsername` and `mavenCentralPassword`. See [here](https://central.sonatype.org/publish/generate-portal-token/)
   * for how to obtain a user token.
   *
   * When [validateDeployment] is `PUBLISH` (the default), the plugin will monitor the deployment status after upload
   * and wait until it reaches a terminal state (`PUBLISHED` or `FAILED`). Setting it to `VALIDATE` will wait for the
   * Central Portal validations to succeed but not until the publishing process finished. Deployment validation only
   * happens when [automaticRelease] is `true`.
   *
   * @param automaticRelease whether a non SNAPSHOT build should be released automatically at the end of the build
   * @param validateDeployment whether to wait for the deployment to be validated and published at the end of the build
   */
  @JvmOverloads
  public fun publishToMavenCentral(
    automaticRelease: Boolean = project.automaticRelease(),
    validateDeployment: DeploymentValidation = project.validateDeployment(),
  ) {
    mavenCentral.set(true)
    mavenCentral.finalizeValue()

    val localRepository = project.layout.buildDirectory.dir("publishing/mavenCentral")
    val versionIsSnapshot = version.map { it.endsWith("-SNAPSHOT") }

    val repository = project.gradlePublishing.repositories.maven { repo ->
      repo.name = "mavenCentral"
    }

    project.afterEvaluate {
      if (versionIsSnapshot.get()) {
        repository.setUrl("https://central.sonatype.com/repository/maven-snapshots/")
        repository.credentials(PasswordCredentials::class.java)
      } else {
        repository.setUrl(localRepository.get().asFile)
      }
    }

    val buildService = project.registerMavenCentralBuildService(
      repositoryUsername = project.providers.gradleProperty("mavenCentralUsername"),
      repositoryPassword = project.providers.gradleProperty("mavenCentralPassword"),
      rootBuildDirectory = @Suppress("UnstableApiUsage") project.layout.settingsDirectory.dir("build"),
      buildEventsListenerRegistry = buildEventsListenerRegistry,
    )

    val prepareTask = project.tasks.registerPrepareMavenCentralPublishingTask(
      buildService,
      groupId,
      artifactId,
      version,
      localRepository,
      excludeSignatureChecksums,
      checksums.map { checksums -> checksums.map { it.extension }.toSet() },
    )
    val enableAutomaticTask = project.tasks.registerEnableAutomaticMavenCentralPublishingTask(buildService, validateDeployment)

    project.tasks.withType(PublishToMavenRepository::class.java).configureEach { publishTask ->
      if (publishTask.name.endsWith("ToMavenCentralRepository")) {
        publishTask.dependsOn(prepareTask)
        if (automaticRelease) {
          publishTask.dependsOn(enableAutomaticTask)
        }
      }
    }

    project.tasks.register("publishToMavenCentral") {
      it.description = "Publishes to Maven Central"
      it.group = "publishing"
      it.dependsOn(project.tasks.named("publishAllPublicationsToMavenCentralRepository"))
    }
    project.tasks.register("publishAndReleaseToMavenCentral") {
      it.description = "Publishes to Maven Central and automatically triggers release"
      it.group = "publishing"
      it.dependsOn(project.tasks.named("publishAllPublicationsToMavenCentralRepository"))
      it.dependsOn(enableAutomaticTask)
    }

    project.tasks.registerDropMavenCentralDeploymentTask(buildService)
  }

  /**
   * Controls whether checksum files for signature (`.asc`) files are excluded when publishing to Maven Central.
   *
   * Gradle generates `.asc.md5`, `.asc.sha1`, `.asc.sha256` and `.asc.sha512` files for every signature, but these
   * are not needed by Maven Central. See [gradle/gradle#20232](https://github.com/gradle/gradle/issues/20232).
   *
   * This is enabled by default and can also be controlled through the `mavenCentralExcludeSignatureChecksums`
   * Gradle property.
   *
   * @param exclude whether to exclude signature checksum files from the deployment
   */
  @JvmOverloads
  public fun excludeSignatureChecksums(exclude: Boolean = true) {
    excludeSignatureChecksums.set(exclude)
    excludeSignatureChecksums.finalizeValue()
  }

  /**
   * Sets which checksum files are published to Maven Central.
   *
   * Gradle generates [Checksum.MD5], [Checksum.SHA1], [Checksum.SHA256] and [Checksum.SHA512] checksums for every
   * published file, but neither Gradle nor Maven Central read the 
```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/MavenPublishBasePlugin.kt`
```
package com.vanniktech.maven.publish

import com.vanniktech.maven.publish.BuildConfig.ANDROID_GRADLE_MIN
import com.vanniktech.maven.publish.BuildConfig.KOTLIN_MIN
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.publish.maven.plugins.MavenPublishPlugin as GradleMavenPublishPlugin

public abstract class MavenPublishBasePlugin : Plugin<Project> {
  override fun apply(project: Project) {
    project.plugins.apply(GradleMavenPublishPlugin::class.java)

    project.checkMinimumVersions()

    project.extensions.create("mavenPublishing", MavenPublishBaseExtension::class.java, project)
  }

  private fun Project.checkMinimumVersions() {
    plugins.withId("com.android.library") {
      try {
        if (!isAtLeastAgp(ANDROID_GRADLE_MIN)) {
          error("You need AGP version $ANDROID_GRADLE_MIN or newer")
        }
      } catch (t: Throwable) {
        throw IllegalStateException(
          "Make sure the AGP version $ANDROID_GRADLE_MIN or newer is applied." +
            "Otherwise, detected Android Library plugin but was not able to access AGP classes. Please make sure " +
            "that the Android plugin and the publish plugin are applied to the same project. In many cases this means " +
            "you need to add both the root project with `apply false`.",
          t,
        )
      }
    }
    KOTLIN_PLUGIN_IDS.forEach { pluginId ->
      plugins.withId(pluginId) {
        try {
          if (!isAtLeastKgp(pluginId, KOTLIN_MIN)) {
            error("You need Kotlin version $KOTLIN_MIN or newer")
          }
        } catch (t: Throwable) {
          throw IllegalStateException(
            "Make sure the Kotlin version $KOTLIN_MIN or newer is applied." +
              "Otherwise, detected Kotlin plugin $pluginId but was not able to access Kotlin plugin classes. Please make sure " +
              "that the Kotlin plugin and the publish plugin are applied to the same project. In many cases this means " +
              "you need to add both the root project with `apply false`.",
            t,
          )
        }
      }
    }
  }

  private companion object {
    val KOTLIN_PLUGIN_IDS = listOf(
      "org.jetbrains.kotlin.jvm",
      "org.jetbrains.kotlin.multiplatform",
    )
  }
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/MavenPublishPlugin.kt`
```
package com.vanniktech.maven.publish

import org.gradle.api.Plugin
import org.gradle.api.Project

public abstract class MavenPublishPlugin : Plugin<Project> {
  override fun apply(project: Project) {
    project.plugins.apply(MavenPublishBasePlugin::class.java)
    val baseExtension = project.baseExtension

    if (project.mavenCentralPublishing()) {
      baseExtension.publishToMavenCentral(
        project.automaticRelease(),
        project.validateDeployment(),
      )
    }

    if (project.signAllPublications()) {
      baseExtension.signAllPublications()
    }

    baseExtension.pomFromGradleProperties()

    // afterEvaluate is too late for AGP which doesn't allow configuration after finalizeDsl
    project.plugins.withId("com.android.library") {
      project.androidComponents.finalizeDsl {
        baseExtension.configureBasedOnAppliedPlugins()
      }
    }
    project.plugins.withId("com.android.fused-library") {
      baseExtension.configureBasedOnAppliedPlugins()
    }

    project.afterEvaluate {
      // will no-op if it was already called
      baseExtension.configureBasedOnAppliedPlugins()
    }
  }
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/Platform.kt`
```
package com.vanniktech.maven.publish

import com.android.build.api.AndroidPluginVersion
import com.android.build.api.dsl.LibraryExtension
import com.vanniktech.maven.publish.tasks.JavadocJar.Companion.javadocJarTask
import com.vanniktech.maven.publish.tasks.JavadocJar.Companion.prefixedTaskName
import com.vanniktech.maven.publish.tasks.JavadocJar.Companion.updateArchivesBaseNameWithPrefix
import com.vanniktech.maven.publish.workaround.addTestFixturesSourcesJar
import com.vanniktech.maven.publish.workaround.fixTestFixturesMetadata
import org.gradle.api.Incubating
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.api.provider.Provider
import org.gradle.api.publish.maven.MavenPublication
import org.gradle.api.tasks.TaskProvider
import org.gradle.jvm.tasks.Jar
import org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension
import org.jetbrains.kotlin.gradle.plugin.mpp.KotlinAndroidTarget

/**
 * Represents a platform that the plugin supports to publish. For example [JavaLibrary], [AndroidMultiVariantLibrary] or
 * [KotlinMultiplatform]. When a platform is configured through [MavenPublishBaseExtension.configure] the plugin
 * will automatically set up the artifacts that should get published, including javadoc and sources jars depending
 * on the option.
 */
public sealed class Platform {
  public abstract val javadocJar: JavadocJar
  public abstract val sourcesJar: SourcesJar

  internal abstract fun configure(project: Project)
}

/**
 * To be used for `java` and `java-library` projects. Applying this creates a publication for the component called
 * `java`. Depending on the passed parameters for [javadocJar] and [sourcesJar], `-javadoc` and `-sources` jars will
 * be added to the publication.
 *
 * Equivalent Gradle set up:
 * ```
 * publishing {
 *   publications {
 *     create<MavenPublication>("maven") {
 *       from(components["java"])
 *     }
 *   }
 * }
 *
 * java {
 *   withSourcesJar()
 *   withJavadocJar()
 * }
 ```
 */
public data class JavaLibrary @JvmOverloads constructor(
  override val javadocJar: JavadocJar = JavadocJar.Empty(),
  override val sourcesJar: SourcesJar = SourcesJar.Sources(),
) : Platform() {
  @Deprecated("Use constructor with SourcesJar instead of Boolean")
  public constructor(
    javadocJar: JavadocJar = JavadocJar.Empty(),
    sourcesJar: Boolean,
  ) : this(
    javadocJar = javadocJar,
    sourcesJar = if (sourcesJar) SourcesJar.Sources() else SourcesJar.Empty(),
  )

  override fun configure(project: Project) {
    check(project.plugins.hasPlugin("java") || project.plugins.hasPlugin("java-library")) {
      "Calling configure(JavaLibrary(...)) requires the java-library plugin to be applied"
    }

    project.gradlePublishing.publications.create(PUBLICATION_NAME, MavenPublication::class.java) {
      it.from(project.components.getByName("java"))
      it.withJavaSourcesJar(sourcesJar, project, multipleTasks = false)
      it.withJavadocJar(javadocJar, project, multipleTasks = false)
    }

    setupTestFixtures(project, sourcesJar)
  }
}

/**
 * To be used for `java-gradle-plugin` projects. Uses the default publication that gets created by that plugin.
 * Depending on the passed parameters for [javadocJar] and [sourcesJar], `-javadoc` and `-sources` jars will be added to
 * the publication.
 *
 * Equivalent Gradle set up:
 * ```
 * java {
 *   withSourcesJar()
 *   withJavadocJar()
 * }
```
 */
public data class GradlePlugin @JvmOverloads constructor(
  override val javadocJar: JavadocJar = JavadocJar.Empty(),
  override val sourcesJar: SourcesJar = SourcesJar.Sources(),
) : Platform() {
  @Deprecated("Use constructor with SourcesJar instead of Boolean")
  public constructor(
    javadocJar: JavadocJar = JavadocJar.Empty(),
    sourcesJar: Boolean,
  ) : this(
    javadocJar = javadocJar,
    sourcesJar = if (sourcesJar) SourcesJar.Sources() else SourcesJar.Empty(),
  )

  override fun configure(project: Project) {
    check(project.plugins.hasPlugin("java-gradle-plugin")) {
      "Calling configure(GradlePlugin(...)) requires the java-gradle-plugin to be applied"
    }

    project.mavenPublicationsWithoutPluginMarker {
      it.withJavaSourcesJar(sourcesJar, project, multipleTasks = false)
      it.withJavadocJar(javadocJar, project, multipleTasks = false)
    }
  }
}

/**
 * To be used for `com.gradle.plugin-publish` projects. Uses the default publication that gets created by that plugin.
 */
public class GradlePublishPlugin : Platform() {
  override val javadocJar: JavadocJar = JavadocJar.Javadoc()
  override val sourcesJar: SourcesJar = SourcesJar.Sources()

  override fun configure(project: Project) {
    check(project.plugins.hasPlugin("com.gradle.plugin-publish")) {
      "Calling configure(GradlePublishPlugin()) requires the com.gradle.plugin-publish plugin to be applied"
    }

    // setup is fully handled by com.gradle.plugin-publish already
  }

  override fun equals(other: Any?): Boolean = other is GradlePublishPlugin

  override fun hashCode(): Int = this::class.hashCode()
}

/**
 * To be used for `com.android.library` projects. Applying this creates a publication for the component of the given
 * `variant`. Depending on the passed parameters for [javadocJar] and [sourcesJar], `-javadoc` and `-sources` jars will
 * be added to the publication.
 *
 * Equivalent Gradle set up:
 * ```
 * android {
 *   publishing {
 *    singleVariant("variant") {
 *      withSourcesJar()
 *      withJavadocJar()
 *    }
 *   }
 * }
 *
 * afterEvaluate {
 *   publishing {
 *     publications {
 *       create<MavenPublication>("variant") {
 *         from(components["variant"])
 *       }
 *     }
 *   }
 * }
 *```
 */
public data class AndroidSingleVariantLibrary @JvmOverloads constructor(
  override val javadocJar: JavadocJar = JavadocJar.Empty(),
  override val sourcesJar: SourcesJar = SourcesJar.Sources(),
  val variant: String = "release",
) : Platform() {
  @JvmOverloads
  @Deprecated("Use constructor with JavadocJar and SourcesJar instead of Boolean")
  public constructor(
    variant: String = "release",
    sourcesJar: Boolean = true,
    publishJavadocJar: Boolean,
  ) : this(
    javadocJar = if (publishJavadocJar) JavadocJar.Javadoc() else JavadocJar.None(),
    sourcesJar = if (sourcesJar) SourcesJar.Sources() else SourcesJar.Empty(),
    variant = variant,
  )

  override fun configure(project: Project) {
    check(project.plugins.hasPlugin("com.android.library")) {
      "Calling configure(AndroidSingleVariantLibrary(...)) requires the com.android.library plugin to be applied"
    }

    val library = project.extensions.findByType(LibraryExtension::class.java)!!
    library.publishing {
      singleVariant(variant) {
        if (sourcesJar is SourcesJar.Sources) {
          withSourcesJar()
        }
        if (javadocJar is JavadocJar.Javadoc) {
          withJavadocJar()
        }
      }
    }

    project.afterEvaluate {
      val component = project.components.findByName(variant) ?: throw MissingVariantException(variant)
      project.gradlePublishing.publications.create(PUBLICATION_NAME, MavenPublication::class.java) {
        it.from(component)

        if (javadocJar !is JavadocJar.Javadoc) {
          it.withJavadocJar(javadocJar, project, multipleTasks = false)
        }
        if (sourcesJar !is SourcesJar.Sources) {
          it.withJavaSourcesJar(sourcesJar, project, multipleTasks = false)
        }
      }
    }
  }
}

/**
 * To be used for `com.android.library` projects. Applying this creates a publication for the component of the given
 * variants. Depending on the passed parameters for [javadocJar] and [sourcesJar], `-javadoc` and `-sources` jars will
 * be added to the publication.
 *
 * If the [includedBuildTypeValues] and [includedFlavorDimensionsAndValues] parameters are not provided or
 * empty all variants will be published. Otherwise, only variants matching those filters will be included.
 *
 * Equivalent Gradle set up (AGP 7.1.1):
 * ```
 * android {
 *   publishing {
 *    multipleVariants {
 *      allVariants() // or calls to includeBuildTypeValues and includeFlavorDimensionAndValues
 *      withSourcesJar()
 *      withJavadocJar()
 *    }
 *   }
 * }
 *
 * afterEvaluate {
 *   publishing {
 *     publications {
 *       create<MavenPublication>("default") {
 *         from(components["default"])
 *       }
 *     }
 *   }
 * }
 * ```
 */
public data class AndroidMultiVariantLibrary @JvmOverloads constructor(
  override val javadocJar: JavadocJar = JavadocJar.Empty(),
  override val sourcesJar: SourcesJar = SourcesJar.Sources(),
  val includedBuildTypeValues: Set<String> = emptySet(),
  val includedFlavorDimensionsAndValues: Map<String, Set<String>> = emptyMap(),
) : Platform() {
  @JvmOverloads
  @Deprecated("Use constructor with JavadocJar and SourcesJar instead of Boolean")
  public constructor(
    sourcesJar: Boolean,
    publishJavadocJar: Boolean = true,
    includedBuildTypeValues: Set<String> = emptySet(),
    includedFlavorDimensionsAndValues: Map<String, Set<String>> = emptyMap(),
  ) : this(
    javadocJar = if (publishJavadocJar) JavadocJar.Javadoc() else JavadocJar.None(),
    sourcesJar = if (sourcesJar) SourcesJar.Sources() else SourcesJar.Empty(),
    includedBuildTypeValues = includedBuildTypeValues,
    includedFlavorDimensionsAndValues = includedFlavorDimensionsAndValues,
  )

  override fun configure(project: Project) {
    check(project.plugins.hasPlugin("com.android.library")) {
      "Calling configure(AndroidMultiVariantLibrary(...)) requires the com.android.library plugin to be applied"
    }

    val library = project.extensions.findByType(LibraryExtension::class.java)!!
    library.publishing {
      multipleVariants(PUBLICATION_NAME) {
        if (includedBuildTypeValues.isEmpty() && includedFlavorDimensionsAndValues.isEmpty()) {
          allVariants()
        } else {
          if (includedBuildTypeValues.isNotEmpty()) {
            includeBuildTypeVa
```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/ProjectExtensions.kt`
```
@file:Suppress("UnstableApiUsage")

package com.vanniktech.maven.publish

import com.android.build.api.AndroidPluginVersion
import com.android.build.api.variant.AndroidComponentsExtension
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.publish.PublishingExtension
import org.gradle.api.publish.maven.MavenPublication
import org.gradle.plugins.signing.SigningExtension
import org.jetbrains.kotlin.gradle.plugin.KotlinBasePlugin
import org.jetbrains.kotlin.tooling.core.KotlinToolingVersion

internal inline val Project.baseExtension: MavenPublishBaseExtension
  get() = extensions.getByType(MavenPublishBaseExtension::class.java)

internal inline val Project.gradleSigning: SigningExtension
  get() = extensions.getByType(SigningExtension::class.java)

internal inline val Project.gradlePublishing: PublishingExtension
  get() = extensions.getByType(PublishingExtension::class.java)

internal inline val Project.androidComponents: AndroidComponentsExtension<*, *, *>
  get() = extensions.getByType(AndroidComponentsExtension::class.java)

internal fun Project.mavenPublications(action: Action<MavenPublication>) {
  gradlePublishing.publications.withType(MavenPublication::class.java).configureEach(action)
}

internal fun Project.mavenPublicationsWithoutPluginMarker(action: Action<MavenPublication>) {
  mavenPublications {
    if (!it.name.endsWith("PluginMarkerMaven")) {
      action.execute(it)
    }
  }
}

internal fun Project.isAtLeastKgp(id: String, version: String): Boolean {
  val actual = (plugins.getPlugin(id) as KotlinBasePlugin).pluginVersion
  return KotlinToolingVersion(actual) >= KotlinToolingVersion(version)
}

internal fun isAtLeastAgp(version: String): Boolean {
  // Drop everything after '-' to ignore rc/beta/alpha suffixes. If you want to compare those, use the rc/beta/alpha functions in AndroidPluginVersion.
  val (major, minor, patch) = version.takeWhile { it != '-' }.split(".").map { it.toInt() }
  return AndroidPluginVersion.getCurrent() >= AndroidPluginVersion(major, minor, patch)
}

```

### Core Architecture Module: `plugin/src/main/kotlin/com/vanniktech/maven/publish/Properties.kt`
```
package com.vanniktech.maven.publish

import kotlin.text.toBoolean
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import org.gradle.api.Project
import org.gradle.api.provider.Provider

internal fun Project.mavenCentralPublishing(): Boolean {
  val central = providers.gradleProperty("mavenCentralPublishing").orNull
  if (central != null) {
    return central.toBoolean()
  }
  return when (providers.gradleProperty("SONATYPE_HOST").orNull) {
    null -> false

    "CENTRAL_PORTAL" -> true

    else -> error(
      """
      OSSRH was shut down on June 30, 2025. Migrate to CENTRAL_PORTAL instead.
      See more info at https://central.sonatype.org/news/20250326_ossrh_sunset.
      """.trimIndent(),
    )
  }
}

internal fun Project.automaticRelease(): Boolean {
  val automatic = providers.gradleProperty("mavenCentralAutomaticPublishing").orNull
  if (automatic != null) {
    return automatic.toBoolean()
  }
  return providers.gradleProperty("SONATYPE_AUTOMATIC_RELEASE").getOrElse("false").toBoolean()
}

internal fun Project.validateDeployment(): DeploymentValidation {
  val automatic = providers.gradleProperty("mavenCentralDeploymentValidation").orNull
  if (automatic != null) {
    return automatic.toDeploymentValidation()
  }
  return providers.gradleProperty("SONATYPE_DEPLOYMENT_VALIDATION").getOrElse("VALIDATED").toDeploymentValidation()
}

private fun String.toDeploymentValidation() = when (this) {
  "true" -> DeploymentValidation.VALIDATED
  "false" -> DeploymentValidation.NONE
  else -> DeploymentValidation.valueOf(this)
}

internal fun Project.excludeSignatureChecksums(): Boolean {
  val exclude = providers.gradleProperty("mavenCentralExcludeSignatureChecksums").orNull
  if (exclude != null) {
    return exclude.toBoolean()
  }
  return true
}

internal fun Project.checksums(): List<Checksum> {
  val checksums = providers.gradleProperty("mavenCentralChecksums").orNull
  if (checksums != null) {
    return checksums
      .split(",")
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .map { Checksum.fromExtension(it) }
  }
  return Checksum.DEFAULT
}

internal fun Project.signAllPublications(): Boolean {
  val sign = providers.gradleProperty("signAllPublications").orNull
  if (sign != null) {
    return sign.toBoolean()
  }
  return providers.gradleProperty("RELEASE_SIGNING_ENABLED").getOrElse("false").toBoolean()
}

internal fun Project.connectTimeout(): Provider<Duration> = providers
  .gradleProperty("SONATYPE_CONNECT_TIMEOUT_SECONDS")
  .map { it.toLong().seconds }
  .orElse(60.seconds)

internal fun Project.closeTimeout(): Provider<Duration> = providers
  .gradleProperty("SONATYPE_CLOSE_TIMEOUT_SECONDS")
  .map { it.toLong().seconds }
  .orElse(15.minutes)

internal fun Project.pollIntervalSeconds(): Provider<Duration> = providers
  .gradleProperty("SONATYPE_POLL_INTERVAL_SECONDS")
  .map { it.toLong().seconds }
  .orElse(5.seconds)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1139** (2025-09-29): **Gradle 9.2 incompatibility**
  *Symptoms*: Using 9.2.0-milestone-1 with https://github.com/sqldelight/sql-psi  ``` Caused by: java.lang.NoSuchMethodError: 'org.gradle.api.artifacts.Configuration org.gradle.api.plugins.internal.JvmPluginsHelper.createDocumentationVariantWithArtifact(java.lang.String, java.lang.String, java.lang.String, java.util.Set, java.lang.String, java.lang.Object, org.gradle.api.internal.project.ProjectInternal)' 	at com.vanniktech.maven.publish.workaround.TestFixturesKt.addTestFixturesSourcesJar(TestFixtures.kt:37) 	at com.vanniktech.maven.publish.PlatformKt$setupTestFixtures$1.invoke(Platform.kt:553) 	at com.vanniktech.maven.publish.PlatformKt$setupTestFixtures$1.invoke(Platform.kt:551) 	at com.vanniktech.maven.publish.PlatformKt.setupTestFixtures$lambda$3(Platform.kt:551) ```
  **Post-Mortem & Fix Analysis**:
  > Thanks will get to this soon
  > Thanks for the fix. Now that 9.2 is in RC do you have plans for a release? If not, I can start testing with the snapshots.
  > Gradle reverted the internal API change in the release candidate so the stable version of this plugin should work with it

- **Issue #938** (2025-04-22): **Publishing -SNAPSHOT version works, but when I want to publish production version, it fails.**
  *Symptoms*: Using this plugin I was able to publish several different -SNAPSHOT versions, and plugin works fine. For example, to publish version 6.0.27.1-SNAPSHOT, 6.0.27.2-SNAPSHOT... it all works fine. But if I want to publish some alpha, beta, rc or production version, it fails: (6.0.27-alpha01, 6.0.27-beta01, 6.0.27-rc01, 6.0.27) - all those failing with the following error in the gradle output.  ``` Execution failed for task ':sdk:publishMavenPublicationToMavenCentralRepository'. > Services of type BuildFeatures are not available for injection into instances of type BuildService. ``` Using plugin 0.31.0 version. This is my script configuration. All parameters are read from gradle.properties and I checked also if all are read correctly, and yes.  So, there is no error with reading some variable.  ``` mavenPublishing {     configure(         AndroidSingleVariantLibrary(             // the published variant             variant = "release",             // whether to publish a sources jar             sourcesJar = true,             // whether to publish a javadoc jar             publishJavadocJar = true,         )     )      coordinates(PUBLISHED_GROUP_ID, ARTIFACT, VERSION)      pom {         name.set(LIBRARY_NAME)         description.set(LIBRARY_DESC)         inceptionYear.set("2020")         url.set(GIT_URL)         licenses {             license {                 name.set(LICENSE_NAME)                 url.set(LICENSE_URL)                 distribution.set(LICENSE_URL)             }    
  **Post-Mortem & Fix Analysis**:
  > Do you have configuration cache enabled when running the publishing task?
  > > Do you have configuration cache enabled when running the publishing task?  I'm getting the same error with trying both publishing - with or without caching. ``` ./gradlew publishToMavenCentral --no-configuration-cache ./gradlew publishToMavenCentral --configuration-cache ``` I also added to the gradle.properties `org.gradle.configuration-cache=false` but I'm getting the same error.  ### EDIT 1:   -SNAPSHOT publishing works with both commands. Other versions of publishing don't work with any command. All throw the exception from the first comment. 

- **Issue #930** (2025-04-22): **Unable to load class 'org.jetbrains.kotlin.gradle.plugin.KotlinBasePlugin'**
  *Symptoms*: ``` The client will now receive all logging from the daemon (pid: 15036). The daemon log file: '***\.gradle\daemon\8.12\daemon-15036.out.log Starting 6th build in daemon [uptime: 3 mins 52.184 secs, performance: 100%, GC rate: 0.00/s, heap usage: 0% of 512 MiB, non-heap usage: 26% of 384 MiB] Using 24 worker leases. Now considering['***] as hierarchies to watch Watching the file system is configured to be enabled if available File system watching is active Starting Build Resolved plugin [id: 'org.gradle.toolchains.foojay-resolver-convention', version: '0.9.0'] Settings evaluated using settings file ''***\settings.gradle'. Projects loaded. Root project using build file ''***\build.gradle'. Included projects: [root project 'afternode-commons', project ':adventure-messaging', project ':bukkit', project ':bukkit-kotlin', project ':bungee', project ':commons', project ':velocity']  > Configure project : Evaluating root project 'afternode-commons' using build file '***\build.gradle'. Resolved plugin [id: 'java'] Resolved plugin [id: 'maven-publish'] Resolved plugin [id: 'signing'] Resolved plugin [id: 'java-library'] Resolved plugin [id: 'com.vanniktech.maven.publish', version: '0.31.0']  > Configure project :adventure-messaging Evaluating project ':adventure-messaging' using build file '***\adventure-messaging\build.gradle'. Resolved plugin [id: 'java']  > Configure project :bukkit Evaluating project ':bukkit' using build file '***\bukkit\build.gradle'. Resolved plugin [id: 'java'
  **Post-Mortem & Fix Analysis**:
  > in root project build.gradle: ``` plugins {   id "com.vanniktech.maven.publish" version "0.31.0" }  subprojects {     apply plugin: "com.vanniktech.maven.publish" } ```
  > How do you add the Kotlin Gradle plugin? Can you try adding it to the plugins block where you add the publish plugin with `apply false`?
  > > How do you add the Kotlin Gradle plugin? Can you try adding it to the plugins block where you add the publish plugin with `apply false`?  its working, thanks

- **Issue #926** (2025-06-21): **Javadoc jar is empty when applying Kotlin, Dokka, and pluginPublish plugins**
  *Symptoms*: Apply  ```kt plugins {   id("org.jetbrains.kotlin.jvm") version "2.1.20"   id("org.jetbrains.dokka") version "2.0.0"   id("com.vanniktech.maven.publish") version "0.31.0"   id("com.gradle.plugin-publish") version "1.3.1" } ```  in a Gradle plugin project written in Kotlin only, and run `./gradlew publishToMavenLocal`, you'll see  ``` > Task :checkKotlinGradlePluginConfigurationErrors SKIPPED > Task :pluginDescriptors > Task :processResources > Task :generatePomFileForPluginMavenPublication > Task :sourcesJar > Task :generatePomFileForShadowPluginPluginMarkerMavenPublication > Task :signShadowPluginPluginMarkerMavenPublication > Task :publishShadowPluginPluginMarkerMavenPublicationToMavenLocal > Task :compileKotlin > Task :compileJava NO-SOURCE > Task :classes > Task :javadoc NO-SOURCE > Task :javadocJar > Task :jar > Task :generateMetadataFileForPluginMavenPublication > Task :signPluginMavenPublication > Task :publishPluginMavenPublicationToMavenLocal > Task :publishToMavenLocal ```  The `javadocJar` task is useless, and an empty `javadoc.jar` will be published.  ``` dua ~/.m2/repository/com/gradleup/shadow/shadow-gradle-plugin/9.0.0-SNAPSHOT/    4.10 KB maven-metadata-local.xml    4.10 KB shadow-gradle-plugin-9.0.0-SNAPSHOT-javadoc.jar    4.10 KB shadow-gradle-plugin-9.0.0-SNAPSHOT-javadoc.jar.asc    4.10 KB shadow-gradle-plugin-9.0.0-SNAPSHOT-sources.jar.asc    4.10 KB shadow-gradle-plugin-9.0.0-SNAPSHOT.jar.asc    4.10 KB shadow-gradle-plugin-9.0.0-SNAPSHOT.module.asc    4
  **Post-Mortem & Fix Analysis**:
  > Plugin publish plugin did nothing for Dokka, see  <img width="1503" alt="Image" src="https://github.com/user-attachments/assets/c04f3292-e1b6-4ec5-8695-14f7640e82f4" />  We have to call `defaultJavaDocOption` before `GradlePublishPlugin`   https://github.com/vanniktech/gradle-maven-publish-plugin/blob/f22bd35c84c3df28700db4ca3de11d5b78a29fde/plugin/src/main/kotlin/com/vanniktech/maven/publish/MavenPublishBaseExtension.kt#L392-L393  or file this issue to `plugin-publish` side.
  > The reason why it's not configured right now is that `com.gradle.plugin-publish` is creating the javadoc jar task. We could still detect that dokka is applied and then configure that dokka's output is used as input for that task.
  > The Gradle publish plugin does this internally which is hard to override ``` JavaPluginExtension javaPluginExtension = project.getExtensions().getByType(JavaPluginExtension.class); javaPluginExtension.withJavadocJar(); ```  There is this pretty old issue on their side https://github.com/gradle/plugin-portal-requests/issues/247. Closing this for now since I don't see much we can do

- **Issue #911** (2025-04-22): **Version 0.31.0 not compatible with Kotlin 1.9.20 as per release notes**
  *Symptoms*: The 0.31.0 release notes state that the minimum supported version is 1.9.20.   This is not true when using a convention plugin. The following error appears:  ``` Class 'com.vanniktech.maven.publish.SonatypeHost' was compiled with an incompatible version of Kotlin. The actual metadata version is 2.1.0, but the compiler version 1.9.0 can read versions up to 2.0.0. ```  
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I'll do a patch update tomorrow
  > Hi @gabrielittner, sory for the ping but do you have any updates for this? 
  > Hello, I'm running into this problem too, any ETA? Thanks for the support.

- **Issue #728** (2025-07-13): **Publishing parts of a project with different versions leads to wrong repo being used **
  *Symptoms*: Example https://github.com/cashapp/paparazzi/pull/1317/files  The actually published modules use a non SNAPSHOT version but it tries to publish to the snapshot repo because of the SNAPSHOT version in not actually published modules
  **Post-Mortem & Fix Analysis**:
  > As mentioned in #978 this will be resolved after the removal of the old Sonatype hosts

- **Issue #719** (2025-04-22): **`MavenPublishPluginPlatformTest` does not pass on Windows**
  *Symptoms*: There are multiple issues. E.g.  - something does not seem to properly close the files written to the local repository:   > Suppressed: java.nio.file.FileSystemException: C:\Users\SEBAST~1\AppData\Local\Temp\junit400498029000534319\repo\com\example\test-artifact\1.0.0\test-artifact-1.0.0-sources.jar: The process cannot access the file because it is being used by another process - compilation fails with   > WindowsRegistry is not supported on this operating system.    which is very weird, as I *am* running on Windows, so registry access (probably to find the Java toolchain) should work. Also https://github.com/gradle/native-platform/issues/274 does not really give much of a clue.
  **Post-Mortem & Fix Analysis**:
  > Thanks @gabrielittner for resolving this. I'm curious, which change fixed the issue?

- **Issue #445** (2022-12-26): **`createStagingRepository` fails when group is only set via `MavenPublication.groupId`**
  *Symptoms*: This is new behavior in `0.22.0`, using the base plugin.  The Gradle version is `7.5.1`, but that shouldn't matter.  I don't have a full stacktrace at the moment but the exception message made it pretty clear what's happening:  > No matching staging profile found in account rbusarow. It is expected that the account contains a staging profile that matches or is the start of workflow.workflow-config.Available profiles are: com.squareup  The `createStagingRepository` task is using `project.group` as the groupId.  I have been setting `groupId` alongside `artifactId` like this:  ```kotlin configure<PublishingExtension> {   publications.withType(MavenPublication::class.java) pub@{     this@pub.groupId = "com.example"     this@pub.artifactId = "some-id"   } } ```  This is done in order to an old conflict resolution issue in Gradle (https://github.com/gradle/gradle/issues/847).  To summarize, a unique `project.group` is necessary to distinguish project dependencies when they have the same simple name, like `:a:api` and `:b:api`.  But now with 0.22.0, `MavenPublishBaseExtension` is hard-coded to get the group from the project:  https://github.com/vanniktech/gradle-maven-publish-plugin/blob/2e12d99d80fac3d7b4a0f839757d8fb1ffb5dc5a/plugin/src/main/kotlin/com/vanniktech/maven/publish/MavenPublishBaseExtension.kt#L64-L66  Ideally, the extension and `CreateSonatypeRepositoryTask` would also use the publication's `groupId` value.
  **Post-Mortem & Fix Analysis**:
  > The reason why we are not using the group id from the publications is that they might be different. For example if you publish Gradle plugins you will get additional publications which use the plugin id as their group id. I will try to come up with a solution for this. My first thought is to also explicitly add group/artifactId/version to our DSL and then when setting it there or in through gradle properties to not modify `project.group` and `project.version` but instead directly apply these to the publication.
  > This will be fixed in 0.23.0 and you can already try it out with the snapshots. The plugin will not set `project.group` and `project.version` anymore so you can use the former to differentiate projects. For the published group id we will use either the `GROUP` gradle property or you can pass group, artifact id and version to the new `coordinates` method in our DSL

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

### Incident Patch 1: `62db4786` (2026-09-26)
**Commit Message**: Update plugin buildconfig to v6.1.2 (#1452)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -55,6 +55,6 @@ semver = "net.swiftzer.semver:semver:2.1.0"
 androidx-gradlePluginLints = "androidx.lint:lint-gradle:1.0.0"
 
 [plugins]
-buildconfig = "com.github.gmazzo.buildconfig:6.1.1"
+buildconfig = "com.github.gmazzo.buildconfig:6.1.2"
 android-lint = { id = "com.android.lint", version.ref = "android-gradle" }
 kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

---

### Incident Patch 2: `771f4d71` (2026-09-19)
**Commit Message**: Update plugin buildconfig to v6.1.1 (#1444)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -55,6 +55,6 @@ semver = "net.swiftzer.semver:semver:2.1.0"
 androidx-gradlePluginLints = "androidx.lint:lint-gradle:1.0.0"
 
 [plugins]
-buildconfig = "com.github.gmazzo.buildconfig:6.1.0"
+buildconfig = "com.github.gmazzo.buildconfig:6.1.1"
 android-lint = { id = "com.android.lint", version.ref = "android-gradle" }
 kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

---

### Incident Patch 3: `c2e40981` (2026-09-13)
**Commit Message**: Update plugin buildconfig to v6.1.0 (#1437)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -55,6 +55,6 @@ semver = "net.swiftzer.semver:semver:2.1.0"
 androidx-gradlePluginLints = "androidx.lint:lint-gradle:1.0.0"
 
 [plugins]
-buildconfig = "com.github.gmazzo.buildconfig:6.0.10"
+buildconfig = "com.github.gmazzo.buildconfig:6.1.0"
 android-lint = { id = "com.android.lint", version.ref = "android-gradle" }
 kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
```

---

### Incident Patch 4: `f1dcc177` (2026-06-03)
**Commit Message**: Update plugin buildconfig to v6.0.10 (#1371)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -55,5 +55,5 @@ semver = "net.swiftzer.semver:semver:2.1.0"
 androidx-gradlePluginLints = "androidx.lint:lint-gradle:1.0.0-alpha05"
 
 [plugins]
-buildconfig = "com.github.gmazzo.buildconfig:6.0.9"
+buildconfig = "com.github.gmazzo.buildconfig:6.0.10"
 android-lint = { id = "com.android.lint", version.ref = "android-gradle" }
```

#### Recent Merged Pull Requests:
- **PR #1456** (2026-10-01): Update dependency com.android.library to v9.5.0-alpha08 (@renovate[bot])
- **PR #1455** (2026-10-01): Update dependency org.apache.maven:maven-model to v3.10.0 (@renovate[bot])
- **PR #1453** (2026-09-28): Update dependency com.google.testparameterinjector:test-parameter-injector-junit5 to v1.24 (@renovate[bot])
- **PR #1452** (2026-09-26): Update plugin buildconfig to v6.1.2 (@renovate[bot])
- **PR #1451** (2026-09-25): Update plugin com.gradle.develocity to v4.6.0 (@renovate[bot])
- **PR #1450** (2026-09-25): Update Gradle to v9.8.0 (@renovate[bot])
- **PR #1449** (2026-09-25): Update dependency com.android.library to v9.5.0-alpha07 (@renovate[bot])
- **PR #1448** (2026-09-24): Update dependency org.jetbrains.kotlin.jvm to v2.5.0-Beta1 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
