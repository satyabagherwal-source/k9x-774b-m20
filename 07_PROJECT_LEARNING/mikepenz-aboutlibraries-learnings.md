# Forensic Learning Record (Deep Inspection): mikepenz/AboutLibraries

> **Canonical Artifact**: `07_PROJECT_LEARNING/mikepenz-aboutlibraries-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mikepenz/AboutLibraries](https://github.com/mikepenz/AboutLibraries))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:58:17.481Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mikepenz/AboutLibraries`
- **Description**: AboutLibraries automatically collects all dependencies and licenses of any gradle project (Kotlin MultiPlatform), and provides easy to integrate UI components for Android and Compose Multiplatform environments 
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4460 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `aboutlibraries-compose/src/commonMain/kotlin/com/mikepenz/aboutlibraries/ui/compose/style/InternalUtils.kt`
```
package com.mikepenz.aboutlibraries.ui.compose.style

import androidx.compose.ui.graphics.Color

internal fun Color.orFallback(fallback: Color): Color =
    if (this == Color.Unspecified) fallback else this

```

### Core Architecture Module: `aboutlibraries-compose/src/commonMain/kotlin/com/mikepenz/aboutlibraries/ui/compose/util/Extensions.kt`
```
package com.mikepenz.aboutlibraries.ui.compose.util

import com.mikepenz.aboutlibraries.entity.Library
import com.mikepenz.aboutlibraries.entity.License

val Library.author: String
    get() = developers.takeIf { it.isNotEmpty() }?.mapNotNull { it.name }?.joinToString(", ")
        ?: organization?.name ?: ""

val License.htmlReadyLicenseContent: String?
    get() = licenseContent?.replace("\n", "<br />")

val License.strippedLicenseContent: String?
    get() = licenseContent?.replace("<br />", "\n")?.replace("<br/>", "\n")

val Library.htmlReadyLicenseContent: String
    get() = licenses.joinToString(separator = "<br /><br /><br /><br />") {
        it.htmlReadyLicenseContent ?: ""
    }

val Library.strippedLicenseContent: String
    get() = licenses.joinToString(separator = "\n\n\n\n") {
        it.strippedLicenseContent ?: ""
    }
```

### Core Architecture Module: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidExtensions.kt`
```
package com.mikepenz.aboutlibraries.util

import android.content.Context
import android.util.Log
import com.mikepenz.aboutlibraries.Libs
import org.json.JSONArray
import org.json.JSONObject

/**
 * Attach the generated library definition data as [ByteArray]
 *
 * @param byteArray containing the information
 */
fun Libs.Builder.withJson(byteArray: ByteArray): Libs.Builder {
    return withJson(byteArray.toString(Charsets.UTF_8))
}

/**
 * Auto-discover the generated library definition data by the default name and location
 * `res/raw/aboutlibraries.json`
 *
 * Please remember to disable resource shrinking when using this API.
 * https://developer.android.com/topic/performance/app-optimization/customize-which-resources-to-keep
 *
 * ```
 * <?xml version="1.0" encoding="utf-8"?>
 * <resources xmlns:tools="http://schemas.android.com/tools"
 *     tools:keep="@raw/aboutlibraries" />
 * ```
 *
 * @param ctx context used to retrieve the resource
 */
fun Libs.Builder.withContext(ctx: Context): Libs.Builder {
    return withJson(ctx, ctx.getRawResourceId("aboutlibraries"))
}

/**
 * Attach the generated library definition data as resource file, with the given id.
 *
 * @param ctx context used to retrieve the resource
 * @param rawResId used to retrieve the file
 */
fun Libs.Builder.withJson(ctx: Context, rawResId: Int): Libs.Builder {
    try {
        withJson(ctx.resources.openRawResource(rawResId).bufferedReader().use { it.readText() })
    } catch (t: Throwable) {
        Log.e(
            "AboutLibraries", """
            Unable to retrieve library information given the `raw` resource identifier. 
            Please make sure either the gradle plugin is properly set up, or the file is manually provided. 
        """.trimIndent(), t
        )
        println("Could not retrieve libraries")
    }
    return this
}

internal fun Context.getRawResourceId(aString: String): Int {
    return resources.getIdentifier(aString, "raw", packageName)
}

internal fun <T> JSONArray?.forEachObject(block: JSONObject.() -> T): List<T> {
    this ?: return emptyList()
    val targetList = mutableListOf<T>()
    for (il in 0 until length()) {
        val obj = block.invoke(getJSONObject(il))
        if (obj != null) {
            targetList.add(obj)
        }
    }
    return targetList
}

internal fun <T> JSONArray?.forEachString(block: String.() -> T): List<T> {
    this ?: return emptyList()
    val targetList = mutableListOf<T>()
    for (il in 0 until length()) {
        targetList.add(block.invoke(getString(il)))
    }
    return targetList
}

internal fun <T> JSONObject?.forEachObject(block: JSONObject.(key: String) -> T): List<T> {
    this ?: return emptyList()
    val targetList = mutableListOf<T>()
    keys().forEach {
        targetList.add(block.invoke(getJSONObject(it), it))
    }
    return targetList
}

```

### Core Architecture Module: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidParser.kt`
```
package com.mikepenz.aboutlibraries.util

import android.util.Log
import com.mikepenz.aboutlibraries.entity.Developer
import com.mikepenz.aboutlibraries.entity.Funding
import com.mikepenz.aboutlibraries.entity.Library
import com.mikepenz.aboutlibraries.entity.License
import com.mikepenz.aboutlibraries.entity.Organization
import com.mikepenz.aboutlibraries.entity.Scm
import org.json.JSONObject

actual fun parseData(json: String): Result {
    try {
        val metaData = JSONObject(json)

        val licenses = metaData.getJSONObject("licenses").forEachObject { key ->
            License(
                getString("name"),
                optStringOrNull("url"),
                optStringOrNull("year"),
                optStringOrNull("spdxId"),
                optStringOrNull("content"),
                key
            )
        }
        val mappedLicenses = licenses.associateBy { it.hash }
        val libraries = metaData.getJSONArray("libraries").forEachObject {
            val libLicenses =
                optJSONArray("licenses").forEachString { mappedLicenses[this] }.mapNotNull { it }
                    .toHashSet()
            val developers = optJSONArray("developers")?.forEachObject {
                Developer(optStringOrNull("name"), optStringOrNull("organisationUrl"))
            } ?: emptyList()
            val organization = optJSONObject("organization")?.let {
                Organization(it.optString("name") ?: "", it.optStringOrNull("url"))
            }
            val scm = optJSONObject("scm")?.let {
                Scm(
                    it.optStringOrNull("connection"),
                    it.optStringOrNull("developerConnection"),
                    it.optStringOrNull("url")
                )
            }
            val funding = optJSONArray("funding").forEachObject {
                Funding(getString("platform"), getString("url"))
            }.toSet()
            val targets = optJSONArray("targets").forEachString { this }.toSet()
            val id = getString("uniqueId")
            Library(
                id,
                optStringOrNull("artifactVersion"),
                optString("name", id),
                optStringOrNull("description"),
                optStringOrNull("website"),
                developers,
                organization,
                scm,
                libLicenses,
                funding,
                optStringOrNull("tag"),
                targets
            )
        }
        return Result(libraries, licenses)
    } catch (t: Throwable) {
        Log.e("AboutLibraries", "Failed to parse the meta data *.json file: $t")
    }
    return Result(emptyList(), emptyList())
}

private fun JSONObject.optStringOrNull(name: String): String? {
    val value = opt(name)
    return if (value == null || value == JSONObject.NULL) null else value.toString()
}

```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/Libs.kt`
```
package com.mikepenz.aboutlibraries

import com.mikepenz.aboutlibraries.entity.Library
import com.mikepenz.aboutlibraries.entity.License
import com.mikepenz.aboutlibraries.util.parseData
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The [Libs] class is the main access point to the generated data of the plugin.
 * Provides accessors for the [Library] and [License] lists, containing all the dependency information for the module.
 */
@Serializable
data class Libs constructor(
    @SerialName("libraries") val libraries: List<Library>,
    @SerialName("licenses") val licenses: Set<License>,
) {
    /**
     * Builder used to automatically parse and interpret the generated library data from the plugin.
     */
    class Builder {
        private var _stringData: String? = null

        /**
         * Provide the generated library data as [String]
         */
        fun withJson(stringData: String): Builder {
            _stringData = stringData
            return this
        }

        /**
         * Build the [Libs] instance with the applied configuration.
         */
        fun build(): Libs {
            val data = _stringData
            val (libraries, licenses) = if (data != null) {
                parseData(data)
            } else {
                throw IllegalStateException(
                    """
                    Please provide the required library data via the available APIs.
                    Depending on the platform this can be done for example via `Libs.Builder().withJson()`.
                    For Android there exists an `Libs.Builder().withContext(context).build()`, automatically loading the `aboutlibraries.json` file from the `raw` resources folder.
                    When using compose or other parent modules, please check their corresponding APIs.
                """.trimIndent()
                )
            }
            return Libs(
                libraries.sortedBy { it.name.lowercase() },
                licenses.toSet()
            )
        }
    }
}

```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/Developer.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes the [Developer] defined in the `pom.xml` file.
 *
 * https://svn.apache.org/repos/infra/websites/production/maven/content/pom.html#Developers
 *
 * @param name of the developer
 * @param organisationUrl optional organisation url for the developer
 */
@Serializable
data class Developer(
    @SerialName("name") val name: String?,
    @SerialName("organisationUrl") val organisationUrl: String?
)
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/Funding.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes the [Funding] as defined by the dependency.
 * This is only supported for projects hosted for dependencies hosted on: https://github.com/mikepenz/AboutLibraries#special-repository-support
 * Or can be manually supplied.
 *
 * @param platform name of the platform allowing to fund the project
 * @param url url pointing towards the location to fund the project
 */
@Serializable
data class Funding(
    @SerialName("platform") val platform: String,
    @SerialName("url") val url: String
)
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/Library.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes a complete [Library] element, specifying important information about a used dependency.
 *
 * @param uniqueId describes this dependency (matches [artifactId] without version)
 * @param artifactVersion the version of the artifact used
 * @param name of the given dependency
 * @param description of the given dependency, may be empty.
 * @param website provided by the artifact `pom.xml`
 * @param developers list, including all listed devs according to the `pom` file
 * @param organization describing the creating org of for the dependency
 * @param scm information, linking to the repository hosting the source
 * @param licenses all identified licenses for this artifact
 * @param funding all identified funding opportunities for this artifact
 * @param targets Kotlin target names this artifact is consumed by (e.g. `android`, `jvm`, `iosX64`).
 * Empty unless the `collect.includeTargets` option was enabled when generating the metadata file.
 * Lets a consumer narrow the list to what the running target links against, e.g.
 * `libs.libraries.filter { "iosArm64" in it.targets }`.
 */
@Serializable
data class Library(
    @SerialName("uniqueId") val uniqueId: String,
    @SerialName("artifactVersion") val artifactVersion: String?,
    @SerialName("name") val name: String,
    @SerialName("description") val description: String?,
    @SerialName("website") val website: String?,
    @SerialName("developers") val developers: List<Developer>,
    @SerialName("organization") val organization: Organization?,
    @SerialName("scm") val scm: Scm?,
    @SerialName("licenses") val licenses: Set<License> = emptySet(),
    @SerialName("funding") val funding: Set<Funding> = emptySet(),
    @SerialName("tag") val tag: String? = null,
    @SerialName("targets") val targets: Set<String> = emptySet(),
) {
    /**
     * defines the [uniqueId]:[artifactVersion] combined
     */
    val artifactId: String
        get() = "${uniqueId}:${artifactVersion ?: ""}"

    /**
     * Returns `true` in cases this artifact is assumed to be open source (e..g. [scm].url is provided)
     */
    val openSource: Boolean
        get() = scm?.url?.isNotBlank() == true
}
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/License.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes a complete [License] element.
 * Either retrieved from spdx or downloaded from the artifacts repo
 *
 * @param name of the given license
 * @param url linking to the hosted form of this license
 * @param year if available for this license (not contained in the `pom.xml`)
 * @param spdxId for this library, if it is a standard library available
 * @param licenseContent contains the whole license content as downloaded from the server
 * @param hash usually calculated to identify if a license is re-used and can be used for multiple artifacts
 */
@Serializable
data class License(
    @SerialName("name") val name: String,
    @SerialName("url") val url: String?,
    @SerialName("year") val year: String? = null,
    @SerialName("spdxId") val spdxId: String? = null,
    @SerialName("licenseContent") val licenseContent: String? = null,
    @SerialName("hash") val hash: String
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as License

        if (hash != other.hash) return false

        return true
    }

    override fun hashCode(): Int {
        return hash.hashCode()
    }
}
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/Organization.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes the [Organization] defined in the `pom.xml` file.
 *
 * https://svn.apache.org/repos/infra/websites/production/maven/content/pom.html#Organization
 *
 * @param name of the organisation
 * @param url optional url to the website of the defined organisation
 */
@Serializable
data class Organization(
    @SerialName("name") val name: String,
    @SerialName("url") val url: String?,
)
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/entity/Scm.kt`
```
package com.mikepenz.aboutlibraries.entity

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Describes the [Scm] defined in the `pom.xml` file.
 *
 * https://svn.apache.org/repos/infra/websites/production/maven/content/pom.html#SCM
 *
 * @param connection describing the source connection
 * @param developerConnection optionally describing the developer connection
 * @param url optionally linking to the hosted form of this artifact
 */
@Serializable
data class Scm(
    @SerialName("connection") val connection: String?,
    @SerialName("developerConnection") val developerConnection: String?,
    @SerialName("url") val url: String?
)
```

