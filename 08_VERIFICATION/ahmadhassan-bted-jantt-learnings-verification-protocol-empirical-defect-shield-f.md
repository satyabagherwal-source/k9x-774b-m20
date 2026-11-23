# Verification Protocol: Verification Protocol: Empirical Defect Shield for ahmadhassan-bted-jantt-learnings

<!-- PROVENANCE_START
{
  "source_repository": "ahmadhassan-bted-jantt-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T07:28:52.784Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-ahmadhassan-bted-jantt-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ahmadhassan-bted-jantt-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T07:28:52.784Z`  
> **Learning ID**: `LEARN-EVO-ahmadhassan-bted-jantt-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `ahmadhassan-bted-jantt-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ahmadhassan-bted-jantt-learnings.md`  
> **Source**: github ([https://github.com/AhmadHassan-BTed/Jantt](https://github.com/AhmadHassan-BTed/Jantt))  
> **Source Version**: `49407b4a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T07:28:36.289Z  
> **Learning ID**: `learn-github-ahmadhassan-bted-jantt`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): AhmadHassan-BTed/Jantt

> **Canonical Artifact**: `07_PROJECT_LEARNING/ahmadhassan-bted-jantt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AhmadHassan-BTed/Jantt](https://github.com/AhmadHassan-BTed/Jantt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T07:28:36.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AhmadHassan-BTed/Jantt`
- **Description**: Create interactive Gantt charts with AI — no code required, free forever. Built-in BYOK AI Copilot (10 providers + Ollama), free cloud rooms, working-calendar CPM, 6 views, React/Vue/Svelte/Python/MCP.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 6237 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/playground/src/components/common/EmptyChartState.tsx`
```
import React from "react";
import { AlertTriangle, FileJson } from "lucide-react";

/**
 * Window event asking the app shell to reveal and focus the JSON editor.
 * Lets this state offer a fix even when it is rendered without an `onOpenEditor` callback.
 */
export const OPEN_JSON_EDITOR_EVENT = "jantt:open-json-editor";

export function requestOpenJsonEditor() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_JSON_EDITOR_EVENT));
  }
}

interface EmptyChartStateProps {
  onOpenEditor?: () => void;
}

export const EmptyChartState: React.FC<EmptyChartStateProps> = ({ onOpenEditor = requestOpenJsonEditor }) => {
  return (
    <div className="empty-chart-state" role="status">
      <AlertTriangle size={36} color="#F43F5E" aria-hidden="true" />
      <h3>Cannot render this plan</h3>
      <p>
        The plan JSON is invalid or does not match the Jantt schema. Open the JSON editor to see each issue
        and how to fix it.
      </p>
      <button type="button" className="btn btn-primary" onClick={onOpenEditor}>
        <FileJson size={14} aria-hidden="true" />
        <span>Open JSON editor</span>
      </button>
    </div>
  );
};

```

### Core Architecture Module: `apps/playground/src/components/views/notes/useNoteMentionEngine.ts`
```
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import type { Task } from "@jantt/core";
import type { EffectivePerson } from "../../../types";
import {
  getCaretCoordinates,
  getTaskTitle,
  insertPillAtCurrentCaret,
  insertPillAtRange,
  toText,
  type PopupCoords
} from "./note-markdown";

/** Upper bound on rendered suggestions so large plans stay responsive while typing. */
const MAX_SUGGESTIONS = 50;

const PERSON_TRIGGER_RE = /(?:^|\s)@([\p{L}\p{N}_.\-]*)$/u;
const TASK_TRIGGER_RE = /(?:^|\s)\/([\p{L}\p{N}_.\-]*)$/u;

export interface MentionPopupState {
  isOpen: boolean;
  type: "person" | "task";
  query: string;
  coords: PopupCoords;
  selectedIndex: number;
}

interface PopupRange {
  textNode: Text;
  startIndex: number;
  endIndex: number;
}

/**
 * Closes a popover on an outside pointer press or Escape, returning focus to its trigger.
 * `containerRef` must wrap both the trigger and the popover.
 */
export function usePopoverDismiss(
  open: boolean,
  onDismiss: () => void,
  containerRef: React.RefObject<HTMLElement>,
  triggerRef?: React.RefObject<HTMLElement>
) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(e.target as Node)) onDismissRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onDismissRef.current();
      triggerRef?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, containerRef, triggerRef]);
}

export function useNoteMentionEngine(
  contentEditableRef: React.RefObject<HTMLDivElement>,
  effectivePeople: EffectivePerson[],
  allTasks: Task[],
  onContentChange: () => void
) {
  const popupRangeRef = useRef<PopupRange | null>(null);

  const [mentionPopup, setMentionPopup] = useState<MentionPopupState>({
    isOpen: false,
    type: "person",
    query: "",
    coords: { left: 0, top: 0, maxHeight: 260 },
    selectedIndex: 0
  });

  const closeMentionPopup = useCallback(() => {
    popupRangeRef.current = null;
    setMentionPopup((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  const insertPill = useCallback(
    (pillData: { type: "person" | "task"; id: string; label: string; color?: string }) => {
      const editorEl = contentEditableRef.current;
      if (!editorEl) return;
      const targetRange = popupRangeRef.current;
      if (targetRange && targetRange.textNode.parentNode && editorEl.contains(targetRange.textNode)) {
        insertPillAtRange(editorEl, targetRange, pillData);
      } else {
        insertPillAtCurrentCaret(editorEl, pillData);
      }
      closeMentionPopup();
      onContentChange();
    },
    [contentEditableRef, onContentChange, closeMentionPopup]
  );

  const insertPersonPill = useCallback(
    (person: EffectivePerson) =>
      insertPill({ type: "person", id: person.id, label: toText(person.name) || person.id, color: person.color }),
    [insertPill]
  );

  const insertTaskPill = useCallback(
    (task: Task) => insertPill({ type: "task", id: task.id, label: getTaskTitle(task) }),
    [insertPill]
  );

  const autocompletePeople = useMemo(() => {
    if (!mentionPopup.isOpen || mentionPopup.type !== "person") return [];
    const q = mentionPopup.query.trim().toLowerCase();
    const matches = q
      ? effectivePeople.filter((p) => {
          const name = toText(p.name).toLowerCase();
          return name.includes(q) || toText(p.id).toLowerCase().includes(q) || name.replace(/\s+/g, "").includes(q);
        })
      : effectivePeople;
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [mentionPopup.isOpen, mentionPopup.type, mentionPopup.query, effectivePeople]);

  const autocompleteTasks = useMemo(() => {
    if (!mentionPopup.isOpen || mentionPopup.type !== "task") return [];
    const q = mentionPopup.query.trim().toLowerCase();
    const results: Task[] = [];
    for (const t of allTasks) {
      if (t._deleted) continue;
      if (!q || toText(t.id).toLowerCase().includes(q) || getTaskTitle(t).toLowerCase().includes(q)) {
        results.push(t);
        if (results.length >= MAX_SUGGESTIONS) break;
      }
    }
    return results;
  }, [mentionPopup.isOpen, mentionPopup.type, mentionPopup.query, allTasks]);

  const handleEditorInput = useCallback(() => {
    const sel = window.getSelection();
    const anchorNode = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
    if (!sel || !anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) {
      closeMentionPopup();
      onContentChange();
      return;
    }

    const caretPos = sel.anchorOffset;
    const textBeforeCaret = (anchorNode.nodeValue || "").slice(0, caretPos);
    const atMatch = PERSON_TRIGGER_RE.exec(textBeforeCaret);
    const slashMatch = atMatch ? null : TASK_TRIGGER_RE.exec(textBeforeCaret);
    const match = atMatch ?? slashMatch;

    if (match) {
      const type = atMatch ? "person" : "task";
      popupRangeRef.current = {
        textNode: anchorNode as Text,
        startIndex: textBeforeCaret.lastIndexOf(atMatch ? "@" : "/"),
        endIndex: caretPos
      };
      const coords =
        getCaretCoordinates(null, contentEditableRef.current) ?? { left: 16, top: 16, maxHeight: 260 };
      setMentionPopup((prev) => ({
        isOpen: true,
        type,
        query: match[1],
        coords,
        // Keep the highlighted row while the query is unchanged (e.g. caret re-entry).
        selectedIndex: prev.isOpen && prev.type === type && prev.query === match[1] ? prev.selectedIndex : 0
      }));
    } else {
      closeMentionPopup();
    }

    onContentChange();
  }, [contentEditableRef, onContentChange, closeMentionPopup]);

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!mentionPopup.isOpen) return;

      const items = mentionPopup.type === "person" ? autocompletePeople : autocompleteTasks;
      const itemsCount = items.length;

      if (e.key === "ArrowDown" && itemsCount > 0) {
        e.preventDefault();
        setMentionPopup((prev) => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % itemsCount }));
      } else if (e.key === "ArrowUp" && itemsCount > 0) {
        e.preventDefault();
        setMentionPopup((prev) => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + itemsCount) % itemsCount }));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (itemsCount === 0) {
          // Nothing to pick: let the key behave normally (newline / focus move).
          closeMentionPopup();
          return;
        }
        e.preventDefault();
        const index = Math.min(mentionPopup.selectedIndex, itemsCount - 1);
        if (mentionPopup.type === "person") insertPersonPill(autocompletePeople[index]);
        else insertTaskPill(autocompleteTasks[index]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMentionPopup();
      }
    },
    [mentionPopup, autocompletePeople, autocompleteTasks, insertPersonPill, insertTaskPill, closeMentionPopup]
  );

  // While open: close when the caret leaves the trigger text, follow the caret on scroll/resize.
  useEffect(() => {
    if (!mentionPopup.isOpen) return;

    const onSelectionChange = () => {
      const target = popupRangeRef.current;
      const sel = window.getSelection();
      if (!target || !sel || sel.rangeCount === 0) return closeMentionPopup();
      if (sel.anchorNode !== target.textNode || sel.anchorOffset <= target.startIndex) closeMentionPopup();
    };

    const reposition = (e?: Event) => {
      const el = e?.target;
      if (el instanceof Element && el.closest(".note-mention-dropdown")) return;
      const target = popupRangeRef.current;
      if (!target || !target.textNode.isConnected) return closeMentionPopup();
      const range = document.createRange();
      const len = target.textNode.data.length;
      range.setStart(target.textNode, Math.min(target.startIndex, len));
      range.setEnd(target.textNode, Math.min(target.endIndex, len));
      const coords = getCaretCoordinates(range, contentEditableRef.current);
      if (coords) setMentionPopup((prev) => (prev.isOpen ? { ...prev, coords } : prev));
    };

    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [mentionPopup.isOpen, contentEditableRef, closeMentionPopup]);

  return {
    mentionPopup,
    setMentionPopup,
    autocompletePeople,
    autocompleteTasks,
    insertPersonPill,
    insertTaskPill,
    handleEditorInput,
    handleEditorKeyDown,
    closeMentionPopup
  };
}

```

### Core Architecture Module: `apps/playground/src/hooks/useAuth.ts`
```
import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, rtdb } from "../firebase/firebaseConfig";
import {
  signInWithGitHub,
  completeRedirectSignIn,
  isRedirectSignInPending,
  signOutUser,
  claimUsername,
  getStoredGitHubToken,
  clearStoredGitHubToken,
  updateUserGitHubVerification,
  syncPublicProfile,
  describeAuthError,
  type GitHubSignInResult
} from "../firebase/authService";
import {
  ENABLE_GITHUB_VERIFICATION_GATE,
  verifyAllGitHubRequirements,
  followCreator,
  followOrg,
  starRepository,
  starAllMissingRepositories
} from "../firebase/githubVerificationService";
import type { UserProfile, VerificationStatus } from "../firebase/types";

/** Stop reporting "loading" when the profile cannot be fetched (e.g. offline at startup). */
const PROFILE_LOAD_TIMEOUT_MS = 10000;

type ProfileStatus = "idle" | "loading" | "missing" | "ready" | "error";

