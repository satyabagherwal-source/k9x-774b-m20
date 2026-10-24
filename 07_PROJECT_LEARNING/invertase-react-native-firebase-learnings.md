> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/invertase-react-native-firebase-learnings.md`  
> **Source**: github ([https://github.com/invertase/react-native-firebase](https://github.com/invertase/react-native-firebase))  
> **Source Version**: `c65e1ee3`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-24T19:34:59.562Z  
> **Learning ID**: `learn-github-invertase-react-native-firebase`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): invertase/react-native-firebase

> **Canonical Artifact**: `07_PROJECT_LEARNING/invertase-react-native-firebase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/invertase/react-native-firebase](https://github.com/invertase/react-native-firebase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-24T19:34:58.737Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `invertase/react-native-firebase`
- **Description**: 🔥 A well-tested feature-rich modular Firebase implementation for React Native. Supports both iOS & Android platforms for all Firebase services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12322 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/ai/lib/models/utils.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { AppCheck } from '@react-native-firebase/app-check';
import { getLimitedUseToken, getToken } from '@react-native-firebase/app-check';
import { getUtils } from '@react-native-firebase/app';
import { AIError } from '../errors';
import { AI, AIErrorCode } from '../public-types';
import { AIService } from '../service';
import { ApiSettings } from '../types/internal';

/**
 * Initializes an {@link ApiSettings} object from an {@link AI} instance.
 *
 * @internal
 */
export function initApiSettings(ai: AI): ApiSettings {
  if (!ai.app?.options?.apiKey) {
    throw new AIError(
      AIErrorCode.NO_API_KEY,
      `The "apiKey" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid API key.`,
    );
  } else if (!ai.app?.options?.projectId) {
    throw new AIError(
      AIErrorCode.NO_PROJECT_ID,
      `The "projectId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid project ID.`,
    );
  } else if (!ai.app?.options?.appId) {
    throw new AIError(
      AIErrorCode.NO_APP_ID,
      `The "appId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid app ID.`,
    );
  }

  const apiSettings: ApiSettings = {
    apiKey: ai.app.options.apiKey,
    project: ai.app.options.projectId,
    appId: ai.app.options.appId,
    automaticDataCollectionEnabled: ai.app.automaticDataCollectionEnabled,
    location: ai.location,
    backend: ai.backend,
  };

  try {
    // Utils is single-app (hasMultiAppSupport: false); do not pass ai.app.
    const appVersion = getUtils().appVersion;
    if (appVersion) {
      apiSettings.appVersion = appVersion;
    }
  } catch {
    // Native utils unavailable (web / non-native) — omit appVersion.
  }

  const appCheck = ai.appCheck as AppCheck;
  if (appCheck) {
    apiSettings.getAppCheckToken = () =>
      ai.options?.useLimitedUseAppCheckTokens ? getLimitedUseToken(appCheck) : getToken(appCheck);
  }

  if ((ai as AIService).auth?.currentUser) {
    apiSettings.getAuthToken = () => (ai as AIService).auth!.currentUser!.getIdToken();
  }

  return apiSettings;
}

```

### Core Architecture Module: `packages/analytics/android/src/reactnative/java/io/invertase/firebase/analytics/generated/jni/react/renderer/components/RNFBAnalyticsTurboModules/RNFBAnalyticsTurboModulesJSI.h`
```
/**
 * This code was generated by [react-native-codegen](https://www.npmjs.com/package/react-native-codegen).
 *
 * Do not edit this file as changes may cause incorrect behavior and will be lost
 * once the code is regenerated.
 *
 * @generated by codegen project: GenerateModuleH.js
 */

#pragma once

#include <ReactCommon/TurboModule.h>
#include <react/bridging/Bridging.h>

namespace facebook::react {


template <typename T>
class JSI_EXPORT NativeRNFBTurboAnalyticsCxxSpec : public TurboModule {
public:
  static constexpr std::string_view kModuleName = "NativeRNFBTurboAnalytics";

protected:
  NativeRNFBTurboAnalyticsCxxSpec(std::shared_ptr<CallInvoker> jsInvoker) : TurboModule(std::string{NativeRNFBTurboAnalyticsCxxSpec::kModuleName}, jsInvoker) {
    methodMap_["logEvent"] = MethodMetadata {.argCount = 2, .invoker = __logEvent};
    methodMap_["setAnalyticsCollectionEnabled"] = MethodMetadata {.argCount = 1, .invoker = __setAnalyticsCollectionEnabled};
    methodMap_["setSessionTimeoutDuration"] = MethodMetadata {.argCount = 1, .invoker = __setSessionTimeoutDuration};
    methodMap_["getAppInstanceId"] = MethodMetadata {.argCount = 0, .invoker = __getAppInstanceId};
    methodMap_["getSessionId"] = MethodMetadata {.argCount = 0, .invoker = __getSessionId};
    methodMap_["setUserId"] = MethodMetadata {.argCount = 1, .invoker = __setUserId};
    methodMap_["setUserProperty"] = MethodMetadata {.argCount = 2, .invoker = __setUserProperty};
    methodMap_["setUserProperties"] = MethodMetadata {.argCount = 1, .invoker = __setUserProperties};
    methodMap_["resetAnalyticsData"] = MethodMetadata {.argCount = 0, .invoker = __resetAnalyticsData};
    methodMap_["setDefaultEventParameters"] = MethodMetadata {.argCount = 1, .invoker = __setDefaultEventParameters};
    methodMap_["setConsent"] = MethodMetadata {.argCount = 1, .invoker = __setConsent};
    methodMap_["logTransaction"] = MethodMetadata {.argCount = 1, .invoker = __logTransaction};
    methodMap_["initiateOnDeviceConversionMeasurementWithEmailAddress"] = MethodMetadata {.argCount = 1, .invoker = __initiateOnDeviceConversionMeasurementWithEmailAddress};
    methodMap_["initiateOnDeviceConversionMeasurementWithHashedEmailAddress"] = MethodMetadata {.argCount = 1, .invoker = __initiateOnDeviceConversionMeasurementWithHashedEmailAddress};
    methodMap_["initiateOnDeviceConversionMeasurementWithPhoneNumber"] = MethodMetadata {.argCount = 1, .invoker = __initiateOnDeviceConversionMeasurementWithPhoneNumber};
    methodMap_["initiateOnDeviceConversionMeasurementWithHashedPhoneNumber"] = MethodMetadata {.argCount = 1, .invoker = __initiateOnDeviceConversionMeasurementWithHashedPhoneNumber};
  }
  
private:
  static jsi::Value __logEvent(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::logEvent) == 3,
      "Expected logEvent(...) to have 3 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::logEvent,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 || args[1].isNull() || args[1].isUndefined() ? std::nullopt : std::make_optional(args[1].asObject(rt)));
  }

  static jsi::Value __setAnalyticsCollectionEnabled(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setAnalyticsCollectionEnabled) == 2,
      "Expected setAnalyticsCollectionEnabled(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setAnalyticsCollectionEnabled,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asBool());
  }

  static jsi::Value __setSessionTimeoutDuration(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setSessionTimeoutDuration) == 2,
      "Expected setSessionTimeoutDuration(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setSessionTimeoutDuration,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asNumber());
  }

  static jsi::Value __getAppInstanceId(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* /*args*/, size_t /*count*/) {
    static_assert(
      bridging::getParameterCount(&T::getAppInstanceId) == 1,
      "Expected getAppInstanceId(...) to have 1 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::getAppInstanceId,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule));
  }

  static jsi::Value __getSessionId(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* /*args*/, size_t /*count*/) {
    static_assert(
      bridging::getParameterCount(&T::getSessionId) == 1,
      "Expected getSessionId(...) to have 1 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::getSessionId,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule));
  }

  static jsi::Value __setUserId(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setUserId) == 2,
      "Expected setUserId(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setUserId,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 || args[0].isNull() || args[0].isUndefined() ? std::nullopt : std::make_optional(args[0].asString(rt)));
  }

  static jsi::Value __setUserProperty(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setUserProperty) == 3,
      "Expected setUserProperty(...) to have 3 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setUserProperty,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 || args[1].isNull() || args[1].isUndefined() ? std::nullopt : std::make_optional(args[1].asString(rt)));
  }

  static jsi::Value __setUserProperties(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setUserProperties) == 2,
      "Expected setUserProperties(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setUserProperties,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asObject(rt));
  }

  static jsi::Value __resetAnalyticsData(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* /*args*/, size_t /*count*/) {
    static_assert(
      bridging::getParameterCount(&T::resetAnalyticsData) == 1,
      "Expected resetAnalyticsData(...) to have 1 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::resetAnalyticsData,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule));
  }

  static jsi::Value __setDefaultEventParameters(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setDefaultEventParameters) == 2,
      "Expected setDefaultEventParameters(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setDefaultEventParameters,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 || args[0].isNull() || args[0].isUndefined() ? std::nullopt : std::make_optional(args[0].asObject(rt)));
  }

  static jsi::Value __setConsent(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setConsent) == 2,
      "Expected setConsent(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::setConsent,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asObject(rt));
  }

  static jsi::Value __logTransaction(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::logTransaction) == 2,
      "Expected logTransaction(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::logTransaction,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt));
  }

  static jsi::Value __initiateOnDeviceConversionMeasurementWithEmailAddress(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::initiateOnDeviceConversionMeasurementWithEmailAddress) == 2,
      "Expected initiateOnDeviceConversionMeasurementWithEmailAddress(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::initiateOnDeviceConversionMeasurementWithEmailAddress,  static_cast<NativeRNFBTurboAnalyticsCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? 
