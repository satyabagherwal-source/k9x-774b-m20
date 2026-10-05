# Forensic Learning Record (Deep Inspection): realm/realm-kotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/realm-realm-kotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/realm/realm-kotlin](https://github.com/realm/realm-kotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:24:18.618Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `realm/realm-kotlin`
- **Description**: Kotlin Multiplatform and Android SDK for the Realm Mobile Database: Build Better Apps Faster.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1103 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/kmm-sample/shared/src/commonMain/kotlin/io/realm/example/kmmsample/FlowUtils.kt`
```
/*
 * Copyright 2021 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.realm.example.kmmsample

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

// Credit - https://github.com/JetBrains/kotlinconf-app/blob/master/common/src/mobileMain/kotlin/org/jetbrains/kotlinconf/FlowUtils.kt
// Wrapper to consume Flow based API from Obj-C/Swift
// Alternatively we can use the 'Kotlinx_coroutines_coreFlowCollector' protocol from Swift as demonstrated in https://stackoverflow.com/a/66030092
// however the below wrapper gives us more control and hides the complexity in the shared Kotlin code.
class CFlow<T>(private val origin: Flow<T>) : Flow<T> by origin {
    fun watch(block: (T) -> Unit): Closeable {
        val job = Job()

        onEach {
            block(it)
        }.launchIn(CoroutineScope(Dispatchers.Main + job))

        return object : Closeable {
            override fun close() {
                job.cancel()
            }
        }
    }
}
// Helper extension
internal fun <T> Flow<T>.wrap(): CFlow<T> = CFlow(this)

// Remove when Kotlin's Closeable is supported in K/N https://youtrack.jetbrains.com/issue/KT-31066
// Alternatively use Ktor Closeable which is K/N ready.
interface Closeable {
    fun close()
}

```

### Core Architecture Module: `packages/cinterop/src/androidMain/kotlin/io/realm/kotlin/internal/AndroidUtils.kt`
```
package io.realm.kotlin.internal

import android.content.Context
import com.getkeepsafe.relinker.ReLinker

/**
 * Manually load the Android native libs. Must be called before any methods on RealmInterop is
 * called. This is done as part of the `RealmInitializer` class that is controlled by Jetpack
 * Startup library.
 *
 * On JVM and Native, this will happen automatically when first loading the RealmInterop class.
 */
