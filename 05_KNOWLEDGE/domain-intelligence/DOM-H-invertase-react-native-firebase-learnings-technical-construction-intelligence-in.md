# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: invertase-react-native-firebase-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "invertase-react-native-firebase-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T14:48:47.302Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-invertase-react-native-firebase-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [invertase-react-native-firebase-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T14:48:47.302Z`  
> **Learning ID**: `LEARN-EVO-invertase-react-native-firebase-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 87%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from invertase-react-native-firebase-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/invertase-react-native-firebase-learnings.md`  
> **Source**: github ([https://github.com/invertase/react-native-firebase](https://github.com/invertase/react-native-firebase))  
> **Source Version**: `b278991e`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T14:48:37.934Z  
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
> **Harvest Timestamp**: 2026-11-18T14:48:37.929Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `invertase/react-native-firebase`
- **Description**: 🔥 A well-tested feature-rich modular Firebase implementation for React Native. Supports both iOS & Android platforms for all Firebase services.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12328 stars

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
- **Issue #9495** (2026-11-17): **build(deps): dependency updates 20261117**
  *Symptoms*: Combines open Dependabot PRs onto one branch.  **Included** - `expo-linking` 58.0.9 → 58.0.15 (#9455) - `react-native-coverage` 0.2.0 → 0.2.2 (#9454) - `react-native-reanimated` 4.7.0 → 4.7.1 (#9453) - `expo-router` 58.0.10 → 58.0.29 (#9452)  **Merge notes** - All four merged cleanly, no conflicts. - Validation run: `yarn` (install, exit 0, lockfile stable on a second install), `yarn lint:js` (clean), `yarn tsc:compile` (clean), `yarn tsc:compile:test-expo` (clean).  **Intentionally skipped** - #9450 `firebase` / `@expo/plist` (npm-minor-patch group): changes `dependencies` ranges in published packages `@react-native-firebase/app` (`firebase` 13.3.0 → 13.2.0, a downgrade vs current `main`) and `@react-native-firebase/auth` (`@expo/plist` ^0.8.1 → ^0.10.1). Consumer-facing, out of scope for a rollup. - #9383 `json` (bundler) 2.21.2 → 3.1.0: documented pin in `Gemfile` — comment says json 3.0 dropped the `quirks_mode` keyword needed for podspec JSON generation during `yarn tests:macos:pod:install`.  **Obsoletes** - Obsoletes: #9455 - Obsoletes: #9454 - Obsoletes: #9453 - Obsoletes: #9452 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9495) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/invertase/react-native-firebase?pullRequest=9495) before we can accept your contribution.<br/>**1** out of **2** committers have signed the CLA.<br/><br/>:white_check_mark: russellwheatley<br/>:x: dependabot[bot]<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/invertase/react-native-firebase?pullRequest=9495) it.</sub>
  > ## [Codecov](https://app.codecov.io/gh/invertase/react-native-firebase/pull/9495?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 75.47%. Comparing base ([`bfddcf2`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/bfddcf25cc3be90cfadd4bef80e89385e42671f8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)) to head ([`5074f75`](https://app.codecov.io/gh/invertase/react-native-firebase/commit/5074f75d48a5477bc788466085e55f194205c3a1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=invertase)). :warning: Report is 22 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@   

- **Issue #9494** (2026-11-18): **docs(messaging): fix background and quit state anchor link**
  *Symptoms*: ### Description  Fixed an incorrect anchor link in the Firebase Messaging documentation under the **Background & Quit state messages** section.  The previous URL contained an extra hyphen, resulting in an incorrect anchor reference.  **Before:** `#background--quit-state-messages`  **After:** `#background-quit-state-messages`  This change ensures the link points to the intended documentation section.  ### Related issues  N/A — Minor documentation fix.  ### Release Summary  Fixed an incorrect anchor link in the Firebase Messaging documentation.  ### Checklist  - I read the [[Contributor Guide](https://github.com/invertase/react-native-firebase/blob/main/CONTRIBUTING.md)](https://github.com/invertase/react-native-firebase/blob/main/CONTRIBUTING.md) and followed the process outlined there for submitting PRs.   - [x] Yes - My change supports the following platforms;   - [ ] `Android`   - [ ] `iOS`   - [ ] `Other` (macOS, web) - My change includes tests;   - [ ] `e2e` tests added or updated in `packages/**/e2e`   - [ ] `jest` tests added or updated in `packages/**/__tests__` - [ ] I have updated TypeScript types that are affected by my change. - This is a breaking change;   - [ ] Yes   - [x] No  ### Test Plan  - Verified that the anchor link matches the intended section. - Documentation-only change; no application code or native functionality was modified. - No automated tests required.

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

### Incident Patch 1: `b278991e` (2026-11-18)
**Commit Message**: fix(functions): map network and auth token errors to callable error codes (#9422)

Callable failures that happen before the request reaches your function (no network, or a failed Auth ID token fetch) now reject with a specific error code instead of `unknown` / `internal`, and iOS and Android now agree.

Error code changes for httpsCallable() calls:
- iOS, network failure (offline, host not found, connection refused, ATS block, untrusted certificate): `unknown` -> `unavailable`. Android already reported `unavailable`.
- iOS and Android, Auth network error while fetching the ID token: `unknown` -> `unavailable`.
- iOS and Android, signed-in user is disabled, deleted, or has an invalid or expired token: `unknown` -> `unauthenticated`.

Error code changes for httpsCallable().stream():
- iOS, Auth token fetch fails with one of the errors above: `invalid-argument` -> `unavailable` / `unauthenticated`.
- Android, same failures: `internal` ("Error retrieving context") -> `unavailable` / `unauthenticated`.
- iOS, network failure: still `unavailable`.

Other changes for the errors above:
- `message` is now the underlying native error's message.
- `details` is now `{ domain, nativeCode }` ins

**File**: `docs/functions/usage/index.mdx` (modified, +17/-0)
```diff
@@ -238,6 +238,23 @@ async function callWithErrorHandling() {
 }
 ```
 
+## Error codes
+
+A failed call rejects with an `HttpsError` whose `code` is one of the Cloud Functions error codes. On iOS and Android, two
+native failures that happen before the call reaches your function are mapped as well, for both `httpsCallable` calls and
+streams:
+
+- A network failure reaching the Functions endpoint, or fetching the signed-in user's Auth token, rejects with `unavailable`.
+- A signed-in user that is invalid, expired, disabled or deleted rejects with `unauthenticated`.
+
+To help diagnose these failures, `details` includes the native error `domain` and `nativeCode`: on iOS for network and
+Auth token errors (`nativeCode` is the `NSError` code, a number), and on Android for Auth token errors (`nativeCode` is
+the Auth error code string, or `null` for a network error).
+
+`unavailable` also covers network failures that retrying won't fix, such as an App Transport Security block or a server
+certificate the device doesn't trust. On iOS, check `details.nativeCode` (for example `-1022` or `-1202` in
+`NSURLErrorDomain`) to tell them apart from a device that is offline.
+
 ## Region-specific Functions
 
 If you deploy callables in a region other than `us-central1`, pass that region to `getFunctions` for both emulator connection and callable creation:
```

**File**: `packages/functions/android/build.gradle` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ dependencies {
   implementation "com.google.firebase:firebase-functions"
 
   testImplementation "junit:junit:4.13.2"
+  testImplementation "org.robolectric:robolectric:4.14.1"
 }
 
 ReactNative.shared.applyPackageVersion()
```

**File**: `packages/functions/android/src/main/java/io/invertase/firebase/functions/NativeRNFBTurboFunctions.java` (modified, +4/-62)
```diff
@@ -28,14 +28,12 @@
 import com.google.android.gms.tasks.Tasks;
 import com.google.firebase.FirebaseApp;
 import com.google.firebase.functions.FirebaseFunctions;
-import com.google.firebase.functions.FirebaseFunctionsException;
 import com.google.firebase.functions.HttpsCallableOptions;
 import com.google.firebase.functions.HttpsCallableReference;
 import com.google.firebase.functions.StreamResponse;
 import io.invertase.firebase.common.RCTConvertFirebase;
 import io.invertase.firebase.common.ReactNativeFirebaseEventEmitter;
 import io.invertase.firebase.common.TaskExecutorService;
-import java.io.IOException;
 import java.net.URL;
 import java.util.concurrent.ExecutorService;
 import java.util.concurrent.TimeUnit;
@@ -358,68 +356,12 @@ private void handleFunctionsException(Exception exception, Promise promise) {
   }
 
   private WritableMap createErrorMap(Throwable throwable) {
-    Object details = null;
-    String code = "UNKNOWN";
-    String message = throwable.getMessage() != null ? throwable.getMessage() : throwable.toString();
-
-    // Check if the throwable contains a FirebaseFunctionsException
-    if (throwable.getCause() != null
-        && throwable.getCause() instanceof FirebaseFunctionsException functionsException) {
-      details = functionsException.getDetails();
-      code = functionsException.getCode().name();
-      message = functionsException.getMessage();
-
-      // For streaming callables, check if details contains a "status" & "message" field with the
-      // correct values
-      if (details instanceof java.util.Map) {
-        @SuppressWarnings("unchecked")
-        java.util.Map<String, Object> detailsMap = (java.util.Map<String, Object>) details;
-        if (detailsMap.containsKey("status") && detailsMap.get("status") instanceof String) {
-          code = (String) detailsMap.get("status");
-        }
-        if (detailsMap.containsKey("message") && detailsMap.get("message") instanceof String) {
-          message = (String) detailsMap.get("message");
-        }
-      }
-
-      String timeout = FirebaseFunctionsException.Code.DEADLINE_EXCEEDED.name();
-      boolean isTimeout = code.contains(timeout);
-
-      if (functionsException.getCause() instanceof IOException && !isTimeout) {
-        code = FirebaseFunctionsException.Code.UNAVAILABLE.name();
-        message = FirebaseFunctionsException.Code.UNAVAILABLE.name();
-      }
-    } else if (throwable instanceof FirebaseFunctionsException functionsException) {
-      details = functionsException.getDetails();
-      code = functionsException.getCode().name();
-      message = functionsException.getMessage();
-
-      // For streaming callables, check if details contains a "status" & "message" field with the
-      // correct values
-      if (details instanceof java.util.Map) {
-        @SuppressWarnings("unchecked")
-        java.util.Map<String, Object> detailsMap = (java.util.Map<String, Object>) details;
-        if (detailsMap.containsKey("status") && detailsMap.get("status") instanceof String) {
-          code = (String) detailsMap.get("status");
-        }
-        if (detailsMap.containsKey("message") && detailsMap.get("message") instanceof String) {
-          message = (String) detailsMap.get("message");
-        }
-      }
-
-      String timeout = FirebaseFunctionsException.Code.DEADLINE_EXCEEDED.name();
-      boolean isTimeout = code.contains(timeout);
-
-      if (functionsException.getCause() instanceof IOException && !isTimeout) {
-        code = FirebaseFunctionsException.Code.UNAVAILABLE.name();
-        message = FirebaseFunctionsException.Code.UNAVAILABLE.name();
-      }
-    }
+    RNFBFunctionsError error = RNFBFunctionsError.from(throwable);
 
     WritableMap errorMap = Arguments.createMap();
-    errorMap.putString(CODE_KEY, code);
-    errorMap.putString(MSG_KEY, message);
-    RCTConvertFirebase.mapPutValue(DETAILS_KEY, details, errorMap);
+    errorMap.putString(CODE_KEY, error.code);
+    errorMap.putString(MSG_KEY, error.message);
+    RCTConvertFirebase.mapPutValue(DETAILS_KEY, error.details, errorMap);
 
     return errorMap;
   }
```

**File**: `packages/functions/android/src/main/java/io/invertase/firebase/functions/RNFBFunctionsError.java` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+package io.invertase.firebase.functions;
+
+/*
+ * Copyright (c) 2016-present Invertase Limited & Contributors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this library except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *   http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+import com.google.firebase.FirebaseNetworkException;
+import com.google.firebase.auth.FirebaseAuthException;
+import com.google.firebase.functions.FirebaseFunctionsException;
+import java.io.IOException;
+import java.util.Arrays;
+import java.util.Collections;
+import java.util.HashMap;
+import java.util.HashSet;
+import java.util.IdentityHashMap;
+import java.util.Map;
+import java.util.Set;
+import javax.annotation.Nullable;
+
+/**
+ * The code, message and details a failed callable reports to JS, derived from the throwable the
+ * call or stream failed with.
+ */
+final class RNFBFunctionsError {
+  static final String DOMAIN_KEY = "domain";
+  static final String NATIVE_CODE_KEY = "nativeCode";
+
+  /**
+   * The {@code details.domain} reported for Auth ID token fetch failures. Fixed strings rather than
+   * the thrown class name, which varies by Auth exception subclass and can be renamed by R8.
+   */
+  static final String NETWORK_ERROR_DOMAIN = "com.google.firebase.FirebaseNetworkException";
+
+  static final String AUTH_ERROR_DOMAIN = "com.google.firebase.auth.FirebaseAuthException";
+
+  /**
+   * Firebase Auth error codes for a signed-in credential that is gone for good. Every other Auth
+   * code (rate limit, internal, app configuration) leaves the credential valid.
+   */
+  private static final Set<String> DEAD_CREDENTIAL_AUTH_ERROR_CODES =
+      new HashSet<>(
+          Arrays.asList(
+              "ERROR_USER_DISABLED",
+              "ERROR_USER_NOT_FOUND",
+              "ERROR_INVALID_USER_TOKEN",
+              "ERROR_USER_TOKEN_EXPIRED"));
+
+  private static final String UNKNOWN = "UNKNOWN";
+  private static final String UNAVAILABLE = FirebaseFunctionsException.Code.UNAVAILABLE.name();
+  private static final String UNAUTHENTICATED =
+      FirebaseFunctionsException.Code.UNAUTHENTICATED.name();
+  private static final String DEADLINE_EXCEEDED =
+      FirebaseFunctionsException.Code.DEADLINE_EXCEEDED.name();
+
+  final String code;
+  final String message;
+  @Nullable final Object details;
+
+  private RNFBFunctionsError(String code, String message, @Nullable Object details) {
+    this.code = code;
+    this.message = message;
+    this.details = details;
+  }
+
+  /**
+   * Maps a callable failure to its JS error.
+   *
+   * <p>An Auth ID token fetch that fails before the request is sent arrives wrapped in {@code
+   * ExecutionException}s (and, for streams, a {@code FirebaseFunctionsException} INTERNAL), so the
+   * whole cause chain is searched for it: a network error maps to UNAVAILABLE and a dead credential
+   * to UNAUTHENTICATED, with the underlying exception's message and {@code {domain, nativeCode}}
+   * details. Other Auth errors fall through unchanged.
+   *
+   * <p>Otherwise a {@link FirebaseFunctionsException} (the throwable or its cause) supplies code,
+   * message and details, a streaming error's {@code status} / {@code message} details override
+   * them, and an {@link IOException} cause that is not a timeout maps to UNAVAILABLE. Anything else
+   * is UNKNOWN with the throwable's message.
+   */
+  static RNFBFunctionsError from(Throwable throwable) {
+    RNFBFunctionsError authTokenError = fromAuthTokenFailure(throwable);
+    if (authTokenError != null) {
+      return authTokenError;
+    }
+
+    FirebaseFunctionsException functionsException = null;
+    if (throwable.getCause() instanceof FirebaseFunctionsException causeException) {
+      functionsException = causeException;
+    } else if (throwable instanceof FirebaseFunctionsException exception) {
+      functionsException = exception;
+    }
+
+    if (functionsException == null) {
+      return new RNFBFunctionsError(UNKNOWN, messageOf(throwable), null);
+    }
+
+    Object details = functionsException.getDetails();
+    String code = functionsException.getCode().name();
+    String message = functionsException.getMessage();
+
+    if (details instanceof Map<?, ?> detailsMap) {
+      if (detailsMap.get("status") instanceof String status) {
+        code = status;
+      }
+      if (detailsMap.get("message") instanceof String detailsMessage) {
+        message = detailsMessage;
+      }
+    }
+
+    if (functionsException.getCause() instanceof IOException && !code.contains(DEADLINE_EXCEEDED
```

**File**: `packages/functions/android/src/test/java/io/invertase/firebase/functions/RNFBFunctionsErrorTest.java` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+package io.invertase.firebase.functions;
+
+/*
+ * Copyright (c) 2016-present Invertase Limited & Contributors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this library except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *   http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+import static org.junit.Assert.assertEquals;
+import static org.junit.Assert.assertNull;
+import static org.junit.Assert.assertSame;
+
+import com.google.firebase.FirebaseNetworkException;
+import com.google.firebase.auth.FirebaseAuthException;
+import com.google.firebase.functions.FirebaseFunctionsException;
+import java.io.IOException;
+import java.net.SocketTimeoutException;
+import java.util.HashMap;
+import java.util.Map;
+import java.util.concurrent.ExecutionException;
+import org.junit.Test;
+import org.junit.runner.RunWith;
+import org.robolectric.RobolectricTestRunner;
+
+/**
+ * JVM coverage for {@link RNFBFunctionsError}. Auth failures are wrapped the way the SDK delivers
+ * them: {@code Tasks.await}'s {@code ExecutionException} around {@code Tasks.whenAll}'s {@code
+ * ExecutionException} for calls, and a {@code FirebaseFunctionsException} INTERNAL around the same
+ * {@code whenAll} failure for streams. Robolectric supplies the Android classes the Firebase
+ * exceptions use ({@code TextUtils}, and {@code SparseArray} in {@code
+ * FirebaseFunctionsException.Code}); mocking them instead would leave {@code Code} initialized
+ * against a mock for the rest of the JVM. AndroidTest-AD-1.
+ */
+@RunWith(RobolectricTestRunner.class)
+public class RNFBFunctionsErrorTest {
+
+  private static final String DOMAIN = RNFBFunctionsError.DOMAIN_KEY;
+  private static final String NATIVE_CODE = RNFBFunctionsError.NATIVE_CODE_KEY;
+
+  private static Exception asCallFailure(Exception tokenFailure) {
+    return new ExecutionException(
+        new ExecutionException("1 out of 2 underlying tasks failed", tokenFailure));
+  }
+
+  private static Exception asStreamFailure(Exception tokenFailure) {
+    return new FirebaseFunctionsException(
+        "Error retrieving context",
+        FirebaseFunctionsException.Code.INTERNAL,
+        null,
+        new ExecutionException("1 out of 2 underlying tasks failed", tokenFailure));
+  }
+
+  private static Map<?, ?> detailsOf(RNFBFunctionsError error) {
+    return (Map<?, ?>) error.details;
+  }
+
+  // Auth ID token fetch failures
+
+  @Test
+  public void authNetworkError_onCall_isUnavailable() {
+    RNFBFunctionsError error =
+        RNFBFunctionsError.from(asCallFailure(new FirebaseNetworkException("network down")));
+
+    assertEquals("UNAVAILABLE", error.code);
+    assertEquals("network down", error.message);
+    assertEquals("com.google.firebase.FirebaseNetworkException", detailsOf(error).get(DOMAIN));
+    assertNull(detailsOf(error).get(NATIVE_CODE));
+    assertEquals(2, detailsOf(error).size());
+  }
+
+  @Test
+  public void authNetworkError_onStream_isUnavailable() {
+    RNFBFunctionsError error =
+        RNFBFunctionsError.from(asStreamFailure(new FirebaseNetworkException("network down")));
+
+    assertEquals("UNAVAILABLE", error.code);
+    assertEquals("network down", error.message);
+  }
+
+  @Test
+  public void authNetworkError_asTheThrowable_isUnavailable() {
+    RNFBFunctionsError error = RNFBFunctionsError.from(new FirebaseNetworkException("offline"));
+
+    assertEquals("UNAVAILABLE", error.code);
+    assertEquals("offline", error.message);
+  }
+
+  @Test
+  public void deadCredential_onCall_isUnauthenticated() {
+    String[] deadCredentialCodes = {
+      "ERROR_USER_DISABLED",
+      "ERROR_USER_NOT_FOUND",
+      "ERROR_INVALID_USER_TOKEN",
+      "ERROR_USER_TOKEN_EXPIRED",
+    };
+    for (String authCode : deadCredentialCodes) {
+      RNFBFunctionsError error =
+          RNFBFunctionsError.from(asCallFailure(new FirebaseAuthException(authCode, "gone")));
+
+      assertEquals(authCode, "UNAUTHENTICATED", error.code);
+      assertEquals(authCode, "gone", error.message);
+      assertEquals(
+          authCode, "com.google.firebase.auth.FirebaseAuthException", detailsOf(error).get(DOMAIN));
+      assertEquals(authCode, authCode, detailsOf(error).get(NATIVE_CODE));
+    }
+  }
+
+  @Test
+  public void deadCredential_onStream_isUnauthenticated() {
+    RNFBFunctionsError error =
+        RNFBFunctionsError.from(
+            asStreamFailure(new FirebaseAuthException("ERROR_USER_DISABLED", "disabled")));
+
+    assertEquals("UNAUTHENTICATED", error.code);
+    assertEquals("disabled", error.message);
+    assertEquals("ERRO
```

**File**: `packages/functions/e2e/functions.e2e.js` (modified, +60/-0)
```diff
@@ -114,6 +114,19 @@ function assertHttpsErrorMessage(actual, base) {
   }
 }
 
+// Nothing listens on port 1, so the connection is refused.
+function unreachableCallableUrl() {
+  return `http://${getE2eEmulatorHost()}:1/react-native-firebase-testing/us-central1/helloWorldV2`;
+}
+
+function assertUnreachableHostError(e) {
+  e.code.should.equal('unavailable');
+  if (Platform.ios) {
+    e.details.domain.should.equal('NSURLErrorDomain');
+    e.details.nativeCode.should.equal(-1004);
+  }
+}
+
 describe('functions() modular', function () {
   describe('modular', function () {
     describe('getFunctions', function () {
@@ -269,6 +282,29 @@ describe('functions() modular', function () {
         const response = await functionRunner();
         response.data.should.equal('Hello from Firebase!');
       });
+
+      it('errors with unavailable when the host cannot be reached', async function () {
+        if (Platform.other) {
+          return this.skip();
+        }
+        const { getApp } = modular;
+        const { getFunctions, httpsCallableFromUrl } = functionsModular;
+
+        const functionRunner = httpsCallableFromUrl(
+          getFunctions(getApp()),
+          unreachableCallableUrl(),
+          e2eCallableTimeoutOptions(),
+        );
+
+        try {
+          await functionRunner();
+          return Promise.reject(new Error('Function did not reject with error.'));
+        } catch (e) {
+          assertUnreachableHostError(e);
+        }
+
+        return Promise.resolve();
+      });
     });
 
     describe('httpsCallable(fnName)(args)', function () {
@@ -1181,6 +1217,30 @@ describe('functions() modular', function () {
         result.should.be.an.Object();
       });
 
+      it('errors with unavailable when the host cannot be reached', async function () {
+        if (Platform.other) {
+          return this.skip();
+        }
+        const { getApp } = modular;
+        const { getFunctions, httpsCallableFromUrl } = functionsModular;
+        const functionRunner = httpsCallableFromUrl(
+          getFunctions(getApp()),
+          unreachableCallableUrl(),
+          e2eCallableTimeoutOptions(),
+        );
+
+        try {
+          const { stream } = await functionRunner.stream();
+          for await (const _ of stream) {
+          }
+          return Promise.reject(new Error('Stream did not reject with error.'));
+        } catch (e) {
+          assertUnreachableHostError(e);
+        }
+
+        return Promise.resolve();
+      });
+
       it('should return both stream and data promise for URL', async function () {
         const { getApp } = modular;
         const { getFunctions, httpsCallableFromUrl } = functionsModular;
```

**File**: `packages/functions/ios/RNFBFunctions/RNFBFunctionsCallHandler.swift` (modified, +9/-2)
```diff
@@ -152,16 +152,19 @@ import FirebaseCore
   }
   
   /// Static method to format error for JavaScript (shared utility)
-  /// - Parameter error: The error to format
+  /// - Parameter receivedError: The error to format
   /// - Returns: Dictionary containing error code, message, and details
-  @objc public static func formatError(_ error: NSError) -> [AnyHashable: Any] {
+  @objc public static func formatError(_ receivedError: NSError) -> [AnyHashable: Any] {
+    let error = RNFBFunctionsNativeErrorMapping.reportedError(for: receivedError)
     var details: Any = NSNull()
     let message = error.localizedDescription
     
     if error.domain == "com.firebase.functions" {
       if let errorDetails = error.userInfo["details"] {
         details = errorDetails
       }
+    } else if let nativeDetails = RNFBFunctionsNativeErrorMapping.details(for: error) {
+      details = nativeDetails
     }
     
     return [
@@ -181,6 +184,10 @@ import FirebaseCore
       code = mapFunctionsErrorCode(error.code)
     }
     
+    if let nativeCode = RNFBFunctionsNativeErrorMapping.code(for: error) {
+      code = nativeCode
+    }
+
     if error.domain == "FirebaseFunctions.FunctionsSerializer.Error" {
       NSLog("RNFBFUNCTIONS error description: %@", error.description)
       let errorDescription = error.description
```

**File**: `packages/functions/ios/RNFBFunctions/RNFBFunctionsNativeErrorMapping.swift` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+/**
+ * Copyright (c) 2016-present Invertase Limited & Contributors
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this library except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *   http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import Foundation
+
+/// Maps callable errors raised below FirebaseFunctions (transport and Auth ID token fetch)
+/// to callable error codes, and describes them for the JS `details` field.
+enum RNFBFunctionsNativeErrorMapping {
+  /// FirebaseAuth's error domain and the `FIRAuthErrorCode` values mapped below.
+  /// Spelled out because this module does not link FirebaseAuth.
+  private static let authErrorDomain = "FIRAuthErrorDomain"
+  /// `FIRAuthErrorCodeNetworkError`.
+  private static let authNetworkErrorCode = 17020
+  /// The signed-in credential is gone for good: `UserDisabled` (17005), `UserNotFound` (17011),
+  /// `InvalidUserToken` (17017) and `UserTokenExpired` (17021). Every other Auth code (keychain,
+  /// rate limit, internal, app configuration) leaves the credential valid.
+  private static let deadCredentialAuthErrorCodes: Set<Int> = [17005, 17011, 17017, 17021]
+  /// `FunctionsErrorDomain` and the `FunctionsErrorCode` values that `stream()` uses to wrap
+  /// failures before a response: `invalidArgument` (3) around the Auth ID token fetch and
+  /// `unavailable` (14) around the transport. Spelled out so this file needs only Foundation.
+  private static let functionsErrorDomain = "com.firebase.functions"
+  private static let functionsPreResponseWrapperCodes: Set<Int> = [3, 14]
+
+  /// Returns the error to report for `error`: the wrapped error when FirebaseFunctions wrapped a
+  /// transport or Auth error that `code(for:)` maps before a response, otherwise `error` itself.
+  ///
+  /// Callable calls receive transport and Auth errors unwrapped; `stream()` wraps them under
+  /// `NSUnderlyingErrorKey`. Reporting the wrapped error gives both the same `code` and `details`.
+  /// An unmapped Auth error keeps the wrapper, so it is reported unchanged.
+  static func reportedError(for error: NSError) -> NSError {
+    guard error.domain == functionsErrorDomain,
+          functionsPreResponseWrapperCodes.contains(error.code),
+          let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError,
+          code(for: underlying) != nil
+    else {
+      return error
+    }
+    return underlying
+  }
+
+  /// Returns the callable error code for `error`, or `nil` when it has no mapping here.
+  ///
+  /// Every `NSURLErrorDomain` error is a transport failure (`UNAVAILABLE`, matching Android's
+  /// `IOException`); FirebaseFunctions already reports timeouts as its own `deadlineExceeded`.
+  /// For Auth, a network error is transient and a dead credential needs a new sign-in; any other
+  /// Auth code has no mapping and stays `UNKNOWN`, reported through `details(for:)`.
+  static func code(for error: NSError) -> String? {
+    switch error.domain {
+    case NSURLErrorDomain:
+      return "UNAVAILABLE"
+    case authErrorDomain where error.code == authNetworkErrorCode:
+      return "UNAVAILABLE"
+    case authErrorDomain where deadCredentialAuthErrorCodes.contains(error.code):
+      return "UNAUTHENTICATED"
+    default:
+      return nil
+    }
+  }
+
+  /// Returns the native `domain` and `nativeCode` of a transport or Auth error, or `nil` for
+  /// any other domain.
+  static func details(for error: NSError) -> [String: Any]? {
+    guard error.domain == NSURLErrorDomain || error.domain == authErrorDomain else {
+      return nil
+    }
+    return ["domain": error.domain, "nativeCode": error.code]
+  }
+}
```

---

### Incident Patch 2: `597d7ead` (2026-11-17)
**Commit Message**: build(deps): dependency updates 20261117 (#9495)

* build(deps): bump expo-router from 58.0.10 to 58.0.29

Bumps [expo-router](https://github.com/expo/expo/tree/HEAD/packages/expo-router) from 58.0.10 to 58.0.29.
- [Release notes](https://github.com/expo/expo/releases)
- [Changelog](https://github.com/expo/expo/blob/expo-router@58.0.29/packages/expo-router/CHANGELOG.md)
- [Commits](https://github.com/expo/expo/commits/expo-router@58.0.29/packages/expo-router)

---
updated-dependencies:
- dependency-name: expo-router
  dependency-version: 58.0.29
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* build(deps): bump react-native-reanimated from 4.7.0 to 4.7.1

Bumps [react-native-reanimated](https://github.com/software-mansion/react-native-reanimated/tree/HEAD/packages/react-native-reanimated) from 4.7.0 to 4.7.1.
- [Release notes](https://github.com/software-mansion/react-native-reanimated/releases)
- [Changelog](https://github.com/software-mansion/react-native-reanimated/blob/4.7.1/packages/react-native-reanimated/CHANGELOG.md)
- [Commits](https://github.com/software-mansion/react-native-reanimate

**File**: `tests/package.json` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@
     "qrcode-generator": "^2.0.4",
     "react": "19.3.0",
     "react-native": "0.88.0-rc.3",
-    "react-native-coverage": "0.2.0",
+    "react-native-coverage": "0.2.2",
     "react-native-device-info": "^15.0.2",
     "util": "^0.12.5"
   },
```

**File**: `yarn.lock` (modified, +149/-90)
```diff
@@ -3014,6 +3014,17 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@expo/env@npm:~2.5.4":
+  version: 2.5.4
+  resolution: "@expo/env@npm:2.5.4"
+  dependencies:
+    chalk: "npm:^4.0.0"
+    debug: "npm:^4.3.4"
+    getenv: "npm:^2.0.0"
+  checksum: 10/78799754728307ac0933a217c2e8b53693ba189bd0f1551ae5c2ad6c62bfd27d074b925b6d339259a12c2b12bbec19bef58f23863aa3f8f23177de47a1e380f3
+  languageName: node
+  linkType: hard
+
 "@expo/fingerprint@npm:0.16.6":
   version: 0.16.6
   resolution: "@expo/fingerprint@npm:0.16.6"
@@ -3142,6 +3153,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@expo/log-box-utils@npm:^58.0.2":
+  version: 58.0.2
+  resolution: "@expo/log-box-utils@npm:58.0.2"
+  checksum: 10/2edc3c8467a3a296b844dd57faf19723cdef37dbdab627b66ed0307ca423e9e741c5b3d032a00e0ae4c1087ddee5c9996d69b6adeeef8ad4ed69fdd5325ead73
+  languageName: node
+  linkType: hard
+
 "@expo/log-box@npm:55.0.11":
   version: 55.0.11
   resolution: "@expo/log-box@npm:55.0.11"
@@ -3158,6 +3176,26 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@expo/log-box@npm:^58.0.15":
+  version: 58.0.15
+  resolution: "@expo/log-box@npm:58.0.15"
+  dependencies:
+    "@expo/dom-webview": "npm:^58.0.2"
+    "@expo/log-box-utils": "npm:^58.0.2"
+    anser: "npm:^1.4.9"
+    stacktrace-parser: "npm:^0.1.10"
+  peerDependencies:
+    "@expo/dom-webview": ^58.0.2
+    expo: "*"
+    react: "*"
+    react-native: "*"
+  peerDependenciesMeta:
+    expo:
+      optional: true
+  checksum: 10/154872f5683cbe9c6378d50be062472a218fac5fb4344e9ac6d974970dccd8448db8f87d577bf199e95e54773b9f5fbe1d08d05f5fac53631996a69db6bfdfa1
+  languageName: node
+  linkType: hard
+
 "@expo/log-box@npm:^58.0.7":
   version: 58.0.7
   resolution: "@expo/log-box@npm:58.0.7"
@@ -3265,25 +3303,25 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@expo/metro-runtime@npm:^58.0.9":
-  version: 58.0.9
-  resolution: "@expo/metro-runtime@npm:58.0.9"
+"@expo/metro-runtime@npm:^58.0.17":
+  version: 58.0.17
+  resolution: "@expo/metro-runtime@npm:58.0.17"
   dependencies:
-    "@expo/log-box": "npm:^58.0.7"
+    "@expo/log-box": "npm:^58.0.15"
     anser: "npm:^1.4.9"
     pretty-format: "npm:^29.7.0"
     stacktrace-parser: "npm:^0.1.10"
     whatwg-fetch: "npm:^3.0.0"
   peerDependencies:
-    "@expo/log-box": ^58.0.7
+    "@expo/log-box": ^58.0.15
     expo: "*"
     react: "*"
     react-dom: "*"
     react-native: "*"
   peerDependenciesMeta:
     react-dom:
       optional: true
-  checksum: 10/828e3122794034c3beadb2fd7bba7f50ac69691d9c132419bd3f233fa6c34bd91cfb633c2d31a7496add6a8e341aec3512770d29096264a64bccf4ee340f98a0
+  checksum: 10/731d99cfe5f0cd1f04a91bf2b1f71e7c5e6b117c64da356b22f2bf3b41db6cc08f3e428038573a8732dbece510c2446af4e456c20b9be5d07ee3529037fe8100
   languageName: node
   linkType: hard
 
@@ -3480,6 +3518,22 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@expo/require-utils@npm:^58.0.5":
+  version: 58.0.5
+  resolution: "@expo/require-utils@npm:58.0.5"
+  dependencies:
+    "@babel/code-frame": "npm:^7.20.0"
+    "@babel/core": "npm:^7.25.2"
+    "@babel/plugin-transform-modules-commonjs": "npm:^7.24.8"
+  peerDependencies:
+    typescript: ^5.0.0 || ^5.0.0-0 || ^6.0.0 || ^7.0.0
+  peerDependenciesMeta:
+    typescript:
+      optional: true
+  checksum: 10/e7f7ee8c29e03078540fd54f64c54c737387891a0fe15e6eff1ee12bd05e21753a65cea74dfc9d1a0abe084d6b2492a62987058b0b0064c1d323ba8e8c9cb478
+  languageName: node
+  linkType: hard
+
 "@expo/router-server@npm:^55.0.15":
   version: 55.0.15
   resolution: "@expo/router-server@npm:55.0.15"
@@ -3550,6 +3604,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@expo/schema-utils@npm:^58.0.3":
+  version: 58.0.3
+  resolution: "@expo/schema-utils@npm:58.0.3"
+  checksum: 10/6c9822e0be87d730f215479bd874fb659dcf3f2e63429bb5171c0b3168f4fbf0dff9dd724df452c8910e548bda5f4d73f754470ff277bb6cdbb8ceb01a91052a
+  languageName: node
+  linkType: hard
+
 "@expo/sdk-runtime-versions@npm:^1.0.0":
   version: 1.0.0
   resolution: "@expo/sdk-runtime-versions@npm:1.0.0"
@@ -8605,6 +8666,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@react-native/normalize-colors@npm:0.88.1":
+  version: 0.88.1
+  resolution: "@react-native/normalize-colors@npm:0.88.1"
+  checksum: 10/7295b9bf111c817d49894b5ba53e42ff61698c798ba32456dc31282960d776f56e9f4abbf4e6f2f36c40e0e8860542a5671ac15267f89d50f6ef38a7b5a72ccc
+  languageName: node
+  linkType: hard
+
 "@react-native/virtualized-lists@npm:0.78.3":
   version: 0.78.3
   resolution: "@react-native/virtualized-lists@npm:0.78.3"
@@ -12908,13 +12976,6 @@ __metadata:
   languageName: node
   linkType: hard
 
-"decode-uri-component@npm:^0.2.2":
-  version: 0.2.2
-  resolution: "decode-uri-component@npm:0.2.2"
-  checksum: 10/17a0e5fa400bf9ea84432226e252aa7b5e72793e16bf80b907c99b46a799aeacc139ec20ea57121e50c7bd875a1a4365928f884e92abf02e21a5a13790a0f33e
-  languageName: node
-  linkType: hard
-
 "dedent@npm:1.5.3":
   version: 1.5.3
  
```

---

### Incident Patch 3: `2b955148` (2026-11-18)
**Commit Message**: docs(messaging): fix background and quit state anchor link (#9494)

**File**: `docs/messaging/notifications.mdx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ previous: /messaging/ios-permissions
 - Native Firebase config completed per [Getting Started](/) (Android `google-services.json`, iOS `GoogleService-Info.plist`, Expo config plugin, or React Native CLI setup).
 - On iOS, complete [iOS Messaging Setup](/messaging/usage/ios-setup) and request notification permission (see [iOS Permissions](/messaging/ios-permissions)).
 - On Android API 33+, request `POST_NOTIFICATIONS` before expecting notification UI.
-- Register `setBackgroundMessageHandler` in the entry file before `AppRegistry.registerComponent` if you handle background/quit messages (see [Cloud Messaging usage](/messaging/usage#background--quit-state-messages)).
+- Register `setBackgroundMessageHandler` in the entry file before `AppRegistry.registerComponent` if you handle background/quit messages (see [Cloud Messaging usage](/messaging/usage#background-quit-state-messages)).
 
 Notifications are an important tool used on the majority of Android & iOS applications, used to improve user
 experience, used to engage users with your application and much more. The Cloud Messaging module provides basic support for
```

**File**: `docs/messaging/usage/index.mdx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ previous: /functions/writing-deploying-functions
 - Install Messaging: `npm install --save @react-native-firebase/messaging` or `yarn add @react-native-firebase/messaging`, then rebuild native apps (`cd ios && pod install` on iOS).
 - **iOS:** complete [iOS Messaging Setup](/messaging/usage/ios-setup) (Push Notifications capability, Background Modes with Background fetch + Remote notifications, APNs key linked in Firebase Console) before expecting FCM delivery on a physical device.
 - **Android API 33+:** request `POST_NOTIFICATIONS` (see [Android - Requesting permissions](/messaging/usage#android---requesting-permissions)) before expecting notification UI.
-- Register `setBackgroundMessageHandler` in the app **entry file** (for example `index.js`), **before** `AppRegistry.registerComponent`, not inside a React component. See [Background & Quit state messages](/messaging/usage#background--quit-state-messages).
+- Register `setBackgroundMessageHandler` in the app **entry file** (for example `index.js`), **before** `AppRegistry.registerComponent`, not inside a React component. See [Background & Quit state messages](/messaging/usage#background-quit-state-messages).
 
 Example Expo Router screen: https://github.com/invertase/react-native-firebase/blob/main/test-expo/app/messaging.tsx
 
```

#### Recent Merged Pull Requests:
- **PR #9495** (2026-11-17): build(deps): dependency updates 20261117 (@russellwheatley)
- **PR #9494** (2026-11-18): docs(messaging): fix background and quit state anchor link (@AbdElRahmanMostafa1)
- **PR #9492** (2026-11-16): fix(android): tolerate deprecated JNI invokeJavaMethod on RN 0.89+ (@mikehardy)
- **PR #9491** (closed): build(deps): bump addressable from 2.9.0 to 2.9.1 (@dependabot[bot])
- **PR #9490** (2026-11-16): build(deps): dependency updates 20261113 (@russellwheatley)
- **PR #9489** (2026-11-16): feat(app, sdk): bump Firebase JS SDK to 13.3.0 (@SelaseKay)

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

## X. functions): map network and auth token errors to callable error codes

**RULE**:
When implementing operations in `docs/functions/usage/index.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in invertase/react-native-firebase. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b278991e`: functions): map network and auth token errors to callable error codes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/functions/usage/index.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
## Error codes

A failed call rejects with an `HttpsError` whose `code` is one of the Cloud Functions error codes. On iOS and Android, two
native failures that happen before the call reaches your function are mapped as well, for both `httpsCallable` calls and
streams:

- A network failure reaching the Functions endpoint, or fetching the signed-in user's Auth token, rejects with `unavailable`.
- A signed-in user that is invalid, expired, disabled or deleted rejects with `unauthenticated`.

To help diagnose these failures, `details` includes the native error `domain` and `nativeCode`: on iOS for network and
Auth token errors (`nativeCode` is the `NSError` code, a number), and on Android for Auth token errors (`nativeCode` is
the Auth error code string, or `null` for a network error).

`unavailable` also covers network failures that retrying won't fix, such as an App Transport Security block or a server
certificate the device doesn't trust. On iOS, check `details.nativeCode` (for example `-1022` or `-1202` in
`NSURLErrorDomain`) to tell them apart from a device that is offline.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b278991e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
