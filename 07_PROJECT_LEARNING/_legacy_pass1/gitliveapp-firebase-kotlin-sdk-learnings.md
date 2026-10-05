# Forensic Learning Record (Deep Inspection): GitLiveApp/firebase-kotlin-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/gitliveapp-firebase-kotlin-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/GitLiveApp/firebase-kotlin-sdk](https://github.com/GitLiveApp/firebase-kotlin-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:00:57.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `GitLiveApp/firebase-kotlin-sdk`
- **Description**: A Kotlin-first SDK for Firebase
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1733 stars

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
        cls = simple.rep
```

### Core Architecture Module: `firebase-auth/karma.config.d/karma.conf.js`
```
// Some tests are fluky in GitHub Actions, so we increase the timeout.
config.set({
    client: {
      mocha: {
        timeout: 180000
      }
    },
});

```

### Core Architecture Module: `firebase-database/karma.config.d/karma.conf.js`
```
// Some tests are fluky in GitHub Actions, so we increase the timeout.
config.set({
    client: {
      mocha: {
        timeout: 180000
      }
    },
});

```

### Core Architecture Module: `firebase-firestore/karma.config.d/karma.conf.js`
```
// Some tests are fluky in GitHub Actions, so we increase the timeout.
config.set({
    client: {
      mocha: {
        timeout: 1800000
      }
    },
});

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

Co-authored-by: anggrayudi.hardiannico <anggrayudi.hardiannico@gopay.co.id>

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

Co-authored-by: anggrayudi.hardiannico <anggrayudi.hardiannico@gopay.co.id>

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

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

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

Co-authored-by: Charles Etieve <charles.etieve@gmail.com>
Co-Authored-By: Claude Opus 

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
+            val code = verificationProvider.getVerificati
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

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

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
