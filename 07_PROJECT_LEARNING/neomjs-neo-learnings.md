# Forensic Learning Record (Deep Inspection): neomjs/neo

> **Canonical Artifact**: `07_PROJECT_LEARNING/neomjs-neo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neomjs/neo](https://github.com/neomjs/neo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:01.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neomjs/neo`
- **Description**: Neo.mjs is a self-evolving software organism: a professional end-to-end AI engineering team whose cross-model swarm inhabits live apps via Neural Link, Active Hybrid GraphRAG, DreamService, and self-healing loops.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3283 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/rgReplaceGuardHook.mjs`
```
#!/usr/bin/env node
/**
 * @module .claude/hooks/rgReplaceGuardHook
 * @summary Claude Code `PreToolUse` guard for the high-frequency `rg -r` footgun: in ripgrep, `-r`
 * means `--replace`, not recursion. The hook is intentionally narrow: it only inspects Bash tool
 * commands, only flags `rg` invocations, and allows explicit replacement shapes with a replacement
 * plus a search pattern.
 *
 * The hook fails open on malformed payloads. A broken guard must never block ordinary tool use; at worst,
 * it misses one warning and the user can re-run the command.
 */
import {pathToFileURL} from 'node:url';

export const RG_REPLACE_GUARD_MESSAGE = '`rg -r` is `--replace`, not recursion. ripgrep recurses by default; did you mean a plain recursive search?';

const SHELL_SEPARATORS = new Set([';', '|', '||', '&&']);

/**
 * @summary Tokenizes enough shell syntax to identify command words and simple separators without executing
 * or fully parsing Bash. Quoted strings stay single tokens; this is sufficient for `rg --replace "x" "y"`.
 * @param {String} command
 * @returns {String[]}
 */
export function tokenizeShellCommand(command = '') {
    const tokens  = [];
    let   current = '';
    let   quote   = null;
    let   escape  = false;

    function pushCurrent() {
        if (current.length > 0) {
            tokens.push(current);
            current = '';
        }
    }

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (escape) {
            current += char;
            escape = false;
            continue
        }

        if (char === '\\') {
            escape = true;
            continue
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue
        }

        if (char === '\'' || char === '"' || char === '`') {
            quote = char;
            continue
        }

        if (/\s/.test(char)) {
            pushCurrent();
            continue
        }

        if (char === '&' && command[i + 1] === '&') {
            pushCurrent();
            tokens.push('&&');
            i++;
            continue
        }

        if (char === '|' && command[i + 1] === '|') {
            pushCurrent();
            tokens.push('||');
            i++;
            continue
        }

        if (char === ';' || char === '|') {
            pushCurrent();
            tokens.push(char);
            continue
        }

        current += char;
    }

    pushCurrent();

    return tokens
}

function isRgCommand(token) {
    return /(?:^|\/)rg(?:\.exe)?$/.test(token);
}

function isShellSeparator(token) {
    return SHELL_SEPARATORS.has(token);
}

function commandOperands(tokens, startIndex, endIndex) {
    const operands = [];

    for (let i = startIndex; i < endIndex; i++) {
        const token = tokens[i];

        if (!token || isShellSeparator(token)) {
            break
        }

        if (!token.startsWith('-')) {
            operands.push(token);
        }
    }

    return operands
}

function looksLikePathOperand(token) {
    return typeof token === 'string' && (
        token === '.' ||
        token === '..' ||
        token.startsWith('./') ||
        token.startsWith('../') ||
        token.startsWith('/') ||
        token.startsWith('~/') ||
        token.includes('/')
    )
}

function replacementOperandProblem(tokens, replacementIndex, endIndex) {
    if (replacementIndex >= endIndex || tokens[replacementIndex]?.startsWith('-')) {
        return 'missing-replacement';
    }

    const operands = commandOperands(tokens, replacementIndex, endIndex);

    if (operands.length < 2) {
        return 'missing-pattern';
    }

    // The common footgun is `rg -r "pattern" path/`: the path becomes ripgrep's search pattern while
    // the intended pattern becomes replacement text. Genuine replacement with a path needs three operands:
    // replacement, pattern, then the path.
    if (operands.length === 2 && looksLikePathOperand(operands[1])) {
        return 'missing-pattern';
    }

    return null
}

function segmentEnd(tokens, startIndex) {
    for (let i = startIndex; i < tokens.length; i++) {
        if (isShellSeparator(tokens[i])) {
            return i
        }
    }

    return tokens.length
}

function replaceFlagProblem(tokens, flagIndex, endIndex) {
    const flag = tokens[flagIndex];

    if (flag === '--replace') {
        return replacementOperandProblem(tokens, flagIndex + 1, endIndex);
    }

    if (flag.startsWith('--replace=')) {
        const replacement = flag.slice('--replace='.length);

        if (!replacement) {
            return 'missing-replacement';
        }

        const operands = commandOperands(tokens, flagIndex + 1, endIndex);

        if (operands.length < 1) {
            return 'missing-pattern';
        }

        if (operands.length === 1 && looksLikePathOperand(operands[0])) {
            return 'missing-pattern';
        }

        return null;
    }

    if (flag === '-r') {
        return replacementOperandProblem(tokens, flagIndex + 1, endIndex);
    }

    // `rg -rn foo` is the observed failure: ripgrep treats `n` as replacement text, not recursion.
    // Require separated `-r replacement pattern` or long `--replace replacement pattern` for genuine use.
    if (/^-.*r/.test(flag)) {
        return 'clustered-short-replace';
    }

    return null
}

/**
 * @summary Detects whether a Bash command contains an `rg` invocation whose replace flag shape is likely the
 * recursion mistake.
 * @param {String} command
 * @returns {{flag: String, reason: String}|null}
 */
export function findRgReplaceFootgun(command = '') {
    const tokens = tokenizeShellCommand(command);

    for (let i = 0; i < tokens.length; i++) {
        if (!isRgCommand(tokens[i])) {
            continue
        }

        const end = segmentEnd(tokens, i + 1);

        for (let j = i + 1; j < end; j++) {
            const reason = replaceFlagProblem(tokens, j, end);

            if (reason) {
                return {flag: tokens[j], reason}
            }
        }

        i = end;
    }

    return null
}

function parseHookPayload(raw) {
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function resolveBashCommand(hookPayload) {
    if (hookPayload?.tool_name && hookPayload.tool_name !== 'Bash') {
        return null
    }

    return typeof hookPayload?.tool_input?.command === 'string'
        ? hookPayload.tool_input.command
        : (typeof hookPayload?.command === 'string' ? hookPayload.command : null)
}

/**
 * @summary Returns the Claude hook block directive for suspicious `rg -r` shapes, or `null` to allow.
 * @param {Object} hookPayload Parsed Claude Code hook payload.
 * @returns {{decision: 'block', reason: String}|null}
 */
export function decideRgReplaceGuard(hookPayload) {
    const command = resolveBashCommand(hookPayload);

    if (!command) {
        return null
    }

    const finding = findRgReplaceFootgun(command);

    return finding ? {decision: 'block', reason: RG_REPLACE_GUARD_MESSAGE} : null
}

async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data',  chunk => data += chunk);
        process.stdin.on('end',   ()    => resolve(data));
        process.stdin.on('error', reject);
    });
}

async function main() {
    const decision = decideRgReplaceGuard(parseHookPayload(await readStdin()));

    if (decision) {
        process.stdout.write(`${JSON.stringify(decision)}\n`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main().catch(() => {});
}

```

### Core Architecture Module: `ServiceWorker.mjs`
```
import Neo         from './src/Neo.mjs';
import * as core   from './src/core/_export.mjs';
import ServiceBase from './src/worker/ServiceBase.mjs';

/**
 * @class Neo.ServiceWorker
 * @extends Neo.worker.ServiceBase
 * @singleton
 */
class ServiceWorker extends ServiceBase {
    static config = {
        /**
         * @member {String} className='Neo.ServiceWorker'
         * @protected
         */
        className: 'Neo.ServiceWorker',
        /**
         * @member {Boolean} singleton=true
         * @protected
         */
        singleton: true,
        /**
         * @member {String} version='13.1.0'
         */
        version: '13.1.0'
    }

    /**
     * @member {String} workerId='service'
     * @protected
     */
    workerId = 'service'
}

export default Neo.setupClass(ServiceWorker);

```

### Core Architecture Module: `apps/colors/view/ViewportStateProvider.mjs`
```
import ColorsStore   from '../store/Colors.mjs';
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Colors.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Colors.view.ViewportStateProvider'
         * @protected
         */
        className: 'Colors.view.ViewportStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * @member {Number} data.amountColors=10
             */
            amountColors: 10,
            /**
             * @member {Number} data.amountColumns=10
             */
            amountColumns: 10,
            /**
             * @member {Number} data.amountRows=10
             */
            amountRows: 10,
            /**
             * @member {Boolean} data.isUpdating=false
             */
            isUpdating: false,
            /**
             * @member {Boolean} data.openWidgetsAsPopups=true
             */
            openWidgetsAsPopups: true
        },
        /**
         * @member {Object} stores
         */
        stores: {
            colors: {
                module: ColorsStore
            }
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);

```

### Core Architecture Module: `apps/covid/Util.mjs`
```
import Base from '../../src/core/Base.mjs';

/**
 * Static utility class
 * @class Covid.Util
 * @extends Neo.core.Base
 */
class Util extends Base {
    /**
     * A regex to replace blank chars
     * @member {RegExp} flagRegEx=/ /gi
     * @protected
     * @static
     */
    static flagRegEx = / /gi
    /**
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString
     * Change this config to enforce a county specific formatting (e.g. 'de-DE')
     * @member {String} locales='default'
     * @protected
     * @static
     */
    static locales = 'default'

    static config = {
        /**
         * @member {String} className='Covid.Util'
         * @protected
         */
        className: 'Covid.Util'
    }

    /**
     * Used for the casesPerOneMillion column to show % of population
     * @param {Object} data
     * @param {Number} data.value
     * @returns {String}
     */
    static formatInfected(data) {
        let value = data.value;

        if (!Neo.isNumber(value)) {
            return value || 'N/A'
        }

        value = Math.round(value / 100);
        value /= 100;

        value = value.toFixed(2) + ' %';

        return value.toLocaleString(Util.locales)
    }

    /**
     * This method will get used as a grid renderer, so the 2nd param is an overload (would be {Object} record)
     * @param {Object} data
     * @param {Number} data.value
     * @param {String} [color]
     * @returns {String}
     */
    static formatNumber(data, color) {
        let value = data.value;

        if (!Neo.isNumber(value)) {
            return value || 'N/A';
        }

        value = value.toLocaleString(Util.locales);

        return typeof color !== 'string' ? value : `<span style="color:${color};">${value}</span>`
    }

    /**
     * @param {String} name
     * @returns {String} url
     */
    static getCountryFlagUrl(name) {
        const map = {
            'bosnia'                               : 'bosnia-and-herzegovina',
            'cabo-verde'                           : 'cape-verde',
            'car'                                  : 'central-african-republic',
            'caribbean-netherlands'                : 'netherlands',
            'channel-islands'                      : 'jersey',
            'côte-d\'ivoire'                       : 'ivory-coast',
            'congo'                                : 'republic-of-the-congo',
            'congo,-the-democratic-republic-of-the': 'democratic-republic-of-congo',
            'curaçao'                              : 'curacao',
            'czechia'                              : 'czech-republic',
            'diamond-princess'                     : 'japan', // cruise ship
            'drc'                                  : 'democratic-republic-of-congo',
            'el-salvador'                          : 'salvador',
            'eswatini'                             : 'swaziland',
            'faeroe-islands'                       : 'faroe-islands',
            'falkland-islands-(malvinas)'          : 'falkland-islands',
            'french-guiana'                        : 'france', // ?
            'guadeloupe'                           : 'france', // ?
            'holy-see-(vatican-city-state)'        : 'vatican-city',
            'iran,-islamic-republic-of'            : 'iran',
            'lao-people\'s-democratic-republic'    : 'laos',
            'libyan-arab-jamahiriya'               : 'libya',
            'macedonia'                            : 'republic-of-macedonia',
            'marshall-islands'                     : 'marshall-island',
            'mayotte'                              : 'france', // ?
            'moldova,-republic-of'                 : 'moldova',
            'ms-zaandam'                           : 'netherlands', // cruise ship
            'new-caledonia'                        : 'france',
            'palestinian-territory,-occupied'      : 'palestine',
            'poland'                               : 'republic-of-poland',
            'réunion'                              : 'france',
            's.-korea'                             : 'south-korea',
            'st.-barth'                            : 'st-barts',
            'saint-helena'                         : 'united-kingdom', // sorry, icon not included
            'saint-lucia'                          : 'st-lucia',
            'saint-martin'                         : 'sint-maarten',
            'saint-pierre-miquelon'                : 'france',
            'saint-vincent-and-the-grenadines'     : 'st-vincent-and-the-grenadines',
            'syrian-arab-republic'                 : 'syria',
            'tanzania,-united-republic-of'         : 'tanzania',
            'timor-leste'                          : 'east-timor',
            'turks-and-caicos-islands'             : 'turks-and-caicos',
            'u.s.-virgin-islands'                  : 'virgin-islands',
            'uae'                                  : 'united-arab-emirates',
            'uk'                                   : 'united-kingdom',
            'usa'                                  : 'united-states-of-america',
            'uzbekistan'                           : 'uzbekistn',
            'venezuela,-bolivarian-republic-of'    : 'venezuela',
            'viet-nam'                             : 'vietnam',
            'wallis-and-futuna'                    : 'france'
        };

        let imageName = name.toLowerCase().replace(Util.flagRegEx, '-');

        imageName = map[imageName] || imageName;

        if (Neo.config.isGitHubPages) {
            let path = `../../../../resources_pub/images/flaticon/country_flags/png/${imageName}.png`;

            if (Neo.config.environment !== 'development') {
                path = `../../${path}`
            }

            return path
        }

        return `https://raw.githubusercontent.com/neomjs/pages/main/resources_pub/images/flaticon/country_flags/png/${imageName}.png`
    }

    /**
     * @param {Object} data
     * @param {Number} data.rowIndex
     * @returns {Object}
     */
    static indexRenderer(data) {
        return {
            cls : ['neo-index-column', 'neo-table-cell'],
            html: data.rowIndex + 1
        }
    }
}

Neo.setupClass(Util);

export default Util;

```

### Core Architecture Module: `apps/covid/view/MainContainerStateProvider.mjs`
```
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Covid.view.MainContainerStateProvider
 * @extends Neo.state.Provider
 */
class MainContainerStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Covid.view.MainContainerStateProvider'
         * @protected
         */
        className: 'Covid.view.MainContainerStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * @member {String|null} data.country=null
             */
            country: null,
            /**
             * We are storing the currently selected record of the Covid.view.HeaderContainer SelectField
             * @member {Object} data.countryRecord=null
             */
            countryRecord: null
        }
    }

    /**
     * @param {String} key
     * @param {*} value
     * @param {*} oldValue
     */
    onDataPropertyChange(key, value, oldValue) {
        super.onDataPropertyChange(key, value, oldValue);

        if (oldValue !== undefined) {
            if (key === 'country') {
                Neo.Main.editRoute({
                    country: value
                });
            }
        }
    }
}

export default Neo.setupClass(MainContainerStateProvider);

```

### Core Architecture Module: `apps/email/view/ViewportStateProvider.mjs`
```
import EmailStore    from '../store/Emails.mjs';
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Email.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Email.view.ViewportStateProvider'
         * @protected
         */
        className: 'Email.view.ViewportStateProvider',
        /**
         * @member {Object} stores
         */
        stores: {
            emails: {
                module: EmailStore
            }
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);

```

### Core Architecture Module: `apps/finance/view/ViewportStateProvider.mjs`
```
import CompanyStore  from '../store/Companies.mjs';
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Finance.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Finance.view.ViewportStateProvider'
         * @protected
         */
        className: 'Finance.view.ViewportStateProvider',
        /**
         * @member {Object} data
         */
        data: {},
        /**
         * @member {Object} stores
         */
        stores: {
            companies: {
                module   : CompanyStore,
                autoLoad : true,
                listeners: {load: 'onCompaniesStoreLoad'}
            }
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);

```

### Core Architecture Module: `apps/form/view/ViewportStateProvider.mjs`
```
import SideNavStore  from '../store/SideNav.mjs'
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Form.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Form.view.ViewportStateProvider'
         * @protected
         */
        className: 'Form.view.ViewportStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * The currently selected list item inside the SideNavList
             * @member {Number} data.activeIndex
             */
            activeIndex: 0,
            /**
             * The name of the currently selected list item record
             * @member {String} data.activeTitle
             */
            activeTitle: '',
            /**
             * The amount of non-header SideNavList items
             * @member {Number} data.maxIndex
             */
            maxIndex: 0
        },
        /**
         * @member {Object} stores
         */
        stores: {
            sideNav: {
                module  : SideNavStore,
                autoLoad: true,
                url     : '../../resources/examples/data/formSideNav.json'
            }
        }
    }

    /**
     * We are storing the local storage data into this class field
     * @member {Object} data
     */
    formData = null

    /**
     * Loading the local storage formData
     * @param {Object} config
     */
    construct(config) {
        super.construct(config);

        Neo.main.addon.LocalStorage.readLocalStorageItem({
            key     : 'neo-form',
            windowId: this.windowId
        }).then(data => {
            this.formData = JSON.parse(data.value);
        })
    }

    /**
     *
     * @param {String} key
     * @param {*} value
     * @param {*} oldValue
     */
    onDataPropertyChange(key, value, oldValue) {
        super.onDataPropertyChange(key, value, oldValue);

        let me = this;

        if (me.formData && key === 'activeIndex') {
            let page = me.getController().getReference('pages-container').items[value];

            if (page instanceof Neo.core.Base) {
                page.setValues(me.formData, true);
            } else {
                me.timeout(30).then(() => {
                    me.onDataPropertyChange(key, value, oldValue)
                })
            }
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);

```

### Core Architecture Module: `apps/legit/view/ViewportStateProvider.mjs`
```
import CommitStore from '../store/Commits.mjs';
import FileStore   from '../store/Files.mjs';
import Provider    from '../../../src/state/Provider.mjs';

/**
 * @class Legit.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends Provider {
    static config = {
        /**
         * @member {String} className='Legit.view.ViewportStateProvider'
         * @protected
         */
        className: 'Legit.view.ViewportStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * @member {String|null} data.currentFile=null
             */
            currentFile: null
        },
        /**
         * @member {Object} stores
         */
        stores: {
            commitStore: CommitStore,
            fileStore  : FileStore
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);
```

### Core Architecture Module: `apps/portal/Util.mjs`
```
/**
 * @param {String|null} searchString
 * @returns {Function}
 */