### Core Architecture Module: `aboutlibraries-core/src/commonMain/kotlin/com/mikepenz/aboutlibraries/util/Parser.kt`
```
package com.mikepenz.aboutlibraries.util

import com.mikepenz.aboutlibraries.entity.Library
import com.mikepenz.aboutlibraries.entity.License

expect fun parseData(json: String): Result

class Result(
    val libraries: List<Library>,
    val licenses: List<License>
) {
    operator fun component1() = libraries
    operator fun component2() = licenses
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #648** (2021-05-28): **Trouble since upgrade in a project with product flavors?**
  *Symptoms*: ## About this issue  We've been happily using AboutLibraries 8.5.0 in Monado  https://gitlab.freedesktop.org/monado/monado for some time. I was recently prompted to update to 8.8.6, and despite not seeing anything related in the changelog, I now get an error. I'm blaming product flavors, since that's what I was messing with when I upgraded, and I don't know why else this would start happening. **8.8.5 appears to work fine.**  ``` > Task :src:xrt:targets:openxr_android:prepareLibraryDefinitionsInProcessDebug FAILED Manually requested license: mit Manually requested license: mpl_2_0 All dependencies.size=70 --> Retrieved POM for: com_google_code_findbugs__jsr305 from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__hilt_core from org.sonatype.oss:oss-parent:7 Could not get the name for androidx_databinding__viewbinding, Using androidx.databinding:viewbinding --> Had to resolve name from custom mapping for: androidx_savedstate__savedstate as SavedState --> Retrieved POM for: com_google_dagger__hilt_android from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__dagger from org.sonatype.oss:oss-parent:7 --> Retrieved POM for: com_google_dagger__dagger_lint_aar from org.sonatype.oss:oss-parent:7  Execution failed for task ':src:xrt:targets:openxr_android:prepareLibraryDefinitionsInProcessDebug'. > Receiver class com.mikepenz.aboutlibraries.plugin.AboutLibrariesProcessor does not define or inherit an implementation of th
  **Post-Mortem & Fix Analysis**:
  > Thank you so much @rpavlik nothing particular to that was changed indeed. We will have to investigate if it may be some issue with stable gradle 7.0.2  https://github.com/mikepenz/AboutLibraries/issues/637#issuecomment-842520907
  > Note that here I am using Gradle 6.8.3 - I haven't dared upgrade to 7 yet.
  > I was using 8.8.6 with Gradle 7+ and it worked fine.

- **Issue #645** (2021-05-28): **Jetpack navigation and XML configuration**
  *Symptoms*: I included your excellent library in my project using Jetpack navigation as described in https://github.com/mikepenz/AboutLibraries#jetpack-navigation which worked nicely. When I want to configure what is shown on the fragment using the XML part of https://github.com/mikepenz/AboutLibraries#about-this-app-ui I cannot change any boolean values. The XML is used in the sample app too and only certain values can be changed there too. For example aboutLibraries_description_showIcon can be set to false but the icon will be shown regardless of this setting. If I understand it correctly, the value is read in LibsFragmentCompat.kt by using extractBooleanBundleOrResource() from ContextExtension.kt but will allow to override null values only. But in LibsBuilder.kt it is initialized with true (and showIcon can't be null anyway) so that will be used not what is specified in the XML. Am I missing something or how can I configure the shown data for the boolean values? Thanks in advance
  **Post-Mortem & Fix Analysis**:
  > @ts65 thank you so much for the report. I'll have a look
  > Thank you so much, it works nicely with the latest version. Would you be willing to expand it to support showLicence in XML/LibsFragmentCompat too?
  > Thank you!

- **Issue #624** (2021-03-05): **Empty license strings since 8.8.1 version**
  *Symptoms*: As of version 8.8.1, libraries downloaded using `Libs(contex).libraries` have empty strings in the `licenseDescription` and `licenseShortDescription` fields.   The only solution is to use version 8.8.0
  **Post-Mortem & Fix Analysis**:
  > @Faierbel the main difference between those 2 versions would be the publishing to maven. Which is interesting.   may you please try if it is related to the plugin or the library code?  (use 8.8.0 in library code but 8.8.1 plugin, and in reverse)  Please clean in-between just to make sure. 
  > Thanks for the quick reply  8.8.0 plugin, 8.8.1 library -> strings aren't empty 8.8.1 plugin, 8.8.0 library -> strings are empty  It looks like the problem is the plugin
  > Found the issue fill release an update as quick as possible

- **Issue #578** (2021-01-07): **Configuring a config folder fails with silent error**
  *Symptoms*: ## About this issue I just tried the config option now but it does not seem to be working. I believe it could either be me doing it wrong or be a slight bug in the collectMappingDetails method in AboutLibrariesProcessor.groovy.  The first instance of customMappingText inside if(configFolder != null) does not start with a def. When I copy this function into our project and run it then it throws an exception. groovy.lang.MissingPropertyException: Could not set unknown property 'customMappingText' for project Adding a def to this seems to work. Can raise a new issue for this?   ## Details - [ ] Used library version - [ ] Used support library version - [ ] Used gradle build tools version - [ ] Used tooling / Android Studio version - [ ] Other used libraries, potential conflicting libraries  ## Checklist  - [ ] Searched for [similar issues](https://github.com/mikepenz/AboutLibraries/issues) - [ ] Checked out the [sample application](https://github.com/mikepenz/AboutLibraries/tree/develop/app) - [ ] Read the [README](https://github.com/mikepenz/AboutLibraries/blob/develop/README.md) - [ ] Checked out the [CHANGELOG](https://github.com/mikepenz/AboutLibraries/releases) - [ ] Read the [MIGRATION GUIDE](https://github.com/mikepenz/AboutLibraries/blob/develop/MIGRATION.md) 

- **Issue #557** (2020-11-09): **ExportLibraries fails using gradle CLI**
  *Symptoms*: ## About this issue  - Briefly describe the issue ExplorLibraries task using gradlew commandLine fails  - How can the issue be reproduced / sample code Create an Android Blank project using Android Studio 4.1 (Java) Modify project build.gradle to include AboutLibraries Gradle Plug-in (classpath / maven url) 8.4.5 Modify app build.gradle to include the plugin and the dependencies;  Add a button to trigger to start the AboutLibraries Activity (as described on component page);  **gradlew output**  ``` $ ./gradlew exportLibrariesDebug  > Task :app:exportLibrariesDebug FAILED All dependencies.size=48 --> Had to resolve name from custom mapping for: androidx_savedstate__savedstate as SavedState   Variant: debug   LIBRARIES:  FAILURE: Build failed with an exception.  * What went wrong: Execution failed for task ':app:exportLibrariesDebug'. > Could not get unknown property 'unknownLicenses' for task ':app:exportLibrariesDebug' of type com.mikepenz.aboutlibraries.plugin.AboutLibrariesExportTask.  * Try: Run with --stacktrace option to get the stack trace. Run with --info or --debug option to get more log output. Run with --scan to get full insights.  * Get more help at https://help.gradle.org  BUILD FAILED in 1s 1 actionable task: 1 executed   ```  **Stack Trace**  ``` * Exception is: org.gradle.api.tasks.TaskExecutionException: Execution failed for task ':app:exportLibrariesDebug'.         at org.gradle.api.internal.tasks.execution.Exe
  **Post-Mortem & Fix Analysis**:
  > @bbourbon thank you for the report, there will be a new release fixing this soon
  > @bbourbon please try v8.5.0
  > Thank you show much Mike. I will test as soon as possible.  Best Regards.

- **Issue #504** (2020-06-10): **FragmentManager / Databinding Issue**
  *Symptoms*: ## About this issue  When adding classpath("com.mikepenz.aboutlibraries.plugin:aboutlibraries-plugin:8.1.6") to my build.gradle (root level) dependencies and applying the plugin in the app level - the application will build just fine but during runtime it does crash with an NullPointerException.   Executing  ./gradlew exportLibraries works fine. I did not try adding the bundled activity.  ``` 2020-06-03 15:14:30.415 1931-1931/com.continental.android.intersectcollisionwarning E/AndroidRuntime:     at androidx.fragment.app.FragmentManagerImpl.addAddedFragments(FragmentManagerImpl.java:2100)         at androidx.fragment.app.FragmentManagerImpl.executeOpsTogether(FragmentManagerImpl.java:1874)         at androidx.fragment.app.FragmentManagerImpl.removeRedundantOperationsAndExecute(FragmentManagerImpl.java:1830)         at androidx.fragment.app.FragmentManagerImpl.execPendingActions(FragmentManagerImpl.java:1727)         at androidx.fragment.app.FragmentManagerImpl.dispatchStateChange(FragmentManagerImpl.java:2663)         at androidx.fragment.app.FragmentManagerImpl.dispatchActivityCreated(FragmentManagerImpl.java:2613)         at androidx.fragment.app.Fragment.performActivityCreated(Fragment.java:2624)         at androidx.fragment.app.FragmentManagerImpl.moveToState(FragmentManagerImpl.java:904)         at androidx.fragment.app.FragmentManagerImpl.moveFragmentToExpectedState(FragmentManagerImpl.java:1238)         at androidx.fragment.app.FragmentManagerImpl.moveT
  **Post-Mortem & Fix Analysis**:
  > @virgil85 could it be that you exceed the multidex limit?   if you do not apply the plugin but only use the dependency will it work?  Do you potentially have different versions of major libs like material components, or similar?
  > @mikepenz since I have `multiDexEnabled = true`  I guess the multidex limit should not affect me.   If I don't apply the plugin but only use the dependency I get the same runtime errors as before.  Yes, I'm using a lot of major libs (material components in version 1.1.0-beta01). Is there an easy way to list them all?
  > ./gradlew app:dependencies gives you all dependencies and their version.   It looks like the plugin is not the cause. And if it is only adding the library that indicates:  - multidex issue - conflict of library versions  :) 

