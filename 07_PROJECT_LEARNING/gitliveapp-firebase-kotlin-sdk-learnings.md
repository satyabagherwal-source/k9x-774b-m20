# Forensic Learning Record (Deep Inspection): GitLiveApp/firebase-kotlin-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitliveapp-firebase-kotlin-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GitLiveApp/firebase-kotlin-sdk](https://github.com/GitLiveApp/firebase-kotlin-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:32:01.504Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitLiveApp/firebase-kotlin-sdk`
- **Description**: A Kotlin-first SDK for Firebase
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1732 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/update-api-coverage/api_coverage.py`
```
#!/usr/bin/env python3
"""Recalculate the "API Coverage" badges in README.md.

Coverage for a module is the number of public, non-deprecated firebase-android-sdk
API members that this SDK's androidMain sources invoke, divided by the total
number of such members. The Android API comes from the module's api.txt on the
main branch of firebase-android-sdk, or, for the closed-source Authentication and
Analytics libraries, from `javap -v` over the AARs the Firebase BOM resolves to.

Usage (from the repository root):
    python3 .claude/skills/update-api-coverage/api_coverage.py            # print the table
    python3 .claude/skills/update-api-coverage/api_coverage.py --write    # also update README.md
    python3 .claude/skills/update-api-coverage/api_coverage.py -v         # per-class detail
    python3 .claude/skills/update-api-coverage/api_coverage.py --exclude-pipeline
    python3 .claude/skills/update-api-coverage/api_coverage.py --api-dir DIR  # use local api.txt files
    python3 .claude/skills/update-api-coverage/api_coverage.py --aar-dir DIR  # use local AAR files
"""
import argparse
import collections
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
API_URL = 'https://raw.githubusercontent.com/firebase/firebase-android-sdk/main/firebase-{}/api.txt'
MAVEN_URL = 'https://dl.google.com/dl/android/maven2/'

# Modules whose Android API is published as api.txt in firebase-android-sdk.
API_MODULES = ['database', 'firestore', 'functions', 'messaging', 'storage',
               'installations', 'config', 'perf', 'crashlytics']
# Closed-source modules: (Maven artifact holding the classes, Java package).
# The firebase-analytics AAR is an empty shim; its API lives in play-services-measurement-api,
# whose version is a dependency of the firebase-analytics POM.
AAR_MODULES = {
    'auth': ('com.google.firebase:firebase-auth', 'com.google.firebase.auth'),
    'analytics': ('com.google.android.gms:play-services-measurement-api', 'com.google.firebase.analytics'),
}
MODULES = {m: f'firebase-{m}' for m in API_MODULES + list(AAR_MODULES)}
EXCLUDED_SUBPACKAGES = ('internal', 'connector')
PIPELINE_PKGS = {'com.google.firebase.firestore.pipeline', 'com.google.firebase.firestore.pipeline.evaluation'}


def fetch_api(name, api_dir):
    if api_dir:
        return open(os.path.join(api_dir, f'{name}.txt')).read()
    with urllib.request.urlopen(API_URL.format(name)) as r:
        return r.read().decode()


def parse_api(text, exclude_pkgs=()):
    """Yield (package, class, kind, name) for every public, non-deprecated member."""
    pkg = cls = None
    cls_ok = False
    for line in text.splitlines():
        s = line.strip()
        m = re.match(r'package (\S+) \{', s)
        if m:
            pkg = m.group(1)
            continue
        m = re.match(r'((?:@\S+ )*)(public|protected) .*?(class|interface|enum|@interface) ([\w.]+)', s)
        if m and s.endswith('{'):
            cls = m.group(4)
            cls_ok = (m.group(2) == 'public' and '@Deprecated' not in m.group(1)
                      and '@RestrictTo' not in m.group(1) and m.group(3) != '@interface'
                      and pkg not in exclude_pkgs)
            continue
        m = re.match(r'(ctor|method|field|property|enum_constant) ((?:@\S+ )*)(public|protected) (.*);', s)
        if m and cls and cls_ok:
            kind, ann, vis, rest = m.groups()
            if vis != 'public' or '@Deprecated' in ann or '@RestrictTo' in ann:
                continue
            if kind == 'ctor':
                name = '<init>'
            else:
                decl = rest.split('(')[0] if kind == 'method' else rest.split(' = ')[0]
                name = decl.split()[-1]
                if name in ('Companion', 'INSTANCE'):
                    continue
            yield pkg, cls, kind, name


# --- closed-source libraries: list the API from the AAR with javap -------------------------

def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def maven_path(coordinate, version, ext):
    group, artifact = coordinate.split(':')
    return f"{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.{ext}"


def pom_dependency_version(pom, artifact):
    m = re.search(r'<artifactId>' + re.escape(artifact) + r'</artifactId>\s*<version>([^<]+)</version>', pom)
    if not m:
        sys.exit(f'{artifact} not found in POM')
    return m.group(1)


def bom_version():
    toml = open(os.path.join(ROOT, 'gradle', 'libs.versions.toml')).read()
    return re.search(r'^firebase-bom\s*=\s*"([^"]+)"', toml, flags=re.M).group(1)


def download_aar(api, workdir):
    """Resolve the artifact version through the Firebase BOM and download its AAR."""
    bom = fetch(MAVEN_URL + maven_path('com.google.firebase:firebase-bom', bom_version(), 'pom')).decode()
    coordinate, _ = AAR_MODULES[api]
    if api == 'analytics':
        analytics_pom = fetch(MAVEN_URL + maven_path('com.google.firebase:firebase-analytics',
                                                     pom_dependency_version(bom, 'firebase-analytics'), 'pom')).decode()
        version = pom_dependency_version(analytics_pom, 'play-services-measurement-api')
    else:
        version = pom_dependency_version(bom, coordinate.split(':')[1])
    path = os.path.join(workdir, f'{api}.aar')
    open(path, 'wb').write(fetch(MAVEN_URL + maven_path(coordinate, version, 'aar')))
    print(f'  {coordinate}:{version}', file=sys.stderr)
    return path


def find_local_aar(api, aar_dir):
    artifact = AAR_MODULES[api][0].split(':')[1]
    matches = sorted(glob.glob(os.path.join(aar_dir, f'{artifact}-*.aar')))
    if not matches:
        sys.exit(f'no {artifact}-*.aar in {aar_dir}')
    return matches[-1]


def javap_classes(aar_path, package, workdir):
    """Return `javap -v` output for every class in the package (and non-excluded subpackages)."""
    with zipfile.ZipFile(aar_path) as aar:
        jar_path = os.path.join(workdir, os.path.basename(aar_path) + '.classes.jar')
        open(jar_path, 'wb').write(aar.read('classes.jar'))
    prefix = package.replace('.', '/') + '/'
    with zipfile.ZipFile(jar_path) as jar:
        names = []
        for n in jar.namelist():
            if not (n.startswith(prefix) and n.endswith('.class')):
                continue
            rel = n[len(prefix):-len('.class')]
            sub = rel.split('/')[:-1]
            if sub and sub[0] in EXCLUDED_SUBPACKAGES:
                continue
            names.append(n[:-len('.class')].replace('/', '.'))
    if not names:
        sys.exit(f'no classes under {package} in {aar_path}')
    out = subprocess.run(['javap', '-v', '-classpath', jar_path] + names, capture_output=True, text=True)
    if out.returncode:
        sys.exit(out.stderr)
    return out.stdout


def parse_javap(output, package):
    """Yield (package, class, kind, name) for every public, non-deprecated member, matching parse_api."""
    def deprecated(attrs):
        return any(re.search(r'Deprecated: true|(java/lang|kotlin)/Deprecated', a) for a in attrs)

    for chunk in re.split(r'^Classfile ', output, flags=re.M)[1:]:
        m = re.search(r'^(?:[\w ]* )?(?:class|interface|enum|@interface) ([\w.$]+)', chunk, flags=re.M)
        if not m:
            continue
        fqn = m.group(1)
        cls_flags = re.search(r'^  flags: .*$', chunk, flags=re.M).group(0)
        head, _, rest = chunk.partition('\n{\n')
        body, _, tail = rest.partition('\n}\n')
        simple = fqn[len(fqn.rsplit('.', 1)[0]) + 1:]
        if ('ACC_PUBLIC' not in cls_flags or 'ACC_SYNTHETIC' in cls_flags
                or re.search(r'\$\d|\$\$|(^|\$)zz', simple) or deprecated([tail])
                or 'kotlin/Metadata' in tail and 'k=I3' in tail):  # k=3 is a synthetic Kotlin class
            continue
        pkg = fqn.rsplit('.', 1)[0]
        cls = simple.replace('$', '.')
        is_enum = 'ACC_ENUM' in cls_flags

        member = None
        attrs = []
        members = []
        for line in body.split('\n') + ['  ']:
            if line.startswith('  ') and not line.startswith('    '):
                if member:
                    members.append((member, attrs))
                member, attrs = line.strip(), []
            elif member is not None:
                attrs.append(line)
        for decl, attrs in members:
            flags = next((a for a in attrs if a.strip().startswith('flags:')), '')
            if ('ACC_PUBLIC' not in flags or 'ACC_SYNTHETIC' in flags or 'ACC_BRIDGE' in flags
                    or deprecated(attrs) or decl.startswith('static {}')):
                continue
            if '(' in decl:
                name = decl.split('(')[0].split()[-1]
                if name.replace('$', '.') == fqn.replace('$', '.') or name == simple:
                    kind, name = 'ctor', '<init>'
                else:
                    kind = 'method'
                    if is_enum and name in ('values', 'valueOf'):
                        continue
            else:
                name = decl.rstrip(';').split()[-1]
                kind = 'enum_constant' if 'ACC_ENUM' in flags else 'field'
            if '$' in name or name.startswith('zz') or name in ('Companion', 'INSTANCE'):
                continue
            yield pkg, cls, kind, name


def android_sources(moddir):
    return glob.glob(os.path.join(ROOT, moddir, 'src/androidMain/**/*.kt'), recursive=True)