@Suppress("MagicNumber")
fun loadAndroidNativeLibs(context: Context, version: String) {
    // Only use Relinker below API 23, since all bugs it fixes are only present there.
    // Also, see if this might fix https://github.com/realm/realm-kotlin/issues/1202
    if (android.os.Build.VERSION.SDK_INT < 23) {
        ReLinker.loadLibrary(context, "realmc", version)
    } else {
        System.loadLibrary("realmc")
    }
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/CoreError.kt`
```
package io.realm.kotlin.internal.interop

/**
 * Wrapper for C-API `realm_error_t`.
 * See https://github.com/realm/realm-core/blob/master/src/realm.h#L231
 */
class CoreError(
    categoriesNativeValue: Int,
    val errorCodeNativeValue: Int,
    messageNativeValue: String?,
) {
    val categories: CategoryFlags = CategoryFlags((categoriesNativeValue))
    val errorCode: ErrorCode? = ErrorCode.of(errorCodeNativeValue)
    val message = messageNativeValue

    operator fun contains(category: ErrorCategory): Boolean = category in categories
}

data class CategoryFlags(val categoryFlags: Int) {

    companion object {
        /**
         * See error code mapping to categories here:
         * https://github.com/realm/realm-core/blob/master/src/realm/error_codes.cpp#L29
         *
         * In most cases, only 1 category is assigned, but some errors have multiple. So instead of
         * overwhelming the user with many categories, we only select the most important to show
         * in the error message. "important" is of course tricky to define, but generally
         * we consider vague categories like [ErrorCategory.RLM_ERR_CAT_RUNTIME] as less important
         * than more specific ones like [ErrorCategory.RLM_ERR_CAT_JSON_ERROR].
         *
         * In the current implementation, categories between index 0 and 7 are considered equal
         * and the order is somewhat arbitrary. No error codes has multiple of these categories
         * associated either.
         */
        val CATEGORY_ORDER: List<ErrorCategory> = listOf(
            ErrorCategory.RLM_ERR_CAT_CUSTOM_ERROR,
            ErrorCategory.RLM_ERR_CAT_WEBSOCKET_ERROR,
            ErrorCategory.RLM_ERR_CAT_SYNC_ERROR,
            ErrorCategory.RLM_ERR_CAT_SERVICE_ERROR,
            ErrorCategory.RLM_ERR_CAT_JSON_ERROR,
            ErrorCategory.RLM_ERR_CAT_CLIENT_ERROR,
            ErrorCategory.RLM_ERR_CAT_SYSTEM_ERROR,
            ErrorCategory.RLM_ERR_CAT_FILE_ACCESS,
            ErrorCategory.RLM_ERR_CAT_HTTP_ERROR,
            ErrorCategory.RLM_ERR_CAT_INVALID_ARG,
            ErrorCategory.RLM_ERR_CAT_APP_ERROR,
            ErrorCategory.RLM_ERR_CAT_LOGIC,
            ErrorCategory.RLM_ERR_CAT_RUNTIME,
        )
    }

    /**
     * Returns a description of the most important category defined in [categoryFlags].
     * If no known categories are found, the integer values for all the categories is returned
     * as debugging information.
     */
    val description: String = CATEGORY_ORDER.firstOrNull { category ->
        this.contains(category)
    }?.description ?: "$categoryFlags"

    /**
     * Check whether a given [ErrorCategory] is included in the [categoryFlags].
     */
    operator fun contains(category: ErrorCategory): Boolean = (categoryFlags and category.nativeValue) != 0
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/CoreErrorConverter.kt`
```
/*
 * Copyright 2021 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop

import kotlin.jvm.JvmStatic

/**
 * Generic representation of a Realm-Core exception.
 */
object CoreErrorConverter {
    @JvmStatic
    @Suppress("UnusedPrivateMember")
    fun asThrowable(
        categoriesNativeValue: Int,
        errorCodeNativeValue: Int,
        messageNativeValue: String?,
        path: String?,
        userError: Throwable?
    ): Throwable {
        val categories: CategoryFlags = CategoryFlags(categoriesNativeValue)
        val errorCode: ErrorCode? = ErrorCode.of(errorCodeNativeValue)
        val message: String = "[$errorCode]: $messageNativeValue"

        return userError ?: when {
            ErrorCode.RLM_ERR_INDEX_OUT_OF_BOUNDS == errorCode ->
                IndexOutOfBoundsException(message)
            ErrorCategory.RLM_ERR_CAT_INVALID_ARG in categories && ErrorCategory.RLM_ERR_CAT_SYNC_ERROR !in categories -> {
                // Some sync errors flagged as both logical and illegal. In our case, we consider those
                // IllegalState, so discard them them here and let them fall through to the bottom case
                IllegalArgumentException(message)
            }
            ErrorCategory.RLM_ERR_CAT_LOGIC in categories || ErrorCategory.RLM_ERR_CAT_RUNTIME in categories ->
                IllegalStateException(message)
            else -> Error(message) // This can happen when propagating user level exceptions.
        }
    }
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/CoreLogLevel.kt`
```
/*
 * Copyright 2021 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop

expect enum class CoreLogLevel {
    RLM_LOG_LEVEL_ALL,
    RLM_LOG_LEVEL_TRACE,
    RLM_LOG_LEVEL_DEBUG,
    RLM_LOG_LEVEL_DETAIL,
    RLM_LOG_LEVEL_INFO,
    RLM_LOG_LEVEL_WARNING,
    RLM_LOG_LEVEL_ERROR,
    RLM_LOG_LEVEL_FATAL,
    RLM_LOG_LEVEL_OFF;

    // We need this property since it isn't allowed to have constructor params in an expect enum
    val priority: Int

    // TODO Use approach from https://github.com/realm/realm-kotlin/pull/522/files#diff-78c7e4d23c4a144e89ea26c34b8f97ff2111e39db5cdf0f9724deb79f5634194R32 once it gets merged
    companion object {
        fun valueFromPriority(priority: Short): CoreLogLevel
    }
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/sync/CoreCompensatingWriteInfo.kt`
```
/*
 * Copyright 2023 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.realm.kotlin.internal.interop.sync

import io.realm.kotlin.internal.interop.RealmValue

expect class CoreCompensatingWriteInfo {
    val reason: String
    val objectName: String
    val primaryKey: RealmValue
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/sync/CoreConnectionState.kt`
```
/*
 * Copyright 2023 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop.sync

expect enum class CoreConnectionState {
    RLM_SYNC_CONNECTION_STATE_DISCONNECTED,
    RLM_SYNC_CONNECTION_STATE_CONNECTING,
    RLM_SYNC_CONNECTION_STATE_CONNECTED;
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/sync/CoreSubscriptionSetState.kt`
```
/*
 * Copyright 2022 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop.sync

/**
 * Wrapper around C-API `realm_flx_sync_subscription_set_state`
 * See https://github.com/realm/realm-core/blob/master/src/realm.h#L3356
 */
expect enum class CoreSubscriptionSetState {
    RLM_SYNC_SUBSCRIPTION_UNCOMMITTED,
    RLM_SYNC_SUBSCRIPTION_PENDING,
    RLM_SYNC_SUBSCRIPTION_BOOTSTRAPPING,
    RLM_SYNC_SUBSCRIPTION_COMPLETE,
    RLM_SYNC_SUBSCRIPTION_ERROR,
    RLM_SYNC_SUBSCRIPTION_SUPERSEDED,
    RLM_SYNC_SUBSCRIPTION_AWAITING_MARK;
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/sync/CoreSyncSessionState.kt`
```
/*
 * Copyright 2022 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop.sync

/**
 * Wrapper around C-API `realm_sync_session_state`
 * See https://github.com/realm/realm-core/blob/master/src/realm.h#L3177
 */
expect enum class CoreSyncSessionState {
    RLM_SYNC_SESSION_STATE_DYING,
    RLM_SYNC_SESSION_STATE_ACTIVE,
    RLM_SYNC_SESSION_STATE_INACTIVE,
    RLM_SYNC_SESSION_STATE_WAITING_FOR_ACCESS_TOKEN,
    RLM_SYNC_SESSION_STATE_PAUSED;
}

```

### Core Architecture Module: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/sync/CoreUserState.kt`
```
/*
 * Copyright 2022 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package io.realm.kotlin.internal.interop.sync

/**
 * Wrapper for C-API `realm_user_state`.
 * See https://github.com/realm/realm-core/blob/master/src/realm.h#L2513
 */
expect enum class CoreUserState {
    RLM_USER_STATE_LOGGED_OUT,
    RLM_USER_STATE_LOGGED_IN,
    RLM_USER_STATE_REMOVED
}

```

### Core Architecture Module: `packages/cinterop/src/jvm/jni/env_utils.cpp`
```
/*
 * Copyright 2021 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "env_utils.h"
#include "java_class_global_def.hpp"
#include <stdexcept> // needed for Linux centos7 build

static JavaVM *cached_jvm = 0;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *jvm, void *reserved) {
    cached_jvm = jvm;
    realm::_impl::JavaClassGlobalDef::initialize(realm::jni_util::get_env());
    return JNI_VERSION_1_2;
}

namespace realm {
    namespace jni_util {
        JNIEnv * get_env(bool attach_if_needed, bool is_daemon_thread, realm::util::Optional<std::string> thread_name) {
            JNIEnv *env;
            jint rc = cached_jvm->GetEnv((void **)&env, JNI_VERSION_1_2);
            if (rc == JNI_EDETACHED) {
                if (attach_if_needed) {
                   #if defined(__ANDROID__)
                        JNIEnv **jenv = &env;
                    #else
                        void **jenv = (void **) &env;
                    #endif
                    JavaVMAttachArgs args;
                    args.version = JNI_VERSION_1_2;
                    args.group = nullptr;
                    if (thread_name.has_value()) {
                        args.name = (char*) thread_name.value().c_str();
                    } else {
                        args.name = nullptr;
                    }
                    jint ret;
                    if (is_daemon_thread) {
                        ret = cached_jvm->AttachCurrentThreadAsDaemon(jenv, &args);
                    } else {
                        ret = cached_jvm->AttachCurrentThread(jenv, &args);
                    }
                    if (ret != JNI_OK) throw std::runtime_error("Could not attach JVM on thread ");
                } else {
                    throw std::runtime_error("current thread not attached");
                }
            }
            if (rc == JNI_EVERSION)
                throw std::runtime_error("jni version not supported");

            return env;
        }

        void detach_current_thread() {
            cached_jvm->DetachCurrentThread();
        }

        JNIEnv * get_env_or_null() {
            JNIEnv *env;
            jint rc = cached_jvm->GetEnv((void **)&env, JNI_VERSION_1_2);
            if (rc == JNI_EDETACHED) {
                #if defined(__ANDROID__)
                    JNIEnv **jenv = &env;
                #else
                    void **jenv = (void **) &env;
                #endif
                cached_jvm->AttachCurrentThread(jenv, nullptr);
            }
            if (rc == JNI_EVERSION)
                throw std::runtime_error("jni version not supported");
            return env;
        }

        jmethodID lookup(JNIEnv *jenv, const char *class_name, const char *method_name,
                         const char *signature) {
            jclass localClass = jenv->FindClass(class_name);
            return jenv->GetMethodID(localClass, method_name, signature);
        }

        void keep_global_ref(JavaGlobalRefByMove& ref)
        {
            m_global_refs.push_back(std::move(ref));
        }
    }
}

```

### Core Architecture Module: `packages/cinterop/src/jvm/jni/env_utils.h`
```
/*
 * Copyright 2021 Realm Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef TEST_ENV_UTILS_H
#define TEST_ENV_UTILS_H

#include <jni.h>
#include <cstring>
#include <string>
#include <vector>
#include "java_global_ref_by_move.hpp"
#include "realm/util/optional.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved);

namespace realm {
    namespace jni_util {
        static std::vector<JavaGlobalRefByMove> m_global_refs;

        JNIEnv * get_env(bool attach_if_needed = false,
                         bool is_daemon_thread = false,
                         realm::util::Optional<std::string> thread_name = realm::util::none);
        // Returns current environment (or attaches current thread) or returns null if not possible
        // to obtain an environment, in which case we assume that the VM has shut down;
        JNIEnv * get_env_or_null();
        void detach_current_thread();
        // TODO Migrate java_method.{hpp,cpp} realm-java or implement similar caching mechanism to
        //  hold global references to classes and look up methods
        jmethodID lookup(JNIEnv *jenv, const char *class_name, const char *method_name,
                         const char *signature);

        void keep_global_ref(JavaGlobalRefByMove& ref);
    }
}

#endif //TEST_ENV_UTILS_H

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1873** (2025-09-23): **DOCSP-53342: Add converted .md docs to source code repo /docs dir for community access**
  *Symptoms*: Jira: https://jira.mongodb.org/browse/DOCSP-53342 & https://jira.mongodb.org/browse/DOCSP-53526  ## Description  Added new `docs/` dir to house the converted Kotlin SDK docs.   - All pages are converted fully to Markdown - Any references to deprecated features or products were removed (e.g. App Services and Device Sync)  - External links were preserved - Links to API references were removed since they pointed to `mongodb.docs` domain - Links to MongoDB, Atlas, or other Docs pages were removed  Updated main `README.md`:   - Point documentation links to local repo dir
  **Post-Mortem & Fix Analysis**:
  > Realm welcomes all contributions! The only requirement we have is that, like many other projects, we need to have a [Contributor License Agreement (CLA)](https://en.wikipedia.org/wiki/Contributor_License_Agreement) in place before we can accept any external code. Our own CLA is a modified version of the Apache Software Foundation’s CLA. Our records show that CLA has not been signed by @cbullinger. Please submit your CLA electronically using our [Google form](https://docs.google.com/forms/d/e/1FAIpQLSeQ9ROFaTu9pyrmPhXc-dEnLD84DbLuT_-tPNZDOL9J10tOKQ/viewform) so we can accept your submissions. After signing the CLA you can recheck this PR with a `@cla-bot check` comment. The GitHub usernames you file there will need to match that of your Pull Requests. If you have any questions or cannot file the CLA electronically, make a comment here and we will be happy to help you out.

- **Issue #1872** (2025-08-10): **Update kotlin 2.2.0**
  *Symptoms*: 

- **Issue #1867** (2025-07-02): **No more API reference? Aaaaargh!**
  *Symptoms*: I'd like to check the Realm Kotlin API reference, but it seems the documentation is no longer available on www.mongodb.com/docs/realm-sdks/android/.  I also tried web.archive.org, but no luck.
  **Post-Mortem & Fix Analysis**:
  > There is  https://www.mongodb.com/docs/atlas/device-sdks/sdk/kotlin/ that leads to  https://www.mongodb.com/docs/realm-sdks/kotlin/latest/library-base/index.html

- **Issue #1864** (2025-05-15): **Fixed compilation with Kotlin 2.1.21**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Thank you for your pull request and welcome to our community. We could not parse the GitHub identity of the following contributors: **Yehor Beskhmelnytsyn**. This is most likely caused by a git client misconfiguration; please make sure to: 1. check if your git client is configured with an email to sign commits `git config --list | grep email` 2. If not, set it up using `git config --global user.email email@example.com` 3. Make sure that the git commit email is configured in your GitHub account settings, see https://github.com/settings/emails

- **Issue #1862** (2025-03-07): **Setting up Realm in Android It is way past ridiculous.**
  *Symptoms*: I have tried far too many ways to configure Realm for a simple Kotlin Android App. There are tons of suggestions, none of which lead to any workable projects. There are two build.gradle.kts files, which are different and that is ridiculous. Even the instructions in this git repository lead no place. In simple instructions, how do I add realm.
  **Post-Mortem & Fix Analysis**:
  > You can find the installation instructions here: https://www.mongodb.com/docs/atlas/device-sdks/sdk/kotlin/install/.
  > Avoid realm while you are still in time. It's an abandoned project now.

- **Issue #1853** (2024-11-13): **Realm is unable to open due to Failed to open Realm file at path error**
  *Symptoms*: ### How frequently does the bug occur?  Sometimes  ### Description  Unfortunately i wasn't lucky enough to reproduce this issue, but i so it in firebase when couple devices had this error. I can't get their database files, but i would be happy to help where i can.  I saw same error in java and swift libraries that seems to be fixed, but didn't find fixes for kotlin version   ### Stacktrace & log output  ```shell Caused by: java.lang.IllegalStateException: [RLM_ERR_INVALID_DATABASE]: Failed to open Realm file at path '/data/user/0/gr.edps.pax/files/tax-db': top ref is outside of the file (size: 4096, top_ref: 5552). The file has probably been truncated. top_ref[0]: 1538, top_ref[1]: 15B0, mnemonic: 54 2D 44 42, fmt[0]: 24, fmt[1]: 24, flags: 1 	at io.realm.kotlin.internal.interop.CoreErrorConverter.asThrowable(CoreErrorConverter.kt:47) 	at io.realm.kotlin.internal.interop.realmcJNI.realm_open(Native Method) 	at io.realm.kotlin.internal.interop.realmc.realm_open(realmc.java:434) 	at io.realm.kotlin.internal.interop.RealmInterop.realm_open(RealmInterop.kt:238) 	at io.realm.kotlin.internal.ConfigurationImpl$openRealm$2.invoke(ConfigurationImpl.kt:115) 	at io.realm.kotlin.internal.ConfigurationImpl$openRealm$2.invoke(ConfigurationImpl.kt:114) 	at io.realm.kotlin.internal.interop.NativePointerKt.use(NativePointer.kt:53) 	at io.realm.kotlin.internal.ConfigurationImpl.openRealm$suspendImpl(ConfigurationImpl.kt:114) 	at io.realm.kotlin.internal.ConfigurationImpl.openRealm(U
  **Post-Mortem & Fix Analysis**:
  > ➤ PM Bot commented:  Jira ticket: RKOTLIN-1139
  > 1.15 is massively outdated. Did you try upgrading to 2.x?
  > Thank you for you response, I will update my version and open new issue in case will get same error

- **Issue #1850** (2025-01-20): **[RKOTLIN-1137] Fix incorrect currentTime() for Android devices on API 25 and blow**
  *Symptoms*: Also add millisecond precision.  This fixes https://github.com/realm/realm-kotlin/issues/1849
  **Post-Mortem & Fix Analysis**:
  > Realm welcomes all contributions! The only requirement we have is that, like many other projects, we need to have a [Contributor License Agreement (CLA)](https://en.wikipedia.org/wiki/Contributor_License_Agreement) in place before we can accept any external code. Our own CLA is a modified version of the Apache Software Foundation’s CLA. Our records show that CLA has not been signed by @stavfx. Please submit your CLA electronically using our [Google form](https://docs.google.com/forms/d/e/1FAIpQLSeQ9ROFaTu9pyrmPhXc-dEnLD84DbLuT_-tPNZDOL9J10tOKQ/viewform) so we can accept your submissions. After signing the CLA you can recheck this PR with a `@cla-bot check` comment. The GitHub usernames you file there will need to match that of your Pull Requests. If you have any questions or cannot file the CLA electronically, make a comment here and we will be happy to help you out.
  > @cla-bot check
  > The cla-bot has been summoned, and re-checked this pull request!

- **Issue #1849** (2025-01-20): **RealmInstant.now() returns wrong value on API 25 and below**
  *Symptoms*: ### How frequently does the bug occur?  Always  ### Description  The fix introduced [here](https://github.com/realm/realm-kotlin/pull/1572/files#diff-6ca4afb2037772e57d7d5227f42943fcd83efc27ad3d23c01ca9576ec1ad9467R48) is creating instances of `RealmInstantImpl` with milliseconds instead of seconds for devices running API 25 and below.  ### Stacktrace & log output  _No response_  ### Can you reproduce the bug?  Always  ### Reproduction Steps  _No response_  ### Version  1.16.0  ### What Atlas App Services are you using?  Local Database only  ### Are you using encryption?  No  ### Platform OS and version(s)  Android 7.1.2  ### Build environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > ➤ PM Bot commented:  Jira ticket: RKOTLIN-1137
  > Proposed fix: https://github.com/realm/realm-kotlin/pull/1850

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

### Incident Patch 1: `9cdc4556` (2025-01-20)
**Commit Message**: [RKOTLIN-1137] Fix incorrect currentTime() for Android devices on API 25 and below (#1850)

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 * None.
 
 ### Fixed
-* None.
+* `RealmInstant.now` was returning incorrect value on Android devices running API 25 and below (Issue: [#1849](https://github.com/realm/realm-kotlin/issues/1849)).
 
 ### Compatibility
 * File format: Generates Realms with file format v24 (reads and upgrades file format v10 or later).
```

**File**: `packages/library-base/src/androidMain/kotlin/io/realm/kotlin/internal/platform/SystemUtilsAndroid.kt` (modified, +2/-1)
```diff
@@ -44,6 +44,7 @@ public actual fun currentTime(): RealmInstant {
         val jtInstant = java.time.Clock.systemUTC().instant()
         RealmInstantImpl(jtInstant.epochSecond, jtInstant.nano)
     } else {
-        RealmInstantImpl(System.currentTimeMillis(), 0)
+        val now = System.currentTimeMillis()
+        RealmInstantImpl(now / 1000, (now % 1000).toInt() * 1_000_000)
     }
 }
```

---

### Incident Patch 2: `46f5e802` (2024-09-16)
**Commit Message**: Fix compiler crash when using Kotlin 2.0.20  (#1830)

* Update Kotlin to 2.0.20 & dependencies

---------

Co-authored-by: KitsuneAlex <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +3/-2)
```diff
@@ -1,4 +1,4 @@
-## 2.2.0 (2024-09-13)
+## 2.3.0-SNAPSHOT (YYYY-MM-DD)
 
 ### Breaking Changes
 * None.
@@ -19,6 +19,7 @@
 * [Sync] Client reset cycle detection now checks if the previous recovery attempt was made by the same core version, and if not attempts recovery again (Core issue [realm/realm-core#7944](https://github.com/realm/realm-core/pull/7944)).
 
 ### Fixed
+* Via https://github.com/realm/realm-kotlin/pull/1826. Fix compiler crash caused by a change in Kotlin 2.0.20. (Issue [#1825](https://github.com/realm/realm-kotlin/issues/1825)). Thanks @KitsuneAlex.
 * Comparing a numeric property with an argument list containing a string would throw. (Core issue [realm/realm-core#7714](https://github.com/realm/realm-core/issues/7714), since v2.0.0).
 * After compacting, a file upgrade would be triggered. This could cause loss of data if schema mode is SoftResetFile (Core issue [realm/realm-core#7747](https://github.com/realm/realm-core/issues/7747), since v1.15.0).
 * Encrypted files on Windows had a maximum size of 2GB even on x64 due to internal usage of `off_t`, which is a 32-bit type on 64-bit Windows (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698)).
@@ -46,7 +47,7 @@
 * File format: Generates Realms with file format v24 (reads and upgrades file format v10 or later).
 * Realm Studio 15.0.0 or above is required to open Realms created by this version.
 * This release is compatible with the following Kotlin releases:
-  * Kotlin 2.0.0 and above. Support for experimental K2-compilation with `kotlin.experimental.tryK2=true`.
+  * Kotlin 2.0.20 and above. Support for experimental K2-compilation with `kotlin.experimental.tryK2=true`.
   * Ktor 2.1.2 and above.
   * Coroutines 1.7.0 and above.
   * AtomicFu 0.18.3 and above.
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 
 [![Gradle Plugin Portal](https://img.shields.io/maven-metadata/v/https/plugins.gradle.org/m2/io/realm/kotlin/io.realm.kotlin.gradle.plugin/maven-metadata.xml.svg?colorB=ff6b00&label=Gradle%20Plugin%20Portal)](https://plugins.gradle.org/plugin/io.realm.kotlin)
 [![Maven Central](https://img.shields.io/maven-central/v/io.realm.kotlin/gradle-plugin?colorB=4dc427&label=Maven%20Central)](https://search.maven.org/artifact/io.realm.kotlin/gradle-plugin)
-[![Kotlin](https://img.shields.io/badge/kotlin-2.0.0-blue.svg?logo=kotlin)](http://kotlinlang.org)
+[![Kotlin](https://img.shields.io/badge/kotlin-2.0.20-blue.svg?logo=kotlin)](http://kotlinlang.org)
 [![License](https://img.shields.io/badge/License-Apache-blue.svg)](https://github.com/realm/realm-kotlin/blob/master/LICENSE)
 
 
@@ -328,6 +328,7 @@ SDK supports. In the matrix below, you will find the minimum supported version f
 
 | Realm Version | Requirements                                                                                                                                                                                             |
 |---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
+| 2.3.0         | <ul><li>Kotlin 2.0.20+</li><li>AtomicFu 0.18.3+.</li><li>Ktor 2.1.2+.</li><li>Coroutines 1.7.0+.</li><li>Gradle 7.2 - 8.5</li><li>The new memory model only.</li></ul>         |
 | 2.0.0         | <ul><li>Kotlin 2.0.0+</li><li>AtomicFu 0.18.3+.</li><li>Ktor 2.1.2+.</li><li>Coroutines 1.7.0+.</li><li>Gradle 7.2 - 8.5</li><li>The new memory model only.</li></ul>         |
 | 1.16.0        | <ul><li>Kotlin 1.9.0+</li><li>AtomicFu 0.18.3+.</li><li>Ktor 2.1.2+.</li><li>Coroutines 1.7.0+.</li><li>Gradle 6.8.3 - 8.5</li><li>The new memory model only.</li></ul>         |
 | 1.15.0        | <ul><li>Kotlin 1.9.0+</li><li>AtomicFu 0.18.3+.</li><li>Ktor 2.1.2+.</li><li>Coroutines 1.7.0+.</li><li>Gradle 6.8.3 - 8.5</li><li>The new memory model only.</li></ul>         |
```

**File**: `buildSrc/src/main/kotlin/Config.kt` (modified, +6/-6)
```diff
@@ -62,7 +62,7 @@ val HOST_OS: OperatingSystem = findHostOs()
 
 object Realm {
     val ciBuild = (System.getenv("CI") != null)
-    const val version = "2.2.0"
+    const val version = "2.3.0-SNAPSHOT"
     const val group = "io.realm.kotlin"
     const val projectUrl = "https://realm.io"
     const val pluginPortalId = "io.realm.kotlin"
@@ -123,15 +123,15 @@ object Versions {
     const val junit = "4.13.2" // https://mvnrepository.com/artifact/junit/junit
     const val kbson = "0.4.0" // https://github.com/mongodb/kbson
     // When updating the Kotlin version, also remember to update /examples/min-android-sample/build.gradle.kts
-    const val kotlin = "2.0.0" // https://github.com/JetBrains/kotlin and https://kotlinlang.org/docs/releases.html#release-details
+    const val kotlin = "2.0.20" // https://github.com/JetBrains/kotlin and https://kotlinlang.org/docs/releases.html#release-details
     const val kotlinJvmTarget = "1.8" // Which JVM bytecode version is kotlin compiled to.
-    const val latestKotlin = "2.0.0" // https://kotlinlang.org/docs/eap.html#build-details
-    const val kotlinCompileTesting = "0.5.0-alpha07" // https://github.com/zacsweers/kotlin-compile-testing
+    const val latestKotlin = "2.0.20" // https://kotlinlang.org/docs/eap.html#build-details
+    const val kotlinCompileTesting = "0.5.1" // https://github.com/zacsweers/kotlin-compile-testing
     const val ktlint = "0.45.2" // https://github.com/pinterest/ktlint
     const val ktor = "2.3.12" // https://github.com/ktorio/ktor
     const val multidex = "2.0.1" // https://developer.android.com/jetpack/androidx/releases/multidex
-    const val nexusPublishPlugin = "1.1.0" // https://github.com/gradle-nexus/publish-plugin
-    const val okio = "3.2.0" // https://square.github.io/okio/#releases
+    const val nexusPublishPlugin = "1.3.0" // https://github.com/gradle-nexus/publish-plugin
+    const val okio = "3.9.0" // https://square.github.io/okio/#releases
     const val relinker = "1.4.5" // https://github.com/KeepSafe/ReLinker
     const val serialization = "1.7.1" // https://kotlinlang.org/docs/releases.html#release-details
     const val shadowJar =  "6.1.0" // https://mvnrepository.com/artifact/com.github.johnrengelman.shadow/com.github.johnrengelman.shadow.gradle.plugin?repo=gradle-plugins
```

**File**: `examples/min-android-sample/build.gradle.kts` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ buildscript {
     }
     dependencies {
         classpath("com.android.tools.build:gradle:7.1.3")
-        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
+        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.20")
         classpath("io.realm.kotlin:gradle-plugin:${rootProject.extra["realmVersion"]}")
     }
 }
```

**File**: `integration-tests/gradle/gradle72-test/build.gradle.kts` (modified, +8/-1)
```diff
@@ -26,6 +26,13 @@ buildscript {
                 it.substringAfter("\"").substringBefore("\"")
             }
 
+        extra["kotlinVersion"] = file("${rootProject.rootDir.absolutePath}/../../../buildSrc/src/main/kotlin/Config.kt")
+            .readLines()
+            .first { it.contains("const val kotlin") }
+            .let {
+                it.substringAfter("\"").substringBefore("\"")
+            }
+
         repositories {
             maven(url = "file://${rootProject.rootDir.absolutePath}/../../../packages/build/m2-buildrepo")
             gradlePluginPortal()
@@ -34,7 +41,7 @@ buildscript {
         }
         dependencies {
             classpath("com.android.tools.build:gradle:7.1.3")
-            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
+            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${rootProject.extra["kotlinVersion"]}")
             classpath("io.realm.kotlin:gradle-plugin:${rootProject.extra["realmVersion"]}")
         }
 }
```

**File**: `integration-tests/gradle/gradle75-test/build.gradle.kts` (modified, +8/-1)
```diff
@@ -26,6 +26,13 @@ buildscript {
                 it.substringAfter("\"").substringBefore("\"")
             }
 
+        extra["kotlinVersion"] = file("${rootProject.rootDir.absolutePath}/../../../buildSrc/src/main/kotlin/Config.kt")
+            .readLines()
+            .first { it.contains("const val kotlin") }
+            .let {
+                it.substringAfter("\"").substringBefore("\"")
+            }
+
         repositories {
             maven(url = "file://${rootProject.rootDir.absolutePath}/../../../packages/build/m2-buildrepo")
             gradlePluginPortal()
@@ -34,7 +41,7 @@ buildscript {
         }
         dependencies {
             classpath("com.android.tools.build:gradle:7.4.0")
-            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
+            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${rootProject.extra["kotlinVersion"]}")
             classpath("io.realm.kotlin:gradle-plugin:${rootProject.extra["realmVersion"]}")
         }
 }
```

**File**: `integration-tests/gradle/gradle8-test/build.gradle.kts` (modified, +8/-1)
```diff
@@ -26,6 +26,13 @@ buildscript {
                 it.substringAfter("\"").substringBefore("\"")
             }
 
+        extra["kotlinVersion"] = file("${rootProject.rootDir.absolutePath}/../../../buildSrc/src/main/kotlin/Config.kt")
+            .readLines()
+            .first { it.contains("const val kotlin") }
+            .let {
+                it.substringAfter("\"").substringBefore("\"")
+            }
+
         repositories {
             maven(url = "file://${rootProject.rootDir.absolutePath}/../../../packages/build/m2-buildrepo")
             gradlePluginPortal()
@@ -34,7 +41,7 @@ buildscript {
         }
         dependencies {
             classpath("com.android.tools.build:gradle:8.1.0")
-            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
+            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${rootProject.extra["kotlinVersion"]}")
             classpath("io.realm.kotlin:gradle-plugin:${rootProject.extra["realmVersion"]}")
         }
 }
```

**File**: `integration-tests/gradle/gradle85-test/build.gradle.kts` (modified, +8/-1)
```diff
@@ -26,6 +26,13 @@ buildscript {
                 it.substringAfter("\"").substringBefore("\"")
             }
 
+        extra["kotlinVersion"] = file("${rootProject.rootDir.absolutePath}/../../../buildSrc/src/main/kotlin/Config.kt")
+            .readLines()
+            .first { it.contains("const val kotlin") }
+            .let {
+                it.substringAfter("\"").substringBefore("\"")
+            }
+
         repositories {
             maven(url = "file://${rootProject.rootDir.absolutePath}/../../../packages/build/m2-buildrepo")
             gradlePluginPortal()
@@ -34,7 +41,7 @@ buildscript {
         }
         dependencies {
             classpath("com.android.tools.build:gradle:8.1.0")
-            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
+            classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${rootProject.extra["kotlinVersion"]}")
             classpath("io.realm.kotlin:gradle-plugin:${rootProject.extra["realmVersion"]}")
         }
 }
```

---

### Incident Patch 3: `06aacec9` (2024-08-08)
**Commit Message**: [RKOTLIN-1114] Fix sync client config not applied (#1779)

**File**: `.github/workflows/include-static-analysis.yml` (modified, +5/-1)
```diff
@@ -35,6 +35,7 @@ jobs:
         run: ./gradlew ktlintCheck
 
       - name: Stash Ktlint results
+        if: always()
         run: |
           rm -rf /tmp/ktlint
           rm -rf /tmp/detekt
@@ -50,6 +51,7 @@ jobs:
 
       - name: Publish Ktlint results
         uses: actions/upload-artifact@v4
+        if: always()
         with:
           name: Ktlint Analyzer report
           path: /tmp/ktlint/*
@@ -85,7 +87,8 @@ jobs:
       - name: Run Detekt
         run: ./gradlew detekt
 
-      - name: Stash Detekt results    
+      - name: Stash Detekt results   
+        if: always() 
         run: |
           rm -rf /tmp/detekt
           mkdir /tmp/detekt
@@ -99,6 +102,7 @@ jobs:
 
       - name: Publish Detekt results    
         uses: actions/upload-artifact@v4
+        if: always()
         with:
           name: Detekt Analyzer report
           path: /tmp/detekt/*
```

**File**: `.github/workflows/pr.yml` (modified, +25/-9)
```diff
@@ -122,7 +122,7 @@ jobs:
           key: jni-linux-lib-${{ needs.check-cache.outputs.packages-sha }}
 
       - name: Setup Java 11
-        uses: actions/setup-java@v3
+        uses: actions/setup-java@v4
         with:
           distribution: ${{ vars.VERSION_JAVA_DISTRIBUTION }}
           java-version: ${{ vars.VERSION_JAVA }}
@@ -431,11 +431,15 @@ jobs:
         run: |-
           echo "::add-matcher::.github/problem-matchers/kotlin.json"
 
-      - name: Setup Java 17
+      - name: Setup Java
         uses: actions/setup-java@v4
         with:
           distribution: ${{ vars.VERSION_JAVA_DISTRIBUTION }}
-          java-version: '17'
+          # JVM 17 is required for android-actions/setup-android@v3
+          # Last version will be used and available globally. Other Java versions can be accessed through env variables with such specification as 'JAVA_HOME_{{ MAJOR_VERSION }}_{{ ARCHITECTURE }}'
+          java-version: |
+            17
+            ${{ vars.VERSION_JAVA }} 
 
       - name: Setup Gradle and task/dependency caching
         uses: gradle/actions/setup-gradle@v3
@@ -473,10 +477,14 @@ jobs:
           echo '#!/bin/bash\nccache clang++ "$@"%"' > /usr/local/bin/ccache-clang++          
 
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v2
-  
+        env:
+          JAVA_HOME: ${{ env.JAVA_HOME_17_ARM64 }}
+        uses: android-actions/setup-android@v3
+
       - name: Install NDK
         run: sdkmanager --install "ndk;${{ env.NDK_VERSION }}"
+        env:
+          JAVA_HOME: ${{ env.JAVA_HOME_17_ARM64 }}
 
       # We cannot use artifacts as they cannot be shared between workflows, so use cache instead.
       - name: Setup build cache
@@ -543,11 +551,15 @@ jobs:
         with:
           submodules: "recursive"
 
-      - name: Setup Java 11
+      - name: Setup Java
         uses: actions/setup-java@v4
         with:
           distribution: ${{ vars.VERSION_JAVA_DISTRIBUTION }}
-          java-version: ${{ vars.VERSION_JAVA }}
+          # JVM 17 is required for android-actions/setup-android@v3
+          # Last version will be used and available globally. Other Java versions can be accessed through env variables with such specification as 'JAVA_HOME_{{ MAJOR_VERSION }}_{{ ARCHITECTURE }}'
+          java-version: |
+            17
+            ${{ vars.VERSION_JAVA }}
 
       - name: Setup Gradle and task/dependency caching
         uses: gradle/actions/setup-gradle@v3
@@ -602,9 +614,13 @@ jobs:
           echo '#!/bin/bash\nccache clang++ "$@"%"' > /usr/local/bin/ccache-clang++          
 
       - name: Setup Android SDK
-        uses: android-actions/setup-android@v2
-    
+        uses: android-actions/setup-android@v3
+        env:
+          JAVA_HOME: ${{ env.JAVA_HOME_17_X64 }}
+
       - name: Install NDK
+        env:
+          JAVA_HOME: ${{ env.JAVA_HOME_17_X64 }}
         run: sdkmanager --install "ndk;${{ env.NDK_VERSION }}"
 
       - name: Build Android Base Test Apk
```

**File**: `CHANGELOG.md` (modified, +22/-2)
```diff
@@ -4,10 +4,30 @@
 * None.
 
 ### Enhancements
+* Reduce the size of the local transaction log produced by creating objects, improving the performance of insertion-heavy transactions (Core issue [realm/realm-core#7734](https://github.com/realm/realm-core/pull/7734)).
+* Performance has been improved for range queries on integers and timestamps. Requires that you use the "BETWEEN" operation in RQL or the Query::between() method when you build the query. (Core issue [realm/realm-core#7785](https://github.com/realm/realm-core/pull/7785))
+* [Sync] Report the originating error that caused a client reset to occur. (Core issue [realm/realm-core#6154](https://github.com/realm/realm-core/issues/6154)).
+* [Sync] It is no longer an error to set a base url for an App with a trailing slash - for example, `https://services.cloud.mongodb.com/` instead of `https://services.cloud.mongodb.com` - before this change that would result in a 404 error from the server (Core issue [realm/realm-core#7791](https://github.com/realm/realm-core/pull/7791)).
+* [Sync] On Windows devices Device Sync will additionally look up SSL certificates in the Windows Trusted Root Certification Authorities certificate store when establishing a connection. (Core issue [realm/realm-core#7882](https://github.com/realm/realm-core/pull/7882))
 * [Sync] Add support for switching users with `App.switchUser(User)`. (Issue [#1813](https://github.com/realm/realm-kotlin/issues/1813)/[RKOTLIN-1115](https://jira.mongodb.org/browse/RKOTLIN-1115)).
 
 ### Fixed
-* None.
+* Comparing a numeric property with an argument list containing a string would throw. (Core issue [realm/realm-core#7714](https://github.com/realm/realm-core/issues/7714), since v2.0.0).
+* After compacting, a file upgrade would be triggered. This could cause loss of data if schema mode is SoftResetFile (Core issue [realm/realm-core#7747](https://github.com/realm/realm-core/issues/7747), since v1.15.0).
+* Encrypted files on Windows had a maximum size of 2GB even on x64 due to internal usage of `off_t`, which is a 32-bit type on 64-bit Windows (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698)).
+* The encryption code no longer behaves differently depending on the system page size, which should entirely eliminate a recurring source of bugs related to copying encrypted Realm files between platforms with different page sizes. One known outstanding bug was ([RNET-1141](https://github.com/realm/realm-dotnet/issues/3592)), where opening files on a system with a larger page size than the writing system would attempt to read sections of the file which had never been written to (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698)).
+* There were several complicated scenarios which could result in stale reads from encrypted files in multiprocess scenarios. These were very difficult to hit and would typically lead to a crash, either due to an assertion failure or DecryptionFailure being thrown (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698), since v1.8.0).
+* Encrypted files have some benign data races where we can memcpy a block of memory while another thread is writing to a limited range of it. It is logically impossible to ever read from that range when this happens, but Thread Sanitizer quite reasonably complains about this. We now perform a slower operations when running with TSan which avoids this benign race (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698)).
+* Tokenizing strings for full-text search could pass values outside the range [-1, 255] to `isspace()`, which is undefined behavior (Core issue [realm/realm-core#7698](https://github.com/realm/realm-core/pull/7698), since the introduction of FTS).
+* Clearing a List of RealmAnys in an upgraded file would lead to an assertion failing (Core issue [realm/realm-core#7771](https://github.com/realm/realm-core/issues/7771), since v1.15.0)
+* You could get unexpected merge results when assigning to a nested collection (Core issue [realm/realm-core#7809](https://github.com/realm/realm-core/issues/7809), since v1.15.0)
+* Fixed removing backlinks from the wrong objects if the link came from a nested list, nested dictionary, top-level dictionary, or list of mixed, and the source table had more than 256 objects. This could manifest as `array_backlink.cpp:112: Assertion failed: int64_t(value >> 1) == key.value` when removing an object. (Core issue [realm/realm-core#7594](https://github.com/realm/realm-core/issues/7594), since Core v11 for dictionaries)
+* Fixed the collapse/rejoin of clusters which contained nested collections with links. This could manifest as `array.cpp:319: Array::move() Assertion failed: begin <= end [2, 1]` when removing an object. (Core issue [realm/realm-core#7839](https://github.com/realm/realm-core/issues/7839), since the introduction of nested collections in v1.15.0)
+* [Sync] Platform networking was n
```

**File**: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +3/-6)
```diff
@@ -519,7 +519,6 @@ expect object RealmInterop {
     // App
     fun realm_app_get(
         appConfig: RealmAppConfigurationPointer,
-        syncClientConfig: RealmSyncClientConfigurationPointer,
         basePath: String,
     ): RealmAppPointer
     fun realm_app_get_current_user(app: RealmAppPointer): RealmUserPointer?
@@ -600,8 +599,7 @@ expect object RealmInterop {
     fun realm_user_refresh_custom_data(app: RealmAppPointer, user: RealmUserPointer, callback: AppCallback<Unit>)
 
     // Sync client config
-    fun realm_sync_client_config_new(): RealmSyncClientConfigurationPointer
-
+    fun realm_app_config_get_sync_client_config(configPointer: RealmAppConfigurationPointer): RealmSyncClientConfigurationPointer
     fun realm_sync_client_config_set_default_binding_thread_observer(
         syncClientConfig: RealmSyncClientConfigurationPointer,
         appId: String
@@ -652,6 +650,8 @@ expect object RealmInterop {
         user: RealmUserPointer,
         partition: String
     ): RealmSyncConfigurationPointer
+    // Flexible Sync
+    fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer
     fun realm_sync_config_set_error_handler(
         syncConfig: RealmSyncConfigurationPointer,
         errorHandler: SyncErrorCallback
@@ -789,9 +789,6 @@ expect object RealmInterop {
         syncConfiguration: RealmSyncConfigurationPointer
     )
 
-    // Flexible Sync
-    fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer
-
     // Flexible Sync Subscription
     fun realm_sync_subscription_id(subscription: RealmSubscriptionPointer): ObjectId
     fun realm_sync_subscription_name(subscription: RealmSubscriptionPointer): String?
```

**File**: `packages/cinterop/src/jvm/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +7/-7)
```diff
@@ -1154,7 +1154,6 @@ actual object RealmInterop {
 
     actual fun realm_app_get(
         appConfig: RealmAppConfigurationPointer,
-        syncClientConfig: RealmSyncClientConfigurationPointer,
         basePath: String
     ): RealmAppPointer {
         return LongPointerWrapper(realmc.realm_app_create(appConfig.cptr()), managed = true)
@@ -1314,8 +1313,9 @@ actual object RealmInterop {
         )
     }
 
-    actual fun realm_sync_client_config_new(): RealmSyncClientConfigurationPointer {
-        return LongPointerWrapper(realmc.realm_sync_client_config_new())
+    actual fun realm_app_config_get_sync_client_config(configPointer: RealmAppConfigurationPointer): RealmSyncClientConfigurationPointer {
+        // The configuration is owned by Core so don't track and release it through garbage collection of the NativePointer
+        return LongPointerWrapper(realmc.realm_app_config_get_sync_client_config(configPointer.cptr()), false)
     }
 
     actual fun realm_sync_client_config_set_default_binding_thread_observer(syncClientConfig: RealmSyncClientConfigurationPointer, appId: String) {
@@ -1762,6 +1762,10 @@ actual object RealmInterop {
         }
     }
 
+    actual fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer {
+        return LongPointerWrapper<RealmSyncConfigT>(realmc.realm_flx_sync_config_new(user.cptr()))
+    }
+
     actual fun realm_config_set_sync_config(realmConfiguration: RealmConfigurationPointer, syncConfiguration: RealmSyncConfigurationPointer) {
         realmc.realm_config_set_sync_config(realmConfiguration.cptr(), syncConfiguration.cptr())
     }
@@ -1984,10 +1988,6 @@ actual object RealmInterop {
         realmc.realm_object_delete(obj.cptr())
     }
 
-    actual fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer {
-        return LongPointerWrapper(realmc.realm_flx_sync_config_new(user.cptr()))
-    }
-
     actual fun realm_sync_subscription_id(subscription: RealmSubscriptionPointer): ObjectId {
         val nativeBytes: ShortArray = realmc.realm_sync_subscription_id(subscription.cptr()).bytes
         val byteArray = ByteArray(nativeBytes.size)
```

**File**: `packages/cinterop/src/nativeDarwin/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +7/-7)
```diff
@@ -2062,7 +2062,6 @@ actual object RealmInterop {
 
     actual fun realm_app_get(
         appConfig: RealmAppConfigurationPointer,
-        syncClientConfig: RealmSyncClientConfigurationPointer,
         basePath: String
     ): RealmAppPointer {
         return CPointerWrapper(realm_wrapper.realm_app_create(appConfig.cptr()), managed = true)
@@ -2469,8 +2468,9 @@ actual object RealmInterop {
         )
     }
 
-    actual fun realm_sync_client_config_new(): RealmSyncClientConfigurationPointer {
-        return CPointerWrapper(realm_wrapper.realm_sync_client_config_new())
+    actual fun realm_app_config_get_sync_client_config(configPointer: RealmAppConfigurationPointer): RealmSyncClientConfigurationPointer {
+        // The configuration is owned by Core so don't track and release it through garbage collection of the NativePointer
+        return CPointerWrapper(realm_wrapper.realm_app_config_get_sync_client_config(configPointer.cptr()), false)
     }
 
     actual fun realm_sync_client_config_set_default_binding_thread_observer(
@@ -3321,6 +3321,10 @@ actual object RealmInterop {
         }
     }
 
+    actual fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer {
+        return CPointerWrapper<RealmSyncConfigT>(realm_wrapper.realm_flx_sync_config_new((user.cptr())))
+    }
+
     actual fun realm_app_sync_client_reconnect(app: RealmAppPointer) {
         realm_wrapper.realm_app_sync_client_reconnect(app.cptr())
     }
@@ -3336,10 +3340,6 @@ actual object RealmInterop {
         realm_wrapper.realm_config_set_sync_config(realmConfiguration.cptr(), syncConfiguration.cptr())
     }
 
-    actual fun realm_flx_sync_config_new(user: RealmUserPointer): RealmSyncConfigurationPointer {
-        return CPointerWrapper(realm_wrapper.realm_flx_sync_config_new((user.cptr())))
-    }
-
     actual fun realm_sync_subscription_id(subscription: RealmSubscriptionPointer): ObjectId {
         return ObjectId(realm_wrapper.realm_sync_subscription_id(subscription.cptr()).getBytes())
     }
```

**File**: `packages/external/core` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit c280bdb17522323d5c30dc32a2b9efc9dc80ca3b
+Subproject commit 1f0378ae53f73d67a309c9499aec512f4cde53f1
```

**File**: `packages/jni-swig-stub/realm.i` (modified, +0/-2)
```diff
@@ -533,8 +533,6 @@ $result = SWIG_JavaArrayOutLonglong(jenv, (long long *)result, 2);
 %ignore "realm_dictionary_add_notification_callback";
 %ignore "realm_results_add_notification_callback";
 
-%ignore "realm_app_config_get_sync_client_config";
-
 // Swig doesn't understand __attribute__ so eliminate it
 #define __attribute__(x)
 
```

---

### Incident Patch 4: `4e7ea38f` (2024-07-09)
**Commit Message**: Fix sync client and sync realm tests (#1798)

**File**: `packages/test-sync/src/commonTest/kotlin/io/realm/kotlin/test/mongodb/common/SyncClientTests.kt` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import io.realm.kotlin.mongodb.sync.SyncConfiguration
 import io.realm.kotlin.test.mongodb.TestApp
 import io.realm.kotlin.test.mongodb.asTestApp
 import io.realm.kotlin.test.mongodb.createUserAndLogIn
-import io.realm.kotlin.test.mongodb.util.DefaultPartitionBasedAppInitializer
+import io.realm.kotlin.test.mongodb.util.DefaultFlexibleSyncAppInitializer
 import io.realm.kotlin.test.util.TestHelper
 import io.realm.kotlin.test.util.use
 import kotlin.test.AfterTest
@@ -29,7 +29,7 @@ class SyncClientTests {
 
     @BeforeTest
     fun setup() {
-        app = TestApp(this::class.simpleName, DefaultPartitionBasedAppInitializer)
+        app = TestApp(this::class.simpleName, DefaultFlexibleSyncAppInitializer)
         val (email, password) = TestHelper.randomEmail() to "password1234"
         user = runBlocking {
             app.createUserAndLogIn(email, password)
```

**File**: `packages/test-sync/src/commonTest/kotlin/io/realm/kotlin/test/mongodb/common/SyncedRealmTests.kt` (modified, +195/-167)
```diff
@@ -721,79 +721,100 @@ class SyncedRealmTests {
     fun roundtripCollectionsInMixed() = runBlocking {
         val (email1, password1) = randomEmail() to "password1234"
         val (email2, password2) = randomEmail() to "password1234"
-        val app = TestApp(this::class.simpleName, DefaultFlexibleSyncAppInitializer)
-        val user1 = app.createUserAndLogIn(email1, password1)
-        val user2 = app.createUserAndLogIn(email2, password2)
-
-        // Create object with all types
-        val selector = ObjectId().toString()
-        var parentId: ObjectId? = null
-        var childId: ObjectId? = null
+        TestApp(this::class.simpleName, DefaultFlexibleSyncAppInitializer).use { app ->
+            val user1 = app.createUserAndLogIn(email1, password1)
+            val user2 = app.createUserAndLogIn(email2, password2)
 
-        createFlexibleSyncConfig(
-            user = user1,
-            initialSubscriptions = { realm ->
-                realm.query<JsonStyleRealmObject>("selector = $0", selector).subscribe()
-            }
-        ).let { config ->
-            Realm.open(config).use { realm ->
-                realm.write {
-                    val child = (
-                        JsonStyleRealmObject().apply {
-                            this.selector = selector
-                        }
-                        )
-                    childId = child.id
+            // Create object with all types
+            val selector = ObjectId().toString()
+            var parentId: ObjectId? = null
+            var childId: ObjectId? = null
 
-                    parentId = copyToRealm(
-                        JsonStyleRealmObject().apply {
-                            this.selector = selector
-                            value = realmAnyDictionaryOf(
-                                "primitive" to 1,
-                                // List with nested dictionary
-                                "list" to realmAnyListOf(1, "Realm", child, realmAnyDictionaryOf("listkey1" to 1, "listkey2" to "Realm", "listkey3" to child)),
-                                "dictionary" to realmAnyDictionaryOf("dictkey1" to 1, "dictkey2" to "Realm", "dictkey3" to child, "dictkey4" to realmAnyListOf(1, 2, 3))
+            createFlexibleSyncConfig(
+                user = user1,
+                initialSubscriptions = { realm ->
+                    realm.query<JsonStyleRealmObject>("selector = $0", selector).subscribe()
+                }
+            ).let { config ->
+                Realm.open(config).use { realm ->
+                    realm.write {
+                        val child = (
+                            JsonStyleRealmObject().apply {
+                                this.selector = selector
+                            }
                             )
-                        }
-                    ).id
+                        childId = child.id
+
+                        parentId = copyToRealm(
+                            JsonStyleRealmObject().apply {
+                                this.selector = selector
+                                value = realmAnyDictionaryOf(
+                                    "primitive" to 1,
+                                    // List with nested dictionary
+                                    "list" to realmAnyListOf(
+                                        1,
+                                        "Realm",
+                                        child,
+                                        realmAnyDictionaryOf(
+                                            "listkey1" to 1,
+                                            "listkey2" to "Realm",
+                                            "listkey3" to child
+                                        )
+                                    ),
+                                    "dictionary" to realmAnyDictionaryOf(
+                                        "dictkey1" to 1,
+                                        "dictkey2" to "Realm",
+                                        "dictkey3" to child,
+                                        "dictkey4" to realmAnyListOf(1, 2, 3)
+                                    )
+                                )
+                            }
+                        ).id
+                    }
+                    realm.syncSession.uploadAllLocalChangesOrFail()
                 }
-                realm.syncSession.uploadAllLocalChangesOrFail()
-            }
-        }
-        createFlexibleSyncConfig(
-            user = user2,
-            initialSubscriptions = { realm ->
-                realm.query<JsonStyleRealmObject>("selector = $0", selector).subscribe()
             }
-        ).let { config ->
-            Realm.open(config).use { realm ->
-                realm.syncSession.downloadAllServerChanges(10.seconds)
-                val flow = realm.query<JsonStyleRealmObject>("_id = $0", parentId).asFlow()
-                val parent = withTimeout(10.seconds) {
-   
```

---

### Incident Patch 5: `ec6f2a0d` (2024-07-05)
**Commit Message**: Build linux libraries with glibc 2.17 (#1795)

**File**: `.github/workflows/pr.yml` (modified, +11/-1)
```diff
@@ -113,6 +113,12 @@ jobs:
           path: ./packages/cinterop/build/realmLinuxBuild
           key: jni-linux-lib-${{ needs.check-cache.outputs.packages-sha }}
 
+      - name: Setup Java 11
+        uses: actions/setup-java@v3
+        with:
+          distribution: ${{ vars.VERSION_JAVA_DISTRIBUTION }}
+          java-version: ${{ vars.VERSION_JAVA }}
+
       - name: Setup cmake
         uses: jwlawson/actions-setup-cmake@v1.13
         with:
@@ -136,6 +142,8 @@ jobs:
             -DREALM_ENABLE_SYNC=1 \
             -DREALM_NO_TESTS=1 \
             -DREALM_BUILD_LIB_ONLY=true \
+            -DCMAKE_TOOLCHAIN_FILE=../../../external/core/tools/cmake/x86_64-linux-gnu.toolchain.cmake \
+            -DJAVA_INCLUDE_PATH=${{ env.JAVA_HOME }}/include/ \
             ../../src/jvm
             make -j8
 
@@ -1091,7 +1099,9 @@ jobs:
       always() && 
       !cancelled() && 
       !contains(needs.*.result, 'failure') && 
-      !contains(needs.*.result, 'cancelled')
+      !contains(needs.*.result, 'cancelled') &&
+      endsWith(needs.check-cache.outputs.version-label, '-SNAPSHOT') &&
+      (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/releases' || github.ref == 'refs/heads/release/k2')
     steps:
       - name: Checkout code
         uses: actions/checkout@v3
```

---

### Incident Patch 6: `71fbef9c` (2024-06-20)
**Commit Message**: [RKOTLIN-1100] Clean up build system (#1770)

**File**: `.gitignore` (modified, +8/-0)
```diff
@@ -329,3 +329,11 @@ DerivedData/
 
 # End of https://www.gitignore.io/api/c,git,c++,java,cmake,xcode,kotlin,android,intellij,visualstudiocode
 dynamic_libraries.properties
+
+**/.kotlin
+
+**/output
+
+packages/test-sync/mongodb-realm/
+
+packages/m2-buildrepo
```

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -98,11 +98,12 @@
 * Minimum Gradle version: 7.2.
 * Minimum Android Gradle Plugin version: 7.1.3.
 * Minimum Android SDK: 16.
-* Minimum R8: 8.0.34.
+* Minimum R8: 8.3.37.
 
 ### Internal
 * Updated to Realm Core 14.7.0 commit c280bdb17522323d5c30dc32a2b9efc9dc80ca3b.
 * Changed Kotlin compiler testing framework to https://github.com/zacsweers/kotlin-compile-testing
+* Updated to Detekt 1.23.6.
 
 
 ## 1.16.0 (2024-05-01)
```

**File**: `benchmarks/androidApp/build.gradle.kts` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ plugins {
 }
 
 android {
+    namespace = "io.realm.kotlin.benchmarks.android"
+    testNamespace = "io.realm.kotlin.benchmarks.android.test"
     compileSdk = Versions.Android.compileSdkVersion
 
     compileOptions {
```

**File**: `benchmarks/androidApp/src/androidTest/AndroidManifest.xml` (modified, +2/-3)
```diff
@@ -1,7 +1,6 @@
 <?xml version="1.0" encoding="utf-8"?>
 <manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    xmlns:tools="http://schemas.android.com/tools"
-    package="io.realm.kotlin.benchmarks.android.test">
+    xmlns:tools="http://schemas.android.com/tools">
 
     <!--
       Important: disable debugging for accurate performance results
@@ -13,5 +12,5 @@
         android:debuggable="false"
         android:requestLegacyExternalStorage="true"
         tools:ignore="HardcodedDebugMode"
-        tools:replace="android:debuggable" />
+        />
 </manifest>
\ No newline at end of file
```

**File**: `benchmarks/androidApp/src/main/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 <?xml version="1.0" encoding="utf-8"?>
-<manifest package="io.realm.kotlin.benchmarks.android" />
\ No newline at end of file
+<manifest/>
\ No newline at end of file
```

**File**: `benchmarks/gradle.properties` (modified, +2/-0)
```diff
@@ -6,3 +6,5 @@ kotlin.code.style=official
 
 #Android
 android.useAndroidX=true
+
+kotlin.mpp.applyDefaultHierarchyTemplate=false
```

**File**: `benchmarks/shared/build.gradle.kts` (modified, +2/-4)
```diff
@@ -8,7 +8,7 @@ plugins {
 version = "1.0"
 
 kotlin {
-    android()
+    androidTarget()
     jvm()
 // Disable iOS until needed
 //    iosX64()
@@ -31,9 +31,6 @@ kotlin {
                 implementation("io.realm.kotlin:library-sync:${Realm.version}")
             }
         }
-        val main by creating {
-            dependsOn(commonMain)
-        }
         val androidMain by getting
 // Disable iOS until needed
 //        val iosX64Main by getting
@@ -58,6 +55,7 @@ kotlin {
 }
 
 android {
+    namespace = "io.realm.kotlin.benchmarks"
     compileSdk = Versions.Android.compileSdkVersion
     sourceSets["main"].manifest.srcFile("src/androidMain/AndroidManifest.xml")
     defaultConfig {
```

**File**: `benchmarks/shared/src/androidMain/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 <?xml version="1.0" encoding="utf-8"?>
-<manifest package="io.realm.kotlin.benchmarks" />
\ No newline at end of file
+<manifest/>
\ No newline at end of file
```

---

### Incident Patch 7: `c8e37806` (2024-06-07)
**Commit Message**: [RKOTLIN-1102] Remove nullability check in `SubscriptionSetImpl.waitForSynchronization` (#1778)

**File**: `.github/workflows/include-check-cache.yml` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ jobs:
     # This also include changes to Realm Core as they are hashed as part of `/packages/external/core`
     - name: Calculate ./packages SHAs 
       id: packages-cache-key
-      run: echo "sha=${{ hashFiles('./packages/**', './buildSrc/**', '!./packages/test-base/**', '!./packages/test-sync/**') }}" >> $GITHUB_OUTPUT
+      run: echo "sha=${{ hashFiles('./packages/**', './buildSrc/**') }}" >> $GITHUB_OUTPUT
 
     - name: Calculate ./benchmarks SHAs 
       id: calculate-benchmarks-cache-key
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 
 ### Fixed
 * [Sync] Fatal sync exceptions are now thrown as `UnrecoverableSyncException`. (Issue [#1767](https://github.com/realm/realm-kotlin/issues/1767) [RKOTLIN-1096](https://jira.mongodb.org/browse/RKOTLIN-1096)).
+* [Sync] Fix `NullPointerException` in `SubscriptionSet.waitForSynchronization`. (Issue [#1777](https://github.com/realm/realm-kotlin/issues/1777) [RKOTLIN-1102](https://jira.mongodb.org/browse/RKOTLIN-1102)).
 
 ### Compatibility
 * File format: Generates Realms with file format v24 (reads and upgrades file format v10 or later).
```

**File**: `packages/library-base/src/commonMain/kotlin/io/realm/kotlin/exceptions/RealmException.kt` (modified, +3/-3)
```diff
@@ -9,7 +9,7 @@ package io.realm.kotlin.exceptions
  */
 public open class RealmException : RuntimeException {
     public constructor() : super()
-    public constructor(message: String) : super(message)
-    public constructor(message: String, cause: Throwable) : super(message, cause)
-    public constructor(cause: Throwable) : super(cause)
+    public constructor(message: String?) : super(message)
+    public constructor(message: String?, cause: Throwable?) : super(message, cause)
+    public constructor(cause: Throwable?) : super(cause)
 }
```

**File**: `packages/library-sync/src/commonMain/kotlin/io/realm/kotlin/mongodb/exceptions/AppException.kt` (modified, +1/-1)
```diff
@@ -94,5 +94,5 @@ import io.realm.kotlin.exceptions.RealmException
  * @see SyncException
  */
 public open class AppException internal constructor(
-    message: String,
+    message: String?,
 ) : RealmException(message)
```

**File**: `packages/library-sync/src/commonMain/kotlin/io/realm/kotlin/mongodb/exceptions/SyncExceptions.kt` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ import io.realm.kotlin.types.RealmAny
  *
  * @see io.realm.kotlin.mongodb.sync.SyncConfiguration.Builder.errorHandler
  */
-public open class SyncException internal constructor(message: String) : AppException(message)
+public open class SyncException internal constructor(message: String?) : AppException(message)
 
 /**
  * Thrown when something has gone wrong with Device Sync in a way that is not recoverable.
@@ -60,7 +60,7 @@ public class WrongSyncTypeException internal constructor(message: String) : Sync
  * Thrown when the server does not support one or more of the queries defined in the
  * [io.realm.kotlin.mongodb.sync.SubscriptionSet].
  */
-public class BadFlexibleSyncQueryException internal constructor(message: String) :
+public class BadFlexibleSyncQueryException internal constructor(message: String?) :
     SyncException(message)
 
 /**
```

**File**: `packages/library-sync/src/commonMain/kotlin/io/realm/kotlin/mongodb/internal/SubscriptionSetImpl.kt` (modified, +1/-1)
```diff
@@ -127,7 +127,7 @@ internal class SubscriptionSetImpl<T : BaseRealm>(
                     if (result) {
                         return true
                     } else {
-                        throw BadFlexibleSyncQueryException(errorMessage!!)
+                        throw BadFlexibleSyncQueryException(errorMessage)
                     }
                 }
                 else -> throw IllegalStateException("Unexpected value: $result")
```

**File**: `packages/test-sync/src/commonTest/kotlin/io/realm/kotlin/test/mongodb/common/CredentialsTests.kt` (modified, +1/-1)
```diff
@@ -369,7 +369,7 @@ class CredentialsTests {
             payload = mapOf("mail" to TestHelper.randomEmail(), "id" to 0)
         )
 
-        assertFailsWithMessage<AuthException>("unauthorized") {
+        assertFailsWithMessage<AuthException>("Authentication failed") {
             runBlocking {
                 app.login(credentials)
             }
```

---

### Incident Patch 8: `6eae4337` (2024-06-03)
**Commit Message**: fix version name

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-## 2.0.0-SNAPSHOT (2024-06-03)
+## 2.0.0 (2024-06-03)
 
 > [!NOTE]
 > This release will bump the Realm file format 24. Opening a file with an older format will automatically upgrade it from file format v10. If you want to upgrade from an earlier file format version you will have to use Realm Kotlin v1.13.1 or earlier. Downgrading to a previous file format is not possible.
```

---

### Incident Patch 9: `ef064efc` (2024-03-26)
**Commit Message**: Remove cmake required version (#1710)

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
 - Minimum R8: 8.0.34.
 
 ### Internal
-- None
+- Remove CMake required version.
 
 ## 1.14.2-SNAPSHOT (YYYY-MM-DD)
 
```

**File**: `buildSrc/src/main/kotlin/Config.kt` (modified, +0/-3)
```diff
@@ -113,9 +113,6 @@ object Versions {
     const val atomicfu = "0.18.5" // https://github.com/Kotlin/kotlinx.atomicfu
     const val autoService = "1.0" // https://mvnrepository.com/artifact/com.google.auto.service/auto-service
     const val buildkonfig = "0.13.3" // https://github.com/yshrsmz/BuildKonfig
-    // Not currently used, so mostly here for documentation. Core requires minimum 3.15, but 3.18.1 is available through the Android SDK.
-    // Build also tested successfully with 3.21.4 (latest release).
-    const val cmake = "3.27.7"
     const val coroutines = "1.7.0" // https://mvnrepository.com/artifact/org.jetbrains.kotlinx/kotlinx-coroutines-core
     const val datetime = "0.4.0" // https://github.com/Kotlin/kotlinx-datetime
     const val detektPlugin = "1.22.0-RC2" // https://github.com/detekt/detekt
```

**File**: `packages/cinterop/build.gradle.kts` (modified, +0/-1)
```diff
@@ -328,7 +328,6 @@ android {
     // Inner externalNativeBuild (inside defaultConfig) does not seem to have correct type for setting path
     externalNativeBuild {
         cmake {
-            version = Versions.cmake
             path = project.file("src/jvm/CMakeLists.txt")
         }
     }
```

---

### Incident Patch 10: `8783d199` (2024-03-18)
**Commit Message**: Fixing doc mime type (#1696)

**File**: `packages/build.gradle.kts` (modified, +2/-0)
```diff
@@ -185,6 +185,8 @@ tasks.register("uploadDokka") {
                 commandLine = listOf(
                     "s3cmd",
                     "put",
+                    "--no-mime-magic",
+                    "--guess-mime-type",
                     "--recursive",
                     "--acl-public",
                     "--access_key=$awsAccessKey",
```

---

### Incident Patch 11: `12e94d16` (2024-03-18)
**Commit Message**: - Copying missing binaries (Win/Linux) when releasing (#1694)

- Building cinterop-jvm Linux shared library in Release mode

**File**: `.github/workflows/include-deploy-release.yml` (modified, +1/-1)
```diff
@@ -108,5 +108,5 @@ jobs:
          "${{ secrets.DOCS_S3_ACCESS_KEY }}" "${{ secrets.DOCS_S3_SECRET_KEY }}" \
          "${{ secrets.SLACK_URL_RELEASE }}" "${{ secrets.SLACK_URL_CI }}" \
          "${{ secrets.GRADLE_PORTAL_KEY }}" "${{ secrets.GRADLE_PORTAL_SECRET }}" \
-         '-PsignBuild=true -PsignSecretRingFileKotlin="${{ secrets.GPG_SIGNING_KEY_BASE_64_DBG }}" -PsignPasswordKotlin=${{ secrets.GPG_PASS_PHRASE_DBG }}'
+         '-PsignBuild=true -PsignSecretRingFileKotlin="${{ secrets.GPG_SIGNING_KEY_BASE_64_DBG }}" -PsignPasswordKotlin=${{ secrets.GPG_PASS_PHRASE_DBG }} -Prealm.kotlin.copyNativeJvmLibs=linux,windows'
         
```

**File**: `.github/workflows/pr.yml` (modified, +5/-1)
```diff
@@ -145,7 +145,11 @@ jobs:
             rm -rf realmLinuxBuild
             mkdir realmLinuxBuild
             cd realmLinuxBuild
-            cmake ../../src/jvm
+            cmake -DCMAKE_BUILD_TYPE=Release \
+            -DREALM_ENABLE_SYNC=1 \
+            -DREALM_NO_TESTS=1 \
+            -DREALM_BUILD_LIB_ONLY=true \
+            ../../src/jvm
             make -j8
 
       - name: Upload artifacts
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 
 ### Enhancements
 
-- None.
+- Fixes missing binaries files for Windows and Linux platforms when releasing. (Issue [#1671](https://github.com/realm/realm-kotlin/issues/1690) [JIRA](https://jira.mongodb.org/browse/RKOTLIN-1037))
 
 ### Fixed
 
```

---

### Incident Patch 12: `68308aa5` (2024-03-18)
**Commit Message**: Fix list indexof, remove and contains (#1666)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ This release will bump the Realm file format from version 23 to 24. Opening a fi
 * [Sync] Added option to use managed WebSockets via OkHttp instead of Realm's built-in WebSocket client for Sync traffic (Only Android and JVM targets for now). Managed WebSockets offer improved support for proxies and firewalls that require authentication. This feature is currently opt-in and can be enabled by using `AppConfiguration.usePlatformNetworking()`. Managed WebSockets will become the default in a future version. (PR [#1528](https://github.com/realm/realm-kotlin/pull/1528)).
 * `AutoClientResetFailed` exception now reports as the throwable cause any user exceptions that might occur during a client reset. (Issue [#1580](https://github.com/realm/realm-kotlin/issues/1580))
 * The Unpacking of JVM native library will use the current library version instead of a calculated hash for the path. (Issue [#1617](https://github.com/realm/realm-kotlin/issues/1617)).
+* Optimized `RealmList.indexOf()` and `RealmList.contains()` using Core implementation of operations instead of iterating elements and comparing them in Kotlin. (Issue [#1625](https://github.com/realm/realm-kotlin/pull/1666) [RKOTLIN-995](https://jira.mongodb.org/browse/RKOTLIN-995)).
 
 ### Fixed
 * Cache notification callback JNI references at startup to ensure that symbols can be resolved in core callbacks. (Issue [#1577](https://github.com/realm/realm-kotlin/issues/1577))
```

**File**: `packages/cinterop/src/commonMain/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +3/-0)
```diff
@@ -55,6 +55,8 @@ expect val INVALID_PROPERTY_KEY: PropertyKey
 const val OBJECT_ID_BYTES_SIZE = 12
 const val UUID_BYTES_SIZE = 16
 
+const val INDEX_NOT_FOUND = -1L
+
 // Pure marker interfaces corresponding to the C-API realm_x_t struct types
 interface CapiT
 interface RealmConfigT : CapiT
@@ -317,6 +319,7 @@ expect object RealmInterop {
     fun realm_get_backlinks(obj: RealmObjectPointer, sourceClassKey: ClassKey, sourcePropertyKey: PropertyKey): RealmResultsPointer
     fun realm_list_size(list: RealmListPointer): Long
     fun MemAllocator.realm_list_get(list: RealmListPointer, index: Long): RealmValue
+    fun realm_list_find(list: RealmListPointer, value: RealmValue): Long
     fun realm_list_get_list(list: RealmListPointer, index: Long): RealmListPointer
     fun realm_list_get_dictionary(list: RealmListPointer, index: Long): RealmMapPointer
     fun realm_list_add(list: RealmListPointer, index: Long, transport: RealmValue)
```

**File**: `packages/cinterop/src/jvm/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +12/-0)
```diff
@@ -568,6 +568,18 @@ actual object RealmInterop {
         realmc.realm_list_get(list.cptr(), index, struct)
         return RealmValue(struct)
     }
+
+    actual fun realm_list_find(list: RealmListPointer, value: RealmValue): Long {
+        val index = LongArray(1)
+        val found = BooleanArray(1)
+        realmc.realm_list_find(list.cptr(), value.value, index, found)
+        return if (found[0]) {
+            index[0]
+        } else {
+            INDEX_NOT_FOUND
+        }
+    }
+
     actual fun realm_list_get_list(list: RealmListPointer, index: Long): RealmListPointer =
         LongPointerWrapper(realmc.realm_list_get_list(list.cptr(), index))
 
```

**File**: `packages/cinterop/src/nativeDarwin/kotlin/io/realm/kotlin/internal/interop/RealmInterop.kt` (modified, +13/-0)
```diff
@@ -1038,6 +1038,19 @@ actual object RealmInterop {
         return RealmValue(struct)
     }
 
+    actual fun realm_list_find(list: RealmListPointer, value: RealmValue): Long {
+        memScoped {
+            val index = alloc<ULongVar>()
+            val found = alloc<BooleanVar>()
+            checkedBooleanResult(realm_wrapper.realm_list_find(list.cptr(), value.value.readValue(), index.ptr, found.ptr))
+            return if (found.value) {
+                index.value.toLong()
+            } else {
+                INDEX_NOT_FOUND
+            }
+        }
+    }
+
     actual fun realm_list_get_list(list: RealmListPointer, index: Long): RealmListPointer =
         CPointerWrapper(realm_wrapper.realm_list_get_list(list.cptr(), index.toULong()))
 
```

**File**: `packages/library-base/src/commonMain/kotlin/io/realm/kotlin/internal/RealmListInternal.kt` (modified, +58/-0)
```diff
@@ -20,6 +20,7 @@ import io.realm.kotlin.UpdatePolicy
 import io.realm.kotlin.Versioned
 import io.realm.kotlin.dynamic.DynamicRealmObject
 import io.realm.kotlin.ext.asRealmObject
+import io.realm.kotlin.ext.isManaged
 import io.realm.kotlin.internal.RealmValueArgumentConverter.convertToQueryArgs
 import io.realm.kotlin.internal.interop.Callback
 import io.realm.kotlin.internal.interop.ClassKey
@@ -50,6 +51,8 @@ import kotlinx.coroutines.channels.ProducerScope
 import kotlinx.coroutines.flow.Flow
 import kotlin.reflect.KClass
 
+internal const val INDEX_NOT_FOUND = io.realm.kotlin.internal.interop.INDEX_NOT_FOUND
+
 /**
  * Implementation for unmanaged lists, backed by a [MutableList].
  */
@@ -90,10 +93,22 @@ internal class ManagedRealmList<E>(
         return operator.get(index)
     }
 
+    override fun contains(element: E): Boolean {
+        return operator.contains(element)
+    }
+
+    override fun indexOf(element: E): Int {
+        return operator.indexOf(element)
+    }
+
     override fun add(index: Int, element: E) {
         operator.insert(index, element)
     }
 
+    override fun remove(element: E): Boolean {
+        return operator.remove(element)
+    }
+
     // We need explicit overrides of these to ensure that we capture duplicate references to the
     // same unmanaged object in our internal import caching mechanism
     override fun addAll(elements: Collection<E>): Boolean = operator.insertAll(size, elements)
@@ -225,6 +240,10 @@ internal interface ListOperator<E> : CollectionOperator<E, RealmListPointer> {
 
     fun get(index: Int): E
 
+    fun contains(element: E): Boolean = indexOf(element) != -1
+
+    fun indexOf(element: E): Int
+
     // TODO OPTIMIZE We technically don't need update policy and cache for primitive lists but right now RealmObjectHelper.assign doesn't know how to differentiate the calls to the operator
     fun insert(
         index: Int,
@@ -233,6 +252,14 @@ internal interface ListOperator<E> : CollectionOperator<E, RealmListPointer> {
         cache: UnmanagedToManagedObjectCache = mutableMapOf()
     )
 
+    fun remove(element: E): Boolean = when (val index = indexOf(element)) {
+        -1 -> false
+        else -> {
+            RealmInterop.realm_list_erase(nativePointer, index.toLong())
+            true
+        }
+    }
+
     fun insertAll(
         index: Int,
         elements: Collection<E>,
@@ -277,6 +304,14 @@ internal class PrimitiveListOperator<E>(
         }
     }
 
+    override fun indexOf(element: E): Int {
+        inputScope {
+            with(realmValueConverter) {
+                return RealmInterop.realm_list_find(nativePointer, publicToRealmValue(element)).toInt()
+            }
+        }
+    }
+
     override fun insert(
         index: Int,
         element: E,
@@ -354,6 +389,17 @@ internal class RealmAnyListOperator(
         }
     }
 
+    override fun indexOf(element: RealmAny?): Int {
+        // Unmanaged objects are never found in a managed collections
+        if (element?.type == RealmAny.Type.OBJECT) {
+            if (!element.asRealmObject<RealmObjectInternal>().isManaged()) return -1
+        }
+        return inputScope {
+            val transport = realmAnyToRealmValueWithoutImport(element)
+            RealmInterop.realm_list_find(nativePointer, transport).toInt()
+        }
+    }
+
     override fun insert(
         index: Int,
         element: RealmAny?,
@@ -461,6 +507,18 @@ internal abstract class BaseRealmObjectListOperator<E : BaseRealmObject?> (
             realmValueToRealmObject(transport, clazz, mediator, realmReference) as E
         }
     }
+
+    override fun indexOf(element: E): Int {
+        // Unmanaged objects are never found in a managed collections
+        element?.also {
+            if (!(it as RealmObjectInternal).isManaged()) return -1
+        }
+        return inputScope {
+            val objRef = realmObjectToRealmReferenceOrError(element as BaseRealmObject?)
+            val transport = realmObjectTransport(objRef as RealmObjectInterop)
+            RealmInterop.realm_list_find(nativePointer, transport).toInt()
+        }
+    }
 }
 
 internal class RealmObjectListOperator<E : BaseRealmObject?>(
```

**File**: `packages/test-base/src/commonTest/kotlin/io/realm/kotlin/test/common/RealmAnyNestedCollectionTests.kt` (modified, +10/-0)
```diff
@@ -573,6 +573,9 @@ class RealmAnyNestedCollectionTests {
         realm.query<JsonStyleRealmObject>("value[*] == 4").find().single().run {
             assertEquals("LIST", id)
         }
+        realm.query<JsonStyleRealmObject>("value[*] == {4, 5, 6}").find().single().run {
+            assertEquals("LIST", id)
+        }
 
         // Matching dictionaries
         realm.query<JsonStyleRealmObject>("value.key1 == 7").find().single().run {
@@ -606,5 +609,12 @@ class RealmAnyNestedCollectionTests {
         realm.query<JsonStyleRealmObject>("value[*].key3[0] == 9").find().single().run {
             assertEquals("EMBEDDED", id)
         }
+        realm.query<JsonStyleRealmObject>("value[0][*] == {4, 5, 6}").find().single().run {
+            assertEquals("EMBEDDED", id)
+        }
+        // FIXME Core issue https://github.com/realm/realm-core/issues/7393
+        // realm.query<JsonStyleRealmObject>("value[*][*] == {4, 5, 6}").find().single().run {
+        //    assertEquals("EMBEDDED", id)
+        // }
     }
 }
```

**File**: `packages/test-base/src/commonTest/kotlin/io/realm/kotlin/test/common/RealmListTests.kt` (modified, +0/-39)
```diff
@@ -722,13 +722,6 @@ class RealmListTests : EmbeddedObjectCollectionQueryTests {
                     ),
                     classifier
                 )
-                ByteArray::class -> ByteArrayListTester(
-                    realm = realm,
-                    typeSafetyManager = getTypeSafety(
-                        classifier,
-                        elementType.nullable
-                    ) as ListTypeSafetyManager<ByteArray?>
-                )
                 RealmAny::class -> RealmAnyListTester(
                     realm = realm,
                     typeSafetyManager = ListTypeSafetyManager(
@@ -1368,38 +1361,6 @@ internal class RealmObjectListTester(
         assertEquals(expected.stringField, actual.stringField)
 }
 
-/**
- * Check equality for ByteArrays at a structural level with `assertContentEquals`.
- */
-internal class ByteArrayListTester(
-    realm: Realm,
-    typeSafetyManager: ListTypeSafetyManager<ByteArray?>
-) : ManagedListTester<ByteArray?>(realm, typeSafetyManager, ByteArray::class) {
-    override fun assertElementsAreEqual(expected: ByteArray?, actual: ByteArray?) =
-        assertContentEquals(expected, actual)
-
-    // Removing elements using equals/hashcode will fail for byte arrays since they are
-    // are only equal if identical
-    override fun remove() {
-        val dataSet = typeSafetyManager.dataSetToLoad
-        val assertions = { list: RealmList<ByteArray?> ->
-            assertFalse(list.isEmpty())
-        }
-
-        errorCatcher {
-            realm.writeBlocking {
-                val list = typeSafetyManager.createContainerAndGetCollection(this)
-                assertFalse(list.remove(dataSet[0]))
-                assertTrue(list.add(dataSet[0]))
-                assertFalse(list.remove(list.last()))
-                assertions(list)
-            }
-        }
-
-        assertListAndCleanup { list -> assertions(list) }
-    }
-}
-
 // -----------------------------------
 // Data used to initialize structures
 // -----------------------------------
```

**File**: `packages/test-base/src/commonTest/kotlin/io/realm/kotlin/test/common/notifications/RealmAnyNestedListNotificationTest.kt` (modified, +96/-0)
```diff
@@ -19,6 +19,8 @@ package io.realm.kotlin.test.common.notifications
 import io.realm.kotlin.Realm
 import io.realm.kotlin.RealmConfiguration
 import io.realm.kotlin.entities.JsonStyleRealmObject
+import io.realm.kotlin.ext.asRealmObject
+import io.realm.kotlin.ext.realmAnyDictionaryOf
 import io.realm.kotlin.ext.realmAnyListOf
 import io.realm.kotlin.ext.realmAnyOf
 import io.realm.kotlin.internal.platform.runBlocking
@@ -30,6 +32,7 @@ import io.realm.kotlin.test.common.utils.DeletableEntityNotificationTests
 import io.realm.kotlin.test.common.utils.FlowableTests
 import io.realm.kotlin.test.platform.PlatformUtils
 import io.realm.kotlin.test.util.receiveOrFail
+import io.realm.kotlin.test.util.trySendOrFail
 import io.realm.kotlin.types.RealmAny
 import kotlinx.coroutines.async
 import kotlinx.coroutines.channels.Channel
@@ -252,4 +255,97 @@ class RealmAnyNestedListNotificationTest : FlowableTests, DeletableEntityNotific
     override fun closeRealmInsideFlowThrows() {
         TODO("Not yet implemented")
     }
+
+    @Test
+    @Ignore // https://github.com/realm/realm-core/issues/7264
+    fun eventsOnObjectChangesInRealmAnyList() {
+        kotlinx.coroutines.runBlocking {
+            val channel = Channel<ListChange<RealmAny?>>(10)
+            val parent =
+                realm.write {
+                    copyToRealm(JsonStyleRealmObject().apply { value = realmAnyListOf() })
+                }
+
+            val listener = async {
+                parent.value!!.asList().asFlow().collect {
+                    channel.trySendOrFail(it)
+                }
+            }
+
+            channel.receiveOrFail(message = "Initial event").let { assertIs<InitialList<*>>(it) }
+
+            realm.write {
+                val asList = findLatest(parent)!!.value!!.asList()
+                println(asList.size)
+                asList.add(
+                    RealmAny.create(JsonStyleRealmObject().apply { id = "CHILD" })
+                )
+            }
+            channel.receiveOrFail(message = "List add").let {
+                assertIs<UpdatedList<*>>(it)
+                assertEquals(1, it.list.size)
+            }
+
+            realm.write {
+                findLatest(parent)!!.value!!.asList()[0]!!.asRealmObject<JsonStyleRealmObject>().value =
+                    RealmAny.create("TEST")
+            }
+            channel.receiveOrFail(message = "Object updated").let {
+                assertIs<UpdatedList<*>>(it)
+                assertEquals(1, it.list.size)
+                assertEquals(
+                    "TEST",
+                    it.list[0]!!.asRealmObject<JsonStyleRealmObject>().value!!.asString()
+                )
+            }
+
+            listener.cancel()
+        }
+    }
+
+    @Test
+    fun eventsOnDictionaryChangesInRealmAnyList() {
+        kotlinx.coroutines.runBlocking {
+            val channel = Channel<ListChange<RealmAny?>>(10)
+            val parent =
+                realm.write {
+                    copyToRealm(JsonStyleRealmObject().apply { value = realmAnyListOf() })
+                }
+
+            val listener = async {
+                parent.value!!.asList().asFlow().collect {
+                    channel.trySendOrFail(it)
+                }
+            }
+
+            channel.receiveOrFail(message = "Initial event").let { assertIs<InitialList<*>>(it) }
+
+            realm.write {
+                val asList = findLatest(parent)!!.value!!.asList()
+                println(asList.size)
+                asList.add(
+                    realmAnyDictionaryOf(
+                        "key1" to "value1"
+                    )
+                )
+            }
+            channel.receiveOrFail(message = "List add").let {
+                assertIs<UpdatedList<*>>(it)
+                assertEquals(1, it.list.size)
+                assertEquals(RealmAny.Type.DICTIONARY, it.list[0]!!.type)
+            }
+
+            realm.write {
+                findLatest(parent)!!.value!!.asList()[0]!!.asDictionary()["key1"] =
+                    RealmAny.create("TEST")
+            }
+            channel.receiveOrFail(message = "Object updated").let {
+                assertIs<UpdatedList<*>>(it)
+                assertEquals(1, it.list.size)
+                assertEquals("TEST", it.list[0]!!.asDictionary()["key1"]!!.asString())
+            }
+
+            listener.cancel()
+        }
+    }
 }
```

---

### Incident Patch 13: `4b9c64a0` (2024-03-08)
**Commit Message**: Fixing release script  (#1683)

**File**: `tools/publish_release.sh` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ check_env() {
 
 verify_release_preconditions() {
   echo "Checking release branch..."
+  git fetch --tags
   gitTag=`git describe --tags | tr -d '[:space:]'`
   version=`grep "const val version" buildSrc/src/main/kotlin/Config.kt | cut -d \" -f2`
 
```

---

### Incident Patch 14: `19c2474c` (2024-03-08)
**Commit Message**: Fixing GHA check-release logic (#1681)

**File**: `.github/workflows/pr.yml` (modified, +2/-4)
```diff
@@ -1655,15 +1655,13 @@ jobs:
     steps:
       - uses: actions/checkout@v3
 
-      - name: Get Git tag
+      - name: Check if release build
+        id: check_release
         run: |
           git fetch --tags
           gitTag=$(git describe --tags --exact-match HEAD) || echo "NONE"
           echo "Git branch/tag: ${GITHUB_REF}/${gitTag:-'none'}"
 
-      - name: Check if release build
-        id: check_release
-        run: |
           if [[ -z "$gitTag" ]]; then
             gitSha=$(git rev-parse HEAD | cut -c1-8)
             echo "Building commit: ${{ needs.check-cache.outputs.version-label }} - ${gitSha}"
```

---

### Incident Patch 15: `c3a7fba0` (2024-03-07)
**Commit Message**: Guard analytics errors from breaking build (#1664)

**File**: `.github/workflows/include-integration-tests.yml` (modified, +5/-0)
```diff
@@ -7,6 +7,11 @@ on:
         required: true
         type: string
 
+env:
+  REALM_DISABLE_ANALYTICS: true
+  REALM_PRINT_ANALYTICS: true
+  REALM_FAIL_ON_ANALYTICS_ERRORS: true
+
 jobs:
 
   # TODO: The Monkey seems to crash the app all the time, but with failures that are not coming from the app. Figure out why.
```

**File**: `.github/workflows/pr.yml` (modified, +5/-4)
```diff
@@ -15,6 +15,7 @@ concurrency:
 
 env:
   REALM_DISABLE_ANALYTICS: true
+  REALM_PRINT_ANALYTICS: true
   CMAKE_C_COMPILER: /usr/local/bin/ccache-clang
   CMAKE_CXX_COMPILER: /usr/local/bin/ccache-clang++
   # Workflow environment variables are not available in Job if statements: https://github.com/actions/runner/issues/1661
@@ -227,11 +228,11 @@ jobs:
     runs-on: macos-latest
     needs: [check-cache, build-jni-swig-stub]
     if: |
-      always() && 
-      !cancelled() && 
-      !contains(needs.*.result, 'failure') && 
+      always() &&
+      !cancelled() &&
+      !contains(needs.*.result, 'failure') &&
       !contains(needs.*.result, 'cancelled') &&
-      needs.check-cache.outputs.jni-windows-lib-cache-hit != 'true'
+      needs.check-cache.outputs.jni-macos-lib-cache-hit != 'true'
 
     steps:
       - name: Checkout code
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@
 * Cache notification callback JNI references at startup to ensure that symbols can be resolved in core callbacks. (Issue [#1577](https://github.com/realm/realm-kotlin/issues/1577))
 * Using `Realm.asFlow()` could miss an update if a write was started right after opening the Realm. (Issue [#1582](https://github.com/realm/realm-kotlin/issues/1582)) 
 * Snapshot publishing with Github Action. (Issue [#1654](https://github.com/realm/realm-kotlin/issues/1654) [JIRA](https://jira.mongodb.org/browse/RKOTLIN-1018))
+* Guarded analytic errors so that they do not fail user builds.
 * [Sync] `NullPointerException` while waiting for the synchronization of a subscription set if the client was set in `AwaitingMark` state. (Issue [#1671](https://github.com/realm/realm-kotlin/issues/1671) [JIRA](https://jira.mongodb.org/browse/RKOTLIN-1027))
 
 ### Compatibility
```

**File**: `packages/gradle-plugin/src/main/kotlin/io/realm/kotlin/gradle/RealmCompilerSubplugin.kt` (modified, +40/-17)
```diff
@@ -217,18 +217,23 @@ class RealmCompilerSubplugin : KotlinCompilerPluginSupportPlugin, AnalyticsError
             options.add(SubpluginOption(key = featureListPathKey, featureListPath))
 
             // Gather target specific information
-            val targetInfo: TargetInfo? = gatherTargetInfo(kotlinCompilation)
+            val targetInfo: TargetInfo? = muteErrors {
+                gatherTargetInfo(kotlinCompilation)
+            }
+
             // If we have something to submit register it for submission after the compilation has
             // gathered the feature list information
             targetInfo?.let {
                 kotlinCompilation.compileTaskProvider.get().doLast {
-                    val analyticsService = provider.get()
-                    val json = analyticsService.toJson(targetInfo)
-                    if (printAnalytics) {
-                        analyticsService.print(json)
-                    }
-                    if (submitAnalytics) {
-                        analyticsService.submit(json)
+                    muteErrors {
+                        val analyticsService = provider.get()
+                        val json = analyticsService.toJson(targetInfo)
+                        if (printAnalytics) {
+                            analyticsService.print(json)
+                        }
+                        if (submitAnalytics) {
+                            analyticsService.submit(json)
+                        }
                     }
                 }
             }
@@ -237,6 +242,20 @@ class RealmCompilerSubplugin : KotlinCompilerPluginSupportPlugin, AnalyticsError
             options
         }
     }
+
+    /**
+     * Wrapper that ignores error if `failOnAnalyticsError=true`.
+     */
+    private fun <R> muteErrors(block: () -> R): R? {
+        return try {
+            block()
+        } catch (e: Throwable) {
+            when {
+                failOnAnalyticsError -> { throw e }
+                else -> { null }
+            }
+        }
+    }
 }
 
 /**
@@ -336,15 +355,19 @@ fun nativeTarget(target: KonanTarget) = when (target.family) {
 }
 
 // Helper method to ensure that we align architecture strings for Kotlin native builds
-fun nativeArch(target: KonanTarget) = when (target.architecture) {
-    Architecture.X64 -> io.realm.kotlin.gradle.analytics.Architecture.X64.serializedName
-    Architecture.X86 -> io.realm.kotlin.gradle.analytics.Architecture.X86.serializedName
-    Architecture.ARM64 -> io.realm.kotlin.gradle.analytics.Architecture.ARM64.serializedName
-    Architecture.ARM32 -> io.realm.kotlin.gradle.analytics.Architecture.ARM.serializedName
-    Architecture.MIPS32 -> "Mips"
-    Architecture.MIPSEL32 -> "MipsEL32"
-    Architecture.WASM32 -> "Wasm"
-    else -> unknown(target.architecture.name)
+fun nativeArch(target: KonanTarget): String = try {
+    when (target.architecture) {
+        Architecture.X64 -> io.realm.kotlin.gradle.analytics.Architecture.X64.serializedName
+        Architecture.X86 -> io.realm.kotlin.gradle.analytics.Architecture.X86.serializedName
+        Architecture.ARM64 -> io.realm.kotlin.gradle.analytics.Architecture.ARM64.serializedName
+        Architecture.ARM32 -> io.realm.kotlin.gradle.analytics.Architecture.ARM.serializedName
+        Architecture.MIPS32 -> "Mips"
+        Architecture.MIPSEL32 -> "MipsEL32"
+        Architecture.WASM32 -> "Wasm"
+        else -> unknown(target.architecture.name)
+    }
+} catch (e: Throwable) {
+    unknown(target.architecture.name)
 }
 
 // Helper method to ensure that we align architecture strings for Android platforms
```

#### Recent Merged Pull Requests:
- **PR #1873** (2025-09-23): DOCSP-53342: Add converted .md docs to source code repo /docs dir for community access (@cbullinger)
- **PR #1872** (closed): Update kotlin 2.2.0 (@meladRaouf)
- **PR #1864** (closed): Fixed compilation with Kotlin 2.1.21 (@Besik13)
- **PR #1850** (2025-01-20): [RKOTLIN-1137] Fix incorrect currentTime() for Android devices on API 25 and blow (@stavfx)
- **PR #1842** (closed): Test compiler plugin on ci (@clementetb)
- **PR #1839** (2024-10-03): Remove Sync (@clementetb)
- **PR #1837** (2024-09-16): [Automated] Merge releases into main (@github-actions[bot])
- **PR #1836** (closed): Release 2 2 0 manually [DO NOT MERGE] (@nhachicha)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
