# Forensic Learning Record (Deep Inspection): xiaolin/react-image-gallery

> **Canonical Artifact**: `07_PROJECT_LEARNING/xiaolin-react-image-gallery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xiaolin/react-image-gallery](https://github.com/xiaolin/react-image-gallery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:43.855Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xiaolin/react-image-gallery`
- **Description**: React carousel image gallery component with thumbnail support  🖼
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3940 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/hooks/index.ts`
```
export { useGalleryNavigation } from "./useGalleryNavigation";
export { useThumbnails } from "./useThumbnails";
export { useFullscreen } from "./useFullscreen";
export { useAutoPlay } from "./useAutoPlay";

```

### Core Architecture Module: `src/components/hooks/useAutoPlay.ts`
```
import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  DEFAULT_SLIDE_DURATION,
  DEFAULT_SLIDE_INTERVAL,
} from "src/components/constants";
import type { OnPauseCallback, OnPlayCallback, SlideEvent } from "src/types";

interface UseAutoPlayProps {
  autoPlay?: boolean;
  slideInterval?: number;
  slideDuration?: number;
  infinite?: boolean;
  totalSlides: number;
  currentIndex: number;
  canSlideRight: () => boolean;
  slideToIndexCore: (
    index: number,
    event?: SlideEvent,
    isPlayPause?: boolean
  ) => void;
  slideToIndexWithStyleReset: (index: number, event?: SlideEvent) => void;
  onPlay?: OnPlayCallback | null;
  onPause?: OnPauseCallback | null;
}

interface UseAutoPlayReturn {
  isPlaying: boolean;
  playPauseIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  play: (shouldCallOnPlay?: boolean) => void;
  pause: (shouldCallOnPause?: boolean) => void;
  togglePlay: () => void;
}

/**
 * Custom hook for managing autoplay functionality
 * Uses refs to avoid stale closures in setInterval
 */
export function useAutoPlay({
  autoPlay = false,
  slideInterval = DEFAULT_SLIDE_INTERVAL,
  slideDuration = DEFAULT_SLIDE_DURATION,
  infinite = true,
  totalSlides,
  currentIndex,
  canSlideRight,
  slideToIndexCore,
  slideToIndexWithStyleReset,
  onPlay,
  onPause,
}: UseAutoPlayProps): UseAutoPlayReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const playPauseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Ref to hold the latest pauseOrPlay function (avoids stale closure in setInterval)
  const pauseOrPlayRef = useRef<(() => void) | null>(null);

  const pauseOrPlay = useCallback(() => {
    if (!infinite && !canSlideRight()) {
      // Stop at the end if not infinite
      if (playPauseIntervalRef.current) {
        clearInterval(playPauseIntervalRef.current);
        playPauseIntervalRef.current = null;
        setIsPlaying(false);
        if (onPause) {
          onPause(currentIndex);
        }
      }
    } else {
      const nextIndex = currentIndex + 1;
      // Handle 2 slides the same way as manual sliding
      if (totalSlides === 2) {
        slideToIndexWithStyleReset(nextIndex);
      } else {
        slideToIndexCore(nextIndex);
      }
    }
  }, [
    infinite,
    canSlideRight,
    currentIndex,
    totalSlides,
    slideToIndexCore,
    slideToIndexWithStyleReset,
    onPause,
  ]);

  // Keep ref updated with latest pauseOrPlay
  pauseOrPlayRef.current = pauseOrPlay;

  const play = useCallback(
    (shouldCallOnPlay = true) => {
      if (!playPauseIntervalRef.current) {
        setIsPlaying(true);
        playPauseIntervalRef.current = setInterval(
          () => pauseOrPlayRef.current?.(),
          Math.max(slideInterval, slideDuration)
        );
        if (onPlay && shouldCallOnPlay) {
          onPlay(currentIndex);
        }
      }
    },
    [slideInterval, slideDuration, onPlay, currentIndex]
  );

  const pause = useCallback(
    (shouldCallOnPause = true) => {
      if (playPauseIntervalRef.current) {
        clearInterval(playPauseIntervalRef.current);
        playPauseIntervalRef.current = null;
        setIsPlaying(false);
        if (onPause && shouldCallOnPause) {
          onPause(currentIndex);
        }
      }
    },
    [onPause, currentIndex]
  );

  const togglePlay = useCallback(() => {
    if (playPauseIntervalRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  // Refs for stable function access in effects
  const playRef = useRef(play);
  const pauseRef = useRef(pause);
  playRef.current = play;
  pauseRef.current = pause;

  // Reset interval when slideInterval or slideDuration changes
  useEffect(() => {
    if (isPlaying) {
      pauseRef.current(false);
      playRef.current(false);
    }
  }, [slideInterval, slideDuration, isPlaying]);

  // Start autoPlay if enabled
  useEffect(() => {
    if (autoPlay && !playPauseIntervalRef.current) {
      playRef.current();
    }
  }, [autoPlay]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playPauseIntervalRef.current) {
        clearInterval(playPauseIntervalRef.current);
        playPauseIntervalRef.current = null;
      }
    };
  }, []);

  return {
    isPlaying,
    playPauseIntervalRef,
    play,
    pause,
    togglePlay,
  };
}

export default useAutoPlay;

```

### Core Architecture Module: `src/components/hooks/useFullscreen.ts`
```
import { useCallback, useState } from "react";
import type { RefObject } from "react";
import type { OnScreenChangeCallback } from "src/types";

// Extended Document interface for fullscreen API compatibility
interface FullscreenDocument extends Document {
  mozCancelFullScreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
  mozFullScreenElement?: Element;
  webkitFullscreenElement?: Element;
  msFullscreenElement?: Element;
}

interface FullscreenElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface UseFullscreenProps {
  useBrowserFullscreen?: boolean;
  onScreenChange?: OnScreenChangeCallback | null;
  galleryRef: RefObject<HTMLDivElement | null>;
}

interface UseFullscreenReturn {
  isFullscreen: boolean;
  modalFullscreen: boolean;
  fullScreen: () => void;
  exitFullScreen: () => void;
  toggleFullScreen: () => void;
  handleScreenChange: () => void;
}

/**
 * Custom hook for managing fullscreen functionality
 */
export function useFullscreen({
  useBrowserFullscreen = true,
  onScreenChange,
  galleryRef,
}: UseFullscreenProps): UseFullscreenReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalFullscreen, setModalFullscreen] = useState(false);

  // Handle browser fullscreen change events
  const handleScreenChange = useCallback(() => {
    const doc = document as FullscreenDocument;
    const fullScreenElement =
      doc.fullscreenElement ||
      doc.msFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.webkitFullscreenElement;

    const isCurrentlyFullscreen = galleryRef?.current === fullScreenElement;

    if (onScreenChange) {
      onScreenChange(isCurrentlyFullscreen);
    }

    if (useBrowserFullscreen) {
      setIsFullscreen(isCurrentlyFullscreen);
    }
  }, [galleryRef, useBrowserFullscreen, onScreenChange]);

  // Set modal fullscreen (fallback for browsers without fullscreen API)
  const setModalFullscreenState = useCallback(
    (state: boolean) => {
      setModalFullscreen(state);
      if (onScreenChange) {
        onScreenChange(state);
      }
    },
    [onScreenChange]
  );

  // Enter fullscreen
  const fullScreen = useCallback(() => {
    const gallery = galleryRef?.current as FullscreenElement | null;
    if (!gallery) return;

    if (useBrowserFullscreen) {
      if (gallery.requestFullscreen) {
        gallery.requestFullscreen();
      } else if (gallery.msRequestFullscreen) {
        gallery.msRequestFullscreen();
      } else if (gallery.mozRequestFullScreen) {
        gallery.mozRequestFullScreen();
      } else if (gallery.webkitRequestFullscreen) {
        gallery.webkitRequestFullscreen();
      } else {
        // Fallback to modal fullscreen
        setModalFullscreenState(true);
      }
    } else {
      setModalFullscreenState(true);
    }

    setIsFullscreen(true);
  }, [galleryRef, useBrowserFullscreen, setModalFullscreenState]);

  // Exit fullscreen
  const exitFullScreen = useCallback(() => {
    if (!isFullscreen) return;

    const doc = document as FullscreenDocument;

    if (useBrowserFullscreen) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      } else {
        setModalFullscreenState(false);
      }
    } else {
      setModalFullscreenState(false);
    }

    setIsFullscreen(false);
  }, [isFullscreen, useBrowserFullscreen, setModalFullscreenState]);

  // Toggle fullscreen
  const toggleFullScreen = useCallback(() => {
    if (isFullscreen) {
      exitFullScreen();
    } else {
      fullScreen();
    }
  }, [isFullscreen, exitFullScreen, fullScreen]);

  return {
    isFullscreen,
    modalFullscreen,
    fullScreen,
    exitFullScreen,
    toggleFullScreen,
    handleScreenChange,
  };
}

export default useFullscreen;

```

### Core Architecture Module: `src/components/hooks/useGalleryNavigation.ts`
```
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import {
  DEFAULT_EASING,
  DEFAULT_SLIDE_DURATION,
} from "src/components/constants";
import throttle from "src/components/utils/throttle";
import type { GalleryItem } from "src/types";

interface UseGalleryNavigationProps {
  items: GalleryItem[];
  startIndex?: number;
  infinite?: boolean;
  isRTL?: boolean;
  slideDuration?: number;
  onSlide?: (currentIndex: number) => void;
  onBeforeSlide?: (nextIndex: number) => void;
}

interface SlideStyle extends CSSProperties {
  transition?: string;
}

interface ExtendedSlidesResult {
  extendedItems: GalleryItem[];
  getSlideKey: (index: number) => string;
  getRealIndex: (displayIdx: number) => number;
}

interface GetContainerStyleOptions {
  useTranslate3D?: boolean;
  slideVertically?: boolean;
}

interface UseGalleryNavigationReturn {
  currentIndex: number;
  previousIndex: number;
  displayIndex: number;
  isTransitioning: boolean;
  currentSlideOffset: number;
  slideStyle: SlideStyle;
  canSlide: boolean;
  canSlideLeft: () => boolean;
  canSlideRight: () => boolean;
  canSlidePrevious: () => boolean;
  canSlideNext: () => boolean;
  slideToIndex: (index: number, event?: React.SyntheticEvent | Event) => void;
  slideToIndexCore: (
    index: number,
    event?: React.SyntheticEvent | Event,
    isPlayPause?: boolean,
    customDuration?: number
  ) => void;
  slideToIndexWithStyleReset: (
    nextIndex: number,
    event?: React.SyntheticEvent | Event
  ) => void;
  slideLeft: (event?: React.SyntheticEvent | Event) => void;
  slideRight: (event?: React.SyntheticEvent | Event) => void;
  getContainerStyle: (options?: GetContainerStyleOptions) => CSSProperties;
  getExtendedSlides: () => ExtendedSlidesResult;
  getAlignmentClass: (dispIndex: number) => string;
  setCurrentSlideOffset: React.Dispatch<React.SetStateAction<number>>;
  setSlideStyle: React.Dispatch<React.SetStateAction<SlideStyle>>;
  setIsTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
  totalDisplaySlides: number;
}

/**
 * Custom hook for gallery navigation using flex container approach
 *
 * Uses a single container transform with all slides always in DOM.
 * For infinite mode, clones first/last slides and instantly jumps when hitting clones.
 * This eliminates the white flash caused by display:none destroying GPU layers.
 *
 * Flex approach: [clone-last, slide0, slide1, ..., slideN, clone-first]
 * Display index includes clones, currentIndex is the real slide index.
 */