def compat_report_coverage(moddir):
    """(percent, available, counted) from api/android-sdk-compat.txt, for modules that ship the com.google.firebase
    compatibility layer. The report (regenerated by `./gradlew :<module>:androidSourceCompatDump`) already scores every
    public api.txt member the layer provides, so the badge is its percentage; `@hide` members are not counted."""
    path = os.path.join(ROOT, moddir, 'api', 'android-sdk-compat
```

### Core Architecture Module: `firebase-analytics/src/androidMain/kotlin/dev/gitlive/firebase/analytics/analytics.kt`
```
@file:JvmName("analyticsAndroid")

package dev.gitlive.firebase.analytics

import android.os.Bundle
import com.google.firebase.analytics.analytics
import com.google.firebase.analytics.setConsent
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.FirebaseApp
import kotlinx.coroutines.tasks.await
import kotlin.time.Duration

public actual val Firebase.analytics: FirebaseAnalytics
    get() = FirebaseAnalytics(com.google.firebase.Firebase.analytics)

public actual fun Firebase.analytics(app: FirebaseApp): FirebaseAnalytics = FirebaseAnalytics(com.google.firebase.Firebase.analytics)

public val FirebaseAnalytics.android: com.google.firebase.analytics.FirebaseAnalytics get() = android

public actual class FirebaseAnalytics(internal val android: com.google.firebase.analytics.FirebaseAnalytics) {
    public actual fun logEvent(name: String, parameters: Map<String, Any>?) {
        android.logEvent(name, parameters?.toBundle())
    }
    public actual fun setUserProperty(name: String, value: String) {
        android.setUserProperty(name, value)
    }
    public actual fun setUserId(id: String?) {
        android.setUserId(id)
    }
    public actual fun resetAnalyticsData() {
        android.resetAnalyticsData()
    }
    public actual fun setDefaultEventParameters(parameters: Map<String, String>) {
        android.setDefaultEventParameters(parameters.toBundle())
    }

    public actual fun setAnalyticsCollectionEnabled(enabled: Boolean) {
        android.setAnalyticsCollectionEnabled(enabled)
    }

    public actual fun setSessionTimeoutInterval(sessionTimeoutInterval: Duration) {
        android.setSessionTimeoutDuration(sessionTimeoutInterval.inWholeMilliseconds)
    }

    public actual suspend fun getSessionId(): Long? = android.sessionId.await()

    public actual fun setConsent(consentSettings: Map<ConsentType, ConsentStatus>) {
        consentSettings.entries.associate {
            it.key to when (it.value) {
                ConsentStatus.GRANTED -> com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus.GRANTED
                ConsentStatus.DENIED -> com.google.firebase.analytics.FirebaseAnalytics.ConsentStatus.DENIED
            }
        }.let { androidConsentSettings ->
            android.setConsent {
                androidConsentSettings.entries.forEach {
                    when (it.key) {
                        ConsentType.AD_PERSONALIZATION ->
                            this.adPersonalization = it.value

                        ConsentType.AD_STORAGE ->
                            this.adStorage = it.value

                        ConsentType.AD_USER_DATA ->
                            this.adUserData = it.value

                        ConsentType.ANALYTICS_STORAGE ->
                            this.analyticsStorage = it.value
                    }
                }
            }
        }
    }

    public actual enum class ConsentType {
        AD_PERSONALIZATION,
        AD_STORAGE,
        AD_USER_DATA,
        ANALYTICS_STORAGE,
    }

    public actual enum class ConsentStatus {
        GRANTED,
        DENIED,
    }
}

public actual class FirebaseAnalyticsException(message: String) : Exception(message)

private fun Map<String, Any>.toBundle() = Bundle().apply {
    forEach { (key, value) ->
        when (value::class) {
            String::class -> putString(key, value as String)
            Int::class -> putInt(key, value as Int)
            Long::class -> putLong(key, value as Long)
            Double::class -> putDouble(key, value as Double)
            Boolean::class -> putBoolean(key, value as Boolean)
        }
    }
}

```

### Core Architecture Module: `firebase-analytics/src/appleMain/kotlin/dev/gitlive/firebase/analytics/analytics.kt`
```
package dev.gitlive.firebase.analytics

import cocoapods.FirebaseAnalytics.FIRAnalytics
import cocoapods.FirebaseAnalytics.setConsent
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.FirebaseApp
import dev.gitlive.firebase.FirebaseException
import kotlinx.coroutines.CompletableDeferred
import platform.Foundation.NSError
import kotlin.time.Duration
import kotlin.time.DurationUnit

public actual val Firebase.analytics: FirebaseAnalytics
    get() = FirebaseAnalytics(FIRAnalytics)

public actual fun Firebase.analytics(app: FirebaseApp): FirebaseAnalytics = FirebaseAnalytics(FIRAnalytics)

public val FirebaseAnalytics.ios: FIRAnalytics.Companion get() = ios

public actual class FirebaseAnalytics(internal val ios: FIRAnalytics.Companion) {
    public actual fun logEvent(name: String, parameters: Map<String, Any>?) {
        val mappedParameters: Map<Any?, Any>? = parameters?.map { it.key to it.value }?.toMap()
        ios.logEventWithName(name, mappedParameters)
    }
    public actual fun setUserProperty(name: String, value: String) {
        ios.setUserPropertyString(value, name)
    }
    public actual fun setUserId(id: String?) {
        ios.setUserID(id)
    }
    public actual fun resetAnalyticsData() {
        ios.resetAnalyticsData()
    }

    public actual fun setAnalyticsCollectionEnabled(enabled: Boolean) {
        ios.setAnalyticsCollectionEnabled(enabled)
    }

    public actual fun setSessionTimeoutInterval(sessionTimeoutInterval: Duration) {
        ios.setSessionTimeoutInterval(sessionTimeoutInterval.toDouble(DurationUnit.SECONDS))
    }

    public actual suspend fun getSessionId(): Long? = ios.awaitResult { sessionIDWithCompletion(it) }

    public actual fun setDefaultEventParameters(parameters: Map<String, String>) {
        val mappedParameters: Map<Any?, String> = parameters.map { it.key to it.value }.toMap()
        ios.setDefaultEventParameters(mappedParameters)
    }

    public actual fun setConsent(consentSettings: Map<ConsentType, ConsentStatus>) {
        val mappedConsentSettings: Map<Any?, *> = consentSettings.map { it.key.name to it.value.name }.toMap()
        ios.setConsent(mappedConsentSettings)
    }

    public actual enum class ConsentType {
        AD_PERSONALIZATION,
        AD_STORAGE,
        AD_USER_DATA,
        ANALYTICS_STORAGE,
    }

    public actual enum class ConsentStatus {
        GRANTED,
        DENIED,
    }
}

public actual class FirebaseAnalyticsException(message: String) : FirebaseException(message)

internal suspend inline fun <T> T.await(function: T.(callback: (NSError?) -> Unit) -> Unit) {
    val job = CompletableDeferred<Unit>()
    function { error ->
        if (error == null) {
            job.complete(Unit)
        } else {
            job.completeExceptionally(FirebaseAnalyticsException(error.toString()))
        }
    }
    job.await()
}

internal suspend inline fun <T, reified R> T.awaitResult(function: T.(callback: (R?, NSError?) -> Unit) -> Unit): R {
    val job = CompletableDeferred<R?>()
    function { result, error ->
        if (error == null) {
            job.complete(result)
        } else {
            job.completeExceptionally(FirebaseAnalyticsException(error.toString()))
        }
    }
    return job.await() as R
}

```

### Core Architecture Module: `firebase-analytics/src/commonMain/kotlin/dev/gitlive/firebase/analytics/AnalyticEventConstants.kt`
```
@file:Suppress("UnusedReceiverParameter")

package dev.gitlive.firebase.analytics

public val FirebaseAnalytics.Event: FirebaseAnalyticsEvents
    get() = FirebaseAnalyticsEvents

public object FirebaseAnalyticsEvents {
    public const val ADD_PAYMENT_INFO: String = "add_payment_info"
    public const val ADD_SHIPPING_INFO: String = "add_shipping_info"
    public const val ADD_TO_CART: String = "add_to_cart"
    public const val ADD_TO_WISHLIST: String = "add_to_wishlist"
    public const val AD_IMPRESSION: String = "ad_impression"
    public const val APP_OPEN: String = "app_open"
    public const val BEGIN_CHECKOUT: String = "begin_checkout"
    public const val CAMPAIGN_DETAILS: String = "campaign_details"
    public const val EARN_VIRTUAL_CURRENCY: String = "earn_virtual_currency"
    public const val GENERATE_LEAD: String = "generate_lead"
    public const val JOIN_GROUP: String = "join_group"
    public const val LEVEL_END: String = "level_end"
    public const val LEVEL_START: String = "level_start"
    public const val LEVEL_UP: String = "level_up"
    public const val LOGIN: String = "login"
    public const val POST_SCORE: String = "post_score"
    public const val PURCHASE: String = "purchase"
    public const val REFUND: String = "refund"
    public const val REMOVE_FROM_CART: String = "remove_from_cart"
    public const val SCREEN_VIEW: String = "screen_view"
    public const val SEARCH: String = "search"
    public const val SELECT_CONTENT: String = "select_content"
    public const val SELECT_ITEM: String = "select_item"
    public const val SELECT_PROMOTION: String = "select_promotion"
    public const val SHARE: String = "share"
    public const val SIGN_UP: String = "sign_up"
    public const val SPEND_VIRTUAL_CURRENCY: String = "spend_virtual_currency"
    public const val TUTORIAL_BEGIN: String = "tutorial_begin"
    public const val TUTORIAL_COMPLETE: String = "tutorial_complete"
    public const val UNLOCK_ACHIEVEMENT: String = "unlock_achievement"
    public const val VIEW_CART: String = "view_cart"
    public const val VIEW_ITEM: String = "view_item"
    public const val VIEW_ITEM_LIST: String = "view_item_list"
    public const val VIEW_PROMOTION: String = "view_promotion"
    public const val VIEW_SEARCH_RESULTS: String = "view_search_results"
}

public val FirebaseAnalytics.Param: FirebaseAnalyticsParam
    get() = FirebaseAnalyticsParam

public object FirebaseAnalyticsParam {
    public const val ACHIEVEMENT_ID: String = "achievement_id"
    public const val ACLID: String = "aclid"
    public const val AD_FORMAT: String = "ad_format"
    public const val AD_PLATFORM: String = "ad_platform"
    public const val AD_SOURCE: String = "ad_source"
    public const val AD_UNIT_NAME: String = "ad_unit_name"
    public const val AFFILIATION: String = "affiliation"
    public const val CAMPAIGN: String = "campaign"
    public const val CAMPAIGN_ID: String = "campaign_id"
    public const val CHARACTER: String = "character"
    public const val CONTENT: String = "content"
    public const val CONTENT_TYPE: String = "content_type"
    public const val COUPON: String = "coupon"
    public const val CP1: String = "cp1"
    public const val CREATIVE_FORMAT: String = "creative_format"
    public const val CREATIVE_NAME: String = "creative_name"
    public const val CREATIVE_SLOT: String = "creative_slot"
    public const val CURRENCY: String = "currency"
    public const val DESTINATION: String = "destination"
    public const val DISCOUNT: String = "discount"
    public const val END_DATE: String = "end_date"
    public const val EXTEND_SESSION: String = "extend_session"
    public const val FLIGHT_NUMBER: String = "flight_number"
    public const val GROUP_ID: String = "group_id"
    public const val INDEX: String = "index"
    public const val ITEMS: String = "items"
    public const val ITEM_BRAND: String = "item_brand"
    public const val ITEM_CATEGORY: String = "item_category"
    public const val ITEM_CATEGORY2: String = "item_category2"
    public const val ITEM_CATEGORY3: String = "item_category3"
    public const val ITEM_CATEGORY4: String = "item_category4"
    public const val ITEM_CATEGORY5: String = "item_category5"
    public const val ITEM_ID: String = "item_id"
    public const val ITEM_LIST_ID: String = "item_list_id"
    public const val ITEM_LIST_NAME: String = "item_list_name"
    public const val ITEM_NAME: String = "item_name"
    public const val ITEM_VARIANT: String = "item_variant"
    public const val LEVEL: String = "level"
    public const val LEVEL_NAME: String = "level_name"
    public const val LOCATION: String = "location"
    public const val LOCATION_ID: String = "location_id"
    public const val MARKETING_TACTIC: String = "marketing_tactic"
    public const val MEDIUM: String = "medium"
    public const val METHOD: String = "method"
    public const val NUMBER_OF_NIGHTS: String = "number_of_nights"
    public const val NUMBER_OF_PASSENGERS: String = "number_of_passengers"
    public const val NUMBER_OF_ROOMS: String = "number_of_rooms"
    public const val ORIGIN: String = "origin"
    public const val PAYMENT_TYPE: String = "payment_type"
    public const val PRICE: String = "price"
    public const val PROMOTION_ID: String = "promotion_id"
    public const val PROMOTION_NAME: String = "promotion_name"
    public const val QUANTITY: String = "quantity"
    public const val SCORE: String = "score"
    public const val SCREEN_CLASS: String = "screen_class"
    public const val SCREEN_NAME: String = "screen_name"
    public const val SEARCH_TERM: String = "search_term"
    public const val SHIPPING: String = "shipping"
    public const val SHIPPING_TIER: String = "shipping_tier"
    public const val SOURCE: String = "source"
    public const val SOURCE_PLATFORM: String = "source_platform"
    public const val START_DATE: String = "start_date"
    public const val SUCCESS: String = "success"
    public const val TAX: String = "tax"
    public const val TERM: String = "term"
    public const val TRANSACTION_ID: String = "transaction_id"
    public const val TRAVEL_CLASS: String = "travel_class"
    public const val VALUE: String = "value"
    public const val VIRTUAL_CURRENCY_NAME: String = "virtual_currency_name"
}

public val FirebaseAnalytics.UserProperty: FirebaseAnalyticsUserProperty
    get() = FirebaseAnalyticsUserProperty

public object FirebaseAnalyticsUserProperty {
    public const val ALLOW_AD_PERSONALIZATION_SIGNALS: String = "allow_personalized_ads"
    public const val SIGN_UP_METHOD: String = "sign_up_method"
}

```

### Core Architecture Module: `firebase-analytics/src/commonMain/kotlin/dev/gitlive/firebase/analytics/analytics.kt`
```
package dev.gitlive.firebase.analytics

import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.FirebaseApp
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

public expect val Firebase.analytics: FirebaseAnalytics

/** Returns the [FirebaseStorage] instance of a given [FirebaseApp]. */
public expect fun Firebase.analytics(app: FirebaseApp): FirebaseAnalytics

public expect class FirebaseAnalytics {
    public fun logEvent(name: String, parameters: Map<String, Any>? = null)
    public fun setUserProperty(name: String, value: String)
    public fun setUserId(id: String?)
    public fun setAnalyticsCollectionEnabled(enabled: Boolean)
    public fun setSessionTimeoutInterval(sessionTimeoutInterval: Duration)
    public suspend fun getSessionId(): Long?
    public fun resetAnalyticsData()
    public fun setDefaultEventParameters(parameters: Map<String, String>)
    public fun setConsent(consentSettings: Map<ConsentType, ConsentStatus>)

    public enum class ConsentType {
        AD_PERSONALIZATION,
        AD_STORAGE,
        AD_USER_DATA,
        ANALYTICS_STORAGE,
    }

    public enum class ConsentStatus {
        GRANTED,
        DENIED,
    }
}

@Deprecated("Use Kotlin Duration", replaceWith = ReplaceWith("setSessionTimeoutInterval(sessionTimeoutInterval.milliseconds)"))
public fun FirebaseAnalytics.setSessionTimeoutInterval(sessionTimeoutInterval: Long) {
    setSessionTimeoutInterval(sessionTimeoutInterval.milliseconds)
}

public fun FirebaseAnalytics.setConsent(builder: FirebaseAnalyticsConsentBuilder.() -> Unit) {
    val consentBuilder = FirebaseAnalyticsConsentBuilder()
    consentBuilder.builder()
    setConsent(consentBuilder.consentSettings)
}

public fun FirebaseAnalytics.logEvent(name: String, builder: FirebaseAnalyticsParameters.() -> Unit) {
    val params = FirebaseAnalyticsParameters()
    params.builder()
    logEvent(name, params.parameters)
}

public expect class FirebaseAnalyticsException

public data class FirebaseAnalyticsParameters(
    val parameters: MutableMap<String, Any> = mutableMapOf(),
) {
    public fun param(key: String, value: String) {
        parameters[key] = value
    }

    public fun param(key: String, value: Double) {
        parameters[key] = value
    }

    public fun param(key: String, value: Long) {
        parameters[key] = value
    }

    public fun param(key: String, value: Int) {
        parameters[key] = value
    }

    public fun param(key: String, value: Boolean) {
        parameters[key] = value
    }
}

public data class FirebaseAnalyticsConsentBuilder(
    val consentSettings: MutableMap<FirebaseAnalytics.ConsentType, FirebaseAnalytics.ConsentStatus> = mutableMapOf(),
) {
    var adPersonalization: FirebaseAnalytics.ConsentStatus?
        get() = consentSettings[FirebaseAnalytics.ConsentType.AD_PERSONALIZATION]
        set(value) {
            value?.let {
                consentSettings[FirebaseAnalytics.ConsentType.AD_PERSONALIZATION] = it
            }
        }

    var adStorage: FirebaseAnalytics.ConsentStatus?
        get() = consentSettings[FirebaseAnalytics.ConsentType.AD_STORAGE]
        set(value) {
            value?.let {
                consentSettings[FirebaseAnalytics.ConsentType.AD_STORAGE] = it
            }
        }

    var adUserData: FirebaseAnalytics.ConsentStatus?
        get() = consentSettings[FirebaseAnalytics.ConsentType.AD_USER_DATA]
        set(value) {
            value?.let {
                consentSettings[FirebaseAnalytics.ConsentType.AD_USER_DATA] = it
            }
        }

    var analyticsStorage: FirebaseAnalytics.ConsentStatus?
        get() = consentSettings[FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE]
        set(value) {
            value?.let {
                consentSettings[FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE] = it
            }
        }
}

```

### Core Architecture Module: `firebase-analytics/src/jsMain/kotlin/dev/gitlive/firebase/analytics/analytics.kt`
```
package dev.gitlive.firebase.analytics

import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.FirebaseApp
import dev.gitlive.firebase.FirebaseException
import dev.gitlive.firebase.analytics.externals.getAnalytics
import dev.gitlive.firebase.js
import kotlinx.coroutines.await
import kotlin.time.Duration
import kotlin.js.json

public actual val Firebase.analytics: FirebaseAnalytics
    get() = FirebaseAnalytics(getAnalytics())

public actual fun Firebase.analytics(app: FirebaseApp): FirebaseAnalytics = FirebaseAnalytics(getAnalytics(app.js))

public val FirebaseAnalytics.js: dev.gitlive.firebase.analytics.externals.FirebaseAnalytics get() = js

public actual class FirebaseAnalytics(internal val js: dev.gitlive.firebase.analytics.externals.FirebaseAnalytics) {
    public actual fun logEvent(
        name: String,
        parameters: Map<String, Any>?,
    ) {
        val json = json(*parameters?.map { it.key to it.value }.orEmpty().toTypedArray())
        dev.gitlive.firebase.analytics.externals.logEvent(js, name, json)
    }

    public actual fun setUserProperty(name: String, value: String) {
        dev.gitlive.firebase.analytics.externals.setUserProperties(js, json(name to value))
    }

    public actual fun setUserId(id: String?) {
        dev.gitlive.firebase.analytics.externals.setUserId(js, id)
    }

    public actual fun setAnalyticsCollectionEnabled(enabled: Boolean) {
        dev.gitlive.firebase.analytics.externals.setAnalyticsCollectionEnabled(js, enabled)
    }

    public actual fun setSessionTimeoutInterval(sessionTimeoutInterval: Duration) {
        dev.gitlive.firebase.analytics.externals.setSessionTimeoutInterval(js, sessionTimeoutInterval.inWholeMilliseconds)
    }

    public actual suspend fun getSessionId(): Long? = rethrow { dev.gitlive.firebase.analytics.externals.getSessionId(js).await() }

    public actual fun resetAnalyticsData() {
        dev.gitlive.firebase.analytics.externals.resetAnalyticsData(js)
    }

    public actual fun setDefaultEventParameters(parameters: Map<String, String>) {
        dev.gitlive.firebase.analytics.externals.setDefaultEventParameters(js, parameters)
    }

    public actual fun setConsent(consentSettings: Map<ConsentType, ConsentStatus>) {
        val consent = dev.gitlive.firebase.analytics.externals.ConsentSettings()
        consentSettings.forEach {
            when (it.key) {
                ConsentType.AD_PERSONALIZATION -> consent.ad_personalization = it.value.name
                ConsentType.AD_STORAGE -> consent.ad_storage = it.value.name
                ConsentType.AD_USER_DATA -> consent.ad_user_data = it.value.name
                ConsentType.ANALYTICS_STORAGE -> consent.analytics_storage = it.value.name
            }
        }
        dev.gitlive.firebase.analytics.externals.setConsent(js, consent)
    }

    public actual enum class ConsentType {
        AD_PERSONALIZATION,
        AD_STORAGE,
        AD_USER_DATA,
        ANALYTICS_STORAGE,
    }

    public actual enum class ConsentStatus {
        GRANTED,
        DENIED,
    }
}

public actual open class FirebaseAnalyticsException(code: String, cause: Throwable) : FirebaseException(code, cause)

internal inline fun <R> rethrow(function: () -> R): R {
    try {
        return function()
    } catch (e: Exception) {
        throw e
    } catch (e: dynamic) {
        throw errorToException(e)
    }
}

internal fun errorToException(error: dynamic) = (error?.code ?: error?.message ?: "")
    .toString()
    .lowercase()
    .let { code ->
        when {
            else -> {
                println("Unknown error code in ${JSON.stringify(error)}")
                FirebaseAnalyticsException(code, error.unsafeCast<Throwable>())
            }
        }
    }

```

### Core Architecture Module: `firebase-analytics/src/jsMain/kotlin/dev/gitlive/firebase/analytics/externals/analytics.kt`
```
@file:Suppress("ktlint:standard:property-naming", "PropertyName")
@file:JsModule("firebase/analytics")
@file:JsNonModule

package dev.gitlive.firebase.analytics.externals

import dev.gitlive.firebase.externals.FirebaseApp
import kotlin.js.Promise
import kotlin.js.Json

public external fun getAnalytics(app: FirebaseApp? = definedExternally): FirebaseAnalytics

public external fun logEvent(app: FirebaseAnalytics, name: String, parameters: Json?)
public external fun setUserProperties(app: FirebaseAnalytics, properties: Json)
public external fun setUserId(app: FirebaseAnalytics, id: String?)
public external fun resetAnalyticsData(app: FirebaseAnalytics)
public external fun setDefaultEventParameters(app: FirebaseAnalytics, parameters: Map<String, String>)
public external fun setAnalyticsCollectionEnabled(app: FirebaseAnalytics, enabled: Boolean)
public external fun setSessionTimeoutInterval(app: FirebaseAnalytics, sessionTimeoutInterval: Long)
public external fun getSessionId(app: FirebaseAnalytics): Promise<Long?>
public external fun setConsent(app: FirebaseAnalytics, consentSettings: ConsentSettings)

public external interface FirebaseAnalytics

public external class ConsentSettings {
    public var ad_personalization: String?
    public var ad_storage: String?
    public var ad_user_data: String?
    public var analytics_storage: String?
    public var functionality_storage: String?
    public var personalization_storage: String?
    public var security_storage: String?
}

```

### Core Architecture Module: `firebase-analytics/src/jvmMain/kotlin/dev/gitlive/firebase/analytics/analytics.jvm.kt`
```
package dev.gitlive.firebase.analytics

import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.FirebaseApp
import dev.gitlive.firebase.FirebaseException
import kotlin.time.Duration

public actual val Firebase.analytics: FirebaseAnalytics
    get() = TODO("Not yet implemented")

public actual fun Firebase.analytics(app: FirebaseApp): FirebaseAnalytics {
    TODO("Not yet implemented")
}

public actual class FirebaseAnalytics {
    public actual fun setUserProperty(name: String, value: String) {}
    public actual fun setUserId(id: String?) {}
    public actual fun resetAnalyticsData() {}
    public actual fun setAnalyticsCollectionEnabled(enabled: Boolean) {}
    public actual fun setSessionTimeoutInterval(sessionTimeoutInterval: Duration) {}
    public actual suspend fun getSessionId(): Long? = TODO("Not yet implemented")
    public actual fun setDefaultEventParameters(parameters: Map<String, String>) {}
    public actual fun logEvent(name: String, parameters: Map<String, Any>?) {}

    public actual fun setConsent(consentSettings: Map<ConsentType, ConsentStatus>) {}

    public actual enum class ConsentType {
        AD_PERSONALIZATION,
        AD_STORAGE,
        AD_USER_DATA,
        ANALYTICS_STORAGE,
    }

    public actual enum class ConsentStatus {
        GRANTED,
        DENIED,
    }
}

public actual class FirebaseAnalyticsException internal constructor(message: String) : FirebaseException(message)

```

### Core Architecture Module: `firebase-app/src/androidMain/kotlin/com/google/android/gms/tasks/Task.android.kt`
```
/*
 * Copyright (c) 2026 GitLive Ltd.  Use of this source code is governed by the Apache 2.0 license.
 */

package com.google.android.gms.tasks

import dev.gitlive.firebase.stub

/*
 * Header stubs for the Play Services Tasks API.
 *
 * Android and the JVM already have these classes (from play-services-tasks and firebase-java-sdk respectively) and
 * consumers get them from Play Services too, so they must not be shipped by this library. These declarations only
 * satisfy the `expect` declarations at compile time; the build deletes them from the compilation output
 * (see buildSrc utils/HeaderStubs.kt), so everything binds to the real classes. Only members that exist on the real
 * classes with the same JVM signature may be declared here (verified by the build).
 */

public actual abstract class Task<TResult> actual constructor() {
    public actual abstract val isComplete: Boolean
    public actual abstract val isSuccessful: Boolean
    public actual abstract val isCanceled: Boolean
    public actual abstract val result: TResult
    public actual abstract val exception: Exception?
    public actual abstract fun addOnSuccessListener(listener: OnSuccessListener<TResult>): Task<TResult>
    public actual abstract fun addOnFailureListener(listener: OnFailureListener): Task<TResult>
    public actual abstract fun addOnCompleteListener(listener: OnCompleteListener<TResult>): Task<TResult>
    public actual abstract fun addOnCanceledListener(listener: OnCanceledListener): Task<TResult>
    public actual abstract fun <TContinuationResult> continueWith(continuation: Continuation<TResult, TContinuationResult>): Task<TContinuationResult>
    public actual abstract fun <TContinuationResult> continueWithTask(continuation: Continuation<TResult, Task<TContinuationResult>>): Task<TContinuationResult>
    public actual abstract fun <TContinuationResult> onSuccessTask(successContinuation: SuccessContinuation<TResult, TContinuationResult>): Task<TContinuationResult>
}

public actual class TaskCompletionSource<TResult> actual constructor() {
    public actual val task: Task<TResult> get() = stub()
    public actual fun setResult(result: TResult?): Unit = stub()
    public actual fun setException(e: Exception): Unit = stub()
    public actual fun trySetResult(result: TResult?): Boolean = stub()
    public actual fun trySetException(e: Exception): Boolean = stub()
}

```

### Core Architecture Module: `firebase-app/src/androidMain/kotlin/com/google/firebase/FirebaseApp.android.kt`
```
/*
 * Copyright (c) 2026 GitLive Ltd.  Use of this source code is governed by the Apache 2.0 license.
 */

package com.google.firebase

import dev.gitlive.firebase.APPLICATION_CONTEXT_ANDROID_ONLY
import dev.gitlive.firebase.FROM_RESOURCE_ANDROID_ONLY
import dev.gitlive.firebase.GET_APPS_ANDROID_ONLY
import dev.gitlive.firebase.INITIALIZE_APP_ANDROID_ONLY
import dev.gitlive.firebase.stub

/*
 * Header stubs for the Firebase Android SDK core classes (see buildSrc utils/HeaderStubs.kt): they only satisfy the
 * `expect` declarations at compile time and are deleted from the compilation output, so the real classes from
 * com.google.firebase:firebase-common bind at runtime. Every member must exist on the real class with the same JVM
 * signature (verified by the build), except the `@Deprecated(level = ERROR)` members, which cannot be called: Android
 * code calling `initializeApp(Context)` binds to the real member.
 */

public actual open class FirebaseException : Exception {
    public actual constructor(message: String) : super(message)
    public actual constructor(message: String, cause: Throwable) : super(message, cause)
}

public actual class FirebaseNetworkException actual constructor(message: String) : FirebaseException(message)

public actual open class FirebaseTooManyRequestsException actual constructor(message: String) : FirebaseException(message)

public actual open class FirebaseApiNotAvailableException actual constructor(message: String) : FirebaseException(message)

public actual class FirebaseApp private constructor() {
    public actual val name: String get() = stub()
    public actual val options: FirebaseOptions get() = stub()
    public actual fun delete(): Unit = stub()
    public actual fun setAutomaticResourceManagementEnabled(enabled: Boolean): Unit = stub()

    @Deprecated(APPLICATION_CONTEXT_ANDROID_ONLY, level = DeprecationLevel.ERROR)
    public actual fun getApplicationContext(): Any = stub()

    public actual companion object {
        @JvmField
        public actual val DEFAULT_APP_NAME: String = "[DEFAULT]"

        @JvmStatic
        public actual fun getInstance(): FirebaseApp = stub()

        @JvmStatic
        public actual fun getInstance(name: String): FirebaseApp = stub()

        @JvmStatic
        @Deprecated(INITIALIZE_APP_ANDROID_ONLY, ReplaceWith("Firebase.initialize(context)", "com.google.firebase.Firebase", "com.google.firebase.initialize"), DeprecationLevel.ERROR)
        public actual fun initializeApp(context: Any?): FirebaseApp? = stub()

        @JvmStatic
        @Deprecated(INITIALIZE_APP_ANDROID_ONLY, ReplaceWith("Firebase.initialize(context, options)", "com.google.firebase.Firebase", "com.google.firebase.initialize"), DeprecationLevel.ERROR)
        public actual fun initializeApp(context: Any?, options: FirebaseOptions): FirebaseApp = stub()

        @JvmStatic
        @Deprecated(INITIALIZE_APP_ANDROID_ONLY, ReplaceWith("Firebase.initialize(context, options, name)", "com.google.firebase.Firebase", "com.google.firebase.initialize"), DeprecationLevel.ERROR)
        public actual fun initializeApp(context: Any?, options: FirebaseOptions, name: String): FirebaseApp = stub()

        @JvmStatic
        @Deprecated(GET_APPS_ANDROID_ONLY, ReplaceWith("Firebase.getApps(context)", "com.google.firebase.Firebase", "com.google.firebase.getApps"), DeprecationLevel.ERROR)
        public actual fun getApps(context: Any?): List<FirebaseApp> = stub()
    }
}

public actual class FirebaseOptions private constructor() {
    public actual val apiKey: String get() = stub()
    public actual val applicationId: String get() = stub()
    public actual val databaseUrl: String? get() = stub()
    public actual val gcmSenderId: String? get() = stub()
    public actual val projectId: String? get() = stub()
    public actual val storageBucket: String? get() = stub()
    public actual val gaTrackingId: String? get() = stub()

    public actual class Builder actual constructor() {
        public actual constructor(options: FirebaseOptions) : this()
        public actual fun setApiKey(apiKey: String): Builder = stub()
        public actual fun setApplicationId(applicationId: String): Builder = stub()
        public actual fun setDatabaseUrl(databaseUrl: String?): Builder = stub()
        public actual fun setGcmSenderId(gcmSenderId: String?): Builder = stub()
        public actual fun setProjectId(projectId: String?): Builder = stub()
        public actual fun setStorageBucket(storageBucket: String?): Builder = stub()
        public actual fun setGaTrackingId(gaTrackingId: String?): Builder = stub()
        public actual fun build(): FirebaseOptions = stub()
    }

    public actual companion object {
        @JvmStatic
        @Deprecated(FROM_RESOURCE_ANDROID_ONLY, ReplaceWith("Firebase.fromResource(context)", "com.google.firebase.Firebase", "com.google.firebase.fromResource"), DeprecationLevel.ERROR)
        public actual fun fromResource(context: Any?): FirebaseOptions? = stub()
    }
}

```

### Core Architecture Module: `firebase-app/src/androidMain/kotlin/com/google/firebase/Initialize.android.kt`
```
/*
 * Copyright (c) 2026 GitLive Ltd.  Use of this source code is governed by the Apache 2.0 license.
 */

@file:JvmName("FirebaseInitializeKt")

package com.google.firebase

import android.content.Context

/*
 * Unlike the header stubs around it, this file is shipped: the SDK's FirebaseKt only offers Context overloads, and a
 * top-level function can be overloaded from another file facade. The Context overloads stay more specific, so Android
 * code keeps calling the SDK's functions and only Any? arguments reach these (see buildSrc utils/HeaderStubs.kt keepClasses).
 */

public actual fun Firebase.initialize(context: Any?): FirebaseApp? = initialize(context.asAndroidContext())

public actual fun Firebase.initialize(context: Any?, options: FirebaseOptions): FirebaseApp = initialize(context.asAndroidContext(), options)

public actual fun Firebase.initialize(context: Any?, options: FirebaseOptions, name: String): FirebaseApp = initialize(context.asAndroidContext(), options, name)

public actual fun Firebase.getApps(context: Any?): List<FirebaseApp> = FirebaseAppStatics.getApps(context.asAndroidContext())

public actual fun Firebase.fromResource(context: Any?): FirebaseOptions? = FirebaseAppStatics.fromResource(context.asAndroidContext())

private fun Any?.asAndroidContext(): Context = requireNotNull(this as? Context) { "An android.content.Context is required on Android, got $this" }

```

### Core Architecture Module: `firebase-app/src/androidMain/kotlin/com/google/firebase/Timestamp.android.kt`
```
/*
 * Copyright (c) 2026 GitLive Ltd.  Use of this source code is governed by the Apache 2.0 license.
 */

package com.google.firebase

import dev.gitlive.firebase.TIMESTAMP_OF_DATE_ANDROID_ONLY
import dev.gitlive.firebase.TO_DATE_ANDROID_ONLY
import dev.gitlive.firebase.TO_INSTANT_ANDROID_ONLY
import dev.gitlive.firebase.stub

/*
 * Header stub for com.google.firebase.Timestamp (see buildSrc utils/HeaderStubs.kt): compiled against, verified to match
 * the real class, and deleted from the output so the real class binds at runtime.
 */

public actual class Timestamp actual constructor(seconds: Long, nanoseconds: Int) : Comparable<Timestamp> {
    @Deprecated(TIMESTAMP_OF_DATE_ANDROID_ONLY, level = DeprecationLevel.ERROR)
    public actual constructor(time: Any) : this(0, 0)

    public actual val seconds: Long get() = stub()
    public actual val nanoseconds: Int get() = stub()

    actual override fun compareTo(other: Timestamp): Int = stub()

    @Deprecated(TO_DATE_ANDROID_ONLY, ReplaceWith("toKotlinInstant()", "com.google.firebase.toKotlinInstant"), DeprecationLevel.ERROR)
    public actual fun toDate(): Any = stub()

    @Deprecated(TO_INSTANT_ANDROID_ONLY, ReplaceWith("toKotlinInstant()", "com.google.firebase.toKotlinInstant"), DeprecationLevel.ERROR)
    public actual fun toInstant(): Any = stub()

    public actual companion object {
        @JvmStatic
        public actual fun now(): Timestamp = stub()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #833** (2026-09-21): **Crash associated with FirebaseOptions**
  *Symptoms*: version: 2.4.0 platform: iOS  Hi, the app crashes when I try to access the “options” field (Firebase.app.**options**).  ``` Fatal Exception: NSInvalidArgumentException 0  CoreFoundation                 0x11523c __exceptionPreprocess 1  libobjc.A.dylib                0x31224 objc_exception_throw 2  CoreFoundation                 0x1861d4 -[NSObject(NSObject) __retain_OA] 3  CoreFoundation                 0x6352c ___forwarding___ 4  CoreFoundation                 0x6de60 _CF_forwarding_prep_0 5  xxx        0x3881a48 kfun:dev.gitlive.firebase.FirebaseApp#<get-options>(){}dev.gitlive.firebase.FirebaseOptions + 32 (firebase.kt:32) ```  I suppose the cause of this issue is the removal of the field trackingID from FirebaseCore in version 12.0.0: https://github.com/firebase/firebase-ios-sdk/releases/tag/12.0.0 https://github.com/firebase/firebase-ios-sdk/blob/main/FirebaseCore/CHANGELOG.md#firebase-1200  AI _Why Are There No Compilation Errors?_  _Objective-C (and therefore Kotlin/Native interop) does not verify selector existence at compile time. A call like [FIROptions trackingID] uses dynamic message dispatch, so the compiler has no way of knowing whether the method actually exists until it is invoked at runtime. As a result: ✅ Compilation — succeeds without any errors ✅ Application startup — works fine as long as that code path is not executed ❌ Runtime — the app crashes only when setUserId is called, because that's when [FIROptions trackingID] sends a message to a non-existent s
  **Post-Mortem & Fix Analysis**:
  > Your diagnosis is exactly right, including the reasoning about why it compiles and only fails at runtime.  `master` still reads `trackingID`:  ```kotlin // firebase-app/src/appleMain/.../firebase.kt:32 actual val options: FirebaseOptions     get() = ios.options.run { FirebaseOptions(bundleID, APIKey!!, databaseURL!!, trackingID, storageBucket, projectID, GCMSenderID) } ```  This SDK pins `firebase-cocoapods = "11.8.0"`, so cinterop generates the binding from headers where `FIROptions.trackingID` still exists and everything compiles. Your app links 12.x, where it's gone — and since Objective-C resolves selectors dynamically, that only surfaces as `NSInvalidArgumentException` at the moment the getter runs.  **It's already fixed on the SwiftPM branch** behind #836, which moves to firebase-ios-sdk 12.17.0 and therefore had to deal with it. The comment there reaches the same conclusion you did:  ```kotlin // FIROptions.trackingID was removed in firebase-ios-sdk 12.0.0, where it had long bee

- **Issue #826** (2026-09-21): **TypeError: setUserProperty is not a function on Kotlin/JS target Description**
  *Symptoms*: ## Description When running `firebase-analytics` on the Kotlin/JS target, calling the common API function `FirebaseAnalytics.setUserProperty(name, value)` throws a runtime `TypeError: setUserProperty is not a function`.  ## Underlying Cause In the `jsMain` actual wrapper for `FirebaseAnalytics`, the library defines an external binding mapping directly to an export named `setUserProperty` in the `"firebase/analytics"` NPM module:  ```kotlin // dev.gitlive.firebase.analytics.externals.analytics.kt @file:JsModule("firebase/analytics") @file:JsNonModule package dev.gitlive.firebase.analytics.externals  public external fun setUserProperty(app: FirebaseAnalytics, name: String, value: String) ```  However, the official Firebase JS SDK (v9/v10 modular API) **does not export a function named `setUserProperty`** (singular) under `"firebase/analytics"`. Instead, the official JS SDK only exports **`setUserProperties`** (plural) which takes an analytics instance and a properties object:  ```javascript import { setUserProperties } from "firebase/analytics"; setUserProperties(analytics, { favorite_food: "apples" }); ```  Because of this, the imported JS function resolves to `undefined` at runtime, causing any invocation of `setUserProperty(...)` in Kotlin/JS common code to crash.  ## Environment Details *   **Library Group/Artifact**: `dev.gitlive:firebase-analytics` / `dev.gitlive:firebase-analytics-js` *   **Library Version**: `2.4.0` *   **Kotlin Compiler Version**: `2.3.21` (Kotlin/JS) 
  **Post-Mortem & Fix Analysis**:
  > Michael Richardson fixed it on master in commit 7c28fa8a on 3 August 2026, titled "fix JS analytics user property binding". It was pushed directly rather than through a PR, so nothing links it to the issue

- **Issue #812** (2026-08-05): **library breaks when using firebase-android-bom v34.0.0**
  *Symptoms*: firebase-common-ktx got removed in this version. See the [migration notes](https://firebase.google.com/docs/android/kotlin-migration).  The error I got is:   ``` firebase-auth-ktx:.      Required by:          project ':androidApp' > project :composeApp > io.github.mirzemehdi:kmpauth-firebase:2.3.1 > io.github.mirzemehdi:kmpauth-firebase-android-debug:2.3.1 > dev.gitlive:firebase-auth:2.1.0 > dev.gitlive:firebase-auth-android-debug:2.1.0    > Could not find com.google.firebase:firebase-common-ktx:.      Required by:          project ':androidApp' > project :composeApp > io.github.mirzemehdi:kmpauth-firebase:2.3.1 > io.github.mirzemehdi:kmpauth-firebase-android-debug:2.3.1 > dev.gitlive:firebase-auth:2.1.0 > dev.gitlive:firebase-auth-android-debug:2.1.0 > dev.gitlive:firebase-app:2.1.0 > dev.gitlive:firebase-app-android-debug:2.1.0          project ':androidApp' > project :composeApp > io.github.mirzemehdi:kmpauth-firebase:2.3.1 > io.github.mirzemehdi:kmpauth-firebase-android-debug:2.3.1 > dev.gitlive:firebase-auth:2.1.0 > dev.gitlive:firebase-auth-android-debug:2.1.0 > dev.gitlive:firebase-common:2.1.0 > dev.gitlive:firebase-common-android-debug:2.1.0  ```
  **Post-Mortem & Fix Analysis**:
  > This is fixed — the `-ktx` dependencies were dropped in #738 ("Remove usage of `-ktx` dependencies", `d4ee35e5`, 11 Aug 2025), which shipped in **v2.2.0**.  Verified against the published POMs rather than just the source, since this is a resolution failure:  | `firebase-app-android` | `-ktx` mentions in POM | |---|---| | 2.1.0 | 1 | | 2.3.0 | 0 | | 2.4.0 | 0 | | 2.5.0 | 0 |  The 2.1.0 POM contains:  ```xml <dependency>   <groupId>com.google.firebase</groupId>   <artifactId>firebase-common-ktx</artifactId>   <scope>compile</scope> </dependency> ```  Note there's no `<version>` — it was supplied by the Firebase BoM. That's also why the error message ends in a bare colon (`Could not find com.google.firebase:firebase-common-ktx:.`): under BoM 34 the artifact no longer exists, so there is no version to fill in. `firebase-auth-android-2.1.0` declares `firebase-auth-ktx` the same way.  **The catch in your case is that upgrading isn't a one-line change,** because you don't depend on this libra

- **Issue #803** (2026-09-21): **Firebase Cloud Functions - HTTPS exceptions not handled correctly on iOS**
  *Symptoms*: The iOS implementation of how Firebase Cloud Functions HTTPS errors are handled does not align with Android (or otherwise).  See: https://github.com/GitLiveApp/firebase-kotlin-sdk/blob/master/firebase-functions/src/appleMain/kotlin/dev/gitlive/firebase/functions/functions.kt#L95  Instead of mapping it correctly, it currently just returns a hardcoded `FirebaseFunctionsException` with: - An error code that is always `FunctionsExceptionCode.UNKNOWN` - A `description!!` (of the class) as the message - An always `null` details  I see that there is a comment that fixing this may depend on https://github.com/firebase/firebase-ios-sdk/issues/11862, but that issue was closed some time ago.  Is there any way this can be fixed so that we can get the correct values being sent from Firebase?  Thanks
  **Post-Mortem & Fix Analysis**:
  > Can we set high priority on this?
  > My workaround for now is adding `httpResponseCode`. For example, in your cloud functions: ```ts       throw new HttpsError("not-found", "No data found", {         httpResponseCode: 404       }); ``` Extension function in Kotlin: ```kt val FirebaseFunctionsException.effectiveCode: FunctionsExceptionCode   get() {     val detailsMap = details as? Map<*, *>     val httpCode = (detailsMap?.get("httpResponseCode") as? Number)?.toInt()     return if (httpCode != null) {       httpResponseCodeToFunctionsExceptionCode(httpCode) ?: code     } else {       code     }   }  private fun httpResponseCodeToFunctionsExceptionCode(httpCode: Int): FunctionsExceptionCode? {   return when (httpCode) {     400 -> FunctionsExceptionCode.INVALID_ARGUMENT     401 -> FunctionsExceptionCode.UNAUTHENTICATED     403 -> FunctionsExceptionCode.PERMISSION_DENIED     404 -> FunctionsExceptionCode.NOT_FOUND     409 -> FunctionsExceptionCode.ABORTED     429 -> FunctionsExceptionCode.RESOURCE_EXHAUSTED     500 -> Functi
  > @anggrayudi thanks for the workaround 👍 Have you tested that this works on iOS?

- **Issue #788** (2026-09-21): **: Unknown calling package name 'com.google.android.gms'.**
  *Symptoms*: Failed to get service from broker.  (Ask Gemini)                                                                                                     java.lang.SecurityException: Unknown calling package name 'com.google.android.gms'.                                                                                                     	at android.os.Parcel.createExceptionOrNull(Parcel.java:3340)                                                                                                     	at android.os.Parcel.createException(Parcel.java:3324)                                                                                                     	at android.os.Parcel.readException(Parcel.java:3307)                                                                                                     	at android.os.Parcel.readException(Parcel.java:3249)                                                                                                     	at bckw.a(:com.google.android.gms@254730035@25.47.30 (260400-833691957):36)                                                                                                     	at bcix.z(:com.google.android.gms@254730035@25.47.30 (260400-833691957):143)                                                                                                     	at bbpa.run(:com.google.android.gms@254730035@25.47.30 (260400-833691957):42)                                                                                                     	at and
  **Post-Mortem & Fix Analysis**:
  > Short answer to "but data is coming why": because nothing is actually failing. This is a Google Play Services log, not an error from this SDK or from Firestore, and it's safe to ignore.  **Nothing in the trace belongs to this library.** Every frame is inside Play Services itself:  ``` bckw.a(:com.google.android.gms@254730035@25.47.30 ...) bcix.z(:com.google.android.gms@254730035@25.47.30 ...) bbpa.run(:com.google.android.gms@254730035@25.47.30 ...) android.os.Handler.handleCallback android.os.HandlerThread.run ```  Obfuscated GMS internals, running on GMS's own `HandlerThread`. There are no frames from your app, from the Firebase Android SDK, or from `dev.gitlive` — and the strings `Failed to get service from broker` / `Unknown calling package name` don't exist anywhere in this codebase. It isn't reachable from a Firestore call you make.  It's also worth knowing that on Android this library is a very thin wrapper — `Firebase.firestore` is just:  ```kotlin AndroidFirebaseFirestore.getIn

- **Issue #786** (2026-09-21): **Crash with FirebaseAuth.sendSignInLinkToEmail on iOS**
  *Symptoms*: Hello, I'm getting the following crash on iOS:  ``` *** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: '-[FIRActionCodeSettings setDynamicLinkDomain:]: unrecognized selector sent to instance 0x600000012250' *** First throw call stack: ( 	0   CoreFoundation                      0x00000001804f39e8 __exceptionPreprocess + 172 	1   libobjc.A.dylib                     0x000000018009c084 objc_exception_throw + 72 	2   CoreFoundation                      0x00000001805092a8 +[NSObject(NSObject) instanceMethodSignatureForSelector:] + 0 	3   CoreFoundation                      0x00000001804f7cb8 ___forwarding___ + 1196 	4   CoreFoundation                      0x00000001804fa1fc _CF_forwarding_prep_0 + 92 	5   DoubleStrain dev.debug.dylib        0x0000000105d2be78 kfun:dev.gitlive.firebase.auth#toIos__at__dev.gitlive.firebase.auth.ActionCodeSettings(){}cocoapods.FirebaseAuth.FIRActionCodeSettings + 1472 	6   DoubleStrain dev.debug.dylib        0x0000000105d27a28 kfun:dev.gitlive.firebase.auth.FirebaseAuth#sendSignInLinkToEmail#suspend(kotlin.String;dev.gitlive.firebase.auth.ActionCodeSettings;kotlin.coroutines.Continuation<kotlin.Unit>){}kotlin.Any + 608	7   DoubleStrain dev.debug.dylib        0x00000001055b95c4 ```  It seems to be caused by calling `setDynamicLinkDomain` in `firebase-ios-sdk` which doesn't exist in the version my app depends upon (`12.4.0` but also if I upgrade to `12.7.0`). Dynamic domains are deprecated and about to go away entirely s
  **Post-Mortem & Fix Analysis**:
  > Facing the same issue
  > Your diagnosis is exactly right, and there's a fix you can use today that doesn't involve swizzling.  **Still present on master.** `firebase-auth/src/appleMain/.../auth.kt:154`:  ```kotlin internal fun ActionCodeSettings.toIos() = FIRActionCodeSettings().also {     it.setURL(NSURL.URLWithString(url))     androidPackageName?.run { it.setAndroidPackageName(packageName, installIfNotAvailable, minimumVersion) }     dynamicLinkDomain?.run { it.setDynamicLinkDomain(this) }   // <- line 157, your crash     linkDomain?.run { it.setLinkDomain(this) }     it.setHandleCodeInApp(canHandleCodeInApp)     iOSBundleId?.run { it.setIOSBundleID(this) } } ```  This SDK still pins `firebase-cocoapods = "11.8.0"`, where `setDynamicLinkDomain:` exists, so cinterop generates the binding and it compiles. Your app links 12.x, where the selector is gone — hence `unrecognized selector` at runtime rather than at build time.  **The workaround: use `linkDomain` instead of `dynamicLinkDomain`.**  Note the crashing c

- **Issue #774** (2026-09-21): **FirebaseAuth not storing logged in user**
  *Symptoms*: I've implemented Firebase sign in via Google sign in. Flow looks fine most of the time. I monitor it with this piece of code: ```     val userFlow = firebaseAuth.authStateChanged         .onEach { debugLogDefault("user collected: ${it?.uid}") }         .stateIn(             repositoryScope,             SharingStarted.Eagerly,             null         ) ``` On emulator or my Samsung S24 it acts normally. After sign in flow logs my logged in userId. After app relaunch same thing happens as expected.   But not on my Pixel 10 Pro... this one, behaves like it is not caching user data after signing in. Flow logs userid after I log in there and this doesn't change until app is alive. After relaunch tho it acts like the user never signed in and `userFlow` emits null  Devices OS: - Pixel is running Android 16.  - Emulator is running Android 16 - S24  is running Android 15. 
  **Post-Mortem & Fix Analysis**:
  > Same problem. Works on the emulator, but on my Pixel 9 Pro (Android 16) it clear the user when the app relaunches.
  > Same Problem
  > Not much help, but what's interesting is that it started randomly working again after 2 days, I'm pretty sure that I didn't change anything to do with firebase...

- **Issue #765** (2026-09-21): **Sync Error: No matching variant of dev.gitlive:firebase-analytics:2.3.0 was found.**
  *Symptoms*: > Could not resolve all files for configuration ':shared:iosX64CInterop'.    > Could not resolve dev.gitlive:firebase-analytics:2.3.0.      Required by:          project :shared       > No matching variant of dev.gitlive:firebase-analytics:2.3.0 was found. The consumer was configured to find a library for use during 'kotlin-cinterop', with the library elements 'cinterop-klib', preferably optimized for non-jvm, as well as attribute 'org.jetbrains.kotlin.klib.packaging' with value 'non-packed', attribute 'org.jetbrains.kotlin.native.target' with value 'ios_x64', attribute 'org.jetbrains.kotlin.platform.type' with value 'native' but:           - Variant 'iosArm64ApiElements-published' declares a library for use during 'kotlin-api', preferably optimized for non-jvm, as well as attribute 'org.jetbrains.kotlin.platform.type' with value 'native':               - Incompatible because this component declares a component, as well as attribute 'org.jetbrains.kotlin.native.target' with value 'ios_arm64' and the consumer needed a component, as well as attribute 'org.jetbrains.kotlin.native.target' with value 'ios_x64'               - Other compatible attributes:                   - Doesn't say anything about its elements (required them with the library elements 'cinterop-klib')                   - Doesn't say anything about org.jetbrains.kotlin.klib.packaging (required 'non-packed')           - Variant 'iosArm64MetadataElements-published' declares a library, preferably optimized for non-j
  **Post-Mortem & Fix Analysis**:
  > It seems that the `iosX64` target was removed in https://github.com/GitLiveApp/firebase-kotlin-sdk/commit/469dc8ac585e31000cd70e4adb4b5a4db8decd12 and is no longer published: https://central.sonatype.com/artifact/dev.gitlive/firebase-auth-iosx64/2.1.0?smo=true  @nbransby ~Would it be possible to revert the commit, or were there any specific reasons to drop `iosX64` support?~ Edit: Just found https://github.com/GitLiveApp/firebase-kotlin-sdk/issues/750#issuecomment-3197274509
  > @ChristianKatzmann So we need to remove iosX64 target from our projects?
  > You could also stay with version 2.1.0. If you want to use version 2.2.0 or higher, you have to remove `iosX64`, yes.

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

### Incident Patch 1: `04d2e79b` (2026-09-25)
**Commit Message**: docs: fix the server timestamp example, which did not compile (#849)

The Server Timestamp snippet could not compile, in five separate ways:

- `val timestamp: Timestamp = Timestamp.ServerTimestamp` is a type error.
  `ServerTimestamp` is declared as `data object ServerTimestamp : BaseTimestamp`,
  so the field has to be typed `BaseTimestamp`. This is what people actually
  hit when following the docs.
- `timestamp` was declared twice as a constructor parameter of the same class.
- `val timestamp = ServerValue.TIMESTAMP` and
  `val alternativeTimestamp = FieldValue.serverTimestamp` omit the type, which
  constructor parameters may not do.
- a trailing comma after `@Serializable(with = DoubleAsTimestampSerializer::class)`
  is a syntax error.
- `DoubleAsTimestampSerializer.serverTimestamp` does not exist; the constant is
  `DoubleAsTimestampSerializer.SERVER_TIMESTAMP`.

Split the Realtime Database and Cloud Firestore cases into separate snippets,
since the original combined them into one class with a duplicated field name,
and note why the Firestore field is a `BaseTimestamp`.

Fixes #666

Co-authored-by: anggrayudi.hardiannico <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +18/-7)
```diff
@@ -253,18 +253,29 @@ val storedCity = db.collection("cities").document("UK").get().data(AbstractCity.
 
 [Firestore](https://firebase.google.com/docs/reference/kotlin/com/google/firebase/firestore/FieldValue?hl=en#serverTimestamp()) and the [Realtime Database](https://firebase.google.com/docs/reference/android/com/google/firebase/database/ServerValue#TIMESTAMP) provide a sentinel value you can use to set a field in your document to a server timestamp. So you can use these values in custom classes:
 
+In case using the Realtime Database:
+
+```kotlin
+@Serializable
+data class Post(
+    val timestamp: ServerValue = ServerValue.TIMESTAMP,
+)
+```
+
+In case using Cloud Firestore:
+
 ```kotlin
 @Serializable
 data class Post(
-    // In case using Realtime Database.
-    val timestamp = ServerValue.TIMESTAMP,
-    // In case using Cloud Firestore.
-    val timestamp: Timestamp = Timestamp.ServerTimestamp,
+    // `Timestamp.ServerTimestamp` is a `BaseTimestamp`, not a `Timestamp`, so declare the field as
+    // `BaseTimestamp` for it to hold either the sentinel or a concrete `Timestamp` read back from
+    // the server.
+    val timestamp: BaseTimestamp = Timestamp.ServerTimestamp,
     // or
-    val alternativeTimestamp = FieldValue.serverTimestamp,
+    val alternativeTimestamp: FieldValue = FieldValue.serverTimestamp,
     // or
-    @Serializable(with = DoubleAsTimestampSerializer::class),
-    val doubleTimestamp: Double = DoubleAsTimestampSerializer.serverTimestamp
+    @Serializable(with = DoubleAsTimestampSerializer::class)
+    val doubleTimestamp: Double = DoubleAsTimestampSerializer.SERVER_TIMESTAMP,
 )
 ```
 
```

---

### Incident Patch 2: `df8be445` (2026-09-24)
**Commit Message**: Fix remoteConfig(app) ignoring its app on Apple (2.x) (#903)

* Fix remoteConfig(app) and the platform getters ignoring their instance (#898)

On Apple, Firebase.remoteConfig(app) passed Firebase.app.ios to
FIRRemoteConfig.remoteConfigWithApp, so every app got the default app's
Remote Config. It now passes app.ios.

The public FirebaseRemoteConfig.ios (Apple) and FirebaseRemoteConfig.android
(Android and JVM) getters also ignored their receiver and returned the
default app's instance. They now return the wrapped instance, as the JS
and wasmJs getters already did.

testNamedApp sets a default on a named app's Remote Config and checks
that the default app's instance does not see it.

* Give testNamedApp's app its own app ID (#899)

On Android, Remote Config stores its fetched, activated and default
values in files named frc_<appId>_<namespace>_<type>.json. The named app
reused the default app's options, so both apps shared the same defaults
file and the default app saw the named app's default, failing
testNamedApp on the Android managed device. iOS, JS and wasmJs keep the
storage per app and passed.

The named app now uses an app ID that differs in its last hex digit,
which still pas

**File**: `firebase-config/src/androidMain/kotlin/dev/gitlive/firebase/remoteconfig/FirebaseRemoteConfig.kt` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ import com.google.firebase.remoteconfig.FirebaseRemoteConfig as AndroidFirebaseR
 import com.google.firebase.remoteconfig.FirebaseRemoteConfigInfo as AndroidFirebaseRemoteConfigInfo
 import com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings as AndroidFirebaseRemoteConfigSettings
 
-public val FirebaseRemoteConfig.android: AndroidFirebaseRemoteConfig get() = AndroidFirebaseRemoteConfig.getInstance()
+public val FirebaseRemoteConfig.android: AndroidFirebaseRemoteConfig get() = android
 
 public actual val Firebase.remoteConfig: FirebaseRemoteConfig
     get() = FirebaseRemoteConfig(com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance())
```

**File**: `firebase-config/src/appleMain/kotlin/dev/gitlive/firebase/remoteconfig/FirebaseRemoteConfig.kt` (modified, +2/-3)
```diff
@@ -11,7 +11,6 @@ import cocoapods.FirebaseRemoteConfig.FIRRemoteConfigSource
 import dev.gitlive.firebase.Firebase
 import dev.gitlive.firebase.FirebaseApp
 import dev.gitlive.firebase.FirebaseException
-import dev.gitlive.firebase.app
 import dev.gitlive.firebase.ios
 import kotlinx.coroutines.CompletableDeferred
 import kotlinx.datetime.Instant
@@ -22,13 +21,13 @@ import kotlin.time.Duration.Companion.seconds
 import kotlin.time.DurationUnit
 import kotlin.time.ExperimentalTime
 
-public val FirebaseRemoteConfig.ios: FIRRemoteConfig get() = FIRRemoteConfig.remoteConfig()
+public val FirebaseRemoteConfig.ios: FIRRemoteConfig get() = ios
 
 public actual val Firebase.remoteConfig: FirebaseRemoteConfig
     get() = FirebaseRemoteConfig(FIRRemoteConfig.remoteConfig())
 
 public actual fun Firebase.remoteConfig(app: FirebaseApp): FirebaseRemoteConfig = FirebaseRemoteConfig(
-    FIRRemoteConfig.remoteConfigWithApp(Firebase.app.ios as objcnames.classes.FIRApp),
+    FIRRemoteConfig.remoteConfigWithApp(app.ios as objcnames.classes.FIRApp),
 )
 
 public actual class FirebaseRemoteConfig internal constructor(internal val ios: FIRRemoteConfig) {
```

**File**: `firebase-config/src/commonTest/kotlin/dev/gitlive/firebase/remoteconfig/FirebaseRemoteConfig.kt` (modified, +14/-0)
```diff
@@ -15,6 +15,7 @@ import kotlin.test.BeforeTest
 import kotlin.test.Ignore
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertFalse
 import kotlin.time.Duration.Companion.minutes
 import kotlin.time.Duration.Companion.seconds
 import kotlin.time.ExperimentalTime
@@ -74,6 +75,19 @@ class FirebaseRemoteConfigTest {
         assertEquals("Hello World", value.asByteArray().decodeToString())
     }
 
+    @Test
+    fun testNamedApp() = runTest {
+        // Android keys Remote Config's local storage by app ID, so the named app needs its own
+        val options = Firebase.apps(context).first().options.copy(applicationId = "1:846484016111:ios:dd1f6688bad7af768c841b")
+        val namedApp = Firebase.initialize(context, options, "named")
+        val namedRemoteConfig = Firebase.remoteConfig(namedApp)
+        namedRemoteConfig.setDefaults("named_app_only" to "named")
+
+        assertEquals("named", namedRemoteConfig.getValue("named_app_only").asString())
+        assertFalse(remoteConfig.all.containsKey("named_app_only"))
+        namedRemoteConfig.reset()
+    }
+
     @Test
     fun testGetAll() = runTest {
         remoteConfig.setDefaults(*defaults)
```

---

### Incident Patch 3: `52944f2e` (2026-09-02)
**Commit Message**: Revert dokka to 2.0.0 and pin against 2.2.x

dokka 2.2.0 removes Gradle plugin V1 mode, which breaks publishing in two
separate ways:

- publish.yml runs 'dokkaHtmlMultiModule', a V1 task. Under 2.2.0 it fails
  with 'Cannot run Dokka V1 tasks when V2 mode is enabled'.
- Publishing then routes through V2's dokkaGeneratePublicationHtml, whose
  new pre-generation validity check rejects two source sets sharing a
  source root. 10 of the 14 modules do exactly that: their jvmMain source
  set adds kotlin.srcDir("src/androidMain/kotlin"), so 'android' and 'jvm'
  share a root and the task fails.

Neither is caught by PR CI, because dokka only runs during publish. The
bump (#861) passed every check and broke the 2.7.0 release instead, after
firebase-analytics had already been pushed to Maven Central.

2.6.0 published cleanly on dokka 2.0.0, so this restores a known-good
configuration. Moving to 2.2.x later needs the V1 task names in publish.yml
replaced and the shared-source-root arrangement resolved.

**File**: `.github/dependabot.yml` (modified, +10/-0)
```diff
@@ -12,6 +12,16 @@ updates:
       # that is fixed. See also #855, which introduced and then reverted the bump.
       - dependency-name: "org.jetbrains.kotlinx:kotlinx-coroutines-*"
         versions: [ "1.11.x" ]
+      # dokka 2.2.0 added a pre-generation validity check that rejects two source sets
+      # sharing a source root. 10 of the 14 modules do exactly that: their jvmMain
+      # source set adds kotlin.srcDir("src/androidMain/kotlin"), so 'android' and 'jvm'
+      # share a root and dokkaGeneratePublicationHtml fails. That runs during publish,
+      # not in PR CI, so the bump passed every check and only broke at release time.
+      # Remove this once dokka can handle shared source roots (Kotlin/dokka#3701).
+      - dependency-name: "org.jetbrains.dokka:*"
+        versions: [ "2.2.x" ]
+      - dependency-name: "org.jetbrains.dokka"
+        versions: [ "2.2.x" ]
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ ios-deploymentTarget = "13.0"
 tvos-deploymentTarget = "13.0"
 macos-deploymentTarget = "10.15"
 test-logger-plugin = "4.0.0"
-dokka = "2.2.0"
+dokka = "2.0.0"
 publish = "0.34.0"
 
 [libraries]
```

---

### Incident Patch 4: `7ad5b8d8` (2026-09-01)
**Commit Message**: Revert kotlinx-coroutines to 1.10.2 and pin against 1.11.x

1.11.0 regressed Promise rejection handling on Wasm/JS. A rejected Promise
no longer surfaces as JsException, so the raw JS error object is discarded
(cause is empty) and only its stringified form survives. Firebase errors
carry structured details -- code, reason, httpResponseCode -- which are then
unrecoverable, and every error-mapping site stops matching silently: the
code still compiles and the exception still propagates, just unmapped.

Tracked upstream in Kotlin/kotlinx.coroutines#4678. There is no public API
to recover the value; the new carrier is kotlinx.coroutines.internal.

The bump (#855) passed CI only because master has no wasm target yet, so
nothing exercised the affected path. Nothing here depends on a 1.11.0 API,
and Kotlin 2.4.0 works with 1.10.2, so reverting costs nothing. The
alternative was bypassing Promise.await across nine modules.

Once the wasm target lands, a future bump will fail loudly rather than
silently, so the dependabot ignore can be removed with confidence then.

**File**: `.github/dependabot.yml` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@ updates:
     directory: "/"
     schedule:
       interval: "weekly"
+    ignore:
+      # kotlinx-coroutines 1.11.0 regressed Promise rejection handling on Wasm/JS:
+      # a rejected Promise no longer surfaces as JsException, so the raw JS error
+      # object (and its structured `details`) is unrecoverable through public API.
+      # Tracked upstream in Kotlin/kotlinx.coroutines#4678. Remove this entry once
+      # that is fixed. See also #855, which introduced and then reverted the bump.
+      - dependency-name: "org.jetbrains.kotlinx:kotlinx-coroutines-*"
+        versions: [ "1.11.x" ]
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ gitlive-firebase-java-sdk = "0.6.3"
 gson = "2.14.0"
 junit = "4.13.2"
 kotlin = "2.2.21"
-kotlinx-coroutines = "1.11.0"
+kotlinx-coroutines = "1.10.2"
 kotlinx-serialization = "1.9.0"
 kotlinx-binarycompatibilityvalidator = "0.18.1"
 kotlinx-datetime = "0.7.1"
```

---

### Incident Patch 5: `2121bdf6` (2026-08-12)
**Commit Message**: Add FirebaseCrashlytics.recordException overload that takes key-value pairs (#784)

**File**: `firebase-crashlytics/api/firebase-crashlytics.api` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ public final class dev/gitlive/firebase/crashlytics/FirebaseCrashlytics {
 	public final fun didCrashOnPreviousExecution ()Z
 	public final fun log (Ljava/lang/String;)V
 	public final fun recordException (Ljava/lang/Throwable;)V
+	public final fun recordException (Ljava/lang/Throwable;Ljava/util/Map;)V
 	public final fun sendUnsentReports ()V
 	public final fun setCrashlyticsCollectionEnabled (Z)V
 	public final fun setCustomKey (Ljava/lang/String;D)V
```

**File**: `firebase-crashlytics/src/androidMain/kotlin/dev/gitlive/firebase/crashlytics/crashlytics.kt` (modified, +31/-14)
```diff
@@ -18,56 +18,73 @@ public actual class FirebaseCrashlytics internal constructor(internal val androi
     public actual fun recordException(exception: Throwable) {
         android.recordException(exception)
     }
+
+    public actual fun recordException(exception: Throwable, customKeys: Map<String, Any>) {
+        android.recordException(exception, customKeys.toCustomKeysAndValues())
+    }
+
     public actual fun log(message: String) {
         android.log(message)
     }
+
     public actual fun setUserId(userId: String) {
         android.setUserId(userId)
     }
+
     public actual fun setCrashlyticsCollectionEnabled(enabled: Boolean) {
         android.setCrashlyticsCollectionEnabled(enabled)
     }
+
     public actual fun sendUnsentReports() {
         android.sendUnsentReports()
     }
+
     public actual fun deleteUnsentReports() {
         android.deleteUnsentReports()
     }
+
     public actual fun didCrashOnPreviousExecution(): Boolean = android.didCrashOnPreviousExecution()
+
     public actual fun setCustomKey(key: String, value: String) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKey(key: String, value: Boolean) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKey(key: String, value: Double) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKey(key: String, value: Float) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKey(key: String, value: Int) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKey(key: String, value: Long) {
         android.setCustomKey(key, value)
     }
+
     public actual fun setCustomKeys(customKeys: Map<String, Any>) {
-        android.setCustomKeys(
-            Builder().apply {
-                customKeys.forEach { (key, value) ->
-                    when (value) {
-                        is String -> putString(key, value)
-                        is Boolean -> putBoolean(key, value)
-                        is Double -> putDouble(key, value)
-                        is Float -> putFloat(key, value)
-                        is Int -> putInt(key, value)
-                        is Long -> putLong(key, value)
-                    }
-                }
-            }.build(),
-        )
+        android.setCustomKeys(customKeys.toCustomKeysAndValues())
     }
+
+    private fun Map<String, Any>.toCustomKeysAndValues() = Builder().apply {
+        forEach { (key, value) ->
+            when (value) {
+                is String -> putString(key, value)
+                is Boolean -> putBoolean(key, value)
+                is Double -> putDouble(key, value)
+                is Float -> putFloat(key, value)
+                is Int -> putInt(key, value)
+                is Long -> putLong(key, value)
+            }
+        }
+    }.build()
 }
 
 public actual open class FirebaseCrashlyticsException(message: String) : FirebaseException(message)
```

**File**: `firebase-crashlytics/src/appleMain/kotlin/dev/gitlive/firebase/crashlytics/crashlytics.kt` (modified, +19/-0)
```diff
@@ -6,6 +6,8 @@ import platform.Foundation.NSLocalizedDescriptionKey
 import dev.gitlive.firebase.Firebase
 import dev.gitlive.firebase.FirebaseApp
 import dev.gitlive.firebase.FirebaseException
+import kotlin.Any
+import kotlin.collections.Map
 
 public val FirebaseCrashlytics.ios: FIRCrashlytics get() = FIRCrashlytics.crashlytics()
 
@@ -19,37 +21,54 @@ public actual class FirebaseCrashlytics internal constructor(internal val ios: F
     public actual fun recordException(exception: Throwable) {
         ios.recordError(exception.asNSError())
     }
+
+    @Suppress("UNCHECKED_CAST")
+    public actual fun recordException(exception: Throwable, customKeys: Map<String, Any>) {
+        ios.recordError(exception.asNSError(), customKeys as Map<Any?, *>)
+    }
+
     public actual fun log(message: String) {
         ios.log(message)
     }
+
     public actual fun setUserId(userId: String) {
         ios.setUserID(userId)
     }
+
     public actual fun setCrashlyticsCollectionEnabled(enabled: Boolean) {
         ios.setCrashlyticsCollectionEnabled(enabled)
     }
+
     public actual fun sendUnsentReports() {
         ios.sendUnsentReports()
     }
+
     public actual fun deleteUnsentReports() {
         ios.deleteUnsentReports()
     }
+
     public actual fun didCrashOnPreviousExecution(): Boolean = ios.didCrashDuringPreviousExecution()
+
     public actual fun setCustomKey(key: String, value: String) {
         ios.setCustomValue(value, key)
     }
+
     public actual fun setCustomKey(key: String, value: Boolean) {
         ios.setCustomValue(value.toString(), key)
     }
+
     public actual fun setCustomKey(key: String, value: Double) {
         ios.setCustomValue(value.toString(), key)
     }
+
     public actual fun setCustomKey(key: String, value: Float) {
         ios.setCustomValue(value.toString(), key)
     }
+
     public actual fun setCustomKey(key: String, value: Int) {
         ios.setCustomValue(value.toString(), key)
     }
+
     public actual fun setCustomKey(key: String, value: Long) {
         ios.setCustomValue(value.toString(), key)
     }
```

**File**: `firebase-crashlytics/src/commonMain/kotlin/dev/gitlive/firebase/crashlytics/crashlytics.kt` (modified, +15/-0)
```diff
@@ -27,6 +27,21 @@ public expect class FirebaseCrashlytics {
      */
     public fun recordException(exception: Throwable)
 
+    /**
+     * Records a non-fatal report to send to Crashlytics.
+     *
+     * Combined with app level custom keys, the event is restricted to a maximum of 64 key/value
+     * pairs. New keys beyond that limit are ignored. Keys or values that exceed 1024 characters are
+     * truncated.
+     *
+     * The values of event keys override the values of app level custom keys if they're identical.
+     *
+     * @param exception a [Throwable] to be recorded as a non-fatal event.
+     * @param customKeys A dictionary of keys and the values to associate with the non fatal
+     *                      exception, in addition to the app level custom keys.
+     */
+    public fun recordException(exception: Throwable, customKeys: Map<String, Any>)
+
     /**
      * Logs a message that's included in the next fatal, non-fatal, or ANR report.
      *
```

**File**: `firebase-crashlytics/src/jvmMain/kotlin/dev/gitlive/firebase/crashlytics/crashlytics.jvm.kt` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@ actual class FirebaseCrashlytics {
     actual fun recordException(exception: Throwable) {
     }
 
+    actual fun recordException(exception: Throwable, customKeys: Map<String, Any>) {
+    }
+
     actual fun log(message: String) {
     }
 
```

---

### Incident Patch 6: `071501f1` (2026-08-10)
**Commit Message**: fix(build): publish the Firebase BoM on the api variant (#851)

The Google Firebase artifacts are declared with `api` and no version, so
their versions come from the BoM. The BoM itself was declared with
`implementation`, which puts it only in runtimeElements. The published
metadata therefore ends up as:

  releaseApiElements-published
    com.google.firebase:firebase-common   (no version, nothing to resolve it)
  releaseRuntimeElements-published
    com.google.firebase:firebase-common   (no version)
    com.google.firebase:firebase-bom      platform 33.15.0

A consumer resolving a compile classpath sees firebase-common with no
version and no constraint to supply one, and the build fails with
"Could not find com.google.firebase:firebase-common:" -- note the trailing
colon where the version would be. Runtime classpaths resolve fine, which is
why this only shows up on compile/lint/androidTest configurations.

Declare the BoM with `api` so the constraint reaches both variants.

Fixes #356

Co-authored-by: anggrayudi.hardiannico <[REDACTED_EMAIL]>

**File**: `build.gradle.kts` (modified, +4/-1)
```diff
@@ -126,7 +126,10 @@ subprojects {
         dependencies {
             "commonMainImplementation"(libs.kotlinx.coroutines.core)
             "androidMainImplementation"(libs.kotlinx.coroutines.play.services)
-            "androidMainImplementation"(platform(libs.firebase.bom))
+            // api, not implementation: the Firebase artifacts are declared with `api` and without a
+            // version, so the BoM has to reach the api variant as well or a consumer resolving the
+            // compile classpath has nothing to supply the version from.
+            "androidMainApi"(platform(libs.firebase.bom))
             "commonTestImplementation"(kotlin("test-common"))
             "commonTestImplementation"(kotlin("test-annotations-common"))
             if (this@afterEvaluate.name != "firebase-crashlytics") {
```

---

### Incident Patch 7: `d4c674b8` (2026-08-05)
**Commit Message**: apply the same fix to the phone auth instrumented test

PhoneAuthTest landed in #841 after this branch was cut and carries the same
apps().firstOrNull() reuse with a delete-all-apps teardown. It is in
firebase-auth, which is one of the two modules #777 shows failing under BoM
34, so it would hit the same "FirebaseApp was deleted" failure once the BoM
lands.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `firebase-auth/src/androidInstrumentedTest/kotlin/dev/gitlive/firebase/auth/phoneAuth.kt` (modified, +12/-4)
```diff
@@ -7,6 +7,7 @@ package dev.gitlive.firebase.auth
 import android.app.Activity
 import androidx.test.core.app.ActivityScenario
 import dev.gitlive.firebase.Firebase
+import dev.gitlive.firebase.FirebaseApp
 import dev.gitlive.firebase.FirebaseOptions
 import dev.gitlive.firebase.apps
 import dev.gitlive.firebase.initialize
@@ -48,15 +49,23 @@ class PhoneAuthTest {
          * has timed out is clearly distinguishable from one which asks as soon as it is sent.
          */
         const val AUTO_RETRIEVAL_TIMEOUT_SECONDS = 120L
+
+        // A fresh instance of the test class is created per test, so the counter has to
+        // live here for the generated app names to stay unique across the whole run.
+        var nextAppId = 0
     }
 
+    private lateinit var app: FirebaseApp
     private lateinit var auth: FirebaseAuth
     private lateinit var scenario: ActivityScenario<Activity>
     private lateinit var activity: Activity
 
+    // Each test gets its own uniquely named app, deleted again in teardown. Reusing
+    // whatever Firebase.apps() returned would hand back the app deleted by the previous
+    // test and fail with "FirebaseApp was deleted".
     @BeforeTest
     fun initializeFirebase() {
-        val app = Firebase.apps(context).firstOrNull() ?: Firebase.initialize(
+        app = Firebase.initialize(
             context,
             FirebaseOptions(
                 applicationId = "1:846484016111:ios:dd1f6688bad7af768c841a",
@@ -66,6 +75,7 @@ class PhoneAuthTest {
                 projectId = PROJECT_ID,
                 gcmSenderId = "846484016111",
             ),
+            "phoneAuthTest${nextAppId++}",
         )
 
         auth = Firebase.auth(app).apply {
@@ -81,9 +91,7 @@ class PhoneAuthTest {
     @AfterTest
     fun deinitializeFirebase() = runBlockingTest {
         scenario.close()
-        Firebase.apps(context).forEach {
-            it.delete()
-        }
+        app.delete()
     }
 
     @Test
```

---

### Incident Patch 8: `e8622c99` (2026-08-04)
**Commit Message**: Fix android phone authentication

Ask for the sms code as soon as it has been sent rather than once auto
retrieval has timed out, as recommended by the firebase documentation.
This brings android in line with ios and js, which have always prompted
as soon as the code is sent.

Android is the only platform that can also complete the verification
without any user input, via sms auto retrieval, so the two now race via
select and the losing side is cancelled. Previously a successful auto
retrieval left the code entry coroutine suspended on the user, keeping
the enclosing scope alive indefinitely.

Resending issues a new verification id and invalidates the previous one,
so the code is submitted against the most recent id rather than the one
from the first onCodeSent.

Failures are reported by failing the CompletableDeferred rather than
completing it with a Result.

Adds instrumented tests for the prompt timing and the resend path against
the auth emulator. Phone auth cannot be covered from commonTest as an
Activity is required and PhoneVerificationProvider exposes different
members on every platform.

Co-authored-by: Charles Etieve <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5 <[REDA

**File**: `firebase-auth/src/androidInstrumentedTest/AndroidManifest.xml` (modified, +9/-1)
```diff
@@ -1,4 +1,12 @@
 <manifest xmlns:android="http://schemas.android.com/apk/res/android">
 
-    <application android:usesCleartextTraffic="true" />
+    <application android:usesCleartextTraffic="true">
+
+        <!-- phone auth requires an activity to attach app verification to, see PhoneAuthTest -->
+        <activity
+            android:name="android.app.Activity"
+            android:exported="false"
+            android:theme="@android:style/Theme.Material.Light.NoActionBar" />
+
+    </application>
 </manifest>
```

**File**: `firebase-auth/src/androidInstrumentedTest/kotlin/dev/gitlive/firebase/auth/phoneAuth.kt` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+/*
+ * Copyright (c) 2020 GitLive Ltd.  Use of this source code is governed by the Apache 2.0 license.
+ */
+
+package dev.gitlive.firebase.auth
+
+import android.app.Activity
+import androidx.test.core.app.ActivityScenario
+import dev.gitlive.firebase.Firebase
+import dev.gitlive.firebase.FirebaseOptions
+import dev.gitlive.firebase.apps
+import dev.gitlive.firebase.initialize
+import dev.gitlive.firebase.runBlockingTest
+import dev.gitlive.firebase.runTest
+import kotlinx.coroutines.CompletableDeferred
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.delay
+import kotlinx.coroutines.withContext
+import org.json.JSONObject
+import java.net.URL
+import java.util.concurrent.TimeUnit
+import kotlin.random.Random
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+import kotlin.time.Duration.Companion.seconds
+import kotlin.time.TimeSource
+
+/**
+ * Phone auth cannot be covered from commonTest like the rest of the auth suite: [PhoneAuthProvider]
+ * requires an [Activity] to attach app verification to, and [PhoneVerificationProvider] exposes
+ * different members on every platform, so there is no shared surface to test against.
+ *
+ * No sms is sent - the auth emulator records the code it would have sent and serves it back over its
+ * rest api, which is what [TestPhoneVerificationProvider] reads instead of prompting a user.
+ */
+class PhoneAuthTest {
+
+    private companion object {
+        const val PROJECT_ID = "fir-kotlin-sdk"
+        const val AUTH_EMULATOR_PORT = 9099
+
+        /**
+         * Deliberately long, so that a regression which only asks for the code once auto retrieval
+         * has timed out is clearly distinguishable from one which asks as soon as it is sent.
+         */
+        const val AUTO_RETRIEVAL_TIMEOUT_SECONDS = 120L
+    }
+
+    private lateinit var auth: FirebaseAuth
+    private lateinit var scenario: ActivityScenario<Activity>
+    private lateinit var activity: Activity
+
+    @BeforeTest
+    fun initializeFirebase() {
+        val app = Firebase.apps(context).firstOrNull() ?: Firebase.initialize(
+            context,
+            FirebaseOptions(
+                applicationId = "1:846484016111:ios:dd1f6688bad7af768c841a",
+                apiKey = "AIzaSyCK87dcMFhzCz_kJVs2cT2AVlqOTLuyWV0",
+                databaseUrl = "https://fir-kotlin-sdk.firebaseio.com",
+                storageBucket = "fir-kotlin-sdk.appspot.com",
+                projectId = PROJECT_ID,
+                gcmSenderId = "846484016111",
+            ),
+        )
+
+        auth = Firebase.auth(app).apply {
+            useEmulator(emulatorHost, AUTH_EMULATOR_PORT)
+            // there is no play services attestation on a test device, so skip app verification
+            android.firebaseAuthSettings.setAppVerificationDisabledForTesting(true)
+        }
+
+        scenario = ActivityScenario.launch(Activity::class.java)
+        scenario.onActivity { activity = it }
+    }
+
+    @AfterTest
+    fun deinitializeFirebase() = runBlockingTest {
+        scenario.close()
+        Firebase.apps(context).forEach {
+            it.delete()
+        }
+    }
+
+    @Test
+    fun testVerificationCodeIsRequestedAsSoonAsTheCodeIsSent() = runTest {
+        val phoneNumber = randomPhoneNumber()
+        val verificationProvider = TestPhoneVerificationProvider(phoneNumber)
+
+        val startedAt = TimeSource.Monotonic.markNow()
+        val credential = PhoneAuthProvider(auth).verifyPhoneNumber(phoneNumber, verificationProvider)
+        val elapsed = startedAt.elapsedNow()
+
+        assertNotNull(credential)
+        assertEquals(1, verificationProvider.codesSent)
+        // the code used to only be requested from onCodeAutoRetrievalTimeOut, which blocked the
+        // caller for the full auto retrieval timeout before the user could enter anything
+        assertTrue(
+            elapsed < (AUTO_RETRIEVAL_TIMEOUT_SECONDS / 4).seconds,
+            "expected the code to be requested as soon as it was sent, but verification took $elapsed",
+        )
+    }
+
+    @Test
+    fun testCodeIsSubmittedAgainstTheVerificationIdOfTheMostRecentResend() = runTest {
+        val phoneNumber = randomPhoneNumber()
+        val verificationProvider = TestPhoneVerificationProvider(phoneNumber, resendOnFirstCode = true)
+
+        val credential = PhoneAuthProvider(auth).verifyPhoneNumber(phoneNumber, verificationProvider)
+
+        assertEquals(2, verificationProvider.codesSent)
+        // resending issues a new verification id and invalidates the previous one, so signing in
+        // only succeeds if the code was paired with the newer of the two
+        val result = auth.signInWithCredential(credential)
+        try {
+            assertNotNull(result.user)
+        } finally {
+            result.user?.delete()
+        }
+    }
+
+   
```

**File**: `firebase-auth/src/androidMain/kotlin/dev/gitlive/firebase/auth/credentials.kt` (modified, +34/-18)
```diff
@@ -10,8 +10,12 @@ import com.google.firebase.auth.OAuthProvider as AndroidOAuthProvider
 import com.google.firebase.auth.PhoneAuthOptions
 import com.google.firebase.auth.PhoneAuthProvider
 import kotlinx.coroutines.CompletableDeferred
-import kotlinx.coroutines.coroutineScope
-import kotlinx.coroutines.launch
+import kotlinx.coroutines.async
+import kotlinx.coroutines.flow.MutableStateFlow
+import kotlinx.coroutines.flow.filterNotNull
+import kotlinx.coroutines.flow.first
+import kotlinx.coroutines.selects.select
+import kotlinx.coroutines.supervisorScope
 import java.util.concurrent.TimeUnit
 
 public actual open class AuthCredential(public open val android: com.google.firebase.auth.AuthCredential) {
@@ -86,12 +90,17 @@ public actual class PhoneAuthProvider(public val createOptionsBuilder: () -> Pho
 
     public actual fun credential(verificationId: String, smsCode: String): PhoneAuthCredential = PhoneAuthCredential(PhoneAuthProvider.getCredential(verificationId, smsCode))
 
-    public actual suspend fun verifyPhoneNumber(phoneNumber: String, verificationProvider: PhoneVerificationProvider): AuthCredential = coroutineScope {
-        val response = CompletableDeferred<Result<AuthCredential>>()
+    // unlike the other platforms android can complete the verification without any user input, via
+    // sms auto retrieval, so the credential is whichever of the two arrives first
+    public actual suspend fun verifyPhoneNumber(phoneNumber: String, verificationProvider: PhoneVerificationProvider): AuthCredential = supervisorScope {
+        // resending replaces the verification id and invalidates the previous one
+        val latestVerificationId = MutableStateFlow<String?>(null)
+        val autoRetrieved = CompletableDeferred<AuthCredential>()
         val callback = object :
             PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
 
             override fun onCodeSent(verificationId: String, forceResending: PhoneAuthProvider.ForceResendingToken) {
+                latestVerificationId.value = verificationId
                 verificationProvider.codeSent {
                     val options = createOptionsBuilder()
                         .setPhoneNumber(phoneNumber)
@@ -104,23 +113,12 @@ public actual class PhoneAuthProvider(public val createOptionsBuilder: () -> Pho
                 }
             }
 
-            override fun onCodeAutoRetrievalTimeOut(verificationId: String) {
-                launch {
-                    val code = verificationProvider.getVerificationCode()
-                    try {
-                        response.complete(Result.success(credential(verificationId, code)))
-                    } catch (e: Exception) {
-                        response.complete(Result.failure(e))
-                    }
-                }
-            }
-
             override fun onVerificationCompleted(credential: com.google.firebase.auth.PhoneAuthCredential) {
-                response.complete(Result.success(AuthCredential(credential)))
+                autoRetrieved.complete(AuthCredential(credential))
             }
 
             override fun onVerificationFailed(error: FirebaseException) {
-                response.complete(Result.failure(error))
+                autoRetrieved.completeExceptionally(error)
             }
         }
         val options = createOptionsBuilder()
@@ -131,7 +129,25 @@ public actual class PhoneAuthProvider(public val createOptionsBuilder: () -> Pho
             .build()
         PhoneAuthProvider.verifyPhoneNumber(options)
 
-        response.await().getOrThrow()
+        val userEntered = async {
+            // prompt as soon as a code has been sent rather than waiting for auto retrieval to time
+            // out, as recommended by
+            // https://firebase.google.com/docs/auth/android/phone-auth#oncodeautoretrievaltimeoutstring-verificationid
+            latestVerificationId.filterNotNull().first()
+            val code = verificationProvider.getVerificationCode()
+            credential(checkNotNull(latestVerificationId.value), code)
+        }
+
+        try {
+            select {
+                autoRetrieved.onAwait { it }
+                userEntered.onAwait { it }
+            }
+        } finally {
+            // select does not cancel the losing clause, and a code entry still waiting on the user
+            // would otherwise keep this scope alive after auto retrieval has already completed
+            userEntered.cancel()
+        }
     }
 }
 
```

---

### Incident Patch 9: `2ec78da9` (2026-08-04)
**Commit Message**: fix CI api dump step for pull requests from forks

The lintAndApiChecks job runs formatKotlin and the apiDump tasks, then
pushes the result back with git-auto-commit-action. That action defaults
its branch input to github.head_ref, which for a fork PR names a branch
in the contributor's fork rather than this repo, so the step aborted with
"fatal: invalid reference: <branch>" and exit 128. Fork PRs also run with
a read-only GITHUB_TOKEN under the pull_request trigger, so the push
could not have succeeded regardless.

The job therefore failed on every external contribution while passing for
same-repo branches such as dependabot's.

Keep the auto-commit for same-repo PRs and, for forks, verify the working
tree is clean after the same format and dump steps, failing with the exact
gradle commands to run locally. The check uses git status --porcelain to
match what the action would have staged, so newly added API files count
too.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/pull_request_target.yml` (modified, +25/-0)
```diff
@@ -66,8 +66,33 @@ jobs:
           done
 
           echo "Running API dump tasks:$api_dump_tasks"
+          echo "API_DUMP_TASKS=$api_dump_tasks" >> "$GITHUB_ENV"
           ./gradlew $api_dump_tasks
 
       - run: git status
 
+      # Fork PRs run with a read-only GITHUB_TOKEN, and their head branch does not
+      # exist in this repo, so the auto-commit below cannot work. Verify instead and
+      # tell the contributor what to run locally.
+      - name: Verify formatting and API files are up to date
+        if: github.event.pull_request.head.repo.full_name != github.repository
+        run: |
+          # Match what git-auto-commit-action would have staged (file_pattern
+          # defaults to "."), so tracked edits and new API files both count.
+          if [ -n "$(git status --porcelain)" ]; then
+            echo "::error::Formatting or API dump files are out of date."
+            echo "This PR comes from a fork, so CI cannot update them for you."
+            echo "Run the following locally and commit the result:"
+            echo "  ./gradlew formatKotlin"
+            echo "  ./gradlew$API_DUMP_TASKS"
+            echo ""
+            echo "Files that differ:"
+            git status --porcelain
+            exit 1
+          fi
+          echo "Formatting and API files are up to date."
+
       - uses: stefanzweifel/git-auto-commit-action@v7
+        if: github.event.pull_request.head.repo.full_name == github.repository
+        with:
+          branch: ${{ github.head_ref }}
```

---

### Incident Patch 10: `3413373b` (2026-08-03)
**Commit Message**: add performance trace attribute tests

**File**: `firebase-perf/src/commonTest/kotlin/dev/gitlive/firebase/perf/metrics/Trace.kt` (modified, +24/-0)
```diff
@@ -79,4 +79,28 @@ class TraceTest {
         assertEquals(1L, trace.getLongMetric("Get Put Metric Test"))
         trace.stop()
     }
+
+    @Test
+    fun testAttributes() = runTest {
+        val trace = performance.newTrace("testAttributes")
+        trace.start()
+
+        trace.putAttribute("first_attribute", "first_value")
+        trace.putAttribute("second_attribute", "second_value")
+
+        assertEquals("first_value", trace.getAttribute("first_attribute"))
+        assertEquals(
+            mapOf(
+                "first_attribute" to "first_value",
+                "second_attribute" to "second_value",
+            ),
+            trace.getAttributes(),
+        )
+
+        trace.removeAttribute("first_attribute")
+
+        assertEquals(null, trace.getAttribute("first_attribute"))
+        assertEquals(mapOf("second_attribute" to "second_value"), trace.getAttributes())
+        trace.stop()
+    }
 }
```

---

### Incident Patch 11: `85dcde35` (2026-08-03)
**Commit Message**: add common performance trace attribute APIs

**File**: `firebase-perf/api/jvm/firebase-perf.api` (modified, +4/-0)
```diff
@@ -15,9 +15,13 @@ public final class dev/gitlive/firebase/perf/Performance_jvmKt {
 
 public final class dev/gitlive/firebase/perf/metrics/Trace {
 	public fun <init> ()V
+	public final fun getAttribute (Ljava/lang/String;)Ljava/lang/String;
+	public final fun getAttributes ()Ljava/util/Map;
 	public final fun getLongMetric (Ljava/lang/String;)J
 	public final fun incrementMetric (Ljava/lang/String;J)V
+	public final fun putAttribute (Ljava/lang/String;Ljava/lang/String;)V
 	public final fun putMetric (Ljava/lang/String;J)V
+	public final fun removeAttribute (Ljava/lang/String;)V
 	public final fun start ()V
 	public final fun stop ()V
 }
```

**File**: `firebase-perf/src/androidMain/kotlin/dev/gitlive/firebase/perf/metrics/Trace.kt` (modified, +4/-4)
```diff
@@ -25,15 +25,15 @@ public actual class Trace internal constructor(internal val android: AndroidTrac
         android.putMetric(metricName, value)
     }
 
-    public fun getAttributes(): Map<String, String> = android.attributes
+    public actual fun getAttributes(): Map<String, String> = android.attributes
 
-    public fun getAttribute(attribute: String): String? = android.getAttribute(attribute)
+    public actual fun getAttribute(attribute: String): String? = android.getAttribute(attribute)
 
-    public fun putAttribute(attribute: String, value: String) {
+    public actual fun putAttribute(attribute: String, value: String) {
         android.putAttribute(attribute, value)
     }
 
-    public fun removeAttribute(attribute: String) {
+    public actual fun removeAttribute(attribute: String) {
         android.removeAttribute(attribute)
     }
 
```

**File**: `firebase-perf/src/appleMain/kotlin/dev/gitlive/firebase/perf/metrics/Trace.kt` (modified, +15/-0)
```diff
@@ -14,13 +14,28 @@ public actual class Trace internal constructor(internal val ios: FIRTrace?) {
         ios?.stop()
     }
 
+    public actual fun getAttribute(attribute: String): String? = ios?.valueForAttribute(attribute)
+
+    public actual fun getAttributes(): Map<String, String> = ios?.attributes
+        ?.mapKeys { it.key.toString() }
+        ?.mapValues { it.value.toString() }
+        .orEmpty()
+
     public actual fun getLongMetric(metricName: String): Long = ios?.valueForIntMetric(metricName) ?: 0L
 
     public actual fun incrementMetric(metricName: String, incrementBy: Long) {
         ios?.incrementMetric(metricName, incrementBy)
     }
 
+    public actual fun putAttribute(attribute: String, value: String) {
+        ios?.setValue(value, attribute)
+    }
+
     public actual fun putMetric(metricName: String, value: Long) {
         ios?.setIntValue(value, metricName)
     }
+
+    public actual fun removeAttribute(attribute: String) {
+        ios?.removeAttribute(attribute)
+    }
 }
```

**File**: `firebase-perf/src/commonMain/kotlin/dev/gitlive/firebase/perf/metrics/Trace.kt` (modified, +12/-0)
```diff
@@ -8,6 +8,12 @@ public expect class Trace {
     /** Stops this trace. */
     public fun stop()
 
+    /** Returns the value of the custom attribute with the given [attribute] name. */
+    public fun getAttribute(attribute: String): String?
+
+    /** Returns all custom attributes associated with this trace. */
+    public fun getAttributes(): Map<String, String>
+
     /**
      * Gets the value of the metric with the given name in the current trace. If a metric with the
      * given name doesn't exist, it is NOT created and a 0 is returned. This method is atomic.
@@ -29,6 +35,9 @@ public expect class Trace {
      */
     public fun incrementMetric(metricName: String, incrementBy: Long)
 
+    /** Sets a custom [attribute] to the given [value] on this trace. */
+    public fun putAttribute(attribute: String, value: String)
+
     /**
      * Sets the value of the metric with the given name in this trace to the value provided. If a
      * metric with the given name doesn't exist, a new one will be created. If the trace has not been
@@ -40,4 +49,7 @@ public expect class Trace {
      * @param value The value to which the metric should be set to.
      */
     public fun putMetric(metricName: String, value: Long)
+
+    /** Removes the custom attribute with the given [attribute] name from this trace. */
+    public fun removeAttribute(attribute: String)
 }
```

**File**: `firebase-perf/src/jsMain/kotlin/dev/gitlive/firebase/perf/externals/performance.kt` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 package dev.gitlive.firebase.perf.externals
 
 import dev.gitlive.firebase.externals.FirebaseApp
+import kotlin.js.Json
 
 public external fun getPerformance(app: FirebaseApp? = definedExternally): FirebasePerformance
 
@@ -16,7 +17,7 @@ public external interface FirebasePerformance {
 
 public external interface PerformanceTrace {
     public fun getAttribute(attr: String): String?
-    public fun getAttributes(): Map<String, String>
+    public fun getAttributes(): Json
     public fun getMetric(metricName: String): Int
     public fun incrementMetric(metricName: String, num: Int? = definedExternally)
     public fun putAttribute(attr: String, value: String)
```

**File**: `firebase-perf/src/jsMain/kotlin/dev/gitlive/firebase/perf/metrics/Trace.kt` (modified, +8/-3)
```diff
@@ -2,6 +2,7 @@ package dev.gitlive.firebase.perf.metrics
 
 import dev.gitlive.firebase.perf.externals.PerformanceTrace
 import dev.gitlive.firebase.perf.rethrow
+import kotlin.js.Json
 
 public val Trace.js: PerformanceTrace get() = js
 
@@ -12,7 +13,11 @@ public actual class Trace internal constructor(internal val js: PerformanceTrace
     public actual fun getLongMetric(metricName: String): Long = rethrow { js.getMetric(metricName).toLong() }
     public actual fun incrementMetric(metricName: String, incrementBy: Long): Unit = rethrow { js.incrementMetric(metricName, incrementBy.toInt()) }
     public actual fun putMetric(metricName: String, value: Long): Unit = rethrow { js.putMetric(metricName, value.toInt()) }
-    public fun getAttribute(attribute: String): String? = rethrow { js.getAttribute(attribute) }
-    public fun putAttribute(attribute: String, value: String): Unit = rethrow { js.putAttribute(attribute, value) }
-    public fun removeAttribute(attribute: String): Unit = rethrow { js.removeAttribute(attribute) }
+    public actual fun getAttribute(attribute: String): String? = rethrow { js.getAttribute(attribute) }
+    public actual fun getAttributes(): Map<String, String> = rethrow {
+        val entries = js("Object.entries") as (Json) -> Array<Array<String>>
+        entries(js.getAttributes()).associate { entry -> entry[0] to entry[1] }
+    }
+    public actual fun putAttribute(attribute: String, value: String): Unit = rethrow { js.putAttribute(attribute, value) }
+    public actual fun removeAttribute(attribute: String): Unit = rethrow { js.removeAttribute(attribute) }
 }
```

**File**: `firebase-perf/src/jvmMain/kotlin/dev/gitlive/firebase/perf/metrics/Trace.jvm.kt` (modified, +14/-0)
```diff
@@ -7,13 +7,27 @@ public actual class Trace {
     public actual fun stop() {
     }
 
+    public actual fun getAttribute(attribute: String): String? {
+        TODO("Not yet implemented")
+    }
+
+    public actual fun getAttributes(): Map<String, String> {
+        TODO("Not yet implemented")
+    }
+
     public actual fun getLongMetric(metricName: String): Long {
         TODO("Not yet implemented")
     }
 
     public actual fun incrementMetric(metricName: String, incrementBy: Long) {
     }
 
+    public actual fun putAttribute(attribute: String, value: String) {
+    }
+
     public actual fun putMetric(metricName: String, value: Long) {
     }
+
+    public actual fun removeAttribute(attribute: String) {
+    }
 }
```

---

### Incident Patch 12: `ef0c9f08` (2026-08-03)
**Commit Message**: add analytics regression and builder tests

**File**: `firebase-analytics/src/commonTest/kotlin/dev/gitlive/firebase/analytics/analytics.kt` (modified, +49/-0)
```diff
@@ -12,6 +12,7 @@ import dev.gitlive.firebase.runBlockingTest
 import kotlin.test.AfterTest
 import kotlin.test.BeforeTest
 import kotlin.test.Test
+import kotlin.test.assertEquals
 import kotlin.test.assertNotNull
 
 expect val context: Any
@@ -56,3 +57,51 @@ class FirebaseAnalyticsTest {
         }
     }
 }
+
+class FirebaseAnalyticsParametersTest {
+
+    @Test
+    fun storesSupportedParameterTypes() {
+        val parameters = FirebaseAnalyticsParameters().apply {
+            param("string", "value")
+            param("double", 1.5)
+            param("long", 2L)
+            param("int", 3)
+            param("boolean", true)
+        }
+
+        assertEquals(
+            mapOf<String, Any>(
+                "string" to "value",
+                "double" to 1.5,
+                "long" to 2L,
+                "int" to 3,
+                "boolean" to true,
+            ),
+            parameters.parameters,
+        )
+    }
+}
+
+class FirebaseAnalyticsConsentBuilderTest {
+
+    @Test
+    fun storesSupportedConsentSettings() {
+        val builder = FirebaseAnalyticsConsentBuilder().apply {
+            adPersonalization = FirebaseAnalytics.ConsentStatus.GRANTED
+            adStorage = FirebaseAnalytics.ConsentStatus.DENIED
+            adUserData = FirebaseAnalytics.ConsentStatus.GRANTED
+            analyticsStorage = FirebaseAnalytics.ConsentStatus.DENIED
+        }
+
+        assertEquals(
+            mapOf(
+                FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to FirebaseAnalytics.ConsentStatus.GRANTED,
+                FirebaseAnalytics.ConsentType.AD_STORAGE to FirebaseAnalytics.ConsentStatus.DENIED,
+                FirebaseAnalytics.ConsentType.AD_USER_DATA to FirebaseAnalytics.ConsentStatus.GRANTED,
+                FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to FirebaseAnalytics.ConsentStatus.DENIED,
+            ),
+            builder.consentSettings,
+        )
+    }
+}
```

**File**: `firebase-analytics/src/jsTest/kotlin/dev/gitlive/firebase/analytics/analytics.kt` (modified, +43/-0)
```diff
@@ -1,6 +1,49 @@
 package dev.gitlive.firebase.analytics
 
+import dev.gitlive.firebase.Firebase
+import dev.gitlive.firebase.FirebaseOptions
+import dev.gitlive.firebase.apps
+import dev.gitlive.firebase.initialize
+import dev.gitlive.firebase.runBlockingTest
+import kotlin.test.AfterTest
+import kotlin.test.BeforeTest
+import kotlin.test.Test
+
 actual val context: Any = Unit
 
 @Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
 actual annotation class IgnoreForAndroidUnitTest
+
+class FirebaseAnalyticsJsTest {
+
+    private lateinit var analytics: FirebaseAnalytics
+
+    @BeforeTest
+    fun initializeFirebase() {
+        val app = Firebase.apps(context).firstOrNull() ?: Firebase.initialize(
+            context,
+            FirebaseOptions(
+                applicationId = "1:846484016111:ios:dd1f6688bad7af768c841a",
+                apiKey = "AIzaSyCK87dcMFhzCz_kJVs2cT2AVlqOTLuyWV0",
+                databaseUrl = "https://fir-kotlin-sdk.firebaseio.com",
+                storageBucket = "fir-kotlin-sdk.appspot.com",
+                projectId = "fir-kotlin-sdk",
+                gcmSenderId = "846484016111",
+            ),
+        )
+
+        analytics = Firebase.analytics(app)
+    }
+
+    @AfterTest
+    fun deinitializeFirebase() = runBlockingTest {
+        Firebase.apps(context).forEach {
+            it.delete()
+        }
+    }
+
+    @Test
+    fun setUserPropertyShouldNotCrash() {
+        analytics.setUserProperty("test_property", "test_value")
+    }
+}
```

---

### Incident Patch 13: `7c28fa8a` (2026-08-03)
**Commit Message**: fix JS analytics user property binding

**File**: `firebase-analytics/src/jsMain/kotlin/dev/gitlive/firebase/analytics/analytics.kt` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ public actual class FirebaseAnalytics(internal val js: dev.gitlive.firebase.anal
     }
 
     public actual fun setUserProperty(name: String, value: String) {
-        dev.gitlive.firebase.analytics.externals.setUserProperty(js, name, value)
+        dev.gitlive.firebase.analytics.externals.setUserProperties(js, json(name to value))
     }
 
     public actual fun setUserId(id: String?) {
```

**File**: `firebase-analytics/src/jsMain/kotlin/dev/gitlive/firebase/analytics/externals/analytics.kt` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import kotlin.js.Json
 public external fun getAnalytics(app: FirebaseApp? = definedExternally): FirebaseAnalytics
 
 public external fun logEvent(app: FirebaseAnalytics, name: String, parameters: Json?)
-public external fun setUserProperty(app: FirebaseAnalytics, name: String, value: String)
+public external fun setUserProperties(app: FirebaseAnalytics, properties: Json)
 public external fun setUserId(app: FirebaseAnalytics, id: String?)
 public external fun resetAnalyticsData(app: FirebaseAnalytics)
 public external fun setDefaultEventParameters(app: FirebaseAnalytics, parameters: Map<String, String>)
```

---

### Incident Patch 14: `935c46c5` (2026-07-15)
**Commit Message**: Fix/expose Firebase Auth error codes and map password errors (#823)

* expose firebase auth error codes across platforms

* map apple wrong password auth errors to invalid credentials

* update firebase auth api snapshots

* map js wrong password auth errors to invalid credentials

---------

Co-authored-by: Nicholas Bransby-Williams <[REDACTED_EMAIL]>

**File**: `firebase-auth/api/android/firebase-auth.api` (modified, +1/-0)
```diff
@@ -296,5 +296,6 @@ public final class dev/gitlive/firebase/auth/android {
 	public static final fun getAndroid (Ldev/gitlive/firebase/auth/AuthTokenResult;)Lcom/google/firebase/auth/GetTokenResult;
 	public static final fun getAndroid (Ldev/gitlive/firebase/auth/FirebaseAuth;)Lcom/google/firebase/auth/FirebaseAuth;
 	public static final fun getAuth (Ldev/gitlive/firebase/Firebase;)Ldev/gitlive/firebase/auth/FirebaseAuth;
+	public static final fun getCode (Lcom/google/firebase/auth/FirebaseAuthException;)Ljava/lang/String;
 }
 
```

**File**: `firebase-auth/api/jvm/firebase-auth.api` (modified, +1/-0)
```diff
@@ -294,5 +294,6 @@ public final class dev/gitlive/firebase/auth/android {
 	public static final fun getAndroid (Ldev/gitlive/firebase/auth/AuthResult;)Lcom/google/firebase/auth/AuthResult;
 	public static final fun getAndroid (Ldev/gitlive/firebase/auth/AuthTokenResult;)Lcom/google/firebase/auth/GetTokenResult;
 	public static final fun getAuth (Ldev/gitlive/firebase/Firebase;)Ldev/gitlive/firebase/auth/FirebaseAuth;
+	public static final fun getCode (Lcom/google/firebase/auth/FirebaseAuthException;)Ljava/lang/String;
 }
 
```

**File**: `firebase-auth/src/androidMain/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ internal fun ActionCodeSettings.toAndroid() = com.google.firebase.auth.ActionCod
     .build()
 
 public actual typealias FirebaseAuthException = com.google.firebase.auth.FirebaseAuthException
+public actual val FirebaseAuthException.code: String? get() = errorCode
 public actual typealias FirebaseAuthActionCodeException = com.google.firebase.auth.FirebaseAuthActionCodeException
 public actual typealias FirebaseAuthEmailException = com.google.firebase.auth.FirebaseAuthEmailException
 public actual typealias FirebaseAuthInvalidCredentialsException = com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
```

**File**: `firebase-auth/src/appleMain/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +22/-20)
```diff
@@ -160,16 +160,17 @@ internal fun ActionCodeSettings.toIos() = FIRActionCodeSettings().also {
     iOSBundleId?.run { it.setIOSBundleID(this) }
 }
 
-public actual open class FirebaseAuthException(message: String) : FirebaseException(message)
-public actual open class FirebaseAuthActionCodeException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthEmailException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthInvalidCredentialsException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthWeakPasswordException(message: String) : FirebaseAuthInvalidCredentialsException(message)
-public actual open class FirebaseAuthInvalidUserException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthMultiFactorException(message: String, public val resolver: FIRMultiFactorResolver?) : FirebaseAuthException(message)
-public actual open class FirebaseAuthRecentLoginRequiredException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthUserCollisionException(message: String) : FirebaseAuthException(message)
-public actual open class FirebaseAuthWebException(message: String) : FirebaseAuthException(message)
+public actual open class FirebaseAuthException(message: String, internal val authCode: String? = null) : FirebaseException(message)
+public actual val FirebaseAuthException.code: String? get() = authCode
+public actual open class FirebaseAuthActionCodeException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthEmailException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthInvalidCredentialsException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthWeakPasswordException(message: String, code: String? = null) : FirebaseAuthInvalidCredentialsException(message, code)
+public actual open class FirebaseAuthInvalidUserException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthMultiFactorException(message: String, public val resolver: FIRMultiFactorResolver?, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthRecentLoginRequiredException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthUserCollisionException(message: String, code: String? = null) : FirebaseAuthException(message, code)
+public actual open class FirebaseAuthWebException(message: String, code: String? = null) : FirebaseAuthException(message, code)
 
 internal fun <T, R> T.throwError(block: T.(errorPointer: CPointer<ObjCObjectVar<NSError?>>) -> R): R {
     memScoped {
@@ -214,10 +215,10 @@ private fun NSError.toException() = when (domain) {
     FIRAuthErrorDomain -> when (code) {
         17030L, // AuthErrorCode.invalidActionCode
         17029L, // AuthErrorCode.expiredActionCode
-        -> FirebaseAuthActionCodeException(toString())
+        -> FirebaseAuthActionCodeException(toString(), code.toString())
 
         17008L, // AuthErrorCode.invalidEmail
-        -> FirebaseAuthEmailException(toString())
+        -> FirebaseAuthEmailException(toString(), code.toString())
 
         17056L, // AuthErrorCode.captchaCheckFailed
         17042L, // AuthErrorCode.invalidPhoneNumber
@@ -228,24 +229,25 @@ private fun NSError.toException() = when (domain) {
         17043L, // AuthErrorCode.missingVerificationCode
         17021L, // AuthErrorCode.userTokenExpired
         17004L, // AuthErrorCode.invalidCredential
-        -> FirebaseAuthInvalidCredentialsException(toString())
+        17009L, // AuthErrorCode.wrongPassword
+        -> FirebaseAuthInvalidCredentialsException(toString(), code.toString())
 
         17026L, // AuthErrorCode.weakPassword
-        -> FirebaseAuthWeakPasswordException(toString())
+        -> FirebaseAuthWeakPasswordException(toString(), code.toString())
 
         17017L, // AuthErrorCode.invalidUserToken
-        -> FirebaseAuthInvalidUserException(toString())
+        -> FirebaseAuthInvalidUserException(toString(), code.toString())
 
         17014L, // AuthErrorCode.requiresRecentLogin
-        -> FirebaseAuthRecentLoginRequiredException(toString())
+        -> FirebaseAuthRecentLoginRequiredException(toString(), code.toString())
 
         17087L, // AuthErrorCode.secondFactorAlreadyEnrolled
         17078L, // AuthErrorCode.secondFactorRequired
         17088L, // AuthErrorCode.maximumSecondFactorCountExceeded
         17084L, // AuthErrorCode.multiFactorInfoNotFound
         -> {
             val resolver = userInfo["FIRAuthErrorUserInfoMultiFactorResolverKey"] as? FIRMultiFactorResolver
-            FirebaseAuthMultiFactorException(toString(), resolver)
+            FirebaseAu
```

**File**: `firebase-auth/src/commonMain/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +3/-0)
```diff
@@ -87,6 +87,9 @@ public data class AndroidPackageName(
 )
 
 public expect open class FirebaseAuthException : FirebaseException
+
+/** Platform Firebase Auth error code, when the underlying SDK provides one. */
+public expect val FirebaseAuthException.code: String?
 public expect class FirebaseAuthActionCodeException : FirebaseAuthException
 public expect class FirebaseAuthEmailException : FirebaseAuthException
 public expect open class FirebaseAuthInvalidCredentialsException : FirebaseAuthException
```

**File**: `firebase-auth/src/commonTest/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +16/-0)
```diff
@@ -55,6 +55,22 @@ class FirebaseAuthTest {
         assertEquals(uid, result.user!!.uid)
     }
 
+    @Test
+    fun testSignInWithWrongPasswordThrowsInvalidCredentialsWithCode() = runTest {
+        val email = "test+${Random.nextInt(100000)}@test.com"
+        auth.createUserWithEmailAndPassword(email, "test123")
+        try {
+            auth.signOut()
+
+            val exception = assertFailsWith<FirebaseAuthInvalidCredentialsException> {
+                auth.signInWithEmailAndPassword(email, "wrong-password")
+            }
+            assertNotNull(exception.code)
+        } finally {
+            auth.signInWithEmailAndPassword(email, "test123").user!!.delete()
+        }
+    }
+
     @Test
     fun testCreateUserWithEmailAndPassword() = runTest {
         val email = "test+${Random.nextInt(100000)}@test.com"
```

**File**: `firebase-auth/src/jsMain/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +3/-1)
```diff
@@ -183,7 +183,8 @@ internal fun ActionCodeSettings.toJson() = json(
     "ios" to (iOSBundleId?.run { json("bundleId" to iOSBundleId) } ?: undefined),
 )
 
-public actual open class FirebaseAuthException(code: String?, cause: Throwable) : FirebaseException(code, cause)
+public actual open class FirebaseAuthException(internal val authCode: String?, cause: Throwable) : FirebaseException(authCode, cause)
+public actual val FirebaseAuthException.code: String? get() = authCode
 public actual open class FirebaseAuthActionCodeException(code: String?, cause: Throwable) : FirebaseAuthException(code, cause)
 public actual open class FirebaseAuthEmailException(code: String?, cause: Throwable) : FirebaseAuthException(code, cause)
 public actual open class FirebaseAuthInvalidCredentialsException(code: String?, cause: Throwable) : FirebaseAuthException(code, cause)
@@ -220,6 +221,7 @@ private fun errorToException(cause: dynamic) = when (val code = cause.code?.toSt
     "auth/missing-verification-code",
     "auth/invalid-verification-id",
     "auth/missing-verification-id",
+    "auth/wrong-password",
     -> FirebaseAuthInvalidCredentialsException(code, cause.unsafeCast<Throwable>())
     "auth/maximum-second-factor-count-exceeded",
     "auth/second-factor-already-in-use",
```

**File**: `firebase-auth/src/jvmMain/kotlin/dev/gitlive/firebase/auth/auth.kt` (modified, +1/-0)
```diff
@@ -168,6 +168,7 @@ internal fun ActionCodeSettings.toAndroid() = com.google.firebase.auth.ActionCod
     .build()
 
 public actual typealias FirebaseAuthException = com.google.firebase.auth.FirebaseAuthException
+public actual val FirebaseAuthException.code: String? get() = errorCode
 public actual typealias FirebaseAuthActionCodeException = com.google.firebase.auth.FirebaseAuthActionCodeException
 public actual typealias FirebaseAuthEmailException = com.google.firebase.auth.FirebaseAuthEmailException
 public actual typealias FirebaseAuthInvalidCredentialsException = com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
```

---

### Incident Patch 15: `1a4c61a1` (2026-07-15)
**Commit Message**: Fix typo in iOS Firebase SDK documentation (#792)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -319,7 +319,7 @@ On android, some modules (`config`) require you to enable [Core library desugari
 
 ### Running on iOS
 
-On iOS the official [Firebase iOS SDK](https://github.com/firebase/firebase-ios-sdk) in not linked as a transitive dependency. Therefore, any project using this SDK needs to link the actual Firestore SDK as well. This can be done through your preferred installation method (Cocoapods/SPM).
+On iOS the official [Firebase iOS SDK](https://github.com/firebase/firebase-ios-sdk) is not linked as a transitive dependency. Therefore, any project using this SDK needs to link the actual Firestore SDK as well. This can be done through your preferred installation method (Cocoapods/SPM).
 
 Similarly, tests require linking as well. Make sure to add the required frameworks to the search path of your test targets. This can be done by specifying a `cocoapods` block in your `build.gradle`:
 ```kotlin
```

#### Recent Merged Pull Requests:
- **PR #910** (2026-09-25): Pin CI to Xcode 26.4.1 (@nbransby)
- **PR #909** (2026-09-25): Skip the Firebase SwiftPM resolve in modules that don't use Firebase (@nbransby)
- **PR #908** (2026-09-25): Upload SwiftPM import diagnostics when an Apple test job fails (@nbransby)
- **PR #907** (2026-09-25): Correct the SwiftPM consumer docs (@nbransby)
- **PR #906** (2026-09-24): Merge master into v3.0.0 (@nbransby)
- **PR #905** (2026-09-24): Raise the macOS deployment target to 12.0 (@nbransby)
- **PR #904** (2026-09-24): Stop running firebase-installations tests on macOS (2.x) (@nbransby)
- **PR #903** (2026-09-24): Fix remoteConfig(app) ignoring its app on Apple (2.x) (@nbransby)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