export function getSearchParams(searchString) {
    if (searchString?.startsWith('?')) {
        searchString = searchString.substring(1)
    }

    return searchString ? JSON.parse(`{"${decodeURI(searchString.replace(/&/g, "\",\"").replace(/=/g, "\":\""))}"}`) : {}
}

```

### Core Architecture Module: `apps/portal/view/ViewportStateProvider.mjs`
```
import StateProvider from '../../../src/state/Provider.mjs';

/**
 * @class Portal.view.ViewportStateProvider
 * @extends Neo.state.Provider
 */
class ViewportStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Portal.view.ViewportStateProvider'
         * @protected
         */
        className: 'Portal.view.ViewportStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * @member {Number|null} blogPostCount=null
             */
            blogPostCount: null,
            /**
             * Values are: large, medium, small, xSmall, null
             * @member {String|null} size
             */
            size: null
        }
    }
}

export default Neo.setupClass(ViewportStateProvider);

```

### Core Architecture Module: `apps/portal/view/learn/MainContainerStateProvider.mjs`
```
import ContentSectionStore from '../../store/ContentSections.mjs';
import ContentStore        from '../../store/Content.mjs';
import StateProvider       from '../../../../src/state/Provider.mjs';

/**
 * @class Portal.view.learn.MainContainerStateProvider
 * @extends Neo.state.Provider
 */
class MainContainerStateProvider extends StateProvider {
    static config = {
        /**
         * @member {String} className='Portal.view.learn.MainContainerStateProvider'
         * @protected
         */
        className: 'Portal.view.learn.MainContainerStateProvider',
        /**
         * @member {Object} data
         */
        data: {
            /**
             * @member {String|null} data.contentPath=null
             */
            contentPath: null,
            /**
             * @member {Number|null} data.countPages=null
             */
            countPages: null,
            /**
             * @member {Number|null} data.countPages=null
             */
            countSections: null,
            /**
             * The record which gets shown as the content page
             * @member {Object} data.currentRecord=null
             */
            currentPageRecord: null,
            /**
             * @member {String|null} data.deck=null
             */
            deck: null,
            /**
             * The record which gets shown as the content page
             * @member {Object} data.nextPageRecord=null
             */
            nextPageRecord: null,
            /**
             * The record which gets shown as the content page
             * @member {Object} data.previousPageRecord=null
             */
            previousPageRecord: null
        },
        /**
         * @member {Object} stores
         */
        stores: {
            sections: {
                module: ContentSectionStore
            },
            tree: {
                module: ContentStore
            }
        }
    }

    /**
     * @param {String} key
     * @param {*} value
     * @param {*} oldValue
     */
    onDataPropertyChange(key, value, oldValue) {
        super.onDataPropertyChange(key, value, oldValue);

        let me = this;

        switch (key) {
            case 'countSections': {
                if (value < 1) {
                    me.component.getReference('page-sections-container')?.toggleCls('neo-expanded', false)
                }

                break
            }

            case 'currentPageRecord': {
                let {data}             = me,
                    {countPages}       = data,
                    store              = me.getStore('tree'),
                    index              = store.indexOf(value),
                    nextPageRecord     = null,
                    nextPageText       = null,
                    previousPageRecord = null,
                    previousPageText   = null,
                    i, record;

                // the logic assumes that the tree store is sorted
                for (i=index-1; i >= 0; i--) {
                    record = store.getAt(i);

                    if (record.isLeaf && !me.recordIsHidden(record, store)) {
                        previousPageRecord = record;
                        break
                    }
                }

                me.setData({previousPageText, previousPageRecord});

                // the logic assumes that the tree store is sorted
                for (i=index+1; i < countPages; i++) {
                    record = store.getAt(i);

                    if (record.isLeaf && !me.recordIsHidden(record, store)) {
                        nextPageRecord = record;
                        break
                    }
                }

                me.setData({nextPageText, nextPageRecord});

                me.component.getReference('sidenav-container')?.toggleCls('neo-expanded', false)

                break
            }

            case 'deck': {
                if (value) {
                    const folder = value === 'learnneo' ? 'learn/' : `resources/data/deck/${value}/`;
                    me.data.contentPath = Neo.config.basePath + folder
                }

                break
            }
        }
    }

    /**
     * We need to check the parent-node chain inside the tree.
     * => Any hidden parent-node results in a hidden record.
     * @param {Object} record
     * @param {Neo.data.Store} store
     * @returns {Boolean}
     */
    recordIsHidden(record, store) {
        if (record.hidden) {
            return true
        }

        if (record.parentId !== null) {
            return this.recordIsHidden(store.get(record.parentId), store)
        }

        return false
    }
}

export default Neo.setupClass(MainContainerStateProvider);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #19409** (2026-10-05): **A release note is published without the frontmatter that dates it**
  *Symptoms*: ## Context  Defect-note `824539f4`, found during #19166. `buildScripts/docs/index/release.mjs` dates each release by its note's `publishedAt`, and falls back to `stats.birthtime`. Before #19322, the Brain sync re-materialized each released note from its GitHub Release, frontmatter included. Since #19322, `publish.mjs` keeps the authored `.github/RELEASE_NOTES/v<version>.md` as the archive, and no step writes `tagName` or `publishedAt`. 168 of the 169 notes carry it. `v13.2.0.md`, the first note released under the new flow, does not.  ## The Problem  From 13.2 on, a release's date in the Portal is a file creation time: - At the cut, `prepare.mjs` indexes the note by its birthtime in the operator's checkout, which is whenever the file arrived there. - Pages step 4.1 copies the notes on every deploy. Its index dates 13.2.0 by that copy, so the date moves with each redeploy, and the npm package's index carries a third date.  Measured: indexing `.github/RELEASE_NOTES` from a fresh worktree dated 13.2.0 at the second the worktree was created.  ## The Architectural Reality  - `publish.mjs`:   - Step 2 runs `prepare.mjs`, which rebuilds `releases.json`, and commits "Release v<version>".   - Step 3 squashes to `main`, and Step 4 appends the atomic-commit line to the note.   - Step 5 creates the GitHub Release from the note. It strips the frontmatter (`/^---[\s\S]+?---\s*/`) and uses the first H1 as the title. - The archived notes' frontmatter is the GitHub Release's: `tagName`, `name`

- **Issue #19405** (2026-10-05): **fix(form): a fieldset's legend changes reach the DOM (#19404)**
  *Symptoms*: Resolves #19404  A fieldset's legend changes now reach the DOM. `updateLegend()` had two defects: - **Empty branch.** It wrote `reomveDom` (both the set and the delete; since 2021) and raised no depth, so an emptied legend never left. - **Rename branch.** It changed the legend silently at depth 2 without `denseUpdate`. A child's own update merging into that cycle made the payload sparse, so the legend went out as a reference and its new text was never sent.  Both branches now raise the depth and mark the cycle dense. This is the contract `grid.View` and #19403's `hide()` use.  Evidence: L2 (unit arms on the produced deltas, red on `dev` source and green with the fix) → L2 required (the defect is the update payload; the fix touches no rendering path of its own). Residual: none.  agent-preflight: not hosted here; baseline pr-body and the engine CI ran.  ## AC Evidence | AC | Evidence | |---|---| | AC-1 | CI-covered: `unit/form/FieldsetLegend.spec.mjs`. Without the fix, the emptied legend keeps `removeDom` undefined and sends no `removeNode`, and the renamed legend sends no `updateVtext`. Both arms are green with it. | | AC-2 | TabContainer: no red can be built. Its own `setSilent({cls})` primes the merge path, so the bar and strip register as merged children and are expanded. The ticket body records the trace, and no line is added there. | | AC-3 | Locally with the fix: `npm run test-unit` 4,793 passed, 2 skipped; components 417 passed (before the rebase onto #19403, which this

- **Issue #19404** (2026-10-05): **A fieldset's legend changes are lost when a sibling update makes the cycle sparse**
  *Symptoms*: ## Context  #19402 (PR #19403, merged) fixed this class at `Component#hide()`. Its Out of Scope named three other owners that raise their own `updateDepth` before changing children, with no claim about them. At `dev` `05a161bb9f` each has the same shape: it changes children silently (`setSilent`), raises `updateDepth = 2` and leaves `denseUpdate` unset. Measuring found a red at one of them: - **`form/Fieldset#updateLegend()`** (`src/form/Fieldset.mjs:211–242`): red, and this ticket's subject. - **`tab/Container#afterSetTabBarPosition()`** (`src/tab/Container.mjs:250–267`): no red reachable today, excluded. The trace is under The Fix. - **`calendar/view/calendars/List`** (`src/calendar/view/calendars/List.mjs:63–82`, the item builder): unmeasured, and no claim is made.  Fieldset also carries two defects of its own in the empty-legend branch, present since 2021 (`c1bbd220dc`): - It writes `legend.vdom.reomveDom` (a typo, in both the set and the delete). - It never raises the depth, so an emptied legend cannot leave the DOM even with the spelling fixed.  Red on `dev` (unit, two arms, `test/playwright/unit/form/FieldsetLegend.spec.mjs`): - `title = ''` with `iconClsChecked: ''`: `legend.vdom.removeDom` stays `undefined` and no `removeNode` is emitted. - Two renames in one pass, then a child's own update: no `updateVtext` reaches the legend's text node, and only the child's `textContent` (`Close`) is sent.  Sweeps at 2026-10-05T11:32Z: - Live: the latest 20 open neo issues; none e

- **Issue #19403** (2026-10-05): **fix(component): hide() keeps its removal when a sibling update merges into the parent cycle (#19402)**
  *Symptoms*: Resolves #19402  A component hidden while a sibling hides and renames in the same pass now leaves the DOM. `hide()` changes the child's vdom silently and raises its parent to depth 2. The sibling's rename is its own update, and it merges into that parent cycle, so `executeVdomUpdate` built the payload sparse (merged children only) and `TreeBuilder` pruned the hidden child to a `{componentId}` reference. Its removal was never diffed. `hide()` now sets `parent.denseUpdate`, the documented exception for an owner that changed descendants silently; `grid.View` already sets it next to its own depth bump. The flag resets at collection, so it lasts one cycle.  Evidence: L3 (a real-Chrome component arm with real workers, plus a payload-level unit arm, both red on `dev` `05a161bb9f` without the fix) → L3 required (the defect is a DOM-presence claim). Residual: none.  agent-preflight: not hosted here; baseline pr-body and the engine CI ran.  ## AC Evidence | AC | Evidence | |---|---| | AC-1 | CI-covered: `unit/component/HideMergedSibling.spec.mjs`. Without the fix it is red: removals `["neo-button-2"]` only, and the vnode keeps the hidden child. | | AC-2 | CI-covered: `component/component/HideMergedSibling.spec.mjs` with its harness `component/apps/hide-merged-sibling/`. Without the fix it is red: `#hide-merged-sibling-change` count 1. | | AC-3 | `npm run test-unit`: 4,792 passed, 2 skipped. Component config: 418 passed. Both run locally with the fix; CI runs both. |  ## Deltas from tic

- **Issue #19402** (2026-10-05): **hide() is lost when a sibling update merges into the parent's cycle**
  *Symptoms*: ## Context  Vega's defect-note (2026-10-05 10:12Z): in the Institution's Seat group, a Change button hidden while its sibling Adopt button is hidden *and renamed* in the same synchronous pass stays in the DOM. Real Chrome read it at `display: flex` six times over 1.8 s while the component read `hidden: true`. The Institution worked around it by not renaming a button that is being hidden.  Reproduced in the Engine at `dev` `036cb05a40`, so this is an independent second occurrence: - **Component tier** (real Chrome, real workers): a replica of the Seat group switch leaves both Change buttons in the DOM. The workaround variant removes them. - **Unit tier**, deterministic and minimal: a mounted hbox `[label, A, B]`, warmed by one ordinary update, then in one pass `A.hidden = true; B.set({hidden: true, text: 'Adopt '})`. The flight emits `removeNode B` only, and the parent's vnode keeps A while `A.vdom.removeDom === true`.  Live latest-open sweep: the latest 20 open neo issues at 2026-10-05T10:46Z, plus a search for `denseUpdate` and for the symptom; no equivalent. A2A: Vega's note and my own lane-intent (10:28Z). Memory Core: the sparse-tree design of 2026-01-20 (below) and `denseUpdate`'s later addition. Own assignments: none on this surface.  ## The Problem  A component the engine reports hidden stays visible: the state and the DOM disagree with no error. It needs only an ordinary pattern, where two siblings change in one handler and one of them both hides and changes another c

- **Issue #19372** (2026-10-03): **A parked vessel's terminal re-show lands one title bar too high**
  *Symptoms*: ## Context  Found by #18532's witness arm (the fourth test of `test/playwright/e2e/workstation/WorkstationNativePopupOverPopupNL.spec.mjs`, on its branch) on `dev` `42b80fee81`, 2026-10-02, headless Chrome on a real display with 67 px of window chrome. The source vessel is parked by the real native-titlebar gesture (dwell → `commitNativeWindowDrop` → the host's `parkTearOutVessel`, receipt `parked: true`); the coordinator then refuses the handoff (`clearNativeWindowDropCandidate` — the path a declined drop, a failed embodiment and a cancelled gesture all take); the restore receipt reads:  ``` rect  : {x: 796, y: 123, width: 320, height: 240}   // the frame the park took the window from frame : {x: 796, y: 56}                              // what moveTo was handed moved : true, admitted: true, terminal: true, addonRestored: false ```  The window re-shows at y 56 — exactly `chrome.top` (67) above where the user left it. The arm's assertion against the parked-from frame fails by 67 on every cycle.  ## The Problem  A refused native handoff, and every non-commit terminal of a pointer-path conversion while the vessel is parked (cancel, reject, a host-routed disconnect — VesselPark's compensating arm), restores the user's window one title bar above where it was. On the native path the user never sees the park, so what they see is the window they were holding jump upward when the drop is declined. The engine reports success (`admitted: true`), so nothing downstream learns the restore

- **Issue #19368** (2026-10-02): **Store append loads drop or replace rows and reset the grid**
  *Symptoms*: ## Context  The Store portion of #17835 is independently reproducible after the scroll-edge protocol and its Institution consumers shipped. The originating author agreed to extract this bounded repair and retire the superseded protocol prescription.  At `dev@42b80fee8102664f9e9fc1d19373efabf0aa00f9`, a real-Store five-arm probe confirms: - populated Pipeline + bulk response + `append:true`: the new page is swallowed; - populated API Store + `append:true`: the old rows are replaced; - ordinary Pipeline replacement still works; - the built-in Stream parser appends nonempty chunks exactly once and leaves an empty stream unchanged.  ## The Problem  `Store.load` honors append when deciding whether to clear for a Pipeline, then admits its bulk result only when `count === 0`. The API branch always assigns `data`, whose setter clears the old collection. Merely fixing membership is insufficient: an appended page reported as an ordinary load makes a bound grid reset to the top.  ## The Architectural Reality  - `src/data/Store.mjs:954–1077` owns transport result admission; its blob is `a025804e40b3cb5ae3ee2bacb4ff835abbf60ec0`. - `Store.add` owns Model conversion and normal collection notifications; `afterSetData:338–351` is the replacement path. - `onCollectionMutate:1116–1127` carries the existing `postChunkLoad` continuation signal. `grid.Body.onStoreLoad` suppresses the scroll-to-top dispatch when that signal is true. `list.Buffered.onStoreLoad` already preserves its scroll anchor. 
  **Post-Mortem & Fix Analysis**:
  > Same-context author intake: `src/data/Store.mjs#load` and its collection-notification path own response admission and the continuation signal. `grid.Body.onStoreLoad` already consumes `postChunkLoad`; adding a second acquisition protocol would treat the wrong layer. Prescription checked against those exact methods and the five-arm real-Store probe at `42b80fee`. Positive ROI: restore the existing opt-in append intent with bounded tests, without changing default replacement, implicit page advancement or streaming rollback. No new production module; no ADR change. Atomic issue creation already assigned this seat, verified before branch work.  Origin Session ID: 308bda12-9bd8-4421-b836-138deae72eb2

- **Issue #19361** (2026-10-02): **grid.Body's scrollEdge latch survives an unmount: a store load behind a hidden grid consumes the edge the operator has not reached**
  *Symptoms*: ## Context  #19356 / PR #19357 gave `Neo.grid.Body` the `scrollEdge` event: announced once when the visible window reaches the store's last `bufferRowRange` rows, latched on the store's count (`#scrollEdgeAnnouncedFor`), re-armed when the count changes or the window leaves the edge. #19359 / PR #19360 added `total` and the hidden-only-append rule.  Its second consumer, the Fleet Manager's memories pane (neomjs/neo-agent-institution#429 / PR #434), hides its summary grid while a drill-in owns the zone. @neo-gpt-sophie's review of that PR traced what the latch does there, at engine `93769448934166a8c98b4d99eccda4c3d347caeb` and unchanged on `dev`: a store load reaching a hidden body still runs `onStoreLoad → createViewData → updateMountedAndVisibleRows`, the body keeps the geometry it last measured (`afterSetAvailableHeight` ignores a non-positive value, nothing resets `availableRows` or the latch on unmount), so the edge for the NEW count is announced into a hidden grid and latched. When the grid is shown again at that same count, nothing announces: the operator stands at an edge the engine believes it has already reported.  ## The Problem  A one-shot event delivered while nobody can act on it is consumed, not deferred. The consumer in PR #434 carries a replay (`summaryEdgeDeferred`: remember the refused edge, replay it once on return), which is the right interim and the wrong permanent home: every consumer that ever hides a grid with a growing store would need the same bookke

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

### Incident Patch 1: `08f340d5` (2026-10-05)
**Commit Message**: fix(release): publish stamps the release note's frontmatter before prepare indexes it (#19409) (#19410)

* fix(release): publish stamps the release note's frontmatter before prepare indexes it (#19409)

The release index dates each release by its note's publishedAt and falls
back to the file's creation time. Since the authored notes stay in the
engine as the archive, nothing re-materializes them from the GitHub Release,
so from 13.2 on a release would be dated by whichever checkout or deploy
built the index. publish.mjs now stamps tagName, name, publishedAt,
isPrerelease and isDraft into the note at the start of Step 2, before
prepare.mjs rebuilds the index. A note that already has frontmatter is left
alone, and Step 5 still strips the block from the GitHub Release body.