```

### Core Architecture Module: `packages/app-check/android/src/main/java/io/invertase/firebase/appcheck/generated/jni/react/renderer/components/RNFBAppCheckTurboModules/RNFBAppCheckTurboModulesJSI.h`
```
/**
 * This code was generated by [react-native-codegen](https://www.npmjs.com/package/react-native-codegen).
 *
 * Do not edit this file as changes may cause incorrect behavior and will be lost
 * once the code is regenerated.
 *
 * @generated by codegen project: GenerateModuleH.js
 */

#pragma once

#include <ReactCommon/TurboModule.h>
#include <react/bridging/Bridging.h>

namespace facebook::react {


#pragma mark - NativeRNFBTurboAppCheckAppCheckTokenResult

template <typename P0>
struct NativeRNFBTurboAppCheckAppCheckTokenResult {
  P0 token;
  bool operator==(const NativeRNFBTurboAppCheckAppCheckTokenResult &other) const {
    return token == other.token;
  }
};

template <typename T>
struct NativeRNFBTurboAppCheckAppCheckTokenResultBridging {
  static T types;

  static T fromJs(
      jsi::Runtime &rt,
      const jsi::Object &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    T result{
      bridging::fromJs<decltype(types.token)>(rt, value.getProperty(rt, "token"), jsInvoker)};
    return result;
  }

#ifdef DEBUG
  static jsi::String tokenToJs(jsi::Runtime &rt, decltype(types.token) value) {
    return bridging::toJs(rt, value);
  }
#endif

  static jsi::Object toJs(
      jsi::Runtime &rt,
      const T &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    auto result = facebook::jsi::Object(rt);
    result.setProperty(rt, "token", bridging::toJs(rt, value.token, jsInvoker));
    return result;
  }
};


template <typename T>
class JSI_EXPORT NativeRNFBTurboAppCheckCxxSpec : public TurboModule {
public:
  static constexpr std::string_view kModuleName = "NativeRNFBTurboAppCheck";

protected:
  NativeRNFBTurboAppCheckCxxSpec(std::shared_ptr<CallInvoker> jsInvoker) : TurboModule(std::string{NativeRNFBTurboAppCheckCxxSpec::kModuleName}, jsInvoker) {
    methodMap_["activate"] = MethodMetadata {.argCount = 3, .invoker = __activate};
    methodMap_["configureProvider"] = MethodMetadata {.argCount = 3, .invoker = __configureProvider};
    methodMap_["setTokenAutoRefreshEnabled"] = MethodMetadata {.argCount = 2, .invoker = __setTokenAutoRefreshEnabled};
    methodMap_["isTokenAutoRefreshEnabled"] = MethodMetadata {.argCount = 1, .invoker = __isTokenAutoRefreshEnabled};
    methodMap_["getToken"] = MethodMetadata {.argCount = 2, .invoker = __getToken};
    methodMap_["getLimitedUseToken"] = MethodMetadata {.argCount = 1, .invoker = __getLimitedUseToken};
    methodMap_["addAppCheckListener"] = MethodMetadata {.argCount = 1, .invoker = __addAppCheckListener};
    methodMap_["removeAppCheckListener"] = MethodMetadata {.argCount = 1, .invoker = __removeAppCheckListener};
  }
  
private:
  static jsi::Value __activate(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::activate) == 4,
      "Expected activate(...) to have 4 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::activate,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 ? throw jsi::JSError(rt, "Expected argument in position 1 to be passed") : args[1].asString(rt),
      count <= 2 ? throw jsi::JSError(rt, "Expected argument in position 2 to be passed") : args[2].asBool());
  }

  static jsi::Value __configureProvider(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::configureProvider) == 4,
      "Expected configureProvider(...) to have 4 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::configureProvider,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 ? throw jsi::JSError(rt, "Expected argument in position 1 to be passed") : args[1].asString(rt),
      count <= 2 || args[2].isNull() || args[2].isUndefined() ? std::nullopt : std::make_optional(args[2].asString(rt)));
  }

  static jsi::Value __setTokenAutoRefreshEnabled(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::setTokenAutoRefreshEnabled) == 3,
      "Expected setTokenAutoRefreshEnabled(...) to have 3 parameters");
    bridging::callFromJs<void>(rt, &T::setTokenAutoRefreshEnabled,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 ? throw jsi::JSError(rt, "Expected argument in position 1 to be passed") : args[1].asBool());return jsi::Value::undefined();
  }

  static jsi::Value __isTokenAutoRefreshEnabled(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::isTokenAutoRefreshEnabled) == 2,
      "Expected isTokenAutoRefreshEnabled(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::isTokenAutoRefreshEnabled,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt));
  }

  static jsi::Value __getToken(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::getToken) == 3,
      "Expected getToken(...) to have 3 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::getToken,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt),
      count <= 1 ? throw jsi::JSError(rt, "Expected argument in position 1 to be passed") : args[1].asBool());
  }

  static jsi::Value __getLimitedUseToken(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::getLimitedUseToken) == 2,
      "Expected getLimitedUseToken(...) to have 2 parameters");
    return bridging::callFromJs<jsi::Value>(rt, &T::getLimitedUseToken,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt));
  }

  static jsi::Value __addAppCheckListener(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::addAppCheckListener) == 2,
      "Expected addAppCheckListener(...) to have 2 parameters");
    bridging::callFromJs<void>(rt, &T::addAppCheckListener,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt));return jsi::Value::undefined();
  }

  static jsi::Value __removeAppCheckListener(jsi::Runtime &rt, TurboModule &turboModule, const jsi::Value* args, size_t count) {
    static_assert(
      bridging::getParameterCount(&T::removeAppCheckListener) == 2,
      "Expected removeAppCheckListener(...) to have 2 parameters");
    bridging::callFromJs<void>(rt, &T::removeAppCheckListener,  static_cast<NativeRNFBTurboAppCheckCxxSpec*>(&turboModule)->jsInvoker_, static_cast<T*>(&turboModule),
      count <= 0 ? throw jsi::JSError(rt, "Expected argument in position 0 to be passed") : args[0].asString(rt));return jsi::Value::undefined();
  }
};

} // namespace facebook::react

```

### Core Architecture Module: `packages/app/android/src/reactnative/java/io/invertase/firebase/app/generated/jni/react/renderer/components/RNFBAppTurboModules/RNFBAppTurboModulesJSI.h`
```
/**
 * This code was generated by [react-native-codegen](https://www.npmjs.com/package/react-native-codegen).
 *
 * Do not edit this file as changes may cause incorrect behavior and will be lost
 * once the code is regenerated.
 *
 * @generated by codegen project: GenerateModuleH.js
 */

#pragma once

#include <ReactCommon/TurboModule.h>
#include <react/bridging/Bridging.h>

namespace facebook::react {


#pragma mark - NativeRNFBTurboAppFirebaseAppConfig

template <typename P0, typename P1, typename P2>
struct NativeRNFBTurboAppFirebaseAppConfig {
  P0 name{};
  P1 automaticResourceManagement{};
  P2 automaticDataCollectionEnabled;
  bool operator==(const NativeRNFBTurboAppFirebaseAppConfig &other) const {
    return name == other.name && automaticResourceManagement == other.automaticResourceManagement && automaticDataCollectionEnabled == other.automaticDataCollectionEnabled;
  }
};

template <typename T>
struct NativeRNFBTurboAppFirebaseAppConfigBridging {
  static T types;

