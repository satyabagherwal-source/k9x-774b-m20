# Forensic Learning Record (Deep Inspection): themesberg/flowbite

> **Canonical Artifact**: `07_PROJECT_LEARNING/themesberg-flowbite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/themesberg/flowbite](https://github.com/themesberg/flowbite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:39.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `themesberg/flowbite`
- **Description**: Open-source UI component library and front-end development framework based on Tailwind CSS
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9368 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    env: {
        node: true,
        browser: true,
        es6: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
};

```

### Core Architecture Module: `plugin-windicss.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */
const svgToDataUri = require('mini-svg-data-uri');
const plugin = require('windicss/plugin');
const defaultTheme = require('windicss/defaultTheme');
const colors = require('windicss/colors');
const [baseFontSize, { lineHeight: baseLineHeight }] =
    defaultTheme.fontSize.base;
const { spacing, borderWidth, borderRadius } = defaultTheme;

module.exports = plugin(
    function ({ addBase, theme }) {
        addBase({
            [[
                "[type='text']",
                "[type='email']",
                "[type='url']",
                "[type='password']",
                "[type='number']",
                "[type='date']",
                "[type='datetime-local']",
                "[type='month']",
                "[type='search']",
                "[type='tel']",
                "[type='time']",
                "[type='week']",
                '[multiple]',
                'textarea',
                'select',
            ]]: {
                appearance: 'none',
                'background-color': '#fff',
                'border-color': theme('colors.gray.500', colors.gray[500]),
                'border-width': borderWidth['DEFAULT'],
                'border-radius': borderRadius.none,
                'padding-top': spacing[2],
                'padding-right': spacing[3],
                'padding-bottom': spacing[2],
                'padding-left': spacing[3],
                'font-size': baseFontSize,
                'line-height': baseLineHeight,
                '--tw-shadow': '0 0 #0000',
                '&:focus': {
                    outline: '2px solid transparent',
                    'outline-offset': '2px',
                    '--tw-ring-inset': 'var(--tw-empty,/*!*/ /*!*/)',
                    '--tw-ring-offset-width': '0px',
                    '--tw-ring-offset-color': '#fff',
                    '--tw-ring-color': theme(
                        'colors.blue.600',
                        colors.blue[600]
                    ),
                    '--tw-ring-offset-shadow': `var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)`,
                    '--tw-ring-shadow': `var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color)`,
                    'box-shadow': `var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)`,
                    'border-color': theme('colors.blue.600', colors.blue[600]),
                },
            },
            [['input::placeholder', 'textarea::placeholder']]: {
                color: theme('colors.gray.500', colors.gray[500]),
                opacity: '1',
            },
            ['::-webkit-datetime-edit-fields-wrapper']: {
                padding: '0',
            },
            ['::-webkit-date-and-time-value']: {
                'min-height': '1.5em',
            },
            ['select']: {
                'background-image': `url("${svgToDataUri(
                    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="${theme(
                        'colors.gray.500',
                        colors.gray[500]
                    )}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/></svg>`
                )}")`,
                'background-position': `right ${spacing[2]} center`,
                'background-repeat': `no-repeat`,
                'background-size': `1.5em 1.5em`,
                'padding-right': spacing[10],
                'print-color-adjust': `exact`,
            },
            ['[multiple]']: {
                'background-image': 'initial',
                'background-position': 'initial',
                'background-repeat': 'unset',
                'background-size': 'initial',
                'padding-right': spacing[3],
                'print-color-adjust': 'unset',
            },
            [[`[type='checkbox']`, `[type='radio']`]]: {
                appearance: 'none',
                padding: '0',
                'print-color-adjust': 'exact',
                display: 'inline-block',
                'vertical-align': 'middle',
                'background-origin': 'border-box',
                'user-select': 'none',
                'flex-shrink': '0',
                height: spacing[4],
                width: spacing[4],
                color: theme('colors.blue.600', colors.blue[600]),
                'background-color': '#fff',
                'border-color': theme('colors.gray.500', colors.gray[500]),
                'border-width': borderWidth['DEFAULT'],
                '--tw-shadow': '0 0 #0000',
            },
            [`[type='checkbox']`]: {
                'border-radius': borderRadius['none'],
            },
            [`[type='radio']`]: {
                'border-radius': '100%',
            },
            [[`[type='checkbox']:focus`, `[type='radio']:focus`]]: {
                outline: '2px solid transparent',
                'outline-offset': '2px',
                '--tw-ring-inset': 'var(--tw-empty,/*!*/ /*!*/)',
                '--tw-ring-offset-width': '2px',
                '--tw-ring-offset-color': '#fff',
                '--tw-ring-color': theme('colors.blue.600', colors.blue[600]),
                '--tw-ring-offset-shadow': `var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)`,
                '--tw-ring-shadow': `var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color)`,
                'box-shadow': `var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)`,
            },
            [[
                `[type='checkbox']:checked`,
                `[type='radio']:checked`,
                `.dark [type='checkbox']:checked`,
                `.dark [type='radio']:checked`,
            ]]: {
                'border-color': `transparent`,
                'background-color': `var(--color-brand)`,
                'background-size': `100% 100%`,
                'background-position': `center`,
                'background-repeat': `no-repeat`,
            },
            [`[type='checkbox']:checked`]: {
                'background-image': `url("${svgToDataUri(
                    `<svg viewBox="0 0 16 16" fill="#ccc" xmlns="http://www.w3.org/2000/svg"><path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z"/></svg>`
                )}")`,
            },
            [`[type='radio']:checked`]: {
                'background-image': `url("${svgToDataUri(
                    `<svg viewBox="0 0 16 16" fill="#ccc" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="3"/></svg>`
                )}")`,
            },
            [`[type='checkbox']:indeterminate`]: {
                'background-image': `url("${svgToDataUri(
                    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16"><path stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h8"/></svg>`
                )}")`,
                'border-color': `transparent`,
                'background-color': `var(--color-brand)`,
                'background-size': `100% 100%`,
                'background-position': `center`,
                'background-repeat': `no-repeat`,
            },
            [[
                `[type='checkbox']:indeterminate:hover`,
                `[type='checkbox']:indeterminate:focus`,
            ]]: {
                'border-color': 'transparent',
                'background-color': 'var(--color-brand)',
            },
            [`[type='file']`]: {
                background: 'unset',
                'border-color': 'inherit',
                'border-width': '0',
                'border-radius': '0',
                padding: '0',
                'font-size': 'unset',
                'line-height': 'inherit',
            },
            [`[type='file']:focus`]: {
                outline: `1px auto inherit`,
            },
            [[`input[type=file]::file-selector-button`]]: {
                color: 'white',
                background: theme('colors.gray.800', colors.gray[800]),
                border: 0,
                'font-weight': theme('fontWeight.medium'),
                'font-size': theme('fontSize.sm'),
                cursor: 'pointer',
                'padding-top': spacing[2.5],
                'padding-bottom': spacing[2.5],
                'padding-left': spacing[8],
                'padding-right': spacing[4],
                'margin-inline-start': '-1rem',
                'margin-inline-end': '1rem',
                '&:hover': {
                    background: theme('colors.gray.700', colors.gray[700]),
                },
            },
            [[`.dark input[type=file]::file-selector-button`]]: {
                color: 'white',
                background: theme('colors.gray.600', colors.gray[600]),
                '&:hover': {
                    background: theme('colors.gray.500', colors.gray[500]),
                },
            },
            [[`input[type="range"]::-webkit-slider-thumb`]]: {
                height: spacing[5],
                width: spacing[5],
                background: theme('colors.blue.600', colors.blue[600]),
                'border-radius': borderRadius.full,
                border: 0,
                appearance: 'none',
                '-moz-appearance': 'none',
                '-webkit-appearance': 'none',
                cursor: 'pointer',
            },
            [[`input[type="range"]:disabled::-webkit-slider-thumb`]]: {
                background: theme('colors.gray.400', colors.gray[400]),
            },
            [[`.dark input[type="range"]:disabled::-webkit-slider-thumb`]]: {
                background: theme('colors.gray.500', colors.gray[500]),
            },
            [[`input[type="range"]:focus::-webkit-slider-thumb`]]: {
                outline: 
```

### Core Architecture Module: `plugin.d.ts`
```
declare const plugin: { handler: () => void };
export = plugin;

```

### Core Architecture Module: `plugin.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */
const svgToDataUri = require('mini-svg-data-uri');
const plugin = require('tailwindcss/plugin');
const defaultTheme = require('tailwindcss/defaultTheme');
const colors = require('tailwindcss/colors');
const [baseFontSize, { lineHeight: baseLineHeight }] =
    defaultTheme.fontSize.base;
const { spacing, borderWidth, borderRadius, boxShadow } = defaultTheme;

module.exports = plugin.withOptions(function (options = {}) {
    // Enable forms and tooltip by default if not specified in options
    const {
        charts = true,
        datatables = true,
        forms = true,
        tooltips = true,
        wysiwyg = true,
    } = options;

    return function ({ addBase, addComponents, theme }) {
        // tooltip and popover styles
        if (tooltips) {
            addBase({
                // remove from v2.x+ END
                [['.tooltip-arrow', '.tooltip-arrow:before']]: {
                    position: 'absolute',
                    width: '8px',
                    height: '8px',
                    background: 'inherit',
                },
                [['.tooltip-arrow']]: {
                    visibility: 'hidden',
                },
                [['.tooltip-arrow:before']]: {
                    content: '""',
                    visibility: 'visible',
                    transform: 'rotate(45deg)',
                },
                [`[data-tooltip-style^='light'] + .tooltip > .tooltip-arrow:before`]:
                    {
                        'border-style': 'solid',
                        'border-color': 'var(--color-neutral-tertiary)',
                    },
                [`[data-tooltip-style^='light'] + .tooltip[data-popper-placement^='top'] > .tooltip-arrow:before`]:
                    {
                        'border-bottom-width': '1px',
                        'border-right-width': '1px',
                    },
                [`[data-tooltip-style^='light'] + .tooltip[data-popper-placement^='right'] > .tooltip-arrow:before`]:
                    {
                        'border-bottom-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-tooltip-style^='light'] + .tooltip[data-popper-placement^='bottom'] > .tooltip-arrow:before`]:
                    {
                        'border-top-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-tooltip-style^='light'] + .tooltip[data-popper-placement^='left'] > .tooltip-arrow:before`]:
                    {
                        'border-top-width': '1px',
                        'border-right-width': '1px',
                    },
                [`.tooltip[data-popper-placement^='top'] > .tooltip-arrow`]: {
                    bottom: '-3px',
                },
                [`.tooltip[data-popper-placement^='bottom'] > .tooltip-arrow`]:
                    {
                        top: '-3px',
                    },
                [`.tooltip[data-popper-placement^='left'] > .tooltip-arrow`]: {
                    right: '-3px',
                },
                [`.tooltip[data-popper-placement^='right'] > .tooltip-arrow`]: {
                    left: '-3px',
                },
                ['.tooltip.invisible > .tooltip-arrow:before']: {
                    visibility: 'hidden',
                },
                [['[data-popper-arrow]', '[data-popper-arrow]:before']]: {
                    position: 'absolute',
                    width: '8px',
                    height: '8px',
                    background: 'inherit',
                },
                ['[data-popper-arrow]']: {
                    visibility: 'hidden',
                },
                ['[data-popper-arrow]:before']: {
                    content: '""',
                    visibility: 'visible',
                    transform: 'rotate(45deg)',
                },
                ['[data-popper-arrow]:after']: {
                    content: '""',
                    visibility: 'visible',
                    transform: 'rotate(45deg)',
                    position: 'absolute',
                    width: '9px',
                    height: '9px',
                    background: 'inherit',
                },
                [`[role="tooltip"] > [data-popper-arrow]:before`]: {
                    'border-style': 'solid',
                    'border-color': 'var(--color-neutral-tertiary)',
                },
                [`.dark [role="tooltip"] > [data-popper-arrow]:before`]: {
                    'border-style': 'solid',
                    'border-color': 'var(--color-dark)',
                },
                [`[role="tooltip"] > [data-popper-arrow]:after`]: {
                    'border-style': 'solid',
                    'border-color': 'var(--color-neutral-tertiary)',
                },
                [`.dark [role="tooltip"] > [data-popper-arrow]:after`]: {
                    'border-style': 'solid',
                    'border-color': 'var(--color-dark)',
                },
                [`[data-popover][role="tooltip"][data-popper-placement^='top'] > [data-popper-arrow]:before`]:
                    {
                        'border-bottom-width': '1px',
                        'border-right-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='top'] > [data-popper-arrow]:after`]:
                    {
                        'border-bottom-width': '1px',
                        'border-right-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='right'] > [data-popper-arrow]:before`]:
                    {
                        'border-bottom-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='right'] > [data-popper-arrow]:after`]:
                    {
                        'border-bottom-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='bottom'] > [data-popper-arrow]:before`]:
                    {
                        'border-top-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='bottom'] > [data-popper-arrow]:after`]:
                    {
                        'border-top-width': '1px',
                        'border-left-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='left'] > [data-popper-arrow]:before`]:
                    {
                        'border-top-width': '1px',
                        'border-right-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='left'] > [data-popper-arrow]:after`]:
                    {
                        'border-top-width': '1px',
                        'border-right-width': '1px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='top'] > [data-popper-arrow]`]:
                    {
                        bottom: '-4px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='bottom'] > [data-popper-arrow]`]:
                    {
                        top: '-4px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='left'] > [data-popper-arrow]`]:
                    {
                        right: '-4px',
                    },
                [`[data-popover][role="tooltip"][data-popper-placement^='right'] > [data-popper-arrow]`]:
                    {
                        left: '-4px',
                    },
                ['[role="tooltip"].invisible > [data-popper-arrow]:before']: {
                    visibility: 'hidden',
                },
                ['[role="tooltip"].invisible > [data-popper-arrow]:after']: {
                    visibility: 'hidden',
                },
            });
        }

        // form styles
        if (forms) {
            addBase({
                [[
                    "[type='text']",
                    "[type='email']",
                    "[type='url']",
                    "[type='password']",
                    "[type='number']",
                    "[type='date']",
                    "[type='datetime-local']",
                    "[type='month']",
                    "[type='search']",
                    "[type='tel']",
                    "[type='time']",
                    "[type='week']",
                    '[multiple]',
                    'textarea',
                    'select',
                ]]: {
                    appearance: 'none',
                    'background-color': '#fff',
                    'border-color': 'var(--color-body)',
                    'border-width': borderWidth['DEFAULT'],
                    'border-radius': borderRadius.none,
                    'padding-top': spacing[2],
                    'padding-right': spacing[3],
                    'padding-bottom': spacing[2],
                    'padding-left': spacing[3],
                    'font-size': baseFontSize,
                    'line-height': baseLineHeight,
                    '--tw-shadow': '0 0 #0000',
                    '&:focus': {
                        outline: '2px solid transparent',
                        'outline-offset': '2px',
                        '--tw-ring-inset': 'var(--tw-empty,/*!*/ /*!*/)',
                        '--tw-ring-offset-width': '0px',
                        '--tw-ring-offset-color': '#fff',
                        '--tw-ring-color': 'var(--color-brand)',
                        '--tw-ring-offset-shadow': `var(--tw-rin
```

### Core Architecture Module: `postcss.config.js`
```
/* eslint-disable @typescript-eslint/no-var-requires */
module.exports = {
    plugins: {
        '@tailwindcss/postcss': {},
        'cssnano':
            process.env.NPM_ENV === 'production'
                ? { preset: 'default' }
                : false,
    },
};

```

### Core Architecture Module: `src/components/accordion/index.ts`
```
/* eslint-disable @typescript-eslint/no-empty-function */
import type { AccordionItem, AccordionOptions } from './types';
import type { InstanceOptions } from '../../dom/types';
import { AccordionInterface } from './interface';
import instances from '../../dom/instances';

const Default: AccordionOptions = {
    alwaysOpen: false,
    activeClasses: 'bg-neutral-secondary-medium text-heading',
    inactiveClasses: 'bg-neutral-primary text-body',
    onOpen: () => {},
    onClose: () => {},
    onToggle: () => {},
};

const DefaultInstanceOptions: InstanceOptions = {
    id: null,
    override: true,
};

class Accordion implements AccordionInterface {
    _instanceId: string;
    _accordionEl: HTMLElement;
    _items: AccordionItem[];
    _options: AccordionOptions;
    _clickHandler: EventListenerOrEventListenerObject;
    _initialized: boolean;

    constructor(
        accordionEl: HTMLElement | null = null,
        items: AccordionItem[] = [],
        options: AccordionOptions = Default,
        instanceOptions: InstanceOptions = DefaultInstanceOptions
    ) {
        this._instanceId = instanceOptions.id
            ? instanceOptions.id
            : accordionEl.id;
        this._accordionEl = accordionEl;
        this._items = items;
        this._options = { ...Default, ...options };
        this._initialized = false;
        this.init();
        instances.addInstance(
            'Accordion',
            this,
            this._instanceId,
            instanceOptions.override
        );
    }

    init() {
        if (this._items.length && !this._initialized) {
            // show accordion item based on click
            this._items.forEach((item) => {
                if (item.active) {
                    this.open(item.id);
                }

                const clickHandler = () => {
                    this.toggle(item.id);
                };

                item.triggerEl.addEventListener('click', clickHandler);

                // Store the clickHandler in a property of the item for removal later
                item.clickHandler = clickHandler;
            });
            this._initialized = true;
        }
    }

    destroy() {
        if (this._items.length && this._initialized) {
            this._items.forEach((item) => {
                item.triggerEl.removeEventListener('click', item.clickHandler);

                // Clean up by deleting the clickHandler property from the item
                delete item.clickHandler;
            });
            this._initialized = false;
        }
    }

    removeInstance() {
        instances.removeInstance('Accordion', this._instanceId);
    }

    destroyAndRemoveInstance() {
        this.destroy();
        this.removeInstance();
    }

    getItem(id: string) {
        return this._items.filter((item) => item.id === id)[0];
    }

    open(id: string) {
        const item = this.getItem(id);

        // don't hide other accordions if always open
        if (!this._options.alwaysOpen) {
            this._items.map((i) => {
                if (i !== item) {
                    i.triggerEl.classList.remove(
                        ...this._options.activeClasses.split(' ')
                    );
                    i.triggerEl.classList.add(
                        ...this._options.inactiveClasses.split(' ')
                    );
                    i.targetEl.classList.add('hidden');
                    i.triggerEl.setAttribute('aria-expanded', 'false');
                    i.active = false;

                    // rotate icon if set
                    if (i.iconEl) {
                        i.iconEl.classList.add('rotate-180');
                    }
                }
            });
        }

        // show active item
        item.triggerEl.classList.add(...this._options.activeClasses.split(' '));
        item.triggerEl.classList.remove(
            ...this._options.inactiveClasses.split(' ')
        );
        item.triggerEl.setAttribute('aria-expanded', 'true');
        item.targetEl.classList.remove('hidden');
        item.active = true;

        // rotate icon if set
        if (item.iconEl) {
            item.iconEl.classList.remove('rotate-180');
        }

        // callback function
        this._options.onOpen(this, item);
    }

    toggle(id: string) {
        const item = this.getItem(id);

        if (item.active) {
            this.close(id);
        } else {
            this.open(id);
        }

        // callback function
        this._options.onToggle(this, item);
    }

    close(id: string) {
        const item = this.getItem(id);

        item.triggerEl.classList.remove(
            ...this._options.activeClasses.split(' ')
        );
        item.triggerEl.classList.add(
            ...this._options.inactiveClasses.split(' ')
        );
        item.targetEl.classList.add('hidden');
        item.triggerEl.setAttribute('aria-expanded', 'false');
        item.active = false;

        // rotate icon if set
        if (item.iconEl) {
            item.iconEl.classList.add('rotate-180');
        }

        // callback function
        this._options.onClose(this, item);
    }

    updateOnOpen(callback: () => void) {
        this._options.onOpen = callback;
    }

    updateOnClose(callback: () => void) {
        this._options.onClose = callback;
    }

    updateOnToggle(callback: () => void) {
        this._options.onToggle = callback;
    }
}

export function initAccordions() {
    document.querySelectorAll('[data-accordion]').forEach(($accordionEl) => {
        const alwaysOpen = $accordionEl.getAttribute('data-accordion');
        const activeClasses = $accordionEl.getAttribute('data-active-classes');
        const inactiveClasses = $accordionEl.getAttribute(
            'data-inactive-classes'
        );

        const items = [] as AccordionItem[];
        $accordionEl
            .querySelectorAll('[data-accordion-target]')
            .forEach(($triggerEl) => {
                // Consider only items that directly belong to $accordionEl
                // (to make nested accordions work).
                if ($triggerEl.closest('[data-accordion]') === $accordionEl) {
                    const item = {
                        id: $triggerEl.getAttribute('data-accordion-target'),
                        triggerEl: $triggerEl,
                        targetEl: document.querySelector(
                            $triggerEl.getAttribute('data-accordion-target')
                        ),
                        iconEl: $triggerEl.querySelector(
                            '[data-accordion-icon]'
                        ),
                        active:
                            $triggerEl.getAttribute('aria-expanded') === 'true'
                                ? true
                                : false,
                    } as AccordionItem;
                    items.push(item);
                }
            });

        new Accordion($accordionEl as HTMLElement, items, {
            alwaysOpen: alwaysOpen === 'open' ? true : false,
            activeClasses: activeClasses
                ? activeClasses
                : Default.activeClasses,
            inactiveClasses: inactiveClasses
                ? inactiveClasses
                : Default.inactiveClasses,
        } as AccordionOptions);
    });
}

if (typeof window !== 'undefined') {
    window.Accordion = Accordion;
    window.initAccordions = initAccordions;
}

export default Accordion;

```

### Core Architecture Module: `src/components/accordion/interface.ts`
```
// Import the AccordionItem and AccordionOptions interfaces
import { AccordionItem, AccordionOptions } from './types';

// Define the Accordion interface
export declare interface AccordionInterface {
    _items: AccordionItem[];
    _options: AccordionOptions;

    getItem(id: string): AccordionItem | undefined;
    open(id: string): void;
    toggle(id: string): void;
    close(id: string): void;

    destroy(): void;
    removeInstance(): void;
    destroyAndRemoveInstance(): void;
}

```

### Core Architecture Module: `src/components/accordion/types.ts`
```
import { AccordionInterface } from './interface';

export declare type AccordionItem = {
    id: string;
    triggerEl: HTMLElement;
    targetEl: HTMLElement;
    iconEl?: HTMLElement | null;
    active?: boolean;
    clickHandler?: EventListenerOrEventListenerObject;
};

export declare type AccordionOptions = {
    alwaysOpen?: boolean;
    activeClasses?: string;
    inactiveClasses?: string;
    onOpen?: (accordion: AccordionInterface, item: AccordionItem) => void;
    onClose?: (accordion: AccordionInterface, item: AccordionItem) => void;
    onToggle?: (accordion: AccordionInterface, item: AccordionItem) => void;
};

```

### Core Architecture Module: `src/components/carousel/index.ts`
```
/* eslint-disable @typescript-eslint/no-empty-function */
import type {
    CarouselOptions,
    CarouselItem,
    IndicatorItem,
    RotationItems,
} from './types';
import type { InstanceOptions } from '../../dom/types';
import { CarouselInterface } from './interface';
import instances from '../../dom/instances';

const Default: CarouselOptions = {
    defaultPosition: 0,
    indicators: {
        items: [],
        activeClasses: 'bg-white dark:bg-gray-800',
        inactiveClasses:
            'bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800',
    },
    interval: 3000,
    onNext: () => {},
    onPrev: () => {},
    onChange: () => {},
};

const DefaultInstanceOptions: InstanceOptions = {
    id: null,
    override: true,
};

class Carousel implements CarouselInterface {
    _instanceId: string;
    _carouselEl: HTMLElement;
    _items: CarouselItem[];
    _indicators: IndicatorItem[];
    _activeItem: CarouselItem;
    _intervalDuration: number;
    _intervalInstance: number;
    _options: CarouselOptions;
    _initialized: boolean;

    constructor(
        carouselEl: HTMLElement | null = null,
        items: CarouselItem[] = [],
        options: CarouselOptions = Default,
        instanceOptions: InstanceOptions = DefaultInstanceOptions
    ) {
        this._instanceId = instanceOptions.id
            ? instanceOptions.id
            : carouselEl.id;
        this._carouselEl = carouselEl;
        this._items = items;
        this._options = {
            ...Default,
            ...options,
            indicators: { ...Default.indicators, ...options.indicators },
        };
        this._activeItem = this.getItem(this._options.defaultPosition);
        this._indicators = this._options.indicators.items;
        this._intervalDuration = this._options.interval;
        this._intervalInstance = null;
        this._initialized = false;
        this.init();
        instances.addInstance(
            'Carousel',
            this,
            this._instanceId,
            instanceOptions.override
        );
    }

    /**
     * initialize carousel and items based on active one
     */
    init() {
        if (this._items.length && !this._initialized) {
            this._items.map((item: CarouselItem) => {
                item.el.classList.add(
                    'absolute',
                    'inset-0',
                    'transition-transform',
                    'transform'
                );
            });

            // if no active item is set then first position is default
            if (this.getActiveItem()) {
                this.slideTo(this.getActiveItem().position);
            } else {
                this.slideTo(0);
            }

            this._indicators.map((indicator, position) => {
                indicator.el.addEventListener('click', () => {
                    this.slideTo(position);
                });
            });

            this._initialized = true;
        }
    }

    destroy() {
        if (this._initialized) {
            this._initialized = false;
        }
    }

    removeInstance() {
        instances.removeInstance('Carousel', this._instanceId);
    }

    destroyAndRemoveInstance() {
        this.destroy();
        this.removeInstance();
    }

    getItem(position: number) {
        return this._items[position];
    }

    /**
     * Slide to the element based on id
     * @param {*} position
     */
    slideTo(position: number) {
        const nextItem: CarouselItem = this._items[position];
        const rotationItems: RotationItems = {
            left:
                nextItem.position === 0
                    ? this._items[this._items.length - 1]
                    : this._items[nextItem.position - 1],
            middle: nextItem,
            right:
                nextItem.position === this._items.length - 1
                    ? this._items[0]
                    : this._items[nextItem.position + 1],
        };
        this._rotate(rotationItems);
        this._setActiveItem(nextItem);
        if (this._intervalInstance) {
            this.pause();
            this.cycle();
        }

        this._options.onChange(this);
    }

    /**
     * Based on the currently active item it will go to the next position
     */
    next() {
        const activeItem = this.getActiveItem();
        let nextItem = null;

        // check if last item
        if (activeItem.position === this._items.length - 1) {
            nextItem = this._items[0];
        } else {
            nextItem = this._items[activeItem.position + 1];
        }

        this.slideTo(nextItem.position);

        // callback function
        this._options.onNext(this);
    }

    /**
     * Based on the currently active item it will go to the previous position
     */
    prev() {
        const activeItem = this.getActiveItem();
        let prevItem = null;

        // check if first item
        if (activeItem.position === 0) {
            prevItem = this._items[this._items.length - 1];
        } else {
            prevItem = this._items[activeItem.position - 1];
        }

        this.slideTo(prevItem.position);

        // callback function
        this._options.onPrev(this);
    }

    /**
     * This method applies the transform classes based on the left, middle, and right rotation carousel items
     * @param {*} rotationItems
     */
    _rotate(rotationItems: RotationItems) {
        // reset
        this._items.map((item: CarouselItem) => {
            item.el.classList.add('hidden');
        });

        // Handling the case when there is only one item
        if (this._items.length === 1) {
            rotationItems.middle.el.classList.remove(
                '-translate-x-full',
                'translate-x-full',
                'translate-x-0',
                'hidden',
                'z-10'
            );
            rotationItems.middle.el.classList.add('translate-x-0', 'z-20');
            return;
        }

        // left item (previously active)
        rotationItems.left.el.classList.remove(
            '-translate-x-full',
            'translate-x-full',
            'translate-x-0',
            'hidden',
            'z-20'
        );

        rotationItems.left.el.classList.add('-translate-x-full', 'z-10');

        // currently active item
        rotationItems.middle.el.classList.remove(
            '-translate-x-full',
            'translate-x-full',
            'translate-x-0',
            'hidden',
            'z-10'
        );
        rotationItems.middle.el.classList.add('translate-x-0', 'z-30');

        // right item (upcoming active)
        rotationItems.right.el.classList.remove(
            '-translate-x-full',
            'translate-x-full',
            'translate-x-0',
            'hidden',
            'z-30'
        );
        rotationItems.right.el.classList.add('translate-x-full', 'z-20');
    }

    /**
     * Set an interval to cycle through the carousel items
     */
    cycle() {
        if (typeof window !== 'undefined') {
            this._intervalInstance = window.setInterval(() => {
                this.next();
            }, this._intervalDuration);
        }
    }

    /**
     * Clears the cycling interval
     */
    pause() {
        clearInterval(this._intervalInstance);
    }

    /**
     * Get the currently active item
     */
    getActiveItem() {
        return this._activeItem;
    }

    /**
     * Set the currently active item and data attribute
     * @param {*} position
     */
    _setActiveItem(item: CarouselItem) {
        this._activeItem = item;
        const position = item.position;

        // update the indicators if available
        if (this._indicators.length) {
            this._indicators.map((indicator) => {
                indicator.el.setAttribute('aria-current', 'false');
                indicator.el.classList.remove(
                    ...this._options.indicators.activeClasses.split(' ')
                );
                indicator.el.classList.add(
                    ...this._options.indicators.inactiveClasses.split(' ')
                );
            });
            this._indicators[position].el.classList.add(
                ...this._options.indicators.activeClasses.split(' ')
            );
            this._indicators[position].el.classList.remove(
                ...this._options.indicators.inactiveClasses.split(' ')
            );
            this._indicators[position].el.setAttribute('aria-current', 'true');
        }
    }

    updateOnNext(callback: () => void) {
        this._options.onNext = callback;
    }

    updateOnPrev(callback: () => void) {
        this._options.onPrev = callback;
    }

    updateOnChange(callback: () => void) {
        this._options.onChange = callback;
    }
}

export function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach(($carouselEl) => {
        const interval = $carouselEl.getAttribute('data-carousel-interval');
        const slide =
            $carouselEl.getAttribute('data-carousel') === 'slide'
                ? true
                : false;

        const items: CarouselItem[] = [];
        let defaultPosition = 0;
        if ($carouselEl.querySelectorAll('[data-carousel-item]').length) {
            Array.from(
                $carouselEl.querySelectorAll('[data-carousel-item]')
            ).map(($carouselItemEl: HTMLElement, position: number) => {
                items.push({
                    position: position,
                    el: $carouselItemEl,
                });

                if (
                    $carouselItemEl.getAttribute('data-carousel-item') ===
                    'active'
                ) {
                    defaultPosition = position;
                }
            });
        }

        const indicators: IndicatorItem[] = [];
        if ($carouselEl.querySelectorAll('[data-carousel-slide-to]').length) {
            Array.from(
                $carouselEl.querySelectorAll('
```

### Core Architecture Module: `src/components/carousel/interface.ts`
```
import {
    CarouselOptions,
    CarouselItem,
    IndicatorItem,
    RotationItems,
} from './types';

export declare interface CarouselInterface {
    _items: CarouselItem[];
    _indicators: IndicatorItem[];
    _activeItem: CarouselItem;
    _intervalDuration: number;
    _intervalInstance: number;
    _options: CarouselOptions;

    init(): void;

    getItem(position: number): CarouselItem;
    getActiveItem(): CarouselItem;

    _setActiveItem(item: CarouselItem): void;

    slideTo(position: number): void;

    next(): void;
    prev(): void;

    _rotate(rotationItems: RotationItems): void;
    cycle(): void;
    pause(): void;

    destroy(): void;
    removeInstance(): void;
    destroyAndRemoveInstance(): void;
}

```

### Core Architecture Module: `src/components/carousel/types.ts`
```
import { CarouselInterface } from './interface';

export declare type CarouselItem = {
    position: number;
    el: HTMLElement;
};

export declare type IndicatorItem = {
    position: number;
    el: HTMLElement;
};

export declare type RotationItems = {
    left: CarouselItem;
    middle: CarouselItem;
    right: CarouselItem;
};

export declare type CarouselOptions = {
    defaultPosition?: number;
    indicators?: {
        items?: IndicatorItem[];
        activeClasses?: string;
        inactiveClasses?: string;
    };
    interval?: number;
    onNext?: (carousel: CarouselInterface) => void;
    onPrev?: (carousel: CarouselInterface) => void;
    onChange?: (carousel: CarouselInterface) => void;
};

```

### Core Architecture Module: `src/components/clipboard/index.ts`
```
/* eslint-disable @typescript-eslint/no-empty-function */
import type { CopyClipboardOptions } from './types';
import type { InstanceOptions } from '../../dom/types';
import { CopyClipboardInterface } from './interface';
import instances from '../../dom/instances';

const Default: CopyClipboardOptions = {
    htmlEntities: false,
    contentType: 'input',
    onCopy: () => {},
};

const DefaultInstanceOptions: InstanceOptions = {
    id: null,
    override: true,
};

class CopyClipboard implements CopyClipboardInterface {
    _instanceId: string;
    _triggerEl: HTMLElement | null;
    _targetEl: HTMLInputElement | null;
    _options: CopyClipboardOptions;
    _initialized: boolean;
    _triggerElClickHandler: EventListenerOrEventListenerObject;
    _inputHandler: EventListenerOrEventListenerObject;

    constructor(
        triggerEl: HTMLElement | null = null,
        targetEl: HTMLInputElement | null = null,
        options: CopyClipboardOptions = Default,
        instanceOptions: InstanceOptions = DefaultInstanceOptions
    ) {
        this._instanceId = instanceOptions.id
            ? instanceOptions.id
            : targetEl.id;

        this._triggerEl = triggerEl;
        this._targetEl = targetEl;
        this._options = { ...Default, ...options };
        this._initialized = false;

        this.init();
        instances.addInstance(
            'CopyClipboard',
            this,
            this._instanceId,
            instanceOptions.override
        );
    }

    init() {
        if (this._targetEl && this._triggerEl && !this._initialized) {
            this._triggerElClickHandler = () => {
                this.copy();
            };

            // clicking on the trigger element should copy the value of the target element
            if (this._triggerEl) {
                this._triggerEl.addEventListener(
                    'click',
                    this._triggerElClickHandler
                );
            }

            this._initialized = true;
        }
    }

    destroy() {
        if (this._triggerEl && this._targetEl && this._initialized) {
            if (this._triggerEl) {
                this._triggerEl.removeEventListener(
                    'click',
                    this._triggerElClickHandler
                );
            }
            this._initialized = false;
        }
    }

    removeInstance() {
        instances.removeInstance('CopyClipboard', this._instanceId);
    }

    destroyAndRemoveInstance() {
        this.destroy();
        this.removeInstance();
    }

    getTargetValue() {
        if (this._options.contentType === 'input') {
            return this._targetEl.value;
        }

        if (this._options.contentType === 'innerHTML') {
            return this._targetEl.innerHTML;
        }

        if (this._options.contentType === 'textContent') {
            return this._targetEl.textContent.replace(/\s+/g, ' ').trim();
        }
    }

    copy() {
        let textToCopy = this.getTargetValue();

        // Check if HTMLEntities option is enabled
        if (this._options.htmlEntities) {
            // Encode the text using HTML entities
            textToCopy = this.decodeHTML(textToCopy);
        }

        // Create a temporary textarea element
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        document.body.appendChild(tempTextArea);

        // Select the text inside the textarea and copy it to the clipboard
        tempTextArea.select();
        document.execCommand('copy');

        // Remove the temporary textarea
        document.body.removeChild(tempTextArea);

        // Callback function
        this._options.onCopy(this);

        return textToCopy;
    }

    // Function to encode text into HTML entities
    decodeHTML(html: string) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = html;
        return textarea.textContent;
    }

    updateOnCopyCallback(callback: () => void) {
        this._options.onCopy = callback;
    }
}

export function initCopyClipboards() {
    document
        .querySelectorAll('[data-copy-to-clipboard-target]')
        .forEach(($triggerEl) => {
            const targetId = $triggerEl.getAttribute(
                'data-copy-to-clipboard-target'
            );
            const $targetEl = document.getElementById(targetId);
            const contentType = $triggerEl.getAttribute(
                'data-copy-to-clipboard-content-type'
            );
            const htmlEntities = $triggerEl.getAttribute(
                'data-copy-to-clipboard-html-entities'
            );

            // check if the target element exists
            if ($targetEl) {
                if (
                    !instances.instanceExists(
                        'CopyClipboard',
                        $targetEl.getAttribute('id')
                    )
                ) {
                    new CopyClipboard(
                        $triggerEl as HTMLElement,
                        $targetEl as HTMLInputElement,
                        {
                            htmlEntities:
                                htmlEntities && htmlEntities === 'true'
                                    ? true
                                    : Default.htmlEntities,
                            contentType: contentType
                                ? contentType
                                : Default.contentType,
                        } as CopyClipboardOptions
                    );
                }
            } else {
                console.error(
                    `The target element with id "${targetId}" does not exist. Please check the data-copy-to-clipboard-target attribute.`
                );
            }
        });
}

if (typeof window !== 'undefined') {
    window.CopyClipboard = CopyClipboard;
    window.initClipboards = initCopyClipboards;
}

export default CopyClipboard;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #892** (2024-09-02): **Remix Installation Documentation Not Working**
  *Symptoms*: **Describe the bug** By configuring tailwind content like this : ```typescript module.exports = {   content: [     "./app/**/*.{js,ts,jsx,tsx}",     "./node_modules/flowbite-react/**/*.js"   ],   plugins: [     // other plugins...     require("flowbite/plugin")   ],   theme: {}, }; ```  Flowbite doesn't work unless you do this instead :  ```typescript import type { Config } from 'tailwindcss'  export default {   content: [     './app/**/*.{js,jsx,ts,tsx}',     "./node_modules/flowbite-react/**/*.{js,cjs}",   ],   theme: {     extend: {},   },   plugins: [     require("flowbite/plugin"),   ], } satisfies Config ```   **To Reproduce** Steps to reproduce the behavior: 1. Follow the Flowbite Remix installation docs.  **Expected behavior** Flowbite examples should work out of the box.  **Versions:**  - "flowbite": "2.3.0"  - "flowbite-react": "0.9.0"  - NodeJS v22.2.0 x64  
  **Post-Mortem & Fix Analysis**:
  > Hey @Odinvt,  Thanks a lot for the issue! If you want to, you're welcome to update our Remix docs here: https://github.com/themesberg/flowbite/blob/main/content/getting-started/remix.md  I'll review the PR and pull in @SutuSebastian too for a double check, he's the master maintainer for Flowbite React :)  Cheers, Zoltan
  > Indeed the [Remix guide](https://flowbite.com/docs/getting-started/remix/) is outdated and is referencing an old version of `flowbite-react` (< `0.8.x`).  Also the [remix starter template](https://github.com/tulupinc/flowbite-remix-starter) link needs to be updated to the new official repo [flowbite-react-template-remix](https://github.com/themesberg/flowbite-react-template-remix).
  > @SutuSebastian can you help do a PR on this Remix update for our docs? <3

- **Issue #878** (2024-05-16): **Tabs components instance added twice**
  *Symptoms*: **Describe the bug** In the source code, the method addInstance is called twice in the Tabs class constructor (line 42, 43 in src/components/tabs/index.ts). This creates a warning message in the browser when i try to create an instance and put the override options to true.    **Screenshots** <img width="759" alt="Screenshot 2024-05-09 at 4 12 19 PM" src="https://github.com/themesberg/flowbite/assets/92652455/72aa02e3-759b-41c4-a6f9-6609b1ae66c2">  
  **Post-Mortem & Fix Analysis**:
  > Hey @cavenk,  Thanks for reporting! Fixed with this commit: https://github.com/themesberg/flowbite/commit/01e44a84ee0fc394b63978544a8fd43038c9fe3f  Will be added to the next version.  Cheers, Zoltan

- **Issue #874** (2024-05-08): **Typo in Flowbite Blocks Website **
  *Symptoms*: **Describe the bug** Typo in register form, [Create and account] -> [Create an account]  **To Reproduce** Steps to reproduce the behavior: 1. Go to [Flowbite Blocks](https://flowbite.com/blocks/marketing/register/) 2. Scroll down to the first form 4. See typo  **Expected behavior** [Create and account] -> [Create an account]  **Screenshots** ![image](https://github.com/themesberg/flowbite/assets/136202877/5da8a165-83ed-49bb-aed8-c074a12aa682) 
  **Post-Mortem & Fix Analysis**:
  > While you're on the topic of typos- in [first ](https://flowbite.com/blocks/e-commerce/checkout/#default-checkout-page) there is a class "items-nter" which should be "items-center" I think
  > Also, there is no such class as `ring-3`  In first block [Flowbite Blocks - Login Form](https://flowbite.com/blocks/marketing/login/#:~:text=gray%2D50%20focus%3A-,ring%2D3,-focus%3Aring%2Dprimary)
  > Hey everyone,  Thanks for the reports!  1. Typo in the register form is now fixed 2. Fixed the `items-center` class for the checkout block  Please create separate issues though for better tracking, thanks!  Zoltan

- **Issue #856** (2024-06-05): **Datarange picker does not become inline**
  *Symptoms*: The datarange picker cannot be put inline in any way. Using the current attributes, the datarange picker cannot be fixed. 
  **Post-Mortem & Fix Analysis**:
  > Hey @Mauro207,  I'll check this as I'm working on an upgraded API for the datepicker component/plugin.  Cheers, Zoltan
  > Hey @Mauro207,  Unfortunately it is not currently possible to add a date range picker inline.  However, you can add two separate inline datepickers and take the value from each of them.  It would get to the same result, the difference would be the lack of the range bar only.  Thanks, Zoltan

- **Issue #819** (2024-02-29): **[Documentation] GitHub’s unauthenticated API rate limit crashes Flowbite website’s homepage**
  *Symptoms*: **Describe the bug** The whole website crashes when contributor list cannot be loaded due to GitHub’s unauthenticated API rate limit.  > Application error: a client-side exception has occurred (see the browser console for more information).  **To Reproduce** 1. Go to https://flowbite.com/  2. Get your IP address rate-limited by GitHub (e.g. by using a co-working space’s public wifi network)     <img width="714" alt="image" src="https://github.com/themesberg/flowbite/assets/193136/7d80a096-43f1-4133-91f7-c9efcce07258">  **Expected behavior** Error should not crash the whole page. Maybe add an error boundary?  **Screenshots** <img width="1427" alt="image" src="https://github.com/themesberg/flowbite/assets/193136/b62cb98c-13bf-41ff-bb48-32c785034843"> 
  **Post-Mortem & Fix Analysis**:
  > Hey @dtinth,  Thanks for the reporting! I'll have a look at this today.  Cheers, Zoltan
  > I've just pushed a fix for this. I'll close the issue if no further errors happen.

- **Issue #816** (2024-06-27): **Documentation typo in tooltip placement section**
  *Symptoms*: **Describe the bug** I believe there is a typo in the documentation regarding tooltips. A double quote appears instead of a vertical bar in the section about tooltip placement.  **To Reproduce** To reproduce the issue: 1. Navigate to the [tooltip documentation](https://github.com/themesberg/flowbite/blob/main/content/components/tooltips.md). 2. Scroll down to the "Placement" section. 3. The typo can be found in data-tooltip-placement.  **Expected behavior** The correct character should likely be a vertical bar instead of a double quote.  **Screenshots** ![image](https://github.com/themesberg/flowbite/assets/58747066/4fcc5abd-f58a-45d8-ba29-7c3b5492f765) 
  **Post-Mortem & Fix Analysis**:
  > Hey @Lexachoc,  I have fixed the typos, thanks!

- **Issue #746** (2024-01-26): **Carousel slide works only with at least 4 items**
  *Symptoms*: **Describe the bug** The carousel slides only properly with at least 4 items.   **To Reproduce** try the default carousel slide example from the docs (https://flowbite.com/docs/components/carousel/)  **Expected behavior** Images to properly slide from right to left, without running through each other.   **Desktop (please complete the following information):** any  **Smartphone (please complete the following information):** any  
  **Post-Mortem & Fix Analysis**:
  > Yeah this is weird, I noticed the same thing - why is it bugging out at all?! The fact that it's reproducible on the site itself is troubling... also the fact the # of issues is immense and they don't seem to be taking them very seriously... They don't appear to be managing them, at all. 
  > Hey @kirkbushell,  We are taking the issues very seriously and trying to manage them, Flowbite is quite a large library and ecosystem and we're only a handful of developers working on managing them as this is what we can afford at this point based on our pro sales from the main library.  Contributions are more than welcome, though we are actively looking for a software developer to help us with the main library with strong TypeScript/JavaScript and HTML/CSS knowledge. That should help us speed up the process.  As described here (https://github.com/themesberg/flowbite/pull/550#issuecomment-1868682920) I'll have a look at the carousel items bug on Wednesday as today is Christmas and tomorrow, unfortunately, I will not be at the computer.  Happy holidays! Zoltan
  > I added a pull request for this: [Pull request](https://github.com/themesberg/flowbite/pull/766) Seems to be an issue with the z-index overlapping. I don't know if i checked all possible features of carousel.

- **Issue #740** (2024-01-26): **Carousel don't show item when they have only 1**
  *Symptoms*: Hello,  Thanks for your excellent library, really enjoy it!! 🔥  I've discover a bug with a Carousel who get items from external API. When you've only 1 item, you get a white screen (item is on the right overflow)  Bug with latest version 2.2.0 (and certainly before, but not yet tested) I reproduced it with the doc example  https://jsfiddle.net/jmto6b9e/3/  As you can see, nothing is displayed with only 1 item <img width="942" alt="Capture d’écran 2023-12-01 à 11 49 13" src="https://github.com/themesberg/flowbite/assets/12150996/74ed5ad1-e0cc-4341-9fe4-ce92563c6f53">  When you've 2 or more items, you'll see it: <img width="933" alt="Capture d’écran 2023-12-01 à 11 50 19" src="https://github.com/themesberg/flowbite/assets/12150996/4a9a0783-7bf5-45b9-b785-a85693408865">  I hope that you'll have a fix for it :) Thanks a lot! Cheers
  **Post-Mortem & Fix Analysis**:
  > Happy new year! 🎉  This issue will be resolved when #550 will be merged :)
  > Fixed with the new PR merge. Thanks!

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

### Incident Patch 1: `752fb715` (2026-04-03)
**Commit Message**: Merge pull request #1138 from Bsrat06/docs/fix-theming-font-inaccuracy-1132

docs: fix inaccurate Google Font imports in theming guides (#1132)

**File**: `content/customize/theming.md` (modified, +3/-2)
```diff
@@ -31,16 +31,17 @@ As we introduced custom themes with Flowbite v4 you can now import either one in
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/angular.md` (modified, +3/-2)
```diff
@@ -106,16 +106,17 @@ npm install flowbite --save
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/blazor.md` (modified, +3/-2)
```diff
@@ -200,16 +200,17 @@ npm install flowbite --save
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/django.md` (modified, +3/-2)
```diff
@@ -221,16 +221,17 @@ npm install flowbite --save
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/flask.md` (modified, +3/-2)
```diff
@@ -165,16 +165,17 @@ npm install flowbite --save
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/introduction.md` (modified, +3/-2)
```diff
@@ -85,16 +85,17 @@ npm install flowbite
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/mcp-ui.md` (modified, +3/-2)
```diff
@@ -276,16 +276,17 @@ Select one of the predefined themes from Flowbite or customize the variables you
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

**File**: `content/getting-started/nuxt-js.md` (modified, +3/-2)
```diff
@@ -101,16 +101,17 @@ npm install flowbite --save
 */
 
 /* ENTERPRISE THEME
-@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap');
 @import "flowbite/src/themes/enterprise";
 */
 
 /* PLAYFUL THEME
-@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
+@import url('https://fonts.googleapis.com/css2?family=Shantell+Sans:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/playful";
 */
 
 /* MONO THEME
+@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap');
 @import "flowbite/src/themes/mono";
 */
 {{< /code >}}
```

---

### Incident Patch 2: `5b431abe` (2026-04-03)
**Commit Message**: Merge pull request #1137 from Bsrat06/fix/theme-unitless-leading-none

fix(theme): change --leading-none from 1px to unitless 1 (#1136)

**File**: `src/themes/default.css` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/enterprise.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 --leading-8: 32px;
 --leading-6: 24px;
 --leading-4: 16px;
---leading-none: 1px;
+--leading-none: 1;
 --leading-5: 20px;
 --tracking-tighter: -0.8px;
 --leading-heading-none: 60px;
```

**File**: `src/themes/minimal.css` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/mono.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/playful.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/themes.css` (modified, +5/-5)
```diff
@@ -11,7 +11,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
@@ -158,7 +158,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
@@ -282,7 +282,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
@@ -411,7 +411,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
@@ -536,7 +536,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
```

---

### Incident Patch 3: `123021d1` (2026-04-02)
**Commit Message**: Fixes #1082 Incomplete Astro Installation instructions (Documentation bug)

**File**: `content/getting-started/astro.md` (modified, +2/-2)
```diff
@@ -105,7 +105,7 @@ Now that you've configured the styles for CSS from Flowbite you can now proceed
 
 ## Flowbite components
 
-To enable the interactive components you need to also include Flowbite's JavaScript file which you can do by either including it in the main `Layout.astro` file as a CDN file or importing the Flowbite module inside the 
+To enable the interactive components you need to also include Flowbite's JavaScript file which you can do by either including it in the main `Layout.astro` file as a CDN file or importing the Flowbite module inside the local `<script>` tag of Astro files.
 
 ### Include via CDN
 
@@ -200,4 +200,4 @@ We also built a free and open-source [Flowbite and Astro starter project](https:
 
 ## Astro admin dashboard
 
-You can check out our open-source [Astro admin dashboard](https://github.com/themesberg/flowbite-astro-admin-dashboard) project on GitHub to leverage CRUD layouts and API calls predefined with the Flowbite Library, Tailwind CSS framework and the Astro best practices and framework setup.
\ No newline at end of file
+You can check out our open-source [Astro admin dashboard](https://github.com/themesberg/flowbite-astro-admin-dashboard) project on GitHub to leverage CRUD layouts and API calls predefined with the Flowbite Library, Tailwind CSS framework and the Astro best practices and framework setup.
```

---

### Incident Patch 4: `4993c508` (2026-04-01)
**Commit Message**: fix: change --leading-none from 1px to 1 to match tailwind standards

**File**: `src/themes/default.css` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/enterprise.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 --leading-8: 32px;
 --leading-6: 24px;
 --leading-4: 16px;
---leading-none: 1px;
+--leading-none: 1;
 --leading-5: 20px;
 --tracking-tighter: -0.8px;
 --leading-heading-none: 60px;
```

**File**: `src/themes/minimal.css` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/mono.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/playful.css` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
```

**File**: `src/themes/themes.css` (modified, +5/-5)
```diff
@@ -11,7 +11,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
@@ -158,7 +158,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
@@ -282,7 +282,7 @@
     --leading-8: 32px;
     --leading-6: 24px;
     --leading-4: 16px;
-    --leading-none: 1px;
+    --leading-none: 1;
     --leading-5: 20px;
     --tracking-tighter: -0.8px;
     --leading-heading-none: 60px;
@@ -411,7 +411,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
@@ -536,7 +536,7 @@
         --leading-8: 32px;
         --leading-6: 24px;
         --leading-4: 16px;
-        --leading-none: 1px;
+        --leading-none: 1;
         --leading-5: 20px;
         --tracking-tighter: -0.8px;
         --leading-heading-none: 60px;
```

---

### Incident Patch 5: `f18e1f9e` (2026-03-23)
**Commit Message**: Add Flowbite with TypeUI guide link to README

**File**: `README.md` (modified, +1/-0)
```diff
@@ -299,6 +299,7 @@ We also wrote integration guides for the following front-end frameworks and libr
 - [📝 Flowbite with Gatsby guide](https://flowbite.com/docs/getting-started/gatsby/)
 - [📝 Flowbite with SolidJS guide](https://flowbite.com/docs/getting-started/solid-js/)
 - [📝 Flowbite with Qwik guide](https://flowbite.com/docs/getting-started/qwik/)
+- [📝 Flowbite with TypeUI guide](https://flowbite.com/docs/getting-started/typeui/)
 
 ### Back-end Frameworks
 
```

---

### Incident Patch 6: `69594645` (2026-02-06)
**Commit Message**: add mcp ui demo video

**File**: `content/getting-started/mcp-ui.md` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ In this guide you will learn how to create an MCP app using Flowbite and Skybrid
 
 We decided to use the [Skybridge](https://github.com/alpic-ai/skybridge) framework to build MCP apps and we are using the UI components from [Flowbite](https://flowbite.com/).
 
+<iframe width="100%" class="my-8 rounded-lg shadow-lg yt-video" src="https://www.youtube.com/embed/t9KRwktrZyk?si=eo2EOgOJd0ha1NWI" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
+
 ## Create new MCP app
 
 The first step is to create a new MCP application and start developing locally:
```

---

### Incident Patch 7: `8e9d443a` (2026-02-02)
**Commit Message**: add guides for each ai provider

**File**: `content/getting-started/mcp-ui.md` (modified, +83/-3)
```diff
@@ -36,15 +36,15 @@ npm install
 3. Run a local development server:
 
 {{< code lang="bash" >}}
-npm run dev
+npm run dev --use-forwarded-host
 {{< /code >}}
 
 This command will run a local server on `http://localhost:3000` and will create the following:
 
 - the main MCP server on the `/mcp` endpoint
 - a collection of widgets built with Flowbite and React used as tools
 
-## Connect with Ngrok
+## Connect with NGROK
 
 In order to expose the server to AI clients such as ChatGPT, Gemini or Claude we need to host the MCP server.
 
@@ -63,24 +63,104 @@ https://3785c5ddc4b6.ngrok-free.app/mcp
 
 You will now be able to use this URL to create an application for ChatGPT, Claude, Gemini, and for any MCP clients.
 
+Don't forget to add the `/mcp` endpoint to the URL generated by NGROK.
+
 ## Install on AI providers
 
-### ChatGPT Apps
+Use the following guides to connect your MCP app to major AI providers like ChatGPT, Claude, and Gemini.
+
+### ChatGPT apps
+
+Make sure that you have a paid plan to create an application on ChatGPT.
+
+1. Go to Settings > Connectors
+2. Scroll down and click on "Advanced Settings"
+3. Enable Developer mode
+4. Go back to the Settings > Connectors page, and click on "Create in the Browser Connectors"
+5. Add a custom connector with the MCP Server URL: `[NGROK_FORWARDING_URL]/mcp`
+6. Click on "Create to add the MCP server as a Connector"
+7. To use your newly created connector in the chat, click + then More and select it.
 
 ### Claude Web
 
+Make sure that you have a paid plan to create an application on Claude.
+
+1. Go to Settings > Connectors
+2. Locate the "Connectors" section
+3. Click "Add custom connector" at the bottom of the section
+4. Add your connector's remote MCP server URL: [NGROK_FORWARDING_URL]/mcp
+5. Finish configuring your connector and click Add
+6. To enable connectors, use the Search and tools button on the lower left of the chat.
+
 ### Gemini CLI
 
+Run the following command in your terminal:
+
+{{< code lang="bash" >}}
+gemini mcp add --transport http <server-name> "[NGROK_FORWARDING_URL]/mcp"
+{{< /code >}}
+
+Use `/mcp` in the Gemini CLI terminal to view your recently added MCP server status and discovered tools.
+
 ### Cursor
 
+Add your MCP server to Cursor by opening the `mcp.json` file and configure it using `mcpServers`.
+
+{{< code lang="bash" >}}
+{
+  "mcpServers": {
+    "<server-name>": {
+      "type": "http",
+      "url": "[NGROK_FORWARDING_URL]/mcp"
+    }
+  }
+}
+{{< /code >}}
+
 ### VS Code
 
+To add your MCP server to VS Code you need to open the `.vscode/mcp.json` file and configure `servers`.
+
+{{< code lang="bash" >}}
+{
+  "servers": {
+    "<server-name>": {
+      "type": "http",
+      "url": "[NGROK_FORWARDING_URL]/mcp"
+    }
+  }
+}
+{{< /code >}}
+
 ### Claude Code
 
+MCP servers are stored at `~/.claude.json` in Claude Code. Use the CLI to add your MCP app:
+
+{{< code lang="bash" >}}
+claude mcp add --transport http <server-name> "[NGROK_FORWARDING_URL]/mcp"
+{{< /code >}}
+
 ### Mistral AI
 
+1. Open the side panel and expand Intelligence > Connectors
+2. Click "+ Add Connector" on the right side of the page
+3. In the MCP Connectors directory, click the "Custom MCP Connector tab"
+4. Enter a Connector Name and the following Connector Server URL: `[NGROK_FORWARDING_URL]/mcp`
+5. Finish configuring your connector and click "Create"
+6. To use the connector, click the Tools button below the chat input and enable it in the Connectors section.
+
 ### Codex
 
+MCP servers in Codex are located at `~/.codex/config.toml` and you can install your MCP app using the CLI:
+
+{{< code lang="bash" >}}
+codex mcp add <server-name> --url "[NGROK_FORWARDING_URL]/mcp"
+{{< /code >}}
+
 ## Create a widget
 
 ## Update theming
+
+## Build for production
+
+## Host your MCP app
```

---

### Incident Patch 8: `2cfc76c8` (2026-02-02)
**Commit Message**: docs(mcp-ui): add basic setup for page

**File**: `content/customize/configuration.md` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@ description: Learn how to customize the default Flowbite and Tailwind CSS option
 group: customize
 toc: true
 
-previous: HUGO
-previousLink: getting-started/hugo/
+previous: MCP UI
+previousLink: getting-started/mcp-ui/
 next: Variables
 nextLink: customize/variables/
 ---
```

**File**: `content/getting-started/hugo.md` (modified, +2/-2)
```diff
@@ -8,8 +8,8 @@ requires_hugo: true
 
 previous: Blazor
 previousLink: getting-started/blazor/
-next: Configuration
-nextLink: customize/configuration/
+next: MCP UI
+nextLink: getting-started/mcp-ui/
 ---
 
 [HUGO](https://gohugo.io/) is a popular and open-source static site generator framework that makes it easy to organize your files and assets where you can also leverage a taxonomy system, multilingual support, fast assets pipeline, and more. HUGO is used by millions of developers and by websites such as Bootstrap, Litecoin, Smashing Magazine, and even Flowbite.
```

**File**: `content/getting-started/mcp-ui.md` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+---
+layout: docs
+title: MCP UI - Flowbite
+description: Learn how create and install an MCP application that can be used to build apps for ChatGPT, Claude, Gemini, and any other MCP client and leverage the UI components from Flowbite
+group: getting-started
+toc: true
+
+previous: HUGO
+previousLink: getting-started/hugo/
+next: Configuration
+nextLink: customize/configuration/
+---
```

**File**: `data/sidebar.yml` (modified, +1/-1)
```diff
@@ -38,8 +38,8 @@
       - title: Flask
       - title: Blazor
       - title: Hugo
+      - title: MCP UI
         new: true
-      
 
 - title: Customize
   slug: customize
```

---

### Incident Patch 9: `7ca08004` (2026-02-02)
**Commit Message**: markup fixes

**File**: `content/components/toast.md` (modified, +2/-2)
```diff
@@ -174,7 +174,7 @@ Use this interactive toast component to encourage users to make a certain action
 
 <div id="toast-interactive" class="w-full space-y-4 max-w-xs p-3 text-body bg-neutral-primary-soft rounded-base shadow-xs border border-default" role="alert">
     <div class="flex">
-        <div class="inline-flex items-center justify-center shrink-0 w-9 h-9 text-fg-brand bg-brand-softer rounded">
+        <div class="inline-flex items-center justify-center shrink-0 w-9 h-9 text-fg-brand bg-neutral-primary-medium rounded">
             <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"/></svg>
             <span class="sr-only">Refresh icon</span>
         </div>
@@ -227,7 +227,7 @@ Use this example to show a toast component that is dismissble with a progress ba
 {{< example class="flex justify-center" github="components/toast.md" show_dark=true >}}
 
 <div id="toast-interactive" class="w-full space-y-4 max-w-xs p-4 text-body bg-neutral-primary-soft rounded-base shadow-xs border border-default" role="alert">
-    <div class="inline-flex items-center justify-center shrink-0 w-9 h-9 text-fg-brand bg-brand-softer rounded">
+    <div class="inline-flex items-center justify-center shrink-0 w-9 h-9 text-fg-brand bg-neutral-primary-medium rounded">
         <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h3a3 3 0 0 0 0-6h-.025a5.56 5.56 0 0 0 .025-.5A5.5 5.5 0 0 0 7.207 9.021C7.137 9.017 7.071 9 7 9a4 4 0 1 0 0 8h2.167M12 19v-9m0 0-2 2m2-2 2 2"/></svg>
         <span class="sr-only">Refresh icon</span>
     </div>
```

**File**: `content/forms/checkbox.md` (modified, +26/-26)
```diff
@@ -93,43 +93,43 @@ Use this example of a checkbox inside a card element to enable a larger area of
 Use this checkbox component with a bordered style and a description text.
 
 {{< example class="grid gap-6 md:grid-cols-2" github="forms/checkbox.md" show_dark=true >}}
-<div class="flex space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
-    <input id="bordered-checkbox-3" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-4 ms-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft">
-    <label for="bordered-checkbox-3" class="py-4 pe-4">
+<label for="checkbox-1" class="flex space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
+    <input id="checkbox-1" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-5 ms-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft">
+    <div class="py-4 pe-4">
         <p class="select-none w-full text-sm font-medium text-heading">16GB unified memory</p>
-        <p id="helper-checkbox-bordered-1" class="select-none text-sm text-body">Seamlessly handle multitasking, large apps.</p>
-    </label>
-</div>
-<div class="flex space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
-    <input checked id="bordered-checkbox-4" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-4 ms-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft">
-    <label for="bordered-checkbox-4" class="py-4 pe-4">
+        <p class="select-none text-sm text-body">Seamlessly handle multitasking, large apps.</p>
+    </div>
+</label>
+<label for="checkbox-2" class="flex space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
+    <input checked id="checkbox-2" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-5 ms-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft">
+    <div class="py-4 pe-4">
         <p class="select-none w-full text-sm font-medium text-heading">1TB SSD storage</p>
-        <p id="helper-checkbox-bordered-2" class="select-none text-sm text-body">Get ultra-fast storage with 1TB of SSD space</p>
-    </label>
-</div>
+        <p class="select-none text-sm text-body">Get ultra-fast storage with 1TB of SSD space</p>
+    </div>
+</label>
 {{< /example >}}
 
 ## Bordered with icon
 
 This example can be used to create a checkbox component with a bordered style, a description text and an icon.
 
 {{< example class="grid gap-6 md:grid-cols-2" github="forms/checkbox.md" show_dark=true >}}
-<div class="flex justify-between space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
-    <label for="bordered-checkbox-5" class="p-4">
+<label for="checkbox-1" class="flex justify-between space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
+    <div class="p-4">
         <svg class="w-7 h-7 text-body mb-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1M5 12h14M5 12a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1m-2 3h.01M14 15h.01M17 9h.01M14 9h.01"/></svg>
-        <p  class="select-none w-full text-sm font-medium text-heading">16GB unified memory</p>
-        <p id="helper-checkbox-bordered-3" class="select-none text-sm text-body">Seamlessly handle multitasking, large apps.</p>
-    </label>
-    <input id="bordered-checkbox-5" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-4 me-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft" checked>
-</div>
-<div class="flex justify-between space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
-    <label for="bordered-checkbox-6" class="p-4">
+        <p class="select-none w-full text-sm font-medium text-heading">16GB unified memory</p>
+        <p class="select-none text-sm text-body">Seamlessly handle multitasking, large apps.</p>
+    </div>
+    <input id="checkbox-1" type="checkbox" value="" name="bordered-checkbox" class="w-4 h-4 mt-4 me-4 border border-default-medium rounded-xs bg-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft" checked>
+</label>
+<label for="checkbox-2" class="flex justify-between space-x-2.5 bg-neutral-primary-soft border border-default rounded-base shadow-xs">
+    <div class="p-4">
         <svg class="w-7 h-7 text-body mb-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 6c0 1.
```

---

### Incident Patch 10: `27133252` (2025-12-09)
**Commit Message**: Merge pull request #1104 from hamed-zeidabadi/fix/modal-method-call-bug

fix: correct method calls in Modal show() and hide() methods

**File**: `src/components/modal/index.ts` (modified, +2/-2)
```diff
@@ -187,7 +187,7 @@ class Modal implements ModalInterface {
     }
 
     show() {
-        if (this.isHidden) {
+        if (this.isHidden()) {
             this._targetEl.classList.add('flex');
             this._targetEl.classList.remove('hidden');
             this._targetEl.setAttribute('aria-modal', 'true');
@@ -210,7 +210,7 @@ class Modal implements ModalInterface {
     }
 
     hide() {
-        if (this.isVisible) {
+        if (this.isVisible()) {
             this._targetEl.classList.add('hidden');
             this._targetEl.classList.remove('flex');
             this._targetEl.setAttribute('aria-hidden', 'true');
```

---

### Incident Patch 11: `0e1f0ce8` (2025-11-28)
**Commit Message**: FIX: Missing turbo:render event listener

**File**: `src/index.turbo.ts` (modified, +3/-0)
```diff
@@ -39,6 +39,9 @@ const turboStreamLoadEvents = new Events('turbo:after-stream-render', [
 ]);
 turboStreamLoadEvents.init();
 
+const turboRenderEvents = new Events('turbo:render', [initFlowbite]);
+turboRenderEvents.init();
+
 export default {
     Accordion,
     Carousel,
```

---

### Incident Patch 12: `2d7c0dc0` (2025-11-24)
**Commit Message**: fix(navbar): skeleton alignment

**File**: `content/components/navbar.md` (modified, +12/-12)
```diff
@@ -18,7 +18,7 @@ Get started with the responsive navbar component from Flowbite to quickly set up
 
 Use this example of a navigation bar built with the utility classes from Tailwind CSS to enable users to navigate across the pages of your website.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-b border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
     <a href="{{< param homepage >}}/" class="flex items-center space-x-3 rtl:space-x-reverse">
@@ -56,7 +56,7 @@ Use this example of a navigation bar built with the utility classes from Tailwin
 
 This example can be used to show a secondary dropdown menu when clicking on one of the navigation links.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
     <a href="#" class="flex items-center space-x-3 rtl:space-x-reverse">
@@ -114,7 +114,7 @@ This example can be used to show a secondary dropdown menu when clicking on one
 
 Use this example to show multiple layers of dropdown menu by stacking them inside of each other.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-b border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
     <a href="#" class="flex items-center space-x-3 rtl:space-x-reverse">
@@ -191,7 +191,7 @@ Use this example to show multiple layers of dropdown menu by stacking them insid
 
 Use this example to keep the navbar positioned fixed to the top side as you scroll down the document page.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-b border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
@@ -230,7 +230,7 @@ Use this example to keep the navbar positioned fixed to the top side as you scro
 
 Use this example to show another subnav below the main navbar element.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 <header class="fixed w-full z-20 top-0 start-0">
   <nav class="bg-neutral-primary">
       <div class="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl p-4">
@@ -271,7 +271,7 @@ Use this example to show another subnav below the main navbar element.
 
 Use this example of a navbar element to also show a search input element that you can integrate for a site-wide search.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="480" iframeMaxHeight="480" skeletonPlaceholders=true >}}
 
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-b border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
@@ -323,7 +323,7 @@ Use this example of a navbar element to also show a search input element that yo
 
 Use the following navbar element to show a call to action button alongside the logo and page links.
 
-{{< example bodyClass="!p-0" github="components/navbar.md" show_dark=true iframeHeight="300" skeletonPlaceholders=true >}}
+{{< example github="components/navbar.md" show_dark=true iframeHeight="300" skeletonPlaceholders=true >}}
 
 <nav class="bg-neutral-primary fixed w-full z-20 top-0 start-0 border-b border-default">
   <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
@@ -362,7 +362,7 @@ Use the following navbar element to show a call to action button alongside the l
 
 Get started with this example to show a langua
```

---

### Incident Patch 13: `be5ee4b1` (2025-11-13)
**Commit Message**: fix(docs): minor fix

**File**: `content/forms/timepicker.md` (modified, +1/-1)
```diff
@@ -493,7 +493,7 @@ Use this example to show multiple time interval selections inside of a drawer co
 {{< example github="components/timepicker.md" class="flex justify-center" show_dark=true iframeHeight="880" >}}
 <!-- drawer init and show -->
 <div class="text-center">
-   <button class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" type="button" data-drawer-target="drawer-timepicker" data-drawer-show="drawer-timepicker" aria-controls="drawer-timepicker">
+   <button class="text-white bg-brand box-border border border-transparent hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-base text-sm px-4 py-2.5 focus:outline-none" type="button" data-drawer-target="drawer-timepicker" data-drawer-show="drawer-timepicker" aria-controls="drawer-timepicker">
    Set time schedule
    </button>
 </div>
```

---

### Incident Patch 14: `fde80496` (2025-11-13)
**Commit Message**: fix(forms): clean up duplicate input classes

**File**: `content/forms/input-field.md` (modified, +5/-5)
```diff
@@ -128,22 +128,22 @@ This example can be used to add a descriptive icon or additional text inside the
   <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
     <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m3.5 5.5 7.893 6.036a1 1 0 0 0 1.214 0L20.5 5.5M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"/></svg>
   </div>
-  <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
+  <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
 </div>
 <label for="website-admin" class="block mb-2.5 text-sm font-medium text-heading">Username</label>
 <div class="flex shadow-xs rounded-base">
   <span class="inline-flex items-center px-3 text-sm text-body bg-neutral-tertiary border rounded-e-0 border-default-medium border-e-0 rounded-s-base">
     <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
   </span>
-  <input type="text" id="website-admin" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 placeholder:text-body" placeholder="elonmusk">
+  <input type="text" id="website-admin" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand placeholder:text-body" placeholder="elonmusk">
 </div>
 
 <label for="website" class="block mb-2.5 text-sm font-medium text-heading">Website</label>
 <div class="flex shadow-xs rounded-base">
   <span class="inline-flex items-center px-3 text-sm text-body bg-neutral-tertiary border rounded-e-0 border-default-medium border-e-0 rounded-s-base">
 https://
   </span>
-  <input type="text" id="website" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 placeholder:text-body" placeholder="flowbite.com">
+  <input type="text" id="website" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand placeholder:text-body" placeholder="flowbite.com">
 </div>
 {{< /example >}}
 
@@ -157,7 +157,7 @@ Use this example to show a helper text below the input field for additional expl
   <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
     <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m3.5 5.5 7.893 6.036a1 1 0 0 0 1.214 0L20.5 5.5M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"/></svg>
   </div>
-  <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
+  <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
 </div>
 <p id="helper-text-explanation" class="mt-2.5 text-sm text-body">We’ll never share your details. Read our <a href="#" class="font-medium text-fg-brand hover:underline">Privacy Policy</a>.</p>
 {{< /example >}}
@@ -212,7 +212,7 @@ Use this example to show a dropdown menu right next to the input field.
                 </li>
             </ul>
         </div>
-        <input type="search" id="search-dropdown" id="input-group-1" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full p
```

**File**: `content/forms/number-input.md` (modified, +3/-3)
```diff
@@ -23,7 +23,7 @@ Use this component to set a number value inside a form field by applying the `ty
 {{< example github="components/number-input.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
     <label for="number-input" class="block mb-2.5 text-sm font-medium text-heading">Select a number:</label>
-    <input type="number" id="number-input" aria-describedby="helper-text-explanation" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="90210" required />
+    <input type="number" id="number-input" aria-describedby="helper-text-explanation" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" placeholder="90210" required />
 </form>
 {{< /example >}}
 
@@ -38,7 +38,7 @@ Use this example with an icon and helper text to set a ZIP code value inside a f
         <div class="absolute inset-y-0 start-0 top-0 flex items-center ps-3.5 pointer-events-none">
             <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.8 13.938h-.011a7 7 0 1 0-11.464.144h-.016l.14.171c.1.127.2.251.3.371L12 21l5.13-6.248c.194-.209.374-.429.54-.659l.13-.155Z"/></svg>
         </div>
-        <input type="text" id="zip-input" aria-describedby="helper-text-explanation" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="12345 or 12345-6789" pattern="^\d{5}(-\d{4})?$" required />
+        <input type="text" id="zip-input" aria-describedby="helper-text-explanation" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" placeholder="12345 or 12345-6789" pattern="^\d{5}(-\d{4})?$" required />
     </div>
     <p id="helper-text-explanation" class="mt-2.5 text-sm text-body">Please select a 5 digit number from 0 to 9.</p>
 </form>
@@ -436,7 +436,7 @@ rangeInput.addEventListener('input', updateCurrencyInput);
             <div class="absolute inset-y-0 start-0 top-0 flex items-center ps-3.5 pointer-events-none">
                 <svg class="w-4 h-4 text-heading" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 17.345a4.76 4.76 0 0 0 2.558 1.618c2.274.589 4.512-.446 4.999-2.31.487-1.866-1.273-3.9-3.546-4.49-2.273-.59-4.034-2.623-3.547-4.488.486-1.865 2.724-2.899 4.998-2.31.982.236 1.87.793 2.538 1.592m-3.879 12.171V21m0-18v2.2"/></svg>
             </div>
-            <input type="number" id="currency-input-2" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-e-base focus:ring-brand focus:border-brand px-3 py-2.5 placeholder:text-body" placeholder="Enter amount" value="1000" required />
+            <input type="number" id="currency-input-2" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-e-base focus:ring-brand focus:border-brand placeholder:text-body" placeholder="Enter amount" value="1000" required />
         </div>
     </div>
     <div id="dropdown-currency-2" class="z-10 hidden bg-neutral-primary-medium border border-default-medium rounded-base shadow-lg w-32">
```

**File**: `content/forms/phone-input.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ Use this component to set a phone number inside an input field by setting the `t
         <div class="absolute inset-y-0 start-0 top-0 flex items-center ps-3.5 pointer-events-none">
             <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.427 14.768 17.2 13.542a1.733 1.733 0 0 0-2.45 0l-.613.613a1.732 1.732 0 0 1-2.45 0l-1.838-1.84a1.735 1.735 0 0 1 0-2.452l.612-.613a1.735 1.735 0 0 0 0-2.452L9.237 5.572a1.6 1.6 0 0 0-2.45 0c-3.223 3.2-1.702 6.896 1.519 10.117 3.22 3.221 6.914 4.745 10.12 1.535a1.601 1.601 0 0 0 0-2.456Z"/></svg>
         </div>
-        <input type="text" id="phone-input" aria-describedby="helper-text-explanation" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" placeholder="123-456-7890" required />
+        <input type="text" id="phone-input" aria-describedby="helper-text-explanation" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" placeholder="123-456-7890" required />
     </div>
     <p id="helper-text-explanation" class="mt-2.5 text-sm text-body">Select a phone number that matches the format.</p>
 </form>
```

**File**: `content/forms/search-input.md` (modified, +4/-4)
```diff
@@ -65,7 +65,7 @@ Use this search component with a dropdown to let your users select a category in
                 </li>
             </ul>
         </div>
-        <input type="search" id="search-dropdown" id="input-group-1" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full px-3 py-2.5 placeholder:text-body" placeholder="Search for products" required>
+        <input type="search" id="search-dropdown" id="input-group-1" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full placeholder:text-body" placeholder="Search for products" required>
         <button type="button" class="inline-flex items-center  text-white bg-brand hover:bg-brand-strong box-border border border-transparent focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-e-base text-sm px-4 py-2.5 focus:outline-none">
         <svg class="w-4 h-4 me-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>
         Search
@@ -85,7 +85,7 @@ Use the simplest form of a search input component with an icon and a search butt
         <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
             <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 8v8m0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0a4 4 0 0 1-4 4h-1a3 3 0 0 0-3 3"/></svg>
         </div>
-        <input type="text" id="simple-search" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium rounded-base ps-9 text-heading text-sm focus:ring-brand focus:border-brand block w-full px-3 py-2.5 placeholder:text-body" placeholder="Search branch name..." required />
+        <input type="text" id="simple-search" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium rounded-base ps-9 text-heading text-sm focus:ring-brand focus:border-brand block w-full placeholder:text-body" placeholder="Search branch name..." required />
     </div>
     <button type="submit" class="inline-flex items-center justify-center shrink-0 text-white bg-brand hover:bg-brand-strong focus:ring-4 focus:ring-brand-medium shadow-xs rounded-base w-10 h-10 focus:outline-none">
         <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>
@@ -191,7 +191,7 @@ Use this example where you can select a country in which you want to search for
                 </li>
             </ul>
         </div>
-        <input type="search" id="search-dropdown-location" id="input-group-4" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full px-3 py-2.5 placeholder:text-body" placeholder="Search for city or address" required>
+        <input type="search" id="search-dropdown-location" id="input-group-4" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full placeholder:text-body" placeholder="Search for city or address" required>
         <button type="submit" class="inline-flex items-center  text-white bg-brand hover:bg-brand-strong box-border border border-transparent focus:ring-4 focus:ring-brand-medium shadow-xs font-medium leading-5 rounded-e-base text-sm px-4 py-2.5 focus:outline-none">
         <svg class="w-4 h-4 me-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/></svg>
         Search
@@ -249,7 +249,7 @@ Use this example to show multiple dropdown selection elements next to the search
                 </li>
             </ul>
         </div>
-        <input type="search" id="search-dropdown-advanced" id="input-group-6" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full px-3 py-2.5 placeholder:text-body" placeholder="Search for domain or URL" required>
+        <input type="search" id="search-dropdown-advanced" id="input-group-6" class="px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm focus:ring-brand focus:border-brand block w-full
```

**File**: `content/forms/select.md` (modified, +6/-6)
```diff
@@ -37,7 +37,7 @@ Apply the `multiple` attribute to the select component to allow users to select
 {{< example github="forms/select.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
   <label for="countries_multiple" class="block mb-2.5 text-sm font-medium text-heading">Select an option</label>
-  <select multiple id="countries_multiple" class="block w-full p-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body">
+  <select multiple id="countries_multiple" class="block w-full bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body">
     <option selected>Choose countries</option>
     <option value="US">United States</option>
     <option value="CA">Canada</option>
@@ -54,7 +54,7 @@ Use the size attribute for the select component to specify the number of visible
 {{< example github="forms/select.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
   <label for="years" class="block mb-2.5 text-sm font-medium text-heading">Select an option</label>
-  <select id="years" size="5" class="block w-full p-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body">
+  <select id="years" size="5" class="block w-full bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body">
     <option>2016</option>
     <option>2017</option>
     <option>2018</option>
@@ -73,7 +73,7 @@ Apply the `disable` state to the select component to disallow the selection of n
 {{< example github="forms/select.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
   <label for="countries_disabled" class="block mb-2.5 text-sm font-medium text-heading">Select an option</label>
-  <select disabled id="countries_disabled" class="block w-full p-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs text-fg-disabled">
+  <select disabled id="countries_disabled" class="block w-full bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs text-fg-disabled">
     <option selected>Choose a country</option>
     <option value="US">United States</option>
     <option value="CA">Canada</option>
@@ -224,7 +224,7 @@ Get started with the small, default, and large sizes for the select component fr
 {{< example github="forms/select.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
   <label for="small" class="block mb-2.5 text-sm font-medium text-heading">Small select</label>
-  <select id="small" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-2.5 py-2 shadow-xs placeholder:text-body mb-4">
+  <select id="small" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body mb-4">
     <option selected>Choose a country</option>
     <option value="US">United States</option>
     <option value="CA">Canada</option>
@@ -240,15 +240,15 @@ Get started with the small, default, and large sizes for the select component fr
     <option value="DE">Germany</option>
   </select>
   <label for="large" class="block mb-2.5 text-sm font-medium text-heading">Large select</label>
-  <select id="large" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3.5 py-3 shadow-xs placeholder:text-body mb-4">
+  <select id="large" class="block w-full bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3.5 py-3 shadow-xs placeholder:text-body mb-4">
     <option selected>Choose a country</option>
     <option value="US">United States</option>
     <option value="CA">Canada</option>
     <option value="FR">France</option>
     <option value="DE">Germany</option>
   </select>
   <label for="extra-large" class="block mb-2.5 text-sm font-medium text-heading">Extra Large select</label>
-  <select id="extra-large" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-4 py-3.5 shadow-xs placeholder:text-body mb-4">
+  <select id="extra-large" class="block w-full bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-4 py-3.5 shadow
```

---

### Incident Patch 15: `d4efa2ed` (2025-11-13)
**Commit Message**: fix(forms): clean up duplicate input classes

**File**: `content/components/forms.md` (modified, +3/-3)
```diff
@@ -169,7 +169,7 @@ Use the following Tailwind utility classes and [SVG icon](https://flowbite.com/i
     <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
       <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m3.5 5.5 7.893 6.036a1 1 0 0 0 1.214 0L20.5 5.5M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"/></svg>
     </div>
-    <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
+    <input type="text" id="input-group-1" class="block w-full ps-9 pe-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body" placeholder="name@flowbite.com">
   </div>
 </form>
 {{< /example >}}
@@ -185,7 +185,7 @@ Use this example to add a SVG icon or special character with an addon style to t
     <span class="inline-flex items-center px-3 text-sm text-body bg-neutral-tertiary border rounded-e-0 border-default-medium border-e-0 rounded-s-base">
       <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
     </span>
-    <input type="text" id="website-admin" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 placeholder:text-body" placeholder="elonmusk">
+    <input type="text" id="website-admin" class="rounded-none rounded-e-base block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand placeholder:text-body" placeholder="elonmusk">
   </div>
 </form>
 {{< /example >}}
@@ -227,7 +227,7 @@ Use the following select input element to show selectable list of items.
 {{< example github="components/forms.md" show_dark=true >}}
 <form class="max-w-sm mx-auto">
   <label for="countries" class="block mb-2.5 text-sm font-medium text-heading">Select an option</label>
-  <select id="countries" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand px-3 py-2.5 shadow-xs placeholder:text-body">
+  <select id="countries" class="block w-full px-3 py-2.5 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body">
     <option selected>Choose a country</option>
     <option value="US">United States</option>
     <option value="CA">Canada</option>
```

#### Recent Merged Pull Requests:
- **PR #1139** (2026-04-03): Fixes #1082 Incomplete Astro Installation instructions (Documentation… (@marceloverdijk)
- **PR #1138** (2026-04-03): docs: fix inaccurate Google Font imports in theming guides (#1132) (@Bsrat06)
- **PR #1137** (2026-04-03): fix(theme): change --leading-none from 1px to unitless 1 (#1136) (@Bsrat06)
- **PR #1135** (2026-03-23): Add Flowbite with TypeUI guide link to README (@zoltanszogyenyi)
- **PR #1118** (closed): fix: #1117 (@shinokada)
- **PR #1112** (2025-12-09): FIX: Missing turbo:render event listener (@paicha)
- **PR #1109** (2025-11-22): Qr code (@zoltanszogyenyi)
- **PR #1107** (2025-11-17): v4.0.1 (@zoltanszogyenyi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