export function useGalleryNavigation({
  items,
  startIndex = 0,
  infinite = true,
  isRTL = false,
  slideDuration = DEFAULT_SLIDE_DURATION,
  onSlide,
  onBeforeSlide,
}: UseGalleryNavigationProps): UseGalleryNavigationReturn {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [previousIndex, setPreviousIndex] = useState(startIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentSlideOffset, setCurrentSlideOffset] = useState(0);
  // For flex approach, we track the container's display position
  // In infinite mode: displayIndex = currentIndex + 1 (because of leading clone)
  const [displayIndex, setDisplayIndex] = useState(
    infinite && items.length > 1 ? startIndex + 1 : startIndex
  );
  const [slideStyle, setSlideStyle] = useState<SlideStyle>({
    transition: `transform ${slideDuration}ms ${DEFAULT_EASING}`,
  });

  const transitionTimerRef = useRef<number | null>(null);
  const jumpTimerRef = useRef<number | null>(null);
  const isJumpingRef = useRef(false);

  const totalSlides = items.length;
  const canSlide = totalSlides >= 2;
  // In infinite mode, we have 2 extra clone slides
  const totalDisplaySlides =
    infinite && totalSlides > 1 ? totalSlides + 2 : totalSlides;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (jumpTimerRef.current) {
        window.clearTimeout(jumpTimerRef.current);
      }
    };
  }, []);

  // Reset index when items change
  useEffect(() => {
    setCurrentIndex(startIndex);
    setDisplayIndex(infinite && items.length > 1 ? startIndex + 1 : startIndex);
    setSlideStyle({ transition: "none" });
  }, [items, startIndex, infinite]);

  const canSlidePrevious = useCallback(() => {
    return currentIndex > 0;
  }, [currentIndex]);

  const canSlideNext = useCallback(() => {
    return currentIndex < totalSlides - 1;
  }, [currentIndex, totalSlides]);

  const canSlideLeft = useCallback(() => {
    return infinite || (isRTL ? canSlideNext() : canSlidePrevious());
  }, [infinite, isRTL, canSlideNext, canSlidePrevious]);

  const canSlideRight = useCallback(() => {
    return infinite || (isRTL ? canSlidePrevious() : canSlideNext());
  }, [infinite, isRTL, canSlideNext, canSlidePrevious]);

  const onSliding = useCallback(() => {
    transitionTimerRef.current = window.setTimeout(() => {
      if (isTransitioning) {
        setIsTransitioning(false);
        if (onSlide) {
          onSlide(currentIndex);
        }
      }
    }, slideDuration + 50);
  }, [isTransitioning, currentIndex, slideDuration, onSlide]);

  /**
   * Convert real slide index to display index (accounting for clone offset)
   */
  const realToDisplayIndex = useCallback(
    (realIndex: number): number => {
      if (infinite && totalSlides > 1) {
        return realIndex + 1; // +1 because of leading clone
      }
      return realIndex;
    },
    [infinite, totalSlides]
  );

  /**
   * Handle instant jump when reaching clone slides (for infinite mode)
   * This is called after the transition to a clone completes
   */
  const handleCloneJump = useCallback(
    (_targetRealIndex: number, targetDisplayIndex: number): void => {
      // Disable transition and instantly jump to the real slide
      isJumpingRef.current = true;
      setSlideStyle({ transition: "none" });
      setDisplayIndex(targetDisplayIndex);

      // Re-enable transition after the instant jump
      jumpTimerRef.current = window.setTimeout(() => {
        setSlideStyle({
          transition: `transform ${slideDuration}ms ${DEFAULT_EASING}`,
        });
        isJumpingRef.current = false;
      }, 50);
    },
    [slideDuration]
  );

  // Core slide to index function (unthrottled)
  const slideToIndexCore = useCallback(
    (
      index: number,
      _event?: React.SyntheticEvent | Event,
      isPlayPause = false,
      customDuration?: number
    ): void => {
      if ((isTransitioning || isJumpingRef.current) && !isPlayPause) return;

      const duration = customDuration ?? slideDuration;
      const slideCount = totalSlides - 1;
      let nextIndex = index;
      let nextDisplayIndex: number;
      let willWrap = false;
      let wrapDirection: "start" | "end" | null = null;

      // Handle wrapping for infinite mode
      if (index < 0) {
        nextIndex = slideCount;
        willWrap = true;
        wrapDirection = "start"; // Going from first to last
      } else if (index > slideCount) {
        nextIndex = 0;
        willWrap = true;
        wrapDirection = "end"; // Going from last to first
      }

      if (infinite && totalSlides > 1) {
        if (willWrap && wrapDirection === "start") {
          // Going left from slide 0: animate to clone at position 0, then jump to real last slide
          nextDisplayIndex = 0;
        } else if (willWrap && wrapDirection === "end") {
          // Going right from last slide: animate to clone at last position, then jump to real first slide
          nextDisplayIndex = totalDisplaySlides - 1;
        } else {
          nextDisplayIndex = nextIndex + 1; // Normal navigation (+1 for leading clone offset)
        }
      } else {
        nextDisplayIndex = nextIndex;
      }

      if (onBeforeSlide && nextIndex !== currentIndex) {
        onBeforeSlide(nextIndex);
      }

      setPreviousIndex(currentIndex);
      setCurrentIndex(nextIndex);
      setDisplayIndex(nextDisplayIndex);
      setIsTransitioning(nextIndex !== currentIndex || willWrap);
      setCurrentSlideOffset(0);
      setSlideStyle({
        transition: `transform ${duration}ms ${DEFAULT_EASING}`,
      });

      // Schedule clone jump if we're wrapping in infinite mode
      if (infinite && totalSlides > 1 && willWrap) {
        transitionTimerRef.current = window.setTimeout(() => {
          setIsTransitioning(false);
          if (onSlide) {
            onSlide(nextIndex);
          }
          // Jump to the real slide after animation completes
          const realDisplayIndex = realToDisplayIndex(nextIndex);
          handleCloneJump(nextIndex, realDisplayIndex);
        }, duration + 20);
      }
    },
    [
      currentIndex,
      totalSlides,
      totalDisplaySlides,
      slideDuration,
      onBeforeSlide,
      onSlide,
      isTransitioning,
      infinite,
      realToDisplayIndex,
      handleCloneJump,
    ]
  );

  // Throttled version for user interactions
  const slideToIndexThrottled: MutableRefObject<
    (index: number, event?: React.SyntheticEvent | Event) => void
  > = useRef(
    throttle(
      (index: number, event?: React.SyntheticEvent | Event) => {
        slideToIndexCore(index, event, false);
      },
      slideDuration,
      { trailing: false }
    )
  );

  // Update throttle when slideDuration changes
  useEffect(() => {
    slideToIndexThrottled.current = throttle(
      (index: number, event?: React.SyntheticEvent | Event) => {
        slideToIndexCore(index, event, false);
      },
      slideDuration,
      { trailing: false }
    );
  }, [slideDuration, slideToIndexCore]);

  const slideToIndex = useCallback(
    (index: number, event?: React.SyntheticEvent | Event) => {
      slideToIndexThrottled.current(index, event);
    },
    []
  );

  // For two-slide edge case
  const slideToIndexWithStyleReset = useCallback(
    (nextIndex: 
```

### Core Architecture Module: `src/components/hooks/useSwipeHandlers.ts`
```
import { useCallback, useRef } from "react";
import type { SwipeDirection, SwipeEventData } from "src/types";

interface UseSwipeHandlersConfig {
  delta?: number;
  onSwiping?: (data: SwipeEventData) => void;
  onSwiped?: (data: SwipeEventData) => void;
}

interface SwipeHandlers {
  ref: (el: HTMLElement | null) => void;
}

interface TouchSample {
  x: number;
  y: number;
  time: number;
}

const VELOCITY_WINDOW_MS = 100;

function getDirection(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? "Right" : "Left";
  }
  return dy > 0 ? "Down" : "Up";
}

function calculateVelocity(samples: TouchSample[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.time - first.time;
  if (dt === 0) return 0;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // Pixels per millisecond — matches react-swipeable's velocity scale
  return distance / dt;
}

/**
 * Custom swipe handler hook that replaces react-swipeable.
 * Fires onSwiped synchronously in the touchend handler,
 * eliminating the frame delay that causes swipe-end jank.
 */
export function useSwipeHandlers({
  delta = 0,
  onSwiping,
  onSwiped,
}: UseSwipeHandlersConfig): SwipeHandlers {
  const stateRef = useRef({
    swiping: false,
    startX: 0,
    startY: 0,
    samples: [] as TouchSample[],
  });

  const configRef = useRef({ delta, onSwiping, onSwiped });
  configRef.current = { delta, onSwiping, onSwiped };

  const handlersRef = useRef<{
    touchstart: (e: TouchEvent) => void;
    touchmove: (e: TouchEvent) => void;
    touchend: (e: TouchEvent) => void;
  } | null>(null);

  if (!handlersRef.current) {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const state = stateRef.current;
      state.startX = touch.clientX;
      state.startY = touch.clientY;
      state.swiping = false;
      state.samples = [
        { x: touch.clientX, y: touch.clientY, time: Date.now() },
      ];
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const state = stateRef.current;
      const { delta: d, onSwiping: cb } = configRef.current;

      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Track velocity samples (keep recent window only)
      const now = Date.now();
      state.samples.push({ x: touch.clientX, y: touch.clientY, time: now });
      const cutoff = now - VELOCITY_WINDOW_MS;
      while (state.samples.length > 1 && state.samples[0].time < cutoff) {
        state.samples.shift();
      }

      // Check delta threshold
      if (!state.swiping) {
        if (Math.max(absX, absY) < d) return;
        state.swiping = true;
      }

      if (cb) {
        const dir = getDirection(dx, dy);
        const velocity = calculateVelocity(state.samples);
        cb({ event: e, absX, absY, dir, velocity });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = stateRef.current;
      const { onSwiped: cb } = configRef.current;

      if (!state.swiping) return;
      state.swiping = false;

      if (cb) {
        const dx = (e.changedTouches[0]?.clientX ?? 0) - state.startX;
        const dy = (e.changedTouches[0]?.clientY ?? 0) - state.startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        const dir = getDirection(dx, dy);
        const velocity = calculateVelocity(state.samples);
        cb({ event: e, absX, absY, dir, velocity });
      }

      state.samples = [];
    };

    handlersRef.current = {
      touchstart: handleTouchStart,
      touchmove: handleTouchMove,
      touchend: handleTouchEnd,
    };
  }

  const elRef = useRef<HTMLElement | null>(null);

  const ref = useCallback((el: HTMLElement | null) => {
    const handlers = handlersRef.current!;
    // Cleanup previous element
    if (elRef.current) {
      elRef.current.removeEventListener("touchstart", handlers.touchstart);
      elRef.current.removeEventListener("touchmove", handlers.touchmove);
      elRef.current.removeEventListener("touchend", handlers.touchend);
    }
    elRef.current = el;
    if (el) {
      // Use passive: false for touchmove so preventDefault can be called if needed
      el.addEventListener("touchstart", handlers.touchstart, { passive: true });
      el.addEventListener("touchmove", handlers.touchmove, { passive: false });
      el.addEventListener("touchend", handlers.touchend, { passive: true });
    }
  }, []);

  return { ref };
}

export default useSwipeHandlers;

```

### Core Architecture Module: `src/components/hooks/useThumbnails.ts`
```
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { DEFAULT_SLIDE_DURATION } from "src/components/constants";
import debounce from "src/components/utils/debounce";
import type { GalleryItem, ThumbnailPosition } from "src/types";

interface UseThumbnailsProps {
  currentIndex: number;
  items: GalleryItem[];
  thumbnailPosition?: ThumbnailPosition;
  disableThumbnailScroll?: boolean;
  slideDuration?: number;
  isRTL?: boolean;
  useTranslate3D?: boolean;
}

interface UseThumbnailsReturn {
  thumbsTranslate: number;
  setThumbsTranslate: (value: number) => void;
  thumbsSwipedTranslate: number;
  setThumbsSwipedTranslate: (value: number) => void;
  thumbsStyle: CSSProperties;
  setThumbsStyle: (style: CSSProperties) => void;
  thumbnailsWrapperWidth: number;
  thumbnailsWrapperHeight: number;
  isSwipingThumbnail: boolean;
  setIsSwipingThumbnail: (value: boolean) => void;
  thumbnailsWrapperRef: RefObject<HTMLDivElement | null>;
  thumbnailsRef: RefObject<HTMLDivElement | null>;
  isThumbnailVertical: () => boolean;
  getThumbsTranslate: (indexDifference: number) => number;
  getThumbnailStyle: () => CSSProperties;
  getThumbnailBarHeight: (gallerySlideWrapperHeight: number) => {
    height?: number;
  };
  slideThumbnailBar: () => void;
  initResizeObserver: (element: RefObject<HTMLElement | null>) => void;
  removeResizeObserver: () => void;
  handleThumbnailSwipeEnd: () => void;
  resetSwipingThumbnail: () => void;
}

/**
 * Custom hook for managing thumbnail bar state and navigation
 */
export function useThumbnails({
  currentIndex,
  items,
  thumbnailPosition = "bottom",
  disableThumbnailScroll = false,
  slideDuration = DEFAULT_SLIDE_DURATION,
  isRTL = false,
  useTranslate3D = true,
}: UseThumbnailsProps): UseThumbnailsReturn {
  const [thumbsTranslate, setThumbsTranslate] = useState(0);
  const [thumbsSwipedTranslate, setThumbsSwipedTranslate] = useState(0);
  const [thumbsStyle, setThumbsStyle] = useState<CSSProperties>({
    transition: `all ${slideDuration}ms ease-out`,
  });
  const [thumbnailsWrapperWidth, setThumbnailsWrapperWidth] = useState(0);
  const [thumbnailsWrapperHeight, setThumbnailsWrapperHeight] = useState(0);
  const [isSwipingThumbnail, setIsSwipingThumbnail] = useState(false);

  const thumbnailsWrapperRef = useRef<HTMLDivElement | null>(null);
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const previousIndexRef = useRef(currentIndex);

  const isThumbnailVertical = useCallback(() => {
    return thumbnailPosition === "left" || thumbnailPosition === "right";
  }, [thumbnailPosition]);

  // Calculate thumbnail translation based on current index
  const getThumbsTranslate = useCallback(
    (indexDifference: number): number => {
      if (disableThumbnailScroll) return 0;

      const thumbsElement = thumbnailsRef.current;
      if (!thumbsElement) return 0;

      let hiddenScroll: number;
      const isVertical = isThumbnailVertical();

      if (isVertical) {
        if (thumbsElement.scrollHeight <= thumbnailsWrapperHeight) {
          return 0;
        }
        hiddenScroll = thumbsElement.scrollHeight - thumbnailsWrapperHeight;
      } else {
        if (
          thumbsElement.scrollWidth <= thumbnailsWrapperWidth ||
          thumbnailsWrapperWidth <= 0
        ) {
          return 0;
        }
        hiddenScroll = thumbsElement.scrollWidth - thumbnailsWrapperWidth;
      }

      const perIndexScroll = hiddenScroll / (items.length - 1);
      return indexDifference * perIndexScroll;
    },
    [
      disableThumbnailScroll,
      items.length,
      thumbnailsWrapperWidth,
      thumbnailsWrapperHeight,
      isThumbnailVertical,
    ]
  );

  // Update thumbnail position when current index changes
  const slideThumbnailBar = useCallback(() => {
    if (isSwipingThumbnail) return;

    const nextTranslate = -getThumbsTranslate(currentIndex);

    // Restore transition for smooth auto-scroll when slide changes
    setThumbsStyle({ transition: `all ${slideDuration}ms ease-out` });

    if (currentIndex === 0) {
      setThumbsTranslate(0);
      setThumbsSwipedTranslate(0);
    } else {
      setThumbsTranslate(nextTranslate);
      setThumbsSwipedTranslate(nextTranslate);
    }
  }, [currentIndex, getThumbsTranslate, isSwipingThumbnail, slideDuration]);

  // Slide thumbnail bar only when currentIndex actually changes (not on other re-renders)
  useEffect(() => {
    if (previousIndexRef.current !== currentIndex) {
      previousIndexRef.current = currentIndex;
      slideThumbnailBar();
    }
  }, [currentIndex, slideThumbnailBar]);

  // Reset transform when thumbnail position changes
  // Force re-read dimensions from DOM since orientation changed
  const previousPositionRef = useRef(thumbnailPosition);
  useEffect(() => {
    if (previousPositionRef.current !== thumbnailPosition) {
      previousPositionRef.current = thumbnailPosition;

      // Reset transforms immediately (no transition during position change)
      setThumbsStyle({ transition: "none" });
      setThumbsTranslate(0);
      setThumbsSwipedTranslate(0);

      // Use multiple rAF frames to ensure layout is complete
      const recalculatePosition = (): void => {
        if (!thumbnailsWrapperRef.current || !thumbnailsRef.current) return;

        const wrapperRect =
          thumbnailsWrapperRef.current.getBoundingClientRect();
        const newWrapperWidth = wrapperRect.width;
        const newWrapperHeight = wrapperRect.height;

        setThumbnailsWrapperWidth(newWrapperWidth);
        setThumbnailsWrapperHeight(newWrapperHeight);

        // Calculate new translate for current index using fresh dimensions
        const isVertical =
          thumbnailPosition === "left" || thumbnailPosition === "right";
        const thumbsElement = thumbnailsRef.current;

        let hiddenScroll: number;
        if (isVertical) {
          if (thumbsElement.scrollHeight <= newWrapperHeight) {
            setThumbsStyle({ transition: `all ${slideDuration}ms ease-out` });
            return;
          }
          hiddenScroll = thumbsElement.scrollHeight - newWrapperHeight;
        } else {
          if (thumbsElement.scrollWidth <= newWrapperWidth) {
            setThumbsStyle({ transition: `all ${slideDuration}ms ease-out` });
            return;
          }
          hiddenScroll = thumbsElement.scrollWidth - newWrapperWidth;
        }

        const perIndexScroll = hiddenScroll / (items.length - 1);
        const newTranslate = -(currentIndex * perIndexScroll);

        setThumbsTranslate(newTranslate);
        setThumbsSwipedTranslate(newTranslate);

        // Restore smooth transition for future movements
        requestAnimationFrame(() => {
          setThumbsStyle({ transition: `all ${slideDuration}ms ease-out` });
        });
      };

      // Wait for layout to settle with multiple frames
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(recalculatePosition, 100);
        });
      });
    }
  }, [thumbnailPosition, currentIndex, items.length, slideDuration]);

  // Get thumbnail container style
  const getThumbnailStyle = useCallback((): CSSProperties => {
    const verticalTranslateValue = isRTL
      ? thumbsTranslate * -1
      : thumbsTranslate;
    let translate: string;

    if (isThumbnailVertical()) {
      translate = useTranslate3D
        ? `translate3d(0, ${thumbsTranslate}px, 0)`
        : `translate(0, ${thumbsTranslate}px)`;
    } else {
      translate = useTranslate3D
        ? `translate3d(${verticalTranslateValue}px, 0, 0)`
        : `translate(${verticalTranslateValue}px, 0)`;
    }

    return {
      WebkitTransform: translate,
      MozTransform: translate,
      msTransform: translate,
      OTransform: translate,
      transform: translate,
      ...thumbsStyle,
    } as CSSProperties;
  }, [
    thumbsTranslate,
    thumbsStyle,
    isRTL,
    useTranslate3D,
    isThumbnailVertical,
  ]);

  // Get thumbnail bar height for vertical layouts
  const getThumbnailBarHeight = useCallback(
    (gallerySlideWrapperHeight: number): { height?: number } => {
      if (isThumbnailVertical()) {
        return { height: gallerySlideWrapperHeight };
      }
      return {};
    },
    [isThumbnailVertical]
  );

  // Initialize resize observer for thumbnail wrapper
  const initResizeObserver = useCallback(
    (element: RefObject<HTMLElement | null>) => {
      if (!element?.current) return;

      resizeObserverRef.current = new ResizeObserver(
        debounce((entries: ResizeObserverEntry[]) => {
          if (!entries) return;
          entries.forEach((entry) => {
            setThumbnailsWrapperWidth(entry.contentRect.width);
            setThumbnailsWrapperHeight(entry.contentRect.height);
          });
        }, 50)
      );

      resizeObserverRef.current.observe(element.current);
    },
    []
  );

  // Clean up resize observer
  const removeResizeObserver = useCallback(() => {
    if (resizeObserverRef.current && thumbnailsWrapperRef.current) {
      resizeObserverRef.current.unobserve(thumbnailsWrapperRef.current);
      resizeObserverRef.current = null;
    }
  }, []);

  // Recalculate thumbnail position when wrapper dimensions change (window resize)
  // Use a ref to track the previous dimensions to only react to actual size changes
  const prevDimensionsRef = useRef({ width: 0, height: 0 });
  useEffect(() => {
    // Skip if dimensions are 0 (not yet measured)
    if (thumbnailsWrapperWidth === 0 && thumbnailsWrapperHeight === 0) return;

    // Only recalculate if dimensions actually changed (not just on isSwipingThumbnail change)
    const dimensionsChanged =
      prevDimensionsRef.current.width !== thumbnailsWrapperWidth ||
      prevDimensionsRef.current.height !== thumbnailsWrapperHeight;

    if (!dimensionsChanged) return;

    prevDimensionsRef.cur
```

### Core Architecture Module: `src/components/utils/debounce.ts`
```
/**
 * Debounce function - delays function execution until after wait time
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(this: unknown, ...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

```

### Core Architecture Module: `src/components/utils/swipe.ts`
```
import type { SwipeDirection } from "src/types";

/**
 * Pure utility functions for swipe gesture logic.
 *
 * These are extracted from the ImageGallery component so they can be
 * unit-tested without DOM dependencies, jsdom limitations, or React rendering.
 */

/**
 * Determines whether the accumulated swipe offset exceeds the threshold
 * required to advance to the next/previous slide.
 */
export function isSufficientSwipe(offset: number, threshold: number): boolean {
  return Math.abs(offset) > threshold;
}

/**
 * Calculates the swipe offset as a percentage of the gallery dimension.
 * Clamps the result to [-100, 100].
 */
export function calculateSwipeOffset(
  absX: number,
  absY: number,
  galleryWidth: number,
  galleryHeight: number,
  direction: SwipeDirection,
  slideVertically: boolean
): number {
  const sides: Record<SwipeDirection, number> = {
    Left: -1,
    Right: 1,
    Up: -1,
    Down: 1,
  };

  const side = sides[direction];
  let offset = slideVertically
    ? (absY / galleryHeight) * 100
    : (absX / galleryWidth) * 100;

  if (Math.abs(offset) >= 100) {
    offset = 100;
  }

  return side * offset;
}

/**
 * Determines the swipe direction multiplier from the swipe direction string.
 * Returns +1 (next slide) or -1 (previous slide).
 */
export function getSwipeDirection(
  direction: SwipeDirection,
  isRTL: boolean,
  slideVertically: boolean
): number {
  if (slideVertically) {
    return direction === "Up" ? 1 : -1;
  }
  return (direction === "Left" ? 1 : -1) * (isRTL ? -1 : 1);
}

/**
 * Determines whether a swipe gesture qualifies as a "flick" (fast swipe).
 */
export function isFlickSwipe(
  velocity: number,
  flickThreshold: number,
  direction: SwipeDirection,
  slideVertically: boolean
): boolean {
  const isSwipeUpOrDown = direction === "Up" || direction === "Down";
  const isSwipeLeftOrRight = direction === "Left" || direction === "Right";
  const isLeftRightFlick = velocity > flickThreshold && !isSwipeUpOrDown;
  const isTopDownFlick = velocity > flickThreshold && !isSwipeLeftOrRight;
  return slideVertically ? isTopDownFlick : isLeftRightFlick;
}

/**
 * Computes the target slide index after a swipe ends.
 */
export function computeSlideTarget(
  currentIndex: number,
  swipeDirection: number,
  isSufficient: boolean,
  isFlick: boolean,
  isTransitioning: boolean,
  canSlideLeft: boolean,
  canSlideRight: boolean
): number {
  let slideTo = currentIndex;

  if ((isSufficient || isFlick) && !isTransitioning) {
    slideTo += swipeDirection;
  }

  // Clamp: if we can't slide in the requested direction, stay put
  if (swipeDirection === -1 && !canSlideLeft) {
    slideTo = currentIndex;
  }
  if (swipeDirection === 1 && !canSlideRight) {
    slideTo = currentIndex;
  }

  return slideTo;
}

/**
 * Computes the target displayIndex for the CSS transform.
 * Mirrors the logic in slideToIndexCore from useGalleryNavigation.
 */
export function computeTargetDisplayIndex(
  slideTo: number,
  totalSlides: number,
  totalDisplaySlides: number,
  infinite: boolean
): number {
  const slideCount = totalSlides - 1;

  if (slideTo < 0) {
    // Wrapping start (going past first slide)
    return 0;
  }
  if (slideTo > slideCount) {
    // Wrapping end (going past last slide)
    return infinite && totalSlides > 1 ? totalDisplaySlides - 1 : slideCount;
  }
  // Normal navigation
  return infinite && totalSlides > 1 ? slideTo + 1 : slideTo;
}

/**
 * Computes the CSS transition duration based on the swipe velocity,
 * remaining distance, and gallery dimension. Produces a natural
 * continuation of the user's finger speed.
 *
 * Returns a duration in milliseconds, clamped between 80ms and slideDuration.
 */
export function computeVelocityDuration(
  finalOffset: number,
  slideTo: number,
  currentIndex: number,
  velocity: number,
  slideDuration: number,
  galleryDimension: number
): number {
  const swipedPercent = Math.abs(finalOffset);
  const remainingPercent =
    slideTo !== currentIndex
      ? 100 - swipedPercent // traveling to next/prev slide
      : swipedPercent; // snapping back to current slide
  const remainingPx = (remainingPercent / 100) * galleryDimension;

  if (velocity > 0) {
    return Math.min(
      slideDuration,
      Math.max(80, Math.round(remainingPx / velocity))
    );
  }
  return slideDuration;
}

/**
 * Checks whether the swipe direction is valid for the current mode.
 * Returns true if the swipe should be ignored.
 */
export function shouldIgnoreSwipeDirection(
  direction: SwipeDirection,
  slideVertically: boolean
): boolean {
  const isSwipeLeftOrRight = direction === "Left" || direction === "Right";
  const isSwipeTopOrDown = direction === "Up" || direction === "Down";

  if (isSwipeLeftOrRight && slideVertically) return true;
  if (isSwipeTopOrDown && !slideVertically) return true;
  return false;
}

```

### Core Architecture Module: `src/components/utils/throttle.ts`
```
interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Throttle function - limits how often a function can be called
 * Compatible with lodash throttle options
 *
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @param options - Options object
 * @returns Throttled function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number,
  options: ThrottleOptions = {}
): (...args: Parameters<T>) => void {
  const { leading = true, trailing = true } = options;

  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  function invokeFunc(): void {
    if (lastArgs !== null) {
      func.apply(lastThis, lastArgs);
      lastCallTime = Date.now();
      lastArgs = null;
      lastThis = null;
    }
  }

  return function throttled(this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;

    // First call or enough time has passed
    if (timeSinceLastCall >= limit) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (leading) {
        invokeFunc();
      } else {
        lastCallTime = now;
      }
    } else if (trailing && !timeoutId) {
      // Schedule trailing call
      const remaining = limit - timeSinceLastCall;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (lastArgs) {
          invokeFunc();
        }
      }, remaining);
    }
  };
}