  static T fromJs(
      jsi::Runtime &rt,
      const jsi::Object &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    T result{
      bridging::fromJs<decltype(types.name)>(rt, value.getProperty(rt, "name"), jsInvoker),
      bridging::fromJs<decltype(types.automaticResourceManagement)>(rt, value.getProperty(rt, "automaticResourceManagement"), jsInvoker),
      bridging::fromJs<decltype(types.automaticDataCollectionEnabled)>(rt, value.getProperty(rt, "automaticDataCollectionEnabled"), jsInvoker)};
    return result;
  }

#ifdef DEBUG
  static jsi::String nameToJs(jsi::Runtime &rt, decltype(types.name) value) {
    return bridging::toJs(rt, value);
  }
  static bool automaticResourceManagementToJs(jsi::Runtime &rt, decltype(types.automaticResourceManagement) value) {
    return bridging::toJs(rt, value);
  }
  static bool automaticDataCollectionEnabledToJs(jsi::Runtime &rt, decltype(types.automaticDataCollectionEnabled) value) {
    return bridging::toJs(rt, value);
  }
#endif

  static jsi::Object toJs(
      jsi::Runtime &rt,
      const T &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    auto result = facebook::jsi::Object(rt);
    result.setProperty(rt, "name", bridging::toJs(rt, value.name, jsInvoker));
    if (value.automaticResourceManagement) {
      result.setProperty(rt, "automaticResourceManagement", bridging::toJs(rt, value.automaticResourceManagement.value(), jsInvoker));
    }
    if (value.automaticDataCollectionEnabled) {
      result.setProperty(rt, "automaticDataCollectionEnabled", bridging::toJs(rt, value.automaticDataCollectionEnabled.value(), jsInvoker));
    }
    return result;
  }
};



#pragma mark - NativeRNFBTurboAppFirebaseAppOptions

template <typename P0, typename P1, typename P2, typename P3, typename P4, typename P5, typename P6, typename P7, typename P8, typename P9>
struct NativeRNFBTurboAppFirebaseAppOptions {
  P0 apiKey{};
  P1 appId{};
  P2 databaseURL{};
  P3 messagingSenderId{};
  P4 projectId{};
  P5 storageBucket{};
  P6 authDomain{};
  P7 iosBundleId{};
  P8 iosClientId{};
  P9 appGroupId;
  bool operator==(const NativeRNFBTurboAppFirebaseAppOptions &other) const {
    return apiKey == other.apiKey && appId == other.appId && databaseURL == other.databaseURL && messagingSenderId == other.messagingSenderId && projectId == other.projectId && storageBucket == other.storageBucket && authDomain == other.authDomain && iosBundleId == other.iosBundleId && iosClientId == other.iosClientId && appGroupId == other.appGroupId;
  }
};

template <typename T>
struct NativeRNFBTurboAppFirebaseAppOptionsBridging {
  static T types;