export interface UseAuthReturn {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  /** True until the session and the signed-in user's profile are resolved; gate deep links on it. */
  isLoadingAuth: boolean;
  needsUsernameOnboarding: boolean;
  isSigningIn: boolean;
  /** Last user-facing sign-in or profile error, or null. */
  authError: string | null;
  dismissAuthError: () => void;
  githubToken: string | null;
  verificationStatus: VerificationStatus | null;
  isVerifying: boolean;
  showVerificationModal: boolean;
  setShowVerificationModal: (show: boolean) => void;
  /** Never rejects; failures land in `authError`. Concurrent calls share one sign-in. */
  loginWithGitHub: () => Promise<void>;
  logout: () => Promise<void>;
  completeUsernameOnboarding: (rawUsername: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  checkVerification: () => Promise<VerificationStatus>;
  followCreatorHandler: () => Promise<boolean>;
  followOrgHandler: () => Promise<boolean>;
  starRepoHandler: (repoFullName: string) => Promise<boolean>;
  starAllHandler: () => Promise<{ success: number; failed: number }>;
  autoVerifyHandler: () => Promise<boolean>;
}

function isSameProfile(a: UserProfile | null, b: UserProfile | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export function useAuth(): UseAuthReturn {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [profileEpoch, setProfileEpoch] = useState(0);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const signInRef = useRef<Promise<void> | null>(null);
  const syncedUidRef = useRef<string | null>(null);
  /** Bumped per verification run and per account change; stale results are dropped. */
  const verifyRunRef = useRef(0);
  const verifyInFlightRef = useRef<Promise<VerificationStatus> | null>(null);
  /** Open the verification modal after the first check that follows an interactive sign-in. */
  const promptVerificationRef = useRef(false);
  const userProfileRef = useRef<UserProfile | null>(null);
  userProfileRef.current = userProfile;

  /** Keeps the profile object identity stable when nothing changed (consumers key effects on it). */
  const setUserProfile = useCallback((next: UserProfile | null) => {
    setUserProfileState((prev) => (isSameProfile(prev, next) ? prev : next));
  }, []);

  const reportAuthError = useCallback((err: unknown) => {
    const message = describeAuthError(err);
    if (!message) return;
    console.warn("[useAuth] GitHub sign-in failed:", err);
    setAuthError(message);
  }, []);

  const applySignInResult = useCallback(
    (result: GitHubSignInResult) => {
      setCurrentUser(result.user);
      if (result.githubToken) setGithubToken(result.githubToken);
      if (result.profile) {
        setUserProfile(result.profile);
        setProfileStatus("ready");
      }
      promptVerificationRef.current = ENABLE_GITHUB_VERIFICATION_GATE && Boolean(result.profile);
    },
    [setUserProfile]
  );

  // Session restore (works offline from local persistence) and account switches.
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      verifyRunRef.current++;
      verifyInFlightRef.current = null;
      setIsVerifying(false);
      setVerificationStatus(null);
      setCurrentUser(user);
      setGithubToken(getStoredGitHubToken(user?.uid));
      setUserProfileState((prev) => (prev && user && prev.uid === user.uid ? prev : null));
      if (!user) {
        // Also covers sign-outs from another tab, which never run signOutUser here.
        clearStoredGitHubToken();
        syncedUidRef.current = null;
        setProfileStatus("idle");
        setShowVerificationModal(false);
        setIsLoadingAuth(false);
      }
    });
  }, []);

  // Finish a redirect sign-in (popup fallback) started before this page load.
  useEffect(() => {
    if (!isRedirectSignInPending()) return;
    setIsSigningIn(true);
    completeRedirectSignIn()
      .then((result) => {
        if (result) {
          applySignInResult(result);
        } else if (!auth.currentUser) {
          // The redirect was abandoned, or the browser dropped the auth state (third-party
          // storage blocking). Say so instead of failing silently.
          setAuthError("GitHub sign-in did not complete. Allow pop-ups for this site, then try again.");
        }
      })
      .catch(reportAuthError)
      .finally(() => setIsSigningIn(false));
  }, [applySignInResult, reportAuthError]);

  // Live profile of the signed-in user. Read failures never route to onboarding.
  const uid = currentUser?.uid || null;
  useEffect(() => {
    if (!uid) return;
    // A profile already applied for this account (e.g. by the sign-in itself) stays usable.
    const hasProfile = userProfileRef.current?.uid === uid;
    setIsLoadingAuth(!hasProfile);
    setProfileStatus(hasProfile ? "ready" : "loading");

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) setIsLoadingAuth(false);
    }, PROFILE_LOAD_TIMEOUT_MS);

    const unsubscribe = onValue(
      ref(rtdb, `users/${uid}`),
      (snap) => {
        settled = true;
        const stored = snap.exists() ? (snap.val() as UserProfile) : null;
        if (stored?.username) {
          const profile: UserProfile = { ...stored, uid, email: auth.currentUser?.email || stored.email || "" };
          setUserProfile(profile);
          setProfileStatus("ready");
          if (syncedUidRef.current !== uid) {
            syncedUidRef.current = uid;
            void syncPublicProfile(profile, stored.email !== undefined);
          }
        } else {
          setUserProfile(null);
          setProfileStatus("missing");
        }
        setIsLoadingAuth(false);
      },
      (error) => {
        settled = true;
        // Signing out revokes this listener before the effect cleanup runs: not an error.
        if (auth.currentUser?.uid !== uid) return;
        console.warn("[useAuth] Could not load the profile:", error);
        setProfileStatus("error");
        setAuthError("Couldn't load your Jantt profile. Check your connection, then try again.");
        setIsLoadingAuth(false);
      }
    );

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [uid, profileEpoch, setUserProfile]);

  const githubLogin = userProfile?.githubUsername || "";
  const checkVerification = useCallback(async (): Promise<VerificationStatus> => {
    if (!ENABLE_GITHUB_VERIFICATION_GATE) {
      // Gate off: bypass status without network calls or database writes.
      const status = await verifyAllGitHubRequirements("");
      setVerificationStatus(status);
      return status;
    }
    if (verifyInFlightRef.current) return verifyInFlightRef.current;

    const run = ++verifyRunRef.current;
    const verifiedUid = uid;
    setIsVerifying(true);

    const task = (async () => {
      const result = await verifyAllGitHubRequirements(githubLogin, githubToken || undefined);
      if (run !== verifyRunRef.current) return result;
      setVerificationStatus(result);

      if (promptVerificationRef.current) {
        promptVerificationRef.current = false;
        if (!result.isVerified && !result.error) setShowVerificationModal(true);
      }

      // Persist real outcomes only, and only when they changed: errors (rate limits, network)
      // never downgrade a stored state, and bypasses are never stored.
      const stored = userProfileRef.current;
      const missing = result.missingRepos.length;
      const changed =
        stored?.githubVerified !== result.isVerified ||
        stored?.isFollowingCreator !== result.isFollowingCreator ||
        stored?.missingReposCount !== missing;
      if (verifiedUid && !result.error && !result.isDevBypass && changed) {
        updateUserGitHubVerification(verifiedUid, result.isVerified, result.isFollowingCreator, missing).catch(
          (err) => console.warn("[useAuth] Could not store the verification result:", err)
        );
      }
      return result;
    })();

    verifyInF
```

### Core Architecture Module: `apps/playground/src/hooks/useAutoSave.ts`
```
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { JanttData } from "@jantt/core";
import type { AutoSaveInterval } from "../types";
import { STORAGE_KEYS } from "../constants";
import { storageService } from "../services/storage";

interface UseAutoSaveOptions {
  /** @deprecated Not used any more: saves persist the parsed plan, never half-typed JSON. */
  jsonText?: string;
  parsedData: JanttData | null;
  activeProjectId: string;
  /** Persists a plan; returning false reports a failed (non-durable) write. */
  onSaveProject?: (projectId: string, data: JanttData) => boolean | void;
  showToast: (msg: string, isErr?: boolean) => void;
  captureSnapshot?: (projectId: string, data: JanttData, reason: string) => void;
  broadcastChange?: (projectId: string, data: JanttData) => void;
}

const AUTOSAVE_INTERVALS: AutoSaveInterval[] = ["5s", "10s", "30s", "60s", "immediate", "off"];

const INTERVAL_MS: Record<Exclude<AutoSaveInterval, "off">, number> = {
  immediate: 400,
  "5s": 5000,
  "10s": 10000,
  "30s": 30000,
  "60s": 60000
};

export const SAVE_FAILED_MESSAGE =
  "Changes could not be saved: browser storage is full or blocked. Export your plan (JSON) to keep a copy, then free space by deleting old plans.";

export function useAutoSave({
  parsedData,
  activeProjectId,
  onSaveProject,
  showToast,
  captureSnapshot,
  broadcastChange
}: UseAutoSaveOptions) {
  const [autoSaveInterval, setAutoSaveInterval] = useState<AutoSaveInterval>(() => {
    const saved = storageService.getItem<string>(STORAGE_KEYS.AUTOSAVE_INTERVAL);
    return saved && AUTOSAVE_INTERVALS.includes(saved as AutoSaveInterval) ? (saved as AutoSaveInterval) : "5s";
  });

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "pending">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date>(() => new Date());
  const [showAutoSaveModal, setShowAutoSaveModal] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const isDirtyRef = useRef(false);
  const pendingSinceRef = useRef<number | null>(null);
  const failureAnnouncedRef = useRef(false);

  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const parsedDataRef = useRef(parsedData);
  parsedDataRef.current = parsedData;
  const onSaveProjectRef = useRef(onSaveProject);
  onSaveProjectRef.current = onSaveProject;
  const captureSnapshotRef = useRef(captureSnapshot);
  captureSnapshotRef.current = captureSnapshot;
  const broadcastChangeRef = useRef(broadcastChange);
  broadcastChangeRef.current = broadcastChange;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  /** Plan state seen by the last change check: lets a switch save the outgoing plan's edits. */
  const lastSeenRef = useRef({ projectId: activeProjectId, data: parsedData });

  useEffect(() => {
    storageService.setItem(STORAGE_KEYS.AUTOSAVE_INTERVAL, autoSaveInterval);
  }, [autoSaveInterval]);

  const clearTimer = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /** Writes one plan. Returns false when the write did not reach durable storage. */
  const persist = useCallback((projectId: string, data: JanttData | null, withSideEffects: boolean): boolean => {
    if (!data) return true;
    if (projectId === "default") {
      return storageService.setItem(STORAGE_KEYS.DEFAULT_PLAN, data);
    }
    const ok = onSaveProjectRef.current?.(projectId, data) !== false;
    if (ok && withSideEffects) {
      try {
        captureSnapshotRef.current?.(projectId, data, "Auto-Save");
      } catch (err) {
        console.error("Snapshot capture failed:", err);
      }
      try {
        broadcastChangeRef.current?.(projectId, data);
      } catch {}
    }
    return ok;
  }, []);

  const reportResult = useCallback((ok: boolean, announceFailure: boolean) => {
    if (ok) {
      isDirtyRef.current = false;
      pendingSinceRef.current = null;
      failureAnnouncedRef.current = false;
      setSaveError(null);
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      return;
    }
    // Never claim "saved" after a failed write: the edits stay pending and are retried
    setSaveError(SAVE_FAILED_MESSAGE);
    setSaveStatus("pending");
    if (announceFailure || !failureAnnouncedRef.current) {
      failureAnnouncedRef.current = true;
      showToastRef.current(SAVE_FAILED_MESSAGE, true);
    }
  }, []);

  const runSave = useCallback(
    (announceFailure: boolean): boolean => {
      clearTimer();
      let ok = false;
      try {
        ok = persist(activeProjectIdRef.current, parsedDataRef.current, true);
      } catch (err) {
        console.error("Auto-save error:", err);
      }
      reportResult(ok, announceFailure);
      return ok;
    },
    [clearTimer, persist, reportResult]
  );

  /** Saves the active plan now, whether or not it changed. */
  const executeSave = useCallback(() => runSave(false), [runSave]);

  /** Saves the active plan only if it has unsaved edits (plan switch, tab close). */
  const flushSave = useCallback(() => {
    if (isDirtyRef.current || autoSaveTimerRef.current !== null) runSave(false);
  }, [runSave]);

  const handleManualSaveNow = useCallback(() => {
    if (runSave(true)) showToast("Plan saved to browser storage.");
  }, [runSave, showToast]);

  // Persist pending edits when the page goes away. Mobile browsers often skip beforeunload,
  // so pagehide and visibilitychange are handled too.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHide = () => flushSave();
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      flushSave();
      // The edits could not reach durable storage (full or blocked): ask before they are lost
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushSave]);

  useEffect(() => {
    const lastSeen = lastSeenRef.current;
    lastSeenRef.current = { projectId: activeProjectId, data: parsedData };

    if (lastSeen.projectId !== activeProjectId) {
      // The active plan was switched (by any code path): pending edits belong to the
      // outgoing plan, and the freshly loaded plan starts out saved.
      if (isDirtyRef.current) {
        let ok = false;
        try {
          ok = persist(lastSeen.projectId, lastSeen.data, false);
        } catch (err) {
          console.error("Saving the previous plan failed:", err);
        }
        if (!ok) showToastRef.current(SAVE_FAILED_MESSAGE, true);
      }
      clearTimer();
      isDirtyRef.current = false;
      pendingSinceRef.current = null;
      failureAnnouncedRef.current = false;
      setSaveError(null);
      setSaveStatus("saved");
      return;
    }

    if (lastSeen.data !== parsedData) {
      isDirtyRef.current = true;
      if (pendingSinceRef.current === null) pendingSinceRef.current = Date.now();
    }
    if (!isDirtyRef.current) return;

    setSaveStatus("pending");
    clearTimer();
    if (autoSaveInterval === "off") return;

    // Debounce, but continuous editing can never postpone a save beyond twice the interval
    const interval = INTERVAL_MS[autoSaveInterval];
    const deadline = (pendingSinceRef.current ?? Date.now()) + interval * 2;
    const delay = Math.max(0, Math.min(interval, deadline - Date.now()));
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      runSave(false);
    }, delay);
  }, [activeProjectId, parsedData, autoSaveInterval, persist, clearTimer, runSave]);

  // Refresh the relative "Saved ... ago" label only when its text can change, and stop
  // after an hour (the label then shows a clock time), so an idle app does not re-render.
  const [, setLabelTick] = useState(0);
  useEffect(() => {
    if (saveStatus !== "saved" || saveError) return;
    let timer: number | undefined;
    const schedule = () => {
      const age = Date.now() - lastSavedAt.getTime();
      const delay = age < 60000 ? 10000 - (age % 10000) : age < 3600000 ? 60000 - (age % 60000) : null;
      if (delay === null) return;
      timer = window.setTimeout(() => {
        setLabelTick((t) => t + 1);
        schedule();
      }, delay + 50);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [saveStatus, saveError, lastSavedAt]);

  let autoSaveLabel: string;
  if (saveError) {
    autoSaveLabel = "Save failed";
  } else if (saveStatus === "saving") {
    autoSaveLabel = "Saving...";
  } else if (saveStatus === "pending") {
    autoSaveLabel = "Unsaved";
  } else {
    const diffSec = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    if (diffSec < 10) autoSaveLabel = "Saved just now";
    else if (diffSec < 60) autoSaveLabel = `Saved ${Math.floor(diffSec / 10) * 10}s ago`;
    else if (diffSec < 3600) autoSaveLabel = `Saved ${Math.floor(diffSec / 60)}m ago`;
    else autoSaveLabel = `Saved at ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  // Scanning all of localStorage is costly; only do it while the settings dialog is open
  const storageSizeKb = useMemo(() => {
    if (!showAutoSaveModal) return "0.0";
    try {
      let total = 0;
      for (let i = 
```

### Core Architecture Module: `apps/playground/src/hooks/useCopilot.ts`
```
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { validate, type JanttData } from "@jantt/core";
import type {
  CopilotMessage,
  CopilotConfig,
  PendingPlanChange,
  ModelDefinition,
  ProviderDefinition,
  ProviderAccount
} from "../services/ai/types";
import {
  getActiveProvider,
  setActiveProvider,
  getApiKey,
  setApiKey,
  getModelForProvider,
  setModelForProvider,
  getCustomBaseUrl,
  setCustomBaseUrl,
  getProxyUrl,
  setProxyUrl,
  getTemperature,
  setTemperature,
  getAutoApply,
  setAutoApply,
  getProviderAccounts,
  addProviderAccount,
  updateProviderAccount,
  deleteProviderAccount,
  getActiveAccountId,
  setActiveAccountId,
  isAccountConfigured
} from "../services/ai/storage";
import {
  getProviderAdapter,
  getModelsForProvider,
  getAllProviders,
  PROVIDER_CATALOG
} from "../services/ai/provider-registry";
import {
  fetchLiveModelsForAccount,
  getCachedDiscoveredModels,
  getEffectiveModelsForAccount,
  mergeCustomModels,
  type ModelDiscoveryResult
} from "../services/ai/model-discovery";
import { buildSystemPrompt } from "../services/ai/system-prompt";
import { extractJsonFromResponse } from "../services/ai/json-extractor";
import { computePlanDiff } from "../services/ai/plan-differ";

export interface UseCopilotOptions {
  parsedData: JanttData | null;
  commitPlan: (data: JanttData) => void;
  showToast: (message: string, isError?: boolean) => void;
  isReadOnly: boolean;
}

export interface UseCopilotReturn {
  messages: CopilotMessage[];
  isStreaming: boolean;
  config: CopilotConfig;
  isConfigured: boolean;
  pendingDiff: PendingPlanChange | null;
  sendMessage: (text: string) => void;
  stopGeneration: () => void;
  acceptChange: () => void;
  rejectChange: () => void;
  revertChange: (messageId: string) => void;
  clearHistory: () => void;
  updateConfig: (partial: Partial<CopilotConfig>) => void;
  availableProviders: ProviderDefinition[];
  availableModels: ModelDefinition[];
  currentModelLabel: string;
  accounts: ProviderAccount[];
  configuredAccounts: ProviderAccount[];
  discoveredModelsByAccount: Record<string, ModelDiscoveryResult>;
  loadingModelsByAccount: Record<string, boolean>;
  refreshModelsForAccount: (accountId: string, force?: boolean) => Promise<ModelDiscoveryResult | null>;
  refreshAllAccountModels: (force?: boolean) => Promise<void>;
  addAccount: (data: Omit<ProviderAccount, "id" | "createdAt">) => ProviderAccount;
  updateAccount: (id: string, partial: Partial<ProviderAccount>) => void;
  deleteAccount: (id: string) => void;
  selectAccountAndModel: (accountId: string, modelId: string) => void;
}

export function useCopilot({
  parsedData,
  commitPlan,
  showToast,
  isReadOnly
}: UseCopilotOptions): UseCopilotReturn {
  // Accounts State
  const [accounts, setAccounts] = useState<ProviderAccount[]>(() => getProviderAccounts());
  const configuredAccounts = useMemo(() => accounts.filter(isAccountConfigured), [accounts]);

  // Dynamic Model Discovery State (hydrated from local cache per account)
  const [discoveredModelsByAccount, setDiscoveredModelsByAccount] = useState<Record<string, ModelDiscoveryResult>>(() => {
    const initial: Record<string, ModelDiscoveryResult> = {};
    for (const acc of getProviderAccounts()) {
      const cached = getCachedDiscoveredModels(acc.id);
      if (cached) {
        initial[acc.id] = {
          models: mergeCustomModels(acc.providerId, cached.models),
          source: "cache",
          fetchedAt: cached.fetchedAt
        };
      }
    }
    return initial;
  });
  const [loadingModelsByAccount, setLoadingModelsByAccount] = useState<Record<string, boolean>>({});
  const inFlightDiscoveryRef = useRef<Map<string, Promise<ModelDiscoveryResult | null>>>(new Map());

  // 1. Configuration State
  const [config, setConfigState] = useState<CopilotConfig>(() => {
    const allAccounts = getProviderAccounts();
    const activeAccId = getActiveAccountId();
    const matched = allAccounts.find((a) => a.id === activeAccId) || allAccounts[0];

    if (matched) {
      const defaultModel = matched.selectedModelId || PROVIDER_CATALOG[matched.providerId]?.models[0]?.id || "gemini-2.5-flash";
      return {
        activeAccountId: matched.id,
        providerId: matched.providerId,
        apiKey: matched.apiKey,
        modelId: defaultModel,
        customBaseUrl: matched.customBaseUrl,
        proxyUrl: matched.proxyUrl,
        temperature: getTemperature(),
        autoApply: getAutoApply()
      };
    }

    const providerId = getActiveProvider();
    const defaultModel = PROVIDER_CATALOG[providerId]?.models[0]?.id || "gemini-2.5-flash";
    return {
      providerId,
      apiKey: getApiKey(providerId),
      modelId: getModelForProvider(providerId, defaultModel),
      customBaseUrl: getCustomBaseUrl(providerId),
      proxyUrl: getProxyUrl(providerId),
      temperature: getTemperature(),
      autoApply: getAutoApply()
    };
  });

  const configRef = useRef(config);
  configRef.current = config;

  const parsedDataRef = useRef(parsedData);
  parsedDataRef.current = parsedData;

  const commitPlanRef = useRef(commitPlan);
  commitPlanRef.current = commitPlan;

  const isReadOnlyRef = useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;

  const refreshModelsForAccount = useCallback(async (accountId: string, force = false): Promise<ModelDiscoveryResult | null> => {
    const acc = getProviderAccounts().find((a) => a.id === accountId);
    if (!acc || !isAccountConfigured(acc)) return null;

    if (!force && inFlightDiscoveryRef.current.has(accountId)) {
      return inFlightDiscoveryRef.current.get(accountId)!;
    }

    const promise = (async () => {
      setLoadingModelsByAccount((prev) => ({ ...prev, [accountId]: true }));
      try {
        const result = await fetchLiveModelsForAccount(acc, { force });
        setDiscoveredModelsByAccount((prev) => ({ ...prev, [accountId]: result }));

        // If this account has no selected model yet (or placeholder "custom") and live models loaded, pick the first live model.
        if (result.source === "live" && result.models.length > 0) {
          const latestAcc = getProviderAccounts().find((a) => a.id === accountId);
          const currentSelected = latestAcc?.selectedModelId || "";
          if (!currentSelected || currentSelected === "custom") {
            const preferred = result.models[0].id;
            updateProviderAccount(accountId, { selectedModelId: preferred });
            setAccounts(getProviderAccounts());
            if (configRef.current.activeAccountId === accountId) {
              setConfigState((prev) => ({ ...prev, modelId: preferred }));
            }
          }
        }
        return result;
      } finally {
        inFlightDiscoveryRef.current.delete(accountId);
        setLoadingModelsByAccount((prev) => ({ ...prev, [accountId]: false }));
      }
    })();

    inFlightDiscoveryRef.current.set(accountId, promise);
    return promise;
  }, []);

  const refreshAllAccountModels = useCallback(
    async (force = false) => {
      const targets = getProviderAccounts().filter(isAccountConfigured);
      await Promise.allSettled(targets.map((acc) => refreshModelsForAccount(acc.id, force)));
    },
    [refreshModelsForAccount]
  );

  // Account Management Actions
  const addAccount = useCallback(
    (data: Omit<ProviderAccount, "id" | "createdAt">) => {
      const created = addProviderAccount(data);
      const updated = getProviderAccounts();
      setAccounts(updated);
      setActiveAccountId(created.id);
      const defaultModel = created.selectedModelId || PROVIDER_CATALOG[created.providerId]?.models[0]?.id || "";
      setConfigState((prev) => ({
        ...prev,
        activeAccountId: created.id,
        providerId: created.providerId,
        apiKey: created.apiKey,
        modelId: defaultModel,
        customBaseUrl: created.customBaseUrl,
        proxyUrl: created.proxyUrl
      }));
      void refreshModelsForAccount(created.id, true);
      return created;
    },
    [refreshModelsForAccount]
  );

  const updateAccount = useCallback(
    (id: string, partial: Partial<ProviderAccount>) => {
      updateProviderAccount(id, partial);
      const updated = getProviderAccounts();
      setAccounts(updated);
      const activeId = getActiveAccountId();
      if (activeId === id) {
        setConfigState((prev) => ({
          ...prev,
          providerId: partial.providerId !== undefined ? partial.providerId : prev.providerId,
          apiKey: partial.apiKey !== undefined ? partial.apiKey : prev.apiKey,
          modelId: partial.selectedModelId !== undefined ? partial.selectedModelId : prev.modelId,
          customBaseUrl: partial.customBaseUrl !== undefined ? partial.customBaseUrl : prev.customBaseUrl,
          proxyUrl: partial.proxyUrl !== undefined ? partial.proxyUrl : prev.proxyUrl
        }));
      }
      if (
        partial.apiKey !== undefined ||
        partial.providerId !== undefined ||
        partial.customBaseUrl !== undefined ||
        partial.proxyUrl !== undefined
      ) {
        void refreshModelsForAccount(id, true);
      }
    },
    [refreshModelsForAccount]
  );

  const deleteAccount = useCallback((id: string) => {
    deleteProviderAccount(id);
    const updated = getProviderAccounts();
    setAccounts(updated);
    setDiscoveredModelsByAccount((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const nextActiveId = getActiveAccountId();
    const nextAcc = updated.find((a) => a.id === nextActiveId) || updated[0];
    if (nextAcc) {
      const defaultModel = nextAcc.selectedModelId || PROVIDER_CATALOG[nextAcc.providerId]?.models[0]?.id || "";
      setConfigState((prev) => ({
        ...prev,
        activeAccountId: nextAcc.id,
        providerId: nextAcc.providerId,
        apiKey: nextAcc.apiKey,
        modelId: defaultModel,
        customBaseUrl: nextAcc.customBaseUrl,
        proxyUrl:
```

### Core Architecture Module: `apps/playground/src/hooks/useDateFilter.ts`
```
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  type JanttData,
  type Task,
  type Team,
  type TimeScale,
  getTodayISODate,
  isTaskDone
} from "@jantt/core";
import type { DateFilterMode, CompletedFilterMode, ActiveView, EffectivePerson } from "../types";
import { STORAGE_KEYS } from "../constants";
import { sortTasksByAssignee } from "../utils";
import { storageService } from "../services/storage";

/** Date value, range and Dim/Hide behaviour (the mode itself is persisted under STORAGE_KEYS.DATE_FILTER_MODE). */
const DATE_FILTER_DETAILS_KEY = "jantt_date_filter_details";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DateFilterDetails {
  value: string;
  rangeStart: string;
  rangeEnd: string;
  behavior: "dim" | "hide";
}

function loadDateFilterDetails(): DateFilterDetails {
  const fallback: DateFilterDetails = { value: getTodayISODate(), rangeStart: "", rangeEnd: "", behavior: "dim" };
  try {
    const parsed = storageService.getItem<Partial<DateFilterDetails>>(DATE_FILTER_DETAILS_KEY);
    if (!parsed || typeof parsed !== "object") return fallback;
    const date = (v: unknown, def: string) => (typeof v === "string" && (v === "" || ISO_DATE.test(v)) ? v : def);
    return {
      value: date(parsed.value, fallback.value) || fallback.value,
      rangeStart: date(parsed.rangeStart, ""),
      rangeEnd: date(parsed.rangeEnd, ""),
      behavior: parsed.behavior === "hide" ? "hide" : "dim"
    };
  } catch {
    return fallback;
  }
}

/** Gantt elements that carry a task id (bars, label rows, grid rows). */
const TASK_ELEMENT_SELECTOR = "[data-task-id], [data-row-id], [data-grid-row-id]";
const DIMMED_CLASS = "jantt-task-dimmed";

interface UseDateFilterOptions {
  initialMode: DateFilterMode;
  initialCompletedMode?: CompletedFilterMode;
  parsedData: JanttData | null;
  activeView: ActiveView;
  currentScale?: TimeScale;
  currentDayWidth?: number;
  selectedPersonFilter?: string;
  effectivePeople?: EffectivePerson[];
  teams?: Team[];
}

import { DateFilterStage, AssigneeFilterStage } from "../services/query";

const dateFilterStage = new DateFilterStage();
const assigneeFilterStage = new AssigneeFilterStage();

export function useDateFilter({
  initialMode,
  initialCompletedMode = "show",
  parsedData,
  activeView,
  currentScale,
  currentDayWidth,
  selectedPersonFilter = "all",
  effectivePeople = [],
  teams = []
}: UseDateFilterOptions) {
  const [initialDetails] = useState(loadDateFilterDetails);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>(initialMode);
  const [dateFilterValue, setDateFilterValue] = useState<string>(initialDetails.value);
  const [dateFilterRangeStart, setDateFilterRangeStart] = useState<string>(initialDetails.rangeStart);
  const [dateFilterRangeEnd, setDateFilterRangeEnd] = useState<string>(initialDetails.rangeEnd);
  const [dateFilterBehavior, setDateFilterBehavior] = useState<"dim" | "hide">(initialDetails.behavior);
  const [completedFilterMode, setCompletedFilterMode] = useState<CompletedFilterMode>(initialCompletedMode);

  const handleSetRangeStart = useCallback((newStart: string) => {
    setDateFilterRangeStart(newStart);
    if (newStart && dateFilterRangeEnd && newStart > dateFilterRangeEnd) {
      setDateFilterRangeEnd(newStart);
    }
  }, [dateFilterRangeEnd]);

  const handleSetRangeEnd = useCallback((newEnd: string) => {
    setDateFilterRangeEnd(newEnd);
    if (newEnd && dateFilterRangeStart && newEnd < dateFilterRangeStart) {
      setDateFilterRangeStart(newEnd);
    }
  }, [dateFilterRangeStart]);

  useEffect(() => {
    storageService.setItem(STORAGE_KEYS.DATE_FILTER_MODE, dateFilterMode);
  }, [dateFilterMode]);

  useEffect(() => {
    storageService.setItem(STORAGE_KEYS.COMPLETED_FILTER_MODE, completedFilterMode);
  }, [completedFilterMode]);

  useEffect(() => {
    const details: DateFilterDetails = {
      value: dateFilterValue,
      rangeStart: dateFilterRangeStart,
      rangeEnd: dateFilterRangeEnd,
      behavior: dateFilterBehavior
    };
    storageService.setItem(DATE_FILTER_DETAILS_KEY, details);
  }, [dateFilterValue, dateFilterRangeStart, dateFilterRangeEnd, dateFilterBehavior]);

  const dateFilterActiveDate = useMemo(() => {
    if (dateFilterMode === "today") return getTodayISODate();
    if (dateFilterMode === "date") return dateFilterValue || null;
    return null;
  }, [dateFilterMode, dateFilterValue]);

  const isPersonFiltering =
    selectedPersonFilter !== "all" && !selectedPersonFilter.startsWith("sort:");
  const isPersonSorting = selectedPersonFilter === "sort:assignee";
  const hasActiveFilter = dateFilterMode !== "all" || isPersonFiltering;

  const isTaskMatchingDateFilter = useCallback(
    (task: Task): boolean => {
      return dateFilterStage.matches(task, {
        dateFilterMode,
        dateFilterValue,
        dateFilterRangeStart,
        dateFilterRangeEnd,
        selectedPersonFilter,
        completedFilterMode
      });
    },
    [dateFilterMode, dateFilterValue, dateFilterRangeStart, dateFilterRangeEnd, selectedPersonFilter, completedFilterMode]
  );

  const isTaskMatchingPerson = useCallback(
    (task: Task): boolean => {
      return assigneeFilterStage.matches(task, {
        dateFilterMode,
        selectedPersonFilter,
        effectivePeople,
        teams,
        completedFilterMode
      });
    },
    [selectedPersonFilter, effectivePeople, teams, dateFilterMode, completedFilterMode]
  );

  const isTaskMatchingActiveFilter = useCallback(
    (task: Task): boolean => {
      return isTaskMatchingDateFilter(task) && isTaskMatchingPerson(task);
    },
    [isTaskMatchingDateFilter, isTaskMatchingPerson]
  );

  const matchingTasksCount = useMemo(() => {
    if (!parsedData) return 0;
    return (parsedData.tasks || [])
      .filter((t) => !t._deleted)
      .filter((t) => {
        if (completedFilterMode === "filter" && isTaskDone(t)) return false;
        return isTaskMatchingActiveFilter(t);
      }).length;
  }, [parsedData, completedFilterMode, isTaskMatchingActiveFilter]);

  const summaryKpiTasks = useMemo(() => {
    if (!parsedData) return [];
    let tasks = (parsedData.tasks || []).filter((t) => !t._deleted);
    if (completedFilterMode === "filter") {
      tasks = tasks.filter((t) => !isTaskDone(t));
    }
    if (hasActiveFilter && dateFilterBehavior === "hide") {
      tasks = tasks.filter(isTaskMatchingActiveFilter);
    }
    return tasks;
  }, [parsedData, completedFilterMode, hasActiveFilter, dateFilterBehavior, isTaskMatchingActiveFilter]);

  const ganttFilteredTasks = useMemo(() => {
    if (!parsedData) return [];
    let tasks = (parsedData.tasks || []).filter((t) => !t._deleted);
    if (completedFilterMode === "filter") {
      tasks = tasks.filter((t) => !isTaskDone(t));
    }
    if (hasActiveFilter && dateFilterBehavior === "hide") {
      tasks = tasks.filter(isTaskMatchingActiveFilter);
    }
    if (isPersonSorting) {
      tasks = sortTasksByAssignee(tasks, effectivePeople, teams);
    }
    return tasks;
  }, [parsedData, completedFilterMode, hasActiveFilter, dateFilterBehavior, isTaskMatchingActiveFilter, isPersonSorting, effectivePeople, teams]);

  const dateFilterActiveSummary = useMemo(() => {
    if (dateFilterMode === "all" && !isPersonFiltering && completedFilterMode === "show") return null;
    const total = (parsedData?.tasks || []).filter((t) => !t._deleted).length;
    const countText = `${matchingTasksCount} of ${total} tasks active`;
    let label = "";

    if (dateFilterMode === "today") label = `Today (${getTodayISODate()})`;
    else if (dateFilterMode === "week") label = `This Week`;
    else if (dateFilterMode === "date") label = dateFilterValue || "Selected Date";
    else if (dateFilterMode === "range") {
      const from = dateFilterRangeStart || "Start";
      const to = dateFilterRangeEnd || "End";
      label = `${from} → ${to}`;
    }

    if (isPersonFiltering) {
      const personName =
        teams.find((t) => `team:${t.id}` === selectedPersonFilter)?.name ||
        effectivePeople.find((p) => p.id === selectedPersonFilter)?.name ||
        selectedPersonFilter;
      label = label ? `${label} • ${personName}` : personName;
    }

    if (completedFilterMode === "filter") {
      label = label ? `${label} • Hide Completed` : "Hide Completed";
    } else if (completedFilterMode === "dim") {
      label = label ? `${label} • Dim Completed` : "Dim Completed";
    }

    return { label, countText };
  }, [
    dateFilterMode,
    dateFilterValue,
    dateFilterRangeStart,
    dateFilterRangeEnd,
    isPersonFiltering,
    selectedPersonFilter,
    completedFilterMode,
    matchingTasksCount,
    parsedData,
    teams,
    effectivePeople
  ]);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of parsedData?.tasks || []) map.set(task.id, task);
    return map;
  }, [parsedData]);

  // Apply Gantt date/person dimming and completed dimming to the rendered chart.
  // Scoped to the chart container, O(elements) per pass, and re-applied when the engine
  // re-renders rows (virtualisation, zoom, edits) instead of relying on timers.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root: ParentNode = document.querySelector(".chart-container-card") || document;
    const isDateDimActive = hasActiveFilter && dateFilterBehavior === "dim";
    const isCompletedDimActive = completedFilterMode === "dim";

    if (activeView !== "gantt" || (!isDateDimActive && !isCompletedDimActive)) {
      root.querySelectorAll(`.${DIMMED_CLASS}`).forEach((el) => el.classList.remove(DIMMED_CLASS));
      return;
    }

    const dimCache = new Map<string, boolean>();
    const isDimmed = (taskId: string | null | undefined): boolean => {
      if (!taskId) return false;
      const cached = dimCache.get(taskId);
      if (cached !== undefined) return cached;
      const task = tasksById.get(taskId);
      const re
```

### Core Architecture Module: `apps/playground/src/hooks/useDynamicSync.ts`
```
import { useEffect, useRef, useCallback } from "react";
import {
  type JanttData,
  type Person,
  type Team,
  type ValidationResult,
  calculatePlanHash,
  validate
} from "@jantt/core";
import type { SavedProject } from "../types";
import { getTabInstanceId } from "../room-storage";

const CHANNEL_NAME = "jantt_cross_tab_sync";

interface PlanMutatedMessage {
  type: "PLAN_MUTATED";
  senderId: string;
  projectId: string;
  timestamp: string;
  data: JanttData;
}

interface UseDynamicSyncOptions {
  activeProjectId: string;
  /** The open plan; incoming copies that already match it are ignored. */
  parsedData?: JanttData | null;
  setParsedData: (data: JanttData | null) => void;
  setJsonText: (text: string) => void;
  setPeople: (people: Person[]) => void;
  setTeams: (teams: Team[]) => void;
  setValidationResult: (res: ValidationResult) => void;
  /** @deprecated Unused; accepted for call-site compatibility. */
  customProjects?: SavedProject[];
  /** @deprecated Unused; accepted for call-site compatibility. */
  setCustomProjects?: React.Dispatch<React.SetStateAction<SavedProject[]>>;
  /** @deprecated Unused; accepted for call-site compatibility. */
  showToast?: (msg: string, isErr?: boolean) => void;
  /** @deprecated Unused; accepted for call-site compatibility. */
  captureSnapshot?: (projectId: string, data: JanttData, reason: string) => void;
}

function isPlanMutatedMessage(value: unknown): value is PlanMutatedMessage {
  const msg = value as Partial<PlanMutatedMessage> | null;
  return Boolean(
    msg &&
      msg.type === "PLAN_MUTATED" &&
      typeof msg.senderId === "string" &&
      typeof msg.projectId === "string" &&
      msg.data &&
      typeof msg.data === "object" &&
      Array.isArray(msg.data.tasks)
  );
}

/**
 * Cross-tab coherence: when this browser has the same plan open in several tabs, edits saved in
 * one tab are applied in the others through a BroadcastChannel. Every tab has its own sender id,
 * copies that already match the open plan are ignored, and a plan applied from another tab is
 * not broadcast again when this tab autosaves it, so a change travels exactly once.
 * (Collaboration between users goes through Firebase cloud rooms, see useRoomSync.)
 */
export function useDynamicSync({
  activeProjectId,
  parsedData,
  setParsedData,
  setJsonText,
  setPeople,
  setTeams,
  setValidationResult
}: UseDynamicSyncOptions) {
  const senderId = getTabInstanceId();
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  const parsedDataRef = useRef(parsedData ?? null);
  parsedDataRef.current = parsedData ?? null;
  const settersRef = useRef({ setParsedData, setJsonText, setPeople, setTeams, setValidationResult });
  settersRef.current = { setParsedData, setJsonText, setPeople, setTeams, setValidationResult };

  const channelRef = useRef<BroadcastChannel | null>(null);
  /** The plan last applied from another tab: every tab already has it. */
  const lastAppliedRef = useRef<JanttData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (evt) => {
      const msg: unknown = evt.data;
      if (!isPlanMutatedMessage(msg)) return;
      if (msg.senderId === senderId || msg.projectId !== activeProjectIdRef.current) return;

      const current = parsedDataRef.current;
      if (current && calculatePlanHash(current) === calculatePlanHash(msg.data)) return;

      // The sister tab holds the same plan this tab would: mirror it, with its validation result.
      const s = settersRef.current;
      parsedDataRef.current = msg.data;
      lastAppliedRef.current = msg.data;
      s.setParsedData(msg.data);
      s.setPeople(Array.isArray(msg.data.people) ? msg.data.people : []);
      s.setTeams(Array.isArray(msg.data.teams) ? msg.data.teams : []);
      s.setJsonText(JSON.stringify(msg.data, null, 2));
      s.setValidationResult(validate(msg.data));
    };

    return () => {
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [senderId]);

  /** Sends a saved plan to this browser's other tabs. */
  const broadcastLocalChange = useCallback(
    (projectId: string, data: JanttData) => {
      const channel = channelRef.current;
      // Autosave of a plan that came from another tab: re-sending it would only echo back.
      if (!channel || data === lastAppliedRef.current) return;
      const message: PlanMutatedMessage = {
        type: "PLAN_MUTATED",
        senderId,
        projectId,
        timestamp: new Date().toISOString(),
        data
      };
      try {
        channel.postMessage(message);
      } catch {
        // intentionally ignored: a closed channel or an uncloneable value only skips this
        // best-effort hint; every tab still reads the saved plan from storage on its next load.
      }
    },
    [senderId]
  );

  return {
    broadcastLocalChange,
    /** Identifies this tab in cross-tab messages. */
    peerId: senderId
  };
}

```

### Core Architecture Module: `apps/playground/src/hooks/useEditorState.ts`
```
import { useState, useRef, useCallback, useEffect, type SetStateAction } from "react";
import {
  type JanttData,
  type Task,
  type Person,
  type Team,
  type ValidationResult,
  validate,
  downloadCsv,
  syncTaskProgressAndStatus,
  calculatePlanHash,
  compareCompositeTimestamps
} from "@jantt/core";
import { commandBus } from "../services/bus";
import { getPeerId } from "../utils";

/** Typing in the JSON editor is parsed/validated once the user pauses this long. */
export const EDITOR_PARSE_DEBOUNCE_MS = 250;

/** Identity and CRDT bookkeeping keys of a task; every other changed key gets a field stamp. */
const UNSTAMPED_TASK_KEYS = new Set(["id", "fieldTimestamps", "updatedAt", "updatedBy", "deletedAt"]);

interface UseEditorStateOptions {
  initialJson: string;
  initialParsed: JanttData | null;
  onPeopleChange?: (people: Person[]) => void;
  onTeamsChange?: (teams: Team[]) => void;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasOwn(obj: object | undefined, key: string): boolean {
  return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/** Field-wise newest of two timestamp maps, so stale copies can never move a stamp backwards. */
function mergeFieldTimestamps(
  older: Record<string, string> | undefined,
  newer: Record<string, string> | undefined
): Record<string, string> {
  const merged: Record<string, string> = { ...(newer || {}) };
  if (older) {
    for (const [field, ts] of Object.entries(older)) {
      if (compareCompositeTimestamps(ts, merged[field]) > 0) merged[field] = ts;
    }
  }
  return merged;
}

export interface StampOptions {
  peerId: string;
  nowIso: string;
  /** Re-derive status <-> progress for tasks whose status or progress changed (chart edits). */
  syncStatusProgress: boolean;
}

/**
 * Stamps every locally changed task field with a fresh composite timestamp so the edit wins
 * last-writer-wins merges with collaborators. Tasks without changes keep their identity.
 */
export function stampLocalChanges(
  prev: JanttData | null,
  next: JanttData,
  { peerId, nowIso, syncStatusProgress }: StampOptions
): JanttData {
  const compositeTs = `${nowIso}#${peerId}`;
  const prevTaskMap = new Map<string, Task>((prev?.tasks || []).map((t) => [t.id, t]));

  const tasks = (next.tasks || []).map((t) => {
    const before = prevTaskMap.get(t.id);
    // Untouched task (same object): nothing to stamp or sync. Keeps large commits cheap.
    if (before === t) return t;
    let current: Task = t;

    if (syncStatusProgress) {
      const statusChanged = !before || before.status !== t.status;
      const progressChanged = !before || before.progress !== t.progress;
      let patch: Partial<Task> | null = null;
      if (!before || (statusChanged && progressChanged)) patch = { status: t.status, progress: t.progress };
      else if (statusChanged) patch = { status: t.status };
      else if (progressChanged) patch = { progress: t.progress };
      if (patch) {
        const synced = syncTaskProgressAndStatus(patch, t);
        const status = "status" in synced ? synced.status : t.status;
        const progress = "progress" in synced ? synced.progress : t.progress;
        if (status !== t.status || progress !== t.progress) {
          current = { ...t, status, progress };
        }
      }
    }

    const fieldTimestamps = mergeFieldTimestamps(before?.fieldTimestamps, current.fieldTimestamps);
    let changed = !before;
    const fields = before ? new Set([...Object.keys(before), ...Object.keys(current)]) : Object.keys(current);
    for (const field of fields) {
      if (UNSTAMPED_TASK_KEYS.has(field)) continue;
      const value = current[field];
      if (before ? !sameValue(value, before[field]) : value !== undefined) {
        fieldTimestamps[field] = compositeTs;
        changed = true;
      }
    }

    if (changed) {
      return { ...current, fieldTimestamps, updatedAt: nowIso, updatedBy: peerId };
    }
    if (!sameValue(fieldTimestamps, current.fieldTimestamps || {})) {
      return { ...current, fieldTimestamps };
    }
    return current;
  });

  return { ...next, tasks };
}

/** Bumps the plan revision and refreshes the content hash / sync metadata for a local commit. */
function withCommitMeta(data: JanttData, peerId: string, nowIso: string): JanttData {
  const nextRevision = (data.meta?.revision || 0) + 1;
  const interim: JanttData = {
    ...data,
    meta: { ...data.meta, revision: nextRevision, updatedAt: nowIso }
  };
  const contentHash = calculatePlanHash(interim);
  return {
    ...interim,
    meta: {
      ...interim.meta,
      contentHash,
      sync: {
        ...(interim.meta?.sync || {}),
        revision: nextRevision,
        contentHash,
        updatedAt: nowIso,
        clientId: peerId
      }
    }
  };
}

/**
 * Resolves the task list of a commit against the current plan.
 * A commit that silently omits two or more live tasks is treated as a partial update (for
 * example a filtered view): omitted tasks are kept and new tasks are added. Tasks the commit
 * explicitly deletes (a new entry in `meta.tombstones`) are always removed. Soft-deleted
 * (`_deleted`) tasks a view left out are always kept.
 */
export function mergeCommittedTasks(
  master: Task[],
  updated: Task[],
  masterTombstones?: Record<string, { deletedAt: string }>,
  updatedTombstones?: Record<string, { deletedAt: string }>
): Task[] {
  const isExplicitlyDeleted = (id: string) =>
    hasOwn(updatedTombstones, id) &&
    (!hasOwn(masterTombstones, id) || updatedTombstones![id]?.deletedAt !== masterTombstones![id]?.deletedAt);

  const updatedMap = new Map(updated.map((t) => [t.id, t]));
  let silentlyMissing = 0;
  const droppedSoftDeleted: Task[] = [];
  for (const t of master) {
    if (updatedMap.has(t.id) || isExplicitlyDeleted(t.id)) continue;
    if (t._deleted) droppedSoftDeleted.push(t);
    else silentlyMissing++;
  }
  if (silentlyMissing <= 1) {
    // Views usually omit soft-deleted tasks; keep them so the deletion keeps propagating
    return droppedSoftDeleted.length > 0 ? [...updated, ...droppedSoftDeleted] : updated;
  }

  const masterIds = new Set<string>();
  const merged: Task[] = [];
  for (const t of master) {
    masterIds.add(t.id);
    const next = updatedMap.get(t.id);
    if (next) merged.push(next);
    else if (!isExplicitlyDeleted(t.id)) merged.push(t);
  }
  for (const t of updated) {
    if (!masterIds.has(t.id)) merged.push(t);
  }
  return merged;
}

export function useEditorState({
  initialJson,
  initialParsed,
  onPeopleChange,
  onTeamsChange
}: UseEditorStateOptions) {
  const [jsonText, setJsonTextState] = useState(initialJson);
  const [parsedData, setParsedDataState] = useState<JanttData | null>(initialParsed);
  const [validationResult, setValidationResult] = useState<ValidationResult>(() =>
    validate(initialParsed || {})
  );
  const [copiedJson, setCopiedJson] = useState(false);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const parseTimerRef = useRef<number | null>(null);

  const parsedDataRef = useRef(parsedData);
  parsedDataRef.current = parsedData;

  const onPeopleChangeRef = useRef(onPeopleChange);
  onPeopleChangeRef.current = onPeopleChange;
  const onTeamsChangeRef = useRef(onTeamsChange);
  onTeamsChangeRef.current = onTeamsChange;

  const cancelPendingParse = useCallback(() => {
    if (parseTimerRef.current !== null) {
      window.clearTimeout(parseTimerRef.current);
      parseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingParse();
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [cancelPendingParse]);

  const notifyRegistries = useCallback((data: JanttData) => {
    if (Array.isArray(data.people)) onPeopleChangeRef.current?.(data.people);
    if (Array.isArray(data.teams)) onTeamsChangeRef.current?.(data.teams);
  }, []);

  // External loads (project switch, remote merge, restore) supersede any half-typed edit
  const setParsedData = useCallback(
    (value: SetStateAction<JanttData | null>) => {
      cancelPendingParse();
      if (typeof value !== "function") parsedDataRef.current = value;
      setParsedDataState(value);
    },
    [cancelPendingParse]
  );

  const setJsonText = useCallback(
    (value: SetStateAction<string>) => {
      cancelPendingParse();
      setJsonTextState(value);
    },
    [cancelPendingParse]
  );

  /** Parses editor text; a syntax or schema error keeps the last valid plan on screen. */
  const applyEditorText = useCallback(
    (text: string) => {
      let parsed: JanttData;
      try {
        parsed = JSON.parse(text);
      } catch (err: any) {
        setValidationResult({
          valid: false,
          errors: [
            {
              path: "$",
              code: "SCHEMA_MISMATCH",
              message: `JSON Syntax Error: ${err.message}`,
              suggestion: "Fix syntax error (missing comma, unclosed bracket, or quote)."
            }
          ]
        });
        return;
      }
      const val = validate(parsed);
      setValidationResult(val);
      if (!val.valid) return;

      // Stamp edited fields so JSON edits survive merges with collaborators
      const data = stampLocalChanges(parsedDataRef.current, parsed, {
        peerId: getPeerId(),
        nowIso: new Date().toISOString(),
        syncStatusProgress: false
      });
      parsedDataRef.current = data;
      setParsedDataState(data);
      notifyRegistries(data);
    },
    [notifyRegistries]
  );

  const handleEditorChange = useCallback(
    (text: string) => {
      setJsonTextState(text);
      cancelPendingParse();
      parseTimerRef.current = window.setTimeout(() => {
        parseTimerRef.current = nu
```

### Core Architecture Module: `apps/playground/src/hooks/useGanttViewport.ts`
```
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type TimeScale,
  type LinkRoutingStyle,
  type RowHeightMode,
  type ThemeDefinition,
  themeManager
} from "@jantt/core";
import type { ActiveView } from "../types";
import { STORAGE_KEYS, AVAILABLE_THEMES } from "../constants";
import { storageService } from "../services/storage";

/** Theme ids reach share links, embed snippets and storage: only registered themes are accepted. */
function isKnownThemeId(themeId: unknown): themeId is string {
  return typeof themeId === "string" && Boolean(themeManager.getTheme(themeId));
}

interface UseGanttViewportOptions {
  initialTheme: string;
  initialScale: TimeScale;
  initialRouting: LinkRoutingStyle;
  initialRowHeightMode: RowHeightMode;
  initialRowHeight: number;
  initialCritical: boolean;
  initialBaselines: boolean;
  initialAutoCascade: boolean;
  initialView: ActiveView;
}

export function useGanttViewport(options: UseGanttViewportOptions) {
  /** The user's own theme choice; the only theme that is persisted. */
  const [personalThemeId, setPersonalThemeId] = useState(() =>
    isKnownThemeId(options.initialTheme) ? options.initialTheme : AVAILABLE_THEMES[0].id
  );
  /** Session-only theme imposed by the open plan (e.g. a cloud room); never persisted. */
  const [planThemeId, setPlanThemeId] = useState<string | null>(null);
  const selectedThemeId = planThemeId ?? personalThemeId;
  const activeTheme: ThemeDefinition = themeManager.getTheme(selectedThemeId) || AVAILABLE_THEMES[0];
  const [currentScale, setCurrentScale] = useState<TimeScale>(options.initialScale);
  const [currentDayWidth, setCurrentDayWidth] = useState<number | undefined>(() => {
    const raw = storageService.getItem<string>(STORAGE_KEYS.DAY_WIDTH);
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });
  const [linkRouting, setLinkRouting] = useState<LinkRoutingStyle>(options.initialRouting);
  const [rowHeightMode, setRowHeightMode] = useState<RowHeightMode>(options.initialRowHeightMode);
  const [rowHeight, setRowHeight] = useState<number>(options.initialRowHeight);
  const [showCriticalPath, setShowCriticalPath] = useState(options.initialCritical);
  const [showBaselines, setShowBaselines] = useState(options.initialBaselines);
  const [autoCascade, setAutoCascade] = useState<boolean>(options.initialAutoCascade);
  const [activeView, setActiveViewState] = useState<ActiveView>(options.initialView);

  /** Explicit user choice: becomes the personal theme and drops any plan override. Unknown ids are ignored. */
  const setSelectedThemeId = useCallback((themeId: string) => {
    if (!isKnownThemeId(themeId)) return;
    setPersonalThemeId(themeId);
    setPlanThemeId(null);
  }, []);

  /** Applies a plan-provided theme for this session only (pass null to restore the personal theme). */
  const applyPlanTheme = useCallback((themeId: string | null) => {
    setPlanThemeId(isKnownThemeId(themeId) ? themeId : null);
  }, []);

  const setActiveView = useCallback((newView: ActiveView) => {
    setActiveViewState(newView);
    storageService.setItem(STORAGE_KEYS.VIEW, newView);
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("view", newView);
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {}
  }, []);

  // storageService never throws and keeps the newest value in memory when storage is full.
  useEffect(() => {
    storageService.setItem(STORAGE_KEYS.THEME, personalThemeId);
    storageService.setItem(STORAGE_KEYS.SCALE, currentScale);
    if (currentDayWidth !== undefined && Number.isFinite(currentDayWidth)) {
      storageService.setItem(STORAGE_KEYS.DAY_WIDTH, String(currentDayWidth));
    } else {
      storageService.removeItem(STORAGE_KEYS.DAY_WIDTH);
    }
    storageService.setItem(STORAGE_KEYS.ROUTING, linkRouting);
    storageService.setItem(STORAGE_KEYS.ROW_HEIGHT_MODE, rowHeightMode);
    storageService.setItem(STORAGE_KEYS.ROW_HEIGHT, String(rowHeight));
    storageService.setItem(STORAGE_KEYS.CRITICAL, String(showCriticalPath));
    storageService.setItem(STORAGE_KEYS.BASELINES, String(showBaselines));
    storageService.setItem(STORAGE_KEYS.AUTO_CASCADE, String(autoCascade));
    storageService.setItem(STORAGE_KEYS.VIEW, activeView);
  }, [
    personalThemeId,
    currentScale,
    currentDayWidth,
    linkRouting,
    rowHeightMode,
    rowHeight,
    showCriticalPath,
    showBaselines,
    autoCascade,
    activeView
  ]);

  // Stable identity while nothing changed, so consumers' effects and memos do not churn.
  return useMemo(
    () => ({
      selectedThemeId,
      setSelectedThemeId,
      applyPlanTheme,
      activeTheme,
      currentScale,
      setCurrentScale,
      currentDayWidth,
      setCurrentDayWidth,
      linkRouting,
      setLinkRouting,
      rowHeightMode,
      setRowHeightMode,
      rowHeight,
      setRowHeight,
      showCriticalPath,
      setShowCriticalPath,
      showBaselines,
      setShowBaselines,
      autoCascade,
      setAutoCascade,
      activeView,
      setActiveView
    }),
    [
      selectedThemeId,
      setSelectedThemeId,
      applyPlanTheme,
      activeTheme,
      currentScale,
      currentDayWidth,
      linkRouting,
      rowHeightMode,
      rowHeight,
      showCriticalPath,
      showBaselines,
      autoCascade,
      activeView,
      setActiveView
    ]
  );
}

```

### Core Architecture Module: `apps/playground/src/hooks/useMobileDetection.ts`
```
import { useState, useEffect } from "react";

export type DeviceOrientation = "portrait" | "landscape";

export interface MobileDetectionState {
  isMobile: boolean;
  isTablet: boolean;
  orientation: DeviceOrientation;
  isLandscape: boolean;
  isPortrait: boolean;
  isImmersiveLandscape: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Breakpoints shared with index.css. Keep the CSS `@media` rules for the mobile layout in sync:
 * narrow screens, plus landscape phones (short, touch-first) that are wider than 768px.
 */
export const MOBILE_MEDIA_QUERY =
  "(max-width: 768px), (max-height: 500px) and (max-width: 950px) and (pointer: coarse)";
const TABLET_MEDIA_QUERY = "(max-width: 1024px)";
const LANDSCAPE_MEDIA_QUERY = "(orientation: landscape)";
/** Full-bleed chart without chrome: only for touch phones held sideways, never for small desktop windows. */
const IMMERSIVE_MEDIA_QUERY = "(orientation: landscape) and (max-height: 519px) and (pointer: coarse)";

const SSR_STATE: MobileDetectionState = {
  isMobile: false,
  isTablet: false,
  orientation: "landscape",
  isLandscape: true,
  isPortrait: false,
  isImmersiveLandscape: false,
  viewportWidth: 1280,
  viewportHeight: 800
};

function canMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function readState(): MobileDetectionState {
  if (!canMatchMedia()) return SSR_STATE;
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const isLandscape = window.matchMedia(LANDSCAPE_MEDIA_QUERY).matches;
  return {
    isMobile,
    isTablet: !isMobile && window.matchMedia(TABLET_MEDIA_QUERY).matches,
    orientation: isLandscape ? "landscape" : "portrait",
    isLandscape,
    isPortrait: !isLandscape,
    isImmersiveLandscape: isMobile && window.matchMedia(IMMERSIVE_MEDIA_QUERY).matches,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
}

/** Compares only the layout-driving flags, so pure size changes do not re-render the app. */
function sameLayout(a: MobileDetectionState, b: MobileDetectionState): boolean {
  return (
    a.isMobile === b.isMobile &&
    a.isTablet === b.isTablet &&
    a.isLandscape === b.isLandscape &&
    a.isImmersiveLandscape === b.isImmersiveLandscape
  );
}

/**
 * Device-class detection driven by `matchMedia`, so JS layout decisions and CSS breakpoints agree.
 * Updates only when a breakpoint flips; `viewportWidth`/`viewportHeight` are a snapshot from that moment.
 */
export function useMobileDetection(): MobileDetectionState {
  const [state, setState] = useState<MobileDetectionState>(readState);

  useEffect(() => {
    if (!canMatchMedia()) return;
    const update = () => {
      setState((prev) => {
        const next = readState();
        return sameLayout(prev, next) ? prev : next;
      });
    };
    const queries = [MOBILE_MEDIA_QUERY, TABLET_MEDIA_QUERY, LANDSCAPE_MEDIA_QUERY, IMMERSIVE_MEDIA_QUERY].map(
      (q) => window.matchMedia(q)
    );
    queries.forEach((mql) => {
      if (typeof mql.addEventListener === "function") mql.addEventListener("change", update);
      else mql.addListener(update);
    });
    update();
    return () => {
      queries.forEach((mql) => {
        if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", update);
        else mql.removeListener(update);
      });
    };
  }, []);

  return state;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #46** (2026-11-02): **Standalone - Unpkg src not found**
  *Symptoms*: ### Bug Description  Tried to run standalone. Saved the html in a text file and open in browser.  1. https://github.com/AhmadHassan-BTed/Jantt/#2-plain-html--script-tag-janttstandalone 2. https://github.com/AhmadHassan-BTed/Jantt/#2-standalone-plain-html-janttstandalone  <br>      https://unpkg.com/@jantt/standalone `Package not found: @jantt/standalone`  <br>    From devtools `GET https://unpkg.com/@jantt/standalone net::ERR_ABORTED 404` `GET https://unpkg.com/@jantt/standalone/dist/jantt.css net::ERR_ABORTED 404`  <br>    https://unpkg.com/@jantt `Invalid URL pathname: /@jantt`  ### Minimal Reproduction JSON Payload  ```json {     tasks: [         { id: "t1", label: "Architecture RFC", category: "core", start: "2026-09-01", end: "2026-09-14", progress: 1.0 },         { id: "t2", label: "Core Implementation", category: "core", start: "2026-09-15", end: "2026-10-15", dependsOn: "t1" }     ],     categories: {         core: { label: "Core Engineering", color: "#38BDF8" }     }     }; ```  ### Package & Version  @jantt/core@1.1.0  ### Browser / Runtime  Chrome / Chromium  ### Expected Behavior  Expected a working example to show in the browser based on the local file.
  **Post-Mortem & Fix Analysis**:
  > Published: \@jantt/standalone@1.0.0\ is live on npm and now accessible via unpkg: https://unpkg.com/@jantt/standalone

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

### Incident Patch 1: `52ec345e` (2026-11-12)
**Commit Message**: fix(security): lock down realtime database room rules against role escalation and takeover

**File**: `database.rules.json` (modified, +20/-5)
```diff
@@ -20,24 +20,39 @@
           ".write": "auth != null && auth.uid === $uid"
         },
         "shared": {
-          ".write": "auth != null"
+          "$roomId": {
+            ".write": "auth != null && (auth.uid === $uid || root.child('rooms').child($roomId).child('meta/ownerUid').val() === auth.uid || root.child('rooms').child($roomId).child('members/' + auth.uid + '/role').val() === 'owner')"
+          }
         }
       }
     },
     "rooms": {
       "$roomId": {
         ".read": true,
-        ".write": "auth != null && (!data.exists() && newData.child('meta/ownerUid').val() === auth.uid || data.child('meta/ownerUid').val() === auth.uid || data.child('members/' + auth.uid + '/role').val() === 'owner' || data.child('members/' + auth.uid + '/role').val() === 'editor')",
+        ".write": "auth != null && ((!data.exists() && newData.child('meta/ownerUid').val() === auth.uid) || data.child('meta/ownerUid').val() === auth.uid || (data.child('members/' + auth.uid + '/role').val() === 'editor' && (!newData.exists() ? false : (newData.child('members').val() === data.child('members').val() && (!data.child('teams').exists() || newData.child('teams').val() === data.child('teams').val()) && newData.child('meta/ownerUid').val() === data.child('meta/ownerUid').val()))))",
         "meta": {
           ".read": true,
-          ".write": "auth != null && (!data.exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
+          ".write": "auth != null && ((!data.exists() && newData.child('ownerUid').val() === auth.uid) || data.child('ownerUid').val() === auth.uid || (data.parent().child('members/' + auth.uid + '/role').val() === 'editor' && newData.child('ownerUid').val() === data.child('ownerUid').val() && (!data.child('secretKey').exists() || newData.child('secretKey').val() === data.child('secretKey').val())))",
+          "ownerUid": {
+            ".validate": "newData.isString() && (!data.exists() ? newData.val() === auth.uid : newData.val() === data.val())"
+          },
+          "secretKey": {
+            ".validate": "!data.exists() || newData.val() === data.val() || data.parent().child('ownerUid').val() === auth.uid"
+          }
         },
         "members": {
           "$memberUid": {
             ".read": true,
-            ".write": "auth != null && (!data.parent().parent().exists() || data.parent().parent().child('meta/ownerUid').val() === auth.uid || auth.uid === $memberUid)"
+            ".write": "auth != null && (data.parent().parent().child('meta/ownerUid').val() === auth.uid || (!data.parent().parent().exists() && auth.uid === $memberUid && newData.child('role').val() === 'owner') || (auth.uid === $memberUid && (!newData.exists() || (data.exists() && newData.child('role').val() === data.child('role').val()) || (!data.exists() && newData.child('role').val() === 'viewer'))))",
+            "role": {
+              ".validate": "newData.val() === 'owner' || newData.val() === 'editor' || newData.val() === 'viewer'"
+            }
           }
         },
+        "teams": {
+          ".read": true,
+          ".write": "auth != null && data.parent().child('meta/ownerUid').val() === auth.uid"
+        },
         "presence": {
           ".read": true,
           "$uid": {
@@ -46,7 +61,7 @@
         },
         "data": {
           ".read": true,
-          ".write": "auth != null && (!data.parent().exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
+          ".write": "auth != null && (data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'owner' || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
         }
       }
     }
```

---

### Incident Patch 2: `9839bfa8` (2026-11-16)
**Commit Message**: feat: production-readiness hardening pass and security fixes

- Harden core scheduling pipeline, CPM, analytics, and date math
- Fix RTDB security rules, access control, and sanitization
- Split App.tsx and useRoomSync into modular stores and engines
- Enhance playground views, modals, error boundaries, and sharing
- Update CI/CD workflows, build configs, and package exports
- Add comprehensive test suites and production documentation

**File**: `.editorconfig` (modified, +3/-0)
```diff
@@ -16,3 +16,6 @@ indent_size = 2
 
 [Makefile]
 indent_style = tab
+
+[*.py]
+indent_size = 4
```

**File**: `.env.example` (modified, +23/-12)
```diff
@@ -1,18 +1,29 @@
 # ==============================================================================
 # Jantt Environment Configuration Template
-# Copy this file to .env for local development and customization.
+# Copy this file to `.env` at the repository root (git-ignored). The playground's
+# Vite config reads it for both the dev server and the app build (envDir = repo root),
+# and Docker Compose reads it for the published port. Shell variables take precedence.
 # ==============================================================================
 
-# Port configuration
-VITE_PLAYGROUND_PORT=5173
-JANTT_CLI_PORT=4173
+# --- Playground dev server (npm run dev) ---
+# Interface to bind. Keep the loopback default unless you need LAN access
+# (for example testing on a phone), then use 0.0.0.0.
+PLAYGROUND_HOST=localhost
+PLAYGROUND_PORT=5173
 
-# Host binding (localhost or 0.0.0.0 for Docker containers)
-HOST=localhost
+# --- Docker Compose (docker compose up) ---
+# Host port for the containerised static playground (nginx listens on 8080 inside).
+PLAYGROUND_HTTP_PORT=8080
 
-# Feature flags & Analytics (opt-in only, default disabled)
-VITE_ENABLE_ANALYTICS=false
-VITE_ENABLE_AI_PROMPTING=true
-
-# CI / Production builds
-NODE_ENV=development
+# --- Firebase (cloud rooms, GitHub sign-in) ---
+# Leave these empty to use the public jantt-cloud project built into the playground.
+# Forks and self-hosted deployments should set all of them to their own Firebase
+# project (Project settings > General > Your apps > SDK config). These values are
+# public client identifiers, not secrets: access is enforced by database.rules.json.
+VITE_FIREBASE_API_KEY=
+VITE_FIREBASE_AUTH_DOMAIN=
+VITE_FIREBASE_DATABASE_URL=
+VITE_FIREBASE_PROJECT_ID=
+VITE_FIREBASE_STORAGE_BUCKET=
+VITE_FIREBASE_MESSAGING_SENDER_ID=
+VITE_FIREBASE_APP_ID=
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +5/-0)
```diff
@@ -45,7 +45,12 @@ body:
         - Firefox
         - Safari
         - Node.js (CLI)
+        - Node.js (MCP server)
         - React / Next.js / Vite
+        - Vue / Svelte
+        - Web Component (<jantt-timeline>)
+        - Script tag (@jantt/standalone)
+        - Python / Jupyter / Streamlit
         - Other
     validations:
       required: true
```

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +6/-3)
```diff
@@ -20,11 +20,14 @@ Briefly describe the changes introduced by this pull request.
 
 ## Testing Checklist
 
-- [ ] All unit and integration tests pass (`npm test`)
-- [ ] TypeScript types compile without errors (`npm run typecheck`)
+Run these in order: the typecheck and several test suites consume the built `@jantt/core`.
+
 - [ ] Monorepo packages build cleanly (`npm run build`)
+- [ ] Lint passes: TypeScript typecheck and CLI syntax (`npm run lint`)
+- [ ] All unit and integration tests pass (`npm test`)
+- [ ] Published package contents are valid (`npm run check:packages`)
 - [ ] Added new unit tests covering the modified behavior
-- [ ] Zero runtime dependencies added to `@jantt/core`
+- [ ] No new runtime dependency added to `@jantt/core` (it ships with exactly one: `fflate`)
 
 ---
 
```

**File**: `.github/workflows/ci.yml` (modified, +27/-5)
```diff
@@ -5,22 +5,30 @@ on:
     branches: [main, master]
   pull_request:
     branches: [main, master]
+  workflow_call:
+
+permissions:
+  contents: read
 
 concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
   cancel-in-progress: true
 
 jobs:
   validate:
-    name: Test & Typecheck (Node ${{ matrix.node-version }})
+    name: Build, Lint & Test (Node ${{ matrix.node-version }})
     runs-on: ubuntu-latest
     strategy:
+      fail-fast: false
       matrix:
-        node-version: [20.x, 22.x]
+        # Both active LTS lines; the floor is "engines" in the root package.json.
+        node-version: [22.x, 24.x]
 
     steps:
       - name: Checkout Code
         uses: actions/checkout@v4
+        with:
+          persist-credentials: false
 
       - name: Setup Node.js ${{ matrix.node-version }}
         uses: actions/setup-node@v6
@@ -31,19 +39,33 @@ jobs:
       - name: Install Dependencies
         run: npm ci
 
+      # Build first: typecheck and several test suites consume the built @jantt/core.
       - name: Build All Packages
         run: npm run build
 
-      - name: TypeScript Typecheck
-        run: npm run typecheck
+      - name: Lint (TypeScript Typecheck & CLI Syntax)
+        run: npm run lint
 
       - name: Run Test Suite
         run: npm test
 
+      - name: Verify Published Package Contents
+        run: npm run check:packages
+
+  python:
+    name: Python Bridge Tests
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout Code
+        uses: actions/checkout@v4
+        with:
+          persist-credentials: false
+
       - name: Setup Python
         uses: actions/setup-python@v7
         with:
           python-version: "3.11"
 
       - name: Run Python Tests
-        run: npm run test:python
+        run: python -m unittest discover -s python/tests
```

**File**: `.github/workflows/deploy-pages.yml` (modified, +26/-6)
```diff
@@ -1,7 +1,10 @@
 name: Deploy Playground to GitHub Pages
 
 on:
-  push:
+  # Deploy only commits that passed the full CI pipeline on main.
+  workflow_run:
+    workflows: ["CI Pipeline"]
+    types: [completed]
     branches: [main]
   workflow_dispatch:
 
@@ -11,30 +14,47 @@ permissions:
   pages: write
   id-token: write
 
-# Allow one concurrent deployment
+# One deployment at a time; never cancel a deployment that is already running.
 concurrency:
   group: "pages"
-  cancel-in-progress: true
+  cancel-in-progress: false
 
 jobs:
   build:
     name: Build Playground
+    if: >-
+      github.event_name == 'workflow_dispatch' ||
+      (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push')
     runs-on: ubuntu-latest
     steps:
       - name: Checkout Code
         uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
+          persist-credentials: false
 
       - name: Setup Node.js
         uses: actions/setup-node@v6
         with:
-          node-version: 20.x
+          node-version-file: .nvmrc
           cache: "npm"
 
       - name: Install Dependencies
         run: npm ci
 
-      - name: Build All Monorepo Workspaces
-        run: npm run build
+      # The playground bundles @jantt/core, react, interop and render-canvas from source;
+      # its typecheck reads the interop and render-canvas typings, which need core's.
+      - name: Build Playground
+        run: npm run build -w @jantt/core -w @jantt/interop -w @jantt/render-canvas -w @jantt/playground
+        env:
+          # Optional repository variables for forks/self-hosting; empty falls back to jantt-cloud.
+          VITE_FIREBASE_API_KEY: ${{ vars.FIREBASE_API_KEY }}
+          VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.FIREBASE_AUTH_DOMAIN }}
+          VITE_FIREBASE_DATABASE_URL: ${{ vars.FIREBASE_DATABASE_URL }}
+          VITE_FIREBASE_PROJECT_ID: ${{ vars.FIREBASE_PROJECT_ID }}
+          VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.FIREBASE_STORAGE_BUCKET }}
+          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.FIREBASE_MESSAGING_SENDER_ID }}
+          VITE_FIREBASE_APP_ID: ${{ vars.FIREBASE_APP_ID }}
 
       - name: Setup Pages
         uses: actions/configure-pages@v6
```

**File**: `.github/workflows/release.yml` (modified, +95/-18)
```diff
@@ -5,41 +5,118 @@ on:
     tags:
       - "v*.*.*"
 
+permissions:
+  contents: read
+
+concurrency:
+  group: release-${{ github.ref }}
+  cancel-in-progress: false
+
 jobs:
-  publish:
-    name: Publish Packages to npm
-    runs-on: ubuntu-latest
-    permissions:
-      contents: write
-      id-token: write
+  ci:
+    name: CI Gate
+    uses: ./.github/workflows/ci.yml
 
+  build:
+    name: Build & Verify Packages
+    needs: ci
+    runs-on: ubuntu-latest
     steps:
       - name: Checkout Repository
         uses: actions/checkout@v4
+        with:
+          persist-credentials: false
 
-      - name: Setup Node.js (v20)
+      - name: Setup Node.js
         uses: actions/setup-node@v6
         with:
-          node-version: 20
-          registry-url: "https://registry.npmjs.org"
+          node-version-file: .nvmrc
+          cache: "npm"
+
+      - name: Verify Tag Matches Package Versions
+        run: |
+          node -e '
+            const fs = require("fs");
+            const path = require("path");
+            const want = process.env.GITHUB_REF_NAME.replace(/^v/, "");
+            const dirs = [...fs.readdirSync("packages").map((d) => path.join("packages", d)), "cli"];
+            const bad = dirs
+              .map((d) => JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8")))
+              .filter((pkg) => !pkg.private && pkg.version !== want)
+              .map((pkg) => `${pkg.name}@${pkg.version}`);
+            if (bad.length) {
+              console.error(`Tag ${process.env.GITHUB_REF_NAME} does not match: ${bad.join(", ")}`);
+              process.exit(1);
+            }
+          '
 
       - name: Install Dependencies
         run: npm ci
 
       - name: Compile Production Bundles
         run: npm run build
 
-      - name: Run Verification Suite
-        run: npm test
+      - name: Verify Published Package Contents
+        run: npm run check:packages
+
+      - name: Upload Package Builds
+        uses: actions/upload-artifact@v4
+        with:
+          name: package-dist
+          path: packages/*/dist
+          if-no-files-found: error
+          retention-days: 7
+
+  publish:
+    name: Publish Packages to npm
+    needs: build
+    runs-on: ubuntu-latest
+    # OIDC token for npm provenance; no dependency install runs in this job.
+    permissions:
+      contents: read
+      id-token: write
+    steps:
+      - name: Checkout Repository
+        uses: actions/checkout@v4
+        with:
+          persist-credentials: false
+
+      - name: Setup Node.js
+        uses: actions/setup-node@v6
+        with:
+          node-version-file: .nvmrc
+          registry-url: "https://registry.npmjs.org"
+
+      - name: Download Package Builds
+        uses: actions/download-artifact@v4
+        with:
+          name: package-dist
+          path: packages
 
-      - name: Publish Workspaces to NPM
-        run: npm publish --workspaces --access public
+      # Idempotent: versions already on the registry are skipped, so a re-run after a
+      # partial failure publishes only what is missing.
+      - name: Publish Workspaces to npm
+        run: |
+          for dir in packages/* cli; do
+            name=$(node -p "require('./$dir/package.json').name")
+            version=$(node -p "require('./$dir/package.json').version")
+            if npm view "$name@$version" version > /dev/null 2>&1; then
+              echo "Skipping $name@$version (already published)"
+            else
+              npm publish "./$dir" --provenance --access public
+            fi
+          done
         env:
           NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
+  github-release:
+    name: Create GitHub Release
+    needs: publish
+    runs-on: ubuntu-latest
+    permissions:
+      contents: write
+    steps:
       - name: Create GitHub Release
-        uses: softprops/action-gh-release@v2
-        with:
-          generate_release_notes: true
-          draft: false
-          prerelease: false
+        run: gh release create "$GITHUB_REF_NAME" --repo "$GITHUB_REPOSITORY" --title "$GITHUB_REF_NAME" --generate-notes --verify-tag
+        env:
+          GH_TOKEN: ${{ github.token }}
```

**File**: `.github/workflows/security.yml` (modified, +18/-4)
```diff
@@ -8,6 +8,9 @@ on:
   schedule:
     - cron: "0 0 * * 0"
 
+permissions:
+  contents: read
+
 jobs:
   analyze:
     name: CodeQL Security Scan
@@ -20,28 +23,39 @@ jobs:
     steps:
       - name: Checkout Repository
         uses: actions/checkout@v4
+        with:
+          persist-credentials: false
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@v3
+        uses: github/codeql-action/init@v4
         with:
           languages: javascript-typescript
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@v3
+        uses: github/codeql-action/analyze@v4
 
   audit:
     name: NPM Dependency Audit
     runs-on: ubuntu-latest
+    permissions:
+      contents: read
 
     steps:
       - name: Checkout Repository
         uses: actions/checkout@v4
+        with:
+          persist-credentials: false
 
       - name: Setup Node.js
         uses: actions/setup-node@v6
         with:
-          node-version: 20
+          node-version-file: .nvmrc
+
+      # Blocking: high/critical advisories in anything that ships to users.
+      - name: Audit Runtime Dependencies
+        run: npm audit --omit=dev --audit-level=high
 
-      - name: Audit Dependencies
+      # Informational: the full tree, including build and test tooling.
+      - name: Audit All Dependencies (report only)
         run: npm audit --audit-level=high
         continue-on-error: true
```

---

### Incident Patch 3: `d21b1202` (2026-11-16)
**Commit Message**: fix(deps): override @grpc/grpc-js and re2js to eliminate security audit vulnerabilities

**File**: `package-lock.json` (modified, +38/-10)
```diff
@@ -783,16 +783,34 @@
       "license": "Apache-2.0"
     },
     "node_modules/@grpc/grpc-js": {
-      "version": "1.9.16",
-      "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.9.16.tgz",
-      "integrity": "sha512-wE4Ut/olIzfKqp631XrG+wbF0v1vWFN4YL9FyXC2LJiG33DsV7PLzURjrCvY/6je2ntdRkeLpPDluzSRGaVltQ==",
+      "version": "1.14.7",
+      "resolved": "https://registry.npmjs.org/@grpc/grpc-js/-/grpc-js-1.14.7.tgz",
+      "integrity": "sha512-W4W/fcBMGRVtG6dW2c7cw2mnpS3hvbBd+oQXjh2iYFTZDk1JJmcNqkM5KSaPubQpamlUUurrlb7G1s9NJeERmQ==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@grpc/proto-loader": "^0.7.8",
-        "@types/node": ">=12.12.47"
+        "@grpc/proto-loader": "^0.8.0",
+        "@js-sdsl/ordered-map": "^4.4.2"
       },
       "engines": {
-        "node": "^8.13.0 || >=10.10.0"
+        "node": ">=12.10.0"
+      }
+    },
+    "node_modules/@grpc/grpc-js/node_modules/@grpc/proto-loader": {
+      "version": "0.8.1",
+      "resolved": "https://registry.npmjs.org/@grpc/proto-loader/-/proto-loader-0.8.1.tgz",
+      "integrity": "sha512-wtF6h+DY6M3YaDBPAmvuuA6jV8Sif9MjtOI5euKFWRgCDl5PeDpPsHR9u2l6St5ceY8AZgoNDww5+HvEsXFsGg==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "lodash.camelcase": "^4.3.0",
+        "long": "^5.0.0",
+        "protobufjs": "^7.5.5",
+        "yargs": "^17.7.2"
+      },
+      "bin": {
+        "proto-loader-gen-types": "build/bin/proto-loader-gen-types.js"
+      },
+      "engines": {
+        "node": ">=6"
       }
     },
     "node_modules/@grpc/proto-loader": {
@@ -900,6 +918,16 @@
         "@jridgewell/sourcemap-codec": "^1.4.14"
       }
     },
+    "node_modules/@js-sdsl/ordered-map": {
+      "version": "4.4.2",
+      "resolved": "https://registry.npmjs.org/@js-sdsl/ordered-map/-/ordered-map-4.4.2.tgz",
+      "integrity": "sha512-iUKgm52T8HOE/makSxjqoWhe95ZJA1/G1sYsGev2JDKUSS14KAgg1LHb+Ba+IPow0xflbnSkOsZcO08C7w1gYw==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/js-sdsl"
+      }
+    },
     "node_modules/@microsoft/api-extractor": {
       "version": "7.43.0",
       "resolved": "https://registry.npmjs.org/@microsoft/api-extractor/-/api-extractor-7.43.0.tgz",
@@ -3532,12 +3560,12 @@
       }
     },
     "node_modules/re2js": {
-      "version": "2.8.6",
-      "resolved": "https://registry.npmjs.org/re2js/-/re2js-2.8.6.tgz",
-      "integrity": "sha512-xLgQil4kIUCrAzVk9fRSkxkFNwmygLFjVxXrLc65aE1F0+Zsb8rxumFBy4XKyvgMCTL6kilDq3EZ0piE2dP/Dg==",
+      "version": "2.10.0",
+      "resolved": "https://registry.npmjs.org/re2js/-/re2js-2.10.0.tgz",
+      "integrity": "sha512-/P6FNnLbHjXJMRF1dPoZoVTyHvFcuVhbDpzml9DPMlbeErYlZ18GueAaG9GhYhAm/9AN7i7Y6crmDrLX0DeJ4Q==",
       "license": "MIT",
       "engines": {
-        "node": ">=18.0.0"
+        "node": ">=20.0.0"
       }
     },
     "node_modules/react": {
```

**File**: `package.json` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@
     "vite": "^8.3.5",
     "vitest": "^5.1.0"
   },
+  "overrides": {
+    "@grpc/grpc-js": "^1.14.7",
+    "re2js": "^2.10.0"
+  },
   "engines": {
     "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
   }
```

#### Recent Merged Pull Requests:
- **PR #64** (2026-11-23): Discussion: Should CPM honor working calendars? (@xuewenquan)
- **PR #63** (closed): Add resource leveling preview and dependency round-trip fixes (@xuewenquan)
- **PR #62** (2026-11-18):  Add resource leveling preview and dependency round-trip fixes (@xuewenquan)
- **PR #60** (2026-11-09): chore(deps-dev): bump @vitejs/plugin-react from 4.7.0 to 6.2.1 (@dependabot[bot])
- **PR #59** (closed): chore(deps-dev): bump vitest from 1.6.1 to 5.1.0 (@dependabot[bot])
- **PR #58** (2026-11-09): chore(deps): bump lucide-react from 0.378.0 to 1.67.0 (@dependabot[bot])

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

## X. security): lock down realtime database room rules against role escalation and ta

**RULE**:
When implementing operations in `database.rules.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in AhmadHassan-BTed/Jantt. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52ec345e`: security): lock down realtime database room rules against role escalation and takeover. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `database.rules.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
          "$roomId": {
            ".write": "auth != null && (auth.uid === $uid || root.child('rooms').child($roomId).child('meta/ownerUid').val() === auth.uid || root.child('rooms').child($roomId).child('members/' + auth.uid + '/role').val() === 'owner')"
          }
        ".write": "auth != null && ((!data.exists() && newData.child('meta/ownerUid').val() === auth.uid) || data.child('meta/ownerUid').val() === auth.uid || (data.child('members/' + auth.uid + '/role').val() === 'editor' && (!newData.exists() ? false : (newData.child('members').val() === data.child('members').val() && (!data.child('teams').exists() || newData.child('teams').val() === data.child('teams').val()) && newData.child('meta/ownerUid').val() === data.child('meta/ownerUid').val()))))",
          ".write": "auth != null && ((!data.exists() && newData.child('ownerUid').val() === auth.uid) || data.child('ownerUid').val() === auth.uid || (data.parent().child('members/' + auth.uid + '/role').val() === 'editor' && newData.child('ownerUid').val() === data.child('ownerUid').val() && (!data.child('secretKey').exists() || newData.child('secretKey').val() === data.child('secretKey').val())))",
          "ownerUid": {
 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
          ".write": "auth != null"
        ".write": "auth != null && (!data.exists() && newData.child('meta/ownerUid').val() === auth.uid || data.child('meta/ownerUid').val() === auth.uid || data.child('members/' + auth.uid + '/role').val() === 'owner' || data.child('members/' + auth.uid + '/role').val() === 'editor')",
          ".write": "auth != null && (!data.exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
            ".write": "auth != null && (!data.parent().parent().exists() || data.parent().parent().child('meta/ownerUid').val() === auth.uid || auth.uid === $memberUid)"
          ".write": "auth != null && (!data.parent().exists() || data.parent().child('meta/ownerUid').val() === auth.uid || data.parent().child('members/' + auth.uid + '/role').val() === 'editor')"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52ec345e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