```

### Core Architecture Module: `src/components/utils/thumbnailMomentum.ts`
```
/**
 * Utility functions for thumbnail momentum scrolling calculations
 */

import {
  DEFAULT_MAX_TRANSITION_DURATION,
  DEFAULT_MOMENTUM_MULTIPLIER,
  DEFAULT_SLIDE_DURATION,
  MOMENTUM_EASING,
} from "src/components/constants";

export interface MomentumConfig {
  velocity: number;
  direction: string;
  isVertical: boolean;
  currentTranslate: number;
  scrollSize: number;
  wrapperSize: number;
  slideDuration: number;
  emptySpaceMargin?: number;
  momentumMultiplier?: number;
}

export interface MomentumResult {
  targetTranslate: number;
  transitionDuration: number;
  transitionStyle: string;
}

/**
 * Calculate momentum distance based on velocity
 * @param velocity - The swipe velocity (typically 0-2+)
 * @param multiplier - Pixels per velocity unit
 */
export function calculateMomentumDistance(
  velocity: number,
  multiplier: number = DEFAULT_MOMENTUM_MULTIPLIER
): number {
  return velocity * multiplier;
}

/**
 * Determine the direction sign for momentum based on swipe direction
 * @param direction - The swipe direction ("Left", "Right", "Up", "Down")
 * @param isVertical - Whether the thumbnail bar is vertical
 */
export function getMomentumDirection(
  direction: string,
  isVertical: boolean
): number {
  if (isVertical) {
    return direction === "Down" ? 1 : -1;
  }
  return direction === "Right" ? 1 : -1;
}

/**
 * Clamp a translate value to valid bounds
 * @param translate - The proposed translate value
 * @param maxScroll - Maximum scroll distance (positive value)
 * @param emptySpaceMargin - Allowed margin at boundaries (default 0 for strict bounds)
 */
export function clampTranslate(
  translate: number,
  maxScroll: number,
  emptySpaceMargin: number = 0
): number {
  // Can't go past start (positive beyond margin)
  let clamped = Math.min(emptySpaceMargin, translate);
  // Can't go past end (negative beyond maxScroll)
  clamped = Math.max(-maxScroll, clamped);
  return clamped;
}

/**
 * Calculate transition duration based on velocity
 * Higher velocity = slightly longer duration for smoother deceleration
 * @param velocity - The swipe velocity
 * @param baseDuration - Base slide duration in ms
 * @param maxDuration - Maximum duration cap in ms
 */
export function calculateTransitionDuration(
  velocity: number,
  baseDuration: number = DEFAULT_SLIDE_DURATION,
  maxDuration: number = DEFAULT_MAX_TRANSITION_DURATION
): number {
  return Math.min(maxDuration, baseDuration + velocity * 100);
}

/**
 * Calculate the full momentum result for a thumbnail swipe
 */
export function calculateMomentum(config: MomentumConfig): MomentumResult {
  const {
    velocity,
    direction,
    isVertical,
    currentTranslate,
    scrollSize,
    wrapperSize,
    slideDuration,
    emptySpaceMargin = 0,
    momentumMultiplier = 150,
  } = config;

  // Calculate momentum distance and direction
  const momentumDistance = calculateMomentumDistance(
    velocity,
    momentumMultiplier
  );
  const directionSign = getMomentumDirection(direction, isVertical);
  const momentum = momentumDistance * directionSign;

  // Calculate target translate with momentum
  let targetTranslate = currentTranslate + momentum;

  // Calculate max scroll and clamp
  const maxScroll = scrollSize - wrapperSize + emptySpaceMargin;
  if (maxScroll > 0) {
    targetTranslate = clampTranslate(
      targetTranslate,
      maxScroll,
      emptySpaceMargin
    );
  }

  // Calculate transition
  const transitionDuration = calculateTransitionDuration(
    velocity,
    slideDuration
  );
  const transitionStyle = `all ${transitionDuration}ms ${MOMENTUM_EASING}`;

  return {
    targetTranslate,
    transitionDuration,
    transitionStyle,
  };
}

```

### Core Architecture Module: `eslint.config.mjs`
```
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import react from "eslint-plugin-react";
import jest from "eslint-plugin-jest";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// Shared rules for both JS and TS files
const sharedRules = {
  "react/display-name": "off",
  "sort-imports": [
    "error",
    {
      ignoreCase: true,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
    },
  ],
  "import/order": [
    "error",
    {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      pathGroups: [
        {
          pattern: "react",
          group: "external",
          position: "before",
        },
        {
          pattern: "src/**",
          group: "internal",
        },
      ],
      pathGroupsExcludedImportTypes: ["react"],
      "newlines-between": "never",
      alphabetize: {
        order: "asc",
        caseInsensitive: true,
      },
    },
  ],
  "react/jsx-sort-props": [
    "error",
    {
      callbacksLast: true,
      shorthandFirst: true,
      ignoreCase: true,
      reservedFirst: true,
    },
  ],
  "react/sort-prop-types": [
    "error",
    {
      callbacksLast: true,
      ignoreCase: true,
      sortShapeProp: true,
    },
  ],
  "prettier/prettier": [
    "error",
    {
      trailingComma: "es5",
    },
  ],
};

export default [
  {
    ignores: ["**/*.cjs"],
  },
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "plugin:react/recommended",
      "plugin:prettier/recommended",
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:jsx-a11y/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jest/recommended"
    )
  ),
  // JavaScript/JSX configuration
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      react: fixupPluginRules(react),
      jest: fixupPluginRules(jest),
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parser: babelParser,
      ecmaVersion: 12,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
        alias: {
          map: [["src", "./src"]],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
    },
    rules: sharedRules,
  },
  // TypeScript/TSX configuration
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: fixupPluginRules(react),
      jest: fixupPluginRules(jest),
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
        alias: {
          map: [["src", "./src"]],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
    },
    rules: {
      ...sharedRules,
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Disable base rules that are handled by TypeScript
      "no-unused-vars": "off",
      "no-undef": "off",
      // Disable prop-types for TypeScript (TS handles this)
      "react/prop-types": "off",
    },
  },
];