- **Issue #501** (2020-06-07): **Some dependencies not detected**
  *Symptoms*: ## About this issue  UPDATE: see https://github.com/mikepenz/AboutLibraries/issues/501#issuecomment-637460667  Multi-module project layout as follows: ``` :app (Android app module) - dependency1 (library recognized correctly by AboutLibraries) - :lib1 (Android library module) -- dependency2 (library NOT recognized) ```  dependency2 is declared only in some library modules (not in the app module directly) using `implementation` configuration. It is not present in output of `findLibraries` nor `exportLibraries` tasks. AboutLibraries gradle plugin is applied to :app module. No custom configuration. Not sure if all such transitive dependencies are affected but it is true for few randomly chosen.  It worked at most in 8.0.0-a02 because I've reported another issue here with displaying author of one of the libraries which are now missing (https://github.com/mikepenz/AboutLibraries/issues/459). AFAIR since that project layout has not changed, only the dependency versions incl. AboutLibraries, Gradle and AGP.  ## Details - Used library version: 8.1.6, with Gradle plugin - Used gradle build tools version: 6.5-milestone-1 - Used tooling / Android Studio version: 4.1.0-alpha10  ## Checklist  - [x] Searched for [similar issues](https://github.com/mikepenz/AboutLibraries/issues) - [x] Checked out the [sample application](https://github.com/mikepenz/AboutLibraries/tree/develop/app) - [x] Read the [README](https://github.com/mikepenz/AboutLibraries/blob/develop/
  **Post-Mortem & Fix Analysis**:
  > @koral-- I believe that this changed with us stopping to use internal APIs which break with every single change of the android plugin to the proper available APIs from gradle which will stay more stable.   We need to setup a sample and look at it. but I believe I tested it with a newer version in one of the SDKs I help in and it worked also on sub dependencies. so not sure yet what it may be.    something implementation vs api? 
  > OK. I'll try to create a sample which reproduces this issue.  Regarding `implementation` vs `api` as I wrote in 1st post, currently there is an `implementation` and it has not changed. It starts working again if I add the same dependency with `implementation` scope to app module.
  > @mikepenz I was able to reproduce the same issue even without transitive dependency. The reason seems to be different.  Steps to reproduce: * add this dependency to app module in the sample app on current develop: `implementation group: 'com.google.zxing', name: 'core', version: '3.4.0'`  `ZXing Core (3.4.0) -> com_google_zxing__core` is printed to the console when running `findLibraries` task. However, `com_google_zxing__core` is not added to generated XML.

- **Issue #497** (2020-05-25): **UninitializedPropertyAccessException on LibsFragmentCompat**
  *Symptoms*: ## About this issue  - I have this crash from Crashlytics, only on Nexus 5X device. I don't have this physical device to try and reproduce the problem. - I'm not sure how this can be reproduced, i have no logs what user did to come to this state  ## Details - Library version: 8.1.2 - Newest stable: androidx.fragment:fragment-ktx:1.2.4 androidx.core:core-ktx:1.2.0 androidx.appcompat:appcompat:1.1.0 - Gradle 6.4.1 - Android Studio 3.6.3  I'm using gradle plugin to generate library list. Then i start activity like this ```kotlin LibsBuilder()                 .withActivityTitle("External libraries")                 .withAboutIconShown(false)                 .withVersionShown(true)                 .withSortEnabled(true)                 .withLicenseShown(true)                 .start(requireActivity()) ```  On this particular device the stack track is:  ``` Caused by kotlin.UninitializedPropertyAccessException: lateinit property builder has not been initialized        at com.mikepenz.aboutlibraries.LibsFragmentCompat.executeLibTask(LibsFragmentCompat.java:101)        at com.mikepenz.aboutlibraries.LibsFragmentCompat.onViewCreated(LibsFragmentCompat.java:95)        at com.mikepenz.aboutlibraries.ui.LibsSupportFragment.onViewCreated(LibsSupportFragment.java:24)        at androidx.fragment.app.FragmentStateManager.createView(FragmentStateManager.java:332)        at androidx.fragment.app.FragmentManager.moveToState(FragmentManager.java:1187)        at andr
  **Post-Mortem & Fix Analysis**:
  > Hmmm seems it creates the view without the arguments on that phone :O  https://github.com/mikepenz/AboutLibraries/blob/develop/library/src/main/java/com/mikepenz/aboutlibraries/LibsFragmentCompat.kt#L51-L52  and then we don't verify here if the builder got initialized: https://github.com/mikepenz/AboutLibraries/blob/develop/library/src/main/java/com/mikepenz/aboutlibraries/LibsFragmentCompat.kt#L101  We can account for that, but then it still would be empty for that user I suppose
  > Yea, i probably have to get this device just to check what the heck is going on there :)
  > what version of android is it running? perhaps it's somehow related to this?

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

### Incident Patch 1: `c4f5c747` (2026-10-05)
**Commit Message**: fix(deps): update dependency com.mikepenz:version-catalog to v0.21.0 (#1468)

Co-authored-by: renovate-mike[bot] <274037420+renovate-mike[bot]@users.noreply.github.com>

**File**: `plugin-build/settings.gradle.kts` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ dependencyResolutionManagement {
             from(files("../gradle/libs.versions.toml"))
         }
         create("baseLibs") {
-            from("com.mikepenz:version-catalog:0.20.0")
+            from("com.mikepenz:version-catalog:0.21.0")
         }
     }
 }
\ No newline at end of file
```

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ dependencyResolutionManagement {
 
     versionCatalogs {
         create("baseLibs") {
-            from("com.mikepenz:version-catalog:0.20.0")
+            from("com.mikepenz:version-catalog:0.21.0")
         }
     }
 }
```

---

### Incident Patch 2: `668f9b0a` (2026-09-27)
**Commit Message**: Merge pull request #1466 from cketti/log-stacktrace

Log stack trace when loading resource fails

**File**: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidExtensions.kt` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ fun Libs.Builder.withJson(ctx: Context, rawResId: Int): Libs.Builder {
             "AboutLibraries", """
             Unable to retrieve library information given the `raw` resource identifier. 
             Please make sure either the gradle plugin is properly set up, or the file is manually provided. 
-        """.trimIndent()
+        """.trimIndent(), t
         )
         println("Could not retrieve libraries")
     }
```

---

### Incident Patch 3: `9aaed991` (2026-09-25)
**Commit Message**: Log stack trace when loading resource fails