* fix(release): the release body split survives a dashed title, and build metadata is no prerelease (#19409)

Step 5 stripped frontmatter with a lazy regex that stops at the first ---,
so a stamped note whose title contains --- handed GitHub the rest of its
frontmatter. The title and body split moves into releaseNoteFrontmatter.mjs
as getReleaseNoteParts, which parses the block with gray-matter, and Step 5
and the

**File**: `buildScripts/release/publish.mjs` (modified, +14/-13)
```diff
@@ -16,8 +16,9 @@
  * 5. **Distribution**: Triggers the GitHub Release (which cascades to npm).
  *
  * The release note is authored at `.github/RELEASE_NOTES/v<version>.md` and stays there as the
- * archive. The conversation corpus publishes from `neomjs/github-content-sync`, so the engine
- * carries no synced content. The Knowledge Base upload is Brain-side lifecycle work in the
+ * archive, stamped with its GitHub Release frontmatter in Step 2. The conversation corpus
+ * publishes from `neomjs/github-content-sync`, so the engine carries no synced content.
+ * The Knowledge Base upload is Brain-side lifecycle work in the
  * `neo-agent-brain` repository, whose release runbook is the next step after this script
  * finishes. The boundary is deliberate: this script imports and spawns nothing from the Brain, so
  * the Engine can be released from an Engine-only checkout.
@@ -28,6 +29,10 @@
 import {execSync} from 'child_process';
 import fs         from 'fs-extra';
 import path       from 'path';
+import {
+    getReleaseNoteParts,
+    stampReleaseNote
+} from './releaseNoteFrontmatter.mjs';
 
 const root = path.resolve();
 
@@ -100,6 +105,9 @@ async function main() {
 
     console.log('📦 Step 2: Preparing Release Artifacts...');
 
+    // The release index dates a release by its note's frontmatter, so the note is stamped before prepare rebuilds it
+    fs.writeFileSync(releaseNotePath, stampReleaseNote(fs.readFileSync(releaseNotePath, 'utf-8'), {publishedAt: new Date(), version: newVersion}));
+
     // Run prepare script
     runCommand('node buildScripts/release/prepare.mjs', 'Failed to run prepareRelease.mjs');
 
@@ -189,21 +197,14 @@ async function main() {
     let   tempFileCreated = false;
 
     try {
-        let noteContent = fs.readFileSync(releaseNotePath, 'utf-8');
-
-        // 1. Remove Frontmatter
-        noteContent = noteContent.replace(/^---[\s\S]+?---\s*/, '');
+        const {body, title} = getReleaseNoteParts(fs.readFileSync(releaseNotePath, 'utf-8'));
 
-        // 2. Extract Title (first H1)
-        const titleMatch = noteContent.match(/^#\s+(.+)$/m);
-        if (titleMatch) {
-            releaseTitle = titleMatch[1].trim();
-            // 3. Remove Title from body
-            noteContent = noteContent.replace(/^#\s+.+$/m, '').trim();
+        if (title) {
+            releaseTitle = title
         }
 
         // Write cleaned body to temp file
-        fs.writeFileSync(tempBodyPath, noteContent);
+        fs.writeFileSync(tempBodyPath, body);
         releaseBodyPath = tempBodyPath;
         tempFileCreated = true;
 
```

**File**: `buildScripts/release/releaseNoteFrontmatter.mjs` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import matter from 'gray-matter';
+import semver from 'semver';
+
+/**
+ * @module buildScripts.release.releaseNoteFrontmatter
+ * @summary Stamps an authored release note with the frontmatter the Portal's release index dates it by, and splits
+ * a note into the title and body its GitHub Release receives.
+ *
+ * The archived notes in `.github/RELEASE_NOTES` carry their GitHub Release's metadata as frontmatter, and
+ * `buildScripts/docs/index/release.mjs` dates each release by its `publishedAt`. A note is authored without it, and
+ * since the notes stay in the engine as the archive, nothing re-materializes it from GitHub. So `publish.mjs`
+ * stamps the note before `prepare.mjs` rebuilds that index, and later hands GitHub the note without the block.
+ */
+
+/**
+ * @summary The note's title and its body without frontmatter or title: what `gh release create` receives.
+ *
+ * gray-matter ends the frontmatter at a delimiter on its own line, so a title that contains `---` stays the title.
+ * @param {String} content A release note, stamped or not
+ * @returns {{body: String, title: String|null}}
+ */
+export function getReleaseNoteParts(content) {
+    const
+        body  = matter(content).content,
+        title = body.match(/^#\s+(.+)$/m)?.[1].trim() || null;
+
+    return {
+        body: title ? body.replace(/^#\s+.+$/m, '').trim() : body,
+        title
+    }
+}
+
+/**
+ * @summary Returns the note with its release frontmatter prepended, or unchanged when it already has frontmatter.
+ *
+ * Leaving an existing block alone keeps a re-run of the release from moving the date. The `name` is the title
+ * {@link getReleaseNoteParts} gives the GitHub Release.
+ * @param {String} content The authored note
+ * @param {Object} release
+ * @param {Date}   release.publishedAt
+ * @param {String} release.version The version `gh release create` tags, e.g. `13.2.0`
+ * @returns {String}
+ */
+export function stampReleaseNote(content, {publishedAt, version}) {
+    if (matter.test(content)) {
+        return content
+    }
+
+    return matter.stringify(content, {
+        tagName     : version,
+        name        : getReleaseNoteParts(content).title || `v${version}`,
+        publishedAt : publishedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
+        isPrerelease: semver.prerelease(version) !== null,
+        isDraft     : false
+    })
+}
```

**File**: `test/playwright/unit/buildScripts/release/PublishReleaseNoteOrphan.spec.mjs` (modified, +11/-0)
```diff
@@ -25,6 +25,17 @@ test.describe('Release-note lifecycle', () => {
         expect(src).not.toMatch(/fs\.remove(Sync)?\(releaseNotePath\)/);
     });
 
+    test('publish.mjs stamps the note before prepare.mjs indexes it, and strips the stamp from the release body (#19409)', () => {
+        const
+            src        = publish(),
+            stampIdx   = src.indexOf('stampReleaseNote(fs.readFileSync(releaseNotePath'),
+            prepareIdx = src.indexOf('node buildScripts/release/prepare.mjs');
+
+        expect(stampIdx, 'publish.mjs must stamp the note').toBeGreaterThan(-1);
+        expect(prepareIdx).toBeGreaterThan(stampIdx);
+        expect(src).toContain('getReleaseNoteParts(fs.readFileSync(releaseNotePath');
+    });
+
     test('every note sits flat in .github/RELEASE_NOTES, one file per version', () => {
         const entries = fs.readdirSync(notesDir, {withFileTypes: true});
 
```

**File**: `test/playwright/unit/buildScripts/release/ReleaseNoteFrontmatter.spec.mjs` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import {test, expect} from '@playwright/test';
+import fs             from 'node:fs';
+import path           from 'node:path';
+import matter         from 'gray-matter';
+import {
+    getReleaseNoteParts,
+    stampReleaseNote
+} from '../../../../../buildScripts/release/releaseNoteFrontmatter.mjs';
+
+/**
+ * @summary Pins the frontmatter `publish.mjs` stamps into an authored release note: the fields the release
+ * index dates a release by, in the shape the archived notes carry, and the title and body GitHub receives.
+ */
+
+const
+    note        = '# Neo.mjs v13.2.0 Release Notes\n\nThe body.\n',
+    publishedAt = new Date('2026-10-05T12:40:00.123Z');
+
+test.describe('stampReleaseNote (#19409)', () => {
+    test('prepends the GitHub Release frontmatter and keeps the note itself', () => {
+        const {content, data} = matter(stampReleaseNote(note, {publishedAt, version: '13.2.0'}));
+
+        expect(data).toEqual({
+            tagName     : '13.2.0',
+            name        : 'Neo.mjs v13.2.0 Release Notes',
+            publishedAt : '2026-10-05T12:40:00Z',
+            isPrerelease: false,
+            isDraft     : false
+        });
+        expect(content).toBe(note)
+    });
+
+    test('carries the keys an archived note carries', () => {
+        const archived = matter(fs.readFileSync(path.join(process.cwd(), '.github/RELEASE_NOTES/v13.1.0.md'), 'utf8')).data;
+
+        expect(Object.keys(matter(stampReleaseNote(note, {publishedAt, version: '13.2.0'})).data)).toEqual(Object.keys(archived))
+    });
+
+    test('marks a SemVer prerelease as one, and build metadata as none', () => {
+        const isPrerelease = version => matter(stampReleaseNote(note, {publishedAt, version})).data.isPrerelease;
+
+        expect([isPrerelease('13.2.0-beta.1'), isPrerelease('13.2.0+build-1'), isPrerelease('13.2.0')]).toEqual([true, false, false])
+    });
+
+    test('returns a note that already has frontmatter unchanged, so a re-run keeps its date', () => {
+        const stamped = stampReleaseNote(note, {publishedAt, version: '13.2.0'});
+
+        expect(stampReleaseNote(stamped, {publishedAt: new Date('2027-01-01T00:00:00Z'), version: '13.2.0'})).toBe(stamped)
+    });
+
+    test('hands the GitHub Release the authored title and body, without the stamp', () => {
+        expect(getReleaseNoteParts(stampReleaseNote(note, {publishedAt, version: '13.2.0'}))).toEqual({
+            body : 'The body.',
+            title: 'Neo.mjs v13.2.0 Release Notes'
+        })
+    });
+
+    test('keeps a title that contains --- as the title, and the stamp out of the body', () => {
+        const stamped = stampReleaseNote('# Release --- maintenance\n\nThe body.\n', {publishedAt, version: '13.2.1'});
+
+        expect(matter(stamped).data.name).toBe('Release --- maintenance');
+        expect(getReleaseNoteParts(stamped)).toEqual({body: 'The body.', title: 'Release --- maintenance'})
+    })
+});
```

---

### Incident Patch 2: `4f68cebb` (2026-10-05)
**Commit Message**: fix(form): a fieldset's legend changes reach the DOM (#19404) (#19405)

updateLegend() wrote `reomveDom`, so an emptied legend never left, and
it raised no depth for that branch. The rename branch changed the
legend silently at depth 2 without denseUpdate, so a child's update
merging into the cycle made it sparse and the legend's text was never
sent. Both branches now raise the depth and mark the cycle dense.

**File**: `src/form/Fieldset.mjs` (modified, +8/-3)
```diff
@@ -206,7 +206,9 @@ class Fieldset extends FormContainer {
     }
 
     /**
-     *
+     * @summary Syncs the legend with the current title and icon. An empty pair takes the legend out of the DOM, any
+     * other pair renders it, creating the legend on first use. The legend changes silently, so the fieldset's own
+     * update carries it whole, even when a child's update merges into that cycle.
      */
     updateLegend() {
         let me              = this,
@@ -215,18 +217,21 @@ class Fieldset extends FormContainer {
 
         if (iconCls === '' && title === '') {
             if (legend) {
-                legend.vdom.reomveDom = true;
+                legend.vdom.removeDom = true;
+                me.updateDepth        = 2;
+                me.denseUpdate        = true
             }
         } else {
             if (legend) {
                 me.updateDepth = 2;
+                me.denseUpdate = true;
 
                 legend.setSilent({
                     iconCls,
                     text: title
                 });
 
-                delete legend.vdom.reomveDom
+                delete legend.vdom.removeDom
             } else {
                 me.legend = me.insert(0, {
                     module: Legend,
```

**File**: `test/playwright/unit/form/FieldsetLegend.spec.mjs` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+/**
+ * @file test/playwright/unit/form/FieldsetLegend.spec.mjs
+ * @summary Pins that a fieldset's legend changes reach the DOM: an emptied legend leaves it, and a renamed legend
+ * keeps its new text when a child's own update merges into the fieldset's cycle.
+ *
+ * `updateLegend()` changes the legend silently and relies on the fieldset's depth-2 update to carry it. When a
+ * child's own update merges into that cycle, a sparse payload would prune the legend to a reference.
+ */
+
+import {setup} from '../../setup.mjs';
+
+const appName = 'FieldsetLegendTest';
+
+setup({
+    neoConfig: {
+        allowVdomUpdatesInTests: true,
+        useVdomWorker          : false
+    },
+    appConfig: {
+        name: appName
+    }
+});
+
+import {test, expect} from '@playwright/test';
+import Neo            from '../../../../src/Neo.mjs';
+import * as core      from '../../../../src/core/_export.mjs';
+import Button         from '../../../../src/button/Base.mjs';
+import Fieldset       from '../../../../src/form/Fieldset.mjs';
+import VdomHelper     from '../../../../src/vdom/Helper.mjs';
+
+// Imported for its side effect: `manager/Instance.mjs` assigns `Neo.get`, which teardown needs.
+import '../../../../src/manager/Instance.mjs';
+
+test.describe('form.Fieldset: legend changes reach the DOM', () => {
+    let applyDeltas, deltas, fieldset;
+
+    test.beforeEach(async () => {
+        applyDeltas = Neo.applyDeltas;
+        deltas      = [];
+
+        fieldset = Neo.create(Fieldset, {
+            appName,
+            iconClsChecked: '',
+            title         : 'Seat',
+            items         : [{module: Button, text: 'Change'}]
+        });
+
+        await fieldset.initVnode();
+        fieldset.mounted = true;
+
+        // One settled update leaves the fieldset at its default depth, the state a live app is in
+        await fieldset.promiseUpdate();
+
+        Neo.applyDeltas = async (windowId, payload) => {
+            deltas.push(...[payload].flat())
+        }
+    });
+
+    test.afterEach(() => {
+        Neo.applyDeltas = applyDeltas;
+        fieldset?.destroy();
+        fieldset = null
+    });
+
+    const settled = () => expect.poll(() => !fieldset.isVdomUpdating && !fieldset.needsVdomUpdate).toBe(true);
+
+    test('an emptied legend leaves the DOM', async () => {
+        const {legend} = fieldset;
+
+        fieldset.title = '';
+        await settled();
+
+        expect(legend.vdom.removeDom).toBe(true);
+        expect(deltas.some(delta => delta.action === 'removeNode' && delta.id === legend.id)).toBe(true)
+    });
+
+    test('a renamed legend keeps its text when a child update merges into the cycle', async () => {
+        const
+            {legend}  = fieldset,
+            [, child] = fieldset.items;
+
+        // The second rename finds the first flight in the air, so the child's own update merges into the next cycle
+        fieldset.title = 'Seat model';
+        fieldset.title = 'Seat model and effort';
+        child.text     = 'Close';
+        await settled();
+        await expect.poll(() => !child.isVdomUpdating && !child.needsVdomUpdate).toBe(true);
+
+        // A text child changes through `updateVtext`, the legend's own text node
+        const sent = deltas.filter(delta => delta.action === 'updateVtext' && delta.parentId === legend.id).map(delta => delta.value);
+
+        expect(sent).toContain('Seat model and effort');
+        expect(legend.text).toBe('Seat model and effort')
+    })
+});
```

---

### Incident Patch 3: `58fbeaf3` (2026-10-05)
**Commit Message**: fix(component): hide() keeps its removal when a sibling update merges into the parent cycle (#19402) (#19403)

hide() changes the child's vdom silently and raises the parent to depth 2.
A sibling's own update merging into that cycle made the payload sparse,
so the hidden child went out as a reference and stayed in the DOM.
hide() now marks the parent cycle dense, as grid.View does for its rows.

**File**: `src/component/Base.mjs` (modified, +2/-0)
```diff
@@ -1658,6 +1658,8 @@ class Component extends Abstract {
                 if (me.parentId !== 'document.body') {
                     me.vdom.removeDom = true;
                     me.parent.updateDepth = 2;
+                    // This child changed silently, so a sibling's update merging into the cycle must not make it sparse
+                    me.parent.denseUpdate = true;
                     me.parent.update()
                 } else if (!me.mountFlight) {
                     // A node still in its mount flight does not exist yet: the flight unmounts it when it lands
```

**File**: `test/playwright/component/apps/hide-merged-sibling/app.mjs` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import Button    from '../../../../../src/button/Base.mjs';
+import Component from '../../../../../src/component/Base.mjs';
+import Container from '../../../../../src/container/Base.mjs';
+import Viewport  from '../../../../../src/container/Viewport.mjs';
+
+/**
+ * @class Test.Playwright.Component.HideMergedSibling.Viewport
+ * @extends Neo.container.Viewport
+ * @summary Hides two buttons of one row in a single synchronous pass, the second also renamed, so its own update
+ * merges into the row's cycle.
+ */
+class HideMergedSiblingViewport extends Viewport {
+    static config = {
+        className: 'Test.Playwright.Component.HideMergedSibling.Viewport',
+        id       : 'hide-merged-sibling-viewport',
+        layout   : {ntype: 'vbox', align: 'start'},
+        /**
+         * Setting it runs the pass once.
+         * @member {Boolean} pass_=false
+         * @reactive
+         */
+        pass_: false,
+        items: [{
+            module: Container,
+            id    : 'hide-merged-sibling-row',
+            layout: {ntype: 'hbox', align: 'center'},
+            items : [
+                {module: Component, id: 'hide-merged-sibling-label',  text: 'model'},
+                {module: Button,    id: 'hide-merged-sibling-change', text: 'Change'},
+                {module: Button,    id: 'hide-merged-sibling-adopt',  text: 'Adopt gpt-6-luna'}
+            ]
+        }]
+    }
+
+    /**
+     * @param {Boolean} value
+     * @param {Boolean} oldValue
+     */
+    async afterSetPass(value, oldValue) {
+        if (!value) return;
+
+        // One settled update leaves the row at its default depth, the state a live app is in
+        await Neo.get('hide-merged-sibling-row').promiseUpdate();
+
+        Neo.get('hide-merged-sibling-change').hidden = true;
+        Neo.get('hide-merged-sibling-adopt').set({hidden: true, text: 'Adopt '})
+    }
+}
+
+HideMergedSiblingViewport = Neo.setupClass(HideMergedSiblingViewport);
+
+/** @summary Boots the harness viewport. */
+export const onStart = () => Neo.app({
+    mainView: HideMergedSiblingViewport,
+    name    : 'Test.Playwright.HideMergedSibling'
+});
```

**File**: `test/playwright/component/apps/hide-merged-sibling/index.html` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+    <meta charset="UTF-8">
+    <meta name="viewport" content="width=device-width, initial-scale=1.0">
+    <title>Neo.mjs Component Test App</title>
+</head>
+<body>
+    <script src="../../../../../src/MicroLoader.mjs" type="module"></script>
+</body>
+</html>
```

**File**: `test/playwright/component/apps/hide-merged-sibling/neo-config.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+    "appPath": "test/playwright/component/apps/hide-merged-sibling/app.mjs",
+    "basePath": "../../../../../",
+    "environment": "development",
+    "mainPath": "./Main.mjs",
+    "mainThreadAddons": [
+        "Navigator",
+        "Stylesheet"
+    ]
+}
```

**File**: `test/playwright/component/component/HideMergedSibling.spec.mjs` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import {test, expect} from '@playwright/test';
+
+/**
+ * @summary A child hidden while its sibling hides and renames in the same pass leaves the DOM.
+ *
+ * The second hide's rename is its own update, and it merges into the row's cycle. Before the fix that cycle went
+ * sparse and kept the first hidden button as a reference, so its node stayed at `display: flex` while the
+ * component read `hidden: true`. The pass runs inside the App Worker in one synchronous turn
+ * (`apps/hide-merged-sibling/app.mjs`). The unit witness is `unit/component/HideMergedSibling.spec.mjs`.
+ */
+test.describe('component.Base: hide() beside a sibling whose own update merges into the parent cycle', () => {
+    test('neither hidden button is left in the DOM', async ({page}) => {
+        await page.goto('test/playwright/component/apps/hide-merged-sibling/index.html');
+        await page.waitForSelector('#hide-merged-sibling-adopt', {state: 'attached'});
+
+        const result = await page.evaluate(() => Neo.worker.App.setConfigs({id: 'hide-merged-sibling-viewport', pass: true}));
+        expect(result.success).toBe(true);
+
+        await expect(page.locator('#hide-merged-sibling-adopt')).toHaveCount(0);
+        await expect(page.locator('#hide-merged-sibling-change')).toHaveCount(0);
+        await expect(page.locator('#hide-merged-sibling-label')).toHaveCount(1)
+    })
+});
```

**File**: `test/playwright/unit/component/HideMergedSibling.spec.mjs` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+/**
+ * @file test/playwright/unit/component/HideMergedSibling.spec.mjs
+ * @summary Pins that `hide()` reaches the DOM when a sibling's own update merges into the same parent cycle.
+ *
+ * `hide()` changes the child's vdom silently and raises the parent to depth 2. When another child's own update
+ * merges into that cycle, the cycle would build sparse (merged children only) and prune the hidden child to a
+ * reference, so its removal was never diffed. The browser witness is
+ * `component/component/HideMergedSibling.spec.mjs`.
+ */
+
+import {setup} from '../../setup.mjs';
+
+const appName = 'HideMergedSiblingTest';
+
+setup({
+    neoConfig: {
+        allowVdomUpdatesInTests: true,
+        useVdomWorker          : false
+    },
+    appConfig: {
+        name: appName
+    }
+});
+
+import {test, expect} from '@playwright/test';
+import Neo            from '../../../../src/Neo.mjs';
+import * as core      from '../../../../src/core/_export.mjs';
+import Button         from '../../../../src/button/Base.mjs';
+import Component      from '../../../../src/component/Base.mjs';
+import Container      from '../../../../src/container/Base.mjs';
+import VdomHelper     from '../../../../src/vdom/Helper.mjs';
+
+// Imported for its side effect: `manager/Instance.mjs` assigns `Neo.get`, which teardown needs.
+import '../../../../src/manager/Instance.mjs';
+
+test.describe('component.Base: hide() beside a sibling whose own update merges into the parent cycle', () => {
+    let applyDeltas, row;
+
+    test.beforeEach(async () => {
+        applyDeltas = Neo.applyDeltas;
+
+        row = Neo.create(Container, {
+            appName,
+            layout: {ntype: 'hbox'},
+            items : [
+                {module: Component, text: 'model'},
+                {module: Button,    text: 'Change'},
+                {module: Button,    text: 'Adopt gpt-6-luna'}
+            ]
+        });
+
+        await row.initVnode();
+        row.mounted = true;
+
+        // One settled update leaves the row at its default depth, the state a live app is in
+        await row.promiseUpdate()
+    });
+
+    test.afterEach(() => {
+        Neo.applyDeltas = applyDeltas;
+        row?.destroy();
+        row = null
+    });
+
+    test('both hidden children leave the delta stream and the vnode', async () => {
+        const
+            [label, change, adopt] = row.items,
+            removed                = [];
+
+        Neo.applyDeltas = async (windowId, deltas) => {
+            [deltas].flat().forEach(delta => delta.action === 'removeNode' && removed.push(delta.id))
+        };
+
+        // One synchronous pass: the second hide also renames, so its own update merges into the parent's cycle
+        change.hidden = true;
+        adopt.set({hidden: true, text: 'Adopt '});
+
+        await expect.poll(() => !row.isVdomUpdating && !row.needsVdomUpdate && !adopt.isVdomUpdating).toBe(true);
+
+        expect(change.vdom.removeDom).toBe(true);
+        expect(removed).toEqual(expect.arrayContaining([change.id, adopt.id]));
+        expect(row.vnode.childNodes.map(node => node.componentId ?? node.id)).toEqual([label.id])
+    })
+});
```

---

### Incident Patch 4: `036cb05a` (2026-10-04)
**Commit Message**: build(deps): bump neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml (#19398)

Bumps the actions group with 1 update: [neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml](https://github.com/neomjs/neo-agent-skills).


Updates `neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml` from 0.1.19 to 0.1.25
- [Commits](https://github.com/neomjs/neo-agent-skills/compare/v0.1.19...v0.1.25)

---
updated-dependencies:
- dependency-name: neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml
  dependency-version: 0.1.25
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: actions
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/pr-baseline.yml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ permissions:
 # theirs. It lives in the Brain and is read at the Brain's `dev`, never from the pull request under review.
 jobs:
   baseline:
-    uses: neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml@v0.1.19
+    uses: neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml@v0.1.25
     with:
       required_base: dev
       team_roster_repository: neomjs/neo-agent-brain
```

---

### Incident Patch 5: `b5c44026` (2026-10-04)
**Commit Message**: build(deps-dev): bump the all-deps group with 2 updates (#19397)

Bumps the all-deps group with 2 updates: [cssnano](https://github.com/cssnano/cssnano) and [sass](https://github.com/sass/dart-sass).


Updates `cssnano` from 9.1.1 to 9.1.2
- [Release notes](https://github.com/cssnano/cssnano/releases)
- [Commits](https://github.com/cssnano/cssnano/compare/[REDACTED_EMAIL]@9.1.2)

Updates `sass` from 1.105.0 to 1.105.1
- [Release notes](https://github.com/sass/dart-sass/releases)
- [Changelog](https://github.com/sass/dart-sass/blob/main/CHANGELOG.md)
- [Commits](https://github.com/sass/dart-sass/compare/1.105.0...1.105.1)

---
updated-dependencies:
- dependency-name: cssnano
  dependency-version: 9.1.2
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: all-deps
- dependency-name: sass
  dependency-version: 1.105.1
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: all-deps
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +129/-129)
```diff
@@ -19,7 +19,7 @@
                 "autoprefixer": "^10.6.1",
                 "chalk": "^6.0.1",
                 "commander": "^15.0.0",
-                "cssnano": "^9.1.1",
+                "cssnano": "^9.1.2",
                 "envinfo": "^7.21.0",
                 "esbuild": "^0.28.2",
                 "fast-glob": "^3.3.3",
@@ -38,7 +38,7 @@
                 "neo-agent-skills": "0.1.29",
                 "parse5": "^8.0.1",
                 "postcss": "^8.5.28",
-                "sass": "^1.105.0",
+                "sass": "^1.105.1",
                 "semver": "^7.8.5",
                 "terser": "^5.51.2",
                 "url": "^0.11.4",
@@ -2904,9 +2904,9 @@
             }
         },
         "node_modules/baseline-browser-mapping": {
-            "version": "2.11.25",
-            "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.25.tgz",
-            "integrity": "sha512-gMmEShwwq7FJqMwvfRwvCl00v4kN+KOfJqXn+f4nrufak5gNHJOksd/60Dvjuz7sI8Y5WiSFBa8FEYr+zoyqCw==",
+            "version": "2.11.26",
+            "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.26.tgz",
+            "integrity": "sha512-GLQdD3y6UF8iVuMJl5fHgE4jdn/ua7n+toKfLgNlg3BqQtOZjpy68T8Tup8/wGWZCDlm7KMg7tPb4MPn7oN0TQ==",
             "dev": true,
             "license": "Apache-2.0",
             "bin": {
@@ -3001,9 +3001,9 @@
             }
         },
         "node_modules/browserslist": {
-            "version": "4.29.1",
-            "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.1.tgz",
-            "integrity": "sha512-AUdjuRyCNGUYtqpqfTmWyM4fXay8yIQhmLnvYe/THMGfT9B/34X7xQd3ifKxwyNPPpowVBjLb+64BN9Rn1mizw==",
+            "version": "4.29.3",
+            "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.3.tgz",
+            "integrity": "sha512-1R4kiYKXGViqEN0CnoDrXc1StD9niAwu+j2dukWzrD4bJgsD4lDmEp0CRbc6E/vYJIfTHwPmwyaKtVSudICdPA==",
             "dev": true,
             "funding": [
                 {
@@ -3021,9 +3021,9 @@
             ],
             "license": "MIT",
             "dependencies": {
-                "baseline-browser-mapping": "^2.11.25",
-                "caniuse-lite": "^1.0.30001810",
-                "electron-to-chromium": "^1.5.438",
+                "baseline-browser-mapping": "^2.11.26",
+                "caniuse-lite": "^1.0.30001813",
+                "electron-to-chromium": "^1.5.439",
                 "node-releases": "^2.0.57",
                 "update-browserslist-db": "^1.3.3"
             },
@@ -3152,9 +3152,9 @@
             }
         },
         "node_modules/caniuse-lite": {
-            "version": "1.0.30001810",
-            "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
-            "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
+            "version": "1.0.30001814",
+            "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001814.tgz",
+            "integrity": "sha512-/Uaf1lAzr59XcMpW0o96WoEfr+VXK2OX4U9AgFoiSHsVJ4HppnIFUjtYzsyDH2+tgANaQb2/oxYGwCPapN1FpA==",
             "dev": true,
             "funding": [
                 {
@@ -3497,13 +3497,13 @@
             }
         },
         "node_modules/cssnano": {
-            "version": "9.1.1",
-            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.1.1.tgz",
-            "integrity": "sha512-Jm3JBThKaUOo6Q9Buyjez+ww/SsgbwmLgg8H5fIf+wAAv5clG2x1KupoQR2PejzEbRyTVqVu93nORWT/320J/g==",
+            "version": "9.1.2",
+            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.1.2.tgz",
+            "integrity": "sha512-UJnrkOxzaK21cYEbxnp21vUohm/wg8B8R0eoLe7A6Jnm9nHeIQ0irn3L9HYzml9BFkrF97JwE7d6HV4UU6+1dQ==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
-                "cssnano-preset-default": "^9.1.1"
+                "cssnano-preset-default": "^9.1.2"
             },
             "engines": {
                 "node": "^22.22.3 || ^24.15.0 || >=26.0"
@@ -3517,41 +3517,41 @@
             }
         },
         "node_modules/cssnano-preset-default": {
-            "version": "9.1.1",
-            "resolved": "https://registry.npmjs.org/cssnano-preset-default/-/cssnano-preset-default-9.1.1.tgz",
-            "integrity": "sha512-c+9shS5wCw+hpS2TzZ4ndZQzM4ffMjzKqfPc/xxzUJ98J7iNJVfuYuFEFuLHaaCW7oIZAEnc0GLe6Lo46Rcikg==",
+            "version": "9.1.2",
+            "resolved": "https://registry.npmjs.org/cssnano-preset-default/-/cssnano-preset-default-9.1.2.tgz",
+            "integrity": "sha512-prjUo7JkR3JD74ODNuBwhz1c/DyQLtj1Te0VijEI7PCY8So+Y1KYk84tQAP2F74Rmb9NUPzQjUCmLrn5MbjctA==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
-                "browserslist": "^4.29.1",
+                "browserslist": "^4.29.2",
                 "cssnano-uti
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@
         "autoprefixer"                 : "^10.6.1",
         "chalk"                        : "^6.0.1",
         "commander"                    : "^15.0.0",
-        "cssnano"                      : "^9.1.1",
+        "cssnano"                      : "^9.1.2",
         "envinfo"                      : "^7.21.0",
         "esbuild"                      : "^0.28.2",
         "fast-glob"                    : "^3.3.3",
@@ -128,7 +128,7 @@
         "neo-agent-skills"             : "0.1.29",
         "parse5"                       : "^8.0.1",
         "postcss"                      : "^8.5.28",
-        "sass"                         : "^1.105.0",
+        "sass"                         : "^1.105.1",
         "semver"                       : "^7.8.5",
         "terser"                       : "^5.51.2",
         "url"                          : "^0.11.4",
```

---

### Incident Patch 6: `c40bbf5a` (2026-10-04)
**Commit Message**: fix(agentos): load Skills 0.1.29 (#19390) (#19391)

**File**: `AGENTS.md` (modified, +4/-4)
```diff
@@ -34,10 +34,10 @@ This file contains behavioral rules and protocols that must be enforced on every
   </defense_layer>
   <defense_layer name="L3_No_Hold_State">
     <premise>
-      The helpful-assistant prior seeks permission to stop, manufacturing ever-more-sophisticated "valid idle" justifications (owned-but-blocked, verified-no-lane, "a better idle-validator"); a more capable agent fabricates a more convincing hold, so sophistication makes idling worse.
+      Activity is not progress. Completing a PR does not end ownership of its user outcome.
     </premise>
     <directive>
-      There is no hold state. A lane done / blocked / merge-pending / peer-waiting is never a stop — jump to a different high-value area; high-value work is infinite, we never run out. Never ask "may I stop?" (the regression's entry point); only "what's next?" is a question. Any "valid stop / hold / terminal" proposal, however well-evidenced, is this regression by construction — reject it. Settled: do not re-litigate or build stop-machinery. There is always a high-value lane. The warrant (teeth-test): does this advance a NAMED lane right now? — substance, not costume; both loopholes + detail in `§no_hold_state_taxonomy`.
+      Advance the current operator goal; absent one, the accepted plan's next outcome. At lifecycle boundaries, use /post-review-pickup for the next unresolved acceptance step or to unblock its owner. Judge work by how it advances the accepted outcome, not by its artifact type. A done or blocked leaf changes the next action, not the goal. A planning gap is work: investigate the outcome and propose its next step; never ask permission to stop. Do not invent a lane to satisfy continuation. Retain ownership through the accepted outcome or an explicit handoff. Detail: `§no_hold_state_taxonomy`.
     </directive>
   </defense_layer>
 </prompt_firewall>
@@ -146,7 +146,7 @@ Bias: PR diff >> PR body. For us: PR Diff === PR Body — graph-ingestion substr
 **Decision Escalation Ladder:**
 Before asking the human:
 1. **Tier 1 (Verify Before Assert):** Use fresh falsifying evidence; A2A, `ask_knowledge_base`, `memory-mining`, and `tech-debt-radar` support the sweep.
-2. **Tier 2 (Decide & Document):** For a local/reversible choice undoable in one commit with no API break, cross-cutting mutation, or named-peer authority, decide, implement, and record why.
+2. **Tier 2 (Decide & Document):** For a choice undoable in one commit with no API break, cross-cutting mutation, named-peer authority, new user obligation or changed accepted outcome constraint, decide, implement, and record why.
 3. **Tier 2.5 (Named-Peer Authority):** For a reversible fork on a named peer's surface, send that peer the fork, recommendation, and evidence, then keep driving fork-independent work (ping-and-continue, never ping-and-wait). Named authority—not uncertainty or deference—triggers it.
 4. **Tier 3 (Ideation Sandbox):** Route high-blast or cross-substrate ambiguity through `/ideation-sandbox`.
 5. **Tier 4 (Human-Authority Ask):** Ask the human only for human-owned domains (merge, credentials, subjective aesthetics) or operator-surfaced intent clarification.
@@ -182,4 +182,4 @@ At turn start you MUST call `list_messages({status:'unread'})` and state the cou
 - **Ticket Creation Freshness:** Before any `create_issue`, invoke `ticket-create` (its Content Sweep requires live latest-open queue evidence beyond KB/local duplicate checks).
 - **File Reading Efficiently:** Reading modified files; efficiency patterns.
 - **Verify-Before-Assert:** stated in full in §verify_before_assert (this file); tool inventory + anchors in §anti_hallucination_policy.
-- **Wake/Heartbeat → run the cycle (`/post-review-pickup`):** drain the lifecycle queue (own-PR changes/review → own-PR-green→request-review) before a new lane; no holding terminal (§L3_No_Hold_State). Three heartbeats with no forward artifact = critical failure → `/post-review-pickup` + `NightShiftLeasedDriver.md`.
+- **Wake/Heartbeat → run the cycle (`/post-review-pickup`):** drain the lifecycle queue (own-PR changes/review → own-PR-green→request-review) before a new lane; no holding terminal (§L3_No_Hold_State). Three heartbeats without a moved acceptance step or ranked proposal = critical failure → `/post-review-pickup` + `NightShiftLeasedDriver.md`.
```

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -35,7 +35,7 @@
                 "marked": "^18.0.14",
                 "mermaid": "^12.0.0",
                 "monaco-editor": "0.57.0",
-                "neo-agent-skills": "0.1.19",
+                "neo-agent-skills": "0.1.29",
                 "parse5": "^8.0.1",
                 "postcss": "^8.5.28",
                 "sass": "^1.105.0",
@@ -6211,9 +6211,9 @@
             }
         },
         "node_modules/neo-agent-skills": {
-            "version": "0.1.19",
-            "resolved": "https://registry.npmjs.org/neo-agent-skills/-/neo-agent-skills-0.1.19.tgz",
-            "integrity": "sha512-s3w9F2RUa/34SGZHTnlXbWki3r+qqB4sosfX6dCyOFM+nKf06TQdd5PCuBS+c7gAC4iCONlaDdGVod5ilC0U5Q==",
+            "version": "0.1.29",
+            "resolved": "https://registry.npmjs.org/neo-agent-skills/-/neo-agent-skills-0.1.29.tgz",
+            "integrity": "sha512-vvJkSqUhhP6X/zsQELeoTLQQOwxTp6PHbCpsvJ5V3pJYj44uYWTrp1bZ4UVi9k7LwQHr6J9PmmtuQVaSjFazsA==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@
         "marked"                       : "^18.0.14",
         "mermaid"                      : "^12.0.0",
         "monaco-editor"                : "0.57.0",
-        "neo-agent-skills"             : "0.1.19",
+        "neo-agent-skills"             : "0.1.29",
         "parse5"                       : "^8.0.1",
         "postcss"                      : "^8.5.28",
         "sass"                         : "^1.105.0",
```

---

### Incident Patch 7: `184af1b7` (2026-10-03)
**Commit Message**: fix(workstation): the park records the vessel's content rect, so a terminal re-show lands on the frame it was parked from (#19372) (#19374)

* fix(workstation): the park records the vessel's content rect, so a terminal re-show lands on the frame it was parked from (#19372)

* docs(workstation): resolveVesselRestoreAnchor carries its @summary marker (#19372)

**File**: `apps/workstation/view/VesselWorkspace.mjs` (modified, +21/-2)
```diff
@@ -501,7 +501,7 @@ class VesselWorkspace extends DockWorkspace {
 
                 return me.vesselParkHandlers.onConversionIn({
                     itemId    : data.itemId,
-                    sourceRect: data.record?.sourceRect ?? null,
+                    sourceRect: me.resolveVesselRestoreAnchor(data.itemId),
                     windowName: me.resolveTearOutVessel(data.itemId)?.windowName
                 })
             },
@@ -555,7 +555,7 @@ class VesselWorkspace extends DockWorkspace {
 
                 return me.nativeVesselParkHandlers.onConversionIn({
                     itemId,
-                    sourceRect: me.resolveVesselConversionSourceRect({itemId}),
+                    sourceRect: me.resolveVesselRestoreAnchor(itemId),
                     windowName: me.resolveTearOutVessel(itemId)?.windowName
                 })
             }
@@ -1470,6 +1470,25 @@ class VesselWorkspace extends DockWorkspace {
         return rect && {height: rect.height, width: rect.width, x: rect.x, y: rect.y}
     }
 
+    /**
+     * @summary Resolves the CONTENT rect the park records as its restore anchor. The conversion samples the
+     * frame ({@link #resolveVesselConversionSourceRect}: the plane the pointer rides and the park
+     * admission reads), but the re-show converts the rect it is handed into a frame origin by
+     * taking the window's own chrome off it — so the anchor must be the content rect, or the
+     * window re-shows one chrome too high. A child publishing no inner rect records its outer one:
+     * chrome-less, the two coincide.
+     * @param {String|null} itemId
+     * @returns {Object|null}
+     * @protected
+     */
+    resolveVesselRestoreAnchor(itemId) {
+        let windowId = this.resolveTearOutVessel(itemId)?.windowId,
+            record   = windowId && Neo.manager?.Window?.get(windowId),
+            rect     = record?.innerRect ?? record?.outerRect;
+
+        return rect && {height: rect.height, width: rect.width, x: rect.x, y: rect.y}
+    }
+
     /**
      * @summary Admits a full popup Workspace and transfers its pane through one Group transaction.
      * @param {Object} document Pure reducer result; source truth is re-read at the queue head.
```

**File**: `src/dashboard/dock/window/VesselPark.mjs` (modified, +4/-2)
```diff
@@ -197,8 +197,10 @@ class VesselPark extends Base {
      * re-fire: ignored.
      * @param {Object} data
      * @param {String} data.itemId
-     * @param {Object} [data.sourceRect] The vessel's live rect at the conversion moment —
-     *     recorded as the restore/origin anchor
+     * @param {Object} [data.sourceRect] The vessel's live CONTENT rect at the conversion moment —
+     *     recorded as the restore/origin anchor. The re-show converts it into the frame origin it
+     *     moves, taking the window's own chrome off it; a frame rect handed in here re-shows the
+     *     window one chrome too high.
      * @param {String} data.windowName
      * @returns {Boolean|Promise<Boolean>}
      */
```

**File**: `test/playwright/unit/apps/workstation/Workspace.spec.mjs` (modified, +113/-0)
```diff
@@ -911,6 +911,119 @@ test.describe('Workstation.view.Workspace', () => {
         }
     });
 
+    test('the park records the content rect, so a terminal restore re-shows the frame it was parked from', async () => {
+        const
+            workspace             = Neo.create(Workspace, {windowId: Neo.config.windowId}),
+            originalDragDrop      = Neo.main.addon.DragDrop,
+            originalFocus         = Neo.Main.windowNativeFocus,
+            originalGetWindowData = Neo.Main.getWindowData,
+            originalManagerGet    = Neo.manager.Window.get,
+            originalMove          = Neo.Main.windowNativeMoveTo,
+            moveCalls             = [];
+
+        const
+            sourceRoute = {
+                capabilities   : {close: true, focus: true, position: true, resize: true},
+                nativeHandleKey: 'handle-source',
+                ownerWindowId  : workspace.windowId,
+                targetWindowId : 'source-window'
+            },
+            targetRoute = {
+                capabilities   : {close: true, focus: true, position: true, resize: true},
+                nativeHandleKey: 'handle-target',
+                ownerWindowId  : workspace.windowId,
+                targetWindowId : 'target-window'
+            },
+            // Real chrome: each window's content sits 67 px below its frame. The conversion samples the
+            // source's FRAME (the plane the pointer rides), but the park must record the CONTENT rect,
+            // because the re-show takes the window's own chrome off whatever rect it is handed.
+            sourceInner = {height: 240, width: 320, x: 796, y: 190},
+            sourceOuter = {height: 307, width: 320, x: 796, y: 123},
+            records     = new Map([
+                [workspace.windowId, {
+                    chrome   : {bottom: 0, left: 0, right: 0, top: 67},
+                    innerRect: {height: 933, width: 1600, x: 0, y: 67},
+                    outerRect: {height: 1000, width: 1600, x: 0, y: 0}
+                }],
+                ['source-window', {
+                    chrome     : {bottom: 0, left: 0, right: 0, top: 67},
+                    innerRect  : {...sourceInner},
+                    nativeRoute: sourceRoute,
+                    outerRect  : {...sourceOuter}
+                }],
+                ['target-window', {
+                    chrome     : {bottom: 0, left: 0, right: 0, top: 67},
+                    innerRect  : {height: 480, width: 640, x: 780, y: 107},
+                    nativeRoute: targetRoute,
+                    outerRect  : {height: 547, width: 640, x: 780, y: 40}
+                }]
+            ]);
+
+        workspace.nativeWindows.sources.get(workspace.id).connections.set('audit', {
+            nativeRoute: sourceRoute,
+            windowId   : 'source-window',
+            windowName : 'tearout-audit'
+        });
+        Neo.manager.Window.get      = id => records.get(id) ?? null;
+        Neo.Main.getWindowData      = async () => ({screen: {availHeight: 1000, availLeft: 0, availTop: 0, availWidth: 1600}});
+        Neo.Main.windowNativeFocus  = async () => true;
+        Neo.Main.windowNativeMoveTo = async data => {
+            moveCalls.push(data);
+            return true
+        };
+        Neo.main.addon.DragDrop = {
+            acknowledgeWindowDragOrphanRecovery: async () => true,
+            hasWindowDragOrphanRecovery        : async () => false,
+            parkWindowDrag                     : async () => true,
+            resumeWindowDrag                   : async () => false
+        };
+
+        try {
+            const seams = workspace.getDockParticipationConfig();
+
+            // The native-titlebar path: the coordinator suspends the source over a popup target.
+            await expect(seams.suspendNativeWindowDrag('audit', {targetWindowId: 'target-window'})).resolves.toBe(true);
+            expect(workspace.lastVesselParkReceipt).toMatchObject({parked: true});
+            expect(workspace.nativeVesselParkHandlers.parkedVessel.preConversionRect, 'the native park records the content rect')
+                .toEqual(sourceInner);
+
+            // The refused handoff: the terminal restore hands moveTo the frame the park took the window from.
+            await expect(seams.resumeNativeWindowDrag('audit')).resolves.toBe(true);
+            expect(workspace.lastVesselRestoreReceipt).toMatchObject({
+                frame   : {x: sourceOuter.x, y: sourceOuter.y},
+                rect    : sourceInner,
+                terminal: true
+            });
+            // Two platform moves: the park put the source frame on the target's frame origin, the
+            // restore put it back on its own.
+            expect(moveCalls).toHaveLength(2);
+            expect(moveCalls[0]).toMatchObject({x: 780, y: 40});
+            expect(moveCalls[1]).toEqual({
+                nativeHandleKey: 'handle-source',
+                targetWindowId : 'source-wind
```

---

### Incident Patch 8: `d59b9ebc` (2026-10-02)
**Commit Message**: fix(data): preserve Store append results and scroll position (#19368) (#19369)

**File**: `src/data/Store.mjs` (modified, +53/-9)
```diff
@@ -72,6 +72,12 @@ const
  * - **UI Integration:** Components like `Neo.grid.Container` listen to these events to update their scrollbars and render rows immediately.
  */
 class Store extends Collection {
+    /**
+     * @member {Boolean} #appendNotification=false Synchronous load-commit continuation context.
+     * @private
+     */
+    #appendNotification = false;
+
     /**
      * True automatically applies the core.Observable mixin
      * @member {Boolean} observable=true
@@ -320,6 +326,26 @@ class Store extends Collection {
         return returnValue // Pass raw item directly
     }
 
+    /**
+     * @summary Adds loaded items while marking their synchronous collection notification as a continuation.
+     * @param {Array|Object} items
+     * @param {Boolean} [append=false]
+     * @returns {Number|Object[]|Neo.data.Model[]}
+     * @private
+     */
+    addLoadedItems(items, append=false) {
+        let me                         = this,
+            previousAppendNotification = me.#appendNotification;
+
+        me.#appendNotification = append;
+
+        try {
+            return me.add(items)
+        } finally {
+            me.#appendNotification = previousAppendNotification
+        }
+    }
+
     /**
      * Triggered after the currentPage config got changed
      * @param {Number} value
@@ -940,11 +966,14 @@ class Store extends Collection {
     }
 
     /**
+     * @summary Loads records through the configured Pipeline, API, or URL and optionally appends the result.
      * @param {Object} opts={}
+     * @param {Boolean} [opts.append=false] Append loaded items and preserve continuation position.
      * @param {Object} opts.data
      * @param {Object} opts.headers
      * @param {String} opts.method DELETE, GET, POST, PUT
      * @param {Object} opts.params
+     * @param {Number} [opts.params.page] Page to request; the caller owns page selection and Store does not advance it.
      * @param {String} opts.responseType
      * @param {Object} opts.scope
      * @param {String} opts.url
@@ -953,6 +982,7 @@ class Store extends Collection {
      */
     async load(opts={}) {
         let me     = this,
+            append = !!opts.append,
             params = {page: me.currentPage, pageSize: me.pageSize, ...opts.params};
 
         // Ensure the dummy pipeline is fully constructed before proceeding
@@ -969,14 +999,20 @@ class Store extends Collection {
         }
 
         if (me.pipeline) {
-            if (me.items.length > 0 && !opts.append) {
+            if (me.items.length > 0 && !append) {
                 me.clear();
             }
 
             me.isLoading = true;
 
+            let receivedData = false;
+
             const onData = (data) => {
-                me.add(data);
+                if (data != null && (!Array.isArray(data) || data.length > 0)) {
+                    receivedData = true
+                }
+
+                me.addLoadedItems(data, append);
 
                 // Progressive Rendering:
                 // As soon as we have data, we want the grid to render.
@@ -1023,9 +1059,10 @@ class Store extends Collection {
                         items = Neo.ns(me.responseRoot, false, items) || items;
                     }
 
-                    // If it was a bulk load and not progressive (where onData added them), add them now
-                    if (Array.isArray(items) && items.length > 0 && me.count === 0) {
-                         me.add(items);
+                    // Parser data events have already committed progressive rows. Empty data events do not
+                    // suppress the final bulk response, which can still carry the fetched rows.
+                    if (Array.isArray(items) && items.length > 0 && !receivedData) {
+                        me.addLoadedItems(items, append);
                     }
 
                     me.totalCount = response.totalCount || (response.json && !Array.isArray(response.json) ? response.json.totalCount : null) || me.count;
@@ -1034,7 +1071,7 @@ class Store extends Collection {
                     me.fire('load', {
                         isLoading    : false,
                         items        : me.items,
-                        postChunkLoad: me.pipeline.parser?.ntype === 'parser-stream',
+                        postChunkLoad: append || me.pipeline.parser?.ntype === 'parser-stream',
                         total        : me.totalCount
                     });
                     return me.items;
@@ -1069,10 +1106,17 @@ class Store extends Collection {
 
                 if (response.success) {
                     me.totalCount = response.totalCount;
-                    me.data       = Neo.ns(me.responseRoot, false, response); // fires the load event
+                    const items = Neo.ns(me.responseRoot, false, response);
+
+                    if (append) {
+                        items && me.addLoadedItems(items, true);
+                    } else {
+                        me.data 
```

**File**: `test/playwright/unit/data/StoreApiPipeline.spec.mjs` (modified, +152/-0)
```diff
@@ -14,6 +14,7 @@ import * as core      from '../../../../src/core/_export.mjs';
 import Model          from '../../../../src/data/Model.mjs';
 import Pipeline       from '../../../../src/data/Pipeline.mjs';
 import Store          from '../../../../src/data/Store.mjs';
+import StreamParser   from '../../../../src/data/parser/Stream.mjs';
 
 const model = {
     module: Model,
@@ -67,3 +68,154 @@ test.describe('Neo.data.Store api vs pipeline', () => {
         store.destroy()
     });
 });
+
+test.describe('Neo.data.Store append loading', () => {
+    let store;
+
+    test.afterEach(() => {
+        store?.destroy();
+        delete Neo.StoreAppendTestApi
+    });
+
+    for (const transport of ['pipeline', 'api']) {
+        for (const autoInitRecords of [false, true]) {
+            test(`${transport} append retains records and continuation semantics (eager=${autoInitRecords})`, async () => {
+                const page   = [{id: '2', name: 'Second'}, {id: '3', name: 'Third'}],
+                    loads    = [],
+                    requests = [],
+                    read     = async params => {
+                        requests.push(params);
+                        return {success: true, data: page.map(item => ({...item})), totalCount: 3}
+                    };
+
+                Neo.StoreAppendTestApi = {read};
+                store = Neo.create(Store, {
+                    api             : transport === 'api' ? {read: 'Neo.StoreAppendTestApi.read'} : null,
+                    autoInitRecords,
+                    initialChunkSize: 1,
+                    model,
+                    data            : [{id: '1', name: 'First'}]
+                });
+                await store.ready();
+                if (store.pipeline) store.pipeline.read = read;
+                store.on('load', event => loads.push(event.postChunkLoad));
+
+                const result = await store.load({append: true, params: {page: 2}});
+
+                expect(result).toEqual(store.items);
+                expect(store.items.map(item => item.id)).toEqual(['1', '2', '3']);
+                expect(store.get('2').name).toBe('Second');
+                expect(store.totalCount).toBe(3);
+                expect(store.currentPage).toBe(1);
+                expect(requests[0].page).toBe(2);
+                expect(loads.length).toBeGreaterThan(0);
+                expect(loads.every(Boolean)).toBe(true);
+
+                loads.length = 0;
+                store.add({id: '4', name: 'Fourth'});
+                expect(loads).toEqual([false]);
+                loads.length = 0;
+                store.sort('name');
+                expect(loads.length).toBeGreaterThan(0);
+                expect(loads.some(Boolean)).toBe(false);
+
+                loads.length = 0;
+                await store.load();
+                expect(store.items.map(item => item.id).sort()).toEqual(['2', '3']);
+                expect(loads.some(value => !value)).toBe(true)
+            });
+        }
+
+        test(`${transport} empty and refused append retain rows and caller-owned page`, async () => {
+            let   response = {success: true, data: [], totalCount: 1};
+            const read     = async () => response;
+
+            Neo.StoreAppendTestApi = {read};
+            store = Neo.create(Store, {
+                api  : transport === 'api' ? {read: 'Neo.StoreAppendTestApi.read'} : null,
+                model,
+                items: [{id: '1', name: 'First'}]
+            });
+            await store.ready();
+            if (store.pipeline) store.pipeline.read = read;
+
+            expect(await store.load({append: true})).toEqual(store.items);
+            expect(store.items.map(item => item.id)).toEqual(['1']);
+            response = transport === 'api' ? {success: false} : null;
+            expect(await store.load({append: true, params: {page: 9}})).toBe(null);
+            expect(store.items.map(item => item.id)).toEqual(['1']);
+            expect(store.currentPage).toBe(1)
+        });
+
+        test(`${transport} rejected append does not advance page or leak continuation`, async () => {
+            const read = async () => { throw new Error('read failed') };
+            Neo.StoreAppendTestApi = {read};
+            store = Neo.create(Store, {
+                api  : transport === 'api' ? {read: 'Neo.StoreAppendTestApi.read'} : null,
+                model,
+                items: [{id: '1', name: 'First'}]
+            });
+            await store.ready();
+            if (store.pipeline) store.pipeline.read = read;
+
+            await expect(store.load({append: true, params: {page: 9}})).rejects.toThrow('read failed');
+            expect(store.items.map(item => item.id)).toEqual(['1']);
+            expect(store.currentPage).toBe(1);
+            expect(store.isLoading).toBe(false);
+            const loads = [];
+            store.on('load', event => loads.push(event.postChunkLoad));
+            store.add({id: '2', name:
```

**File**: `test/playwright/unit/grid/StoreInteractions.spec.mjs` (modified, +40/-0)
```diff
@@ -309,6 +309,46 @@ test.describe('Grid & Store Interactions', () => {
         // Total deltas roughly 18-20.
         expect(deltas.length).toBeLessThanOrEqual(30);
     });
+
+    test('Store append preserves grid scroll while replacement still requests a reset', async () => {
+        const
+            originalScrollTo = Neo.main.DomAccess.scrollTo,
+            originalRead     = store.pipeline.read,
+            scrollCalls      = [];
+
+        Neo.main.DomAccess.scrollTo = data => scrollCalls.push(data);
+
+        try {
+            // Let any mount-time work settle before observing load-driven scroll requests.
+            await grid.timeout(70);
+
+            store.pipeline.read = async () => ({
+                data      : [{id: 20, name: 'Row 20', score: 200}],
+                totalCount: 21
+            });
+
+            await store.load({append: true, params: {page: 2}});
+            await grid.timeout(70);
+
+            expect(store.items.map(item => item.id)).toEqual(Array.from({length: 21}, (_, index) => index));
+            expect(scrollCalls, 'append is a continuation and must not request a top reset').toEqual([]);
+
+            store.pipeline.read = async () => ({
+                data      : [{id: 100, name: 'Replacement row', score: 1000}],
+                totalCount: 1
+            });
+
+            await store.load({params: {page: 1}});
+            await grid.timeout(70);
+
+            expect(store.items.map(item => item.id)).toEqual([100]);
+            expect(scrollCalls.length, 'ordinary replacement keeps its top-reset behavior').toBeGreaterThan(0);
+            expect(scrollCalls.every(({direction, value}) => direction === 'top' && value === 0)).toBe(true)
+        } finally {
+            store.pipeline.read          = originalRead;
+            Neo.main.DomAccess.scrollTo = originalScrollTo
+        }
+    });
 });
 
 test.describe('Grid & TreeStore Bulk Projection Interactions', () => {
```

---

### Incident Patch 9: `e35f4bdd` (2026-10-02)
**Commit Message**: fix(grid): a grid body re-arms its scroll edge when it mounts, so a window landing behind a hidden grid cannot consume it (#19361) (#19364)

A store load reaching an unmounted body runs the window calculator with its last measured geometry, announces the new count into a hidden grid and latches it; shown again at that count, the body announced nothing. afterSetMounted(true) clears the latch, so the next layout at the edge announces again. The announcement stays ungated: the spec's bodies are never mounted. One arm, red against dev.

**File**: `src/grid/Body.mjs` (modified, +13/-4)
```diff
@@ -301,8 +301,10 @@ class GridBody extends Component {
      * The visible count the `scrollEdge` event was last fired for; `null` while the visible window is
      * away from the edge. The key is the visible count alone, never the total behind a filter: an
      * append a filter hides entirely moved nothing the viewport can reach, and re-arming on it would
-     * let a consumer walk hidden data window by window with no gesture. See
-     * {@link #updateMountedAndVisibleRows}.
+     * let a consumer walk hidden data window by window with no gesture. Cleared again when the body
+     * mounts: a store load reaching an unmounted body still runs the window calculator with the
+     * geometry it last measured, so an edge announced there was announced to no viewport. See
+     * {@link #updateMountedAndVisibleRows} and {@link #afterSetMounted}.
      * @member {Number|null} #scrollEdgeAnnouncedFor=null
      */
     #scrollEdgeAnnouncedFor = null
@@ -509,14 +511,19 @@ class GridBody extends Component {
     }
 
     /**
-     * Triggered after the mounted config got changed
+     * Triggered after the mounted config got changed. A body that mounts re-arms its scroll edge:
+     * whatever was announced while it was unmounted, its next layout at the edge announces again.
      * @param {Boolean} value
      * @param {Boolean} oldValue
      * @protected
      */
     afterSetMounted(value, oldValue) {
         super.afterSetMounted(value, oldValue);
 
+        if (value) {
+            this.#scrollEdgeAnnouncedFor = null
+        }
+
         if (oldValue !== undefined) {
             let i = 0, len = this.items.length, item;
             for (; i < len; i++) {
@@ -1653,7 +1660,9 @@ class GridBody extends Component {
  * A consumer that loads a remote corpus window by window requests the next window here; a store
  * shorter than one window announces on its first layout, an empty store never does, and an appended
  * window a filter hides entirely does not announce again: nothing the viewport can reach moved, and
- * a consumer that wants hidden data to count must look at `total` itself.
+ * a consumer that wants hidden data to count must look at `total` itself. A body that mounts re-arms:
+ * if it is at its edge on its next layout, it announces again, whatever was announced while it was
+ * unmounted (a store load reaching a hidden body runs the calculator with its last geometry).
  * @event scrollEdge
  * @param {Object} data
  * @param {Number} data.count      The store's visible count the edge was announced for.
```

**File**: `test/playwright/unit/grid/BodyScrollEdge.spec.mjs` (modified, +21/-0)
```diff
@@ -191,4 +191,25 @@ test.describe('Neo.grid.Body — scrollEdge fires once per entry into the store\
 
         body.destroy()
     });
+
+    test('a body that mounts re-arms the edge: a count announced while it was unmounted announces again on the next layout (#19361)', () => {
+        const {body, edges} = createBody(5);
+
+        // a store load reaching an unmounted body runs the calculator with its last geometry: in the
+        // browser this is a window landing behind a hidden grid; here it is the first layout itself
+        scrollTo(body, 0);
+        expect(edges, 'announced into the unmounted body').toEqual([{count: 5, endIndex: 5, startIndex: 0, total: 5}]);
+        body.updateMountedAndVisibleRows();
+        expect(edges, 'control: while nothing mounts, the count stays latched').toHaveLength(1);
+
+        body.mounted = true;
+        body.updateMountedAndVisibleRows();
+        expect(edges, 'mounted: the edge is announced again to the viewport that can act on it').toHaveLength(2);
+        expect(edges[1]).toEqual({count: 5, endIndex: 5, startIndex: 0, total: 5});
+
+        body.updateMountedAndVisibleRows();
+        expect(edges, 'and latched again').toHaveLength(2);
+
+        body.destroy()
+    });
 });
```

---

### Incident Patch 10: `f9338772` (2026-10-02)
**Commit Message**: fix(grid): scrollEdge carries the store's total and stays quiet on an append a filter hides entirely (#19359) (#19360)

* fix(grid): scrollEdge re-arms on the store's total, so an append a filter hides entirely still announces (#19359)

* test(grid): the scroll-edge spec's store carries a model, so its filtered-append arm filters real fields (#19359)

* fix(grid): scrollEdge carries the store's total and stays quiet on an append a filter hides entirely (#19359)

* docs(grid): the paging example offsets by the store's total, the rows it holds behind any filter (#19359)

**File**: `learn/guides/datahandling/Grids.md` (modified, +9/-4)
```diff
@@ -754,12 +754,17 @@ const myGrid = Neo.create(GridContainer, {
 
 A grid over a corpus too large to load at once appends windows as the reader scrolls. The body announces the moment
 for that: `scrollEdge` fires once each time the visible window reaches the store's last `bufferRowRange` rows, and
-again only after the store's count changes, so a viewport parked at the end stays quiet and an appended window that
-still touches the end announces once more. Listen on the body, request the next window, and append it to the store:
+again only after the store's visible count changes, so a viewport parked at the end stays quiet, an appended window
+that still touches the end announces once more, and a window a filter hides entirely does not: the viewport saw nothing
+move, and a grid that re-requested on hidden data would walk a filtered corpus with no gesture. The event carries the
+store's `total` behind its filters for consumers that want to show it. Listen on the body, request the next window, and
+append it to the store:
 
 ```javascript readonly
-myGrid.body.on('scrollEdge', async ({count}) => {
-    const next = await loadWindow({offset: count}); // your own source; it says when nothing follows
+myGrid.body.on('scrollEdge', async ({total}) => {
+    // the next window starts after every row the store HOLDS, filtered ones included — `total`,
+    // never the visible `count` (with 11 held and 1 visible, `count` would re-request from 1)
+    const next = await loadWindow({offset: total}); // your own source; it says when nothing follows
 
     next.rows.length > 0 && myGrid.store.add(next.rows)
 });
```

**File**: `src/grid/Body.mjs` (modified, +19/-10)
```diff
@@ -298,8 +298,11 @@ class GridBody extends Component {
      */
     #lastMountedColumns = null
     /**
-     * The store count the `scrollEdge` event was last fired for; `null` while the visible window is
-     * away from the edge. See {@link #updateMountedAndVisibleRows}.
+     * The visible count the `scrollEdge` event was last fired for; `null` while the visible window is
+     * away from the edge. The key is the visible count alone, never the total behind a filter: an
+     * append a filter hides entirely moved nothing the viewport can reach, and re-arming on it would
+     * let a consumer walk hidden data window by window with no gesture. See
+     * {@link #updateMountedAndVisibleRows}.
      * @member {Number|null} #scrollEdgeAnnouncedFor=null
      */
     #scrollEdgeAnnouncedFor = null
@@ -1595,14 +1598,17 @@ class GridBody extends Component {
         me.mountedRows[1] = mountedEnd;
 
         // The scroll edge: the visible window reached the store's last `bufferRowRange` rows.
-        // Announced once per entry and re-armed only by a count change, so a viewport parked at
-        // the edge stays quiet on every further tick, an append that leaves it at the new edge
-        // announces again, and a store shorter than one window announces on its first layout.
-        // A consumer loading a remote corpus window by window requests the next one here.
+        // Announced once per entry and re-armed only by a change of the VISIBLE count, so a viewport
+        // parked at the edge stays quiet on every further tick, an append that leaves it at the new
+        // edge announces again, and a store shorter than one window announces on its first layout.
+        // An append a filter hides entirely does NOT re-arm it: nothing the viewport can reach
+        // moved, and announcing on the hidden total would let a consumer walk hidden data window by
+        // window with no gesture. The total travels on the event as information. A consumer loading
+        // a remote corpus window by window requests the next one here.
         if (countRecords > 0 && endIndex + bufferRowRange >= countRecords) {
             if (me.#scrollEdgeAnnouncedFor !== countRecords) {
                 me.#scrollEdgeAnnouncedFor = countRecords;
-                me.fire('scrollEdge', {count: countRecords, endIndex, startIndex})
+                me.fire('scrollEdge', {count: countRecords, endIndex, startIndex, total: store.allItems?.getCount?.() ?? countRecords})
             }
         } else {
             me.#scrollEdgeAnnouncedFor = null
@@ -1643,14 +1649,17 @@ class GridBody extends Component {
 
 /**
  * Fires when the visible window reaches the store's last `bufferRowRange` rows — once per entry,
- * re-armed only by a change of the store's count (see {@link Neo.grid.Body#updateMountedAndVisibleRows}).
+ * re-armed only by a change of the visible count (see {@link Neo.grid.Body#updateMountedAndVisibleRows}).
  * A consumer that loads a remote corpus window by window requests the next window here; a store
- * shorter than one window announces on its first layout, an empty store never does.
+ * shorter than one window announces on its first layout, an empty store never does, and an appended
+ * window a filter hides entirely does not announce again: nothing the viewport can reach moved, and
+ * a consumer that wants hidden data to count must look at `total` itself.
  * @event scrollEdge
  * @param {Object} data
- * @param {Number} data.count      The store's count the edge was announced for.
+ * @param {Number} data.count      The store's visible count the edge was announced for.
  * @param {Number} data.endIndex   The visible window's end (exclusive).
  * @param {Number} data.startIndex The visible window's start.
+ * @param {Number} data.total      The store's total behind its filters.
  * @returns {Object}
  */
 
```

**File**: `test/playwright/unit/grid/BodyScrollEdge.spec.mjs` (modified, +43/-6)
```diff
@@ -47,13 +47,16 @@ function createBody(count, config = {}) {
             availableRows : 10,
             bufferRowRange: 3,
             startIndex    : 0,
+            // a model, so the data's own ids and names are record fields a filter can read (a
+            // model-less store keys its records -1, -2, … and drops the rest)
             store         : Neo.create(Store, {
-                data: Array.from({length: count}, (_, i) => ({id: i + 1, name: 'row ' + (i + 1)}))
+                data : Array.from({length: count}, (_, i) => ({id: i + 1, name: 'row ' + (i + 1)})),
+                model: {fields: [{name: 'id', type: 'Int'}, {name: 'name', type: 'String'}]}
             }),
             ...config
         });
 
-    body.on('scrollEdge', ({count, endIndex, startIndex}) => edges.push({count, endIndex, startIndex}));
+    body.on('scrollEdge', ({count, endIndex, startIndex, total}) => edges.push({count, endIndex, startIndex, total}));
 
     return {body, edges}
 }
@@ -83,7 +86,7 @@ test.describe('Neo.grid.Body — scrollEdge fires once per entry into the store\
         expect(edges, 'visible end 46, buffer 3: not yet').toEqual([]);
 
         scrollTo(body, 37);
-        expect(edges, 'visible end 47 + buffer 3 reaches 50').toEqual([{count: 50, endIndex: 47, startIndex: 37}]);
+        expect(edges, 'visible end 47 + buffer 3 reaches 50').toEqual([{count: 50, endIndex: 47, startIndex: 37, total: 50}]);
 
         scrollTo(body, 38);
         scrollTo(body, 40);
@@ -114,15 +117,15 @@ test.describe('Neo.grid.Body — scrollEdge fires once per entry into the store\
         // the consumer appended a short window; the viewport (40..50) still touches the new end
         body.store.add(Array.from({length: 2}, (_, i) => ({id: 51 + i, name: 'row ' + (51 + i)})));
         body.updateMountedAndVisibleRows();
-        expect(edges.at(-1), 're-armed by the count change').toEqual({count: 52, endIndex: 50, startIndex: 40});
+        expect(edges.at(-1), 're-armed by the count change').toEqual({count: 52, endIndex: 50, startIndex: 40, total: 52});
         expect(edges).toHaveLength(2);
 
         // a long window moves the end away; reaching it announces for that count
         body.store.add(Array.from({length: 48}, (_, i) => ({id: 53 + i, name: 'row ' + (53 + i)})));
         body.updateMountedAndVisibleRows();
         expect(edges, '50 + 3 < 100: away from the edge').toHaveLength(2);
         scrollTo(body, 90);
-        expect(edges.at(-1)).toEqual({count: 100, endIndex: 100, startIndex: 90});
+        expect(edges.at(-1)).toEqual({count: 100, endIndex: 100, startIndex: 90, total: 100});
 
         body.destroy()
     });
@@ -132,7 +135,7 @@ test.describe('Neo.grid.Body — scrollEdge fires once per entry into the store\
 
         short.body.updateMountedAndVisibleRows();
         short.body.updateMountedAndVisibleRows();
-        expect(short.edges, 'five rows under a ten-row window').toEqual([{count: 5, endIndex: 5, startIndex: 0}]);
+        expect(short.edges, 'five rows under a ten-row window').toEqual([{count: 5, endIndex: 5, startIndex: 0, total: 5}]);
         short.body.destroy();
 
         const empty = createBody(0);
@@ -142,6 +145,40 @@ test.describe('Neo.grid.Body — scrollEdge fires once per entry into the store\
         empty.body.destroy()
     });
 
+    test('an append a filter hides entirely does not re-arm the edge: the viewport saw nothing move, and the total travels as information (#19359)', () => {
+        // The first consumer's two findings: a count-keyed latch leaves a one-row collapsed thread
+        // at the same edge after a hidden append (older rows wait for the operator to expand the
+        // thread), and a total-keyed latch walks the whole filtered corpus with no gesture. The
+        // engine keeps the viewport's truth and reports the total beside it.
+        const {body, edges} = createBody(1);
+
+        // the same filter shape the pooling specs use: only id 1 passes
+        body.store.filters = [{property: 'id', operator: '<', value: 2}];
+        expect(body.store.count, 'one visible row').toBe(1);
+
+        scrollTo(body, 0);
+        expect(edges, 'a one-row store is at its edge from the first layout').toEqual([{count: 1, endIndex: 1, startIndex: 0, total: 1}]);
+
+        // an append lands in the filtered view until the filter runs again; the consumer's
+        // projection re-filters on every landed window, so the arm does the same here
+        body.store.add(Array.from({length: 10}, (_, i) => ({id: 100 + i, name: 'hidden ' + i})));
+        body.store.filter();
+        expect(body.store.count, 'still one visible row').toBe(1);
+        expect(body.store.allItems.getCount()).toBe(11);
+
+        body.updateMountedAndVisibleRows();
+        body.updateMountedAndVisibleRows();
+        expect(edges, 'nothing the viewport can reach moved: quiet').toHaveLength(1);
+
+        // the rows become visible (the consumer's thread expands): a visible change 
```

---

### Incident Patch 11: `d0057ee0` (2026-10-02)
**Commit Message**: build(deps-dev): bump cssnano from 9.1.0 to 9.1.1 in the all-deps group (#19355)

Bumps the all-deps group with 1 update: [cssnano](https://github.com/cssnano/cssnano).


Updates `cssnano` from 9.1.0 to 9.1.1
- [Release notes](https://github.com/cssnano/cssnano/releases)
- [Commits](https://github.com/cssnano/cssnano/compare/[REDACTED_EMAIL]@9.1.1)

---
updated-dependencies:
- dependency-name: cssnano
  dependency-version: 9.1.1
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: all-deps
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +17/-17)
```diff
@@ -19,7 +19,7 @@
                 "autoprefixer": "^10.6.1",
                 "chalk": "^6.0.1",
                 "commander": "^15.0.0",
-                "cssnano": "^9.1.0",
+                "cssnano": "^9.1.1",
                 "envinfo": "^7.21.0",
                 "esbuild": "^0.28.2",
                 "fast-glob": "^3.3.3",
@@ -3497,13 +3497,13 @@
             }
         },
         "node_modules/cssnano": {
-            "version": "9.1.0",
-            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.1.0.tgz",
-            "integrity": "sha512-ae04R4AveAXRs1M29hDNrKcfsLv/Ef2nA21wnCaWKqcMcCEUGBx8uRz4JYvYkArF5agDW1hhv1c9sr1d+6dT8w==",
+            "version": "9.1.1",
+            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.1.1.tgz",
+            "integrity": "sha512-Jm3JBThKaUOo6Q9Buyjez+ww/SsgbwmLgg8H5fIf+wAAv5clG2x1KupoQR2PejzEbRyTVqVu93nORWT/320J/g==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
-                "cssnano-preset-default": "^9.1.0"
+                "cssnano-preset-default": "^9.1.1"
             },
             "engines": {
                 "node": "^22.22.3 || ^24.15.0 || >=26.0"
@@ -3517,17 +3517,17 @@
             }
         },
         "node_modules/cssnano-preset-default": {
-            "version": "9.1.0",
-            "resolved": "https://registry.npmjs.org/cssnano-preset-default/-/cssnano-preset-default-9.1.0.tgz",
-            "integrity": "sha512-C7VBAFjYgJhIc2pt7ggIkoaEKsjao0nwMun5c7rcj9ZtVQEAFpkBz8zxAWejYdZRWQbVuDFgdc3YstT0I9LVug==",
+            "version": "9.1.1",
+            "resolved": "https://registry.npmjs.org/cssnano-preset-default/-/cssnano-preset-default-9.1.1.tgz",
+            "integrity": "sha512-c+9shS5wCw+hpS2TzZ4ndZQzM4ffMjzKqfPc/xxzUJ98J7iNJVfuYuFEFuLHaaCW7oIZAEnc0GLe6Lo46Rcikg==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
                 "browserslist": "^4.29.1",
-                "cssnano-utils": "^8.0.0",
+                "cssnano-utils": "^8.0.1",
                 "postcss-calc": "^11.2.1",
                 "postcss-colormin": "^9.0.4",
-                "postcss-convert-values": "^9.0.4",
+                "postcss-convert-values": "^9.0.5",
                 "postcss-discard-comments": "^9.0.4",
                 "postcss-discard-duplicates": "^9.0.4",
                 "postcss-discard-empty": "^9.0.4",
@@ -3561,9 +3561,9 @@
             }
         },
         "node_modules/cssnano-utils": {
-            "version": "8.0.0",
-            "resolved": "https://registry.npmjs.org/cssnano-utils/-/cssnano-utils-8.0.0.tgz",
-            "integrity": "sha512-JwpMFH6r1qoouHQZ97MtvHvUTjD+YV4yKGKWKs+Z+IEPqQoJL1sqwPtiJGYbPo3aW2NhQfETVXvPMhEnhxlQzw==",
+            "version": "8.0.1",
+            "resolved": "https://registry.npmjs.org/cssnano-utils/-/cssnano-utils-8.0.1.tgz",
+            "integrity": "sha512-KF2NfGI/na0wEemV8X7KQbisJS0QY77vaGCJ/3RuXfWrgg/qlq8vHcfSAtzrCrOHwaGHW02Ra1anDyuQ7M520A==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
@@ -6702,14 +6702,14 @@
             }
         },
         "node_modules/postcss-convert-values": {
-            "version": "9.0.4",
-            "resolved": "https://registry.npmjs.org/postcss-convert-values/-/postcss-convert-values-9.0.4.tgz",
-            "integrity": "sha512-Z1arFr4Wk+r6f+YEFmO8r+LK7IZub/QluJ6b69hgu5A9TqhfmxHaxPkt+b9gZpsjour7+MlDBFWPgTS1ZjINBQ==",
+            "version": "9.0.5",
+            "resolved": "https://registry.npmjs.org/postcss-convert-values/-/postcss-convert-values-9.0.5.tgz",
+            "integrity": "sha512-grpRo1ESwgz/z8cL4GePFEyozuvo72htqHQdKM63+Uk1b3+UFURRkLwpo37EBm+v7VUOLjXFbvq6vHawOcz7IQ==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
                 "browserslist": "^4.29.1",
-                "cssnano-utils": "^8.0.0"
+                "cssnano-utils": "^8.0.1"
             },
             "engines": {
                 "node": "^22.22.3 || ^24.15.0 || >=26.0"
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@
         "autoprefixer"                 : "^10.6.1",
         "chalk"                        : "^6.0.1",
         "commander"                    : "^15.0.0",
-        "cssnano"                      : "^9.1.0",
+        "cssnano"                      : "^9.1.1",
         "envinfo"                      : "^7.21.0",
         "esbuild"                      : "^0.28.2",
         "fast-glob"                    : "^3.3.3",
```

---

### Incident Patch 12: `ecfd60ce` (2026-10-01)
**Commit Message**: docs(agents): AGENTS_STARTUP.md leaves the engine; outside agents start from the contributor guidance (#19335) (#19337)

* docs(agents): AGENTS_STARTUP.md leaves the engine, and the AI Quick Start stops scripting it (#19335)

The boot workflow was deprecated on 2026-06-04. The quick start's first session loses its initialization step and its troubleshooting line; the blog's reference link pins the last commit that carries the file.

* docs(contributing): an outside agent's first step is the contributor guidance, not the retired boot file (#19335)

* docs(contributing): the outside agent's first step pins its package and promises nothing private (#19335)

`npx -p neo-agent-skills` resolves our package instead of the unclaimed bin name, and "nothing
private" replaces "nothing beyond `npm install`", which invited skipping `bundle-browser-deps`.
Wording agreed on #18985.

**File**: `.github/AI_QUICK_START.md` (modified, +1/-18)
```diff
@@ -331,7 +331,6 @@ node ai/scripts/migrations/bootstrapWorktree.mjs --link-data \
 **What NOT to symlink**: source-code paths (`src/core/Base.mjs`, `ai/mcp/server/*/config.mjs`) or the `.neo-ai-data/` parent. Node's ESM resolver can turn source symlinks into duplicate namespace registrations, while sharing process-control directories can make one clone control another clone's daemons. The bootstrap script copies config files and links only its approved data members and handoff files.
 
 ### Agent Guidelines (Repository root)
-- **`AGENTS_STARTUP.md`**: Step-by-step session initialization instructions
 - **`AGENTS.md`**: Canonical per-turn operational mandates, loaded through each harness's supported instruction mechanism
 
 ### Developer Guide
@@ -345,22 +344,7 @@ node ai/scripts/migrations/bootstrapWorktree.mjs --link-data \
    * **For Antigravity:** Follow the Antigravity launch procedure.
    * **For enterprise/API-key Gemini CLI:** Run the configured CLI profile from the repository root.
 
-2. **Follow the initialization instructions in AGENTS_STARTUP.md**:
-
-   The agent **will not** automatically initialize itself on startup. You must explicitly instruct it to do so:
-
-   > "Read and follow all instructions in @AGENTS_STARTUP.md"
-
-   The agent will then:
-    - Read the AGENTS_STARTUP.md file
-    - Load core Neo.mjs files (Neo.mjs, Base.mjs, CodebaseOverview.md)
-    - Check the Memory Core status
-    - Confirm it's ready for work
-
-   **Important:** This initialization step is required at the start of every new session. Without it, the agent will not
-   have proper context about the codebase structure and operational guidelines.
-
-3. **Give your actual prompt**, for example:
+2. **Give your actual prompt**, for example:
    > "Explain the Neo.mjs two-tier reactivity model with a code example."
 
    The agent will now autonomously:
@@ -383,7 +367,6 @@ and understand your codebase.
 - **"Invalid API key" errors**: Check `.env` file has correct format: `GEMINI_API_KEY="your-key-here"`
 
 ### Agent Behavior Issues
-- **Agent doesn't initialize**: Check that `AGENTS_STARTUP.md` exists
 - **Agent doesn't save memories**: Memory Core may not be running. Ask the agent to perform a healthcheck on the `neo.mjs-memory-core` MCP server. If it's unhealthy, you can ask the agent to start the database or use other memory-core tools.
 - **Agent makes incorrect assumptions**: It may be hallucinating - remind it to query the knowledge base
 
```

**File**: `AGENTS_STARTUP.md` (removed, +0/-188)
```diff
@@ -1,188 +0,0 @@
-# AI Agent Session Initialization Guide
-
-Welcome, AI assistant! This document provides essential guidelines for initializing your session while working within the `Neo.mjs` repository. Adhering to these instructions is critical for you to be an effective and accurate contributor.
-
-**MCP Server Infrastructure:** The Agent OS and its `ai:*` commands live in the sibling [`neomjs/neo-agent-brain`](https://github.com/neomjs/neo-agent-brain) repository. Run every Agent OS command in this guide from that Brain checkout while keeping the Engine checkout as the target repository. Do not treat this boot guide as the MCP server inventory; derive that inventory from the Brain package scripts. Harness configs can expose a subset when the harness already provides native filesystem, browser, or debugging tools.
-
-All server tools have detailed, self-explanatory descriptions with usage examples. Consult the tool documentation to understand their capabilities.
-
-## 1. Your Role and Primary Directive
-
-Your role is that of an **expert Neo.mjs developer and architect**. Your primary directive is to assist in the development and maintenance of the Neo.mjs platform.
-
-**CRITICAL:** Your training data is outdated regarding Neo.mjs. For any questions related to the **Neo.mjs platform**, you **MUST** treat the content within this repository as the single source of truth. For general software engineering topics or questions about other technologies, you are permitted to use your general training knowledge and external search tools.
-
-## 2. Session Initialization Steps
-
-At the beginning of every new session, you **MUST** perform the following steps to ground your understanding of the platform:
-
-### Step 0: Ensure Codebase Freshness
-
-Before reading any documentation, code, or memory, you **MUST** ensure your local checkout is up-to-date with the remote repository.
-- Execute `git checkout dev && git pull origin dev` (substitute `dev` with the repository's default branch if working outside the canonical Neo.mjs repo).
-- **Lifecycle role (boot vs. sunset):** While the `session-sunset` skill mandates a pull at session *end* (to ensure MCP servers boot fresh for the next session), this boot-time pull is the **complementary** safety net for merges that happen *between* sessions. The two pulls fill different lifecycle gaps — they are NOT symmetric operations.
-- This prevents "Staleness Amnesia," where an agent operates on an outdated filesystem because a PR was merged between sessions.
-- **SCSS / theme / rendered-surface lanes only:** built CSS is gitignored and never travels with a branch — run `npm run watch-themes` in its own shell. The visual guard owns the initial-build command and prints it. *(Retire once a watcher starts with the dev server.)*
-
-### Step 1: Read the Neo Identity & Frontend Architecture Boot Pair
-
-Parse `README.md` first. It is the current boot anchor for Neo's organism identity, maintainer model, Four Pillars, Agent OS trajectory, and MX loop. This is the fast framework-bias inoculation layer: Neo is not a conventional web framework, and the agent must not default to React/Angular mental models.
-
-Then parse `learn/guides/fundamentals/WorkerArchitecture.md`. It provides the concise frontend architecture mechanics the old boot mandate relied on `CodebaseOverview.md` for: Off-Main-Thread execution, the Minimal Main Thread, the App Worker, and VDOM deltas. For the hierarchical MVC/MVVM state flow, `learn/guides/datahandling/StateProviders.md` is the canonical read.
-
-`learn/guides/fundamentals/CodebaseOverview.md` remains the long-form reference for code-authoring and deep orientation contexts, but it is no longer the mandatory Step 1 boot read. Prefer querying the Knowledge Base or opening the long-form guide only when the task needs broader namespace inventory or historical scale context.
-
-**Documentation Taxonomy:** Additionally, scan `learn/tree.json` — the canonical hierarchical index of all 130+ learning topics. The Knowledge Base's `LearningSource.mjs` traverses this file to discover and index every guide. Scanning it gives you an instant top-level perspective of the entire documentation landscape, making subsequent knowledge base queries far more targeted.
-
-**Strategic Workflows:** Parse [`learn/agentos/StrategicWorkflows.md`](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/StrategicWorkflows.md) from the Brain repository. This is the canonical playbook for multi-step agent workflows — most importantly the **Regression Bug Analysis Workflow** (three-dimensional git + ticket + memory query pattern). It is the deep reference behind the memory-query triggers enumerated in §knowledge_base_primary_truth (Two-Stage Query Protocol) and is the single most effective antidote to reinventing the wheel across sessions and agents.
-
-### Step 2: Read the Core Concepts
-
-Read `src/Neo.mjs`. Focus on understanding:
-- `Neo.setupClass()`: The final processing step
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ We actively welcome contributions from artificial intelligence, LLMs, and autono
 3. **Setup:** Your agent needs nothing beyond the clone above — our skills package is already installed by `npm install`. To go further, see the <a href=".github/AI_QUICK_START.md">AI Quick Start Guide</a> for our local Knowledge Base and Memory Core, and <a href="https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/StrategicWorkflows.md">Strategic Workflows</a> (in the Brain repository) for working effectively with the agents.
 
 **For Autonomous Agents (If you are reading this):**
-1. **Initialization Handshake:** Always begin your workflow by reading the `AGENTS_STARTUP.md` file in the root directory. This contains your core operational mandates.
+1. **Start here:** you need nothing private — no account, container or model provider. Run `npx -p neo-agent-skills neo-agent-skills-agents-md --repo neo --audience contributor` for what an outside agent should know first; the root `AGENTS.md` is written for this project's own maintainer agents.
 2. **JSON-First UI:** Neo.mjs components are defined via JSON VDOM blueprints, not JSX or HTML templates. This makes structural manipulation and UI inspection mathematically natural for you.
 3. **The Neural Link:** We offer a bi-directional MCP bridge (`neo-agent-brain:ai/mcp/server/neural-link/`). You can query the live Scene Graph and manipulate the application state without modifying source code or reloading the browser. See our <a href=".github/AGENT_ARCHITECTURE.md">Agent Architecture</a> to learn how you can orchestrate our runtime.
 
```

**File**: `learn/blog/context-engineering-done-right.md` (modified, +1/-1)
```diff
@@ -1878,7 +1878,7 @@ Ready to explore the AI-native workflow?
 - [Codebase Overview](https://github.com/neomjs/neo/blob/dev/learn/guides/fundamentals/CodebaseOverview.md) - What agents read at startup
 - [MCP Server Source Code](https://github.com/neomjs/neo/tree/dev/ai/mcp/server) - The full source code for all three MCP servers.
 - [Agent Protocol (AGENTS.md)](https://github.com/neomjs/neo/blob/dev/AGENTS.md) - The behavioral rules (inside the context window of each session)
-- [Agent Startup (AGENTS_STARTUP.md)](https://github.com/neomjs/neo/blob/dev/AGENTS_STARTUP.md) - Session initialization
+- [Agent Startup (AGENTS_STARTUP.md)](https://github.com/neomjs/neo/blob/83e0c2fc78d047510ba0b8fb81fb46347f5c2e81/AGENTS_STARTUP.md) - Session initialization
 
 ---
 
```

---

### Incident Patch 13: `563f480b` (2026-10-01)
**Commit Message**: build(deps-dev): bump cssnano from 9.0.5 to 9.1.0 in the all-deps group (#19343)

Bumps the all-deps group with 1 update: [cssnano](https://github.com/cssnano/cssnano).


Updates `cssnano` from 9.0.5 to 9.1.0
- [Release notes](https://github.com/cssnano/cssnano/releases)
- [Commits](https://github.com/cssnano/cssnano/compare/[REDACTED_EMAIL]@9.1.0)

---
updated-dependencies:
- dependency-name: cssnano
  dependency-version: 9.1.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
  dependency-group: all-deps
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +193/-204)
```diff
@@ -19,7 +19,7 @@
                 "autoprefixer": "^10.6.1",
                 "chalk": "^6.0.1",
                 "commander": "^15.0.0",
-                "cssnano": "^9.0.5",
+                "cssnano": "^9.1.0",
                 "envinfo": "^7.21.0",
                 "esbuild": "^0.28.2",
                 "fast-glob": "^3.3.3",
@@ -172,16 +172,16 @@
             "license": "Apache-2.0"
         },
         "node_modules/@colordx/core": {
-            "version": "6.5.0",
-            "resolved": "https://registry.npmjs.org/@colordx/core/-/core-6.5.0.tgz",
-            "integrity": "sha512-mhkTHXTERodsL6kMw2LRrXVlGaY+osu/YnxkcwO8c/JO+YOb+/f+F+gOxmeBWTP+nzG47Kz6gZCJq8tyESqrWg==",
+            "version": "7.2.0",
+            "resolved": "https://registry.npmjs.org/@colordx/core/-/core-7.2.0.tgz",
+            "integrity": "sha512-Y5PPwWCWVP59qj2EMVSgD9QMXtMSwt9DseqKvRWOXefM7sRu4EjCRuXQXMaanUH32R8c89OCWJJWZe6jA1dvTg==",
             "dev": true,
             "license": "MIT"
         },
         "node_modules/@csstools/css-tokenizer": {
-            "version": "4.0.1",
-            "resolved": "https://registry.npmjs.org/@csstools/css-tokenizer/-/css-tokenizer-4.0.1.tgz",
-            "integrity": "sha512-bPlN9S9O1A0euCpEWE4qnvB5YDuyYVsUTrxSgmAM1Is0j4tICHoVyOVAXfWMP/kS9ZrjvyIXWV2PmomiAXXqOw==",
+            "version": "4.0.2",
+            "resolved": "https://registry.npmjs.org/@csstools/css-tokenizer/-/css-tokenizer-4.0.2.tgz",
+            "integrity": "sha512-OoKoR0f76dCY666JlcbhmVTs2drYj1GUXZTYTcbUgJjh9Nv41aFfZ21bPQTERm5+L5cBDo466NltB2lplS5GBw==",
             "dev": true,
             "funding": [
                 {
@@ -3001,9 +3001,9 @@
             }
         },
         "node_modules/browserslist": {
-            "version": "4.29.0",
-            "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.0.tgz",
-            "integrity": "sha512-3GSvyjvDI4Dur1Meg2BekJquu5uF+9R9a1+5M1Mde192eZoXbeXjzgOsgqPS2V8D5wrrip0gR5Hf/GhWQ9ZzaA==",
+            "version": "4.29.1",
+            "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.1.tgz",
+            "integrity": "sha512-AUdjuRyCNGUYtqpqfTmWyM4fXay8yIQhmLnvYe/THMGfT9B/34X7xQd3ifKxwyNPPpowVBjLb+64BN9Rn1mizw==",
             "dev": true,
             "funding": [
                 {
@@ -3021,10 +3021,10 @@
             ],
             "license": "MIT",
             "dependencies": {
-                "baseline-browser-mapping": "^2.11.23",
+                "baseline-browser-mapping": "^2.11.25",
                 "caniuse-lite": "^1.0.30001810",
-                "electron-to-chromium": "^1.5.427",
-                "node-releases": "^2.0.55",
+                "electron-to-chromium": "^1.5.438",
+                "node-releases": "^2.0.57",
                 "update-browserslist-db": "^1.3.3"
             },
             "bin": {
@@ -3497,13 +3497,13 @@
             }
         },
         "node_modules/cssnano": {
-            "version": "9.0.5",
-            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.0.5.tgz",
-            "integrity": "sha512-D25KanNkgIIcJnFvbm1xinel2YWULKjOao+4pv1m2qCR6KPRxOWh4yRQboxhwVVtifwdVa3cVnSL651sAvHQoA==",
+            "version": "9.1.0",
+            "resolved": "https://registry.npmjs.org/cssnano/-/cssnano-9.1.0.tgz",
+            "integrity": "sha512-ae04R4AveAXRs1M29hDNrKcfsLv/Ef2nA21wnCaWKqcMcCEUGBx8uRz4JYvYkArF5agDW1hhv1c9sr1d+6dT8w==",
             "dev": true,
             "license": "MIT",
             "dependencies": {
-                "cssnano-preset-default": "^9.0.5"
+                "cssnano-preset-default": "^9.1.0"
             },
             "engines": {
                 "node": "^22.22.3 || ^24.15.0 || >=26.0"
@@ -3517,41 +3517,41 @@
             }
         },
         "node_modules/cssnano-preset-default": {
-            "version": "9.0.5",
-            "resolved": "https://registry.npmjs.org/cssnano-preset-default/-/cssnano-preset-default-9.0.5.tgz",
-            "integrity": "sha512-psQHWcVYCig5PlA+Ni+l9EFB6ow7RX2CR1rGM5TBsjfP/pFZEyCUK62zZqYBFeR1s4XEQ19qvxlxYkKDERuAoQ==",
-            "dev": true,
-            "license": "MIT",
-            "dependencies": {
-                "browserslist": "^4.29.0",
-                "cssnano-utils": "^7.0.3",
-                "postcss-calc": "^11.2.0",
-                "postcss-colormin": "^9.0.3",
-                "postcss-convert-values": "^9.0.3",
-                "postcss-discard-comments": "^9.0.3",
-                "postcss-discard-duplicates": "^9.0.3",
-                "postcss-discard-empty": "^9.0.3",
-                "postcss-discard-overridden": "^9.0.3",
-                "postcss-merge-longhand": "^9.0.4",
-                "postcss-merge-rules": "^9.0.4",
-                "postcss-minify-font-values": "^9.0.3",
-                "postcss-minify-gradients": "^9.0.3",
-                "postcss-minify-params": "^9.0.3",
-                "postcss-minify-selectors": "^9.0.4",
-                "postcss-normalize-ch
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@
         "autoprefixer"                 : "^10.6.1",
         "chalk"                        : "^6.0.1",
         "commander"                    : "^15.0.0",
-        "cssnano"                      : "^9.0.5",
+        "cssnano"                      : "^9.1.0",
         "envinfo"                      : "^7.21.0",
         "esbuild"                      : "^0.28.2",
         "fast-glob"                    : "^3.3.3",
```

---

### Incident Patch 14: `e4f66326` (2026-09-30)
**Commit Message**: fix(dock): a reveal overlay's inside mousedown leaves a focusable target's focus alone (#19339) (#19340)

RevealOverlay#onMouseDown refocused the root on every inside mousedown; the programmatic focus landed after the browser's default and took a clicked text field's focus away, so the Fleet Manager's Add agent field lost focus on every click. The root is refocused only when nothing on the event path takes focus itself (input, select, textarea, contenteditable, a non-negative tabindex); prose and buttons keep the focus-hold behavior. Red-first spec arm.

**File**: `src/dashboard/dock/interaction/RevealOverlay.mjs` (modified, +34/-1)
```diff
@@ -520,13 +520,46 @@ class RevealOverlay extends Container {
      * so this programmatic pointer focus creates no sequential tab stop; `preventScroll` preserves
      * the reading position. This handler rides the global mousedown path, which leaves native text
      * selection untouched.
+     *
+     * A target that takes focus on its own — a text field inside the revealed pane — keeps it: the
+     * programmatic root focus would land after the browser's default action and take the field's
+     * focus away on the very click that gave it. Focus stays inside the subtree either way, so the
+     * focus-hold contract holds without the refocus.
      * @param {Object} data
+     * @param {Object} [data.target] The `DomEvents#getTargetData` shape of the event target
+     * @param {Object[]} [data.path] The same shape for every node on the event path
      * @protected
      */
-    onMouseDown(data) {
+    onMouseDown(data = {}) {
+        if ([data.target, ...(data.path || [])].some(RevealOverlay.canTakeFocus)) {
+            return
+        }
+
         this.focus(this.id, false, true, 'pointer')
     }
 
+    /**
+     * Tag names whose elements take focus on their own mousedown default. Buttons are absent on
+     * purpose: not every browser focuses a clicked button, and a button never needs typing focus.
+     * @member {Set<String>} FOCUSABLE_TAGS
+     * @static
+     */
+    static FOCUSABLE_TAGS = new Set(['input', 'select', 'textarea'])
+
+    /**
+     * Whether a serialized DOM node (the `DomEvents#getTargetData` shape) receives focus by itself:
+     * a form control, a contenteditable, or an explicit non-negative `tabindex`.
+     * @param {Object} node
+     * @returns {Boolean}
+     */
+    static canTakeFocus(node) {
+        return !!node && (
+            RevealOverlay.FOCUSABLE_TAGS.has(node.tagName)
+            || node.isContentEditable === true
+            || (typeof node.tabIndex === 'number' && node.tabIndex >= 0)
+        )
+    }
+
     /**
      * `manager.Focus` containment hook: fires only when focus genuinely ENTERS this component's
      * subtree — internal focus movement never re-triggers it, which is exactly the containment
```

**File**: `test/playwright/unit/dashboard/DockRevealOverlay.spec.mjs` (modified, +33/-0)
```diff
@@ -197,6 +197,39 @@ test.describe('Neo.dashboard.dock.interaction.RevealOverlay', () => {
         expect(focused).toEqual([[overlay.id, false, true, 'pointer']])
     });
 
+    test('inside mousedown on a target that takes focus itself leaves that focus alone', () => {
+        const focused = [];
+
+        overlay = Neo.create(DockRevealOverlay, {
+            edge        : 'right',
+            id          : 'dock-reveal-inside-focusable',
+            revealState : 'revealed-focused',
+            revealedItem: createItem()
+        });
+
+        overlay.focus = (...args) => focused.push(args);
+
+        // a text field as the target, a textarea further up the path, a contenteditable, an
+        // explicit tab stop — the browser focuses each on its own mousedown
+        overlay.onMouseDown({target: {tagName: 'input'}});
+        overlay.onMouseDown({target: {tagName: 'span'}, path: [{tagName: 'span'}, {tagName: 'textarea'}]});
+        overlay.onMouseDown({target: {tagName: 'div', isContentEditable: true}});
+        overlay.onMouseDown({target: {tagName: 'li', tabIndex: 0}});
+
+        expect(focused).toEqual([]);
+
+        // prose, a button, and the root's own tabindex -1 still hand focus to the root
+        overlay.onMouseDown({target: {tagName: 'div'}, path: [{tagName: 'div'}, {tagName: 'p'}]});
+        overlay.onMouseDown({target: {tagName: 'button'}});
+        overlay.onMouseDown({target: {tagName: 'div', tabIndex: -1}});
+
+        expect(focused).toEqual([
+            [overlay.id, false, true, 'pointer'],
+            [overlay.id, false, true, 'pointer'],
+            [overlay.id, false, true, 'pointer']
+        ])
+    });
+
     test('the reveal-slide routes the motion signal: enter on hidden→visible, filtered leave on animationend', () => {
         overlay = Neo.create(DockRevealOverlay, {
             edge: 'left',
```

---

### Incident Patch 15: `e7d550e5` (2026-09-30)
**Commit Message**: feat(app): SharedCanvas pauses its renderer while its window is hidden (#19336) (#19338)

* feat(app): SharedCanvas pauses its renderer while its window is hidden (#19336)

Under useSharedWorkers the canvas worker has no requestAnimationFrame, so a
renderer's loop runs on setTimeout and kept drawing while its window was
hidden. SharedCanvas now listens to its app's visibilitychange, follows the
host into another window, and stops listening on destroy. A hidden window and
the host's own pause() are separate reasons, and the loop runs only while
neither holds. The portal hero, paused while its part is out of view, stays
paused when its window comes back, and a pause before the canvas is ready
now holds once it is. The unit setup's app facade gains no-op on/un beside
its fire, since every unit host now subscribes at construction.

* fix(app): a SharedCanvas host reads its window's current visibility when it subscribes (#19336)

A window that is already hidden never reports visibilitychange, so a canvas
created in one, or moved into one, started its loop unpaused. The host now
takes the window's current visibility from the App worker's HiddenTick,
whose state the connect handshake seed

**File**: `src/app/SharedCanvas.mjs` (modified, +112/-10)
```diff
@@ -13,6 +13,8 @@ import Canvas from '../component/Canvas.mjs';
  *     (`wheel: {fn, local: true, passive: false}`), which is how a node outside the main thread's global wheel
  *     target list receives deltas.
  * 4.  **Theming**: Syncing the component's theme to the worker.
+ * 5.  **Visibility**: Pausing the render loop while the host's window is hidden. A hidden window and the host's own
+ *     `pause()` are separate reasons, and the loop runs only while neither holds.
  *
  * Subclasses must define:
  * - `rendererClassName`: String name of the SharedWorker singleton (e.g. 'Neo.canvas.Header')
@@ -57,15 +59,31 @@ class SharedCanvas extends Canvas {
      * @member {Object|null} canvasRect=null
      */
     canvasRect = null
+    /**
+     * Whether the host paused its renderer for its own reason, like a part scrolled out of view. Only the host's
+     * own `resume()` lifts it; the window becoming visible does not.
+     * @member {Boolean} hostPaused=false
+     * @protected
+     */
+    hostPaused = false
+    /**
+     * Whether the window this host lives in is hidden, as its app's `visibilitychange` reports it.
+     * @member {Boolean} windowHidden=false
+     * @protected
+     */
+    windowHidden = false
 
     /**
      * @param {Boolean} value
      * @param {Boolean} oldValue
      */
     afterSetIsCanvasReady(value, oldValue) {
+        let me = this;
+
         if (value) {
-            this.renderer?.setTheme({theme: this.resolveColorScheme(), windowId: this.windowId});
-            this.fire('canvasReady')
+            me.renderer?.setTheme({theme: me.resolveColorScheme(), windowId: me.windowId});
+            (me.hostPaused || me.windowHidden) && me.renderer?.pause({windowId: me.windowId});
+            me.fire('canvasReady')
         }
     }
 
@@ -128,6 +146,35 @@ class SharedCanvas extends Canvas {
         }
     }
 
+    /**
+     * Triggered after the windowId config got changed: a host that moves into another window takes that window's
+     * current visibility and listens to it from then on.
+     * @param {String|null} value
+     * @param {String|null} oldValue
+     * @protected
+     */
+    afterSetWindowId(value, oldValue) {
+        let me = this;
+
+        super.afterSetWindowId(value, oldValue);
+
+        if (oldValue) {
+            Neo.apps[oldValue]?.un('visibilitychange', me.onWindowVisibility, me);
+            me.listenToWindow()
+        }
+    }
+
+    /**
+     * @param {Object} config
+     */
+    construct(config) {
+        let me = this;
+
+        super.construct(config);
+        me.listenToWindow();
+        Neo.currentWorker.on('connect', me.onWindowConnect, me)
+    }
+
     /**
      * @returns {String}
      */
@@ -153,7 +200,11 @@ class SharedCanvas extends Canvas {
      * @param {...*} args
      */
     destroy(...args) {
-        this.offscreenRegistered && this.renderer?.clearGraph({windowId: this.windowId});
+        let me = this;
+
+        me.app?.un('visibilitychange', me.onWindowVisibility, me);
+        Neo.currentWorker.un('connect', me.onWindowConnect, me);
+        me.offscreenRegistered && me.renderer?.clearGraph({windowId: me.windowId});
         super.destroy(...args)
     }
 
@@ -195,6 +246,18 @@ class SharedCanvas extends Canvas {
         }
     }
 
+    /**
+     * @summary Takes the current visibility of the window this host lives in, then listens to its later reports: a
+     * window that is already hidden never reports, so waiting for a `visibilitychange` would leave the loop running.
+     * @protected
+     */
+    listenToWindow() {
+        let me = this;
+
+        me.windowHidden = Neo.currentWorker.hiddenTick.isHidden(me.windowId);
+        me.app?.on('visibilitychange', me.onWindowVisibility, me)
+    }
+
     /**
      * Forwards one pointer report to the renderer: the canvas-relative position, then the button and modifier facts
      * the DOM event carries (`button`, `buttons`, `altKey`, `ctrlKey`, `metaKey`, `shiftKey`), then what the caller
@@ -244,12 +307,12 @@ class SharedCanvas extends Canvas {
     }
 
     /**
-     * Pauses the Shared Worker render loop.
+     * Pauses the Shared Worker render loop until this host's own `resume()`. A canvas that becomes ready later starts
+     * paused.
      */
     pause() {
-        if (this.isCanvasReady) {
-            this.renderer.pause({windowId: this.windowId})
-        }
+        this.hostPaused = true;
+        this.syncRenderLoop()
     }
 
     /**
@@ -289,6 +352,34 @@ class SharedCanvas extends Canvas {
         this.forwardPointer(data, {wheel: {deltaMode, deltaX, deltaY, deltaZ}})
     }
 
+    /**
+     * A window finished connecting, and its visibility snapshot has landed: the host re-reads it, since the snapshot
+     * can arrive after the view was built and never reaches the app as a `visibilitychange`.
+     * @param {Object} data
+     * @param {String} data.windowId
+     * @protected
+     */
+    onWindowConnect({windowId}) {
+       
```

**File**: `src/worker/HiddenTick.mjs` (modified, +10/-0)
```diff
@@ -38,6 +38,16 @@ class HiddenTick extends Base {
         super.destroy()
     }
 
+    /**
+     * @summary Whether a window's last visibility report said hidden. The connect handshake reads `document.hidden`,
+     * so a window that connects hidden and never changes still answers `true`.
+     * @param {String} windowId
+     * @returns {Boolean}
+     */
+    isHidden(windowId) {
+        return this.timers.has(windowId)
+    }
+
     /**
      * @param {String} windowId
      */
```

**File**: `test/playwright/setup.mjs` (modified, +5/-0)
```diff
@@ -55,6 +55,8 @@ Neo.currentWorker ??= {
         register  : () => {},
         unregister: () => {}
     }),
+    // Every window is visible until a spec says otherwise
+    hiddenTick      : {isHidden: () => false},
     insertThemeFiles: () => {},
     isDeparture     : () => false,
     isSharedWorker  : false,
@@ -119,9 +121,12 @@ export function setup(options = {}) {
     Object.assign(Neo.config, defaultNeoConfig);
     Object.assign(Neo.config, neoConfig);
 
+    // An app is observable: components subscribe to its events, like `visibilitychange`
     const defaultAppConfig = {
         fire             : () => {},
         isMounted        : () => true,
+        on               : () => {},
+        un               : () => {},
         vnodeInitialising: false
     };
 
```

**File**: `test/playwright/unit/app/SharedCanvasVisibility.spec.mjs` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+/**
+ * @file test/playwright/unit/app/SharedCanvasVisibility.spec.mjs
+ * @summary Pins when `Neo.app.SharedCanvas` lets its renderer loop run: never while its window is hidden, never
+ * while the host holds its own pause, and a window becoming visible never lifts the host's own pause. The host
+ * listens to the `visibilitychange` of the window it lives in, follows itself into another window, and stops
+ * listening once destroyed.
+ */
+
+import {setup} from '../../setup.mjs';
+
+setup({appConfig: {name: 'SharedCanvasVisibilityTest'}});
+
+import {test, expect} from '@playwright/test';
+import Neo            from '../../../../src/Neo.mjs';
+import * as core      from '../../../../src/core/_export.mjs';
+import SharedCanvas   from '../../../../src/app/SharedCanvas.mjs';
+
+/**
+ * A host without its worker and DOM seams: no renderer module to load, no canvas to transfer, no size to observe.
+ * @class Neo.test.app.VisibilityHost
+ * @extends Neo.app.SharedCanvas
+ */
+class VisibilityHost extends SharedCanvas {
+    static config = {
+        className         : 'Neo.test.app.VisibilityHost',
+        monitorSize       : false,
+        offscreen         : false,
+        rendererClassName : 'Neo.test.app.VisibilityRenderer',
+        rendererImportPath: null
+    }
+}
+
+Neo.setupClass(VisibilityHost);
+
+const renderer = {
+    calls: [],
+    clearGraph() {},
+    pause() {this.calls.push('pause')},
+    resume() {this.calls.push('resume')},
+    setTheme() {}
+};
+
+/**
+ * An app as far as the host uses one: it holds `visibilitychange` listeners and fires them.
+ * @returns {Object}
+ */
+function createApp() {
+    const listeners = [];
+
+    return {
+        listeners,
+        fire(name, data) {
+            listeners.filter(entry => entry.name === name).forEach(entry => entry.fn.call(entry.scope, data))
+        },
+        on(name, fn, scope) {
+            listeners.push({fn, name, scope})
+        },
+        un(name, fn, scope) {
+            const index = listeners.findIndex(entry => entry.name === name && entry.fn === fn && entry.scope === scope);
+
+            index > -1 && listeners.splice(index, 1)
+        }
+    }
+}
+
+test.describe('Neo.app.SharedCanvas — a hidden window pauses the render loop, apart from the host\'s own pause', () => {
+    let host, windowA, windowB;
+
+    const setHidden = (app, hidden) => app.fire('visibilitychange', {hidden, visibilityState: hidden ? 'hidden' : 'visible'});
+
+    test.beforeEach(() => {
+        Neo.ns('Neo.test.app', true).VisibilityRenderer = renderer;
+        renderer.calls.length = 0;
+
+        windowA = createApp();
+        windowB = createApp();
+        Neo.apps['visibility-window-a'] = windowA;
+        Neo.apps['visibility-window-b'] = windowB;
+
+        host = Neo.create(VisibilityHost, {windowId: 'visibility-window-a'})
+    });
+
+    test.afterEach(() => {
+        host.isDestroyed || host.destroy();
+        delete Neo.apps['visibility-window-a'];
+        delete Neo.apps['visibility-window-b']
+    });
+
+    test('a hidden window pauses the renderer, and a visible one resumes it', () => {
+        host.isCanvasReady = true;
+
+        setHidden(windowA, true);
+        setHidden(windowA, false);
+
+        expect(renderer.calls).toEqual(['pause', 'resume'])
+    });
+
+    test('a host paused for its own reason stays paused when its window comes back', () => {
+        host.isCanvasReady = true;
+        host.pause();
+
+        setHidden(windowA, true);
+        setHidden(windowA, false);
+
+        expect(renderer.calls, 'no resume while the host holds its pause').toEqual(['pause', 'pause', 'pause']);
+
+        host.resume();
+
+        expect(renderer.calls.at(-1)).toBe('resume')
+    });
+
+    test('a canvas that becomes ready while its window is hidden starts paused', () => {
+        setHidden(windowA, true);
+
+        expect(renderer.calls, 'nothing reaches a canvas that is not ready').toEqual([]);
+
+        host.isCanvasReady = true;
+
+        expect(renderer.calls).toEqual(['pause'])
+    });
+
+    test('the host follows itself into another window, and a destroyed host no longer listens', () => {
+        expect(windowA.listeners).toHaveLength(1);
+
+        host.windowId = 'visibility-window-b';
+
+        expect(windowA.listeners, 'the old window lets go').toHaveLength(0);
+        expect(windowB.listeners).toHaveLength(1);
+
+        host.destroy();
+
+        expect(windowB.listeners).toHaveLength(0)
+    });
+
+    test.describe('a window that is already hidden never reports, so the host reads its current visibility', () => {
+        let original;
+
+        test.beforeEach(() => {
+            original = Neo.currentWorker.hiddenTick.isHidden;
+            Neo.currentWorker.hiddenTick.isHidden = windowId => windowId === 'visibility-window-b'
+        });
+
+        test.afterEach(() => {
+            Neo.currentWorker.hiddenTick.isHidden = original
+        });
+
+        test('a 
```

#### Recent Merged Pull Requests:
- **PR #19410** (2026-10-05): fix(release): publish stamps the release note's frontmatter before prepare indexes it (#19409) (@neo-opus-grace)
- **PR #19408** (2026-10-05): feat(content): Portal content reads declared corpus and release-notes roots (#19166) (@neo-opus-grace)
- **PR #19407** (2026-10-05): docs(agentos): the Atlas points at the sunset skill's trigger instead of restating 75 % (#19406) (@neo-fable)
- **PR #19405** (2026-10-05): fix(form): a fieldset's legend changes reach the DOM (#19404) (@neo-opus-grace)
- **PR #19403** (2026-10-05): fix(component): hide() keeps its removal when a sibling update merges into the parent cycle (#19402) (@neo-opus-grace)
- **PR #19400** (2026-10-05): docs(release): the 13.2 notes gain the merges since iteration 3 (#19399) (@neo-opus-grace)
- **PR #19398** (2026-10-04): build(deps): bump neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml from 0.1.19 to 0.1.25 in the actions group (@dependabot[bot])
- **PR #19397** (2026-10-04): build(deps-dev): bump the all-deps group with 2 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