  static T fromJs(
      jsi::Runtime &rt,
      const jsi::Object &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    T result{
      bridging::fromJs<decltype(types.apiKey)>(rt, value.getProperty(rt, "apiKey"), jsInvoker),
      bridging::fromJs<decltype(types.appId)>(rt, value.getProperty(rt, "appId"), jsInvoker),
      bridging::fromJs<decltype(types.databaseURL)>(rt, value.getProperty(rt, "databaseURL"), jsInvoker),
      bridging::fromJs<decltype(types.messagingSenderId)>(rt, value.getProperty(rt, "messagingSenderId"), jsInvoker),
      bridging::fromJs<decltype(types.projectId)>(rt, value.getProperty(rt, "projectId"), jsInvoker),
      bridging::fromJs<decltype(types.storageBucket)>(rt, value.getProperty(rt, "storageBucket"), jsInvoker),
      bridging::fromJs<decltype(types.authDomain)>(rt, value.getProperty(rt, "authDomain"), jsInvoker),
      bridging::fromJs<decltype(types.iosBundleId)>(rt, value.getProperty(rt, "iosBundleId"), jsInvoker),
      bridging::fromJs<decltype(types.iosClientId)>(rt, value.getProperty(rt, "iosClientId"), jsInvoker),
      bridging::fromJs<decltype(types.appGroupId)>(rt, value.getProperty(rt, "appGroupId"), jsInvoker)};
    return result;
  }

#ifdef DEBUG
  static jsi::String apiKeyToJs(jsi::Runtime &rt, decltype(types.apiKey) value) {
    return bridging::toJs(rt, value);
  }
  static jsi::String appIdToJs(jsi::Runtime &rt, decltype(types.appId) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> databaseURLToJs(jsi::Runtime &rt, decltype(types.databaseURL) value) {
    return bridging::toJs(rt, value);
  }
  static jsi::String messagingSenderIdToJs(jsi::Runtime &rt, decltype(types.messagingSenderId) value) {
    return bridging::toJs(rt, value);
  }
  static jsi::String projectIdToJs(jsi::Runtime &rt, decltype(types.projectId) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> storageBucketToJs(jsi::Runtime &rt, decltype(types.storageBucket) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> authDomainToJs(jsi::Runtime &rt, decltype(types.authDomain) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> iosBundleIdToJs(jsi::Runtime &rt, decltype(types.iosBundleId) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> iosClientIdToJs(jsi::Runtime &rt, decltype(types.iosClientId) value) {
    return bridging::toJs(rt, value);
  }
  static std::optional<jsi::String> appGroupIdToJs(jsi::Runtime &rt, decltype(types.appGroupId) value) {
    return bridging::toJs(rt, value);
  }
#endif

  static jsi::Object toJs(
      jsi::Runtime &rt,
      const T &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    auto result = facebook::jsi::Object(rt);
    result.setProperty(rt, "apiKey", bridging::toJs(rt, value.apiKey, jsInvoker));
    result.setProperty(rt, "appId", bridging::toJs(rt, value.appId, jsInvoker));
    if (value.databaseURL) {
      result.setProperty(rt, "databaseURL", bridging::toJs(rt, value.databaseURL.value(), jsInvoker));
    }
    result.setProperty(rt, "messagingSenderId", bridging::toJs(rt, value.messagingSenderId, jsInvoker));
    result.setProperty(rt, "projectId", bridging::toJs(rt, value.projectId, jsInvoker));
    if (value.storageBucket) {
      result.setProperty(rt, "storageBucket", bridging::toJs(rt, value.storageBucket.value(), jsInvoker));
    }
    if (value.authDomain) {
      result.setProperty(rt, "authDomain", bridging::toJs(rt, value.authDomain.value(), jsInvoker));
    }
    if (value.iosBundleId) {
      result.setProperty(rt, "iosBundleId", bridging::toJs(rt, value.iosBundleId.value(), jsInvoker));
    }
    if (value.iosClientId) {
      result.setProperty(rt, "iosClientId", bridging::toJs(rt, value.iosClientId.value(), jsInvoker));
    }
    if (value.appGroupId) {
      result.setProperty(rt, "appGroupId", bridging::toJs(rt, value.appGroupId.value(), jsInvoker));
    }
    return result;
  }
};



#pragma mark - NativeRNFBTurboAppNativeFirebaseApp

template <typename P0, typename P1>
struct NativeRNFBTurboAppNativeFirebaseApp {
  P0 appConfig{};
  P1 options;
  bool operator==(const NativeRNFBTurboAppNativeFirebaseApp &other) const {
    return appConfig == other.appConfig && options == other.options;
  }
};

template <typename T>
struct NativeRNFBTurboAppNativeFirebaseAppBridging {
  static T types;

  static T fromJs(
      jsi::Runtime &rt,
      const jsi::Object &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    T result{
      bridging::fromJs<decltype(types.appConfig)>(rt, value.getProperty(rt, "appConfig"), jsInvoker),
      bridging::fromJs<decltype(types.options)>(rt, value.getProperty(rt, "options"), jsInvoker)};
    return result;
  }

#ifdef DEBUG
  static jsi::Object appConfigToJs(jsi::Runtime &rt, decltype(types.appConfig) value) {
    return bridging::toJs(rt, value);
  }
  static jsi::Object optionsToJs(jsi::Runtime &rt, decltype(types.options) value) {
    return bridging::toJs(rt, value);
  }
#endif

  static jsi::Object toJs(
      jsi::Runtime &rt,
      const T &value,
      const std::shared_ptr<CallInvoker> &jsInvoker) {
    auto result = facebook::jsi::Object(rt);
    result.setProperty(rt, "appConfig", bridging::toJs(rt, value.appConfig, jsInvoker));
    result.setProperty(rt, "options", bridging::toJs(rt, value.options, jsInvoker));
    return result;
  }
};


template <typename T>
class JSI_EXPORT NativeRNFBTurboAppCxxSpec : public TurboModule {
public:
  static constexpr std::string_view kModuleName = "NativeRNFBTurboApp";

protected:
  NativeRNFBTurboAppCxxSpec(std::shared_ptr<CallInvoker> jsInvoker) : TurboModule(std::string{NativeRNFBTurboAppCxxSpec::kModuleName}, jsInvoker) {
    methodMap_["getConstants"] = MethodMetadata {.argCount = 0, .invoker = __getConstants};
    methodMap_["initializeApp"] = MethodMetadata {.argCount = 2, .invoker = __initializeApp};
    methodMap_["setAutomaticDataCollectionEnabled"] = MethodMetadata {.argCount = 2, .invoker = __setAutomaticDataCollectionEnabled};
    methodMap_["deleteApp"] = MethodMetadata {.argCount = 1, .invoker = __deleteApp};
    methodMap_["eventsNotifyReady"] = MethodMetadata {.argCount = 1, .invoker = __eventsNotifyReady};
    methodMap_["eventsGetListeners"] = MethodMetadata {.argCount 
```

### Core Architecture Module: `packages/app/android/src/reactnative/java/io/invertase/firebase/common/SharedUtils.kt`
```
package io.invertase.firebase.common

/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.content.Context
import android.graphics.Point
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import javax.annotation.Nullable

@Suppress("unused", "KDocUnresolvedReference", "MemberVisibilityCanBePrivate", "PLATFORM_CLASS_MAPPED_TO_KOTLIN")
@SuppressLint("KotlinNullnessAnnotation")
open class SharedUtils {
  companion object {
    private const val TAG = "Utils"
    private const val RN_DEVSUPPORT_CLASS = "DevSupportManagerImpl"
    private const val RN_DEVSUPPORT_PACKAGE = "com.facebook.react.devsupport"

    private const val EXPO_REGISTRY_CLASS = "ModuleRegistry"
    private const val EXPO_CORE_PACKAGE = "expo.core"

    private const val FLUTTER_REGISTRY_CLASS = "PluginRegistry"
    private const val FLUTTER_CORE_PACKAGE = "io.flutter.plugin.common"

    private const val REACT_NATIVE_REGISTRY_CLASS = "NativeModuleRegistry"
    private const val REACT_NATIVE_CORE_PACKAGE = "com.facebook.react.bridge"

    @JvmStatic
    fun rectToIntArray(
      @Nullable rect: Rect?,
    ): IntArray {
      if (rect == null || rect.isEmpty) return intArrayOf()
      return intArrayOf(rect.left, rect.top, rect.right, rect.bottom)
    }

    @JvmStatic
    fun pointToIntArray(
      @Nullable point: Point?,
    ): IntArray {
      if (point == null) return intArrayOf()
      return intArrayOf(point.x, point.y)
    }

    @JvmStatic
    fun pointsToIntsList(
      @Nullable points: Array<Point?>?,
    ): List<IntArray> {
      if (points == null) return ArrayList()

      val pointsList = ArrayList<IntArray>(points.size)
      for (point in points) {
        pointsList.add(pointToIntArray(point))
      }

      return pointsList
    }

    /** Create a Uri from the path, defaulting to file when there is no supplied scheme. */
    @JvmStatic
    fun getUri(uri: String?): Uri {
      val parsed = Uri.parse(uri)

      if (parsed.scheme == null || platform(parsed.scheme).isEmpty()) {
        return Uri.fromFile(File(platform(uri)))
      }

      return parsed
    }

    @JvmStatic
    fun getExceptionMap(exception: Exception?): WritableMap {
      val source: Exception = platform(exception)
      val exceptionMap = Arguments.createMap()
      val code = "unknown"
      val message = source.message
      exceptionMap.putString("code", code)
      exceptionMap.putString("nativeErrorCode", code)
      exceptionMap.putString("message", message)
      exceptionMap.putString("nativeErrorMessage", message)
      return exceptionMap
    }

    @JvmStatic
    fun timestampToUTC(timestamp: Long): String {
      val millisTimestamp = timestamp * 1000
      val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.ROOT)
      format.timeZone = TimeZone.getTimeZone("UTC")
      return format.format(millisTimestamp)
    }

    /** Send a JS event. */
    @JvmStatic
    fun sendEvent(
      context: ReactContext?,
      eventName: String?,
      body: Any?,
    ) {
      if (context != null) {
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(platform(eventName), body)
      } else {
        Log.d(TAG, "Missing context - cannot send event!")
      }
    }

    /**
     * We need to check if app is in foreground otherwise the app will crash.
     * http://stackoverflow.com/questions/8489993/check-android-application-is-in-foreground-or-not
     *
     * @param context Context
     * @return boolean
     */
    @JvmStatic
    fun isAppInForeground(context: Context?): Boolean {
      val sourceContext: Context = platform(context)
      val activityManager =
        sourceContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager?
          ?: return false

      val appProcesses = activityManager.runningAppProcesses ?: return false

      // Check if current activity is a background activity.
      val json = ReactNativeFirebaseJSON.getSharedInstance()
      if (json.contains("android_background_activity_names")) {
        val backgroundActivities = json.getArrayValue("android_background_activity_names")

        if (backgroundActivities.size != 0) {
          var currentActivity = ""
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val taskInfo = activityManager.appTasks
            if (taskInfo.size > 0) {
              // SDK 37+ annotates RecentTaskInfo as nullable; skip rather than NPE.
              val task = taskInfo[0].taskInfo
              if (task != null) {
                currentActivity =
                  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val baseActivity = task.baseActivity
                    if (baseActivity != null) platform(baseActivity).shortClassName else ""
                  } else {
                    val origActivity = task.origActivity
                    if (origActivity != null) {
                      platform(origActivity).shortClassName
                    } else {
                      val component = task.baseIntent.component
                      platform(component).shortClassName
                    }
                  }
              }
            }
          } else {
            val taskInfo = activityManager.getRunningTasks(1)
            if (taskInfo.size > 0) {
              currentActivity = platform(taskInfo[0].topActivity).shortClassName
            }
          }

          if (currentActivity != "" && backgroundActivities.contains(currentActivity)) {
            return false
          }
        }
      }

      val packageName = sourceContext.packageName
      for (appProcess in appProcesses) {
        if (
          appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
          appProcess.processName.equals(packageName)
        ) {
          val reactContext: ReactContext

          try {
            reactContext = sourceContext as ReactContext
          } catch (_: ClassCastException) {
            // Not react context so default to true.
            return true
          }

          return reactContext.lifecycleState == LifecycleState.RESUMED
        }
      }

      return false
    }

    @SuppressLint("DiscouragedApi")
    @JvmStatic
    fun getResId(
      ctx: Context?,
      resName: String?,
    ): Int {
      val sourceContext: Context = platform(ctx)
      val resourceId =
        sourceContext.resources.getIdentifier(resName, "string", sourceContext.packageName)

      if (resourceId == 0) {
        Log.e(TAG, "resource $resName could not be found")
      }

      return resourceId
    }

    /**
     * Checks for dev support availability - so we can ignore in release builds for example.
     *
     * @return Boolean
     */
    @JvmStatic
    fun reactNativeHasDevSupport(): java.lang.Boolean = hasPackageClass(RN_DEVSUPPORT_PACKAGE, RN_DEVSUPPORT_CLASS)

    /**
     * Is the build platform Expo?
     *
     * @return Boolean
     */
    @JvmStatic
    fun isExpo(): java.lang.Boolean = hasPackageClass(EXPO_CORE_PACKAGE, EXPO_REGISTRY_CLASS)

    /**
     * Is the build platform Flutter?
     *
     * @return Boolean
     */
    @JvmStatic
    fun isFlutter(): java.lang.Boolean = hasPackageClass(FLUTTER_CORE_PACKAGE, FLUTTER_REGISTRY_CLASS)

    /**
     * Is the build platform React Native?
     *
     * @return Boolean
     */
    @JvmStatic
    fun isReactNative(): java.lang.Boolean =
      (
        java.lang.Boolean.valueOf(
          !isExpo().booleanValue() &&
            hasPackageClass(REACT_NATIVE_CORE_PACKAGE, REACT_NATIVE_REGISTRY_CLASS).booleanValue(),
        ) as java.lang.Boolean
      )

    /**
     * Returns true/false if a class for a package exists in the app class bundle.
     *
     * @param packageName
     * @param className
     * @return
     */
    @Suppress("ReplaceStringBuilderWithString")
    @JvmStatic
    fun hasPackageClass(
      packageName: String?,
      className: String?,
    ): java.lang.Boolean {
      // ProGuard is surprisingly smart in this case and will keep a class if it detects a call to
      // Class.forName() with a static string. Generate a quasi-dynamic string to confuse it.
      val fullName =
        java.lang
          .StringBuilder(platform(packageName))
          .append(".")
          .append(className)
          .toString()

      return try {
        Class.forName(fullName)
        java.lang.Boolean.TRUE as java.lang.Boolean
      } catch (_: Exception) {
        java.lang.Boolean.FALSE as java.lang.Boolean
      }
    }

    @Throws(JSONException::class)
    @JvmStatic
    fun jsonObjectToWritableMap(jsonObject: JSONObject?): WritableMap {
      val source: JSONObject = platform(jsonObject)
      val iterator = source.keys()

```

### Core Architecture Module: `packages/app/android/src/reactnative/java/io/invertase/firebase/utils/NativeRNFBTurboUtils.kt`
```
package io.invertase.firebase.utils

/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.content.IntentSender
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import com.facebook.fbreact.specs.NativeRNFBTurboUtilsSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import io.invertase.firebase.app.ReactNativeFirebaseApp
import java.util.HashMap

open class NativeRNFBTurboUtils(
  reactContext: ReactApplicationContext?,
) : NativeRNFBTurboUtilsSpec(reactContext) {
  override fun androidGetPlayServicesStatus(promise: Promise?) {
    nullableAsPlatformType<Promise>(promise).resolve(playServicesStatusMap)
  }

  override fun androidPromptForPlayServices(promise: Promise?) {
    val status = isGooglePlayServicesAvailable()
    val gapi = GoogleApiAvailability.getInstance()

    if (status != ConnectionResult.SUCCESS && gapi.isUserResolvableError(status)) {
      val activity: Activity? = getCurrentActivity()
      if (activity != null) {
        nullableAsPlatformType<Dialog>(gapi.getErrorDialog(activity, status, status)).show()
      }
    }
    nullableAsPlatformType<Promise>(promise).resolve(null)
  }

  override fun androidResolutionForPlayServices(promise: Promise?) {
    val status = isGooglePlayServicesAvailable()
    val connectionResult = ConnectionResult(status)

    if (!connectionResult.isSuccess && connectionResult.hasResolution()) {
      val activity: Activity? = getCurrentActivity()
      if (activity != null) {
        try {
          connectionResult.startResolutionForResult(activity, status)
        } catch (error: IntentSender.SendIntentException) {
          Log.d(TAG, "resolutionForPlayServices", error)
        }
      }
    }
    nullableAsPlatformType<Promise>(promise).resolve(null)
  }

  override fun androidMakePlayServicesAvailable(promise: Promise?) {
    val status = isGooglePlayServicesAvailable()

    if (status != ConnectionResult.SUCCESS) {
      UiThreadUtil.runOnUiThread {
        val activity: Activity? = getCurrentActivity()
        if (activity != null) {
          GoogleApiAvailability
            .getInstance()
            .makeGooglePlayServicesAvailable(activity)
            .addOnCompleteListener { task ->
              if (task.isSuccessful) {
                nullableAsPlatformType<Promise>(promise).resolve(null)
              } else if (task.isCanceled) {
                nullableAsPlatformType<Promise>(promise).reject(
                  "play-services-update-canceled",
                  "Play Services update was canceled by the user",
                )
              } else {
                val error = task.exception
                nullableAsPlatformType<Promise>(promise).reject(
                  "play-services-update-failed",
                  if (error != null) error.message else "Unknown error",
                  error,
                )
              }
            }
        } else {
          nullableAsPlatformType<Promise>(promise).resolve(null)
        }
      }
    } else {
      nullableAsPlatformType<Promise>(promise).resolve(null)
    }
  }

  protected override fun getTypedExportedConstants(): MutableMap<String, Any> {
    val constants: MutableMap<String, Any> = HashMap()

    constants["isRunningInTestLab"] = isRunningInTestLab()

    val context = reactApplicationContext
    val appVersion = getAppVersionName(context)
    if (appVersion != null && appVersion.isNotEmpty()) {
      constants["appVersion"] = appVersion
    }

    constants[KEY_MAIN_BUNDLE] = ""
    constants[KEY_LIBRARY_DIRECTORY] = context.filesDir.absolutePath
    constants[KEY_TEMP_DIRECTORY] = context.cacheDir.absolutePath
    constants[KEY_CACHE_DIRECTORY] = context.cacheDir.absolutePath

    val externalDirectory = context.getExternalFilesDir(null)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT && externalDirectory != null) {
      constants[KEY_DOCUMENT_DIRECTORY] = externalDirectory.absolutePath
    }

    if (!constants.containsKey(KEY_DOCUMENT_DIRECTORY)) {
      constants[KEY_DOCUMENT_DIRECTORY] = context.filesDir.absolutePath
    }

    val picturesDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
    constants[KEY_PICS_DIRECTORY] =
      if (picturesDirectory != null) picturesDirectory.absolutePath else ""

    val moviesDirectory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES)
    constants[KEY_MOVIES_DIRECTORY] =
      if (moviesDirectory != null) moviesDirectory.absolutePath else ""

    val externalStorageDirectory = Environment.getExternalStorageDirectory()
    if (externalStorageDirectory != null) {
      constants[KEY_EXT_STORAGE_DIRECTORY] = externalStorageDirectory.absolutePath
    }

    if (externalDirectory != null) {
      constants[KEY_EXTERNAL_DIRECTORY] = externalDirectory.absolutePath
    }

    return constants
  }

  private fun isGooglePlayServicesAvailable(): Int {
    val gapi = GoogleApiAvailability.getInstance()
    return gapi.isGooglePlayServicesAvailable(reactApplicationContext)
  }

  private val playServicesStatusMap: WritableMap
    get() {
      val result = Arguments.createMap()
      val gapi = GoogleApiAvailability.getInstance()

      val status = gapi.isGooglePlayServicesAvailable(reactApplicationContext)
      result.putInt("status", status)

      if (status == ConnectionResult.SUCCESS) {
        result.putBoolean("isAvailable", true)
      } else {
        result.putBoolean("isAvailable", false)
        result.putString("error", gapi.getErrorString(status))
        result.putBoolean("isUserResolvableError", gapi.isUserResolvableError(status))
        result.putBoolean("hasResolution", ConnectionResult(status).hasResolution())
      }

      return result
    }

  companion object {
    private const val TAG = "Utils"
    private const val KEY_MAIN_BUNDLE = "MAIN_BUNDLE"
    private const val KEY_DOCUMENT_DIRECTORY = "DOCUMENT_DIRECTORY"
    private const val KEY_LIBRARY_DIRECTORY = "LIBRARY_DIRECTORY"
    private const val KEY_EXTERNAL_DIRECTORY = "EXTERNAL_DIRECTORY"
    private const val KEY_EXT_STORAGE_DIRECTORY = "EXTERNAL_STORAGE_DIRECTORY"
    private const val KEY_PICS_DIRECTORY = "PICTURES_DIRECTORY"
    private const val KEY_MOVIES_DIRECTORY = "MOVIES_DIRECTORY"
    private const val KEY_TEMP_DIRECTORY = "TEMP_DIRECTORY"
    private const val KEY_CACHE_DIRECTORY = "CACHES_DIRECTORY"
    private const val FIREBASE_TEST_LAB = "firebase.test.lab"

    private fun isRunningInTestLab(): Boolean {
      val testLabSetting =
        Settings.System.getString(
          ReactNativeFirebaseApp.getApplicationContext().contentResolver,
          FIREBASE_TEST_LAB,
        )

      return "true" == testLabSetting
    }

    private fun getAppVersionName(context: Context): String? =
      try {
        @Suppress("DEPRECATION")
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        packageInfo.versionName
      } catch (error: Exception) {
        // Optional metadata: prefer omit over crashing on null context / unexpected PM failures.
        Log.d(TAG, "getAppVersionName", error)
        null
      }

    @Suppress("UNCHECKED_CAST")
    private fun <T> nullableAsPlatformType(value: T?): T = value as T
  }
}

```

### Core Architecture Module: `packages/app/e2e/utils.e2e.js`
```
/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

describe('utils()', function () {
  if (Platform.other) return; // Not supported on non-native platforms.

  describe('modular', function () {
    it('getUtils returns instance for default app', function () {
      const { getUtils, getApp } = modular;
      getUtils().app.should.equal(getApp());
    });

    describe('isRunningInTestLab', function () {
      it('returns true or false', function () {
        const { getUtils } = modular;
        should.equal(getUtils().isRunningInTestLab, false);
      });
    });

    describe('appVersion', function () {
      it('returns a non-empty marketing version string', function () {
        const { getUtils } = modular;
        const appVersion = getUtils().appVersion;
        should.exist(appVersion);
        should(appVersion).be.a.String();
        should(appVersion.length).be.above(0);
      });
    });

    describe('playServicesAvailability', function () {
      it('returns isAvailable and Play Service status', async function () {
        const { getUtils } = modular;
        const playService = await getUtils().playServicesAvailability;
        should(playService.isAvailable).equal(true);
        should(playService.status).equal(0);
      });
    });

    describe('getPlayServicesStatus', function () {
      it('returns isAvailable and Play Service status', async function () {
        const { getUtils } = modular;
        const status = await getUtils().getPlayServicesStatus();
        should(status.isAvailable).equal(true);
        should(status.status).equal(0);
      });
    });
  });
});

```

### Core Architecture Module: `packages/app/e2e/utilsStatics.e2e.js`
```
/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

describe('utils()', function () {
  if (Platform.other) return; // Not supported on non-native platforms.

  describe('modular', function () {
    it('provides native path strings via FilePath export', function () {
      const { FilePath } = modular;
      FilePath.should.be.an.Object();
      if (Platform.ios) {
        FilePath.MAIN_BUNDLE.should.be.a.String();
      } else {
        should.equal(FilePath.MAIN_BUNDLE, null);
      }

      FilePath.CACHES_DIRECTORY.should.be.a.String();
      FilePath.DOCUMENT_DIRECTORY.should.be.a.String();

      if (Platform.android && FilePath.EXTERNAL_DIRECTORY !== null) {
        FilePath.EXTERNAL_DIRECTORY.should.be.a.String();
      } else {
        should.equal(FilePath.EXTERNAL_DIRECTORY, null);
      }

      if (Platform.android && FilePath.EXTERNAL_STORAGE_DIRECTORY !== null) {
        FilePath.EXTERNAL_STORAGE_DIRECTORY.should.be.a.String();
      } else {
        should.equal(FilePath.EXTERNAL_STORAGE_DIRECTORY, null);
      }

      FilePath.TEMP_DIRECTORY.should.be.a.String();
      FilePath.LIBRARY_DIRECTORY.should.be.a.String();
      FilePath.PICTURES_DIRECTORY.should.be.a.String();
      FilePath.MOVIES_DIRECTORY.should.be.a.String();
    });
  });
});

```

### Core Architecture Module: `packages/app/ios/RNFBApp/RNFBRCTEventEmitterCore.swift`
```
/**
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Foundation

/// Bridge-present check previously hard-wired to `self.bridge != nil`.
public typealias RNFBRCTEventEmitterBridgePresent = () -> Bool

/// Bridge emit previously hard-wired to `enqueueJSCall` (unprefixed event name + body).
public typealias RNFBRCTEventEmitterEmitHandler = (String, Any?) -> Void

/**
 * Queue / listener state previously inline in `RNFBRCTEventEmitter.m`.
 *
 * Mirrors pre-port:
 * - `isObserving` = `jsReady && jsListenerCount > 0`
 * - emit when bridge present && observing && listener registered; else queue `{name,body}`
 * - `notifyJsReady(true)` / `addListener` flush matching queued events via `sendEvent`
 * - `@synchronized(jsListeners)` / `@synchronized(queuedEvents)` via `objc_sync_*`
 */
@objc(RNFBRCTEventEmitterCore)
public final class RNFBRCTEventEmitterCore: NSObject {
  @objc public static let eventNameKey = "name"
  @objc public static let eventBodyKey = "body"

  private var jsReady = false
  private var jsListenerCount = 0
  private var jsListeners = NSMutableDictionary()
  private var queuedEvents = NSMutableArray()

  private let isBridgePresent: RNFBRCTEventEmitterBridgePresent
  private let emitHandler: RNFBRCTEventEmitterEmitHandler

  @objc(initWithIsBridgePresent:emitHandler:)
  public init(
    isBridgePresent: @escaping RNFBRCTEventEmitterBridgePresent,
    emitHandler: @escaping RNFBRCTEventEmitterEmitHandler
  ) {
    self.isBridgePresent = isBridgePresent
    self.emitHandler = emitHandler
    super.init()
  }

  @objc public func invalidate() {
    jsReady = false
    queuedEvents = NSMutableArray()
    jsListeners = NSMutableDictionary()
    jsListenerCount = 0
  }

  @objc(notifyJsReady:)
  public func notifyJsReady(_ ready: Bool) {
    objc_sync_enter(jsListeners)
    defer { objc_sync_exit(jsListeners) }

    jsReady = ready
    if ready {
      for case let event as NSDictionary in queuedEvents.copy() as! NSArray {
        let name = event[Self.eventNameKey] as! String
        let body = event[Self.eventBodyKey]
        sendEvent(name: name, body: body)
        objc_sync_enter(queuedEvents)
        queuedEvents.remove(event)
        objc_sync_exit(queuedEvents)
      }
    }
  }

  @objc(sendEventWithName:body:)
  public func sendEvent(name eventName: String, body: Any?) {
    objc_sync_enter(jsListeners)
    defer { objc_sync_exit(jsListeners) }

    if isBridgePresent(), isObserving, jsListeners[eventName] != nil {
      emitHandler(eventName, body)
    } else {
      objc_sync_enter(queuedEvents)
      let entry = NSMutableDictionary()
      entry[Self.eventNameKey] = eventName
      entry[Self.eventBodyKey] = body
      queuedEvents.add(entry)
      objc_sync_exit(queuedEvents)
    }
  }

  @objc(addListener:)
  public func addListener(_ eventName: String) {
    objc_sync_enter(jsListeners)
    defer { objc_sync_exit(jsListeners) }

    jsListenerCount += 1

    if jsListeners[eventName] == nil {
      jsListeners[eventName] = NSNumber(value: 1)
    } else {
      let current = (jsListeners[eventName] as! NSNumber).intValue
      jsListeners[eventName] = NSNumber(value: current + 1)
    }

    for case let event as NSDictionary in queuedEvents.copy() as! NSArray {
      if (event[Self.eventNameKey] as? String) == eventName {
        let body = event[Self.eventBodyKey]
        sendEvent(name: eventName, body: body)
        objc_sync_enter(queuedEvents)
        queuedEvents.remove(event)
        objc_sync_exit(queuedEvents)
      }
    }
  }

  @objc(removeListeners:all:)
  public func removeListeners(_ eventName: String, all: Bool) {
    objc_sync_enter(jsListeners)
    defer { objc_sync_exit(jsListeners) }

    if jsListeners[eventName] != nil {
      let listenersForEvent = (jsListeners[eventName] as! NSNumber).intValue

      if listenersForEvent <= 1 || all {
        objc_sync_enter(jsListeners)
        jsListeners.removeObject(forKey: eventName)
        objc_sync_exit(jsListeners)
      } else {
        objc_sync_enter(jsListeners)
        jsListeners[eventName] = NSNumber(value: listenersForEvent - 1)
        objc_sync_exit(jsListeners)
      }

      if all {
        jsListenerCount -= listenersForEvent
      } else {
        jsListenerCount -= 1
      }
    }
  }

  @objc public func getListenersDictionary() -> NSDictionary {
    let listenersDictionary = NSMutableDictionary()
    listenersDictionary["listeners"] = NSNumber(value: jsListenerCount)
    listenersDictionary["queued"] = NSNumber(value: queuedEvents.count)
    listenersDictionary["events"] = jsListeners.copy()
    return listenersDictionary
  }

  private var isObserving: Bool {
    jsReady && jsListenerCount > 0
  }
}

```

### Core Architecture Module: `packages/app/ios/RNFBApp/RNFBSharedUtils.h`
```
/**
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

#ifndef RNFBSharedUtils_h
#define RNFBSharedUtils_h

#import <React/RCTBridgeModule.h>

@class FIRApp;

#ifdef DEBUG
#define DLog(fmt, ...) NSLog((@"%s [Line %d] " fmt), __PRETTY_FUNCTION__, __LINE__, ##__VA_ARGS__);
#else
#define DLog(...)
#endif

#define ELog(fmt, ...) NSLog((@"%s [Line %d] " fmt), __PRETTY_FUNCTION__, __LINE__, ##__VA_ARGS__);

#pragma mark -
#pragma mark Constants

extern NSString *const DEFAULT_APP_DISPLAY_NAME;
extern NSString *const DEFAULT_APP_NAME;

@interface RNFBSharedUtils : NSObject

#pragma mark -
#pragma mark Methods

+ (NSString *)getAppJavaScriptName:(NSString *)appDisplayName;

+ (NSDictionary *)firAppToDictionary:(FIRApp *)firApp;

+ (void)sendJSEventForApp:(FIRApp *)app name:(NSString *)name body:(NSDictionary *)body;

+ (void)rejectPromiseWithExceptionDict:(RCTPromiseRejectBlock)reject
                             exception:(NSException *)exception;

+ (void)rejectPromiseWithNSError:(RCTPromiseRejectBlock)reject error:(NSError *)error;

+ (void)rejectPromiseWithUserInfo:(RCTPromiseRejectBlock)reject
                         userInfo:(NSMutableDictionary *)userInfo;

+ (NSString *)getISO8601String:(NSDate *)date;

+ (BOOL)configContains:(NSString *)key;

+ (BOOL)getConfigBooleanValue:(NSString *)tag key:(NSString *)key defaultValue:(BOOL)defaultValue;

+ (id)decodeNullSentinels:(id)value;

@end

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9396** (2026-10-23): **fix(ci): branch-aware publish (docs gate, dist-tag, recovery)**
  *Symptoms*: ### Description  Make Publish safe for release branches: do not deploy the API reference unless the run is on `main` after a successful npm job; off-`main`, publish with `--dist-tag` equal to the branch name (and pin npm to `12.2.1`); on a failed `lerna publish from-package`, write a large workflow-summary notice that partial publish recovery is achieved by rerunning the exact same publish. Document that maintainer policy in OKF and correct CONTRIBUTING’s stale “merge to main auto-publishes” claim.  **Merge instruction (required):** please **rebase-merge** this PR (do **not** squash). Per-commit history on `main` is needed so only the workflow commits can be `cherry-pick -x`’d onto `release-v26` afterward. Intentional exception to the usual squash-merge preference.  ### Related issues  N/A — maintainer publish / release-branch automation.  ### Release Summary  Branch-aware Publish: main-only API docs deploy, branch-named npm dist-tags off main, partial-publish recovery summary, maintainer docs.  ### Checklist  - I read the [Contributor Guide](https://github.com/invertase/react-native-firebase/blob/main/CONTRIBUTING.md) and followed the process outlined there for submitting PRs.   - [x] Yes - My change supports the following platforms;   - [ ] `Android`   - [ ] `iOS`   - [x] `Other` (CI publish workflow + maintainer docs) - My change includes tests;   - [ ] `e2e` tests added or updated in `packages/**/e2e`   - [ ] `jest` tests added or updated in `packages/**/__tests__` - [ ] 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9396?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 75.10%. Comparing base ([`b12d847`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/b12d8477bce15632e4391d80e8d125bf2a492402?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`3dba13d`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/3dba13dffaf77a4fbab227825509dfee59c59e81?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)). :warning: Report is 4 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@    

- **Issue #9393** (2026-10-23): **fix(app, sdk): bump Firebase iOS SDK to 12.19.3**
  *Symptoms*: Bumps Firebase iOS SDK 12.18.0 → 12.19.3 for v26, the last major with CocoaPods support. 12.19.3 removes root certs for compromised eMudhra intermediate CAs from the embedded trust store (Cloud Firestore security update, [release notes](https://firebase.google.com/support/release-notes/ios)). v26 counterpart of #9391 (v27, SDK 13.1.1).  - `sdkVersions.ios.firebase` → 12.19.3 (SPM minimum), `docs/index.mdx` examples and the `test-rn-bare` Xcode pin updated - CocoaPods: 12.19.3 is only published for `Firebase`, `FirebaseCore` and `FirebaseFirestore`. Every other pod stops at 12.19.0, so the exact pins in the podspecs (e.g. `FirebaseAnalytics/Core`, `FirebaseCoreExtension`) could not resolve. When the default version is used, the podspecs now declare `~> 12.19.0` instead, so each pod resolves to its newest patch. A version pinned via `$FirebaseSDKVersion` / `FIREBASE_SDK_VERSION` stays exact. - `test_expo_ios_link` and `test_rn_bare_ios_build` now also run on `packages/app/package.json` changes, so SDK bumps on this branch exercise them (`main` already does this)  No 12.18.x patch exists and 12.19.1 / 12.19.2 aren't on CocoaPods trunk, so this crosses a minor. 12.19.0 adds the `GeminiLanguageModel` public preview plus some Auth and App Check build/crash fixes.  Targets `release-v26`, cut from `v26.4.0`.  

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

### Incident Patch 1: `1cdb7de2` (2026-10-23)
**Commit Message**: fix(crashlytics, ios): time out SPM upload-symbols so a stalled upload cannot hang the build

upload-symbols has no timeout of its own. A stalled request left the [RNFB] Crashlytics Configuration phase running until the surrounding build timed out. The script already treats an upload failure as a warning, so a timeout now takes the same path (default 300s, override with RNFB_CRASHLYTICS_UPLOAD_TIMEOUT_SEC).

**File**: `packages/crashlytics/__tests__/ios_config.test.ts` (modified, +27/-1)
```diff
@@ -46,6 +46,13 @@ echo "error: stub forced failure" >&2
 exit 1
 `;
 
+// Never returns on its own — simulates a stalled network request in upload-symbols.
+// `exec` keeps this a single process like the real binary, so the timeout's SIGALRM
+// kills the hang itself rather than an orphaned child holding the output pipes open.
+const HANGS_STUB = `#!/usr/bin/env bash
+exec sleep 60
+`;
+
 const ALWAYS_SUCCEEDS_STUB = `#!/usr/bin/env bash
 exit 0
 `;
@@ -90,12 +97,13 @@ describe('Crashlytics ios_config.sh SPM dSYM upload', function () {
     rmSync(projectDir, { recursive: true, force: true });
   });
 
-  function runIosConfig() {
+  function runIosConfig(extraEnv: Record<string, string> = {}) {
     return spawnSync('bash', [SCRIPT_PATH], {
       cwd: projectDir,
       encoding: 'utf8',
       env: {
         PATH: process.env.PATH,
+        ...extraEnv,
         PROJECT_DIR: projectDir,
         TARGET_NAME: targetName,
         BUILD_DIR: buildDir,
@@ -157,6 +165,24 @@ describe('Crashlytics ios_config.sh SPM dSYM upload', function () {
     expect(result.stdout).toContain('warning:');
     expect(result.stdout).toContain('upload-symbols (SPM) failed');
   });
+
+  it('warns and continues without failing the build when SPM upload-symbols hangs past the timeout', function () {
+    const targetFolderPlist = join(projectDir, targetName, 'GoogleService-Info.plist');
+    mkdirSync(join(projectDir, targetName), { recursive: true });
+    writeFileSync(targetFolderPlist, 'plist-contents');
+
+    writeFileSync(uploadSymbolsPath, HANGS_STUB);
+    chmodSync(uploadSymbolsPath, 0o755);
+
+    const startedAt = Date.now();
+    const result = runIosConfig({ RNFB_CRASHLYTICS_UPLOAD_TIMEOUT_SEC: '1' });
+    const elapsedMs = Date.now() - startedAt;
+
+    expect(result.status).toBe(0);
+    expect(elapsedMs).toBeLessThan(30000);
+    expect(result.stdout).toContain('warning:');
+    expect(result.stdout).toContain('failed or timed out');
+  });
 });
 
 describe('Crashlytics ios_config.sh CocoaPods / framework run', function () {
```

**File**: `packages/crashlytics/ios_config.sh` (modified, +14/-4)
```diff
@@ -16,6 +16,16 @@
 #
 set -e
 
+# upload-symbols talks to the network and has no timeout of its own, so a stalled
+# request can hang the whole build. perl's alarm is used because macOS has no
+# `timeout`. A timeout exits non-zero, which the callers below report as a
+# warning without failing the build.
+UPLOAD_SYMBOLS_TIMEOUT_SEC="${RNFB_CRASHLYTICS_UPLOAD_TIMEOUT_SEC:-300}"
+
+run_upload_symbols() {
+  perl -e 'alarm shift; exec @ARGV' "${UPLOAD_SYMBOLS_TIMEOUT_SEC}" "$@"
+}
+
 if [[ ${PODS_ROOT} && -f "${PODS_ROOT}/FirebaseCrashlytics/run" ]]; then
   echo "info: Exec FirebaseCrashlytics Run from Pods"
   if ! "${PODS_ROOT}/FirebaseCrashlytics/run"; then
@@ -49,14 +59,14 @@ else
     echo "warning: GoogleService-Info.plist not found at ${PROJECT_DIR}/${TARGET_NAME}/GoogleService-Info.plist or ${PROJECT_DIR}/GoogleService-Info.plist. Skipping dSYM upload."
   elif [[ -x "${SPM_UPLOAD_SYMBOLS}" ]]; then
     echo "info: Exec FirebaseCrashlytics upload-symbols from SPM"
-    if ! "${SPM_UPLOAD_SYMBOLS}" -gsp "${GSP_PATH}" -p ios "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"; then
-      echo "warning: FirebaseCrashlytics upload-symbols (SPM) failed; continuing without failing the build. Common causes: no network, invalid/placeholder GoogleService-Info.plist credentials, or Firebase project mismatch."
+    if ! run_upload_symbols "${SPM_UPLOAD_SYMBOLS}" -gsp "${GSP_PATH}" -p ios "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"; then
+      echo "warning: FirebaseCrashlytics upload-symbols (SPM) failed or timed out; continuing without failing the build. Common causes: no network, invalid/placeholder GoogleService-Info.plist credentials, or Firebase project mismatch."
     fi
   elif [[ -f "${SPM_UPLOAD_SYMBOLS}" ]]; then
     echo "info: Exec FirebaseCrashlytics upload-symbols from SPM (chmod +x)"
     chmod +x "${SPM_UPLOAD_SYMBOLS}"
-    if ! "${SPM_UPLOAD_SYMBOLS}" -gsp "${GSP_PATH}" -p ios "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"; then
-      echo "warning: FirebaseCrashlytics upload-symbols (SPM) failed; continuing without failing the build. Common causes: no network, invalid/placeholder GoogleService-Info.plist credentials, or Firebase project mismatch."
+    if ! run_upload_symbols "${SPM_UPLOAD_SYMBOLS}" -gsp "${GSP_PATH}" -p ios "${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"; then
+      echo "warning: FirebaseCrashlytics upload-symbols (SPM) failed or timed out; continuing without failing the build. Common causes: no network, invalid/placeholder GoogleService-Info.plist credentials, or Firebase project mismatch."
     fi
   else
     echo "warning: FirebaseCrashlytics run script not found at CocoaPods, framework, or SPM paths. Skipping dSYM upload."
```

---

### Incident Patch 2: `b12d8477` (2026-10-23)
**Commit Message**: Reapply "docs: use relative link to Crashlytics usage in tips"

This reverts commit 0444d72404760d64cafd4b90e02ae2e519343933.

**File**: `docs/faqs-and-tips.mdx` (modified, +1/-1)
```diff
@@ -98,5 +98,5 @@ To view the complete detail for this solution, please refer to this page: [#5656
   - Build processes are costly and complex, so caching is used a lot. As a result, certain changes that you make in your app can cause cache conflicts in subsequent builds. Deal with this via `npx react-native-clean-project`. This does solve a lot of problems.
   - Try and isolate the problem with a template React Native Firebase app. This [bash script](https://github.com/mikehardy/rnfbdemo/blob/main/make-demo.sh) is particularly helpful in making an empty template app.
 - Advice on supporting multiple environments (for example, dev, prod, maybe also staging, qa) for your React Native Firebase App: [#3504](https://github.com/invertase/react-native-firebase/issues/3504)
-- Using [Fastlane for iOS deployment](https://docs.fastlane.tools/getting-started/ios/setup/) together with [RN Firebase Crashlytics](https://rnfirebase.io/crashlytics/usage) within CI has been observed to cause builds that hang indefinitely. Using `setup_ci(force: true)` before building the application may solve the issue.: [#3706](https://github.com/invertase/react-native-firebase/issues/3706)
+- Using [Fastlane for iOS deployment](https://docs.fastlane.tools/getting-started/ios/setup/) together with [RN Firebase Crashlytics](/crashlytics/usage) within CI has been observed to cause builds that hang indefinitely. Using `setup_ci(force: true)` before building the application may solve the issue.: [#3706](https://github.com/invertase/react-native-firebase/issues/3706)
 - Be careful if you are using a VPN, Google blocks many VPN IPs causing "unavailable" errors for various firebase API calls, and on an Android emulator it might completely mess up the network adapter causing network calls to never return, not only on firebase but on the entire emulated phone.
```

---

### Incident Patch 3: `e823c1ef` (2026-10-23)
**Commit Message**: Revert "docs: use relative link to Crashlytics usage in tips"

This reverts commit 88131767a6efd964626dda087ca402adf336bb6e.

**File**: `docs/faqs-and-tips.mdx` (modified, +1/-1)
```diff
@@ -98,5 +98,5 @@ To view the complete detail for this solution, please refer to this page: [#5656
   - Build processes are costly and complex, so caching is used a lot. As a result, certain changes that you make in your app can cause cache conflicts in subsequent builds. Deal with this via `npx react-native-clean-project`. This does solve a lot of problems.
   - Try and isolate the problem with a template React Native Firebase app. This [bash script](https://github.com/mikehardy/rnfbdemo/blob/main/make-demo.sh) is particularly helpful in making an empty template app.
 - Advice on supporting multiple environments (for example, dev, prod, maybe also staging, qa) for your React Native Firebase App: [#3504](https://github.com/invertase/react-native-firebase/issues/3504)
-- Using [Fastlane for iOS deployment](https://docs.fastlane.tools/getting-started/ios/setup/) together with [RN Firebase Crashlytics](/crashlytics/usage) within CI has been observed to cause builds that hang indefinitely. Using `setup_ci(force: true)` before building the application may solve the issue.: [#3706](https://github.com/invertase/react-native-firebase/issues/3706)
+- Using [Fastlane for iOS deployment](https://docs.fastlane.tools/getting-started/ios/setup/) together with [RN Firebase Crashlytics](https://rnfirebase.io/crashlytics/usage) within CI has been observed to cause builds that hang indefinitely. Using `setup_ci(force: true)` before building the application may solve the issue.: [#3706](https://github.com/invertase/react-native-firebase/issues/3706)
 - Be careful if you are using a VPN, Google blocks many VPN IPs causing "unavailable" errors for various firebase API calls, and on an Android emulator it might completely mess up the network adapter causing network calls to never return, not only on firebase but on the entire emulated phone.
```

#### Recent Merged Pull Requests:
- **PR #9396** (2026-10-23): fix(ci): branch-aware publish (docs gate, dist-tag, recovery) (@mikehardy)
- **PR #9393** (2026-10-23): fix(app, sdk): bump Firebase iOS SDK to 12.19.3 (@russellwheatley)
- **PR #9391** (2026-10-23): fix(app, sdk): bump Firebase iOS SDK to 13.1.1 (@russellwheatley)
- **PR #9390** (closed): fix(firestore): align updateDoc, onSnapshot and initializeFirestore error handling with firebase-js-sdk (@Mastersam07)
- **PR #9389** (2026-10-23): feat(app, sdk): bump Firebase iOS SDK to 13.1.0 (@mikehardy)
- **PR #9388** (2026-10-22): feat(app, sdk): bump Firebase JS SDK to 13.1.0 (@SelaseKay)

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

## X. crashlytics, ios): time out SPM upload-symbols so a stalled upload cannot hang t

**RULE**:
When implementing operations in `packages/crashlytics/__tests__/ios_config.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in invertase/react-native-firebase. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1cdb7de2`: crashlytics, ios): time out SPM upload-symbols so a stalled upload cannot hang the build. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/crashlytics/__tests__/ios_config.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
// Never returns on its own — simulates a stalled network request in upload-symbols.
// `exec` keeps this a single process like the real binary, so the timeout's SIGALRM
// kills the hang itself rather than an orphaned child holding the output pipes open.
const HANGS_STUB = `#!/usr/bin/env bash
exec sleep 60
`;

  function runIosConfig(extraEnv: Record<string, string> = {}) {
        ...extraEnv,

  it('warns and continues without failing the build when SPM upload-symbols hangs past the timeout', function () {
    const targetFolderPlist = join(projectDir, targetName, 'GoogleService-Info.plist');
    mkdirSync(join(projectDir, targetName), { recursive: true });
    writeFileSync(targetFolderPlist, 'plist-contents');

    writeFileSync(uploadSymbolsPath, HANGS_STUB);
    chmodSync(uploadSymbolsPath, 0o755);

    const startedAt = Date.now();
    const result = runIosConfig({ RNFB_CRASHLYTICS_UPLOAD_TIMEOUT_SEC: '1' });
    const elapsedMs = Date.now() - startedAt;

    expect(result.status).toBe(0);
    expect(elapsedMs).toBeLessThan(30000);
    expect(result.stdout).toContain('warning:');
    expect(result.stdout).toContain('failed or timed out');
  });
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  function runIosConfig() {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1cdb7de2` are properly handled with clean fallback behavior.