**File**: `aboutlibraries-core/src/androidMain/kotlin/com/mikepenz/aboutlibraries/util/AndroidExtensions.kt` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ fun Libs.Builder.withJson(ctx: Context, rawResId: Int): Libs.Builder {
             "AboutLibraries", """
             Unable to retrieve library information given the `raw` resource identifier. 
             Please make sure either the gradle plugin is properly set up, or the file is manually provided. 
-        """.trimIndent()
+        """.trimIndent(), t
         )
         println("Could not retrieve libraries")
     }
```

---

### Incident Patch 4: `5f4eebaf` (2026-08-24)
**Commit Message**: fix(deps): update dependency com.squareup.okhttp3:okhttp to v5.5.0

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ itemAnimators = "1.1.0"
 ivy = "2.6.0"
 modelBuilder = "3.9.16"
 materialDrawer = "9.0.2"
-okhttp = "5.4.0"
+okhttp = "5.5.0"
 dejavu = "0.3.1"
 
 [plugins]
```

---

### Incident Patch 5: `c46f2312` (2026-08-21)
**Commit Message**: Merge pull request #1454 from mikepenz/fix/platform-suffix-allowlist

fix(plugin): only merge artifact suffixes that name a Kotlin target

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +24/-1)
```diff
@@ -85,12 +85,35 @@ private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
     val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
     for (library in sortedBy { it.module().length }) {
         val module = library.module()
-        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        val cluster = clusters.firstOrNull { (root, _) -> module.isPlatformArtifactOf(root) }
         if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
     }
     return clusters.map { it.second }
 }
 
+/**
+ * Kotlin target names as they appear in a published artifact id, lowercased: the fixed targets, the
+ * Compose/Kotlin publication suffixes, and the native target families (`linuxx64`,
+ * `iossimulatorarm64`, `watchosdevicearm64`, …).
+ */
+private val PLATFORM_SUFFIX = Regex(
+    "jvm[a-z0-9]*|android|js|wasm-?(js|wasi)|desktop|uikit|native|metadata|common|" +
+        "(linux|mingw|macos|ios|watchos|tvos|androidnative)[a-z0-9]*"
+)
+
+/**
+ * Whether this module id looks like a platform artifact of [root] — the root id plus a Kotlin
+ * target suffix (`collection` → `collection-jvm`).
+ *
+ * Matching the suffix against known target names rather than accepting any suffix is what keeps a
+ * sibling module from being swallowed by a shorter one it happens to share a prefix with
+ * (`androidx.core:core` must not absorb `core-ktx`, a `com.foo:android` module must not absorb
+ * `android-core`). An unknown target name degrades to reporting the artifact separately, which is
+ * the same output as before merging — never to a wrong merge.
+ */
+private fun String.isPlatformArtifactOf(root: String): Boolean =
+    startsWith("$root-") && PLATFORM_SUFFIX.matches(substring(root.length + 1))
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +51/-0)
```diff
@@ -160,4 +160,55 @@ class LibraryUtilTest {
 
         assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
     }
+
+    @Test
+    fun `native and web platform artifacts are merged too`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-iossimulatorarm64", "collection"),
+            library("androidx.collection:collection-linuxx64", "collection"),
+            library("androidx.collection:collection-wasm-js", "collection"),
+            library("androidx.collection:collection-jvmstubs", "collection"),
+            library("androidx.collection:collection-desktop", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+
+    /**
+     * A sibling module whose id happens to start with a shorter module's id is not a platform
+     * artifact of it — only a known Kotlin target suffix makes one.
+     */
+    @Test
+    fun `a shorter sibling module does not absorb the ones it prefixes`() {
+        val libraries = listOf(
+            library("com.foo:android", "Foo"),
+            library("com.foo:android-core", "Foo"),
+            library("com.foo:android-core-jvm", "Foo"),
+            library("com.foo:android-extra", "Foo"),
+            library("com.foo:android-extra-jvm", "Foo"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.foo:android", "com.foo:android-core", "com.foo:android-extra"),
+            result.map { it.uniqueId }.toSet(),
+            "each module keeps its own entry, absorbing only its own platform artifact",
+        )
+    }
+
+    @Test
+    fun `a non-target suffix is not treated as a platform artifact`() {
+        val libraries = listOf(
+            library("androidx.core:core", "Core"),
+            library("androidx.core:core-ktx", "Core"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
+    }
 }
```

---

### Incident Patch 6: `2509d3a1` (2026-08-21)
**Commit Message**: Merge pull request #1453 from mikepenz/fix/link-mode-associated

fix(plugin): `DuplicateMode.LINK` associated itself instead of its siblings

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ fun List<Library>.processDuplicates(
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
-                        it.associated = allAssociated.filter { a -> a == it.uniqueId }
+                        // the *other* members of the group — a library is not associated to itself
+                        it.associated = allAssociated.filter { a -> a != it.uniqueId }
                     }
                 }
             }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +108/-1)
```diff
@@ -8,7 +8,12 @@ import org.junit.jupiter.api.Test
 
 class LibraryUtilTest {
 
-    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+    private fun library(
+        uniqueId: String,
+        name: String,
+        description: String = "Material You dynamic color",
+        licenses: Set<String> = setOf("Apache-2.0"),
+    ) = Library(
         uniqueId = uniqueId,
         artifactVersion = "5.0.0",
         name = name,
@@ -17,6 +22,7 @@ class LibraryUtilTest {
         developers = emptyList(),
         organization = null,
         scm = null,
+        licenses = licenses,
     )
 
     /**
@@ -53,4 +59,105 @@ class LibraryUtilTest {
 
         assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
     }
+
+    @Test
+    fun `KEEP reports every coordinate untouched`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.KEEP, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId })
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    @Test
+    fun `LINK keeps every coordinate and cross-references the others`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId }, "LINK must not drop anything")
+        // a library is associated to its siblings, never to itself
+        assertEquals(
+            listOf(
+                setOf("androidx.collection:collection-jvm", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-jvm"),
+            ),
+            result.map { it.associated?.toSet() },
+        )
+    }
+
+    @Test
+    fun `LINK leaves a library without siblings unassociated`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("com.google.code.gson:gson", "Gson"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    /** [DuplicateRule.SIMPLE] matches on group + name, so a differing description must not split. */
+    @Test
+    fun `SIMPLE ignores the description EXACT distinguishes on`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Standalone efficient collections."),
+            library("androidx.collection:collection-jvm", "collection", description = "Collections, but for the JVM."),
+        )
+
+        assertEquals(
+            listOf("androidx.collection:collection"),
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.SIMPLE).map { it.uniqueId },
+        )
+        assertEquals(
+            libraries.map { it.uniqueId },
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT).map { it.uniqueId },
+            "differing descriptions are distinct under EXACT",
+        )
+    }
+
+    /** [DuplicateRule.GROUP] matches on group + licenses alone, ignoring name and description. */
+    @Test
+    fun `GROUP matches on licenses regardless of name`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Collections"),
+            library("androidx.collection:collection-jvm", "Collection for JVM", description = "Collections for the JVM"),
+            library("androidx.collection:collection-ktx", "Collection KTX", licenses = setOf("MIT")),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.GROUP)
+
+        assertEquals(
+            setOf("androidx.collection:collection", "androidx.collection:collection-ktx"),
+            result.map { it.uniqueId }.toSet(),
+            "the two Apache-2.0 artifacts merge, the MIT one stays on its own",
+        )
+    }
+
+    /**
+     * The coarser rules match far more libraries, so the module-id clustering that keeps sibling
+     * modules apart has to hold for them too — group + licenses alone would otherwise collapse a
+     * whole group onto one entry.
+     */
+    @Test
+    fun `GROUP does not merge unrelated modules sharing a license`() {
+        val libraries = listOf(
+       
```

---

### Incident Patch 7: `06f96cda` (2026-08-21)
**Commit Message**: fix(plugin): only merge suffixes that name a Kotlin target

Clustering by "root id plus any suffix" merged a sibling module into a shorter
one it happened to share a prefix with: `androidx.core:core-ktx` collapsed into
`core`, and a `com.foo:android` module absorbed `android-core` / `android-extra`
whole.

Require the suffix to be a Kotlin target name as published (`jvm`, `android`,
`js`, `wasm-js`, `desktop`, `linuxx64`, `iossimulatorarm64`, …). An unrecognized
target degrades to reporting the artifact separately — the pre-merge output —
never to a wrong merge.

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +24/-1)
```diff
@@ -85,12 +85,35 @@ private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
     val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
     for (library in sortedBy { it.module().length }) {
         val module = library.module()
-        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        val cluster = clusters.firstOrNull { (root, _) -> module.isPlatformArtifactOf(root) }
         if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
     }
     return clusters.map { it.second }
 }
 
+/**
+ * Kotlin target names as they appear in a published artifact id, lowercased: the fixed targets, the
+ * Compose/Kotlin publication suffixes, and the native target families (`linuxx64`,
+ * `iossimulatorarm64`, `watchosdevicearm64`, …).
+ */
+private val PLATFORM_SUFFIX = Regex(
+    "jvm[a-z0-9]*|android|js|wasm-?(js|wasi)|desktop|uikit|native|metadata|common|" +
+        "(linux|mingw|macos|ios|watchos|tvos|androidnative)[a-z0-9]*"
+)
+
+/**
+ * Whether this module id looks like a platform artifact of [root] — the root id plus a Kotlin
+ * target suffix (`collection` → `collection-jvm`).
+ *
+ * Matching the suffix against known target names rather than accepting any suffix is what keeps a
+ * sibling module from being swallowed by a shorter one it happens to share a prefix with
+ * (`androidx.core:core` must not absorb `core-ktx`, a `com.foo:android` module must not absorb
+ * `android-core`). An unknown target name degrades to reporting the artifact separately, which is
+ * the same output as before merging — never to a wrong merge.
+ */
+private fun String.isPlatformArtifactOf(root: String): Boolean =
+    startsWith("$root-") && PLATFORM_SUFFIX.matches(substring(root.length + 1))
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +51/-0)
```diff
@@ -160,4 +160,55 @@ class LibraryUtilTest {
 
         assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
     }
+
+    @Test
+    fun `native and web platform artifacts are merged too`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-iossimulatorarm64", "collection"),
+            library("androidx.collection:collection-linuxx64", "collection"),
+            library("androidx.collection:collection-wasm-js", "collection"),
+            library("androidx.collection:collection-jvmstubs", "collection"),
+            library("androidx.collection:collection-desktop", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+
+    /**
+     * A sibling module whose id happens to start with a shorter module's id is not a platform
+     * artifact of it — only a known Kotlin target suffix makes one.
+     */
+    @Test
+    fun `a shorter sibling module does not absorb the ones it prefixes`() {
+        val libraries = listOf(
+            library("com.foo:android", "Foo"),
+            library("com.foo:android-core", "Foo"),
+            library("com.foo:android-core-jvm", "Foo"),
+            library("com.foo:android-extra", "Foo"),
+            library("com.foo:android-extra-jvm", "Foo"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.foo:android", "com.foo:android-core", "com.foo:android-extra"),
+            result.map { it.uniqueId }.toSet(),
+            "each module keeps its own entry, absorbing only its own platform artifact",
+        )
+    }
+
+    @Test
+    fun `a non-target suffix is not treated as a platform artifact`() {
+        val libraries = listOf(
+            library("androidx.core:core", "Core"),
+            library("androidx.core:core-ktx", "Core"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }.toSet(), result.map { it.uniqueId }.toSet())
+    }
 }
```

---

### Incident Patch 8: `d65ecf0f` (2026-08-21)
**Commit Message**: fix(plugin): `DuplicateMode.LINK` associated itself instead of its siblings

`associated` is documented as "references all associated libraries", but the
filter kept only the entry equal to the library's own `uniqueId` — every linked
library ended up with a single-element list pointing at itself. The field is
serialized into `aboutlibraries.json`, so the wrong value shipped.

Also adds unit coverage for the duplicate handling that had none: `LINK`,
`KEEP`, and the `SIMPLE` / `GROUP` rules.

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ fun List<Library>.processDuplicates(
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
-                        it.associated = allAssociated.filter { a -> a == it.uniqueId }
+                        // the *other* members of the group — a library is not associated to itself
+                        it.associated = allAssociated.filter { a -> a != it.uniqueId }
                     }
                 }
             }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (modified, +108/-1)
```diff
@@ -8,7 +8,12 @@ import org.junit.jupiter.api.Test
 
 class LibraryUtilTest {
 
-    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+    private fun library(
+        uniqueId: String,
+        name: String,
+        description: String = "Material You dynamic color",
+        licenses: Set<String> = setOf("Apache-2.0"),
+    ) = Library(
         uniqueId = uniqueId,
         artifactVersion = "5.0.0",
         name = name,
@@ -17,6 +22,7 @@ class LibraryUtilTest {
         developers = emptyList(),
         organization = null,
         scm = null,
+        licenses = licenses,
     )
 
     /**
@@ -53,4 +59,105 @@ class LibraryUtilTest {
 
         assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
     }
+
+    @Test
+    fun `KEEP reports every coordinate untouched`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.KEEP, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId })
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    @Test
+    fun `LINK keeps every coordinate and cross-references the others`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(libraries.map { it.uniqueId }, result.map { it.uniqueId }, "LINK must not drop anything")
+        // a library is associated to its siblings, never to itself
+        assertEquals(
+            listOf(
+                setOf("androidx.collection:collection-jvm", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-js"),
+                setOf("androidx.collection:collection", "androidx.collection:collection-jvm"),
+            ),
+            result.map { it.associated?.toSet() },
+        )
+    }
+
+    @Test
+    fun `LINK leaves a library without siblings unassociated`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection"),
+            library("com.google.code.gson:gson", "Gson"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.LINK, DuplicateRule.EXACT)
+
+        assertEquals(listOf(null, null), result.map { it.associated })
+    }
+
+    /** [DuplicateRule.SIMPLE] matches on group + name, so a differing description must not split. */
+    @Test
+    fun `SIMPLE ignores the description EXACT distinguishes on`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Standalone efficient collections."),
+            library("androidx.collection:collection-jvm", "collection", description = "Collections, but for the JVM."),
+        )
+
+        assertEquals(
+            listOf("androidx.collection:collection"),
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.SIMPLE).map { it.uniqueId },
+        )
+        assertEquals(
+            libraries.map { it.uniqueId },
+            libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT).map { it.uniqueId },
+            "differing descriptions are distinct under EXACT",
+        )
+    }
+
+    /** [DuplicateRule.GROUP] matches on group + licenses alone, ignoring name and description. */
+    @Test
+    fun `GROUP matches on licenses regardless of name`() {
+        val libraries = listOf(
+            library("androidx.collection:collection", "collection", description = "Collections"),
+            library("androidx.collection:collection-jvm", "Collection for JVM", description = "Collections for the JVM"),
+            library("androidx.collection:collection-ktx", "Collection KTX", licenses = setOf("MIT")),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.GROUP)
+
+        assertEquals(
+            setOf("androidx.collection:collection", "androidx.collection:collection-ktx"),
+            result.map { it.uniqueId }.toSet(),
+            "the two Apache-2.0 artifacts merge, the MIT one stays on its own",
+        )
+    }
+
+    /**
+     * The coarser rules match far more libraries, so the module-id clustering that keeps sibling
+     * modules apart has to hold for them too — group + licenses alone would otherwise collapse a
+     * whole group onto one entry.
+     */
+    @Test
+    fun `GROUP does not merge unrelated modules sharing a license`() {
+        val libraries = listOf(
+       
```

---

### Incident Patch 9: `2d736858` (2026-08-21)
**Commit Message**: Merge pull request #1452 from mikepenz/fix/duplicate-merge-sibling-modules

fix(plugin): don't merge sibling modules sharing POM name and description

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +37/-6)
```diff
@@ -10,23 +10,27 @@ fun List<Library>.processDuplicates(
     duplicateMode: DuplicateMode,
     duplicateRule: DuplicateRule,
 ): List<Library> {
-    fun mappedLibs(): Map<String, List<Library>> {
+    fun mappedLibs(): List<List<Library>> {
         return this.groupBy {
             when (duplicateRule) {
                 DuplicateRule.GROUP -> it.groupId + it.licenses.joinToString(",")
                 DuplicateRule.SIMPLE -> it.groupId + it.name
                 DuplicateRule.EXACT -> it.groupId + it.name + it.description?.toMD5()
             }
-        }
+        }.values.flatMap { it.clusterByArtifactId() }
     }
 
     when (duplicateMode) {
         DuplicateMode.MERGE -> {
             val deDuplicatedList = mutableListOf<Library>()
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 val kept = if (group.size > 1) {
-                    // on duplicates, assumption is the shorter title is the base dependency
-                    group.minByOrNull { it.name?.length ?: it.description?.length ?: Int.MAX_VALUE } ?: group.first()
+                    // on duplicates, assumption is the shorter title is the base dependency; on a
+                    // tie (a KMP publication names every platform artifact identically) the
+                    // shortest id is the root module the others are platform variants of
+                    group.minWithOrNull(
+                        compareBy({ it.name?.length ?: it.description?.length ?: Int.MAX_VALUE }, { it.uniqueId.length })
+                    ) ?: group.first()
                 } else {
                     group.first()
                 }
@@ -41,7 +45,7 @@ fun List<Library>.processDuplicates(
         }
 
         DuplicateMode.LINK -> {
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
@@ -59,6 +63,33 @@ fun List<Library>.processDuplicates(
     }
 }
 
+/**
+ * Splits libraries the [DuplicateRule] considered equal into clusters that really are one library
+ * published under several coordinates: a Kotlin Multiplatform publication such as
+ * `androidx.collection:collection` + `collection-jvm`, where the platform artifact id is the root
+ * id plus a target suffix.
+ *
+ * Sibling modules of one project routinely share the POM `name` and `description` — e.g.
+ * `com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`, both named
+ * "MaterialKolor" with the same description. Those are distinct libraries, and merging them
+ * silently dropped one of them.
+ */
+private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
+    if (size < 2) return listOf(this)
+    // `Library.artifactId` is the full `group:artifact:version` — the module name is what a
+    // platform suffix is appended to
+    fun Library.module() = uniqueId.substringAfterLast(':')
+
+    // shortest first, so the root module is the one every platform artifact attaches to
+    val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
+    for (library in sortedBy { it.module().length }) {
+        val module = library.module()
+        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
+    }
+    return clusters.map { it.second }
+}
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/KmpAndroidFunctionalTest.kt` (modified, +3/-2)
```diff
@@ -111,8 +111,9 @@ class KmpAndroidFunctionalTest {
         val content = File(projectDir, "build/generated/aboutLibraries/aboutlibraries.json").readText()
         val gson = extractLibraryEntry(content, "com.google.code.gson:gson")
             ?: error("gson entry not found in output: $content")
-        // resolves through the KMP `available-at` redirect, so it lands under its platform artifact
-        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation-jvm")
+        // resolves through the KMP `available-at` redirect; the redirect shell and the platform
+        // artifact are merged onto the root module they share
+        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation")
             ?: error("androidx.annotation entry not found in output: $content")
 
         // no raw configuration name may leak into the field
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +4/-2)
```diff
@@ -97,10 +97,12 @@ class MergePlatformArtifactsFunctionalTest {
             ?: error("expected the declared root coordinate to be reported")
         assertEquals(setOf("js", "jvm"), targetsOf(merged) - "metadata", "Entry: $merged")
 
+        // without merging the platform artifacts are still collapsed by `DuplicateMode.MERGE`, but
+        // only into the root module they are variants of — their own ids are gone either way
         val unmerged = runKmpExport(mergePlatformArtifacts = false)
         assertFalse(
-            unmerged.contains("\"uniqueId\":\"androidx.collection:collection\","),
-            "without merging the survivor is a platform artifact, not the root. Output:\n$unmerged"
+            unmerged.contains("\"uniqueId\":\"androidx.collection:collection-js\","),
+            "platform artifacts must not survive the duplicate merge. Output:\n$unmerged"
         )
     }
 
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package com.mikepenz.aboutlibraries.plugin.util
+
+import com.mikepenz.aboutlibraries.plugin.DuplicateMode
+import com.mikepenz.aboutlibraries.plugin.DuplicateRule
+import com.mikepenz.aboutlibraries.plugin.mapping.Library
+import org.junit.jupiter.api.Assertions.assertEquals
+import org.junit.jupiter.api.Test
+
+class LibraryUtilTest {
+
+    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+        uniqueId = uniqueId,
+        artifactVersion = "5.0.0",
+        name = name,
+        description = description,
+        website = null,
+        developers = emptyList(),
+        organization = null,
+        scm = null,
+    )
+
+    /**
+     * https://github.com/mikepenz/AboutLibraries/issues/1430 — sibling modules of one project share
+     * the POM `name` and `description`, which made every duplicate rule consider them equal. Only
+     * the platform artifacts of the *same* module may be merged.
+     */
+    @Test
+    fun `sibling modules sharing name and description are not merged`() {
+        val libraries = listOf(
+            library("com.materialkolor:material-kolor", "MaterialKolor"),
+            library("com.materialkolor:material-kolor-jvm", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities-jvm", "MaterialKolor"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.materialkolor:material-kolor", "com.materialkolor:material-color-utilities"),
+            result.map { it.uniqueId }.toSet(),
+        )
+    }
+
+    @Test
+    fun `platform artifacts of the same module are still merged`() {
+        val libraries = listOf(
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+}
```

---

### Incident Patch 10: `ec37f40b` (2026-08-21)
**Commit Message**: fix(plugin): don't merge sibling modules sharing POM name and description

`DuplicateMode.MERGE` grouped libraries by `groupId + name + description`,
which collapsed distinct sibling modules of the same project onto a single
entry — one of them silently disappeared from the output.

`com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`
both publish `<name>MaterialKolor</name>` with the same description, so only one
of the two was reported (independent of `mergePlatformArtifacts`).

Sub-cluster each duplicate group by module id, so only actual platform variants
of the same module are merged (`collection` + `collection-jvm`), never sibling
modules. The surviving entry now breaks name-length ties on the shortest
uniqueId, making the root module the deterministic survivor of a KMP merge.

Fixes #1430

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +37/-6)
```diff
@@ -10,23 +10,27 @@ fun List<Library>.processDuplicates(
     duplicateMode: DuplicateMode,
     duplicateRule: DuplicateRule,
 ): List<Library> {
-    fun mappedLibs(): Map<String, List<Library>> {
+    fun mappedLibs(): List<List<Library>> {
         return this.groupBy {
             when (duplicateRule) {
                 DuplicateRule.GROUP -> it.groupId + it.licenses.joinToString(",")
                 DuplicateRule.SIMPLE -> it.groupId + it.name
                 DuplicateRule.EXACT -> it.groupId + it.name + it.description?.toMD5()
             }
-        }
+        }.values.flatMap { it.clusterByArtifactId() }
     }
 
     when (duplicateMode) {
         DuplicateMode.MERGE -> {
             val deDuplicatedList = mutableListOf<Library>()
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 val kept = if (group.size > 1) {
-                    // on duplicates, assumption is the shorter title is the base dependency
-                    group.minByOrNull { it.name?.length ?: it.description?.length ?: Int.MAX_VALUE } ?: group.first()
+                    // on duplicates, assumption is the shorter title is the base dependency; on a
+                    // tie (a KMP publication names every platform artifact identically) the
+                    // shortest id is the root module the others are platform variants of
+                    group.minWithOrNull(
+                        compareBy({ it.name?.length ?: it.description?.length ?: Int.MAX_VALUE }, { it.uniqueId.length })
+                    ) ?: group.first()
                 } else {
                     group.first()
                 }
@@ -41,7 +45,7 @@ fun List<Library>.processDuplicates(
         }
 
         DuplicateMode.LINK -> {
-            mappedLibs().forEach { (_, group) ->
+            mappedLibs().forEach { group ->
                 if (group.size > 1) {
                     val allAssociated = group.map { it.uniqueId }
                     group.forEach {
@@ -59,6 +63,33 @@ fun List<Library>.processDuplicates(
     }
 }
 
+/**
+ * Splits libraries the [DuplicateRule] considered equal into clusters that really are one library
+ * published under several coordinates: a Kotlin Multiplatform publication such as
+ * `androidx.collection:collection` + `collection-jvm`, where the platform artifact id is the root
+ * id plus a target suffix.
+ *
+ * Sibling modules of one project routinely share the POM `name` and `description` — e.g.
+ * `com.materialkolor:material-kolor` and `com.materialkolor:material-color-utilities`, both named
+ * "MaterialKolor" with the same description. Those are distinct libraries, and merging them
+ * silently dropped one of them.
+ */
+private fun List<Library>.clusterByArtifactId(): List<List<Library>> {
+    if (size < 2) return listOf(this)
+    // `Library.artifactId` is the full `group:artifact:version` — the module name is what a
+    // platform suffix is appended to
+    fun Library.module() = uniqueId.substringAfterLast(':')
+
+    // shortest first, so the root module is the one every platform artifact attaches to
+    val clusters = mutableListOf<Pair<String, MutableList<Library>>>() // root module -> members
+    for (library in sortedBy { it.module().length }) {
+        val module = library.module()
+        val cluster = clusters.firstOrNull { (root, _) -> module.startsWith("$root-") }
+        if (cluster != null) cluster.second += library else clusters += module to mutableListOf(library)
+    }
+    return clusters.map { it.second }
+}
+
 fun Library.merge(with: Library) {
     val orgLib = this
     with.name?.takeIf { it.isNotBlank() }?.also { orgLib.name = it }
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/KmpAndroidFunctionalTest.kt` (modified, +3/-2)
```diff
@@ -111,8 +111,9 @@ class KmpAndroidFunctionalTest {
         val content = File(projectDir, "build/generated/aboutLibraries/aboutlibraries.json").readText()
         val gson = extractLibraryEntry(content, "com.google.code.gson:gson")
             ?: error("gson entry not found in output: $content")
-        // resolves through the KMP `available-at` redirect, so it lands under its platform artifact
-        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation-jvm")
+        // resolves through the KMP `available-at` redirect; the redirect shell and the platform
+        // artifact are merged onto the root module they share
+        val annotation = extractLibraryEntry(content, "androidx.annotation:annotation")
             ?: error("androidx.annotation entry not found in output: $content")
 
         // no raw configuration name may leak into the field
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +4/-2)
```diff
@@ -97,10 +97,12 @@ class MergePlatformArtifactsFunctionalTest {
             ?: error("expected the declared root coordinate to be reported")
         assertEquals(setOf("js", "jvm"), targetsOf(merged) - "metadata", "Entry: $merged")
 
+        // without merging the platform artifacts are still collapsed by `DuplicateMode.MERGE`, but
+        // only into the root module they are variants of — their own ids are gone either way
         val unmerged = runKmpExport(mergePlatformArtifacts = false)
         assertFalse(
-            unmerged.contains("\"uniqueId\":\"androidx.collection:collection\","),
-            "without merging the survivor is a platform artifact, not the root. Output:\n$unmerged"
+            unmerged.contains("\"uniqueId\":\"androidx.collection:collection-js\","),
+            "platform artifacts must not survive the duplicate merge. Output:\n$unmerged"
         )
     }
 
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtilTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package com.mikepenz.aboutlibraries.plugin.util
+
+import com.mikepenz.aboutlibraries.plugin.DuplicateMode
+import com.mikepenz.aboutlibraries.plugin.DuplicateRule
+import com.mikepenz.aboutlibraries.plugin.mapping.Library
+import org.junit.jupiter.api.Assertions.assertEquals
+import org.junit.jupiter.api.Test
+
+class LibraryUtilTest {
+
+    private fun library(uniqueId: String, name: String, description: String = "Material You dynamic color") = Library(
+        uniqueId = uniqueId,
+        artifactVersion = "5.0.0",
+        name = name,
+        description = description,
+        website = null,
+        developers = emptyList(),
+        organization = null,
+        scm = null,
+    )
+
+    /**
+     * https://github.com/mikepenz/AboutLibraries/issues/1430 — sibling modules of one project share
+     * the POM `name` and `description`, which made every duplicate rule consider them equal. Only
+     * the platform artifacts of the *same* module may be merged.
+     */
+    @Test
+    fun `sibling modules sharing name and description are not merged`() {
+        val libraries = listOf(
+            library("com.materialkolor:material-kolor", "MaterialKolor"),
+            library("com.materialkolor:material-kolor-jvm", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities", "MaterialKolor"),
+            library("com.materialkolor:material-color-utilities-jvm", "MaterialKolor"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(
+            setOf("com.materialkolor:material-kolor", "com.materialkolor:material-color-utilities"),
+            result.map { it.uniqueId }.toSet(),
+        )
+    }
+
+    @Test
+    fun `platform artifacts of the same module are still merged`() {
+        val libraries = listOf(
+            library("androidx.collection:collection-jvm", "collection"),
+            library("androidx.collection:collection", "collection"),
+            library("androidx.collection:collection-js", "collection"),
+        )
+
+        val result = libraries.processDuplicates(DuplicateMode.MERGE, DuplicateRule.EXACT)
+
+        assertEquals(listOf("androidx.collection:collection"), result.map { it.uniqueId })
+    }
+}
```

---

### Incident Patch 11: `4f7f4446` (2026-08-17)
**Commit Message**: Merge pull request #1448 from mikepenz/fix/merge-platform-artifacts-native-targets

fix(plugin): keep the KMP root module when `mergePlatformArtifacts` merges

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/AboutLibrariesExtension.kt` (modified, +4/-1)
```diff
@@ -470,7 +470,10 @@ abstract class LibraryConfig @Inject constructor() {
      * such root module (e.g. `androidx.annotation:annotation-jvm` in a graph that never resolves
      * `androidx.annotation:annotation`) is untouched — but once the root module is present, the
      * platform artifact is reported under it even where it was declared directly.
-     * Metadata (name, description, licenses) still comes from the resolved artifact.
+     * Metadata (name, description, licenses) comes from the root module's POM, which a Kotlin
+     * Multiplatform publication fills in identically to its platform artifacts'. It is also the
+     * only POM available for Kotlin/Native targets: a klib platform artifact resolves to no POM
+     * at all, so the root module is what keeps such a dependency (and its `targets`) reported.
      *
      * This is independent of [duplicationMode] / [duplicationRule] and applied before them. Note
      * that the default [DuplicateMode.MERGE] already collapses these artifacts onto *one* entry —
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/DependencyCollector.kt` (modified, +10/-3)
```diff
@@ -90,15 +90,22 @@ internal class DependencyCollector(
         val id = root.id
         // Non-null when this component is a pure Gradle `available-at` redirect (a KMP root module
         // such as `androidx.collection:collection` pointing at `androidx.collection:collection-jvm`).
-        // With `mergePlatformArtifacts` the shell itself is dropped and its module name is
-        // recorded, so the artifact it points at can be reported under the declared coordinate.
+        // With `mergePlatformArtifacts` its module name is recorded, so the artifact it points at
+        // can be reported under the declared coordinate.
         val redirectTarget = if (mergePlatformArtifacts) root.redirectTargetModule() else null
         var ignoreSuffix: String? = null
         when {
             redirectTarget != null -> {
                 id as ModuleComponentIdentifier
                 redirects["${id.group}:$redirectTarget"] = id.module
-                ignoreSuffix = " merge platform artifact $redirectTarget into ${id.module}"
+                // The shell is kept, not dropped: its coordinate already *is* the declared root id,
+                // so it deduplicates against the platform artifact rather than adding an entry. It
+                // is also the only one that survives for Kotlin/Native targets — a klib platform
+                // artifact (`…-iossimulatorarm64`) cannot be resolved by the attribute-less
+                // detached configuration that fetches POMs, so it yields no metadata and, without
+                // the shell, the dependency (and its `targets`) would vanish entirely.
+                destination += id.toDependencyCoordinates()
+                ignoreSuffix =" merge platform artifact $redirectTarget into ${id.module}"
             }
 
             id is ProjectComponentIdentifier -> {
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +31/-4)
```diff
@@ -104,6 +104,30 @@ class MergePlatformArtifactsFunctionalTest {
         )
     }
 
+    /**
+     * A Kotlin/Native platform artifact (`androidx.collection:collection-linuxx64`) is a klib
+     * module: the attribute-less detached configuration that fetches POMs cannot choose between its
+     * variants, so it resolves to no POM and produces no metadata at all. Merging must therefore
+     * keep the `available-at` shell rather than trading it for an artifact that evaporates —
+     * otherwise the dependency loses its native `targets`, and a native-only one disappears.
+     *
+     * `filterVariants` narrows collection to the two target compile classpaths, which is what makes
+     * the loss observable: with every configuration collected the `metadata` one still contributes
+     * the root coordinate directly and masks it.
+     */
+    @Test
+    fun `native targets survive merging even though their platform artifact has no resolvable POM`() {
+        val json = runKmpExport(
+            mergePlatformArtifacts = true,
+            targets = listOf("jvm()", "iosSimulatorArm64()"),
+            collect = """all = true; includeTargets = true; filterVariants.addAll("jvmCompileClasspath", "iosSimulatorArm64CompileKlibraries")""",
+        )
+        val merged = extractEntry(json, "androidx.collection:collection")
+            ?: error("expected the declared root coordinate to be reported. Output:\n$json")
+
+        assertEquals(setOf("iosSimulatorArm64", "jvm"), targetsOf(merged), "Entry: $merged")
+    }
+
     private fun targetsOf(entry: String): Set<String> =
         Regex("\"targets\":\\[(.*?)]").find(entry)?.groupValues?.get(1)
             ?.split(",")?.mapNotNull { it.trim().trim('"').takeIf(String::isNotEmpty) }?.toSet()
@@ -130,7 +154,11 @@ class MergePlatformArtifactsFunctionalTest {
      * to `collection-jvm` on one and `collection-js` on the other. `duplicationMode` is left at its
      * default here — the point is what a normal consumer sees.
      */
-    private fun runKmpExport(mergePlatformArtifacts: Boolean): String {
+    private fun runKmpExport(
+        mergePlatformArtifacts: Boolean,
+        targets: List<String> = listOf("jvm()", "js { nodejs() }"),
+        collect: String = "includeTargets = true",
+    ): String {
         File(projectDir, "settings.gradle.kts").writeText(
             """
             pluginManagement { repositories { gradlePluginPortal(); mavenCentral(); google() } }
@@ -153,16 +181,15 @@ class MergePlatformArtifactsFunctionalTest {
             repositories { mavenCentral(); google() }
 
             extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension> {
-                jvm()
-                js { nodejs() }
+                ${targets.joinToString("\n                ")}
                 sourceSets.getByName("commonMain").dependencies {
                     implementation("androidx.collection:collection:1.5.0")
                 }
             }
 
             extensions.configure<com.mikepenz.aboutlibraries.plugin.AboutLibrariesExtension>("aboutLibraries") {
                 offlineMode = true
-                collect { includeTargets = true }
+                collect { $collect }
                 library { mergePlatformArtifacts = $mergePlatformArtifacts }
             }
             """.trimIndent()
```

---

### Incident Patch 12: `1e7972bf` (2026-08-17)
**Commit Message**: fix(plugin): keep the KMP root module when `mergePlatformArtifacts` merges

Fixes #1445 (comment)

With `mergePlatformArtifacts = true` a Kotlin/Native dependency lost its native
`targets`, and a native-only one disappeared from the output entirely:

    "uniqueId": "androidx.lifecycle:lifecycle-viewmodel-savedstate",
    "targets": ["android", "iosSimulatorArm64"]   ->   "targets": ["android"]

POMs are fetched through an attribute-less detached configuration
(`fetchPomBatch`). A klib platform artifact cannot be selected from one:

    VariantSelectionByAttributesException: Cannot choose between the available
    variants of androidx.savedstate:savedstate-iossimulatorarm64:1.4.0

`artifactView { lenient(true) }` drops it silently, `getPomInfo` then yields no
`DependencyData`, and the coordinate contributes neither metadata nor a target.
That hole predates this option — it was invisible because the `available-at`
root module resolves fine and stood in for its platform artifacts. Merging then
traded the shell for an artifact that evaporates.

The shell is now kept rather than dropped. Its coordinate already *is* the
declared root id, so it deduplicates against the platform artifact 

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/AboutLibrariesExtension.kt` (modified, +4/-1)
```diff
@@ -470,7 +470,10 @@ abstract class LibraryConfig @Inject constructor() {
      * such root module (e.g. `androidx.annotation:annotation-jvm` in a graph that never resolves
      * `androidx.annotation:annotation`) is untouched — but once the root module is present, the
      * platform artifact is reported under it even where it was declared directly.
-     * Metadata (name, description, licenses) still comes from the resolved artifact.
+     * Metadata (name, description, licenses) comes from the root module's POM, which a Kotlin
+     * Multiplatform publication fills in identically to its platform artifacts'. It is also the
+     * only POM available for Kotlin/Native targets: a klib platform artifact resolves to no POM
+     * at all, so the root module is what keeps such a dependency (and its `targets`) reported.
      *
      * This is independent of [duplicationMode] / [duplicationRule] and applied before them. Note
      * that the default [DuplicateMode.MERGE] already collapses these artifacts onto *one* entry —
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/DependencyCollector.kt` (modified, +10/-3)
```diff
@@ -90,15 +90,22 @@ internal class DependencyCollector(
         val id = root.id
         // Non-null when this component is a pure Gradle `available-at` redirect (a KMP root module
         // such as `androidx.collection:collection` pointing at `androidx.collection:collection-jvm`).
-        // With `mergePlatformArtifacts` the shell itself is dropped and its module name is
-        // recorded, so the artifact it points at can be reported under the declared coordinate.
+        // With `mergePlatformArtifacts` its module name is recorded, so the artifact it points at
+        // can be reported under the declared coordinate.
         val redirectTarget = if (mergePlatformArtifacts) root.redirectTargetModule() else null
         var ignoreSuffix: String? = null
         when {
             redirectTarget != null -> {
                 id as ModuleComponentIdentifier
                 redirects["${id.group}:$redirectTarget"] = id.module
-                ignoreSuffix = " merge platform artifact $redirectTarget into ${id.module}"
+                // The shell is kept, not dropped: its coordinate already *is* the declared root id,
+                // so it deduplicates against the platform artifact rather than adding an entry. It
+                // is also the only one that survives for Kotlin/Native targets — a klib platform
+                // artifact (`…-iossimulatorarm64`) cannot be resolved by the attribute-less
+                // detached configuration that fetches POMs, so it yields no metadata and, without
+                // the shell, the dependency (and its `targets`) would vanish entirely.
+                destination += id.toDependencyCoordinates()
+                ignoreSuffix =" merge platform artifact $redirectTarget into ${id.module}"
             }
 
             id is ProjectComponentIdentifier -> {
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/MergePlatformArtifactsFunctionalTest.kt` (modified, +31/-4)
```diff
@@ -104,6 +104,30 @@ class MergePlatformArtifactsFunctionalTest {
         )
     }
 
+    /**
+     * A Kotlin/Native platform artifact (`androidx.collection:collection-linuxx64`) is a klib
+     * module: the attribute-less detached configuration that fetches POMs cannot choose between its
+     * variants, so it resolves to no POM and produces no metadata at all. Merging must therefore
+     * keep the `available-at` shell rather than trading it for an artifact that evaporates —
+     * otherwise the dependency loses its native `targets`, and a native-only one disappears.
+     *
+     * `filterVariants` narrows collection to the two target compile classpaths, which is what makes
+     * the loss observable: with every configuration collected the `metadata` one still contributes
+     * the root coordinate directly and masks it.
+     */
+    @Test
+    fun `native targets survive merging even though their platform artifact has no resolvable POM`() {
+        val json = runKmpExport(
+            mergePlatformArtifacts = true,
+            targets = listOf("jvm()", "iosSimulatorArm64()"),
+            collect = """all = true; includeTargets = true; filterVariants.addAll("jvmCompileClasspath", "iosSimulatorArm64CompileKlibraries")""",
+        )
+        val merged = extractEntry(json, "androidx.collection:collection")
+            ?: error("expected the declared root coordinate to be reported. Output:\n$json")
+
+        assertEquals(setOf("iosSimulatorArm64", "jvm"), targetsOf(merged), "Entry: $merged")
+    }
+
     private fun targetsOf(entry: String): Set<String> =
         Regex("\"targets\":\\[(.*?)]").find(entry)?.groupValues?.get(1)
             ?.split(",")?.mapNotNull { it.trim().trim('"').takeIf(String::isNotEmpty) }?.toSet()
@@ -130,7 +154,11 @@ class MergePlatformArtifactsFunctionalTest {
      * to `collection-jvm` on one and `collection-js` on the other. `duplicationMode` is left at its
      * default here — the point is what a normal consumer sees.
      */
-    private fun runKmpExport(mergePlatformArtifacts: Boolean): String {
+    private fun runKmpExport(
+        mergePlatformArtifacts: Boolean,
+        targets: List<String> = listOf("jvm()", "js { nodejs() }"),
+        collect: String = "includeTargets = true",
+    ): String {
         File(projectDir, "settings.gradle.kts").writeText(
             """
             pluginManagement { repositories { gradlePluginPortal(); mavenCentral(); google() } }
@@ -153,16 +181,15 @@ class MergePlatformArtifactsFunctionalTest {
             repositories { mavenCentral(); google() }
 
             extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinMultiplatformExtension> {
-                jvm()
-                js { nodejs() }
+                ${targets.joinToString("\n                ")}
                 sourceSets.getByName("commonMain").dependencies {
                     implementation("androidx.collection:collection:1.5.0")
                 }
             }
 
             extensions.configure<com.mikepenz.aboutlibraries.plugin.AboutLibrariesExtension>("aboutLibraries") {
                 offlineMode = true
-                collect { includeTargets = true }
+                collect { $collect }
                 library { mergePlatformArtifacts = $mergePlatformArtifacts }
             }
             """.trimIndent()
```

---

### Incident Patch 13: `a1786001` (2026-08-14)
**Commit Message**: fix(plugin): report no `targets` for single-target projects

An Android-only module emitted `"targets":[""]` on every library. The
single-target Kotlin extensions (`kotlin("android")`, `kotlin("jvm")`) name
their only target `""` — there is no sibling to disambiguate it from — and that
empty name was passed straight through.

Skips blank target names when building the configuration→target map, and drops
the configuration-name fallback that would otherwise take over and report build
variants (`debug`, `release`) instead. Build variants are not targets, and
`export.variant` already covers splitting an Android build that way.

A single-target project compiles for exactly one target, so every library now
reports an empty `targets` array — nothing to attribute, and nothing a consumer
could filter by. Multiplatform output is unchanged: source-set level
configurations still fold into their target by prefix, so `app-test` still
reports `["jvm"]` / `["jvm","metadata","wasmJs"]`.

**File**: `README.md` (modified, +2/-0)
```diff
@@ -223,6 +223,8 @@ aboutLibraries {
         // on every library (e.g. ["android", "jvm", "iosX64"]). Target names are taken from the
         // Kotlin target model, so a consumer can narrow the rendered list to what the running
         // target links against: `libs.libraries.filter { "iosArm64" in it.targets }`.
+        // Only multiplatform projects report anything — an Android-only or JVM-only project builds
+        // a single implicit target, so every library reports an empty array.
         // Disabled by default; when disabled the `targets` field is omitted from the output entirely.
         // It can also be dropped per export via `excludeFields.add("Library.targets")`.
         includeTargets = false
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/AboutLibrariesExtension.kt` (modified, +4/-3)
```diff
@@ -246,13 +246,14 @@ abstract class CollectorConfig @Inject constructor() {
      * The reported values are Kotlin target names as declared in the `kotlin { }` block, resolved
      * from the Kotlin target model rather than from configuration names — a configuration is
      * attributed to the target whose compilation declares it as its compile or runtime classpath.
-     * Configurations that belong to no Kotlin target (a plain `java-library` project, or an
-     * AGP-only build) fall back to the configuration name with its `CompileClasspath` /
-     * `RuntimeClasspath` suffix removed, and are dropped when that leaves an empty name.
      *
      * Lets a consumer narrow the rendered list to what the running target actually links against,
      * e.g. `libs.libraries.filter { "iosArm64" in it.targets }`.
      *
+     * Only multiplatform projects report anything: an Android-only, JVM-only or `java-library`
+     * project builds a single implicit target, so every library reports an empty `targets` array.
+     * Use `export.variant` to split an Android build by build variant instead.
+     *
      * Disabled by default. If disabled, the `targets` field is omitted from the output entirely.
      *
      * ```
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/BaseAboutLibrariesTask.kt` (modified, +8/-2)
```diff
@@ -547,6 +547,11 @@ abstract class BaseAboutLibrariesTask : DefaultTask() {
  * Returns an empty map when the Kotlin plugin is not applied. The `kotlin` extension is looked up
  * by name so no Kotlin Gradle Plugin class is touched in that case — the plugin declares KGP as
  * `compileOnly`.
+ *
+ * Targets with a blank name are skipped: the single-target extensions (`kotlin("android")`,
+ * `kotlin("jvm")`) name their only target `""`, because there is no sibling to disambiguate it
+ * from. Such a project compiles for exactly one target, so there is nothing to attribute and
+ * nothing a consumer could filter by.
  */
 private fun collectKotlinTargets(extensions: ExtensionContainer): Map<String, String> {
     val kotlin = extensions.findByName("kotlin") ?: return emptyMap()
@@ -557,9 +562,10 @@ private fun collectKotlinTargets(extensions: ExtensionContainer): Map<String, St
     }
     return buildMap {
         targets.forEach { target ->
+            val name = target.targetName.takeIf { it.isNotBlank() } ?: return@forEach
             target.compilations.forEach { compilation ->
-                put(compilation.compileDependencyConfigurationName, target.targetName)
-                compilation.runtimeDependencyConfigurationName?.let { put(it, target.targetName) }
+                put(compilation.compileDependencyConfigurationName, name)
+                compilation.runtimeDependencyConfigurationName?.let { put(it, name) }
             }
         }
     }
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryPostProcessor.kt` (modified, +15/-20)
```diff
@@ -285,33 +285,28 @@ internal class LibraryPostProcessor(
     }
 
     /**
-     * Target name for a configuration no Kotlin *compilation* claims.
+     * Target name for a configuration no Kotlin *compilation* claims directly.
      *
-     * Two cases, in order:
-     *  - a KMP source-set level configuration (`jvmMainCompileClasspath`), which is folded into the
-     *    [knownTargets] entry it is named after;
-     *  - an AGP-only build (`debug`, `release`) or plain `java-library` project with no Kotlin
-     *    target model at all, where the stripped configuration name is the best available answer.
+     * Covers the source-set level configurations a multiplatform project adds alongside the
+     * compilation ones (`jvmMainCompileClasspath` next to `jvmCompileClasspath`), by folding them
+     * into the [knownTargets] entry they are named after.
      *
-     * `null` when stripping the classpath suffix leaves nothing (`compileClasspath` on a non-Kotlin
-     * project — a single implicit target, so there is nothing to filter by), or when a Kotlin
-     * target model exists but none of its targets matches: inventing a target name there would
-     * produce a value no consumer can ever match against.
+     * `null` for anything else. A configuration that matches no declared target is not evidence of
+     * an undeclared one — an Android-only or `java-library` project builds a single implicit
+     * target, and naming it after its build variant (`debug`, `release`) would emit a value no
+     * consumer could ever match against. That is what `export.variant` is for.
      */
     private fun String.toFallbackTargetName(knownTargets: List<String>): String? {
-        val stripped = stripClasspathSuffix() ?: return null
-        if (knownTargets.isEmpty()) return stripped
+        // matched case-insensitively: an unprefixed config is `compileClasspath`, a prefixed one
+        // `jvmMainCompileClasspath` — the same casing rule the configuration selection applies
+        val stripped = when {
+            endsWith("CompileClasspath", true) -> dropLast("CompileClasspath".length)
+            endsWith("RuntimeClasspath", true) -> dropLast("RuntimeClasspath".length)
+            else -> this
+        }
         return knownTargets.firstOrNull { stripped.startsWith(it) }
     }
 
-    private fun String.stripClasspathSuffix(): String? = when {
-        // matched case-insensitively: an unprefixed config is `compileClasspath`, a prefixed one
-        // `debugCompileClasspath` — the same casing rule the configuration selection applies
-        endsWith("CompileClasspath", true) -> dropLast("CompileClasspath".length)
-        endsWith("RuntimeClasspath", true) -> dropLast("RuntimeClasspath".length)
-        else -> this
-    }.takeIf { it.isNotEmpty() }
-
     private fun List<DependencyData>.deduplicateDependencies() = groupBy {
         it.uniqueId
     }.map { (uniqueId, value) ->
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/Agp10CompatibilityTest.kt` (modified, +38/-1)
```diff
@@ -3,6 +3,7 @@ package com.mikepenz.aboutlibraries.plugin
 import org.gradle.testkit.runner.GradleRunner
 import org.gradle.testkit.runner.TaskOutcome
 import org.junit.jupiter.api.Assertions.assertEquals
+import org.junit.jupiter.api.Assertions.assertFalse
 import org.junit.jupiter.api.Assertions.assertTrue
 import org.junit.jupiter.api.Test
 import org.junit.jupiter.api.io.TempDir
@@ -66,7 +67,40 @@ class Agp10CompatibilityTest {
         cp.split(File.pathSeparator).joinToString(", ") { "files(\"${it.replace("\\", "\\\\")}\")" }
     }
 
-    private fun setupAndroidProject(projectDir: File, androidPluginId: String, extensionType: String) {
+    /**
+     * An Android-only project has a single implicit target, and the single-target Kotlin extension
+     * names it `""` — reporting that verbatim yields `"targets":[""]`, and falling back to the
+     * configuration name yields build variants (`debug`, `release`), which are not targets.
+     * Neither is something a consumer could filter by, so the array stays empty.
+     */
+    @Test
+    fun `targets field is empty for an android-only module`() {
+        setupAndroidProject(
+            projectDir,
+            "com.android.application",
+            "com.android.build.api.dsl.ApplicationExtension",
+            includeTargets = true,
+        )
+
+        val result = GradleRunner.create()
+            .withProjectDir(projectDir)
+            .withArguments("exportLibraryDefinitionsRelease", "--stacktrace")
+            .build()
+
+        assertEquals(TaskOutcome.SUCCESS, result.task(":exportLibraryDefinitionsRelease")?.outcome)
+
+        val content = File(projectDir, "build/generated/aboutLibraries/aboutlibraries.json").readText()
+        assertTrue(content.contains("\"targets\":[]"), "targets must be empty, was: $content")
+        assertFalse(content.contains("\"targets\":[\"\"]"), "the unnamed single target must not be reported: $content")
+        assertFalse(content.contains("\"release\""), "build variants are not targets: $content")
+    }
+
+    private fun setupAndroidProject(
+        projectDir: File,
+        androidPluginId: String,
+        extensionType: String,
+        includeTargets: Boolean = false,
+    ) {
         File(projectDir, "gradle.properties").writeText(
             """
             android.useAndroidX=true
@@ -129,6 +163,9 @@ class Agp10CompatibilityTest {
 
             extensions.configure<com.mikepenz.aboutlibraries.plugin.AboutLibrariesExtension>("aboutLibraries") {
                 offlineMode = true
+                collect {
+                    includeTargets = $includeTargets
+                }
             }
             """.trimIndent()
         )
```

**File**: `plugin-build/plugin/src/test/kotlin/com/mikepenz/aboutlibraries/plugin/OutputCorrectnessTest.kt` (modified, +6/-4)
```diff
@@ -411,10 +411,12 @@ class OutputCorrectnessTest {
     }
 
     /**
-     * A plain `java-library` project has no Kotlin target model, and its `compileClasspath` /
-     * `runtimeClasspath` names leave nothing behind once the classpath suffix is stripped. Such a
-     * project has a single implicit target, so the key is emitted but empty rather than filled
-     * with invented names.
+     * A single-target project — `java-library` here, but equally `kotlin("jvm")` or an Android-only
+     * build — has exactly one implicit target, so the key is emitted but empty rather than filled
+     * with a configuration or build-variant name no consumer could match against.
+     *
+     * Note the single-target Kotlin extensions name their only target `""`; reporting that verbatim
+     * would emit `"targets":[""]`.
      *
      * The multi-target behaviour this field exists for is covered by [KmpAndroidFunctionalTest].
      */
```

---

### Incident Patch 14: `ca017b26` (2026-08-14)
**Commit Message**: fix(plugin): stabilize `variants` provenance for overrides and split classpaths

- order selected configurations runtime-classpath first, so the version kept
  by `deduplicateDependencies` is the one that actually ships when compile and
  runtime resolve differently
- never materialize `variants` from a config override while `includeVariants`
  is off
- report config-only libraries (not part of any resolved configuration) with an
  empty `variants` set instead of a missing key

Also enables `includeVariants` in `app-test` and regenerates its fixture.

**File**: `app-test/build.gradle.kts` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ kotlin {
 aboutLibraries {
     collect {
         fetchRemoteLicense = true
+        includeVariants = true
     }
     export {
         prettyPrint = true
```

**File**: `app-test/files/aboutlibraries.json` (modified, +29/-10)
```diff
@@ -26,11 +26,17 @@
             ],
             "funding": [
                 
+            ],
+            "variants": [
+                "jvmCompileClasspath",
+                "jvmMainCompileClasspath",
+                "jvmMainRuntimeClasspath",
+                "jvmRuntimeClasspath"
             ]
         },
         {
             "uniqueId": "org.jetbrains.kotlin:kotlin-stdlib",
-            "artifactVersion": "2.3.20",
+            "artifactVersion": "2.4.10",
             "name": "Kotlin Stdlib",
             "description": "Kotlin Standard Library",
             "website": "https://kotlinlang.org/",
@@ -50,11 +56,21 @@
             ],
             "funding": [
                 
+            ],
+            "variants": [
+                "jvmCompileClasspath",
+                "jvmMainCompileClasspath",
+                "jvmMainRuntimeClasspath",
+                "jvmRuntimeClasspath",
+                "metadataCommonMainCompileClasspath",
+                "metadataCompileClasspath",
+                "wasmJsCompileClasspath",
+                "wasmJsRuntimeClasspath"
             ]
         },
         {
             "uniqueId": "org.jetbrains.kotlin:kotlin-stdlib-wasm-js",
-            "artifactVersion": "2.3.20",
+            "artifactVersion": "2.4.10",
             "name": "Kotlin Stdlib Wasm Js",
             "description": "Kotlin Standard Library for experimental WebAssembly JS platform",
             "website": "https://kotlinlang.org/",
@@ -74,6 +90,10 @@
             ],
             "funding": [
                 
+            ],
+            "variants": [
+                "wasmJsCompileClasspath",
+                "wasmJsRuntimeClasspath"
             ]
         },
         {
@@ -93,21 +113,20 @@
                 "url": "https://github.com/JetBrains/intellij-community"
             },
             "licenses": [
-                "196b44647f01b6b79fdfedf9cd2caed7"
+                "Apache-2.0"
             ],
             "funding": [
                 
+            ],
+            "variants": [
+                "jvmCompileClasspath",
+                "jvmMainCompileClasspath",
+                "jvmMainRuntimeClasspath",
+                "jvmRuntimeClasspath"
             ]
         }
     ],
     "licenses": {
-        "196b44647f01b6b79fdfedf9cd2caed7": {
-            "name": "Apache License 2.0",
-            "url": "https://raw.githubusercontent.com/JetBrains/intellij-community/master/LICENSE.txt",
-            "content": "                              Apache License\n                        Version 2.0, January 2004\n                     http://www.apache.org/licenses/\n\nTERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION\n\n1. Definitions.\n\n   \"License\" shall mean the terms and conditions for use, reproduction,\n   and distribution as defined by Sections 1 through 9 of this document.\n\n   \"Licensor\" shall mean the copyright owner or entity authorized by\n   the copyright owner that is granting the License.\n\n   \"Legal Entity\" shall mean the union of the acting entity and all\n   other entities that control, are controlled by, or are under common\n   control with that entity. For the purposes of this definition,\n   \"control\" means (i) the power, direct or indirect, to cause the\n   direction or management of such entity, whether by contract or\n   otherwise, or (ii) ownership of fifty percent (50%) or more of the\n   outstanding shares, or (iii) beneficial ownership of such entity.\n\n   \"You\" (or \"Your\") shall mean an individual or Legal Entity\n   exercising permissions granted by this License.\n\n   \"Source\" form shall mean the preferred form for making modifications,\n   including but not limited to software source code, documentation\n   source, and configuration files.\n\n   \"Object\" form shall mean any form resulting from mechanical\n   transformation or translation of a Source form, including but\n   not limited to compiled object code, generated documentation,\n   and conversions to other media types.\n\n   \"Work\" shall mean the work of authorship, whether in Source or\n   Object form, made available under the License, as indicated by a\n   copyright notice that is included in or attached to the work\n   (an example is provided in the Appendix below).\n\n   \"Derivative Works\" shall mean any work, whether in Source or Object\n   form, that is based on (or derived from) the Work and for which the\n   editorial revisions, annotations, elaborations, or other modifications\n   represent, as a whole, an original work of authorship. For the purposes\n   of this License, Derivative Works shall not include works that remain\n   separable from, or merely link (or bind by name) to the interfaces of,\n   the Work and Derivative Works thereof.\n\n   \"Contribution\" shall mean any work of authorship, including\n   the original version of the Work and any modifications or additions\n   to that Work or Derivative Works thereof, that is intentionally\n   su
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryPostProcessor.kt` (modified, +10/-1)
```diff
@@ -65,14 +65,18 @@ internal class LibraryPostProcessor(
         // The configurations contributing to this task's output. Retained separately from the
         // flattened + deduplicated dependency list below, because deduplication collapses entries
         // by `uniqueId` and would otherwise discard which configuration each dependency came from.
+        //
+        // Ordered runtime classpaths first: when compile and runtime resolve different versions of the
+        // same module, `deduplicateDependencies` keeps the first entry, and the runtime resolution is
+        // the version that actually ships.
         val selectedConfigs: Map<String, List<DependencyData>> = when {
             variant.isNullOrBlank() -> variantToDependencyData
             variantToDependencyData.containsKey(variant) -> mapOf(variant to variantToDependencyData.getValue(variant))
             // if we don't have an exact match, use all variants starting with
             else -> variantToDependencyData.filterKeys { configName ->
                 configName.removeSuffix("CompileClasspath").removeSuffix("RuntimeClasspath") == variant
             }
-        }
+        }.toSortedMap(compareBy({ !it.endsWith("RuntimeClasspath") }, { it }))
 
         val dependencyDataForVariant: Collection<DependencyData>? = if (variant.isNullOrBlank()) {
             selectedConfigs.flatMap { (_, dependencies) -> dependencies }.deduplicateDependencies() ?: emptySet()
@@ -168,6 +172,9 @@ internal class LibraryPostProcessor(
             val librariesMap = librariesList.associateBy { it.uniqueId }.toMutableMap()
             LibraryReader.readLibraries(configFolder).takeIf { it.isNotEmpty() }?.also { customLibs ->
                 customLibs.forEach { lib ->
+                    // never let an override materialize `variants` while the feature is disabled
+                    if (!includeVariants) lib.variants = null
+
                     /** Make sure we fetch any additional needed licenses */
                     fun Library.handleLicenses() {
                         this.licenses.forEach {
@@ -193,6 +200,8 @@ internal class LibraryPostProcessor(
                         if (librariesMap.containsKey(lib.uniqueId)) {
                             librariesMap[lib.uniqueId]?.mergeWithCustom()
                         } else {
+                            // config-only library, not part of any resolved configuration
+                            if (includeVariants && lib.variants == null) lib.variants = emptySet()
                             lib.handleLicenses()
                             librariesList.add(lib)
                             librariesMap[lib.uniqueId] = lib
```

**File**: `plugin-build/plugin/src/main/kotlin/com/mikepenz/aboutlibraries/plugin/util/LibraryUtil.kt` (modified, +1/-1)
```diff
@@ -118,4 +118,4 @@ fun Library.merge(with: Library) {
             it.addAll(orgLib.variants.orEmpty())
         }
     }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 15: `ff7bf6ef` (2026-08-11)
**Commit Message**: Revert "docs: point README images at the review branch [REVERT BEFORE MERGE]"

This reverts commit 1213fd2746d8a2b6b1e876bc21b801f2826ff213.

**File**: `README.md` (modified, +9/-9)
```diff
@@ -9,8 +9,8 @@
 
 <p align="center">
   <picture>
-    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/hero-dark.svg">
-    <img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/hero-light.svg" width="100%" alt="AboutLibraries — collects every dependency and license of your Gradle project at build time, then renders them with Compose on Android, iOS, desktop, web and Wear. Three stages: build.gradle.kts, a generated aboutlibraries.json, and a LibrariesContainer showing license pills.">
+    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/hero-dark.svg">
+    <img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/hero-light.svg" width="100%" alt="AboutLibraries — collects every dependency and license of your Gradle project at build time, then renders them with Compose on Android, iOS, desktop, web and Wear. Three stages: build.gradle.kts, a generated aboutlibraries.json, and a LibrariesContainer showing license pills.">
   </picture>
 </p>
 
@@ -62,22 +62,22 @@ Each shot is a [Paparazzi](https://github.com/cashapp/paparazzi) render of [`Rea
 
 | `LibrariesVariant.Refined` | `LibrariesVariant.Traditional` |
 |:--------------------------:|:------------------------------:|
-| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-variant-refined-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-variant-refined-light.png" alt="Refined variant"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-variant-traditional-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-variant-traditional-light.png" alt="Traditional variant"></picture> |
+| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-variant-refined-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-variant-refined-light.png" alt="Refined variant"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-variant-traditional-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-variant-traditional-light.png" alt="Traditional variant"></picture> |
 
 | `LibrariesDensity.Compact` | `LibrariesDensity.Cozy` |
 |:--------------------------:|:-----------------------:|
-| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-density-compact-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-density-compact-light.png" alt="Compact density"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-density-cozy-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-density-cozy-light.png" alt="Cozy density"></picture> |
+| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-density-compact-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-density-compact-light.png" alt="Compact density"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-density-cozy-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/develop/art/showcase-density-cozy-light.png" alt="Cozy density"></picture> |
 
 | `LibraryActionMode.Chips` | `LibraryActionMode.Icons` |
 |:-------------------------:|:-------------------------:|
-| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-actions-chips-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-actions-chips-light.png" alt="Chip actions"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-actions-icons-dark.png"><img src="https://raw.githubusercontent.com/mikepenz/AboutLibraries/feature/readme-redesign/art/showcase-actions-icons-ligh
```

#### Recent Merged Pull Requests:
- **PR #1468** (2026-10-05): fix(deps): update dependency com.mikepenz:version-catalog to v0.21.0 (@renovate-mike[bot])
- **PR #1466** (2026-09-27): Log stack trace when loading resource fails (@cketti)
- **PR #1465** (2026-09-08): chore(deps): update mike penz internal projects (@renovate-mike[bot])
- **PR #1461** (2026-08-28): dev -> main (@mikepenz)
- **PR #1460** (2026-08-28): chore(deps): update dependencies (Compose 1.12.0) (@mikepenz)
- **PR #1458** (2026-08-24): fix(deps): update dependency com.squareup.okhttp3:okhttp to v5.5.0 (@renovate-mike[bot])
- **PR #1457** (2026-08-23): chore(deps): update github/codeql-action action to v4.37.7 (@renovate-mike[bot])
- **PR #1456** (2026-08-21): dev -> main (@mikepenz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
