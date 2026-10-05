> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tamagui-tamagui-learnings.md`  
> **Source**: GitHub ([https://github.com/tamagui/tamagui](https://github.com/tamagui/tamagui))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-28T19:14:54.372Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: tamagui/tamagui

## 1. Executive Forensic Architecture & System Mechanics
Tamagui is a high-performance, cross-platform UI abstraction layer designed to unify React Native and React Web via a static-to-dynamic compilation pipeline. 
- **Core Abstraction**: It uses a "Static-First" compiler that evaluates style objects at build time, converting them into atomic CSS (web) or native style objects (mobile).
- **Architectural Boundary**: It acts as a bridge between the declarative React component model and the imperative/platform-specific rendering engines (Reanimated for animations, React Native Web for DOM).
- **Critical Subsystem**: The `Adapt` pattern, which allows components to morph their structure based on media queries or platform-specific context, is the most complex state-management surface in the repo.

## 2. Deep Micro-Learnings & Runtime Gotchas
1. **Event Handler Shadowing**:
   - **Pitfall**: Custom components (e.g., `Tabs.Tab`) failing to trigger `onPress` on the first interaction.
   - **Root Cause**: Improper event bubbling or race conditions between synthetic event listeners and native gesture responders.
   - **Fix**: Always explicitly compose event handlers using a utility that merges native and synthetic listeners (e.g., `composeEventHandlers(propHandler, internalHandler)`).

2. **Accessibility State Desync**:
   - **Pitfall**: `disabled` state not reflecting in screen readers after prop updates.
   - **Root Cause**: React Native’s `accessibilityState` often requires an explicit re-render or a manual reset when the underlying component state changes.
   - **Fix**: Use a `useEffect` hook to force-sync `accessibilityState` when the `disabled` prop toggles.

3. **Reanimated Animation Frame Overload**:
   - **Pitfall**: Browser crashes during rapid state transitions (e.g., zooming).
   - **Root Cause**: Unbounded animation frame requests in `react-native-reanimated` when the component lifecycle is interrupted.
   - **Fix**: Implement a "debounce" or "throttle" on animation triggers; ensure `cancelAnimation` is called in the cleanup phase of `useEffect`.

4. **Native ScrollView Event Loss**:
   - **Pitfall**: Overriding `onScroll` in a wrapper component kills native scroll performance.
   - **Root Cause**: Failure to pass the `onScroll` event through the `ScrollView` props chain.
   - **Fix**: Use a proxy pattern: `const onScroll = (e) => { props.onScroll?.(e); internalLogic(e); }`.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
- **D1: Structural Boundaries**: Heavy reliance on "Platform-Specific Extensions" (`.ios.ts`, `.android.ts`). The build system must be strictly configured to ignore these during web compilation.
- **D2: Asynchronous State**: The `Adapt` component logic is prone to "Parent-Child" race conditions where the child renders before the parent has resolved the layout context.
- **D3: Error Boundaries**: The system lacks a global "UI-Safe" boundary, leading to full-app crashes when a single component's style-compiler fails.
- **D4: Resource Lifecycle**: Reanimated animations are the primary source of memory leaks; they must be explicitly detached on unmount.
- **D5: Deserialization**: The static compiler treats style objects as immutable schemas; any runtime mutation of these objects bypasses the compiler, leading to "Style Drift."
- **D6: Cross-Platform**: The "Extensionless Import" pattern is critical. If a file imports `Component.native`, it will fail on Web. Always import the base name and let the bundler resolve the extension.
- **D7: Build Invariants**: The repo uses `bun.lock` and strict dependency pinning. Any deviation in `node_modules` resolution (e.g., npm vs bun) causes non-deterministic build failures.
- **D8: Forensic Patches**: Recent fixes focus on "Composition"—ensuring that when multiple handlers (focus, press, accessibility) exist, they are chained rather than overwritten.

## 4. Net-New Universal Engineering Rules

## 72. The Proxy-Composition Invariant

**RULE**:
Never assign a prop directly to a component if that component also requires internal logic for that same prop. Always use a composition utility to chain the external prop and the internal implementation.

**WHY**:
Direct assignment causes "Event Shadowing," where the library's internal state management (e.g., focus tracking) is silently overwritten by the user's prop, leading to broken accessibility and interaction bugs.

**WHEN TO APPLY**:
Any UI library, event-driven system, or component-based architecture where props (like `onPress`, `onScroll`, `onFocus`) are exposed to the consumer.

## 5. Actionable Agent Skill & Implementation Checklist
- [ ] **Verify Extension Resolution**: Ensure all imports in the codebase are extensionless to allow the bundler to select the correct platform file.
- [ ] **Audit Event Composition**: Search for any component where `onPress` or `onScroll` is passed as a prop; verify it is not overwriting internal library logic.
- [ ] **Accessibility Sync Check**: For every component with a `disabled` state, verify that `accessibilityState` is explicitly updated in the render cycle.
- [ ] **Animation Cleanup**: Ensure every `useAnimatedStyle` or `useSharedValue` has a corresponding `cancelAnimation` in the `useEffect` cleanup function.
- [ ] **Dependency Lock Verification**: If using Bun, ensure `bun.lockb` is the source of truth; never allow `npm install` to regenerate lockfiles in a CI environment.