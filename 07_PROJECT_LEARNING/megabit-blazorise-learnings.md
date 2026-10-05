# Forensic Learning Record (Deep Inspection): Megabit/Blazorise

> **Canonical Artifact**: `07_PROJECT_LEARNING/megabit-blazorise-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Megabit/Blazorise](https://github.com/Megabit/Blazorise))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:40:58.124Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Megabit/Blazorise`
- **Description**: Blazorise is a component library built on top of Blazor with support for CSS frameworks like Bootstrap, Tailwind, Bulma, AntDesign, and Material.
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3535 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Source/Blazorise/wwwroot/utilities.js`
```
import "./vendors/jsencrypt.js?v=__BLAZORISE_VERSION__";
import "./vendors/sha512.js?v=__BLAZORISE_VERSION__";

// adds a classname to the specified element
export function addClass(element, classname) {
    if (element && element.classList) {
        element.classList.add(classname);
    }
}

// removes a classname from the specified element
export function removeClass(element, classname) {
    if (element && element.classList && element.classList.contains(classname)) {
        element.classList.remove(classname);
    }
}

// toggles a classname on the given element id
export function toggleClass(element, classname) {
    if (element && element.classList) {
        if (element.classList.contains(classname)) {
            element.classList.remove(classname);
        } else {
            element.classList.add(classname);
        }
    }
}

export function addAttribute(element, attribute, value) {
    if (element) {
        element.setAttribute(attribute, value);
    }
}

export function removeAttribute(element, attribute) {
    if (element) {
        element.removeAttribute(attribute);
    }
}

// adds a classname to the body element
export function addClassToBody(classname) {
    addClass(document.body, classname);
}

// removes a classname from the body element
export function removeClassFromBody(classname) {
    removeClass(document.body, classname);
}

// adds an attribute to the body element
export function addAttributeToBody(attribute, value) {
    addAttribute(document.body, attribute, value);
}

// removes an attribute from the body element
export function removeAttributeFromBody(attribute) {
    removeAttribute(document.body, attribute);
}

// sets the input focuses to the given element
export function focus(element, elementId, scrollToElement) {
    element = getRequiredElement(element, elementId);

    if (element && typeof element.focus === "function") {
        element.focus({
            preventScroll: !scrollToElement
        });
    }
}

// selects the given element
export function select(element, elementId, toFocus) {
    if (toFocus) {
        focus(element, elementId, true);
    }

    element = getRequiredElement(element, elementId);

    if (element && typeof element.select === "function") {
        element.select();
    }
}

// show a browser picker for the supplied input element
export function showPicker(element, elementId) {
    element = getRequiredElement(element, elementId);

    if (element && 'showPicker' in HTMLInputElement.prototype) {
        element.showPicker();
    }
}

export function submitClosestForm(element) {
    const form = element && typeof element.closest === "function"
        ? element.closest("form")
        : null;

    if (!form) {
        return;
    }

    if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
    } else {
        const submitEvent = new Event("submit", { bubbles: true, cancelable: true });

        if (form.dispatchEvent(submitEvent)) {
            form.submit();
        }
    }
}

export function dispatchKeyboardEvent(element, eventName, key, code, keyCode) {
    if (!element) {
        return true;
    }

    const event = new KeyboardEvent(eventName, {
        key: key,
        code: code,
        bubbles: true,
        cancelable: true
    });

    Object.defineProperty(event, "keyCode", { get: () => keyCode });
    Object.defineProperty(event, "which", { get: () => keyCode });

    return element.dispatchEvent(event) && !event.defaultPrevented;
}

export function setCaret(element, caret) {
    if (hasSelectionCapabilities(element)) {
        window.requestAnimationFrame(() => {
            element.selectionStart = caret;
            element.selectionEnd = caret;
        });
    } else if (isNumberInput(element)) {
        numericInputCarets.set(element, caret);
    }
}

export function getCaret(element) {
    return getSelection(element).start;
}

export function getSelection(element) {
    if (isNumberInput(element)) {
        const caret = numericInputCarets.has(element)
            ? numericInputCarets.get(element)
            : `${element.value || ''}`.length;

        return { start: caret, end: caret };
    }

    if (hasSelectionCapabilities(element) &&
        typeof element.selectionStart === 'number' &&
        typeof element.selectionEnd === 'number') {
        return {
            start: element.selectionStart,
            end: element.selectionEnd
        };
    }

    return { start: -1, end: -1 };
}

export function setTextValue(element, value) {
    element.value = value;
}

export function scrollAnchorIntoView(elementId) {
    var element = document.getElementById(elementId);

    if (element) {
        element.scrollIntoView();
        window.location.hash = elementId;
    }
}

export function scrollElementIntoView(elementId, smooth) {
    var element = document.getElementById(elementId);

    if (element) {
        var top;
        if (element.offsetTop < element.parentElement.scrollTop || element.clientHeight > element.parentElement.clientHeight) {
            top = element.offsetTop;
        } else if (element.offsetTop + element.offsetHeight > element.parentElement.scrollTop + element.parentElement.clientHeight) {
            top = element.offsetTop + element.offsetHeight - element.parentElement.clientHeight;
        }

        var scrollableParent = getScrollableParent(element);

        if (scrollableParent) {
            var behavior = smooth ? "smooth" : "instant";
            scrollableParent.scrollTo({ top: top, behavior: behavior });
        }
    }
}

export function scrollElementIntoViewForOnScreenKeyboard(elementId, keyboardElementId, margin) {
    const element = document.getElementById(elementId);
    const keyboardElement = document.getElementById(keyboardElementId);

    if (!element || !keyboardElement) {
        return;
    }

    window.requestAnimationFrame(() => {
        const elementRect = element.getBoundingClientRect();
        const keyboardRect = keyboardElement.getBoundingClientRect();

        if (!elementRect.width || !elementRect.height || !keyboardRect.width || !keyboardRect.height) {
            return;
        }

        const safeMargin = Number.isFinite(margin) ? margin : 12;
        let scrollDelta = 0;

        if (keyboardRect.top > window.innerHeight / 2) {
            const coveredByBottomKeyboard = elementRect.bottom + safeMargin - keyboardRect.top;

            if (coveredByBottomKeyboard > 0) {
                scrollDelta = coveredByBottomKeyboard;
            }
        } else {
            const coveredByTopKeyboard = keyboardRect.bottom + safeMargin - elementRect.top;

            if (coveredByTopKeyboard > 0) {
                scrollDelta = -coveredByTopKeyboard;
            }
        }

        if (!scrollDelta) {
            return;
        }

        const scrollableParent = getScrollableParentForOnScreenKeyboard(element);
        const adjustment = Math.ceil(keyboardRect.height + safeMargin);
        const behavior = prefersReducedMotion() ? "auto" : "smooth";

        applyOnScreenKeyboardScrollAdjustment(scrollableParent, adjustment);

        if (isElementScrollTarget(scrollableParent)) {
            scrollableParent.scrollBy({ top: scrollDelta, behavior: behavior });
        } else {
            getDocumentScrollTarget().scrollBy({ top: scrollDelta, behavior: behavior });
        }
    });
}

export function clearOnScreenKeyboardScrollAdjustment() {
    if (!onScreenKeyboardScrollAdjustmentTarget) {
        return;
    }

    onScreenKeyboardScrollAdjustmentTarget.style.paddingBottom = onScreenKeyboardOriginalPaddingBottom;
    onScreenKeyboardScrollAdjustmentTarget = null;
    onScreenKeyboardOriginalPaddingBottom = null;
    onScreenKeyboardOriginalComputedPaddingBottom = 0;
}

function getScrollableParent(el) {
    while ((el = el.parentElement) && window.getComputedStyle(el).overflowY.indexOf('scroll') === -1);
    return el;
}

function getScrollableParentForOnScreenKeyboard(el) {
    while ((el = el.parentElement) && !isScrollableElement(el));
    return el;
}

function isScrollableElement(element) {
    const style = window.getComputedStyle(element);
    const overflowY = `${style.overflowY} ${style.overflow}`;

    return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
}

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getDocumentScrollTarget() {
    return document.scrollingElement || document.documentElement || document.body;
}

function isElementScrollTarget(element) {
    return element && element !== document.body && element !== document.documentElement && element !== getDocumentScrollTarget();
}

let onScreenKeyboardScrollAdjustmentTarget = null;
let onScreenKeyboardOriginalPaddingBottom = null;
let onScreenKeyboardOriginalComputedPaddingBottom = 0;

function applyOnScreenKeyboardScrollAdjustment(scrollableParent, adjustment) {
    const target = isElementScrollTarget(scrollableParent)
        ? scrollableParent
        : getDocumentScrollTarget();

    if (!target) {
        return;
    }

    if (onScreenKeyboardScrollAdjustmentTarget && onScreenKeyboardScrollAdjustmentTarget !== target) {
        clearOnScreenKeyboardScrollAdjustment();
    }

    if (!onScreenKeyboardScrollAdjustmentTarget) {
        onScreenKeyboardScrollAdjustmentTarget = target;
        onScreenKeyboardOriginalPaddingBottom = target.style.paddingBottom || "";
        onScreenKeyboardOriginalComputedPaddingBottom = parseFloat(window.getComputedStyle(target).paddingBottom) || 0;
    }

    const currentPaddingBottom = parseFloat(window.getComputedStyle(target).paddingBottom) || 0;
    const paddingBottom = Math.max(currentPaddingBottom, onScreenKeyboardOriginalComputedPaddingBottom + adjustment);

    target.style.paddingBottom = `${paddingBottom}px`;
}