```

### Core Architecture Module: `example/App.jsx`
```
import React from "react";
import { createRoot } from "react-dom/client";
import ImageGallery from "src/components/ImageGallery";
import "../styles/image-gallery.css";

const PREFIX_URL =
  "https://raw.githubusercontent.com/xiaolin/react-image-gallery/master/static/";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      showIndex: false,
      showBullets: true,
      infinite: true,
      showThumbnails: true,
      showFullscreenButton: true,
      showGalleryFullscreenButton: true,
      showPlayButton: true,
      showGalleryPlayButton: true,
      showNav: true,
      slideVertically: false,
      isRTL: false,
      slideDuration: 550,
      slideInterval: 2000,
      slideOnThumbnailOver: false,
      thumbnailPosition: "bottom",
      showVideo: false,
      useWindowKeyDown: true,
      lazyLoad: false,
      maxBullets: 0,
      darkMode: false,
    };
    this._toggleShowVideo = this._toggleShowVideo.bind(this);

    this.images = [
      {
        thumbnail: `${PREFIX_URL}4v.jpg`,
        original: `${PREFIX_URL}4v.jpg`,
        embedUrl:
          "https://www.youtube.com/embed/4pSzhZ76GdM?autoplay=1&showinfo=0",
        description: "Render custom slides (such as videos)",
        renderItem: this._renderVideo.bind(this),
      },
      {
        original: `${PREFIX_URL}1.jpg`,
        thumbnail: `${PREFIX_URL}1t.jpg`,
        originalClass: "featured-slide",
        thumbnailClass: "featured-thumb",
        description: "Custom class for slides & thumbnails",
      },
    ].concat(this._getStaticImages());
  }

  _onImageClick(event) {
    console.debug(
      "clicked on image",
      event.target,
      "at index",
      this._imageGallery.getCurrentIndex()
    );
  }

  _onImageLoad(event) {
    console.debug("loaded image", event.target.src);
  }

  _onSlide(index) {
    this._resetVideo();
    console.debug("slid to index", index);
  }

  _onPause(index) {
    console.debug("paused on index", index);
  }

  _onScreenChange(fullScreenElement) {
    console.debug("isFullScreen?", !!fullScreenElement);
  }

  _onPlay(index) {
    console.debug("playing from index", index);
  }

  _handleInputChange(state, event) {
    if (event.target.value > 0) {
      this.setState({ [state]: event.target.value });
    }
  }

  _handleCheckboxChange(state, event) {
    this.setState({ [state]: event.target.checked });
  }

  _handleThumbnailPositionChange(event) {
    this.setState({ thumbnailPosition: event.target.value });
  }

  _getStaticImages() {
    let images = [];
    for (let i = 2; i < 12; i++) {
      images.push({
        original: `${PREFIX_URL}${i}.jpg`,
        thumbnail: `${PREFIX_URL}${i}t.jpg`,
      });
    }

    return images;
  }

  _resetVideo() {
    this.setState({ showVideo: false });

    if (this.state.showPlayButton) {
      this.setState({ showGalleryPlayButton: true });
    }

    if (this.state.showFullscreenButton) {
      this.setState({ showGalleryFullscreenButton: true });
    }
  }

  _toggleShowVideo() {
    const { showVideo } = this.state;
    this.setState({
      showVideo: !showVideo,
    });

    if (!showVideo) {
      if (this.state.showPlayButton) {
        this.setState({ showGalleryPlayButton: false });
      }

      if (this.state.showFullscreenButton) {
        this.setState({ showGalleryFullscreenButton: false });
      }
    }
  }

  _renderVideo(item) {
    return (
      <div>
        {this.state.showVideo ? (
          <div className="video-wrapper">
            <button className="close-video" onClick={this._toggleShowVideo} />
            <iframe
              allowFullScreen
              height="315"
              src={item.embedUrl}
              style={{ border: "none" }}
              title="sample video"
              width="560"
            />
          </div>
        ) : (
          <>
            <button className="play-button" onClick={this._toggleShowVideo} />
            <img
              alt="sample video cover"
              className="image-gallery-image"
              src={item.original}
            />
            {item.description && (
              <span
                className="image-gallery-description"
                style={{ right: "0", left: "initial" }}
              >
                {item.description}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  render() {
    return (
      <section className={`app${this.state.darkMode ? " dark-mode" : ""}`}>
        <div className="dark-mode-toggle">
          <input
            checked={this.state.darkMode}
            id="dark_mode"
            type="checkbox"
            onChange={this._handleCheckboxChange.bind(this, "darkMode")}
          />
          <label htmlFor="dark_mode">
            {this.state.darkMode ? "☀️ Light" : "🌙 Dark"}
          </label>
        </div>

        <section className="gallery-demo">
          <h1 className="gallery-demo-header">React Image Gallery</h1>
          <h3 className="gallery-demo-header-3">
            A beautiful, responsive, and customizable image gallery component
            for React applications
          </h3>
          <div className="gallery-demo-subheader">
            <a
              aria-label="Star xiaolin/react-image-gallery on GitHub"
              className="github-button"
              data-icon="octicon-star"
              data-show-count="true"
              data-size="large"
              href="https://github.com/xiaolin/react-image-gallery"
            >
              Star
            </a>
            <a
              aria-label="Fork xiaolin/react-image-gallery on GitHub"
              className="github-button"
              data-icon="octicon-repo-forked"
              data-show-count="true"
              data-size="large"
              href="https://github.com/xiaolin/react-image-gallery/fork"
            >
              Fork
            </a>
          </div>
          <div className="feature-badges">
            <span className="feature-badge">📱 Mobile Friendly</span>
            <span className="feature-badge">⌨️ Keyboard Navigation</span>
            <span className="feature-badge">🎨 Fully Customizable</span>
            <span className="feature-badge">🖼️ Thumbnail Support</span>
            <span className="feature-badge">📺 Fullscreen Mode</span>
          </div>
        </section>

        <ImageGallery
          ref={(i) => (this._imageGallery = i)}
          additionalClass="app-image-gallery"
          infinite={this.state.infinite}
          isRTL={this.state.isRTL}
          items={this.images}
          lazyLoad={this.state.lazyLoad}
          maxBullets={
            this.state.maxBullets > 0 ? this.state.maxBullets : undefined
          }
          showBullets={this.state.showBullets}
          showFullscreenButton={
            this.state.showFullscreenButton &&
            this.state.showGalleryFullscreenButton
          }
          showIndex={this.state.showIndex}
          showNav={this.state.showNav}
          showPlayButton={
            this.state.showPlayButton && this.state.showGalleryPlayButton
          }
          showThumbnails={this.state.showThumbnails}
          slideDuration={parseInt(this.state.slideDuration)}
          slideInterval={parseInt(this.state.slideInterval)}
          slideOnThumbnailOver={this.state.slideOnThumbnailOver}
          slideVertically={this.state.slideVertically}
          thumbnailPosition={this.state.thumbnailPosition}
          useWindowKeyDown={this.state.useWindowKeyDown}
          onClick={this._onImageClick.bind(this)}
          onImageLoad={this._onImageLoad}
          onPause={this._onPause.bind(this)}
          onPlay={this._onPlay.bind(this)}
          onScreenChange={this._onScreenChange.bind(this)}
          onSlide={this._onSlide.bind(this)}
        />

        <div className="app-sandbox">
          <div className="app-sandbox-content">
            <h2 className="app-header">Settings</h2>

            <ul className="app-buttons">
              <li>
                <div className="app-interval-input-group">
                  <span className="app-interval-label">Play Interval</span>
                  <input
                    className="app-interval-input"
                    type="text"
                    value={this.state.slideInterval}
                    onChange={this._handleInputChange.bind(
                      this,
                      "slideInterval"
                    )}
                  />
                </div>
              </li>

              <li>
                <div className="app-interval-input-group">
                  <span className="app-interval-label">Slide Duration</span>
                  <input
                    className="app-interval-input"
                    type="text"
                    value={this.state.slideDuration}
                    onChange={this._handleInputChange.bind(
                      this,
                      "slideDuration"
                    )}
                  />
                </div>
              </li>

              <li>
                <div className="app-interval-input-group">
                  <span className="app-interval-label">Max Bullets</span>
                  <input
                    className="app-interval-input"
                    min="3"
                    type="number"
                    value={this.state.maxBullets}
                    onChange={this._handleInputChange.bind(this, "maxBullets")}
                  />
                </div>
              </li>

              <li>
                <div className="app-interval-input-group">
                  <span className="app-interval-label">
                    Thumbnail Bar Position
                  </span>
                  <select
                    className="app-interval-input"
                    value={this.state.thumbnailPosition}
                    onChange={this._handleThumbnailPositionChange.bind(this)}
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #838** (2026-03-05): **slideToIndex does not work anymore**
  *Symptoms*: ### Before submitting  - [x] I searched existing issues to avoid duplicates  ### Bug description  <!-- What happened? What did you expect instead? --> After updating to 2.x.x the following setup does not work anymore:  ```ts const Gallery = ({   gallery,   customSettings = {},   refInitialized, }: Props): React.JSX.Element => {   const galleryRef = React.useRef<     ImageGalleryRef    >(null);    React.useEffect(() => {     if (customSettings.autoPlay) {       galleryRef.current?.play();     }   }, [customSettings]);      setGalleryItems(tmp as any);   }, [gallery]);    React.useEffect(() => {     if (refInitialized && galleryRef.current) {       refInitialized(galleryRef.current);     }   }, []);    return (     <ImageGallery       ref={galleryRef}       items={galleryItems}       lazyLoad       {...customSettings}     />   ); };  export default Gallery; ```  and the consuming component: ```ts export default function ExampleComponent() {   const [galleryImages, setGalleryImages] = useState<GalleryItem[]>([]);   const [galleryRef, setGalleryRef] = useState<ImageGalleryRef>();    const openGallery = (idx: number, slide: number) => {     const items = mapImagesToGalleryImages(idx);     setGalleryImages(items);      setTimeout(() => {       galleryRef?.slideToIndex(slide);       galleryRef?.fullScreen();     }, 25);   };    return (     <>       <button       type="button"       onClick={() => openGallery(2)} // example     >     </button>       <div className="w-0 overflow-hidd
  **Post-Mortem & Fix Analysis**:
  > v2.1.2 should fix this.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.2

- **Issue #837** (2026-02-19): **Mouse scroll function disabled**
  *Symptoms*: The mouse wheel scroll is disabled when the mouse pointer is over the main image.
  **Post-Mortem & Fix Analysis**:
  > I found a temporary soluation, may break some other features:  `.image-gallery, .image-gallery-content, .image-gallery-swipe, .image-gallery-slides {   overscroll-behavior: auto !important;   touch-action: pan-y !important; } `
  > this version should fix the issue.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.1
  > Confirm it is fixed, Thanks!

- **Issue #836** (2026-02-16): **CSS auto-injection is broken (by design) for SSR**
  *Symptoms*: ### Before submitting  - [x] I searched existing issues to avoid duplicates  ### Bug description  v2.0.0 introduced auto CSS injection via js bundles. When used in a project that does SSR, the styles don't load until the client js bundle loads. This is expected, given the approach, but very much not ideal.  I can still: ```js import "react-image-gallery/styles/image-gallery.css"; ```  But this causes duplicate styles to load (both the CSS file and the injected styles from the js bundle).  ### Version  `react-image-gallery` version: 2.0.8  ### Reproduction  Use in any react-router (as framework) project... or a Next.js one...  Or any other form of a project that uses React with SSR.  ### Environment  - Browser: Irrelevant - OS: Irrelevant  ### Possible solutions - Provide additional bundles without the injection of styles  OR - Revert back to the more agnostic 1.x approach (user is the one importing the css).
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, reverted back to 1.x approach with explicit import of css.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.0
  > Probably the better solution. Much appreciated. 🙏 

- **Issue #687** (2022-07-30): **flickering issue when colour swatch is changed**
  *Symptoms*: **Describe the bug** when changing image with item image is flickering in mobile  **Image Gallery Version** What version of `react-image-gallery` are you using? 1.2.7  **To Reproduce** Steps to reproduce the behavior: open this in mobile and try to change image by carousel and then change item colour by swatch .  **Expected behavior** 0th index image should load with out flickering.  **Screenshots** If applicable, add screenshots to help explain your problem.   **Smartphone (please complete the following information):**  - Device: [ iPhoneXR]  - Browser [ safari]  **Additional context** <ImageGallery           ref={elementRef}           items={items}           infinite           showThumbnails={false}           showNav={false}           showFullscreenButton={false}           showPlayButton={false}           showBullets={true}           swipeThreshold="10"           onSlide={handleOnSlide}         /> 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, this looks like an issue with transition when rendering a new array of items that needs to start at index 0.
  > Hi @xiaolin yes it need to start from start at index 0 and it does like that but smoothness is not there in transition flickering of last set of image is happening.
  > This should be fixed in v1.2.9 https://github.com/xiaolin/react-image-gallery/releases/tag/v1.2.9

- **Issue #674** (2022-10-01): **Vertical thumbnail scrolling broken with react 18 rendering**
  *Symptoms*: The thumbnail scrolling does not get the proper translate when rendering with react 18.  Using the latest image gallery version (1.2.8) and react (18.1.0).  My guess is that the thumbnailsWrapperHeight is registering as 0 at the start (the translation seems to match that) maybe because of how batch updates or rendering has changed in react 18.  After manually resizing the window and thus resizing react-image-gallery, the resize observers fire and the issue improves. However the calculation is still wrong and it is slightly offset from where the scroll should be.  To reproduce, use the latest react and the new way to start the rendering (createRoot() and root.render() instead of ReactDOM.render()), and set thumbnail position to "left" or "right". Then just change slides around and the issue can be seen.  Changing the render back to ReactDOM.render() (which reverts rendering the same way as React 17) fixes the issue.  A picture attached demonstrates the thumbnail scroll being in the wrong position (and out of bounds)  ![react-image-gallery-bug](https://user-images.githubusercontent.com/35713583/172502068-e1ac15d6-61ac-4632-9a4a-c417f9d37b73.JPG)  
  **Post-Mortem & Fix Analysis**:
  > Is there anything I can add to help get this looked at? Thanks for the updates!
  > Thanks for reporting, I've not had a chance to test react18's new render. Will look into it when I get a chance.  Fastest way is to open a PR if anyone is down to tackle this issue.
  > Anyone found a fix for this? Can't figure it out.

- **Issue #655** (2023-07-30): **images slide above each other**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **Image Gallery Version** What version of `react-image-gallery` are you using? 1.2.7   if you have only two or three images.. try to navigate between them by nav buttons . then navigate using thumbnail .. click twowice on the same thumbnail .. you will show a strange behavior   **To Reproduce** Steps to reproduce the behavior: 1.make sure you have only two images. 2.try to navigate between them by nav buttons. 3. then navigate using thumbnail. 4. click twice on the same thumbnail. 5. you will see unexpected behavior.  **Expected behavior** A clear and concise description of what you expected to happen. images not slide above each other.  **Desktop (please complete the following information):**  - OS: [10.15.7 iOS]   - Browser [chrome, safari]  
  **Post-Mortem & Fix Analysis**:
  > Yes. It is happening. Strange, it is reported recently after previous release. 
  > It is happening for the case of 2 images. 👍 Strangely, nobody has reported since ages. lol  I will try to fix it and generate a pull request.
  > The issue persists at least 2 years. lol 

- **Issue #615** (2024-08-22): **useWindowKeyDown={false} doesn't work correctly on Chrome**
  *Symptoms*: **Summary** After navigating through 2 images, arrow keys stop working and you need to "refocus" the gallery by clicking on the image to be able to use them again.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://www.linxtion.com/demo/react-image-gallery/ 2. Uncheck "use window keydown"  3. Click in the middle of an image 4. Use arrows to navigate through the gallery  **Expected behavior** Should be able to navigate through the entire gallery with arrow keys without the need to click on it every 2 images.  **Desktop:**  - MacBook Pro (15-inch, 2018)  - Chrome Version 91.0.4472.164 (Official Build) (x86_64)  **Additional context** Bug occurs only when clicking on the image, clicking on the navigation icons and using arrow keys works fine.  Works correctly  Firefox and Safari. 
  **Post-Mortem & Fix Analysis**:
  > Looks like this may be a little tough since different browsers handles it differently. Chrome loses focus and `document.activeElement` becomes `body` after two keydowns.  If there is no clean fix, may get rid of `useWindowKeyDown={false}` and let the user handle that case (as its a custom keydown event)  **Solution 1**: Find a fix for all browser **Solution 2**: `useWindowKeyDown={false}` acts as the current `disableKeyDown` and removes window keydown event handlers

- **Issue #499** (2021-05-28): **prop `items[0].original` is marked as required warning**
  *Symptoms*: this happen after I update the dependency from 0.9.1 to 1.0.7  ![1](https://user-images.githubusercontent.com/5227509/78500302-2f3ce900-7788-11ea-83e3-4a69d85ec92d.png) 
  **Post-Mortem & Fix Analysis**:
  > `objects` in `items` array should have a `original` value. How are you using the library without `items[x].original` ?
  > I use `renderItem `and `renderThumbInner`
  > Ah, `original` is also used as a unique key for each slide.  Will mark this as an issue and look into it. For now If you like to get rid of the error, you can probably add an index key. [{original: 0}, {original: 1}]

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

### Incident Patch 1: `8683e932` (2026-02-26)
**Commit Message**: fix lint

**File**: `src/components/ImageGallery.test.tsx` (modified, +5/-7)
```diff
@@ -2481,14 +2481,14 @@ describe("<ImageGallery />", () => {
       // after items have been populated.
       const ref = React.createRef<ImageGalleryRef>();
       const { rerender } = render(
-        <ImageGallery items={singleItem} ref={ref} />
+        <ImageGallery ref={ref} items={singleItem} />
       );
 
       // Cache the handle object (simulates storing ref.current in state)
       const cachedHandle = ref.current!;
 
       // Update items to a larger set
-      rerender(<ImageGallery items={defaultItems} ref={ref} />);
+      rerender(<ImageGallery ref={ref} items={defaultItems} />);
 
       // Use the CACHED handle to slide — this previously broke because
       // slideToIndexCore closed over totalSlides=1 from the first render.
@@ -2503,9 +2503,7 @@ describe("<ImageGallery />", () => {
 
     it("getCurrentIndex returns latest index from a cached handle", () => {
       const ref = React.createRef<ImageGalleryRef>();
-      const { rerender } = render(
-        <ImageGallery items={defaultItems} ref={ref} />
-      );
+      render(<ImageGallery ref={ref} items={defaultItems} />);
 
       const cachedHandle = ref.current!;
       expect(cachedHandle.getCurrentIndex()).toBe(0);
@@ -2527,8 +2525,8 @@ describe("<ImageGallery />", () => {
       const emptyItems: GalleryItem[] = [];
       const { rerender } = render(
         <ImageGallery
-          items={emptyItems}
           ref={ref}
+          items={emptyItems}
           useBrowserFullscreen={false}
         />
       );
@@ -2538,8 +2536,8 @@ describe("<ImageGallery />", () => {
       // Populate items
       rerender(
         <ImageGallery
-          items={defaultItems}
           ref={ref}
+          items={defaultItems}
           useBrowserFullscreen={false}
         />
       );
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -20,5 +20,5 @@
     "types": ["jest", "node", "@testing-library/jest-dom"]
   },
   "include": ["src/**/*"],
-  "exclude": ["node_modules", "build", "**/*.test.ts", "**/*.test.tsx"]
+  "exclude": ["node_modules", "build"]
 }
```

---

### Incident Patch 2: `192f7ccb` (2026-02-19)
**Commit Message**: [#837] Fix mous scroll and mobile swipe

**File**: `src/components/ImageGallery.tsx` (modified, +10/-0)
```diff
@@ -310,6 +310,16 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
 
         if (disableSwipe) return;
 
+        // Once the swipe direction is locked to the gallery's slide axis,
+        // prevent the browser from scrolling the page during the gesture.
+        // Only affects touch devices (useSwipeHandlers listens to touch only).
+        if (
+          (!slideVertically && swipingLeftRightRef.current) ||
+          (slideVertically && swipingUpDownRef.current)
+        ) {
+          event.preventDefault();
+        }
+
         if (stopPropagation) {
           event.preventDefault();
         }
```

**File**: `styles/image-gallery.css` (modified, +4/-4)
```diff
@@ -291,8 +291,6 @@
   backface-visibility: hidden;
   -webkit-transform: translateZ(0);
   transform: translateZ(0);
-  /* Prevent overscroll during swipe */
-  overscroll-behavior: contain;
   touch-action: pan-y pinch-zoom;
 }
 
@@ -303,13 +301,15 @@
 .image-gallery-slides {
   overflow: hidden;
   position: relative;
-  touch-action: none;
+  /* Allow vertical scroll and pinch-zoom; block horizontal pan so JS handles swipe.
+     The browser's built-in direction detection prevents vertical scroll during
+     horizontal swipes. On desktop, wheel/trackpad scroll passes through normally. */
+  touch-action: pan-y pinch-zoom;
   /* GPU acceleration for smooth swiping */
   -webkit-backface-visibility: hidden;
   backface-visibility: hidden;
   contain: layout style paint;
   isolation: isolate;
-  overscroll-behavior: none;
 }
 
 /* Flex container that holds all slides and gets transformed */
```

---

### Incident Patch 3: `faa5081e` (2026-02-16)
**Commit Message**: [#836] Removes CSS-auto-injection

**File**: `README.md` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ npm install react-image-gallery
 ```tsx
 import { useRef } from "react";
 import ImageGallery from "react-image-gallery";
+import "react-image-gallery/styles/image-gallery.css";
 import type { GalleryItem, ImageGalleryRef } from "react-image-gallery";
 
 const images: GalleryItem[] = [
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -121,4 +121,4 @@
   "peerDependencies": {
     "react": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
   }
-}
+}
\ No newline at end of file
```

**File**: `scripts/test-package.sh` (modified, +79/-1)
```diff
@@ -95,7 +95,7 @@ node test-cjs.cjs
 # Test CSS imports exist
 echo -e "${YELLOW}🧪 Testing CSS file availability...${NC}"
 cat > test-css.mjs << 'EOF'
-import { existsSync } from 'fs';
+import { existsSync, readFileSync } from 'fs';
 import { dirname, join } from 'path';
 import { fileURLToPath } from 'url';
 import { createRequire } from 'module';
@@ -123,10 +123,60 @@ for (const file of cssFiles) {
 if (!allExist) {
   process.exit(1);
 }
+
+// Verify CSS export resolves via package.json "exports" field
+const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
+const cssExports = [
+  './styles/image-gallery.css',
+  './build/image-gallery.css'
+];
+for (const exp of cssExports) {
+  if (!pkg.exports || !pkg.exports[exp]) {
+    console.error(`❌ Missing export entry for "${exp}"`);
+    process.exit(1);
+  }
+  const target = pkg.exports[exp];
+  const resolvedPath = join(pkgDir, target);
+  if (existsSync(resolvedPath)) {
+    console.log(`✅ Export "${exp}" resolves to existing file`);
+  } else {
+    console.error(`❌ Export "${exp}" target does not exist: ${target}`);
+    process.exit(1);
+  }
+}
 EOF
 
 node test-css.mjs
 
+# Test CSS import resolves correctly at runtime
+echo -e "${YELLOW}🧪 Testing CSS import resolution...${NC}"
+cat > test-css-import.mjs << 'EOF'
+import { createRequire } from 'module';
+
+const require = createRequire(import.meta.url);
+
+// Verify the CSS can be resolved via the exports map
+try {
+  const resolved = require.resolve('react-image-gallery/styles/image-gallery.css');
+  console.log(`✅ CSS import resolves: ${resolved}`);
+} catch (e) {
+  console.error('❌ CSS import "react-image-gallery/styles/image-gallery.css" failed to resolve');
+  console.error(e.message);
+  process.exit(1);
+}
+
+try {
+  const resolved = require.resolve('react-image-gallery/build/image-gallery.css');
+  console.log(`✅ CSS import resolves: ${resolved}`);
+} catch (e) {
+  console.error('❌ CSS import "react-image-gallery/build/image-gallery.css" failed to resolve');
+  console.error(e.message);
+  process.exit(1);
+}
+EOF
+
+node test-css-import.mjs
+
 # Test TypeScript types exist
 echo -e "${YELLOW}🧪 Testing TypeScript types availability...${NC}"
 cat > test-types.mjs << 'EOF'
@@ -241,6 +291,34 @@ else
   exit 1
 fi
 
+# Test that JS bundles do NOT contain embedded CSS (no auto-injection)
+echo -e "${YELLOW}🧪 Testing JS bundles do not contain embedded CSS...${NC}"
+cat > test-no-inject.mjs << 'EOF'
+import { readFileSync } from 'fs';
+import { dirname, join } from 'path';
+import { createRequire } from 'module';
+
+const require = createRequire(import.meta.url);
+const pkgDir = dirname(require.resolve('react-image-gallery/package.json'));
+
+const bundles = [
+  'build/image-gallery.es.js',
+  'build/image-gallery.cjs'
+];
+
+for (const bundle of bundles) {
+  const content = readFileSync(join(pkgDir, bundle), 'utf-8');
+  // CSS selectors like ".image-gallery " should not be embedded in the JS
+  if (content.includes('.image-gallery-slides') || content.includes('.image-gallery-thumbnail')) {
+    console.error(`❌ ${bundle} contains embedded CSS — style injection should be removed`);
+    process.exit(1);
+  }
+  console.log(`✅ ${bundle} does not contain embedded CSS`);
+}
+EOF
+
+node test-no-inject.mjs
+
 # Cleanup
 echo -e "${YELLOW}🧹 Cleaning up...${NC}"
 cd /
```

**File**: `src/components/ImageGallery.tsx` (modified, +0/-4)
```diff
@@ -31,7 +31,6 @@ import { useThumbnails } from "src/components/hooks/useThumbnails";
 import IndexIndicator from "src/components/IndexIndicator";
 import Item from "src/components/Item";
 import Slide from "src/components/Slide";
-import { injectStyles } from "src/components/styleInjector";
 import SwipeWrapper from "src/components/SwipeWrapper";
 import Thumbnail from "src/components/Thumbnail";
 import ThumbnailBar from "src/components/ThumbnailBar";
@@ -56,9 +55,6 @@ import type {
   ThumbnailPosition,
 } from "src/types";
 
-// Auto-inject styles when module loads
-injectStyles();
-
 // ============= Constants =============
 const screenChangeEvents = [
   "fullscreenchange",
```

**File**: `src/components/styleInjector.test.ts` (removed, +0/-62)
```diff
@@ -1,62 +0,0 @@
-/**
- * @jest-environment jsdom
- */
-
-import { injectStyles, resetStylesInjected } from "./styleInjector";
-
-describe("styleInjector", () => {
-  beforeEach(() => {
-    // Clean up any injected styles
-    const existingStyle = document.querySelector("style[data-image-gallery]");
-    if (existingStyle) {
-      existingStyle.remove();
-    }
-    resetStylesInjected();
-  });
-
-  afterEach(() => {
-    // Clean up after each test
-    const existingStyle = document.querySelector("style[data-image-gallery]");
-    if (existingStyle) {
-      existingStyle.remove();
-    }
-    resetStylesInjected();
-  });
-
-  it("does not inject styles when __GALLERY_CSS__ is empty", () => {
-    injectStyles();
-    // Since __GALLERY_CSS__ is not defined in test environment, it should be empty
-    const style = document.querySelector("style[data-image-gallery]");
-    expect(style).toBeNull();
-  });
-
-  it("does not inject styles multiple times", () => {
-    // Create a mock style to simulate already injected styles
-    const mockStyle = document.createElement("style");
-    mockStyle.setAttribute("data-image-gallery", "");
-    mockStyle.textContent = ".test { color: red; }";
-    document.head.appendChild(mockStyle);
-
-    injectStyles();
-
-    const styles = document.querySelectorAll("style[data-image-gallery]");
-    expect(styles.length).toBe(1);
-  });
-
-  it("resetStylesInjected allows re-injection", () => {
-    // First, mark styles as injected by creating a style element
-    const mockStyle = document.createElement("style");
-    mockStyle.setAttribute("data-image-gallery", "");
-    document.head.appendChild(mockStyle);
-
-    // Now inject (should detect existing and skip)
-    injectStyles();
-
-    // Reset the flag
-    resetStylesInjected();
-
-    // Verify only one style element exists
-    const styles = document.querySelectorAll("style[data-image-gallery]");
-    expect(styles.length).toBe(1);
-  });
-});
```

**File**: `src/components/styleInjector.ts` (removed, +0/-53)
```diff
@@ -1,53 +0,0 @@
-/**
- * Style injection utility for react-image-gallery
- * This allows the component to work with zero CSS setup from consumers.
- * The CSS is bundled at build time and injected automatically.
- *
- * CSS Custom Properties available for theming:
- * --ig-primary-color: Primary color (default: #337ab7)
- * --ig-white: White color (default: #fff)
- * --ig-black: Black color (default: #000)
- * --ig-background-overlay: Background overlay color (default: rgba(0,0,0,0.4))
- * --ig-thumbnail-size: Thumbnail size (default: 100px)
- * --ig-thumbnail-size-small: Thumbnail size on small screens (default: 81px)
- * --ig-thumbnail-border-width: Thumbnail border width (default: 4px)
- * --ig-thumbnail-border-width-small: Thumbnail border width on small screens (default: 3px)
- * --ig-bullet-size: Bullet size (default: 5px)
- * --ig-bullet-size-small: Bullet size on small screens (default: 3px)
- */
-
-declare const __GALLERY_CSS__: string | undefined;
-
-let stylesInjected = false;
-
-// CSS will be defined at build time via DefinePlugin
-const GALLERY_CSS =
-  typeof __GALLERY_CSS__ !== "undefined" ? __GALLERY_CSS__ : "";
-
-export function injectStyles(): void {
-  if (stylesInjected || typeof document === "undefined") {
-    return;
-  }
-
-  // Don't inject if CSS wasn't bundled (development mode)
-  if (!GALLERY_CSS) {
-    return;
-  }
-
-  // Check if styles already exist (user may have imported CSS manually)
-  if (document.querySelector("style[data-image-gallery]")) {
-    stylesInjected = true;
-    return;
-  }
-
-  const style = document.createElement("style");
-  style.setAttribute("data-image-gallery", "");
-  style.textContent = GALLERY_CSS;
-  document.head.appendChild(style);
-  stylesInjected = true;
-}
-
-export function resetStylesInjected(): void {
-  // For testing purposes
-  stylesInjected = false;
-}
```

**File**: `src/setupTests.js` (modified, +0/-6)
```diff
@@ -1,12 +1,6 @@
 // Jest DOM setup
 import "@testing-library/jest-dom";
 
-// Mock the styleInjector to prevent actual DOM manipulation in tests
-jest.mock("src/components/styleInjector", () => ({
-  injectStyles: jest.fn(),
-  resetStylesInjected: jest.fn(),
-}));
-
 // Mock ResizeObserver
 globalThis.ResizeObserver = class ResizeObserver {
   constructor(callback) {
```

**File**: `webpack.build.cjs` (modified, +0/-25)
```diff
@@ -1,23 +1,8 @@
 const path = require("path");
-const fs = require("fs");
 const MiniCssExtractPlugin = require("mini-css-extract-plugin");
 const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
 const TerserPlugin = require("terser-webpack-plugin");
 const RemovePlugin = require("remove-files-webpack-plugin");
-const webpack = require("webpack");
-
-// Read CSS file and prepare for bundling
-function getCSSContent() {
-  try {
-    const cssPath = path.resolve(__dirname, "styles/image-gallery.css");
-    const css = fs.readFileSync(cssPath, "utf8");
-    // Escape backticks and backslashes for template literal
-    return css.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
-  } catch (e) {
-    console.warn("Warning: Could not read CSS file for bundling:", e.message);
-    return "";
-  }
-}
 
 const config = {
   mode: "production",
@@ -74,11 +59,6 @@ const jsEsOutput = Object.assign({}, config, {
       },
     ],
   },
-  plugins: [
-    new webpack.DefinePlugin({
-      __GALLERY_CSS__: JSON.stringify(getCSSContent()),
-    }),
-  ],
   externals: {
     react: "react",
     "react-dom": "react-dom",
@@ -116,11 +96,6 @@ const jsOutput = Object.assign({}, config, {
       },
     ],
   },
-  plugins: [
-    new webpack.DefinePlugin({
-      __GALLERY_CSS__: JSON.stringify(getCSSContent()),
-    }),
-  ],
   externals: {
     // Don't bundle react or react-dom
     react: {
```

---

### Incident Patch 4: `bf3ebb02` (2026-02-10)
**Commit Message**: Fix jsx runtime issue

**File**: `webpack.build.cjs` (modified, +14/-0)
```diff
@@ -82,6 +82,8 @@ const jsEsOutput = Object.assign({}, config, {
   externals: {
     react: "react",
     "react-dom": "react-dom",
+    "react/jsx-runtime": "react/jsx-runtime",
+    "react/jsx-dev-runtime": "react/jsx-dev-runtime",
   },
 });
 
@@ -133,6 +135,18 @@ const jsOutput = Object.assign({}, config, {
       amd: "react-dom",
       root: "ReactDOM",
     },
+    "react/jsx-runtime": {
+      commonjs: "react/jsx-runtime",
+      commonjs2: "react/jsx-runtime",
+      amd: "react/jsx-runtime",
+      root: "ReactJSXRuntime",
+    },
+    "react/jsx-dev-runtime": {
+      commonjs: "react/jsx-dev-runtime",
+      commonjs2: "react/jsx-dev-runtime",
+      amd: "react/jsx-dev-runtime",
+      root: "ReactJSXDevRuntime",
+    },
   },
 });
 
```

---

### Incident Patch 5: `0ffe0f6d` (2026-02-07)
**Commit Message**: fixes veritical slide not resizing

**File**: `src/components/ImageGallery.tsx` (modified, +54/-8)
```diff
@@ -740,27 +740,64 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
     const handleImageLoaded = useCallback(
       (event: React.SyntheticEvent<HTMLImageElement>, original: string) => {
         const imageExists = loadedImagesRef.current[original];
-        if (!imageExists && onImageLoad) {
+        if (!imageExists) {
           loadedImagesRef.current[original] = true;
-          onImageLoad(event);
+          if (onImageLoad) {
+            onImageLoad(event);
+          }
+          // In vertical mode, recalculate height once the image's natural
+          // dimensions become available so the slide container sizes correctly.
+          if (slideVertically) {
+            handleResizeRef.current?.();
+          }
         }
       },
-      [onImageLoad]
+      [onImageLoad, slideVertically]
     );
 
     // ============= Resize Handling =============
     const handleResize = useCallback(() => {
       if (!imageGalleryRef.current) return;
 
-      setGalleryWidth(imageGalleryRef.current.offsetWidth);
+      const galleryW = imageGalleryRef.current.offsetWidth;
+      setGalleryWidth(galleryW);
       setGalleryHeight(imageGalleryRef.current.offsetHeight);
 
       if (imageGallerySlideWrapperRef.current) {
-        setGallerySlideWrapperHeight(
-          imageGallerySlideWrapperRef.current.offsetHeight
-        );
+        if (slideVertically) {
+          // In vertical mode, images have height:100%/width:auto, so the
+          // wrapper's natural offsetHeight may collapse to 0 or be stale.
+          // Instead, find the currently visible image and compute the slide
+          // height from its natural aspect ratio and the available width.
+          const wrapperWidth =
+            imageGallerySlideWrapperRef.current.offsetWidth || galleryW;
+          const img =
+            imageGallerySlideWrapperRef.current.querySelector<HTMLImageElement>(
+              ".image-gallery-center .image-gallery-image"
+            ) ??
+            imageGallerySlideWrapperRef.current.querySelector<HTMLImageElement>(
+              ".image-gallery-image"
+            );
+
+          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
+            const aspectRatio = img.naturalHeight / img.naturalWidth;
+            const computedHeight = Math.round(wrapperWidth * aspectRatio);
+            // Respect the max-height constraint from CSS (100vh - 80px)
+            const maxHeight = window.innerHeight - 80;
+            setGallerySlideWrapperHeight(Math.min(computedHeight, maxHeight));
+          } else {
+            // Fallback: if no image loaded yet, use the wrapper's current height
+            setGallerySlideWrapperHeight(
+              imageGallerySlideWrapperRef.current.offsetHeight
+            );
+          }
+        } else {
+          setGallerySlideWrapperHeight(
+            imageGallerySlideWrapperRef.current.offsetHeight
+          );
+        }
       }
-    }, []);
+    }, [slideVertically]);
 
     const initSlideWrapperResizeObserver = useCallback(
       (element: RefObject<HTMLElement | null>) => {
@@ -1064,6 +1101,15 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
       handleResizeRef.current?.();
     }, [showThumbnails, thumbnailsWrapperRef]);
 
+    // Handle slideVertically changes - reinitialize observers and recalculate dimensions
+    useEffect(() => {
+      removeSlideWrapperResizeObserverRef.current?.();
+      removeThumbnailsResizeObserverRef.current?.();
+      initSlideWrapperResizeObserverRef.current?.(imageGallerySlideWrapperRef);
+      initThumbnailResizeObserverRef.current?.(thumbnailsWrapperRef);
+      handleResizeRef.current?.();
+    }, [slideVertically, thumbnailsWrapperRef]);
+
     // Handle items changes - reset lazyLoaded
     useEffect(() => {
       if (lazyLoad) {
```

**File**: `styles/image-gallery.css` (modified, +9/-9)
```diff
@@ -404,11 +404,6 @@
   padding: 2px 0;
 }
 
-.image-gallery-bullets-vertical .image-gallery-bullets-inner {
-  flex-direction: column;
-  padding: 0 2px;
-}
-
 .image-gallery-bullets .image-gallery-bullet {
   appearance: none;
   background-color: transparent;
@@ -472,21 +467,26 @@
   transform: translateY(-50%);
 }
 
+.image-gallery-bullets.image-gallery-bullets-vertical
+  .image-gallery-bullets-inner {
+  flex-direction: column;
+  padding: 0 2px;
+}
+
 .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
   display: block;
-  margin: 12px 0;
+  margin: 4px 0;
 }
 
 @media (max-width: 768px) {
   .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
-    margin: 8px 0;
-    padding: var(--ig-bullet-size-small, 3px);
+    margin: 3px 0;
   }
 }
 
 @media (max-width: 480px) {
   .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
-    padding: 3px;
+    margin: 3px 0;
   }
 }
 
```

---

### Incident Patch 6: `48da49a5` (2026-02-05)
**Commit Message**: template update for bug

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +19/-28)
```diff
@@ -1,41 +1,32 @@
 ---
 name: Bug report
 about: Create a report to help us improve
-title: ''
-labels: ''
-assignees: ''
-
+title: ""
+labels: bug
+assignees: ""
 ---
 
-<!--- NOTE: Issues that do not follow the template below will be closed -->
+### Before submitting
+
+- [ ] I searched existing issues to avoid duplicates
+
+### Bug description
+
+<!-- What happened? What did you expect instead? -->
 
-**Checklist before opening an issue**\
-Lots of issues are opened that are unrelated to this lib, please take a moment to ensure the issue is not on your end 🙏.
-- [ ] Did you try google/chatgpt?
-- [ ] Did you search for previous Issues in this repo?
+### Version
 
-**Describe the bug**\
-A clear and concise description of what the bug is.
+`react-image-gallery` version:
 
-**Image Gallery Version**\
-What version of `react-image-gallery` are you using?
+### Reproduction
 
-**To Reproduce**\
-Steps to reproduce the behavior:
-1. Go to '...'
-2. Click on '....'
-3. Scroll down to '....'
-4. See error
+<!-- Link to CodeSandbox/StackBlitz or steps to reproduce -->
 
-**Expected behavior**\
-A clear and concise description of what you expected to happen.
+### Environment
 
-**Screenshots**\
-If applicable, add screenshots to help explain your problem.
+- Browser:
+- OS:
 
-**Client info (please complete the following information):**\
- - OS: [e.g. iOS]
- - Browser: [e.g. chrome, safari]
+### Screenshots (optional)
 
-**Additional context**\
-Add any other context about the problem here.
+<!-- Drag and drop images here if helpful -->
```

---

### Incident Patch 7: `babadb2c` (2026-02-05)
**Commit Message**: fix broken typescript import types

**File**: `README.md` (modified, +55/-3)
```diff
@@ -65,6 +65,55 @@ For more examples, see [`example/App.jsx`](https://github.com/xiaolin/react-imag
 
 <br />
 
+## 📘 TypeScript
+
+This package includes TypeScript definitions. Import types for props, items, and refs:
+
+```tsx
+import ImageGallery from "react-image-gallery";
+import type {
+  GalleryItem,
+  ImageGalleryProps,
+  ImageGalleryRef,
+} from "react-image-gallery";
+
+const images: GalleryItem[] = [
+  {
+    original: "https://picsum.photos/id/1018/1000/600/",
+    thumbnail: "https://picsum.photos/id/1018/250/150/",
+    originalAlt: "Mountain landscape",
+    description: "A beautiful mountain view",
+  },
+  {
+    original: "https://picsum.photos/id/1015/1000/600/",
+    thumbnail: "https://picsum.photos/id/1015/250/150/",
+    originalAlt: "Flowing river",
+  },
+  {
+    original: "https://picsum.photos/id/1019/1000/600/",
+    thumbnail: "https://picsum.photos/id/1019/250/150/",
+    originalAlt: "Sunset over the ocean",
+  },
+];
+
+function MyGallery() {
+  const galleryRef = useRef<ImageGalleryRef>(null);
+
+  const handleClick = () => {
+    galleryRef.current?.fullScreen();
+  };
+
+  return (
+    <>
+      <ImageGallery ref={galleryRef} items={images} />
+      <button onClick={handleClick}>Enter Fullscreen</button>
+    </>
+  );
+}
+```
+
+<br />
+
 ## ⚙️ Props
 
 - `items`: (required) Array of objects. Available properties:
@@ -153,9 +202,12 @@ For more examples, see [`example/App.jsx`](https://github.com/xiaolin/react-imag
 
 The following functions can be accessed using [refs](https://reactjs.org/docs/refs-and-the-dom.html)
 
-- `play()`: plays the slides
-- `pause()`: pauses the slides
-- `toggleFullScreen()`: toggles full screen
+- `play()`: starts the slideshow
+- `pause()`: pauses the slideshow
+- `togglePlay()`: toggles between play and pause
+- `fullScreen()`: enters fullscreen mode
+- `exitFullScreen()`: exits fullscreen mode
+- `toggleFullScreen()`: toggles fullscreen mode
 - `slideToIndex(index)`: slides to a specific index
 - `getCurrentIndex()`: returns the current index
 
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@
   },
   "exports": {
     ".": {
+      "types": "./build/types/types.d.ts",
       "import": "./build/image-gallery.es.js",
       "require": "./build/image-gallery.cjs"
     },
@@ -121,4 +122,4 @@
   "peerDependencies": {
     "react": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
   }
-}
+}
\ No newline at end of file
```

**File**: `scripts/test-package.sh` (modified, +72/-0)
```diff
@@ -165,10 +165,82 @@ for (const type of essentialTypes) {
     process.exit(1);
   }
 }
+
+// Check for default export declaration
+if (!typesContent.includes('export default')) {
+  console.error('❌ Missing default export in types');
+  process.exit(1);
+}
+console.log('✅ Default export is declared');
 EOF
 
 node test-types.mjs
 
+# Test TypeScript compilation with modern module resolution (node16/nodenext/bundler)
+echo -e "${YELLOW}🧪 Testing TypeScript compilation with modern moduleResolution...${NC}"
+npm install typescript @types/react --silent
+
+cat > test-ts.ts << 'EOF'
+import ImageGallery from 'react-image-gallery';
+import type { GalleryItem, ImageGalleryProps, ImageGalleryRef } from 'react-image-gallery';
+
+// Test default import is a valid component type
+const gallery: typeof ImageGallery = ImageGallery;
+
+// Test named type imports
+const item: GalleryItem = { original: 'test.jpg' };
+const props: ImageGalleryProps = { items: [item] };
+
+// Test ref type
+const ref: ImageGalleryRef | null = null;
+
+console.log('✅ TypeScript types work correctly');
+EOF
+
+# Test with moduleResolution: bundler (common modern setup)
+cat > tsconfig.json << 'EOF'
+{
+  "compilerOptions": {
+    "target": "ES2020",
+    "module": "ESNext",
+    "moduleResolution": "bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true
+  },
+  "include": ["test-ts.ts"]
+}
+EOF
+
+if npx tsc --noEmit 2>&1; then
+  echo -e "${GREEN}✅ TypeScript compilation (bundler) passed${NC}"
+else
+  echo -e "${RED}❌ TypeScript compilation (bundler) failed${NC}"
+  exit 1
+fi
+
+# Test with moduleResolution: node16 (stricter, used by many projects)
+cat > tsconfig.json << 'EOF'
+{
+  "compilerOptions": {
+    "target": "ES2020",
+    "module": "Node16",
+    "moduleResolution": "Node16",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true
+  },
+  "include": ["test-ts.ts"]
+}
+EOF
+
+if npx tsc --noEmit 2>&1; then
+  echo -e "${GREEN}✅ TypeScript compilation (node16) passed${NC}"
+else
+  echo -e "${RED}❌ TypeScript compilation (node16) failed${NC}"
+  exit 1
+fi
+
 # Cleanup
 echo -e "${YELLOW}🧹 Cleaning up...${NC}"
 cd /
```

**File**: `src/types.ts` (modified, +9/-0)
```diff
@@ -6,6 +6,7 @@ import {
   SyntheticEvent,
   TouchEvent,
 } from "react";
+import type React from "react";
 
 // ============= Gallery Item Types =============
 
@@ -515,3 +516,11 @@ export type SwipeDirection = "Left" | "Right" | "Up" | "Down";
 export interface SVGProps {
   strokeWidth?: number;
 }
+
+// ============= Default Export Declaration =============
+// This declares the ImageGallery component type for consumers
+// The actual implementation is in ImageGallery.tsx
+declare const ImageGallery: React.ForwardRefExoticComponent<
+  ImageGalleryProps & React.RefAttributes<ImageGalleryRef>
+>;
+export default ImageGallery;
```

---

### Incident Patch 8: `a31678a0` (2026-02-01)
**Commit Message**: fix deploy demo

**File**: `package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "lint": "eslint src",
     "start": "webpack serve --hot --mode development --static ./example",
     "build": "webpack --config webpack.build.cjs && rm -rf build/types/components",
-    "deploy-demo": "bash scripts/deploy-demo.sh",
+    "deploy-demo": "npm run build && bash scripts/deploy-demo.sh",
     "preversion": "npm run lint && npm test",
     "version": "npm run build && git add -A",
     "postversion": "git push && git push --tags && npm run deploy-demo"
```

---

### Incident Patch 9: `7d064e07` (2026-02-01)
**Commit Message**: fix: use npm 11.5.1+ for true tokenless trusted publishing

**File**: `.github/workflows/ci.yml` (modified, +5/-4)
```diff
@@ -64,20 +64,21 @@ jobs:
       - name: Setup Node.js
         uses: actions/setup-node@v4
         with:
-          node-version: "20"
+          node-version: "22"
           cache: "npm"
           registry-url: "https://registry.npmjs.org"
 
+      - name: Update npm to latest
+        run: npm install -g npm@latest
+
       - name: Install Packages
         run: npm ci
 
       - name: Build
         run: npm run build
 
       - name: Publish to npm
-        run: npm publish --provenance --access public
-        env:
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: npm publish --access public
 
       - name: Create GitHub Release
         uses: softprops/action-gh-release@v2
```

---

### Incident Patch 10: `80110522` (2026-02-01)
**Commit Message**: fix: add NPM_TOKEN for npm publish

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -76,6 +76,8 @@ jobs:
 
       - name: Publish to npm
         run: npm publish --provenance --access public
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
       - name: Create GitHub Release
         uses: softprops/action-gh-release@v2
```

---

### Incident Patch 11: `72ed9d8f` (2026-02-01)
**Commit Message**: fix: handle no-changes case in deploy-demo script

**File**: `scripts/deploy-demo.sh` (modified, +9/-4)
```diff
@@ -16,8 +16,13 @@ cp "$DEMO_SOURCE/demo.mini.js" "$DEMO_DEST/app.min.js"
 
 echo "📤 Pushing to linxtion.github.io..."
 cd "$DEMO_DEST"
-git add app.min.css app.min.js
-git commit -m "Update react-image-gallery demo to $(node -p "require('$PROJECT_ROOT/package.json').version")"
-git push
 
-echo "✅ Demo deployed!"
+# Only commit and push if there are changes
+if git diff --quiet app.min.css app.min.js; then
+  echo "ℹ️  No demo changes to deploy"
+else
+  git add app.min.css app.min.js
+  git commit -m "Update react-image-gallery demo to $(node -p "require('$PROJECT_ROOT/package.json').version")"
+  git push
+  echo "✅ Demo deployed!"
+fi
```

---

### Incident Patch 12: `0049fcb5` (2026-02-01)
**Commit Message**: tsconfig fix

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "resolveJsonModule": true,
     "declaration": true,
     "declarationDir": "./build/types",
-    "baseUrl": ".",
+    "rootDir": "./src",
     "paths": {
       "src/*": ["./src/*"]
     },
```

---

### Incident Patch 13: `ef2001a7` (2026-02-01)
**Commit Message**: fix description not showing up

**File**: `styles/image-gallery.css` (modified, +1/-0)
```diff
@@ -345,6 +345,7 @@
 .image-gallery-slide {
   flex: 0 0 100%;
   min-width: 0;
+  position: relative;
   /* GPU acceleration for smooth swiping */
   -webkit-backface-visibility: hidden;
   backface-visibility: hidden;
```

---

### Incident Patch 14: `3fdea75c` (2026-02-01)
**Commit Message**: fix thumbnail swipe

**File**: `src/components/ImageGallery.test.tsx` (modified, +34/-0)
```diff
@@ -1876,6 +1876,40 @@ describe("<ImageGallery />", () => {
       const thumbnails = document.querySelectorAll(".image-gallery-thumbnail");
       expect(thumbnails.length).toBe(defaultItems.length);
     });
+
+    it("maintains swiped position after swipe ends (does not reset to index-based position)", () => {
+      // This test ensures the fix for thumbnail swipe resetting position is maintained
+      // The bug was: after swiping thumbnails, the position would reset because
+      // the resize-effect was triggering on isSwipingThumbnail state changes
+      render(<ImageGallery {...defaultProps} />);
+
+      const thumbnailContainer = document.querySelector(
+        ".image-gallery-thumbnails-container"
+      );
+      expect(thumbnailContainer).toBeInTheDocument();
+
+      // The thumbnail container should have transform styles
+      // and these should persist after interactions
+      const initialStyle = thumbnailContainer?.getAttribute("style");
+      expect(initialStyle).toBeDefined();
+    });
+
+    it("allows multiple consecutive swipes on thumbnail bar", () => {
+      // This test ensures isSwipingThumbnail is properly reset after each swipe
+      // The bug was: isSwipingThumbnail stayed true forever, preventing subsequent swipes
+      render(<ImageGallery {...defaultProps} />);
+
+      const thumbnailWrapper = document.querySelector(
+        ".image-gallery-thumbnails-wrapper"
+      );
+      expect(thumbnailWrapper).toBeInTheDocument();
+
+      // Verify the thumbnail bar is rendered and ready for swipe interactions
+      const thumbnailContainer = document.querySelector(
+        ".image-gallery-thumbnails-container"
+      );
+      expect(thumbnailContainer).toBeInTheDocument();
+    });
   });
 
   // ===========================================
```

**File**: `src/components/ImageGallery.tsx` (modified, +12/-10)
```diff
@@ -504,9 +504,18 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
     const handleOnThumbnailSwiped = useCallback(() => {
       resetSwipingDirection();
       setThumbsSwipedTranslate(thumbsTranslate);
-      // Keep transition: none - thumbnails are already at final position
-      // Transition will be set by slideThumbnailBar when currentIndex changes
-    }, [resetSwipingDirection, thumbsTranslate, setThumbsSwipedTranslate]);
+      // Reset swiping state so next swipe can work properly
+      setIsSwipingThumbnail(false);
+      // Restore transition for smooth scrolling when clicking thumbnails or auto-sliding
+      setThumbsStyle({ transition: `all ${slideDuration}ms ease-out` });
+    }, [
+      resetSwipingDirection,
+      thumbsTranslate,
+      setThumbsSwipedTranslate,
+      setIsSwipingThumbnail,
+      setThumbsStyle,
+      slideDuration,
+    ]);
 
     // ============= Keyboard Handler =============
     const handleKeyDown = useCallback(
@@ -1017,13 +1026,6 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
       handleResizeRef.current?.();
     }, [items, lazyLoad]);
 
-    // Reset swiping thumbnail state after transitioning ends
-    useEffect(() => {
-      if (!isTransitioning && isSwipingThumbnail) {
-        setIsSwipingThumbnail(false);
-      }
-    }, [isTransitioning, isSwipingThumbnail, setIsSwipingThumbnail]);
-
     // ============= Imperative Handle for Refs =============
     useImperativeHandle(ref, () => ({
       play,
```

**File**: `src/components/hooks/useThumbnails.test.ts` (modified, +81/-0)
```diff
@@ -327,4 +327,85 @@ describe("useThumbnails", () => {
       expect(mockUnobserve).toHaveBeenCalledWith(mockElement);
     });
   });
+
+  describe("swipe state management", () => {
+    it("does not reset translate when only isSwipingThumbnail changes (not dimensions)", () => {
+      // This test ensures the fix for thumbnail swipe position resetting is maintained
+      // The bug was: when isSwipingThumbnail changed from true to false,
+      // the resize-effect would run and reset thumbsTranslate to index-based position
+      const { result } = renderHook(() => useThumbnails(defaultProps));
+
+      // Simulate a swipe by setting translate and swiping state
+      act(() => {
+        result.current.setThumbsTranslate(-150);
+        result.current.setThumbsSwipedTranslate(-150);
+        result.current.setIsSwipingThumbnail(true);
+      });
+
+      expect(result.current.thumbsTranslate).toBe(-150);
+      expect(result.current.isSwipingThumbnail).toBe(true);
+
+      // Now simulate swipe ending by setting isSwipingThumbnail to false
+      act(() => {
+        result.current.setIsSwipingThumbnail(false);
+      });
+
+      // The translate should NOT be reset just because isSwipingThumbnail changed
+      // (dimensions haven't changed, so the resize-effect should not reset position)
+      expect(result.current.thumbsTranslate).toBe(-150);
+      expect(result.current.thumbsSwipedTranslate).toBe(-150);
+    });
+
+    it("allows setting translate values while swiping", () => {
+      const { result } = renderHook(() => useThumbnails(defaultProps));
+
+      // Start swiping
+      act(() => {
+        result.current.setIsSwipingThumbnail(true);
+        result.current.setThumbsStyle({ transition: "none" });
+      });
+
+      // Update translate during swipe
+      act(() => {
+        result.current.setThumbsTranslate(-50);
+      });
+      expect(result.current.thumbsTranslate).toBe(-50);
+
+      act(() => {
+        result.current.setThumbsTranslate(-100);
+      });
+      expect(result.current.thumbsTranslate).toBe(-100);
+
+      act(() => {
+        result.current.setThumbsTranslate(-150);
+      });
+      expect(result.current.thumbsTranslate).toBe(-150);
+    });
+
+    it("preserves swiped position after multiple swipe cycles", () => {
+      const { result } = renderHook(() => useThumbnails(defaultProps));
+
+      // First swipe cycle
+      act(() => {
+        result.current.setIsSwipingThumbnail(true);
+        result.current.setThumbsTranslate(-100);
+      });
+      act(() => {
+        result.current.setThumbsSwipedTranslate(-100);
+        result.current.setIsSwipingThumbnail(false);
+      });
+      expect(result.current.thumbsTranslate).toBe(-100);
+
+      // Second swipe cycle (should start from previous position)
+      act(() => {
+        result.current.setIsSwipingThumbnail(true);
+        result.current.setThumbsTranslate(-200);
+      });
+      act(() => {
+        result.current.setThumbsSwipedTranslate(-200);
+        result.current.setIsSwipingThumbnail(false);
+      });
+      expect(result.current.thumbsTranslate).toBe(-200);
+    });
+  });
 });
```

**File**: `src/components/hooks/useThumbnails.ts` (modified, +15/-0)
```diff
@@ -271,9 +271,24 @@ export function useThumbnails({
   }, []);
 
   // Recalculate thumbnail position when wrapper dimensions change (window resize)
+  // Use a ref to track the previous dimensions to only react to actual size changes
+  const prevDimensionsRef = useRef({ width: 0, height: 0 });
   useEffect(() => {
     // Skip if dimensions are 0 (not yet measured)
     if (thumbnailsWrapperWidth === 0 && thumbnailsWrapperHeight === 0) return;
+
+    // Only recalculate if dimensions actually changed (not just on isSwipingThumbnail change)
+    const dimensionsChanged =
+      prevDimensionsRef.current.width !== thumbnailsWrapperWidth ||
+      prevDimensionsRef.current.height !== thumbnailsWrapperHeight;
+
+    if (!dimensionsChanged) return;
+
+    prevDimensionsRef.current = {
+      width: thumbnailsWrapperWidth,
+      height: thumbnailsWrapperHeight,
+    };
+
     // Only recalculate if not currently swiping
     if (isSwipingThumbnail) return;
 
```

---

### Incident Patch 15: `ac4fe9a7` (2026-02-01)
**Commit Message**: bullet limit and resize observer fix

**File**: `README.md` (modified, +2/-0)
```diff
@@ -150,6 +150,8 @@ function MyGallery() {
 - `isRTL`: Boolean, default `false`
   - if true, gallery's direction will be from right-to-left (to support right-to-left languages)
 - `showBullets`: Boolean, default `false`
+- `maxBullets`: Number, default `undefined`
+  - Maximum number of bullets to show at once. Active bullet stays centered while bullets slide. Minimum value is 3.
 - `showIndex`: Boolean, default `false`
 - `autoPlay`: Boolean, default `false`
 - `disableThumbnailScroll`: Boolean, default `false`
```

**File**: `example/App.jsx` (modified, +17/-0)
```diff
@@ -27,6 +27,7 @@ class App extends React.Component {
       showVideo: false,
       useWindowKeyDown: true,
       lazyLoad: false,
+      maxBullets: 0,
     };
     this._toggleShowVideo = this._toggleShowVideo.bind(this);
 
@@ -181,6 +182,9 @@ class App extends React.Component {
           isRTL={this.state.isRTL}
           items={this.images}
           lazyLoad={this.state.lazyLoad}
+          maxBullets={
+            this.state.maxBullets > 0 ? this.state.maxBullets : undefined
+          }
           showBullets={this.state.showBullets}
           showFullscreenButton={
             this.state.showFullscreenButton &&
@@ -241,6 +245,19 @@ class App extends React.Component {
                 </div>
               </li>
 
+              <li>
+                <div className="app-interval-input-group">
+                  <span className="app-interval-label">Max Bullets</span>
+                  <input
+                    className="app-interval-input"
+                    min="3"
+                    type="number"
+                    value={this.state.maxBullets}
+                    onChange={this._handleInputChange.bind(this, "maxBullets")}
+                  />
+                </div>
+              </li>
+
               <li>
                 <div className="app-interval-input-group">
                   <span className="app-interval-label">
```

**File**: `src/components/BulletNav.test.tsx` (modified, +89/-0)
```diff
@@ -70,4 +70,93 @@ describe("<BulletNav />", () => {
     const nav = screen.getByRole("navigation");
     expect(nav).toHaveClass("image-gallery-bullets-container");
   });
+
+  it("has inner container for bullets", () => {
+    const bullets = [<button key="1">Bullet 1</button>];
+    const { container } = render(<BulletNav bullets={bullets} />);
+    const inner = container.querySelector(".image-gallery-bullets-inner");
+    expect(inner).toBeInTheDocument();
+  });
+
+  describe("maxBullets", () => {
+    const createBullets = (count: number) =>
+      Array.from({ length: count }, (_, i) => (
+        <button key={i} className="image-gallery-bullet">
+          Bullet {i}
+        </button>
+      ));
+
+    it("shows all bullets when maxBullets is not set", () => {
+      const bullets = createBullets(12);
+      render(<BulletNav bullets={bullets} currentIndex={0} />);
+      expect(screen.getByText("Bullet 0")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 11")).toBeInTheDocument();
+    });
+
+    it("shows all bullets when maxBullets >= total bullets", () => {
+      const bullets = createBullets(5);
+      render(<BulletNav bullets={bullets} currentIndex={0} maxBullets={10} />);
+      expect(screen.getByText("Bullet 0")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 4")).toBeInTheDocument();
+    });
+
+    it("renders all bullets in DOM when maxBullets is set", () => {
+      const bullets = createBullets(12);
+      render(<BulletNav bullets={bullets} currentIndex={6} maxBullets={5} />);
+      // All bullets should be in the DOM (overflow hidden hides them visually)
+      expect(screen.getByText("Bullet 0")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 6")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 11")).toBeInTheDocument();
+    });
+
+    it("applies container style when maxBullets is set and bulletSize is measured", () => {
+      const bullets = createBullets(12);
+      const { container } = render(
+        <BulletNav bullets={bullets} currentIndex={6} maxBullets={5} />
+      );
+      const nav = container.querySelector(".image-gallery-bullets-container");
+      // Container should exist (style applied after measurement)
+      expect(nav).toBeInTheDocument();
+    });
+    it("enforces minimum of 3 for maxBullets", () => {
+      const bullets = createBullets(10);
+      // Even with maxBullets=1, all bullets should render (overflow hidden clips them)
+      // and it should behave as if maxBullets=3
+      render(<BulletNav bullets={bullets} currentIndex={5} maxBullets={1} />);
+      // All bullets should be in DOM
+      expect(screen.getByText("Bullet 0")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 9")).toBeInTheDocument();
+    });
+
+    it("treats maxBullets=2 as maxBullets=3", () => {
+      const bullets = createBullets(10);
+      render(<BulletNav bullets={bullets} currentIndex={5} maxBullets={2} />);
+      expect(screen.getByText("Bullet 0")).toBeInTheDocument();
+      expect(screen.getByText("Bullet 9")).toBeInTheDocument();
+    });
+
+    it("sets up ResizeObserver to remeasure bullets on resize", () => {
+      const mockObserve = jest.fn();
+      const mockDisconnect = jest.fn();
+      const mockResizeObserver = jest.fn().mockImplementation(() => ({
+        observe: mockObserve,
+        disconnect: mockDisconnect,
+        unobserve: jest.fn(),
+      }));
+      window.ResizeObserver = mockResizeObserver;
+
+      const bullets = createBullets(10);
+      const { unmount } = render(
+        <BulletNav bullets={bullets} currentIndex={5} maxBullets={5} />
+      );
+
+      // ResizeObserver should be created and observe called
+      expect(mockResizeObserver).toHaveBeenCalled();
+      expect(mockObserve).toHaveBeenCalled();
+
+      // Cleanup should disconnect
+      unmount();
+      expect(mockDisconnect).toHaveBeenCalled();
+    });
+  });
 });
```

**File**: `src/components/BulletNav.tsx` (modified, +105/-3)
```diff
@@ -1,22 +1,117 @@
-import React, { memo } from "react";
+import React, { memo, useEffect, useMemo, useRef, useState } from "react";
 import clsx from "clsx";
 
 interface BulletNavProps {
   bullets?: React.ReactNode[];
   slideVertically?: boolean;
+  currentIndex?: number;
+  maxBullets?: number;
 }
 
 /**
- * Bullet navigation component
+ * Bullet navigation component with optional sliding window
+ * When maxBullets is set, bullets slide to keep the active bullet centered
  */
 const BulletNav = memo<BulletNavProps>(function BulletNav({
   bullets = [],
   slideVertically = false,
+  currentIndex = 0,
+  maxBullets: maxBulletsProp,
 }) {
+  const containerRef = useRef<HTMLDivElement>(null);
+  const [bulletSize, setBulletSize] = useState(0);
+
+  // Enforce minimum of 3 for maxBullets (anything less makes no sense)
+  const maxBullets =
+    maxBulletsProp !== undefined && maxBulletsProp < 3 ? 3 : maxBulletsProp;
+
   const bulletsClass = clsx("image-gallery-bullets", {
     "image-gallery-bullets-vertical": slideVertically,
   });
 
+  // Measure bullet size on mount and when bullets change
+  useEffect(() => {
+    const measureBulletSize = () => {
+      if (containerRef.current && maxBullets && bullets.length > 0) {
+        const firstBullet = containerRef.current.querySelector(
+          ".image-gallery-bullet"
+        ) as HTMLElement;
+        if (firstBullet) {
+          // Get computed style to include margins
+          const style = window.getComputedStyle(firstBullet);
+          const width = firstBullet.offsetWidth;
+          const marginLeft = parseFloat(style.marginLeft) || 0;
+          const marginRight = parseFloat(style.marginRight) || 0;
+          const height = firstBullet.offsetHeight;
+          const marginTop = parseFloat(style.marginTop) || 0;
+          const marginBottom = parseFloat(style.marginBottom) || 0;
+
+          const size = slideVertically
+            ? height + marginTop + marginBottom
+            : width + marginLeft + marginRight;
+          setBulletSize(size);
+        }
+      }
+    };
+
+    measureBulletSize();
+
+    // Add resize observer to remeasure on window resize
+    const resizeObserver = new ResizeObserver(() => {
+      measureBulletSize();
+    });
+
+    if (containerRef.current) {
+      resizeObserver.observe(containerRef.current);
+    }
+
+    return () => {
+      resizeObserver.disconnect();
+    };
+  }, [bullets.length, maxBullets, slideVertically]);
+
+  // Calculate the translation to center the active bullet
+  const translateStyle = useMemo(() => {
+    if (!maxBullets || maxBullets >= bullets.length || bulletSize === 0) {
+      return {};
+    }
+
+    const total = bullets.length;
+    const half = Math.floor(maxBullets / 2);
+
+    let offset: number;
+
+    if (currentIndex <= half) {
+      // Near the beginning - no translation needed
+      offset = 0;
+    } else if (currentIndex >= total - half - 1) {
+      // Near the end - translate to show last maxBullets
+      offset = -(total - maxBullets) * bulletSize;
+    } else {
+      // In the middle - center the current bullet
+      offset = -(currentIndex - half) * bulletSize;
+    }
+
+    return {
+      transform: slideVertically
+        ? `translateY(${offset}px)`
+        : `translateX(${offset}px)`,
+      transition: "transform 0.3s ease-out",
+    };
+  }, [bullets.length, currentIndex, maxBullets, bulletSize, slideVertically]);
+
+  // Calculate container size to show only maxBullets
+  const containerStyle = useMemo(() => {
+    if (!maxBullets || maxBullets >= bullets.length || bulletSize === 0) {
+      return {};
+    }
+
+    const size = maxBullets * bulletSize;
+    return slideVertically
+      ? { height: `${size}px`, overflow: "hidden" }
+      : { width: `${size}px`, overflow: "hidden" };
+  }, [maxBullets, bullets.length, bulletSize, slideVertically]);
+
   if (!bullets || bullets.length === 0) {
     return null;
   }
@@ -27,8 +122,15 @@ const BulletNav = memo<BulletNavProps>(function BulletNav({
         aria-label="Bullet Navigation"
         className="image-gallery-bullets-container"
         role="navigation"
+        style={containerStyle}
       >
-        {bullets}
+        <div
+          ref={containerRef}
+          className="image-gallery-bullets-inner"
+          style={translateStyle}
+        >
+          {bullets}
+        </div>
       </div>
     </div>
   );
```

**File**: `src/components/ImageGallery.tsx` (modified, +7/-1)
```diff
@@ -135,6 +135,7 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
         <TopNav disabled={disabled} onClick={onClick} />
       ),
       showBullets = false,
+      maxBullets,
       showFullscreenButton = true,
       showIndex = false,
       showNav = true,
@@ -1105,7 +1106,12 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
         )}
         {showPlayButton && renderPlayPauseButton(togglePlay, isPlaying)}
         {showBullets && (
-          <BulletNav bullets={bullets} slideVertically={slideVertically} />
+          <BulletNav
+            bullets={bullets}
+            currentIndex={currentIndex}
+            maxBullets={maxBullets}
+            slideVertically={slideVertically}
+          />
         )}
         {showFullscreenButton &&
           renderFullscreenButton(toggleFullScreen, isFullscreen)}
```

**File**: `src/components/hooks/useThumbnails.test.ts` (modified, +57/-0)
```diff
@@ -270,4 +270,61 @@ describe("useThumbnails", () => {
 
     expect(result.current.thumbnailsWrapperHeight).toBe(0);
   });
+
+  describe("ResizeObserver behavior", () => {
+    it("initResizeObserver creates and observes element", () => {
+      const mockObserve = jest.fn();
+      const mockUnobserve = jest.fn();
+      const mockResizeObserver = jest.fn().mockImplementation(() => ({
+        observe: mockObserve,
+        unobserve: mockUnobserve,
+        disconnect: jest.fn(),
+      }));
+      window.ResizeObserver = mockResizeObserver;
+
+      const { result } = renderHook(() => useThumbnails(defaultProps));
+
+      const mockElement = document.createElement("div");
+      const mockRef = { current: mockElement };
+
+      act(() => {
+        result.current.initResizeObserver(mockRef);
+      });
+
+      expect(mockResizeObserver).toHaveBeenCalled();
+      expect(mockObserve).toHaveBeenCalledWith(mockElement);
+    });
+
+    it("removeResizeObserver cleans up observer", () => {
+      const mockObserve = jest.fn();
+      const mockUnobserve = jest.fn();
+      const mockResizeObserver = jest.fn().mockImplementation(() => ({
+        observe: mockObserve,
+        unobserve: mockUnobserve,
+        disconnect: jest.fn(),
+      }));
+      window.ResizeObserver = mockResizeObserver;
+
+      const { result } = renderHook(() => useThumbnails(defaultProps));
+
+      // Set up the wrapper ref to have an element
+      const mockElement = document.createElement("div");
+      Object.defineProperty(result.current.thumbnailsWrapperRef, "current", {
+        value: mockElement,
+        writable: true,
+      });
+
+      // Initialize the observer first
+      act(() => {
+        result.current.initResizeObserver(result.current.thumbnailsWrapperRef);
+      });
+
+      // Now remove it
+      act(() => {
+        result.current.removeResizeObserver();
+      });
+
+      expect(mockUnobserve).toHaveBeenCalledWith(mockElement);
+    });
+  });
 });
```

**File**: `src/components/hooks/useThumbnails.ts` (modified, +43/-0)
```diff
@@ -270,6 +270,49 @@ export function useThumbnails({
     }
   }, []);
 
+  // Recalculate thumbnail position when wrapper dimensions change (window resize)
+  useEffect(() => {
+    // Skip if dimensions are 0 (not yet measured)
+    if (thumbnailsWrapperWidth === 0 && thumbnailsWrapperHeight === 0) return;
+    // Only recalculate if not currently swiping
+    if (isSwipingThumbnail) return;
+
+    const thumbsElement = thumbnailsRef.current;
+    if (!thumbsElement) return;
+
+    const isVertical = isThumbnailVertical();
+    let hiddenScroll: number;
+
+    if (isVertical) {
+      if (thumbsElement.scrollHeight <= thumbnailsWrapperHeight) {
+        setThumbsTranslate(0);
+        setThumbsSwipedTranslate(0);
+        return;
+      }
+      hiddenScroll = thumbsElement.scrollHeight - thumbnailsWrapperHeight;
+    } else {
+      if (thumbsElement.scrollWidth <= thumbnailsWrapperWidth) {
+        setThumbsTranslate(0);
+        setThumbsSwipedTranslate(0);
+        return;
+      }
+      hiddenScroll = thumbsElement.scrollWidth - thumbnailsWrapperWidth;
+    }
+
+    const perIndexScroll = hiddenScroll / (items.length - 1);
+    const newTranslate = -(currentIndex * perIndexScroll);
+
+    setThumbsTranslate(newTranslate);
+    setThumbsSwipedTranslate(newTranslate);
+  }, [
+    thumbnailsWrapperWidth,
+    thumbnailsWrapperHeight,
+    currentIndex,
+    items.length,
+    isSwipingThumbnail,
+    isThumbnailVertical,
+  ]);
+
   // Clean up on unmount
   useEffect(() => {
     return () => {
```

**File**: `src/types.ts` (modified, +2/-0)
```diff
@@ -166,6 +166,8 @@ export interface ImageGalleryProps {
   onErrorImageURL?: string;
   /** Show bullet navigation */
   showBullets?: boolean;
+  /** Maximum number of bullets to show (minimum 3) */
+  maxBullets?: number;
   /** Show fullscreen toggle button */
   showFullscreenButton?: boolean;
   /** Show current/total index indicator */
```

#### Recent Merged Pull Requests:
- **PR #841** (closed): Bump serialize-javascript, terser-webpack-plugin and css-minimizer-webpack-plugin (@dependabot[bot])
- **PR #840** (2026-03-05): Bump svgo from 4.0.0 to 4.0.1 (@dependabot[bot])
- **PR #839** (2026-03-05): Bump minimatch (@dependabot[bot])
- **PR #835** (2026-02-19): Bump qs from 6.14.1 to 6.14.2 (@dependabot[bot])
- **PR #833** (2026-02-19): Bump webpack from 5.97.1 to 5.105.0 (@dependabot[bot])
- **PR #831** (2026-01-31): Bump node-forge from 1.3.1 to 1.3.3 (@dependabot[bot])
- **PR #830** (closed): Bump lodash from 4.17.21 to 4.17.23 (@dependabot[bot])
- **PR #829** (closed): Bump lodash-es from 4.17.21 to 4.17.23 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