// sets the value to the element property
export function setProperty(e
```

### Core Architecture Module: `Source/Extensions/Blazorise.Charts/wwwroot/utilities.js`
```
export function parseFunction(str) {
    try {
        let fn_body_idx = str.indexOf('{'),
            fn_body = str.substring(fn_body_idx + 1, str.lastIndexOf('}')),
            fn_declare = str.substring(0, fn_body_idx),
            fn_params = fn_declare.substring(fn_declare.indexOf('(') + 1, fn_declare.lastIndexOf(')')),
            args = fn_params.split(',');

        args.push(fn_body);

        function Fn() {
            return Function.apply(this, args);
        }

        Fn.prototype = Function.prototype;

        return new Fn();
    }
    catch (error) {
        return null;
    }
}

export function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
```

### Core Architecture Module: `Demos/Shared/Blazorise.Demo/wwwroot/demo.js`
```
window.blazoriseDemo = {
    configureQuillJs: (options) => {
        var link = Quill.import("formats/link");

        link.sanitize = url => {
            let newUrl = window.decodeURIComponent(url);
            newUrl = newUrl.trim().replace(/\s/g, "");

            if (/^(:\/\/)/.test(newUrl)) {
                return `http${newUrl}`;
            }

            if (!/^(f|ht)tps?:\/\//i.test(newUrl)) {
                return `http://${newUrl}`;
            }

            return newUrl;
        }

        // See https://github.com/quilljs/awesome-quill for various modules
        // options.modules.myCustomModule = ...;
    },

    getInputFileUrl: (input, index = 0) => {
        if (!input || input.files.length <= index) {
            return undefined;
        }

        return URL.createObjectURL(input.files[index]);
    }
}
```

### Core Architecture Module: `Demos/Shared/Blazorise.Demo/wwwroot/recaptcha-loader.js`
```
let loadPromise;

export function load() {
    if (globalThis.grecaptcha)
        return Promise.resolve();

    if (loadPromise)
        return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://www.google.com/recaptcha/api.js";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => {
            loadPromise = undefined;
            reject(new Error("Unable to load Google reCAPTCHA."));
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}
```

### Core Architecture Module: `Source/Blazorise.AntDesign/wwwroot/bar.js`
```
function getElement(element) {
    return element ?? null;
}

function applyVerticalPopupPlacement(popup) {
    if (!popup) {
        return;
    }

    popup.style.top = '';

    const viewportMargin = 16;
    const rect = popup.getBoundingClientRect();
    const viewportBottom = window.innerHeight - viewportMargin;
    const overflowBottom = rect.bottom - viewportBottom;

    if (overflowBottom <= 0) {
        return;
    }

    const targetTop = Math.max(viewportMargin, rect.top - overflowBottom);
    const offsetY = targetTop - rect.top;

    popup.style.top = `${offsetY}px`;
}

export function updatePopupPlacement(element, visible) {
    const popup = getElement(element);

    if (!popup) {
        return;
    }

    if (!visible) {
        popup.style.top = '';
        return;
    }

    requestAnimationFrame(() => applyVerticalPopupPlacement(popup));
}

export function resetPopupPlacement(element) {
    const popup = getElement(element);

    if (!popup) {
        return;
    }

    popup.style.top = '';
}
```

### Core Architecture Module: `Source/Blazorise.AntDesign/wwwroot/modal.js`
```
import { scrollModalBodyToTop } from "../Blazorise/modal.js?v=__BLAZORISE_VERSION__";

export function open(element, scrollToTop) {
    scrollModalBodyToTop(element, scrollToTop, ".ant-modal-body");
}

export function close(element) {
    // do nothing
}
```

### Core Architecture Module: `Source/Blazorise.AntDesign/wwwroot/segmented.js`
```
function getElement(element, elementId) {
    if (element) {
        return element;
    }

    if (elementId) {
        return document.getElementById(elementId);
    }

    return null;
}

function syncThumb(root) {
    const group = root?.querySelector('.ant-segmented-group');
    const thumb = group?.querySelector(':scope > .ant-segmented-thumb');
    const selectedItem = group?.querySelector('.ant-segmented-item-selected');

    if (!group || !thumb) {
        return;
    }

    if (!selectedItem) {
        thumb.style.opacity = '0';
        thumb.style.width = '0px';
        thumb.style.height = '0px';
        thumb.style.transform = 'translate3d(0px, 0px, 0px)';
        return;
    }

    const groupRect = group.getBoundingClientRect();
    const itemRect = selectedItem.getBoundingClientRect();
    const colorClass = Array.from(selectedItem.classList).find(x => x.startsWith('ant-segmented-item-'));

    Array.from(thumb.classList)
        .filter(x => x.startsWith('ant-segmented-thumb-'))
        .forEach(x => thumb.classList.remove(x));

    if (colorClass) {
        thumb.classList.add(colorClass.replace('ant-segmented-item-', 'ant-segmented-thumb-'));
    }

    thumb.style.opacity = '1';
    thumb.style.width = `${itemRect.width}px`;
    thumb.style.height = `${itemRect.height}px`;
    thumb.style.transform = `translate3d(${itemRect.left - groupRect.left}px, ${itemRect.top - groupRect.top}px, 0px)`;
}

export function update(element, elementId) {
    const root = getElement(element, elementId);

    if (!root) {
        return;
    }

    requestAnimationFrame(() => syncThumb(root));
}
```

### Core Architecture Module: `Source/Blazorise.AntDesign/wwwroot/wave.js`
```
const waveHandlers = new WeakMap();
const waveCleanupTimers = new WeakMap();

function isValidWaveColor(color) {
    return !!color
        && color !== '#fff'
        && color !== '#ffffff'
        && color !== 'rgb(255, 255, 255)'
        && color !== 'rgba(255, 255, 255, 1)'
        && !/rgba\((?:\d*,\s*){3}0(?:\.0+)?\)/.test(color)
        && color !== 'transparent'
        && color !== 'canvastext';
}

function getTargetWaveColor(node) {
    const style = getComputedStyle(node);
    const colors = [style.borderTopColor, style.borderColor, style.backgroundColor];

    for (const color of colors) {
        if (isValidWaveColor(color)) {
            return color;
        }
    }

    return null;
}

function cleanupWave(target) {
    const currentWave = target.querySelector(':scope > .ant-wave');

    if (currentWave) {
        currentWave.remove();
    }

    const currentTimer = waveCleanupTimers.get(target);

    if (currentTimer) {
        clearTimeout(currentTimer);
        waveCleanupTimers.delete(target);
    }
}

function validateNum(value) {
    return Number.isNaN(value) ? 0 : value;
}

function showWave(root, targetSelector) {
    const target = targetSelector
        ? root.querySelector(targetSelector) || root
        : root;

    if (!target) {
        return;
    }

    if (target.hasAttribute('disabled')
        || target.getAttribute('aria-disabled') === 'true'
        || target.className?.includes('disabled')) {
        return;
    }

    cleanupWave(target);

    target.classList.add('ant-wave-host');

    const wave = document.createElement('div');
    const waveColor = getTargetWaveColor(target);
    const targetStyle = getComputedStyle(target);
    const isSmallTarget = target.classList.contains('ant-wave-target');
    const isStatic = targetStyle.position === 'static';
    const borderLeftWidth = validateNum(Number.parseFloat(targetStyle.borderLeftWidth));
    const borderTopWidth = validateNum(Number.parseFloat(targetStyle.borderTopWidth));

    wave.className = `ant-wave${isSmallTarget ? ' ant-wave-quick' : ''}`;
    wave.style.left = `${isStatic ? target.offsetLeft : -borderLeftWidth}px`;
    wave.style.top = `${isStatic ? target.offsetTop : -borderTopWidth}px`;
    wave.style.width = `${target.offsetWidth}px`;
    wave.style.height = `${target.offsetHeight}px`;
    wave.style.borderRadius = [
        targetStyle.borderTopLeftRadius,
        targetStyle.borderTopRightRadius,
        targetStyle.borderBottomRightRadius,
        targetStyle.borderBottomLeftRadius,
    ].join(' ');

    if (waveColor) {
        wave.style.setProperty('--ant-wave-color', waveColor);
    }

    target.insertBefore(wave, target.firstChild);

    requestAnimationFrame(() => {
        wave.classList.add('ant-wave-motion-appear');

        requestAnimationFrame(() => {
            wave.classList.add('ant-wave-motion-appear-active');
        });
    });

    const removeWave = () => cleanupWave(target);

    wave.addEventListener('transitionend', removeWave, { once: true });

    const cleanupTimer = setTimeout(removeWave, isSmallTarget ? 500 : 2200);
    waveCleanupTimers.set(target, cleanupTimer);
}

export function initialize(element, targetSelector) {
    if (!element || waveHandlers.has(element)) {
        return;
    }

    const handler = () => showWave(element, targetSelector);
    element.addEventListener('click', handler, true);
    waveHandlers.set(element, handler);
}

export function destroy(element) {
    if (!element) {
        return;
    }

    const handler = waveHandlers.get(element);

    if (handler) {
        element.removeEventListener('click', handler, true);
        waveHandlers.delete(element);
    }
}
```

### Core Architecture Module: `Source/Blazorise.Bootstrap/wwwroot/modal.js`
```
import { addClassToBody, removeClassFromBody } from "../Blazorise/utilities.js?v=__BLAZORISE_VERSION__";
import { adjustDialogDimensionsBeforeShow, closeStackedModal, openStackedModal, registerModalDisconnectCleanup, resetAdjustments, unregisterModalDisconnectCleanup } from "../Blazorise/modal.js?v=__BLAZORISE_VERSION__";

const modalAdjustmentSelectors = {
    fixedContentSelector: ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top",
    stickyContentSelector: ".sticky-top"
};

export function open(element, scrollToTop) {
    registerModalDisconnectCleanup(element, () => closeCore(element));

    openStackedModal(element, {
        beforeOpen: (modalElement) => adjustDialogDimensionsBeforeShow(modalElement, modalAdjustmentSelectors),
        onFirstModalOpen: () => addClassToBody("modal-open"),
        scrollToTop: scrollToTop,
        bodySelector: ".modal-body"
    });
}

export function close(element) {
    unregisterModalDisconnectCleanup(element);
    closeCore(element);
}

function closeCore(element) {
    closeStackedModal(element, {
        onLastModalClose: () => removeClassFromBody("modal-open"),
        afterClose: (modalElement) => resetAdjustments(modalElement, modalAdjustmentSelectors)
    });
}
```

### Core Architecture Module: `Source/Blazorise.Bootstrap5/wwwroot/modal.js`
```
import { addClassToBody, removeClassFromBody } from "../Blazorise/utilities.js?v=__BLAZORISE_VERSION__";
import { adjustDialogDimensionsBeforeShow, closeStackedModal, openStackedModal, registerModalDisconnectCleanup, resetAdjustments, unregisterModalDisconnectCleanup } from "../Blazorise/modal.js?v=__BLAZORISE_VERSION__";

const modalAdjustmentSelectors = {
    fixedContentSelector: ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top",
    stickyContentSelector: ".sticky-top"
};

export function open(element, scrollToTop) {
    registerModalDisconnectCleanup(element, () => closeCore(element));

    openStackedModal(element, {
        beforeOpen: (modalElement) => adjustDialogDimensionsBeforeShow(modalElement, modalAdjustmentSelectors),
        onFirstModalOpen: () => {
            const originalOverflow = document.body.style.overflow || '';
            document.body.setAttribute('data-original-overflow', originalOverflow);
            document.body.style.overflow = 'hidden';
            addClassToBody("modal-open");
        },
        scrollToTop: scrollToTop,
        bodySelector: ".modal-body"
    });
}

export function close(element) {
    unregisterModalDisconnectCleanup(element);
    closeCore(element);
}

function closeCore(element) {
    closeStackedModal(element, {
        onLastModalClose: () => {
            document.body.style.overflow = document.body.getAttribute('data-original-overflow') || '';
            document.body.removeAttribute('data-original-overflow');
            removeClassFromBody("modal-open");
        },
        afterClose: (modalElement) => resetAdjustments(modalElement, modalAdjustmentSelectors)
    });
}
```

### Core Architecture Module: `Source/Blazorise.Bulma/wwwroot/modal.js`
```
import { scrollModalBodyToTop } from "../Blazorise/modal.js?v=__BLAZORISE_VERSION__";

export function open(element, scrollToTop) {
    scrollModalBodyToTop(element, scrollToTop, ".modal-card-body");
}

export function close(element) {
}
```

### Core Architecture Module: `Source/Blazorise.FluentUI2/wwwroot/modal.js`
```
import { addClassToBody, removeClassFromBody } from "../Blazorise/utilities.js?v=__BLAZORISE_VERSION__";
import { adjustDialogDimensionsBeforeShow, closeStackedModal, openStackedModal, registerModalDisconnectCleanup, resetAdjustments, unregisterModalDisconnectCleanup } from "../Blazorise/modal.js?v=__BLAZORISE_VERSION__";

const modalAdjustmentSelectors = {
    fixedContentSelector: ".fixed-top, .fixed-bottom, .is-fixed, .sticky-top",
    stickyContentSelector: ".sticky-top"
};

export function open(element, scrollToTop) {
    registerModalDisconnectCleanup(element, () => closeCore(element));

    openStackedModal(element, {
        beforeOpen: (modalElement) => adjustDialogDimensionsBeforeShow(modalElement, modalAdjustmentSelectors),
        onFirstModalOpen: () => addClassToBody("modal-open"),
        scrollToTop: scrollToTop,
        bodySelector: ".modal-body"
    });
}

export function close(element) {
    unregisterModalDisconnectCleanup(element);
    closeCore(element);
}

function closeCore(element) {
    closeStackedModal(element, {
        onLastModalClose: () => removeClassFromBody("modal-open"),
        afterClose: (modalElement) => resetAdjustments(modalElement, modalAdjustmentSelectors)
    });
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6835** (2026-10-05): **Chore: add a net11 prefered build**
  *Symptoms*: 

- **Issue #6834** (2026-10-05): **Dropdown: preserve outside-click closing when other dropdowns are cre…**
  *Symptoms*: Closes #6833  Creating closed dropdowns while another dropdown was open could remove the open dropdown’s closable registration, leaving it unable to close on outside clicks. New toggles requested unregistering before they had registered, and the JavaScript lookup returned `null` for missing entries. The unregister check accepted that value, causing `splice(null, 1)` to remove the first registration.  Both closable lookup functions now return `-1` when an entry is missing, matching the existing unregister checks. DropdownToggle also checks `jsRegistered` before requesting unregistering. The existing dropdown test now asserts that initial rendering does not unregister and that closing does.

- **Issue #6833** (2026-10-05): **[Bug]: Dropdown no longer closes on outside click after other dropdowns are created (closable.js removes wrong entry)**
  *Symptoms*: ### Blazorise Version   2.3.3  ### What Blazorise provider are you running on?  Bootstrap5  ### Link to minimal reproduction or a simple code snippet    To reproduce  Minimal demo project: [https://github.com/PeterBurenkov/BlazoriseDropdownCloseBugDemo](https://github.com/PeterBurenkov/BlazoriseDropdownCloseBugDemo)  Or paste this into a page:  ```razor <Dropdown>     <DropdownToggle>Filter</DropdownToggle>     <DropdownMenu>         @foreach (var v in new[] { "Option A", "Option B", "Option C" })         {             <DropdownItem ShowCheckbox                           Checked="@selected.Contains(v)"                           CheckedChanged="@((bool _) => Toggle(v))">@v</DropdownItem>         }     </DropdownMenu> </Dropdown>  @foreach (var row in rows) {     <div @key="row">         @row         <Dropdown>             <DropdownToggle>More</DropdownToggle>             <DropdownMenu><DropdownItem>Action</DropdownItem></DropdownMenu>         </Dropdown>     </div> }  @code {     HashSet<string> selected = new();     List<Guid> rows = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();      void Toggle(string v)     {         if (!selected.Remove(v)) selected.Add(v);         // Simulate a data reload: rows get new keys, so new row dropdowns are created         rows = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToList();     } } ```  1. Open the **Filter** dropdown. 2. Tick a value. 3. Click outside the dropdown.  Without the per-row dropdowns, the filter closes
  **Post-Mortem & Fix Analysis**:
  > Fixed for 2.3.4. But as it stands the 2.4 will probably come sooner. Next week.  PS. thanks for the detailed report. It helped a lot.

- **Issue #6832** (2026-10-05): **ColorPicker: add ShowValue support across providers**
  *Symptoms*: Added a non-nullable `ShowValue` parameter that defaults to `true`. Setting it to `false` hides the selected color value while keeping the swatch visible. Bootstrap 4, Bootstrap 5, and Bulma now also display the value when enabled.  Updated each provider’s styling and replaced ColorPicker’s shared `b-*` classes with names that follow the provider’s conventions. Tailwind uses utility classes only. Hiding the value preserves the picker’s existing full width and the swatch’s left alignment.  Fixed the picker’s JavaScript callback to request a Blazor render after updating the value. Tailwind relies on Razor to render its swatch, so palette selections previously appeared only after another interaction triggered a render.

- **Issue #6831** (2026-10-04): **Build: Centralize asset versioning and move generated documentation to obj**
  *Symptoms*: `Blazorise.Version.props` is now the single source for package and asset versions. During builds, placeholders in JavaScript imports and static HTML references are replaced in generated copies under `obj` before static asset processing and packaging. Razor links use VersionProvider. A package version of 2.4.0 produces `?v=2.4.0.0`, while a four-part version retains its revision.  Documentation generation now writes example HTML, copyable snippets, API documentation, and search indexes under obj. The docs application embeds those outputs, and MCP consumes the generated indexes. Obsolete generated files were removed from the source tree, so release version changes no longer create generated documentation diffs.  WebAssembly and server applications were manually verified. Regression scripts were added for asset versioning and documentation generation; the reported asset test run passed both version cases through packaging and publishing, with the final check pending a rerun after correcting its PowerShell argument.

- **Issue #6829** (2026-10-02): **Chore: Clean up component internals and remove obsolete picker interop**
  *Symptoms*: Remove obsolete picker JavaScript and C# interop, reduce redundant state and duplicated logic, and simplify DataGrid and Autocomplete rendering and event handling. Align formatting conventions and remove obsolete test setup while preserving test cases and assertions.

- **Issue #6828** (2026-10-02): **Chore: Add .NET 11 RC1 support**
  *Symptoms*: Adds .NET 11 alongside existing library targets and upgrades demos, docs, tests, and MAUI to .NET 11. Updates package versions, CI, publish profiles, and applicable language settings to `latest`.

- **Issue #6827** (2026-10-01): **Docs: clarify API defaults and improve table readability**
  *Symptoms*: The API generator now reads `Defaults to <c>value</c>.` from XML summaries. Documented defaults override inferred values and appear in the Default column, while the generator removes the sentence from the API description to avoid repetition. The sentence remains available in IntelliSense.  Updated comments for defaults resolved through runtime logic. Template and delegate defaults now use short labels such as “Built-in template” and “Always true,” with their behavior explained in remarks.  API tables now place each description below its member’s metadata, separated by a dashed divider. Parameters, events, and methods share this layout, preserving existing colors and expandable remarks.

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

### Incident Patch 1: `6d437da5` (2026-10-05)
**Commit Message**: Chore: add a net11 prefered build (#6835)

**File**: `Blazorise.slnx` (modified, +6/-0)
```diff
@@ -1,4 +1,9 @@
 <Solution>
+  <Configurations>
+    <BuildType Name="Debug" />
+    <BuildType Name="DebugNet11" />
+    <BuildType Name="Release" />
+  </Configurations>
   <Folder Name="/Demos/">
     <Project Path="Demos/Blazorise.Demo.AntDesign/Blazorise.Demo.AntDesign.csproj" />
     <Project Path="Demos/Blazorise.Demo.Bootstrap.Server/Blazorise.Demo.Bootstrap.Server.csproj" />
@@ -39,6 +44,7 @@
     <File Path=".runsettings" />
     <File Path="AGENTS.md" />
     <File Path="CREDITS.md" />
+    <File Path="Directory.Build.props" />
     <File Path="Directory.Packages.props" />
     <File Path="DotnetWatchRunAll.bat" />
     <File Path="README.md" />
```

**File**: `Build/Blazorise.Client.props` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
 
 	<PropertyGroup>
-		<TargetFramework>net11.0</TargetFramework>
+		<TargetFramework>$(PrimaryTargetFramework)</TargetFramework>
 		<OutputType>Exe</OutputType>
 		<LangVersion>latest</LangVersion>
 	</PropertyGroup>
```

**File**: `Build/Blazorise.Demo.props` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 ﻿<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
 
 	<PropertyGroup>
-		<TargetFramework>net11.0</TargetFramework>
+		<TargetFramework>$(PrimaryTargetFramework)</TargetFramework>
 		<OutputType>Library</OutputType>
 		<IsPackable>true</IsPackable>
 		<LangVersion>latest</LangVersion>
```

**File**: `Build/Blazorise.Docs.props` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   <Import Project="Blazorise.Version.props" />
 
 	<PropertyGroup>
-		<TargetFramework>net11.0</TargetFramework>
+		<TargetFramework>$(PrimaryTargetFramework)</TargetFramework>
 		<OutputType>Library</OutputType>
 		<IsPackable>true</IsPackable>
 		<LangVersion>latest</LangVersion>
```

**File**: `Build/Blazorise.Server.RC.props` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 ﻿<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
 
 	<PropertyGroup>
-		<TargetFramework>net11.0</TargetFramework>
+		<TargetFramework>$(PrimaryTargetFramework)</TargetFramework>
 		<LangVersion>latest</LangVersion>
 		<AddRazorSupportForMvc>true</AddRazorSupportForMvc>
 		<RequiresAspNetWebAssets>true</RequiresAspNetWebAssets>
```

**File**: `Build/Blazorise.Server.props` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 ﻿<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
 
 	<PropertyGroup>
-		<TargetFramework>net11.0</TargetFramework>
+		<TargetFramework>$(PrimaryTargetFramework)</TargetFramework>
 		<LangVersion>latest</LangVersion>
 	</PropertyGroup>
 
```

**File**: `Build/Blazorise.props` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@
     <AddRazorSupportForMvc>true</AddRazorSupportForMvc>
   </PropertyGroup>
 
+  <PropertyGroup Condition="'$(Configuration)' == 'DebugNet11'">
+    <TargetFrameworks>$(PrimaryTargetFramework)</TargetFrameworks>
+  </PropertyGroup>
+
   <ItemGroup>
     <SupportedPlatform Include="browser" />
   </ItemGroup>
```

**File**: `Demos/Blazorise.Demo.MAUI/Blazorise.Demo.MAUI.csproj` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 <Project Sdk="Microsoft.NET.Sdk.Razor">
 
   <PropertyGroup>
-    <!--<TargetFrameworks>net11.0-android;net11.0-ios;net11.0-maccatalyst</TargetFrameworks>-->
-    <!--<TargetFrameworks>net11.0-android;</TargetFrameworks>-->
-    <TargetFrameworks Condition="$([MSBuild]::IsOSPlatform('windows'))">$(TargetFrameworks);net11.0-windows10.0.19041.0</TargetFrameworks>
+    <!--<TargetFrameworks>$(PrimaryTargetFramework)-android;$(PrimaryTargetFramework)-ios;$(PrimaryTargetFramework)-maccatalyst</TargetFrameworks>-->
+    <!--<TargetFrameworks>$(PrimaryTargetFramework)-android;</TargetFrameworks>-->
+    <TargetFrameworks Condition="$([MSBuild]::IsOSPlatform('windows'))">$(TargetFrameworks);$(PrimaryTargetFramework)-windows10.0.19041.0</TargetFrameworks>
     <!-- Uncomment to also build the tizen app. You will need to install tizen by following this: https://github.com/Samsung/Tizen.NET -->
     <!-- <TargetFrameworks>$(TargetFrameworks);net6.0-tizen</TargetFrameworks> -->
     <OutputType>Exe</OutputType>
```

---

### Incident Patch 2: `0f4ef25a` (2026-10-04)
**Commit Message**: Build: Centralize asset versioning and move generated documentation to obj (#6831)

* auto generate blazorise versions

* remove old generated files

* fix server error

* tests

* delete old pack file

* add package version

* tests

* optimize search data generation

* fix missing versions

* update readme

* remove newtonsoft

* improve docs compiler

* fix generator

**File**: `AGENTS.md` (modified, +5/-5)
```diff
@@ -8,9 +8,9 @@
 - `Demos/`: runnable sample apps for each supported UI provider.
 - `Documentation/`: docs site source, generator, and server (`Documentation/Blazorise.Docs.Server`).
 - `NuGet/`: local packaging helpers/scripts (not the source of truth for versions).
-- Docs snippets (`Documentation/Blazorise.Docs/Models/Snippets*.cs`) are generated artifacts: do not touch any snippet files during AI work (do not create new ones like `Snippets.*.cs`), and avoid incidental diffs from running the docs build.
-- `Documentation/Blazorise.Docs/ApiDocs/Blazorise.ApiDocs.cs` is generated: do not edit or touch this file with AI/Codex.
-- `Documentation/Blazorise.Docs/Models/Snippets.generated.cs`, `Documentation/Blazorise.Docs/Resources/docs-index.json`, and `Documentation/Blazorise.Docs/Resources/docs-api-index.json` are generated automatically by docs tooling; incidental changes to these files are expected and should be ignored by AI agents unless explicitly requested otherwise.
+- Generated documentation (example HTML, `Snippets.generated.cs`, API documentation, and search indexes) belongs under each project's `obj/<configuration>/<framework>/DocsGenerated/` directory, with a runtime identifier when applicable. Do not edit generated outputs or recreate the former source-tree artifacts.
+- Maintain documentation examples in their handwritten `.razor`, `.snippet`, and `.csharp` sources. `Documentation/Blazorise.Docs/Models/Snippets.cs` is the handwritten helper, not a generated artifact.
+- Blog HTML uses a separate workflow; do not remove it as part of compiler-generated example cleanup.
 
 ## Build, Test, and Development Commands
 
@@ -47,13 +47,13 @@ Blazorise is a large multi-project repository. Unsolicited command execution:
 
 ---
 
-CI builds with .NET SDK `10.0.x`. From the repo root:
+CI builds with .NET SDK `11.0.100-rc.1.26425.128`. From the repo root:
 
 ```powershell
 dotnet restore
 dotnet build -c Release --no-restore
 dotnet test .\Tests\Blazorise.Tests\Blazorise.Tests.csproj -c Release --no-build
-pwsh .\Tests\Blazorise.E2E.Tests\bin\Release\net10.0\playwright.ps1 install --with-deps
+pwsh .\Tests\Blazorise.E2E.Tests\bin\Release\net11.0\playwright.ps1 install --with-deps
 dotnet test .\Tests\Blazorise.E2E.Tests\Blazorise.E2E.Tests.csproj -c Release --no-build
 ```
 
```

**File**: `Build/Blazorise.Assets.targets` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+<Project>
+  <Import Project="Blazorise.Version.props" Condition="'$(BlazoriseVersion)' == ''" />
+
+  <UsingTask TaskName="Blazorise.Build.GenerateVersionedAssets"
+             TaskFactory="RoslynCodeTaskFactory"
+             AssemblyFile="$(MSBuildToolsPath)/Microsoft.Build.Tasks.Core.dll">
+    <Task>
+      <Code Type="Class" Language="cs" Source="$(MSBuildThisFileDirectory)Tasks/GenerateVersionedAssets.cs" />
+    </Task>
+  </UsingTask>
+
+  <ItemGroup>
+    <UpToDateCheckInput Include="$(MSBuildThisFileDirectory)Blazorise.Version.props;$(MSBuildThisFileFullPath);$(MSBuildThisFileDirectory)Tasks/GenerateVersionedAssets.cs" />
+    <Watch Include="$(MSBuildThisFileDirectory)Blazorise.Version.props" />
+  </ItemGroup>
+
+  <!-- Replace Content items before the SDK discovers, fingerprints, compresses, or packs them.
+       Run on every build so command-line version changes and removed tokens are respected;
+       the task writes an output only when its contents change. -->
+  <Target Name="GenerateBlazoriseVersionedAssets"
+          BeforeTargets="ResolveProjectStaticWebAssets"
+          Condition="'$(DesignTimeBuild)' != 'true' and '$(NoBuild)' != 'true' and '$(TargetFramework)' != '' and Exists('$(MSBuildProjectDirectory)/wwwroot')">
+    <GetAssemblyVersion NuGetVersion="$(BlazoriseVersion)">
+      <Output TaskParameter="AssemblyVersion" PropertyName="BlazoriseAssetVersion" />
+    </GetAssemblyVersion>
+
+    <PropertyGroup>
+      <BlazoriseAssetVersion Condition="$([System.Version]::Parse('$(BlazoriseAssetVersion)').Revision) == -1">$(BlazoriseAssetVersion).0</BlazoriseAssetVersion>
+      <_BlazoriseAssetOutputPath>$([MSBuild]::NormalizeDirectory('$(MSBuildProjectDirectory)', '$(IntermediateOutputPath)', 'blazorise-assets', '$(BlazoriseAssetVersion)', 'wwwroot'))</_BlazoriseAssetOutputPath>
+    </PropertyGroup>
+
+    <Blazorise.Build.GenerateVersionedAssets Condition="'@(Content)' != ''"
+                                            SourceFiles="@(Content)"
+                                            SourceRoot="$(MSBuildProjectDirectory)/wwwroot"
+                                            OutputRoot="$(_BlazoriseAssetOutputPath)"
+                                            AssetVersion="$(BlazoriseAssetVersion)">
+      <Output TaskParameter="OriginalFiles" ItemName="_BlazoriseAssetOriginalFiles" />
+      <Output TaskParameter="GeneratedFiles" ItemName="_BlazoriseAssetGeneratedFiles" />
+    </Blazorise.Build.GenerateVersionedAssets>
+
+    <ItemGroup>
+      <Content Remove="@(_BlazoriseAssetOriginalFiles)" />
+      <Content Include="@(_BlazoriseAssetGeneratedFiles)" />
+      <FileWrites Include="@(_BlazoriseAssetGeneratedFiles)" />
+    </ItemGroup>
+  </Target>
+</Project>
\ No newline at end of file
```

**File**: `Build/Blazorise.Docs.Generation.targets` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+<Project>
+  <Import Project="Blazorise.Version.props" Condition="'$(BlazoriseVersion)' == ''" />
+
+  <PropertyGroup>
+    <GenerateDocs Condition="'$(GenerateDocs)' == ''">true</GenerateDocs>
+    <RegenerateDocsExamples Condition="'$(RegenerateDocsExamples)' == ''">false</RegenerateDocsExamples>
+    <GenerateDocsSearchDataOnly Condition="'$(GenerateDocsSearchDataOnly)' == ''">false</GenerateDocsSearchDataOnly>
+    <_DocsCompilerProject>$(MSBuildThisFileDirectory)../Documentation/Blazorise.Docs.Compiler/Blazorise.Docs.Compiler.csproj</_DocsCompilerProject>
+    <_DocsCompilerDirectory>$(MSBuildThisFileDirectory)../Documentation/Blazorise.Docs.Compiler</_DocsCompilerDirectory>
+    <_DocsSourceDirectory>$(MSBuildThisFileDirectory)../Documentation/Blazorise.Docs</_DocsSourceDirectory>
+    <_DocsCompilerGlobalPropertiesToRemove>TargetFramework;RuntimeIdentifier;RuntimeIdentifiers;SelfContained;PublishSelfContained;PublishSingleFile;PublishAot</_DocsCompilerGlobalPropertiesToRemove>
+  </PropertyGroup>
+
+  <ItemGroup>
+    <UpToDateCheckInput Include="$(MSBuildThisFileDirectory)Blazorise.Version.props;$(MSBuildThisFileFullPath);$(_DocsSourceDirectory)/Pages/**/*.razor;$(_DocsSourceDirectory)/Pages/**/*.snippet;$(_DocsSourceDirectory)/Pages/**/*.csharp" />
+    <UpToDateCheckInput Include="$(_DocsCompilerProject);$(_DocsCompilerDirectory)/**/*.cs;$(_DocsSourceDirectory)/**/*.cs;$(MSBuildThisFileDirectory)../Source/Blazorise/**/*.cs;$(MSBuildThisFileDirectory)../Source/Extensions/Blazorise.*/**/*.cs"
+                       Exclude="**/bin/**;**/obj/**;**/__SOURCEGENERATED__/**;$(MSBuildThisFileDirectory)../Source/Extensions/Blazorise.Icons*/**/*" />
+    <!-- Restore traverses this build-tool dependency. It is not an application reference,
+         so skip framework negotiation and executable compatibility validation. -->
+    <ProjectReference Include="$(_DocsCompilerProject)" Condition="'$(GenerateDocs)' == 'true' and '$(ProjectDocsCompiler)' == ''"
+                      ReferenceOutputAssembly="false" BuildReference="false" PrivateAssets="all"
+                      SkipGetTargetFrameworkProperties="true"
+                      GlobalPropertiesToRemove="$(_DocsCompilerGlobalPropertiesToRemove)" />
+  </ItemGroup>
+
+  <!-- Resolve this during target execution, after the SDK has added the framework and RID. -->
+  <Target Name="InitializeDocsGeneration">
+    <PropertyGroup>
+      <DocsGeneratedOutputPath Condition="'$(DocsGeneratedOutputPath)' == ''">$([MSBuild]::NormalizePath('$(MSBuildProjectDirectory)', '$(IntermediateOutputPath)', 'DocsGenerated'))</DocsGeneratedOutputPath>
+      <ApiDocsIntermediatePath Condition="'$(ApiDocsIntermediatePath)' == ''">$(DocsGeneratedOutputPath)/ApiDocs</ApiDocsIntermediatePath>
+    </PropertyGroup>
+  </Target>
+
+  <Target Name="BuildDocsCompiler"
+          Condition="'$(DesignTimeBuild)' != 'true' and '$(NoBuild)' != 'true' and '$(GenerateDocs)' == 'true' and '$(ProjectDocsCompiler)' == ''">
+    <!-- MSBuild shares this build between Docs and MCP; no nested restore or CLI build. -->
+    <MSBuild Projects="$(_DocsCompilerProject)" Targets="Build"
+             Properties="Configuration=$(Configuration);BlazoriseVersion=$(BlazoriseVersion)" RemoveProperties="$(_DocsCompilerGlobalPropertiesToRemove)">
+      <Output TaskParameter="TargetOutputs" ItemName="_DocsCompilerOutput" />
+    </MSBuild>
+    <PropertyGroup>
+      <ProjectDocsCompiler>dotnet &quot;@(_DocsCompilerOutput->'%(FullPath)')&quot;</ProjectDocsCompiler>
+    </PropertyGroup>
+    <Error Condition="'@(_DocsCompilerOutput)' == ''" Text="The documentation compiler did not produce an assembly." />
+  </Target>
+
+  <Target Name="CompileDocs" BeforeTargets="BeforeBuild" DependsOnTargets="InitializeDocsGeneration;BuildDocsCompiler"
+          Condition="'$(DesignTimeBuild)' != 'true' and '$(NoBuild)' != 'true' and '$(GenerateDocs)' == 'true'">
+    <Message Text="Generating documentation in $(DocsGeneratedOutputPath)" Importance="high" />
+    <Exec WorkingDirectory="$(_DocsSourceDirectory)"
+          Command="$(ProjectDocsCompiler) --output-path &quot;$(DocsGeneratedOutputPath)&quot; --api-docs-path &quot;$(ApiDocsIntermediatePath)&quot; --regenerate-examples &quot;$(RegenerateDocsExamples)&quot; --search-data-only &quot;$(GenerateDocsSearchDataOnly)&quot;" />
+  </Target>
+</Project>
\ No newline at end of file
```

**File**: `Build/Blazorise.Docs.props` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 ﻿<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
+  <Import Project="Blazorise.Version.props" />
 
 	<PropertyGroup>
 		<TargetFramework>net11.0</TargetFramework>
```

**File**: `Build/Blazorise.Server.RC.props` (modified, +0/-4)
```diff
@@ -7,8 +7,4 @@
 		<RequiresAspNetWebAssets>true</RequiresAspNetWebAssets>
 	</PropertyGroup>
 
-	<ItemGroup>
-		<PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" />
-	</ItemGroup>
-
 </Project>
\ No newline at end of file
```

**File**: `Build/Blazorise.Server.props` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@
 
 	<ItemGroup>
 		<PackageReference Include="Microsoft.AspNetCore.Components.WebAssembly.Server" />
-		<PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" />
 	</ItemGroup>
 
 </Project>
\ No newline at end of file
```

**File**: `Build/Blazorise.props` (modified, +1/-87)
```diff
@@ -46,91 +46,5 @@
     <PackageReference Include="Microsoft.Extensions.Logging.Abstractions" />
   </ItemGroup>
 
-  <UsingTask
-	  TaskName="ReplaceVersionInJsFiles"
-	  TaskFactory="RoslynCodeTaskFactory"
-	  AssemblyFile="$(MSBuildToolsPath)\Microsoft.Build.Tasks.Core.dll">
-    <ParameterGroup>
-      <SourceFiles ParameterType="Microsoft.Build.Framework.ITaskItem[]" Required="true" />
-      <Version ParameterType="System.String" Required="true" />
-    </ParameterGroup>
-    <Task>
-      <Using Namespace="System"/>
-      <Using Namespace="System.IO"/>
-      <Using Namespace="System.Text.RegularExpressions" />
-      <Code Type="Fragment" Language="cs">
-        <![CDATA[  
-				Log.LogMessage(MessageImportance.High, $"------ Custom Build Step : ReplaceVersionInJsFiles : [{SourceFiles.Count()}] files ------");
-				
-				var matchExpression = @"\?v=[A-Za-z0-9_.-]+";
-				var expectedVersion = string.Empty;
-				try {
-					var versionMatch = Regex.Match(Version ?? string.Empty, @"^\d+(\.\d+){0,3}");
-					if (!versionMatch.Success)
-					{
-						Log.LogMessage(MessageImportance.High, $"------ Custom Build Step : ReplaceVersionInJsFiles : Unable to resolve version : [{Version}] ------");
-						return false;
-					}
-
-					string[] versionGroups = versionMatch.Value.Split('.');
-					expectedVersion = string.Empty;
-					for (int i = 0; i < 4; i++)
-					{
-						if (i > 0)
-						{
-							expectedVersion += ".";
-						}
-					
-						if (versionGroups.Length > i)
-						{
-							expectedVersion += versionGroups[i];
-						}
-						else
-						{
-							expectedVersion += "0";
-						}
-					}
-				}
-				catch (Exception ex)
-				{
-					Log.LogMessage(MessageImportance.High, $"------ Custom Build Step : ReplaceVersionInJsFiles : Unable to resolve version : Exception : [{ex.Message}] ------");
-					return false;
-				}
-				
-				var replacementText = $"?v={expectedVersion}";
-				
-				Log.LogMessage(MessageImportance.High, $"------ Custom Build Step : ReplaceVersionInJsFiles : Match : [{matchExpression}] | Replace : [{replacementText}] ------");
-				try {
-					foreach (ITaskItem item in SourceFiles)
-					{
-						string fileName = item.ItemSpec;
-						Log.LogMessage(MessageImportance.High, "------ Custom Build Step : ReplaceVersionInJsFiles : Evaluating File '{0}'.", fileName);
-		
-						var fileContent = File.ReadAllText(fileName);
-						var regexMatch = Regex.Match(fileContent, matchExpression);
-					    if (regexMatch.Success && regexMatch.Value != replacementText)
-						{
-							Log.LogMessage(MessageImportance.High, "------ Custom Build Step : ReplaceVersionInJsFiles : Updating File '{0}'.", fileName);
-							File.WriteAllText(fileName, Regex.Replace(File.ReadAllText(fileName), matchExpression, replacementText).Trim());
-						}
-					}
-				}
-				catch (Exception ex)
-				{
-					Log.LogMessage(MessageImportance.High, $"------ Custom Build Step : ReplaceVersionInJsFiles : Exception : [{ex.Message}] ------");
-				}
-        ]]>
-      </Code>
-    </Task>
-  </UsingTask>
-
-  <Target Name="BeforeBuildStep" BeforeTargets="Build">
-    <ItemGroup>
-      <JsFiles Include='wwwroot\*.js' />
-    </ItemGroup>
-
-    <ReplaceVersionInJsFiles
-		   SourceFiles="@(JsFiles)"
-		   Version="$(Version)" />
-  </Target>
+  <Import Project="Blazorise.Assets.targets" />
 </Project>
\ No newline at end of file
```

**File**: `Build/Tasks/GenerateVersionedAssets.cs` (added, +120/-0)
```diff
@@ -0,0 +1,120 @@
+#region Using directives
+using System;
+using System.Collections.Generic;
+using System.IO;
+using System.Text;
+using Microsoft.Build.Framework;
+using Microsoft.Build.Utilities;
+#endregion
+
+namespace Blazorise.Build
+{
+    /// <summary>
+    /// Generates static assets with the release version without modifying their sources.
+    /// </summary>
+    public class GenerateVersionedAssets : Task
+    {
+        #region Members
+
+        private const string VersionToken = "__BLAZORISE_VERSION__";
+
+        #endregion
+
+        #region Methods
+
+        public override bool Execute()
+        {
+            var originalFiles = new List<ITaskItem>();
+            var generatedFiles = new List<ITaskItem>();
+
+            try
+            {
+                var sourceRoot = Path.GetFullPath( SourceRoot ).TrimEnd( Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar ) + Path.DirectorySeparatorChar;
+                var outputRoot = Path.GetFullPath( OutputRoot ).TrimEnd( Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar ) + Path.DirectorySeparatorChar;
+                var pathComparison = Path.DirectorySeparatorChar == '\\' ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
+                var version = Version.Parse( AssetVersion ).ToString( 4 );
+
+                foreach ( var source in SourceFiles )
+                {
+                    var sourcePath = source.GetMetadata( "FullPath" );
+
+                    if ( !sourcePath.StartsWith( sourceRoot, pathComparison ) || !IsTextAsset( sourcePath ) )
+                    {
+                        continue;
+                    }
+
+                    var text = File.ReadAllText( sourcePath );
+
+                    if ( !text.Contains( VersionToken ) )
+                    {
+                        continue;
+                    }
+
+                    var relativePath = sourcePath.Substring( sourceRoot.Length );
+                    var outputPath = Path.Combine( outputRoot, relativePath );
+                    var generatedText = text.Replace( VersionToken, version );
+
+                    if ( generatedText.Contains( VersionToken ) )
+                    {
+                        Log.LogError( "Unresolved Blazorise asset version in '{0}'.", sourcePath );
+                        return false;
+                    }
+
+                    if ( !File.Exists( outputPath ) || File.ReadAllText( outputPath ) != generatedText )
+                    {
+                        Directory.CreateDirectory( Path.GetDirectoryName( outputPath ) );
+                        File.WriteAllText( outputPath, generatedText, new UTF8Encoding( false ) );
+                    }
+
+                    var generatedFile = new TaskItem( source );
+                    generatedFile.ItemSpec = outputPath;
+                    generatedFile.SetMetadata( "Link", "wwwroot/" + relativePath.Replace( '\\', '/' ) );
+                    generatedFile.SetMetadata( "TargetPath", "wwwroot/" + relativePath.Replace( '\\', '/' ) );
+                    generatedFile.SetMetadata( "ContentRoot", outputRoot );
+                    generatedFile.SetMetadata( "OriginalItemSpec", outputPath );
+
+                    originalFiles.Add( source );
+                    generatedFiles.Add( generatedFile );
+                }
+            }
+            catch ( Exception exception )
+            {
+                Log.LogErrorFromException( exception, true );
+                return false;
+            }
+
+            OriginalFiles = originalFiles.ToArray();
+            GeneratedFiles = generatedFiles.ToArray();
+
+            return !Log.HasLoggedErrors;
+        }
+
+        private static bool IsTextAsset( string path )
+        {
+            var extension = Path.GetExtension( path );
+
+            return string.Equals( extension, ".js", StringComparison.OrdinalIgnoreCase )
+                || string.Equals( extension, ".mjs", StringComparison.OrdinalIgnoreCase )
+                || string.Equals( extension, ".css", StringComparison.OrdinalIgnoreCase )
+                || string.Equals( extension, ".html", StringComparison.OrdinalIgnoreCase );
+        }
+
+        #endregion
+
+        #region Properties
+
+        [Required] public ITaskItem[] SourceFiles { get; set; }
+
+        [Required] public string SourceRoot { get; set; }
+
+        [Required] public string OutputRoot { get; set; }
+
+        [Required] public string AssetVersion { get; set; }
+
+        [Output] public ITaskItem[] OriginalFiles { get; set; }
+
+        [Output] public ITaskItem[] GeneratedFiles { get; set; }
+
+        #endregion
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 3: `4091e80d` (2026-09-29)
**Commit Message**: Tests: fix code editor race condition

**File**: `Tests/Blazorise.E2E.Tests/Tests/Extensions/CodeEditor/CodeEditorTests.cs` (modified, +19/-6)
```diff
@@ -7,6 +7,7 @@ public class CodeEditorTests : BlazorisePageTest
     [SetUp]
     public async Task Init()
     {
+        await Page.Clock.InstallAsync();
         await SelectTestComponent<CodeEditorComponent>();
         await WaitForEditor( "#code-editor-immediate" );
     }
@@ -33,13 +34,25 @@ public async Task UpdatesBoundValueOnBlur()
     [Test]
     public async Task DebouncesBoundValueUpdates()
     {
-        await ReplaceEditorValue( "#code-editor-debounce", "debounced value" );
-        await Page.WaitForTimeoutAsync( 250 );
-        await Expect( Page.Locator( "#code-editor-debounce-result" ) ).ToHaveTextAsync( string.Empty );
+        await WaitForEditor( "#code-editor-debounce" );
+        await Page.Locator( "#code-editor-debounce" ).ClickAsync();
+        await Page.Keyboard.PressAsync( "Control+A" );
+
+        // Keep CI scheduling delays from advancing the debounce timer between assertions.
+        await Page.Clock.PauseAtAsync( DateTime.UtcNow.AddMinutes( 1 ) );
+        await Page.Keyboard.InsertTextAsync( "debounced" );
+
+        var result = Page.Locator( "#code-editor-debounce-result" );
+
+        await Page.Clock.RunForAsync( 750 );
+        await Expect( result ).ToHaveTextAsync( string.Empty );
+
+        await Page.Keyboard.InsertTextAsync( " value" );
+        await Page.Clock.RunForAsync( 500 );
+        await Expect( result ).ToHaveTextAsync( string.Empty );
 
-        await Expect( Page.Locator( "#code-editor-debounce-result" ) ).ToHaveTextAsync(
-            "debounced value",
-            new LocatorAssertionsToHaveTextOptions { Timeout = 2000 } );
+        await Page.Clock.RunForAsync( 500 );
+        await Expect( result ).ToHaveTextAsync( "debounced value" );
     }
 
     [Test]
```

---

### Incident Patch 4: `09075fcb` (2026-09-29)
**Commit Message**: Blog: fix line spacing for paragraphs

**File**: `Documentation/Blazorise.Docs/wwwroot/website.css` (modified, +1/-1)
```diff
@@ -603,7 +603,7 @@
 .b-blog .b-blog-article h1 { font-size: clamp(2rem, 4vw, 3.5rem); line-height: 1.15; font-weight: 700; letter-spacing: -.055em; margin-block: 2rem !important; }
 .b-blog .b-blog-article h2 { font-size: clamp(1.6rem, 3vw, 2.25rem); margin-top: 2.5rem; border-color: var(--b-visual-line); }
 .b-blog .b-blog-article h3 { font-size: 1.45rem; margin-top: 2rem; border-color: var(--b-visual-line); }
-.b-blog .b-blog-article p, .b-blog .b-blog-article li { line-height: 1.85; }
+.b-blog .b-blog-article p, .b-blog .b-blog-article li { line-height: 1.5; }
 .b-blog-article img { max-width: 100%; height: auto; }
 .b-blog-article pre { max-width: 100%; overflow-x: auto; }
 .b-blog-article .table-responsive { max-width: 100%; overflow-x: auto; }
```

---

### Incident Patch 5: `0bba9421` (2026-09-27)
**Commit Message**: Chore: fix warnings accross codebase

**File**: `Documentation/Blazorise.Docs/Components/NewsletterWidget.razor` (modified, +4/-2)
```diff
@@ -20,12 +20,14 @@
                             <Addons>
                                 <Addon AddonType="AddonType.Body">
                                     <TextInput Role="TextRole.Email" Placeholder="Email Address" @bind-Value="@email">
+                                        <Feedback>
+                                            <ValidationError Style="font-size: .85rem;">Please complete this required field.</ValidationError>
+                                        </Feedback>
                                     </TextInput>
                                 </Addon>
                                 <Addon AddonType="AddonType.End">
                                     <Button Color="Color.Primary" Clicked="@OnSubscribeClicked">Subscribe</Button>
                                 </Addon>
-                                <ValidationError Style="font-size: .85rem;">Please complete this required field.</ValidationError>
                             </Addons>
                         </FieldBody>
                     </Field>
@@ -122,4 +124,4 @@ else
             Logger.LogError( exc.Message );
         }
     }
-}
+}
\ No newline at end of file
```

**File**: `Source/Blazorise/Components/Field/Field.razor.cs` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ protected override void BuildClasses( ClassBuilder builder )
     {
         builder.Append( ClassProvider.Field() );
         builder.Append( ClassProvider.FieldHorizontal( Horizontal ) );
-        builder.Append( ClassProvider.FieldJustifyContent( JustifyContent ) );
+        builder.Append( ClassProvider.FieldJustifyContent( justifyContent ) );
         builder.Append( ClassProvider.FieldValidation( ParentValidation?.Status ?? ValidationStatus.None ) );
 
         base.BuildClasses( builder );
```

**File**: `Source/Extensions/Blazorise.Reporting.DataSources.Csv/Config.cs` (modified, +16/-5)
```diff
@@ -1,6 +1,7 @@
 #region Using directives
 using System;
 using System.Net.Http;
+using System.Runtime.Versioning;
 using Blazorise.Reporting;
 using Microsoft.Extensions.DependencyInjection;
 #endregion
@@ -33,11 +34,7 @@ public static IServiceCollection AddBlazoriseReportingCsvDataSource( this IServi
 
         if ( !OperatingSystem.IsBrowser() )
         {
-            httpClientBuilder.ConfigurePrimaryHttpMessageHandler( () => new HttpClientHandler
-            {
-                AllowAutoRedirect = false,
-                UseCookies = false,
-            } );
+            httpClientBuilder.ConfigurePrimaryHttpMessageHandler( CreateHttpMessageHandler );
         }
 
         configureHttpClientBuilder?.Invoke( httpClientBuilder );
@@ -46,5 +43,19 @@ public static IServiceCollection AddBlazoriseReportingCsvDataSource( this IServi
         return services;
     }
 
+    /// <summary>
+    /// Creates the HTTP handler for non-browser applications.
+    /// </summary>
+    /// <returns>The HTTP message handler.</returns>
+    [UnsupportedOSPlatform( "browser" )]
+    private static HttpMessageHandler CreateHttpMessageHandler()
+    {
+        return new HttpClientHandler
+        {
+            AllowAutoRedirect = false,
+            UseCookies = false,
+        };
+    }
+
     #endregion
 }
\ No newline at end of file
```

**File**: `Source/Extensions/Blazorise.Reporting.DataSources.WebApi/Configuration/Config.cs` (modified, +19/-8)
```diff
@@ -2,6 +2,7 @@
 using System;
 using System.Net;
 using System.Net.Http;
+using System.Runtime.Versioning;
 using Blazorise.Reporting;
 using Microsoft.Extensions.DependencyInjection;
 using Microsoft.Extensions.DependencyInjection.Extensions;
@@ -38,14 +39,7 @@ public static IServiceCollection AddBlazoriseReportingWebApiDataSource( this ISe
 
         if ( !OperatingSystem.IsBrowser() )
         {
-            httpClientBuilder.ConfigurePrimaryHttpMessageHandler( () => new SocketsHttpHandler
-            {
-                AllowAutoRedirect = false,
-                AutomaticDecompression = DecompressionMethods.All,
-                UseCookies = false,
-                UseProxy = false,
-                ConnectCallback = WebApiPublicNetworkGuard.ConnectAsync,
-            } );
+            httpClientBuilder.ConfigurePrimaryHttpMessageHandler( CreateHttpMessageHandler );
         }
 
         services.AddReportDataSourceProvider<WebApiReportDataSourceProvider>();
@@ -67,5 +61,22 @@ public static IServiceCollection AddBlazoriseReportingWebApiResponseReader<TRead
         return services;
     }
 
+    /// <summary>
+    /// Creates the HTTP handler for non-browser applications.
+    /// </summary>
+    /// <returns>The HTTP message handler.</returns>
+    [UnsupportedOSPlatform( "browser" )]
+    private static HttpMessageHandler CreateHttpMessageHandler()
+    {
+        return new SocketsHttpHandler
+        {
+            AllowAutoRedirect = false,
+            AutomaticDecompression = DecompressionMethods.All,
+            UseCookies = false,
+            UseProxy = false,
+            ConnectCallback = WebApiPublicNetworkGuard.ConnectAsync,
+        };
+    }
+
     #endregion
 }
\ No newline at end of file
```

**File**: `Source/Extensions/Blazorise.Reporting.DataSources.WebApi/Internal/WebApiPublicNetworkGuard.cs` (modified, +2/-0)
```diff
@@ -6,12 +6,14 @@
 using System.Net;
 using System.Net.Http;
 using System.Net.Sockets;
+using System.Runtime.Versioning;
 using System.Threading;
 using System.Threading.Tasks;
 #endregion
 
 namespace Blazorise.Reporting.DataSources.WebApi;
 
+[UnsupportedOSPlatform( "browser" )]
 internal static class WebApiPublicNetworkGuard
 {
     #region Members
```

**File**: `Tests/Blazorise.E2E.Tests/Tests/Components/Tabs/TabsTests.cs` (modified, +2/-3)
```diff
@@ -241,12 +241,11 @@ private async Task SelectKeyboardComponent()
 
     private async Task ExpectShowClass( ILocator locator )
     {
-        await Expect( locator ).ToHaveClassAsync( expected: new Regex( "show" ) );
+        await Expect( locator ).ToContainClassAsync( "show" );
     }
 
     private async Task DoNotExpectShowClass( ILocator locator )
     {
-        await Expect( locator ).Not.ToHaveClassAsync( expected: new Regex( "show" ) );
+        await Expect( locator ).Not.ToContainClassAsync( "show" );
     }
-
 }
\ No newline at end of file
```

**File**: `Tests/Blazorise.Tests/Components/DockLayoutSizingTest.cs` (modified, +9/-3)
```diff
@@ -117,9 +117,15 @@ public void PaneSizeConstraintsApplyOnlyOnDockAxis()
         DockPane designer = CreateDockPane( "designer", role: DockPaneRole.Document );
         DockLayoutRegistry registry = new();
 
-        explorer.MinSize = "10rem";
-        explorer.MaxSize = "24rem";
-        properties.MinSize = "12rem";
+        ParameterView.FromDictionary( new Dictionary<string, object>
+        {
+            [nameof( DockPane.MinSize )] = "10rem",
+            [nameof( DockPane.MaxSize )] = "24rem",
+        } ).SetParameterProperties( explorer );
+        ParameterView.FromDictionary( new Dictionary<string, object>
+        {
+            [nameof( DockPane.MinSize )] = "12rem",
+        } ).SetParameterProperties( properties );
 
         registry.RegisterPane( explorer );
         registry.RegisterPane( properties );
```

---

### Incident Patch 6: `f38112d6` (2026-09-26)
**Commit Message**: NumericPicker: fix binding for browser autofill (#6820)

**File**: `Source/Blazorise/wwwroot/numericPicker.js` (modified, +30/-0)
```diff
@@ -50,9 +50,37 @@ export function initialize(dotnetAdapter, element, elementId, options) {
         }
     });
 
+    element.addEventListener('input', onNativeValueChanged);
+    element.addEventListener('change', onNativeValueChanged);
+
     _instances[elementId] = instance;
 }
 
+function onNativeValueChanged(event) {
+    // AutoNumeric already processes typing and raises its own synthetic input events.
+    if (!event.isTrusted)
+        return;
+
+    const instance = AutoNumeric.getAutoNumericElement(event.currentTarget);
+
+    if (!instance)
+        return;
+
+    try {
+        const value = AutoNumeric.unformat(event.currentTarget.value, instance.getSettings());
+
+        if (Number.isNaN(Number(value))) {
+            instance.reformat();
+            return;
+        }
+
+        instance.set(value === "" ? null : value);
+    } catch {
+        // Ignore saved values that no longer satisfy the configured numeric limits.
+        instance.reformat();
+    }
+}
+
 export function focus(element, elementId, selectText) {
     element = getRequiredElement(element, elementId);
 
@@ -89,6 +117,8 @@ export function destroy(element, elementId) {
     const instance = _instances[elementId];
 
     if (instance) {
+        instance.node().removeEventListener('input', onNativeValueChanged);
+        instance.node().removeEventListener('change', onNativeValueChanged);
         instance.remove();
     }
 
```

**File**: `Tests/BasicTestApp.Client/NumericPickerAutofillComponent.razor` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+@using System.Globalization
+
+<NumericPicker ElementId="autofillImmediate" name="autofillImmediate" TValue="decimal?" @bind-Value="immediateValue" Immediate GroupSeparator="," />
+<Span ElementId="autofillImmediateValue">@(immediateValue?.ToString( CultureInfo.InvariantCulture ) ?? "null")</Span>
+
+<NumericPicker ElementId="autofillDeferred" name="autofillDeferred" TValue="decimal?" @bind-Value="deferredValue" Immediate="false" GroupSeparator="," />
+<Span ElementId="autofillDeferredValue">@(deferredValue?.ToString( CultureInfo.InvariantCulture ) ?? "null")</Span>
+
+<NumericPicker ElementId="autofillComma" name="autofillComma" TValue="decimal?" @bind-Value="commaValue" Immediate DecimalSeparator="," GroupSeparator="." />
+<Span ElementId="autofillCommaValue">@(commaValue?.ToString( CultureInfo.InvariantCulture ) ?? "null")</Span>
+
+<NumericPicker ElementId="autofillLimited" name="autofillLimited" TValue="decimal?" @bind-Value="limitedValue" Immediate Min="0m" Max="100m" />
+<Span ElementId="autofillLimitedValue">@(limitedValue?.ToString( CultureInfo.InvariantCulture ) ?? "null")</Span>
+
+<Button ElementId="autofillBlur">Move focus</Button>
+
+@code {
+    private decimal? immediateValue;
+    private decimal? deferredValue;
+    private decimal? commaValue;
+    private decimal? limitedValue = 12m;
+}
\ No newline at end of file
```

**File**: `Tests/Blazorise.E2E.Tests/Tests/Components/NumericPicker/NumericPickerAutofillTests.cs` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+namespace Blazorise.E2E.Tests.Tests.Components.NumericPicker;
+
+public class NumericPickerAutofillTests : BlazorisePageTest
+{
+    [TestCase( "autofillImmediate", "1,234.56", "1234.56", "1,234.56", true )]
+    [TestCase( "autofillDeferred", "1,234.56", "1234.56", "1,234.56", false )]
+    [TestCase( "autofillComma", "1.234,56", "1234.56", "1.234,56", true )]
+    [TestCase( "autofillComma", "1.234", "1234", "1.234,00", true )]
+    public async Task NativeInput_ShouldBindValueAndPreserveItOnBlur( string elementId, string text, string value, string formattedValue, bool immediate )
+    {
+        await SelectTestComponent<NumericPickerAutofillComponent>();
+        await WaitForPicker( elementId );
+
+        ILocator input = Page.Locator( $"#{elementId}" );
+        ILocator result = Page.Locator( $"#{elementId}Value" );
+
+        // Fill produces browser input without AutoNumeric's keypress handling, like autofill.
+        await input.FillAsync( text );
+        await Expect( result ).ToHaveTextAsync( immediate ? value : "null" );
+
+        await Page.Locator( "#autofillBlur" ).ClickAsync();
+        await Expect( result ).ToHaveTextAsync( value );
+        await Expect( input ).ToHaveValueAsync( formattedValue );
+
+        await input.FillAsync( string.Empty );
+        await Page.Locator( "#autofillBlur" ).ClickAsync();
+        await Expect( result ).ToHaveTextAsync( "null" );
+        await Expect( input ).ToHaveValueAsync( string.Empty );
+    }
+
+    [TestCase( "invalid", "12", "12.00" )]
+    [TestCase( "101", "100", "100.00" )]
+    [TestCase( "-1", "0", "0.00" )]
+    public async Task NativeInput_ShouldRespectNumericValidationOnBlur( string text, string expectedValue, string expectedFormattedValue )
+    {
+        await SelectTestComponent<NumericPickerAutofillComponent>();
+        await WaitForPicker( "autofillLimited" );
+
+        ILocator input = Page.Locator( "#autofillLimited" );
+        await Expect( input ).ToHaveValueAsync( "12.00" );
+        await input.FillAsync( text );
+        await Page.Locator( "#autofillBlur" ).ClickAsync();
+
+        await Expect( Page.Locator( "#autofillLimitedValue" ) ).ToHaveTextAsync( expectedValue );
+        await Expect( input ).ToHaveValueAsync( expectedFormattedValue );
+    }
+
+    [Test]
+    public async Task Typing_ShouldStillAllowEnteringDecimals()
+    {
+        await SelectTestComponent<NumericPickerAutofillComponent>();
+        await WaitForPicker( "autofillImmediate" );
+
+        ILocator input = Page.Locator( "#autofillImmediate" );
+        await input.FocusAsync();
+        await Page.Keyboard.TypeAsync( "1234.56" );
+
+        await Expect( Page.Locator( "#autofillImmediateValue" ) ).ToHaveTextAsync( "1234.56" );
+        await Expect( input ).ToHaveValueAsync( "1,234.56" );
+    }
+
+    private async Task WaitForPicker( string elementId )
+    {
+        await Page.WaitForFunctionAsync( """
+            elementId => typeof AutoNumeric !== 'undefined'
+                && document.getElementById(elementId)
+                && AutoNumeric.isManagedByAutoNumeric(document.getElementById(elementId))
+            """, elementId );
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 7: `ccd714d5` (2026-09-26)
**Commit Message**: DataGrid: fix ScrollToRow targeting and visibility (#6819)

**File**: `Source/Blazorise/Components/Table/Table.razor.cs` (modified, +1/-1)
```diff
@@ -239,7 +239,7 @@ public ValueTask ScrollToPixels( int pixels )
     /// <summary>
     /// If table has <see cref="FixedHeader"/> enabled, it will scroll position to the provided row.
     /// </summary>
-    /// <param name="row">Zero-based index of table row to scroll to.</param>
+    /// <param name="row">Zero-based index of the table body row to scroll to.</param>
     /// <returns>A task that represents the asynchronous operation.</returns>
     public ValueTask ScrollToRow( int row )
     {
```

**File**: `Source/Blazorise/wwwroot/table.js` (modified, +23/-9)
```diff
@@ -73,16 +73,30 @@ export function fixedHeaderScrollTableToPixels(element, elementId, pixels) {
 export function fixedHeaderScrollTableToRow(element, elementId, row) {
     element = getRequiredElement(element, elementId);
 
-    if (element) {
-        let rows = element.querySelectorAll("tr");
-        let rowsLength = rows.length;
+    if (!element || !element.parentElement)
+        return;
 
-        if (rowsLength > 0 && row >= 0 && row < rowsLength) {
-            rows[row].scrollIntoView({
-                behavior: "smooth",
-                block: "nearest"
-            });
-        }
+    const targetRow = element.querySelectorAll(":scope > tbody > tr")[row];
+
+    if (!targetRow)
+        return;
+
+    const container = element.parentElement;
+    const containerRect = container.getBoundingClientRect();
+    const rowRect = targetRow.getBoundingClientRect();
+    const viewportTop = containerRect.top + container.clientTop;
+    const viewportBottom = viewportTop + container.clientHeight;
+    let visibleTop = viewportTop;
+
+    // Fixed header cells cover the top of the scrollable area.
+    element.querySelectorAll(":scope > thead > tr > th").forEach(cell => {
+        visibleTop = Math.max(visibleTop, cell.getBoundingClientRect().bottom);
+    });
+
+    if (rowRect.top < visibleTop) {
+        container.scrollBy({ top: rowRect.top - visibleTop, behavior: "smooth" });
+    } else if (rowRect.bottom > viewportBottom) {
+        container.scrollBy({ top: rowRect.bottom - viewportBottom, behavior: "smooth" });
     }
 }
 
```

**File**: `Tests/BasicTestApp.Client/DataGridScrollToRowComponent.razor` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+<Switch ElementId="groupHeaders" @bind-Value="groupHeaders">Group headers</Switch>
+
+<DataGrid @ref="dataGrid"
+          ElementId="scrollGrid"
+          TItem="ScrollItem"
+          Data="items"
+          PageSize="30"
+          FixedHeader
+          FixedHeaderDataGridMaxHeight="200px"
+          ShowHeaderGroupCaptions="groupHeaders"
+          @bind-SelectedRow="selectedRow">
+    <DataGridColumns>
+        <DataGridColumn Field="@nameof( ScrollItem.Id )" Caption="Id" HeaderGroupCaption="Item" />
+        <DataGridColumn Field="@nameof( ScrollItem.Name )" Caption="Name" HeaderGroupCaption="Item" />
+    </DataGridColumns>
+</DataGrid>
+
+@foreach ( int index in new[] { 0, 5, 6, 10, 20, 29 } )
+{
+    <Button ElementId="@($"scrollTo{index}")" Clicked="@(() => ScrollToRow( index ))">Scroll to @index</Button>
+}
+
+@code {
+    private DataGrid<ScrollItem> dataGrid;
+    private ScrollItem selectedRow;
+    private bool groupHeaders;
+
+    private readonly List<ScrollItem> items = Enumerable.Range( 0, 30 )
+        .Select( index => new ScrollItem { Id = index, Name = $"Item {index}" } )
+        .ToList();
+
+    private async Task ScrollToRow( int index )
+    {
+        selectedRow = items[index];
+        await dataGrid.ScrollToRow( index );
+    }
+
+    public class ScrollItem
+    {
+        public int Id { get; set; }
+
+        public string Name { get; set; }
+    }
+}
\ No newline at end of file
```

**File**: `Tests/Blazorise.E2E.Tests/Tests/Extensions/DataGrid/DataGridScrollToRowTests.cs` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+namespace Blazorise.E2E.Tests.Tests.Extensions.DataGrid;
+
+public class DataGridScrollToRowTests : BlazorisePageTest
+{
+    [TestCase( false )]
+    [TestCase( true )]
+    public async Task ScrollToRow_ShouldKeepRequestedRowBelowHeaderAndInsideContainer( bool groupHeaders )
+    {
+        await SelectTestComponent<DataGridScrollToRowComponent>();
+
+        if ( groupHeaders )
+        {
+            await Page.Locator( "#groupHeaders" ).CheckAsync();
+        }
+
+        await Expect( Page.Locator( "#scrollGrid > thead > tr" ) ).ToHaveCountAsync( groupHeaders ? 2 : 1 );
+        await Expect( Page.Locator( "#scrollGrid > tbody > tr" ) ).ToHaveCountAsync( 30 );
+
+        foreach ( int index in new[] { 5, 6, 20, 10, 29, 0 } )
+        {
+            await Page.Locator( $"#scrollTo{index}" ).ClickAsync();
+
+            // Wait for smooth scrolling to bring the entire row into the unobscured viewport.
+            await Page.WaitForFunctionAsync( """
+                index => {
+                    const table = document.getElementById('scrollGrid');
+                    const row = table.querySelector(`:scope > tbody > tr[data-row-index='${index}']`);
+                    const container = table.parentElement;
+                    const containerRect = container.getBoundingClientRect();
+                    const viewportTop = containerRect.top + container.clientTop;
+                    const viewportBottom = viewportTop + container.clientHeight;
+                    const headerBottom = Math.max(viewportTop, ...Array.from(
+                        table.querySelectorAll(':scope > thead > tr > th'),
+                        cell => cell.getBoundingClientRect().bottom));
+                    const rowRect = row.getBoundingClientRect();
+
+                    return rowRect.height > 0
+                        && rowRect.top >= headerBottom - 1
+                        && rowRect.bottom <= viewportBottom + 1;
+                }
+                """, index );
+        }
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 8: `c8c5ed23` (2026-09-26)
**Commit Message**: DataGrid: fix numeric rapid editing with decimal padding (#6818)

**File**: `Source/Blazorise/wwwroot/numericPicker.js` (modified, +32/-0)
```diff
@@ -53,6 +53,38 @@ export function initialize(dotnetAdapter, element, elementId, options) {
     _instances[elementId] = instance;
 }
 
+export function focus(element, elementId, selectText) {
+    element = getRequiredElement(element, elementId);
+
+    if (!element) {
+        return;
+    }
+
+    const focusInstance = instance => {
+        if (!element.isConnected) {
+            return;
+        }
+
+        element.focus();
+
+        if (selectText) {
+            element.select();
+        } else {
+            instance.selectInteger();
+            const caret = element.selectionEnd;
+            element.setSelectionRange(caret, caret);
+        }
+    };
+
+    const instance = _instances[elementId];
+
+    if (instance) {
+        focusInstance(instance);
+    } else {
+        element.addEventListener("autoNumeric:initialized", event => focusInstance(event.detail.aNElement), { once: true });
+    }
+}
+
 export function destroy(element, elementId) {
     const instance = _instances[elementId];
 
```

**File**: `Source/Extensions/Blazorise.DataGrid/DataGrid.razor.cs` (modified, +17/-21)
```diff
@@ -2374,6 +2374,9 @@ private async Task BlurActiveCellEditorAsync()
         await Task.Yield();
     }
 
+    internal ValueTask FocusNumericCellEditor( string elementId, bool selectText )
+        => JSModule.FocusNumericCellEditor( elementId, selectText );
+
     private async Task<string> CaptureCellEditWidth( TItem item, DataGridColumn<TItem> column )
     {
         if ( tableRef is null || item is null || column is null )
@@ -2453,39 +2456,32 @@ internal async Task HandleCellEdit( DataGridColumn<TItem> column, TItem item, st
             {
                 batchEditItem = batchEditItem ??
                     GetBatchEditItem( item );
+            }
 
-                if ( batchEditItem is not null )
-                {
-                    await Edit( batchEditItem.NewItem );
-                    if ( startingvalue is not null )
-                    {
-                        var columnType = column.GetValueType( batchEditItem.NewItem );
-                        if ( startingvalue == String.Empty )
-                        {
-                            UpdateCellEditValue( column.Field, columnType.IsValueType ? Activator.CreateInstance( columnType ) : startingvalue );
-                        }
-                        else if ( Converters.TryChangeType( startingvalue, columnType, out var parsedBatchStartingValue ) )
-                        {
-                            UpdateCellEditValue( column.Field, parsedBatchStartingValue );
-                        }
+            TItem editingItem = batchEditItem is not null ? batchEditItem.NewItem : item;
 
-                        return;
-                    }
-                }
-            }
-            await Edit( item );
+            InitEditItem( EditItemCreator != null ? EditItemCreator.Invoke( editingItem ) : editingItem );
+
+            editState = DataGridEditState.Edit;
+
+            // Apply the starting value before the first render initializes and focuses the editor.
             if ( startingvalue is not null )
             {
-                var columnType = column.GetValueType( item );
-                if ( startingvalue == String.Empty )
+                Type columnType = column.GetValueType( editItem );
+
+                if ( startingvalue == string.Empty )
                 {
                     UpdateCellEditValue( column.Field, columnType.IsValueType ? Activator.CreateInstance( columnType ) : startingvalue );
+                    return;
                 }
                 else if ( Converters.TryChangeType( startingvalue, columnType, out var parsedStartingValue ) )
                 {
                     UpdateCellEditValue( column.Field, parsedStartingValue );
+                    return;
                 }
             }
+
+            await InvokeAsync( StateHasChanged );
         }
     }
 
```

**File**: `Source/Extensions/Blazorise.DataGrid/Internal/_DataGridCellEdit.razor` (modified, +10/-10)
```diff
@@ -7,43 +7,43 @@
 }
 else if ( ValueType == typeof( decimal ) )
 {
-    <NumericPicker TValue="decimal" Value="@((decimal)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="decimal" Value="@((decimal)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( decimal? ) )
 {
-    <NumericPicker TValue="decimal?" Value="@((decimal?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="decimal?" Value="@((decimal?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( double ) )
 {
-    <NumericPicker TValue="double" Value="@((double)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="double" Value="@((double)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( double? ) )
 {
-    <NumericPicker TValue="double?" Value="@((double?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="double?" Value="@((double?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( float ) )
 {
-    <NumericPicker TValue="float" Value="@((float)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="float" Value="@((float)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( float? ) )
 {
-    <NumericPicker TValue="float?" Value="@((float?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="float?" Value="@((float?)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
 }
 else if ( ValueType == typeof( int ) )
 {
-    <NumericPicker TValue="int" Value="@((int)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@ShowStepButtons" EnableStep="@EnableStep" />
+    <NumericPicker ElementId="@elementId" TValue="int" Value="@((int)CellEditContext.CellValue)" ValueChanged="@OnEditValueChanged" ReadOnly="@Readonly" Step="@Step" Decimals="@Decimals" DecimalSeparator="@DecimalSeparator" GroupSeparator="@GroupSeparator" Culture="@Culture" ShowStepButtons="@S
```

**File**: `Source/Extensions/Blazorise.DataGrid/Internal/_DataGridCellEdit.razor.cs` (modified, +6/-0)
```diff
@@ -37,13 +37,19 @@ protected override async Task OnAfterRenderAsync( bool firstRender )
                 var cellValue = ParentDataGrid.ReadCellEditValue( Column.Field )?.ToString();
                 var columnValue = Column.GetValue( ParentDataGrid.editItem )?.ToString();
                 var valueHasChanged = cellValue != columnValue;
+                Type valueType = Nullable.GetUnderlyingType( ValueType ) ?? ValueType;
+                bool isNumericPicker = valueType == typeof( decimal ) || valueType == typeof( double ) || valueType == typeof( float ) || valueType == typeof( int ) || valueType == typeof( long );
 
                 await Task.Yield();
 
                 if ( shouldRestoreFocus )
                 {
                     await Focus();
                 }
+                else if ( isNumericPicker && ( valueHasChanged || ParentDataGrid.IsCellEditSelectTextOnEdit ) )
+                {
+                    await ParentDataGrid.FocusNumericCellEditor( elementId, !valueHasChanged );
+                }
                 else if ( ParentDataGrid.IsCellEditSelectTextOnEdit && !valueHasChanged )
                 {
                     await Select();
```

**File**: `Source/Extensions/Blazorise.DataGrid/Internal/_DataGridCellNumericEdit.razor.cs` (modified, +4/-0)
```diff
@@ -62,6 +62,10 @@ protected override async Task OnAfterRenderAsync( bool firstRender )
                 {
                     await Focus();
                 }
+                else if ( !Column.NativeInputMode && ( valueHasChanged || ParentDataGrid.IsCellEditSelectTextOnEdit ) )
+                {
+                    await ParentDataGrid.FocusNumericCellEditor( elementId, !valueHasChanged );
+                }
                 else if ( ParentDataGrid.IsCellEditSelectTextOnEdit && !valueHasChanged )
                 {
                     await Select();
```

**File**: `Source/Extensions/Blazorise.DataGrid/JSDataGridModule.cs` (modified, +6/-0)
```diff
@@ -68,6 +68,12 @@ public virtual async ValueTask BlurActiveCellEditor( ElementReference elementRef
         await moduleInstance.InvokeVoidAsync( "blurActiveCellEditor", elementRef, elementId );
     }
 
+    /// <summary>
+    /// Focuses an initialized numeric cell editor, selecting its contents or placing the caret at the end of the integer part.
+    /// </summary>
+    internal ValueTask FocusNumericCellEditor( string elementId, bool selectText )
+        => InvokeVoidAsync( "focusNumericCellEditor", elementId, selectText );
+
     /// <summary>
     /// Returns cell width.
     /// </summary>
```

**File**: `Source/Extensions/Blazorise.DataGrid/wwwroot/datagrid.js` (modified, +5/-0)
```diff
@@ -158,6 +158,11 @@ export function blurActiveCellEditor(element, elementId) {
     }
 }
 
+export async function focusNumericCellEditor(elementId, selectText) {
+    const numericPicker = await import("../Blazorise/numericPicker.js?v=2.3.2.0");
+    numericPicker.focus(null, elementId, selectText);
+}
+
 export function getCellWidth(element, elementId, rowIndex, columnId) {
     element = getRequiredElement(element, elementId);
 
```

**File**: `Tests/BasicTestApp.Client/DataGridRapidEditingComponent.razor` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+@using System.Globalization
+
+<Switch ElementId="useValidation" @bind-Value="useValidation">Use validation</Switch>
+
+<DataGrid TItem="SalaryItem"
+          Data="items"
+          Editable
+          UseValidation="useValidation"
+          EditMode="DataGridEditMode.Cell"
+          NavigationMode="DataGridNavigationMode.Cell"
+          EditModeOptions="new() { CellEditOnSingleClick = false, CellEditOnDoubleClick = false, CellEditSelectTextOnEdit = true }">
+    <DataGridColumns>
+        <DataGridColumn Field="@nameof( SalaryItem.PlainSalary )" Caption="Plain salary" Editable DisplayFormat="{0:F2}" DisplayFormatProvider="CultureInfo.InvariantCulture" />
+        <DataGridNumericColumn Field="@nameof( SalaryItem.Salary )" Caption="Salary" Editable DisplayFormat="{0:F2}" DisplayFormatProvider="CultureInfo.InvariantCulture" />
+        <DataGridNumericColumn Field="@nameof( SalaryItem.NullableSalary )" Caption="Comma salary" Editable DecimalSeparator="," GroupSeparator="." DisplayFormat="{0:F2}" DisplayFormatProvider="CultureInfo.InvariantCulture" />
+        <DataGridColumn Field="@nameof( SalaryItem.Quantity )" Caption="Quantity" Editable />
+        <DataGridColumn Field="@nameof( SalaryItem.Name )" Caption="Name" Editable />
+    </DataGridColumns>
+</DataGrid>
+
+@code {
+    private bool useValidation;
+
+    private readonly List<SalaryItem> items = new()
+    {
+        new(),
+    };
+
+    public class SalaryItem
+    {
+        public double PlainSalary { get; set; } = 9876.54;
+
+        public double Salary { get; set; } = 9876.54;
+
+        public decimal? NullableSalary { get; set; } = 9876.54m;
+
+        public int Quantity { get; set; } = 99;
+
+        public string Name { get; set; } = "Original";
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 9: `bad325b9` (2026-09-25)
**Commit Message**: Docs MCP: fix API lookup failures caused by duplicate type names (#6816)

**File**: `Documentation/Blazorise.Docs.Mcp/README.md` (modified, +5/-3)
```diff
@@ -95,14 +95,16 @@ The script reads SSE responses and also handles JSON-RPC responses returned in H
 
 Script: `Documentation/Blazorise.Docs.Mcp/Test-Mcp-Api.ps1`
 
+By default, the script requests the Button component API and the Dropdown API page at `/docs/components/dropdown/api`. JSON-RPC errors and MCP tool errors cause the script to fail. Pass `-DocsRoute ""` to skip the page API request.
+
 Fetch API docs for a component:
 ```powershell
 powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "http://localhost:12791" -ComponentTypeName "Button"
 ```
 
 Fetch API docs for a docs page route:
 ```powershell
-powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "https://mcp.blazorise.com" -DocsRoute "/docs/components/button"
+powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "https://mcp.blazorise.com" -DocsRoute "/docs/components/button/api"
 ```
 
 ## Script Commands
@@ -119,8 +121,8 @@ powershell -File .\Test-Mcp.ps1 -BaseUrl "http://localhost:12791" -TimeoutSecond
 Component API:
 ```powershell
 powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "http://localhost:12791" -ComponentTypeName "Button"
-powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "https://mcp.blazorise.com" -DocsRoute "/docs/components/button"
-powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "http://localhost:12791" -ComponentTypeName "TextInput" -DocsRoute "/docs/components/text-input"
+powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "https://mcp.blazorise.com" -DocsRoute "/docs/components/button/api"
+powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "http://localhost:12791" -ComponentTypeName "TextInput" -DocsRoute "/docs/components/text-input/api"
 powershell -File .\Test-Mcp-Api.ps1 -BaseUrl "http://localhost:12791" -TimeoutSeconds 60 -ProtocolVersion "2024-11-05"
 ```
 
```

**File**: `Documentation/Blazorise.Docs.Mcp/Test-Mcp-Api.ps1` (modified, +15/-2)
```diff
@@ -3,7 +3,7 @@ param(
     [int]$TimeoutSeconds = 20,
     [string]$ProtocolVersion = "2024-11-05",
     [string]$ComponentTypeName = "Button",
-    [string]$DocsRoute = ""
+    [string]$DocsRoute = "/docs/components/dropdown/api"
 )
 
 Set-StrictMode -Version Latest
@@ -167,6 +167,19 @@ function Process-JsonRpcPayload
             }
         }
 
+        [object] $errorValue = Get-PayloadPropertyValue -Payload $message -Name "error"
+        if ( $null -ne $errorValue )
+        {
+            throw "MCP request failed: $($errorValue | ConvertTo-Json -Depth 10 -Compress)"
+        }
+
+        [object] $resultValue = Get-PayloadPropertyValue -Payload $message -Name "result"
+        [object] $isError = Get-PayloadPropertyValue -Payload $resultValue -Name "isError"
+        if ( $isError -eq $true )
+        {
+            throw "MCP tool failed: $($resultValue | ConvertTo-Json -Depth 10 -Compress)"
+        }
+
         [object] $idValue = Get-PayloadPropertyValue -Payload $message -Name "id"
         if ( $idValue )
         {
@@ -418,4 +431,4 @@ if ( $pendingIds.Count -gt 0 )
 {
     Write-Host "Timed out waiting for MCP responses."
     exit 1
-}
+}
\ No newline at end of file
```

**File**: `Documentation/Blazorise.Docs.Mcp/Tools/DocsTools.cs` (modified, +10/-6)
```diff
@@ -125,9 +125,9 @@ public List<DocsApiComponent> GetDocsPageApi(
         if ( apiIndex.Components is null || apiIndex.Components.Count == 0 )
             return new List<DocsApiComponent>();
 
-        Dictionary<string, DocsApiComponent> componentsByTypeName = apiIndex.Components
+        ILookup<string, DocsApiComponent> componentsByTypeName = apiIndex.Components
             .Where( component => !string.IsNullOrWhiteSpace( component.TypeName ) )
-            .ToDictionary( component => component.TypeName, StringComparer.OrdinalIgnoreCase );
+            .ToLookup( component => component.TypeName, StringComparer.OrdinalIgnoreCase );
 
         List<DocsApiComponent> results = new List<DocsApiComponent>();
         HashSet<string> seen = new HashSet<string>( StringComparer.OrdinalIgnoreCase );
@@ -140,10 +140,12 @@ public List<DocsApiComponent> GetDocsPageApi(
                 if ( string.IsNullOrWhiteSpace( apiTypeName ) )
                     continue;
 
-                if ( componentsByTypeName.TryGetValue( apiTypeName, out DocsApiComponent component )
-                     && seen.Add( component.TypeName ) )
+                foreach ( DocsApiComponent component in componentsByTypeName[apiTypeName] )
                 {
-                    results.Add( component );
+                    if ( seen.Add( component.Type ?? component.TypeName ) )
+                    {
+                        results.Add( component );
+                    }
                 }
             }
             else if ( string.Equals( apiRef.Kind, "category", StringComparison.OrdinalIgnoreCase ) )
@@ -155,8 +157,10 @@ public List<DocsApiComponent> GetDocsPageApi(
 
                 foreach ( DocsApiComponent component in categoryComponents )
                 {
-                    if ( seen.Add( component.TypeName ) )
+                    if ( seen.Add( component.Type ?? component.TypeName ) )
+                    {
                         results.Add( component );
+                    }
                 }
             }
         }
```

---

### Incident Patch 10: `4be5f427` (2026-09-25)
**Commit Message**: Website: add Blazor UI library comparison and buying guide

**File**: `Documentation/Blazorise.Docs/Pages/Docs/Guides/Material/MaterialGuidePage.razor` (modified, +2/-2)
```diff
@@ -7,11 +7,11 @@
 </DocsPageTitle>
 
 <DocsPageLead>
-    Build modern Blazor apps with Blazorise Material 3 and customize the experience with Material design tokens.
+    Build modern Blazor apps with Blazorise's Material 3 Expressive-inspired provider and customize the experience with Material design tokens.
 </DocsPageLead>
 
 <DocsPageParagraph>
-    Blazorise Material is a <Anchor To="https://m3.material.io/" Target="Target.Blank">Material 3</Anchor> focused provider. It ships with provider styles, behavior, and Material Symbols font files, so you no longer need to download third-party Material CSS files manually.
+    Blazorise Material is a <Anchor To="https://m3.material.io/" Target="Target.Blank">Material 3</Anchor> Expressive-inspired provider. It ships with provider styles, behavior, and Material Symbols font files, so you no longer need to download third-party Material CSS files manually.
 </DocsPageParagraph>
 
 <DocsPageParagraph>
```

**File**: `Documentation/Blazorise.Docs/Pages/Home/CompareBlazorLibrariesPage.razor` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+@page "/compare-blazor-libraries"
+
+<Seo Canonical="/compare-blazor-libraries" Title="Compare Blazor UI libraries | Blazorise" Description="Compare design systems, advanced components, developer utilities, and licensing across Blazorise, MudBlazor, Radzen Blazor Components, and Telerik UI for Blazor." />
+
+<Div Class="b-visual b-marketing b-expanded-page b-library-comparison-page">
+    <MarketingPageHeader Variant="BrandBackdropVariant.EdgePeaks" Counterpoint="BrandBackdropVariant.EdgePeaks">
+        <Title>Choose the right<br /><Span>Blazor UI library.</Span></Title>
+        <Description>One component API. Multiple design systems. Advanced components and developer utilities. Compare Blazorise with MudBlazor, Radzen Blazor Components, and Telerik UI for Blazor.</Description>
+        <Actions><Anchor To="docs/start" Class="b-visual-button b-visual-button-primary">Try Blazorise</Anchor><Anchor To="pricing" Class="b-visual-button b-visual-button-outline">View Blazorise plans</Anchor></Actions>
+    </MarketingPageHeader>
+
+    <section class="b-visual-section b-library-comparison-overview" aria-labelledby="comparison-overview-title">
+        <Container>
+            <Div Class="b-library-comparison-intro" Margin="Margin.Is4.FromBottom">
+                <Paragraph Class="b-visual-eyebrow">AT A GLANCE</Paragraph>
+                <Heading Size="HeadingSize.Is2" ElementId="comparison-overview-title">How they compare</Heading>
+                <Paragraph TextSize="TextSize.Large" TextColor="TextColor.Muted" Margin="Margin.Is0.FromBottom">
+                    Compare design systems, advanced components, developer utilities, and licensing at a glance. Follow the source links for current product details.
+                </Paragraph>
+            </Div>
+
+            <LibraryComparisonTable />
+            <Paragraph TextColor="TextColor.Muted" TextSize="TextSize.Small" Margin="Margin.Is3.FromTop.Is0.FromBottom">
+                Comparison based on publicly available product documentation. Last reviewed September 2026.
+            </Paragraph>
+        </Container>
+    </section>
+
+    <section class="b-visual-section b-marketing-tint b-library-comparison-guidance" aria-labelledby="comparison-guidance-title">
+        <Container>
+            <Heading Size="HeadingSize.Is2" ElementId="comparison-guidance-title" Margin="Margin.Is4.FromBottom">What to check before choosing</Heading>
+            <Row>
+                <Column ColumnSize="ColumnSize.Is12.Is6.OnDesktop">
+                    <Card Height="Height.Is100">
+                        <CardBody>
+                            <Heading Size="HeadingSize.Is3">Design systems</Heading>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is3.FromBottom">
+                                Decide whether your team wants one opinionated design system or needs flexibility across several. Consider the visual requirements of your existing applications.
+                            </Paragraph>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is3.FromBottom">
+                                Blazorise provides one component API across Material 3 Expressive, Fluent 2, Ant Design v6, Bootstrap, Tailwind, and Bulma.
+                            </Paragraph>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is0.FromBottom">
+                                This flexibility can help with white-label products and different customer requirements, or when changing an application's visual system while keeping the component API.
+                            </Paragraph>
+                        </CardBody>
+                    </Card>
+                </Column>
+                <Column ColumnSize="ColumnSize.Is12.Is6.OnDesktop">
+                    <Card Height="Height.Is100">
+                        <CardBody>
+                            <Heading Size="HeadingSize.Is3">Enterprise components</Heading>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is3.FromBottom">
+                                Look beyond buttons, inputs, and grids. Check whether the library covers the workflows that matter to your application, such as reporting, scheduling, or data analysis.
+                            </Paragraph>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is3.FromBottom">
+                                Blazorise includes Reporting with designer and preview, DataGrid, Gantt, Scheduler, Charts, Maps, PivotGrid, and other specialized components.
+                            </Paragraph>
+                            <Paragraph TextColor="TextColor.Muted" Margin="Margin.Is0.FromBottom">
+                                Evaluate those workflows with your own data. Using one library can reduce the integration and maintenance work involved in combining several third-party packages.
+           
```

**File**: `Documentation/Blazorise.Docs/Pages/Home/Components/HomeLibraryComparisonSection.razor` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<Container>
+    <Div Class="b-library-comparison-intro" Margin="Margin.Is4.FromBottom">
+        <Paragraph Class="b-visual-eyebrow">CHOOSING A BLAZOR UI LIBRARY</Paragraph>
+        <Heading Size="HeadingSize.Is2" TextWeight="TextWeight.Bold">How Blazorise compares</Heading>
+        <Paragraph TextSize="TextSize.Large" TextColor="TextColor.Muted" Margin="Margin.Is0.FromBottom">
+            One component API. Multiple design systems. Built-in enterprise components. See how Blazorise compares with other Blazor UI libraries.
+        </Paragraph>
+    </Div>
+
+    <LibraryComparisonTable />
+
+    <Div Class="b-library-comparison-footer" Flex="Flex.JustifyContent.Between.AlignItems.Center.Wrap" Gap="Gap.Is3" Margin="Margin.Is4.FromTop">
+        <Span TextColor="TextColor.Muted" TextSize="TextSize.Small">Comparison based on publicly available product documentation. Last reviewed September 2026.</Span>
+        <Div Flex="Flex.AlignItems.Center.Wrap" Gap="Gap.Is3">
+            <Anchor To="compare-blazor-libraries">See sources and how to choose <Span aria-hidden="true">→</Span></Anchor>
+        </Div>
+    </Div>
+</Container>
\ No newline at end of file
```

**File**: `Documentation/Blazorise.Docs/Pages/Home/Components/LibraryComparisonTable.razor` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+<Div Class="b-library-comparison-region" role="region" aria-label="Blazor component library comparison" tabindex="0">
+    <Table Class="b-library-comparison" aria-label="How Blazorise compares with MudBlazor, Radzen Blazor Components, and Telerik UI for Blazor">
+        <TableHeader>
+            <TableRow>
+                <TableHeaderCell>Compare by</TableHeaderCell>
+                <TableHeaderCell>Blazorise</TableHeaderCell>
+                <TableHeaderCell>MudBlazor</TableHeaderCell>
+                <TableHeaderCell>Radzen Blazor Components</TableHeaderCell>
+                <TableHeaderCell>Telerik UI for Blazor</TableHeaderCell>
+            </TableRow>
+        </TableHeader>
+        <TableBody>
+            <TableRow>
+                <TableRowHeader>Design system</TableRowHeader>
+                <TableRowCell>One API across Material 3 Expressive, Fluent 2, Ant Design v6, Bootstrap, Tailwind, and Bulma.</TableRowCell>
+                <TableRowCell>Material Design 2-based components with customizable palettes, typography, and light and dark themes.</TableRowCell>
+                <TableRowCell>Free and premium CSS themes, including Material, Material 3 Expressive, and Fluent.</TableRowCell>
+                <TableRowCell>CSS themes and swatches, with theme customization through ThemeBuilder.</TableRowCell>
+            </TableRow>
+            <TableRow>
+                <TableRowHeader>Advanced components</TableRowHeader>
+                <TableRowCell>Reporting with designer and preview, plus DataGrid, Gantt, Scheduler, Charts, Maps, PivotGrid, and more.</TableRowCell>
+                <TableRowCell>Data Grid with grouping and virtualization, plus Charts, Tree View, and File Upload.</TableRowCell>
+                <TableRowCell>DataGrid, Scheduler, Gantt, Charts, PivotDataGrid, and an SSRS report viewer.</TableRowCell>
+                <TableRowCell>Grid, Scheduler, Gantt, Charts, Map, PivotGrid, and other advanced components.</TableRowCell>
+            </TableRow>
+            <TableRow>
+                <TableRowHeader>Developer utilities</TableRowHeader>
+                <TableRowCell>Strongly typed fluent utilities and helpers for styling and layout, plus async validation, JSON localization, breakpoints, theming, and accessibility features.</TableRowCell>
+                <TableRowCell>CSS utility classes, validation, localization, responsive breakpoints, theming, and UI services.</TableRowCell>
+                <TableRowCell>CSS utility classes, responsive layouts, validation, localization, theming, and UI services.</TableRowCell>
+                <TableRowCell>Validation, localization, responsive layouts, theming, accessibility, and keyboard navigation.</TableRowCell>
+            </TableRow>
+            <TableRow>
+                <TableRowHeader>Licensing</TableRowHeader>
+                <TableRowCell>Free Community license for eligible individuals. Commercial licenses for organizations.</TableRowCell>
+                <TableRowCell>MIT-licensed open-source components.</TableRowCell>
+                <TableRowCell>MIT-licensed components. Free and paid Radzen Blazor Studio editions, with premium themes available by subscription.</TableRowCell>
+                <TableRowCell>Commercial license with a free trial.</TableRowCell>
+            </TableRow>
+        </TableBody>
+    </Table>
+</Div>
\ No newline at end of file
```

**File**: `Documentation/Blazorise.Docs/Pages/Home/Index.razor` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@
     <section class="b-visual-section b-visual-frameworks" aria-label="CSS frameworks and demos">
         <HomeFrameworksSection />
     </section>
+    <section class="b-visual-section b-visual-library-comparison" aria-label="Compare Blazor component libraries">
+        <HomeLibraryComparisonSection />
+    </section>
     <section class="b-visual-section b-visual-utility" aria-label="Razor utilities">
         <HomeUtilitySection />
     </section>
```

**File**: `Documentation/Blazorise.Docs/Resources/docs-api-index.json` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ﻿{
-  "generatedUtc": "2026-09-23T19:51:36.7481054Z",
+  "generatedUtc": "2026-09-24T12:15:04.8294294Z",
   "components": [
     {
       "type": "global::Blazorise.Abbreviation",
```

**File**: `Documentation/Blazorise.Docs/wwwroot/website.css` (modified, +22/-0)
```diff
@@ -490,6 +490,28 @@
 .b-pricing-compare .table .text-light { color: var(--b-visual-muted) !important; }
 .b-pricing-compare .b-pricing-table-region { border: 1px solid var(--b-visual-line); border-radius: .5rem; overflow-x: auto; }
 .b-pricing-compare .table-responsive { overflow: visible; }
+.b-visual-library-comparison { background: #f2edf7; }
+.b-library-comparison-intro { max-width: 53rem; }
+.b-library-comparison-intro .b-visual-eyebrow { color: #7722b4; }
+.b-library-comparison-region { max-width: 100%; overflow-x: auto; border: 1px solid var(--b-visual-line); border-radius: var(--b-visual-radius); background: var(--b-visual-paper); box-shadow: 0 14px 40px rgba(30, 17, 43, .055); }
+.b-library-comparison { width: 100%; min-width: 940px; margin: 0; table-layout: fixed; --bs-table-bg: var(--b-visual-paper); --bs-table-color: var(--b-visual-ink); font-size: .96rem; line-height: 1.55; }
+.b-library-comparison :is(th, td) { padding: 1.15rem 1.2rem; border-color: var(--b-visual-line); vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
+.b-library-comparison thead th { --bs-table-bg: #2c2035; --bs-table-color: #fff; background: #2c2035; color: #fff; font-size: .94rem; font-weight: 700; }
+.b-library-comparison thead th:first-child { width: 15%; }
+.b-library-comparison thead th:not(:first-child) { width: 21.25%; }
+.b-library-comparison thead th:nth-child(2) { --bs-table-bg: #68238d; background: #68238d; }
+.b-library-comparison tbody th { position: sticky; left: 0; z-index: 1; --bs-table-bg: var(--b-visual-paper); background: var(--b-visual-paper); font-weight: 700; }
+.b-library-comparison tbody td:nth-child(2) { --bs-table-bg: color-mix(in srgb, var(--b-visual-violet) 9%, var(--b-visual-paper)); background: var(--bs-table-bg); }
+.b-library-comparison tbody tr:last-child > * { border-bottom: 0; }
+.b-library-comparison-footer a { font-weight: 700; }
+.b-library-comparison-guidance .card { border-top: 3px solid var(--b-visual-violet); }
+.b-library-comparison-guidance .row > div:nth-child(2) .card { border-top-color: var(--b-visual-pink); }
+.b-library-comparison-guidance .row > div:nth-child(3) .card { border-top-color: var(--b-visual-lilac); }
+.b-library-comparison-source-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem 2rem; max-width: 65rem; }
+.b-library-comparison-source-list > div { padding-top: 1rem; border-top: 1px solid var(--b-visual-line); }
+@media (max-width: 767.98px) {
+    .b-library-comparison-source-list { grid-template-columns: 1fr; }
+}
 .b-education-licenses .card { border-top: 4px solid #9317e1; }
 .b-education-licenses .row > div:nth-child(2) .card { border-top-color: #e03d76; }
 .b-education-licenses .card-body { padding: clamp(1.25rem, 3vw, 2.5rem) !important; }
```

---

### Incident Patch 11: `51fc4b13` (2026-09-24)
**Commit Message**: DropZone: fix the race condition when reordering

**File**: `Source/Blazorise/Components/DragDrop/DropZone.razor.cs` (modified, +3/-1)
```diff
@@ -71,8 +71,10 @@ public override async Task SetParametersAsync( ParameterView parameters )
             shouldRerender = true;
             DirtyClasses();
 
-            if ( reorderChanged && Rendered )
+            if ( reorderChanged )
+            {
                 ExecuteAfterRender( UpdateReorderOptions );
+            }
         }
 
         await base.SetParametersAsync( parameters );
```

**File**: `Tests/Blazorise.Tests/Components/DropZoneTest.cs` (modified, +46/-0)
```diff
@@ -1,12 +1,16 @@
+#region Using directives
 using System.Linq;
 using System.Threading.Tasks;
+using Blazorise.Modules;
 using Blazorise.Tests.TestServices;
 using Bunit;
 using Microsoft.AspNetCore.Components;
 using Microsoft.AspNetCore.Components.Web;
 using Microsoft.Extensions.DependencyInjection;
+using Microsoft.JSInterop;
 using Moq;
 using Xunit;
+#endregion
 
 namespace Blazorise.Tests.Components;
 
@@ -58,6 +62,48 @@ public void DropZone_Defaults()
         zone.AllowReorder.Should().BeFalse();
     }
 
+    [Fact]
+    public async Task DropZone_AnimationChangeDuringInitialization_UpdatesJavaScriptOptions()
+    {
+        var initialUpdate = new TaskCompletionSource<bool>();
+        var module = new Mock<IJSDragDropModule>();
+        module.Setup( x => x.UpdateOptions(
+                It.IsAny<ElementReference>(),
+                It.IsAny<string>(),
+                It.IsAny<DotNetObjectReference<DropZone<object>>>(),
+                It.Is<DragDropJSOptions>( options => options.Animated ) ) )
+            .Returns( new ValueTask( initialUpdate.Task ) );
+
+        Services.AddSingleton( module.Object );
+
+        var comp = Render<DropZone<object>>( parameters => parameters
+            .AddCascadingValue( new DropContainer<object>() )
+            .Add( x => x.AllowReorder, true )
+            .Add( x => x.Animated, true )
+            .Add( x => x.AnimationDuration, 1000 ) );
+
+        module.Verify( x => x.UpdateOptions(
+            It.IsAny<ElementReference>(),
+            It.IsAny<string>(),
+            It.IsAny<DotNetObjectReference<DropZone<object>>>(),
+            It.Is<DragDropJSOptions>( options => options.Animated && options.AnimationDuration == 1000 ) ), Times.Once );
+
+        try
+        {
+            comp.Render( parameters => parameters.Add( x => x.Animated, false ) );
+        }
+        finally
+        {
+            await comp.InvokeAsync( () => initialUpdate.SetResult( true ) );
+        }
+
+        comp.WaitForAssertion( () => module.Verify( x => x.UpdateOptions(
+            It.IsAny<ElementReference>(),
+            It.IsAny<string>(),
+            It.IsAny<DotNetObjectReference<DropZone<object>>>(),
+            It.Is<DragDropJSOptions>( options => !options.Animated && options.AllowReorder ) ), Times.AtLeastOnce ) );
+    }
+
     [Fact]
     public void DropItem_Defaults()
     {
```

---

### Incident Patch 12: `085f0b99` (2026-09-24)
**Commit Message**: Color: support custom CSS colors across components (#6811)

* progress custom colors

* color tests

* button colors

* tests

* tailwind utilties

* alert and badge

* radio, table, srep, etc.

* input colors

* move examples

* refine input colors

* docs and tests

* spinkit and loading indicator

* refactor style builders

* fix radiogroup cache

**File**: `Demos/Shared/Blazorise.Demo/Pages/AlertsPage.razor` (modified, +26/-0)
```diff
@@ -149,6 +149,32 @@
         </Card>
     </Column>
 </Row>
+<Row>
+    <Column>
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use a custom CSS color to style the alert background, border, and text.</CardText>
+            </CardBody>
+            <CardBody>
+                <Alert Color="@("#0F766E")" Visible>
+                    <AlertMessage>Export ready.</AlertMessage>
+                    <AlertDescription>Your report is ready to download.</AlertDescription>
+                </Alert>
+                <Alert Color="@CssColor.Variable("--accent", "#7C3AED")" Visible>
+                    <AlertMessage>Draft saved.</AlertMessage>
+                    <AlertDescription>You can continue editing whenever you are ready.</AlertDescription>
+                </Alert>
+                <Alert Color="@(new Color(CssColor.Rgb(234, 88, 12)))" Visible>
+                    <AlertMessage>Review needed.</AlertMessage>
+                    <AlertDescription>Check the selected files before continuing.</AlertDescription>
+                </Alert>
+            </CardBody>
+        </Card>
+    </Column>
+</Row>
 @code {
     bool dismisableAlert1 = true;
     bool dismisableAlert2 = true;
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/BadgesPage.razor` (modified, +22/-0)
```diff
@@ -121,6 +121,28 @@
         </Card>
     </Column>
 </Row>
+<Row>
+    <Column>
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use custom CSS colors for solid and subtle badges.</CardText>
+            </CardBody>
+            <CardBody>
+                <Div Flex="Flex.Wrap.AlignItems.Center" Gap="Gap.Is2">
+                    <Badge Color="@("#DBB5E6")">Lavender</Badge>
+                    <Badge Color="@(new Color("#312E81"))" Pill>Indigo pill</Badge>
+                    <Badge Color="@("rgb(15, 118, 110)")" Subtle>Teal subtle</Badge>
+                    <Badge Color="@CssColor.Variable("--accent", "#34D399")" Subtle>Accent subtle</Badge>
+                    <Badge Color="@("#0284C7")">Sky</Badge>
+                    <Badge Color="@("#FDE68A")">Amber</Badge>
+                </Div>
+            </CardBody>
+        </Card>
+    </Column>
+</Row>
 @code {
     [Inject] private INotificationService NotificationService { get; set; }
 }
\ No newline at end of file
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/ButtonsPage.razor` (modified, +25/-0)
```diff
@@ -255,6 +255,31 @@
         </Card>
     </Column>
 </Row>
+<Row>
+    <Column>
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use custom CSS colors for filled and outlined buttons, including active, loading, and disabled states.</CardText>
+            </CardBody>
+            <CardBody>
+                <Div Flex="Flex.Wrap.AlignItems.Center" Gap="Gap.Is2">
+                    <Button Color="@("#DBB5E6")">Lavender</Button>
+                    <Button Color="@(new Color("#312E81"))">Indigo</Button>
+                    <Button Color="@("rgb(14, 165, 233)")" Outline>Sky outline</Button>
+                    <Button Color="@(new Color(CssColor.Variable("--accent", "#34D399")))">Accent</Button>
+                    <Button Color="@(new Color("#F97316"))" Active>Active</Button>
+                    <Button Color="@(new Color("#0F766E"))" Loading>Loading</Button>
+                    <Button Color="@(new Color("#64748B"))" Disabled>Disabled</Button>
+                    <Button Color="@(new Color("#BE123C"))" Outline Disabled>Disabled outline</Button>
+                    <Button Color="@(new Color("#FDE68A"))" TextColor="TextColor.Dark">Explicit text color</Button>
+                </Div>
+            </CardBody>
+        </Card>
+    </Column>
+</Row>
 @code {
     private bool isLoading;
 
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/CardsPage.razor` (modified, +2/-2)
```diff
@@ -189,7 +189,7 @@
 <Heading Margin="Margin.Is4.OnY">Stretched link</Heading>
 <Row>
     <Column ColumnSize="ColumnSize.IsQuarter.OnTablet.IsFull.OnMobile">
-        <Card>
+        <Card Margin="Margin.Is4.FromBottom">
             <CardImage Source="_content/Blazorise.Demo/img/cards/image-3.jpg" Alt="Placeholder image" />
             <CardBody>
                 <CardTitle Size="HeadingSize.Is3">
@@ -205,7 +205,7 @@
         </Card>
     </Column>
     <Column ColumnSize="ColumnSize.IsQuarter.OnTablet.IsFull.OnMobile">
-        <Card>
+        <Card Margin="Margin.Is4.FromBottom">
             <CardImage Source="_content/Blazorise.Demo/img/cards/image-3.jpg" Alt="Placeholder image" />
             <CardBody>
                 <CardTitle Size="HeadingSize.Is3">
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/DropdownsPage.razor` (modified, +36/-0)
```diff
@@ -223,4 +223,40 @@
             </CardBody>
         </Card>
     </Column>
+    <Column ColumnSize="ColumnSize.Is12.OnMobile.IsHalf.OnTablet">
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use custom CSS colors for dropdown toggles, outlined toggles, and matching split buttons.</CardText>
+            </CardBody>
+            <CardBody>
+                <Div Flex="Flex.Wrap.AlignItems.Center" Gap="Gap.Is2">
+                    <Dropdown>
+                        <DropdownToggle Color="@("#DBB5E6")">Lavender</DropdownToggle>
+                        <DropdownMenu>
+                            <DropdownItem>Edit</DropdownItem>
+                            <DropdownItem>Duplicate</DropdownItem>
+                        </DropdownMenu>
+                    </Dropdown>
+                    <Dropdown>
+                        <DropdownToggle Color="@("rgb(14, 165, 233)")" Outline>Sky outline</DropdownToggle>
+                        <DropdownMenu>
+                            <DropdownItem>Edit</DropdownItem>
+                            <DropdownItem>Duplicate</DropdownItem>
+                        </DropdownMenu>
+                    </Dropdown>
+                    <Dropdown>
+                        <Button Color="@(new Color("#0F766E"))">Save</Button>
+                        <DropdownToggle Color="@(new Color("#0F766E"))" Split />
+                        <DropdownMenu>
+                            <DropdownItem>Save as draft</DropdownItem>
+                            <DropdownItem>Save a copy</DropdownItem>
+                        </DropdownMenu>
+                    </Dropdown>
+                </Div>
+            </CardBody>
+        </Card>
+    </Column>
 </Row>
\ No newline at end of file
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/FormsPage.razor` (modified, +54/-0)
```diff
@@ -519,6 +519,60 @@
         </Card>
     </Column>
 </Row>
+<Row>
+    <Column ColumnSize="ColumnSize.IsFull.OnMobile.IsHalf.OnTablet">
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom input colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <Paragraph>Set custom border and focus colors while keeping the text color independent.</Paragraph>
+                <Field>
+                    <FieldLabel>Text</FieldLabel>
+                    <TextInput Value="Indigo border" Color="@("#312E81")" />
+                </Field>
+                <Field>
+                    <FieldLabel>Memo</FieldLabel>
+                    <MemoInput Rows="3" Value="Teal border and focus" Color="@(new Color( CssColor.Rgb( 15, 118, 110 ) ))" />
+                </Field>
+                <Field>
+                    <FieldLabel>Masked input</FieldLabel>
+                    <InputMask Mask="99-9999999" Value="12-3456789" Color="@CssColor.Variable( "--input-accent", "#7C3AED" )" />
+                </Field>
+                <Field>
+                    <FieldLabel>Explicit text color</FieldLabel>
+                    <TextInput Value="Independent text color" Color="@("#7C3AED")" TextColor="@(new TextColor( "#0F766E" ))" />
+                </Field>
+            </CardBody>
+        </Card>
+    </Column>
+    <Column ColumnSize="ColumnSize.IsFull.OnMobile.IsHalf.OnTablet">
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom numeric, date, and time colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <Paragraph>Apply custom colors to native numeric, date, and time inputs.</Paragraph>
+                <Field>
+                    <FieldLabel>Number</FieldLabel>
+                    <NumericInput TValue="int" Value="42" Color="@("#312E81")" />
+                </Field>
+                <Field>
+                    <FieldLabel>Date</FieldLabel>
+                    <DateInput TValue="DateOnly" Value="@(new DateOnly( 2026, 6, 15 ))" Color="@(new Color( "#0F766E" ))" />
+                </Field>
+                <Field>
+                    <FieldLabel>Time</FieldLabel>
+                    <TimeInput TValue="TimeOnly" Value="@(new TimeOnly( 9, 30 ))" Color="@CssColor.Variable( "--input-accent", "#7C3AED" )" />
+                </Field>
+                <Field>
+                    <FieldLabel>Disabled</FieldLabel>
+                    <NumericInput TValue="int" Value="65" Color="@("#0F766E")" Disabled />
+                </Field>
+            </CardBody>
+        </Card>
+    </Column>
+</Row>
 @code {
     int[] numbers = { 1, 3, 4 };
 
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/ListGroupPage.razor` (modified, +22/-0)
```diff
@@ -179,6 +179,28 @@
     </Column>
 </Row>
 
+<Row>
+    <Column>
+        <Card Margin="Margin.Is4.FromBottom">
+            <CardHeader>
+                <CardTitle>Custom colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use custom CSS colors for list items, including selected and disabled states.</CardText>
+            </CardBody>
+            <CardBody>
+                <ListGroup Mode="ListGroupMode.Selectable" SelectedItem="indigo">
+                    <ListGroupItem Name="lavender" Color="@("#DBB5E6")">Lavender</ListGroupItem>
+                    <ListGroupItem Name="indigo" Color="@(new Color("#312E81"))">Indigo</ListGroupItem>
+                    <ListGroupItem Name="teal" Color="@("rgb(15, 118, 110)")">Teal</ListGroupItem>
+                    <ListGroupItem Name="accent" Color="@CssColor.Variable("--accent", "#34D399")">Accent</ListGroupItem>
+                    <ListGroupItem Name="disabled" Color="@("#FDE68A")" Disabled>Disabled</ListGroupItem>
+                </ListGroup>
+            </CardBody>
+        </Card>
+    </Column>
+</Row>
+
 @code {
     private bool flush;
     private string selectedItem = "first";
```

**File**: `Demos/Shared/Blazorise.Demo/Pages/MiscFormPage.razor` (modified, +39/-0)
```diff
@@ -743,4 +743,43 @@
             </CardBody>
         </Card>
     </Column>
+</Row>
+<Row>
+    <Column ColumnSize="ColumnSize.Is12.OnMobile.IsHalf.OnTablet">
+        <Card Margin="Margin.Is4.FromTop">
+            <CardHeader>
+                <CardTitle>Custom switch colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Use custom CSS colors for switch tracks with contrasting thumbs.</CardText>
+            </CardBody>
+            <CardBody>
+                <Div Flex="Flex.Wrap" Gap="Gap.Is3">
+                    <Switch TValue="bool" Color="@("#DBB5E6")" Value="true">Lavender</Switch>
+                    <Switch TValue="bool" Color="@(new Color("#312E81"))" Value="true">Indigo</Switch>
+                    <Switch TValue="bool" Color="@CssColor.Variable("--accent", "#34D399")" Value="true">Accent</Switch>
+                    <Switch TValue="bool" Color="@("rgb(15, 118, 110)")">Unchecked</Switch>
+                    <Switch TValue="bool" Color="@("#FDE68A")" Value="true" Disabled>Disabled</Switch>
+                </Div>
+            </CardBody>
+        </Card>
+    </Column>
+    <Column ColumnSize="ColumnSize.Is12.OnMobile.IsHalf.OnTablet">
+        <Card Margin="Margin.Is4.FromTop">
+            <CardHeader>
+                <CardTitle>Custom radio button colors</CardTitle>
+            </CardHeader>
+            <CardBody>
+                <CardText>Set a custom color on a radio button group or override individual buttons.</CardText>
+            </CardBody>
+            <CardBody>
+                <RadioGroup TValue="string" Name="custom-colors" Buttons Color="@("#DBB5E6")" Value="@("lavender")">
+                    <Radio Value="@("lavender")">Lavender</Radio>
+                    <Radio Value="@("indigo")" Color="@(new Color("#312E81"))">Indigo</Radio>
+                    <Radio Value="@("accent")" Color="@CssColor.Variable("--accent", "#34D399")">Accent</Radio>
+                    <Radio Value="@("disabled")" Color="@("#FDE68A")" Disabled>Disabled</Radio>
+                </RadioGroup>
+            </CardBody>
+        </Card>
+    </Column>
 </Row>
\ No newline at end of file
```

---

### Incident Patch 13: `ef5d804b` (2026-09-24)
**Commit Message**: Video: fix the slider position

**File**: `Source/Extensions/Blazorise.Video/Video.razor` (modified, +10/-10)
```diff
@@ -150,17 +150,17 @@
                                         <media-slider-buffer class="media-slider__buffer"></media-slider-buffer>
                                     </media-slider-track>
                                     <media-slider-thumb class="media-slider__thumb"></media-slider-thumb>
-                                    @if ( !string.IsNullOrWhiteSpace( Thumbnails ) )
-                                    {
-                                        <div class="media-thumbnail media-slider__thumbnail">
-                                            <div class="media-thumbnail__image-wrapper">
-                                                <media-slider-thumbnail class="media-thumbnail__image"></media-slider-thumbnail>
-                                            </div>
-                                            <media-slider-value type="pointer" class="media-time media-thumbnail__time"></media-slider-value>
-                                            <svg class="media-thumbnail__spinner media-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" aria-hidden="true" viewBox="0 0 18 18"><style>@@keyframes media-spinner-fade{0%{opacity:1}to{opacity:0}}.media-spinner__segment{animation:var(--media-spinner-animation, media-spinner-fade 1s linear infinite);animation-delay:var(--media-spinner-delay)}</style><path d="M9 1.5v3" class="media-spinner__segment" opacity=".5" style="--media-spinner-delay:0s"/><path d="m14.5 3.5-2 2" class="media-spinner__segment" opacity=".45" style="--media-spinner-delay:0.125s"/><path d="M16.5 9h-3" class="media-spinner__segment" opacity=".4" style="--media-spinner-delay:0.25s"/><path d="m14.5 14.5-2-2" class="media-spinner__segment" opacity=".35" style="--media-spinner-delay:0.375s"/><path d="M9 16.5v-3" class="media-spinner__segment" opacity=".3" style="--media-spinner-delay:0.5s"/><path d="m3.5 14.5 2-2" class="media-spinner__segment" opacity=".25" style="--media-spinner-delay:0.625s"/><path d="M1.5 9h3" class="media-spinner__segment" opacity=".15" style="--media-spinner-delay:0.75s"/><path d="m3.5 3.5 2 2" class="media-spinner__segment" opacity=".1" style="--media-spinner-delay:0.875s"/></svg>
-                                        </div>
-                                    }
                                     <media-slider-preview class="media-slider__preview">
+                                        @if ( !string.IsNullOrWhiteSpace( Thumbnails ) )
+                                        {
+                                            <div class="media-thumbnail media-slider__thumbnail">
+                                                <div class="media-thumbnail__image-wrapper">
+                                                    <media-slider-thumbnail class="media-thumbnail__image"></media-slider-thumbnail>
+                                                </div>
+                                                <media-slider-value type="pointer" class="media-time media-thumbnail__time"></media-slider-value>
+                                                <svg class="media-thumbnail__spinner media-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" aria-hidden="true" viewBox="0 0 18 18"><style>@@keyframes media-spinner-fade{0%{opacity:1}to{opacity:0}}.media-spinner__segment{animation:var(--media-spinner-animation, media-spinner-fade 1s linear infinite);animation-delay:var(--media-spinner-delay)}</style><path d="M9 1.5v3" class="media-spinner__segment" opacity=".5" style="--media-spinner-delay:0s"/><path d="m14.5 3.5-2 2" class="media-spinner__segment" opacity=".45" style="--media-spinner-delay:0.125s"/><path d="M16.5 9h-3" class="media-spinner__segment" opacity=".4" style="--media-spinner-delay:0.25s"/><path d="m14.5 14.5-2-2" class="media-spinner__segment" opacity=".35" style="--media-spinner-delay:0.375s"/><path d="M9 16.5v-3" class="media-spinner__segment" opacity=".3" style="--media-spinner-delay:0.5s"/><path d="m3.5 14.5 2-2" class="media-spinner__segment" opacity=".25" style="--media-spinner-delay:0.625s"/><path d="M1.5 9h3" class="media-spinner__segment" opacity=".15" style="--media-spinner-delay:0.75s"/><path d="m3.5 3.5 2 2" class="media-spinner__segment" opacity=".1" style="--media-spinner-delay:0.875s"/></svg>
+                                            </div>
+                                        }
                                         <media-slider-value type="pointer" class="media-slider__value media-time"></media-slider-value>
                                     </media-slider-preview>
                                 </media-time-slider>
```

---

### Incident Patch 14: `76266cf1` (2026-09-11)
**Commit Message**: BarDropdown: fix JavaScript initialization for wrapperless dropdowns (#6788)

**File**: `Source/Blazorise/Components/Bar/BarDropdown.razor.cs` (modified, +5/-1)
```diff
@@ -81,7 +81,11 @@ protected override void OnAfterRender( bool firstRender )
             if ( !string.IsNullOrWhiteSpace( dropdownToggleClassNames )
                  && !string.IsNullOrWhiteSpace( dropdownMenuClassNames ) )
             {
-                JSModule.Initialize( ElementRef, ElementId, targetElementId: null, menuElementId: null,
+                ElementReference elementRef = string.IsNullOrEmpty( ElementRef.Id )
+                    ? ParentBarItem?.ElementRef ?? ElementRef
+                    : ElementRef;
+
+                JSModule.Initialize( elementRef, ElementId, targetElementId: null, menuElementId: null,
                     options: new()
                     {
                         Direction = GetFloatingDirection().ToString( "g" ),
```

**File**: `Source/Blazorise/wwwroot/utilities.js` (modified, +1/-1)
```diff
@@ -440,7 +440,7 @@ function estimateNumberInputCaret(element, clientX) {
 }
 
 export function getRequiredElement(element, elementId) {
-    if (element)
+    if (element instanceof Element)
         return element;
 
     return document.getElementById(elementId);
```

---

### Incident Patch 15: `1481e7f6` (2026-09-02)
**Commit Message**: Base input: capture value changes before first render completes (#6785)

**File**: `Source/Blazorise/Base/BaseInputComponent.cs` (modified, +1/-1)
```diff
@@ -130,7 +130,7 @@ public abstract class BaseInputComponent<TValue, TClasses, TStyles> : BaseCompon
     protected virtual void CaptureParameters( ParameterView parameters )
     {
         // Capture synchronously since ParameterView is not safe after awaits.
-        if ( Rendered )
+        if ( Rendered || hasInitializedParameters )
             parameters.TryGetParameter( Value, IsSameAsInternalValue, out paramValue );
         else
             paramValue = new ComponentParameterInfo<TValue>( default );
```

#### Recent Merged Pull Requests:
- **PR #6835** (2026-10-05): Chore: add a net11 prefered build (@stsrki)
- **PR #6834** (2026-10-05): Dropdown: preserve outside-click closing when other dropdowns are cre… (@stsrki)
- **PR #6832** (2026-10-05): ColorPicker: add ShowValue support across providers (@stsrki)
- **PR #6831** (2026-10-04): Build: Centralize asset versioning and move generated documentation to obj (@stsrki)
- **PR #6829** (2026-10-02): Chore: Clean up component internals and remove obsolete picker interop (@stsrki)
- **PR #6828** (2026-10-02): Chore: Add .NET 11 RC1 support (@stsrki)
- **PR #6827** (2026-10-01): Docs: clarify API defaults and improve table readability (@stsrki)
- **PR #6825** (2026-09-30): Steps: improve accessibility, layout options, and provider styling (@stsrki)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
