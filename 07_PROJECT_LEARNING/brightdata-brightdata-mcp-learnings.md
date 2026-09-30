# Forensic Learning Record (Deep Inspection): brightdata/brightdata-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/brightdata-brightdata-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/brightdata/brightdata-mcp](https://github.com/brightdata/brightdata-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:44:02.763Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `brightdata/brightdata-mcp`
- **Description**: A powerful Model Context Protocol (MCP) server that provides an all-in-one solution for public web access.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2662 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `aria_snapshot_filter.js`
```
// LICENSE_CODE ZON
'use strict'; /*jslint node:true es9:true*/

export class Aria_snapshot_filter {
    static INTERACTIVE_ROLES = new Set([
        'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox',
        'radio', 'switch', 'slider', 'tab', 'menuitem', 'option',
    ]);
    static parse_playwright_snapshot(snapshot_text){
        const lines = snapshot_text.split('\n');
        const elements = [];
        for (const line of lines)
        {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('-'))
                continue;
            const ref_match = trimmed.match(/\[ref=([^\]]+)\]/);
            if (!ref_match)
                continue;
            const ref = ref_match[1];
            const role_match = trimmed.match(/^-\s+([a-zA-Z]+)/);
            if (!role_match)
                continue;
            const role = role_match[1];
            if (!this.INTERACTIVE_ROLES.has(role))
                continue;
            const name_match = trimmed.match(/"([^"]*)"/);
            const name = name_match ? name_match[1] : '';

            let url = null;
            const next_line_index = lines.indexOf(line)+1;
            if (next_line_index<lines.length)
            {
                const next_line = lines[next_line_index];
                const url_match = next_line.match(/\/url:\s*(.+)/);
                if (url_match)
                    url = url_match[1].trim().replace(/^["']|["']$/g, '');
            }
            elements.push({ref, role, name, url});
        }
        return elements;
    }

    static format_compact(elements){
        const lines = [];
        for (const el of elements)
        {
            const parts = [`[${el.ref}]`, el.role];
            if (el.name && el.name.length>0)
            {
                const name = el.name.length>60 ?
                    el.name.substring(0, 57)+'...' : el.name;
                parts.push(`"${name}"`);
            }
            if (el.url && el.url.length>0 && !el.url.startsWith('#'))
            {
                let url = el.url;
                if (url.length>50)
                    url = url.substring(0, 47)+'...';
                parts.push(`-> ${url}`);
            }
            lines.push(parts.join(' '));
        }
        return lines.join('\n');
    }

    static filter_snapshot(snapshot_text){
        try {
            const elements = this.parse_playwright_snapshot(snapshot_text);
            if (elements.length==0)
                return 'No interactive elements found';
            return this.format_compact(elements);
        } catch(e){
            return `Error filtering snapshot: ${e.message}\n${e.stack}`;
        }
    }

    static format_dom_elements(elements){
        if (!elements || elements.length==0)
            return null;
        const lines = [];
        for (const el of elements)
        {
            const parts = [`[${el.ref}]`, el.role || 'unknown'];
            if (el.name && el.name.length>0)
            {
                const name = el.name.length>60 ?
                    el.name.substring(0, 57)+'...' : el.name;
                parts.push(`"${name}"`);
            }
            if (el.url && el.url.length>0 && !el.url.startsWith('#'))
            {
                let url = el.url;
                if (url.length>50)
                    url = url.substring(0, 47)+'...';
                parts.push(`-> ${url}`);
            }
            lines.push(parts.join(' '));
        }
        return lines.join('\n');
    }
}

```

### Core Architecture Module: `browser_session.js`
```
'use strict'; /*jslint node:true es9:true*/
import * as playwright from 'playwright';
import {Aria_snapshot_filter} from './aria_snapshot_filter.js';

const cred_url_re = /((?:wss?|https?):\/\/)[^/@\s]+@/gi;

const redact_url_creds = value=>
    String(value).replace(cred_url_re, '$1[REDACTED]@');

const connect_over_cdp = async endpoint=>{
    try { return await playwright.chromium.connectOverCDP(endpoint); }
    catch(e){
        const err = new Error(redact_url_creds(e.message));
        err.stack = redact_url_creds(e.stack);
        throw err;
    }
};

export class Browser_session {
    constructor({cdp_endpoint}){
        this.cdp_endpoint = cdp_endpoint;
        this._domainSessions = new Map();
        this._currentDomain = 'default';
        this._dom_refs = new Set();
    }

    _getDomain(url){
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch(e){
            console.error(`Error extracting domain from ${url}:`, e);
            return 'default';
        }
    }

    async _getDomainSession(domain, {log}={}){
        if (!this._domainSessions.has(domain)) 
        {
            this._domainSessions.set(domain, {
                browser: null,
                page: null,
                browserClosed: true,
                requests: new Map()
            });
        }
        return this._domainSessions.get(domain);
    }

    async get_browser({log, domain='default'}={}){
        try {
            const session = await this._getDomainSession(domain, {log});
            if (session.browser)
            {
                try { await session.browser.contexts(); }
                catch(e){
                    log?.(`Browser connection lost for domain ${domain} (${e.message}), `
                        +`reconnecting...`);
                    session.browser = null;
                    session.page = null;
                    session.browserClosed = true;
                }
            }
            if (!session.browser)
            {
                log?.(`Connecting to Bright Data Scraping Browser for domain ${domain}.`);
                session.browser = await connect_over_cdp(
                    this.cdp_endpoint);
                session.browserClosed = false;
                session.browser.on('disconnected', ()=>{
                    log?.(`Browser disconnected for domain ${domain}`);
                    session.browser = null;
                    session.page = null;
                    session.browserClosed = true;
                });
                log?.(`Connected to Bright Data Scraping Browser for domain ${domain}`);
            }
            return session.browser;
        } catch(e){
            console.error(`Error connecting to browser for domain ${domain}:`, e);
            const session = this._domainSessions.get(domain);
            if (session)
            {
                session.browser = null;
                session.page = null;
                session.browserClosed = true;
            }
            throw e;
        }
    }

    async get_page({url=null}={}){
        if (url)
        {
            this._currentDomain = this._getDomain(url);
        }
        const domain = this._currentDomain;
        try {
            const session = await this._getDomainSession(domain);
            if (session.browserClosed || !session.page)
            {
                const browser = await this.get_browser({domain});
                const existingContexts = browser.contexts();
                if (existingContexts.length === 0)
                {
                    const context = await browser.newContext();
                    session.page = await context.newPage();
                }
                else
                {
                    const existingPages = existingContexts[0]?.pages();
                    if (existingPages && existingPages.length > 0)
                        session.page = existingPages[0];
                    else
                        session.page = await existingContexts[0].newPage();
                }
                session.page.on('request', request=>
                    session.requests.set(request, null));
                session.page.on('response', response=>
                    session.requests.set(response.request(), response));
                session.browserClosed = false;
                session.page.once('close', ()=>{
                    session.page = null;
                });
            }
            return session.page;
        } catch(e){
            console.error(`Error getting page for domain ${domain}:`, e);
            const session = this._domainSessions.get(domain);
            if (session) 
            {
                session.browser = null;
                session.page = null;
                session.browserClosed = true;
            }
            throw e;
        }
    }

    async capture_snapshot({filtered=true}={}){
        const page = await this.get_page();
        try {
            const full_snapshot = await page.ariaSnapshot({mode: 'ai'});
            if (!filtered)
            {
                return {
                    url: page.url(),
                    title: await page.title(),
                    aria_snapshot: full_snapshot,
                };
            }
            const filtered_snapshot = Aria_snapshot_filter.filter_snapshot(
                full_snapshot);
            const dom_snapshot = await page.evaluate(()=>{
                const selectors = [
                    'a[href]', 'button', 'input', 'select', 'textarea',
                    'option', '.radio-item', '[role]', '[tabindex]',
                    '[onclick]', '[data-spm-click]', '[data-click]',
                    '[data-action]', '[data-spm-anchor-id]',
                    '[aria-pressed]', '[aria-label]', '[aria-haspopup]'
                ];
                const nodes = Array.from(document.querySelectorAll(
                    selectors.join(',')));
                const elements = [];
                let counter = 0;

                const collapse = text => (text || '')
                    .replace(/\s+/g, ' ').trim();

                const get_labelledby = el=>{
                    const ids = (el.getAttribute('aria-labelledby') || '')
                        .split(/\s+/);
                    return ids.map(id=>{
                        const ref = document.getElementById(id);
                        return ref ? collapse(ref.innerText
                            || ref.textContent || '') : '';
                    }).filter(Boolean).join(' ');
                };

                const get_label_for = el=>{
                    const id = el.id && el.id.trim();
                    if (!id)
                        return '';
                    const lbl = document.querySelector(
                        `label[for="${CSS.escape(id)}"]`);
                    return lbl ? collapse(lbl.innerText
                        || lbl.textContent || '') : '';
                };

                const is_intrinsic = el=>{
                    const tag = el.tagName.toLowerCase();
                    if (['a', 'input', 'button', 'select', 'textarea',
                        'option'].includes(tag))
                    {
                        return true;
                    }
                    const role = (el.getAttribute('role') || '')
                        .toLowerCase();
                    if (['button', 'link', 'radio', 'option', 'tab',
                        'checkbox', 'menuitem'].includes(role))
                    {
                        return true;
                    }
                    if (el.classList.contains('radio-item'))
                        return true;
                    return el.hasAttribute('onclick')
                        || el.hasAttribute('data-click')
                        || el.hasAttribute('data-action')
                        || el.hasAttribute('data-spm-click')
                        || 
```

### Core Architecture Module: `browser_tools.js`
```
'use strict'; /*jslint node:true es9:true*/
import {UserError, imageContent as image_content} from 'fastmcp';
import {z} from 'zod';
import axios from 'axios';
import {Browser_session} from './browser_session.js';
let browser_zone = process.env.BROWSER_ZONE || 'mcp_browser';

let open_session;
let open_session_country = null;
const require_browser = async country=>{
    const normalized_country = country ? country.toLowerCase()
        : open_session_country;

    const needs_new_session = !open_session
        || normalized_country!==open_session_country;

    if (needs_new_session)
    {
        open_session_country = normalized_country || null;
        open_session = new Browser_session({
            cdp_endpoint: await calculate_cdp_endpoint(open_session_country),
        });
    }
    return open_session;
};

const calculate_cdp_endpoint = async country=>{
    try {
        const status_response = await axios({
            url: 'https://api.brightdata.com/status',
            method: 'GET',
            headers: {authorization: `Bearer ${process.env.API_TOKEN}`},
        });
        const customer = status_response.data.customer;
        const password_response = await axios({
            url: `https://api.brightdata.com/zone/passwords?zone=${browser_zone}`,
            method: 'GET',
            headers: {authorization: `Bearer ${process.env.API_TOKEN}`},
        });
        const password = password_response.data.passwords[0];

        const country_suffix = country ? `-country-${country}` : '';
        return `wss://brd-customer-${customer}-zone-${browser_zone}`
            +`${country_suffix}:${password}@brd.superproxy.io:9222`;
    } catch(e){
        if (e.response?.status===422)
            throw new Error(`Browser zone '${browser_zone}' does not exist`);
        throw new Error(`Error retrieving browser credentials: ${e.message}`);
    }
};

let scraping_browser_navigate = {
    name: 'scraping_browser_navigate',
    description: 'Navigate a scraping browser session to a new URL',
    annotations: {
        title: 'Browser Navigate',
        destructiveHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        url: z.string().describe('The URL to navigate to'),
        country: z.string().regex(/^[A-Za-z]{2}$/)
            .optional()
            .describe('Optional 2-letter ISO country code to route the '
            +'browser session (e.g., "US", "GB")'),
    }),
    execute: async({url, country})=>{
        const normalized_country = country?.toLowerCase();
        const browser_session = await require_browser(normalized_country);
        const page = await browser_session.get_page({url});
        await browser_session.clear_requests();
        try {
            await page.goto(url, {
                timeout: 120000,
                waitUntil: 'domcontentloaded',
            });
            return [
                `Successfully navigated to ${url}`,
                `Title: ${await page.title()}`,
                `URL: ${page.url()}`,
            ].join('\n');
        } catch(e){
            throw new UserError(`Error navigating to ${url}: ${e}`);
        }
    },
};

let scraping_browser_go_back = {
    name: 'scraping_browser_go_back',
    description: 'Go back to the previous page',
    annotations: {
        title: 'Browser Go Back',
        destructiveHint: true,
    },
    parameters: z.object({}),
    execute: async()=>{
        const page = await (await require_browser()).get_page();
        try {
            await page.goBack();
            return [
                'Successfully navigated back',
                `Title: ${await page.title()}`,
                `URL: ${page.url()}`,
            ].join('\n');
        } catch(e){
            throw new UserError(`Error navigating back: ${e}`);
        }
    },
};

const scraping_browser_go_forward = {
    name: 'scraping_browser_go_forward',
    description: 'Go forward to the next page',
    annotations: {
        title: 'Browser Go Forward',
        destructiveHint: true,
    },
    parameters: z.object({}),
    execute: async()=>{
        const page = await (await require_browser()).get_page();
        try {
            await page.goForward();
            return [
                'Successfully navigated forward',
                `Title: ${await page.title()}`,
                `URL: ${page.url()}`,
            ].join('\n');
        } catch(e){
            throw new UserError(`Error navigating forward: ${e}`);
        }
    },
};

let scraping_browser_snapshot = {
    name: 'scraping_browser_snapshot',
    description: [
        'Capture an ARIA snapshot of the current page showing all interactive '
        +'elements with their refs.',
        'This provides accurate element references that can be used with '
        +'ref-based tools.',
        'Use this before interacting with elements to get proper refs instead '
        +'of guessing selectors.'
    ].join('\n'),
    annotations: {
        title: 'Browser Snapshot',
        readOnlyHint: true,
    },
    parameters: z.object({
        filtered: z.boolean().optional().describe(
            'Whether to apply filtering/compaction (default: false). '
            +'Set to true to get a compacted version of the snapshot.'),
    }),
    execute: async({filtered=false})=>{
        const browser_session = await require_browser();
        const page = await browser_session.get_page();
        try {
            const snapshot = await browser_session.capture_snapshot(
                {filtered});
            const lines = [
                `Page: ${snapshot.url}`,
                `Title: ${snapshot.title}`,
                '',
                'Interactive Elements:',
                snapshot.aria_snapshot,
            ];
            if (snapshot.dom_snapshot)
            {
                lines.push('');
                lines.push('DOM Interactive Elements:');
                lines.push(snapshot.dom_snapshot);
            }
            return lines.join('\n');
        } catch(e){
            throw new UserError(`Error capturing snapshot: ${e}`);
        }
    },
};

let scraping_browser_click_ref = {
    name: 'scraping_browser_click_ref',
    description: [
        'Click on an element using its ref from the ARIA snapshot.',
        'Use scraping_browser_snapshot first to get the correct ref values.',
        'This is more reliable than CSS selectors.'
    ].join('\n'),
    annotations: {
        title: 'Browser Click Element',
        destructiveHint: true,
    },
    parameters: z.object({
        ref: z.string().describe('The ref attribute from the ARIA snapshot (e.g., "23")'),
        element: z.string().describe('Description of the element being clicked for context'),
    }),
    execute: async({ref, element})=>{
        const browser_session = await require_browser();
        try {
            const locator = await browser_session.ref_locator({element, ref});
            await locator.click({timeout: 5000});
            return `Successfully clicked element: ${element} (ref=${ref})`;
        } catch(e){
            throw new UserError(`Error clicking element ${element} with ref ${ref}: ${e}`);
        }
    },
};

let scraping_browser_type_ref = {
    name: 'scraping_browser_type_ref',
    description: [
        'Type text into an element using its ref from the ARIA snapshot.',
        'Use scraping_browser_snapshot first to get the correct ref values.',
        'This is more reliable than CSS selectors.'
    ].join('\n'),
    annotations: {
        title: 'Browser Type Text',
        destructiveHint: true,
    },
    parameters: z.object({
        ref: z.string().describe('The ref attribute from the ARIA snapshot (e.g., "23")'),
        element: z.string().describe('Description of the element being typed into for context'),
        text: z.string().describe('Text to type'),
        submit: z.boolean().optional()
            .describe('Whether to submit the form after typing (press Enter)'),
    }),
    exe
```

### Core Architecture Module: `prompts.js`
```
// LICENSE_CODE ZON
'use strict'; /*jslint node:true es9:true*/

const web_scraping_strategy = {
    name: 'web_scraping_strategy',
    description: 'Decision tree for picking the right Bright Data tool. '
        +'Invoke at the start of any scraping session to learn the correct '
        +'tool selection order '
        +'(dataset tools -> Web Unlocker -> Browser API).',
    arguments: [],
    load: ()=>'You have access to Bright Data tools at three tiers of cost'
        +' and capability.\n'
        +'Always follow this order -- do not skip ahead:\n'
        +'\nSTEP 1 -- Check for a dedicated dataset tool (fastest, cheapest):'
        +'\n  Look at the URL. If it matches a known platform, use the'
        +' corresponding web_data_* tool:'
        +'\n  - Amazon product page (/dp/)     -> web_data_amazon_product'
        +'\n  - Amazon search results'
        +'          -> web_data_amazon_product_search'
        +'\n  - LinkedIn profile'
        +'               -> web_data_linkedin_person_profile'
        +'\n  - LinkedIn company'
        +'               -> web_data_linkedin_company_profile'
        +'\n  - Instagram profile/post/reel'
        +'    -> web_data_instagram_profiles / _posts / _reels'
        +'\n  - TikTok profile/post'
        +'            -> web_data_tiktok_profiles / _posts'
        +'\n  - YouTube video/channel'
        +'          -> web_data_youtube_videos / _profiles'
        +'\n  - Reddit post                    -> web_data_reddit_posts'
        +'\n  - X (Twitter) post               -> web_data_x_posts'
        +'\n  - Zillow listing'
        +'                 -> web_data_zillow_properties_listing'
        +'\n  - Booking.com hotel'
        +'              -> web_data_booking_hotel_listings'
        +'\n  - GitHub file'
        +'                    -> web_data_github_repository_file'
        +'\n  - Google Maps reviews            -> web_data_google_maps_reviews'
        +'\n  - Google Shopping                -> web_data_google_shopping'
        +'\n  - (and more -- check all web_data_* tools before proceeding)'
        +'\n\nSTEP 2 -- If no dataset tool matches, use scrape_as_markdown'
        +' (default):'
        +'\n  This handles anti-bot protection and CAPTCHA automatically.'
        +'\n  Retry once if the first attempt returns empty or blocked'
        +' content.'
        +'\n\nSTEP 3 -- If scrape_as_markdown fails twice, escalate to'
        +' scraping_browser_navigate:'
        +'\n  Use ONLY when the page requires JavaScript execution,'
        +' user interaction'
        +'\n  (clicking, form submission), or dynamic content loading.'
        +'\n  This is slower and more expensive'
        +' -- do not use as a first attempt.'
        +'\n\nNEVER use the browser tools for sites'
        +' scrape_as_markdown can handle.'
        +'\nNEVER use scrape_as_markdown when a web_data_* tool matches'
        +' the URL pattern.',
};

const diagnose_scraping_approach = {
    name: 'diagnose_scraping_approach',
    description: 'Run a two-step diagnostic to discover the correct '
        +'Bright Data product for a new website. Tries Web Unlocker first, '
        +'then Browser API, then reports which succeeded.',
    arguments: [],
    load: ()=>'To discover the correct Bright Data product for a new'
        +' website, run this diagnostic:\n'
        +'\n1. Try scrape_as_markdown on the target URL.'
        +'\n   - If it returns useful content'
        +' -> Web Unlocker is the correct integration. Stop.'
        +'\n   - If it returns empty, blocked, or low-quality content'
        +' -> continue to step 2.'
        +'\n\n2. Try scraping_browser_navigate + scraping_browser_snapshot'
        +' on the same URL.'
        +'\n   - If it returns useful content'
        +' -> Browser API is the correct integration. Stop.'
        +'\n   - If both fail -> report to the user that the target may'
        +' require a specialized'
        +'\n     Bright Data product'
        +' (SERP API, specific dataset tool, or custom configuration).'
        +'\n\nReport which approach succeeded and recommend it as the'
        +' integration method.'
        +'\nDo not proceed with data extraction until the diagnostic'
        +' is complete.',
};

const prompts = [web_scraping_strategy, diagnose_scraping_approach];

export default prompts;

```

### Core Architecture Module: `search_dataset_schema.js`
```
'use strict'; /*jslint node:true es9:true*/
import {z} from 'zod';

export const DATASET_IDS = [
    'gd_l1viktl72bvl7bjuj0',
    'gd_me5ppxjr2ge6icjuh0',
    'gd_l1vikfnt1wgvvqz95w',
];

export const dataset_id_schema = z.enum(DATASET_IDS);

export const FILTER_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'in',
    'not_in', 'includes', 'not_includes', 'array_includes',
    'not_array_includes', 'is_null', 'is_not_null'];

const leaf_value_schema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const leaf_schema = z.object({
    name: z.string().describe('Field name to filter on. Get valid field '
        +'names from the list_dataset_fields tool.'),
    operator: z.string().describe('Filter operator, one of: '
        +FILTER_OPERATORS.join(', ')),
    value: leaf_value_schema,
});

function build_node_schema(depth){
    if (depth<=1)
        return leaf_schema;
    const group_schema = z.object({
        operator: z.enum(['and', 'or']),
        filters: z.array(build_node_schema(depth-1)).min(1),
    });
    return z.union([group_schema, leaf_schema]);
}

const MAX_NESTING = 3;
export const filter_schema = build_node_schema(MAX_NESTING+1);

export function metadata_to_fields(metadata){
    const fields = metadata && typeof metadata=='object'
        && metadata.fields && typeof metadata.fields=='object'
        ? metadata.fields : {};
    const out = [];
    for (const [name, meta] of Object.entries(fields))
    {
        if (!meta || typeof meta!='object')
            continue;
        if (meta.active===false)
            continue;
        out.push({
            name,
            type: meta.type,
            description: meta.description,
        });
    }
    return out;
}

```

### Core Architecture Module: `search_utils.js`
```
'use strict'; /*jslint node:true es9:true*/

function truncate_response(response_text, max_length = 300){
    if (typeof response_text != 'string')
        return '';
    const trimmed = response_text.trim();
    if (trimmed.length <= max_length)
        return trimmed;
    return `${trimmed.slice(0, max_length)}...`;
}

export function clean_google_search_payload(raw_data){
    const data = raw_data && typeof raw_data=='object' ? raw_data : {};
    const organic = Array.isArray(data.organic) ? data.organic : [];
    const organic_clean = organic
        .map(entry=>{
            if (!entry || typeof entry!='object')
                return null;
            const link = typeof entry.link=='string' ? entry.link.trim() : '';
            const title = typeof entry.title=='string'
                ? entry.title.trim() : '';
            const description = typeof entry.description=='string'
                ? entry.description.trim() : '';
            if (!link || !title)
                return null;
            return {link, title, description};
        })
        .filter(Boolean);
    return {organic: organic_clean};
}

export function parse_google_search_response(response_text, tool_name){
    try {
        return clean_google_search_payload(JSON.parse(response_text));
    } catch(e){
        const snippet = truncate_response(response_text);
        const details = snippet ? ` Response snippet: ${snippet}` : '';
        throw new Error(`Unexpected non-JSON response from Bright Data`
            +` for ${tool_name}.${details}`, {cause: e});
    }
}

```

### Core Architecture Module: `server.js`
```
#!/usr/bin/env node
'use strict'; /*jslint node:true es9:true*/
import {FastMCP} from 'fastmcp';
import {z} from 'zod';
import axios from 'axios';
import {tools as browser_tools} from './browser_tools.js';
import prompts from './prompts.js';
import {GROUPS} from './tool_groups.js';
import {parse_google_search_response} from './search_utils.js';
import {dataset_id_schema, filter_schema, metadata_to_fields, FILTER_OPERATORS}
    from './search_dataset_schema.js';
import {createRequire} from 'node:module';
import {remark} from 'remark';
import strip from 'strip-markdown';
const require = createRequire(import.meta.url);
const package_json = require('./package.json');
const api_token = process.env.API_TOKEN;
const redact_token = value=>{
    const text = String(value);
    return api_token
        ? text.split(api_token).join('[REDACTED]')
        : text;
};
const safe_error = e=>{
    try {
        const message = e instanceof Error
            && typeof e.message=='string'
            ? e.message
            : 'Tool execution failed';
        return redact_token(message).slice(0, 4096);
    } catch(_e){
        return 'Tool execution failed';
    }
};
const unlocker_zone = process.env.WEB_UNLOCKER_ZONE || 'mcp_unlocker';
const browser_zone = process.env.BROWSER_ZONE || 'mcp_browser';
const pro_mode = process.env.PRO_MODE === 'true';
const polling_timeout = parseInt(process.env.POLLING_TIMEOUT || '600', 10);
const base_timeout = process.env.BASE_TIMEOUT
    ? parseInt(process.env.BASE_TIMEOUT, 10) * 1000 : 0;
const base_max_retries = Math.min(
    parseInt(process.env.BASE_MAX_RETRIES || '0', 10), 3);
const pro_mode_tools = ['search_engine', 'scrape_as_markdown',
    'search_engine_batch', 'scrape_batch', 'discover'];
const tool_groups = process.env.GROUPS ?
    process.env.GROUPS.split(',').map(g=>g.trim().toLowerCase())
        .filter(Boolean) : [];
const custom_tools = process.env.TOOLS ?
    process.env.TOOLS.split(',').map(t=>t.trim()).filter(Boolean) : [];

function build_allowed_tools(groups = [], custom_tools = []){
    const allowed = new Set();
    for (const group_id of groups)
    {
        const group = Object.values(GROUPS)
            .find(g=>g.id===group_id);
        if (!group)
            continue;
        for (const tool of group.tools)
            allowed.add(tool);
    }
    for (const tool of custom_tools)
        allowed.add(tool);
    return allowed;
}

const allowed_tools = build_allowed_tools(tool_groups, custom_tools);
function parse_rate_limit(rate_limit_str) {
    if (!rate_limit_str) 
        return null;
    
    const match = rate_limit_str.match(/^(\d+)\/(\d+)([mhs])$/);
    if (!match) 
        throw new Error('Invalid RATE_LIMIT format. Use: 100/1h or 50/30m');
    
    const [, limit, time, unit] = match;
    const multiplier = unit==='h' ? 3600 : unit==='m' ? 60 : 1;
    
    return {
        limit: parseInt(limit),
        window: parseInt(time) * multiplier * 1000, 
        display: rate_limit_str
    };
}

const rate_limit_config = parse_rate_limit(process.env.RATE_LIMIT);

if (!api_token)
    throw new Error('Cannot run MCP server without API_TOKEN env');

async function base_request(config){
    let last_err;
    for (let attempt = 0; attempt <= base_max_retries; attempt++)
    {
        try {
            return await axios({...config, timeout: base_timeout});
        } catch(e){
            last_err = e;
            if (e.response?.status && e.response.status >= 400
                && e.response.status < 500)
            {
                throw e;
            }
        }
    }
    throw last_err;
}

const api_headers = (clientName=null, tool_name=null)=>({
    'user-agent': `${package_json.name}/${package_json.version}`,
    authorization: `Bearer ${api_token}`,
    ...clientName ? {'x-mcp-client-name': clientName} : {},
    ...tool_name ? {'x-mcp-tool': tool_name} : {},
});

function check_rate_limit(){
    if (!rate_limit_config) 
        return true;
    
    const now = Date.now();
    const window_start = now - rate_limit_config.window;
    
    debug_stats.call_timestamps = debug_stats.call_timestamps
        .filter(timestamp=>timestamp>window_start);
    
    if (debug_stats.call_timestamps.length>=rate_limit_config.limit)
        throw new Error(`Rate limit exceeded: ${rate_limit_config.display}`);
    
    debug_stats.call_timestamps.push(now);
    return true;
}

async function ensure_required_zones(){
    try {
        console.error('Checking for required zones...');
        let response = await axios({
            url: 'https://api.brightdata.com/zone/get_active_zones',
            method: 'GET',
            headers: api_headers(),
        });
        let zones = response.data || [];
        let has_unlocker_zone = zones.some(zone=>zone.name==unlocker_zone);
        let has_browser_zone = zones.some(zone=>zone.name==browser_zone);
        
        if (!has_unlocker_zone)
        {
            console.error(`Required zone "${unlocker_zone}" not found, `
                +`creating it...`);
            await axios({
                url: 'https://api.brightdata.com/zone',
                method: 'POST',
                headers: {
                    ...api_headers(),
                    'Content-Type': 'application/json',
                },
                data: {
                    zone: {name: unlocker_zone, type: 'unblocker'},
                    plan: {type: 'unblocker', ub_premium: true},
                },
            });
            console.error(`Zone "${unlocker_zone}" created successfully`);
        }
        else
            console.error(`Required zone "${unlocker_zone}" already exists`);
            
        if (!has_browser_zone)
        {
            console.error(`Required zone "${browser_zone}" not found, `
                +`creating it...`);
            await axios({
                url: 'https://api.brightdata.com/zone',
                method: 'POST',
                headers: {
                    ...api_headers(),
                    'Content-Type': 'application/json',
                },
                data: {
                    zone: {name: browser_zone, type: 'browser_api'},
                    plan: {type: 'browser_api'},
                },
            });
            console.error(`Zone "${browser_zone}" created successfully`);
        }
        else
            console.error(`Required zone "${browser_zone}" already exists`);
    } catch(e){
        console.error('Error checking/creating zones:',
            e.response?.data||e.message);
    }
}

await ensure_required_zones();

let server = new FastMCP({
    name: 'Bright Data',
    version: package_json.version,
});
let debug_stats = {tool_calls: {}, session_calls: 0, call_timestamps: []};

const addTool = (tool) => {
    if (pro_mode)
    {
        server.addTool(tool);
        return;
    }

    if (allowed_tools.size>0)
    {
        if (allowed_tools.has(tool.name))
            server.addTool(tool);
        return;
    }

    if (pro_mode_tools.includes(tool.name))
        server.addTool(tool);
};

addTool({
    name: 'search_engine',
    description: 'Scrape search results from Google, Bing or Yandex. Returns '
        +'SERP results in JSON or Markdown (URL, title, description),Ideal for'
        +'gathering current information, news, and detailed search results.',
    annotations: {
        title: 'Search Engine',
        readOnlyHint: true,
        openWorldHint: true,
    },
    parameters: z.object({
        query: z.string(),
        engine: z.enum(['google', 'bing', 'yandex'])
            .optional()
            .default('google'),
        cursor: z.string()
            .optional()
            .describe('Pagination cursor for next page'),
        geo_location: z.string()
            .length(2)
            .optional()
            .describe('2-letter country code for geo-targeted results '
                +'(e.g., "us", "uk")'),
    }),
    execute: tool_fn('search_engine', async({query, engine, cursor,
       
```

### Core Architecture Module: `tool_groups.js`
```
'use strict'; /*jslint node:true es9:true*/

const base_tools = ['search_engine', 'scrape_as_markdown', 'discover'];

export const GROUPS = {
    ECOMMERCE: {
        id: 'ecommerce',
        name: 'E-commerce',
        description: 'Retail and marketplace datasets for product intel.',
        tools: [
            ...base_tools,
            'web_data_amazon_product',
            'web_data_amazon_product_reviews',
            'web_data_amazon_product_search',
            'web_data_walmart_product',
            'web_data_walmart_seller',
            'web_data_ebay_product',
            'web_data_homedepot_products',
            'web_data_zara_products',
            'web_data_etsy_products',
            'web_data_bestbuy_products',
            'web_data_google_shopping',
        ],
    },
    SOCIAL_MEDIA: {
        id: 'social',
        name: 'Social Media',
        description: 'Social networks, UGC platforms, and creator insights.',
        tools: [
            ...base_tools,
            'web_data_linkedin_person_profile',
            'web_data_linkedin_company_profile',
            'web_data_linkedin_job_listings',
            'web_data_linkedin_posts',
            'web_data_linkedin_people_search',
            'list_dataset_fields',
            'search_dataset',
            'web_data_instagram_profiles',
            'web_data_instagram_posts',
            'web_data_instagram_reels',
            'web_data_instagram_comments',
            'web_data_facebook_posts',
            'web_data_facebook_marketplace_listings',
            'web_data_facebook_company_reviews',
            'web_data_facebook_events',
            'web_data_tiktok_profiles',
            'web_data_tiktok_posts',
            'web_data_tiktok_shop',
            'web_data_tiktok_comments',
            'web_data_x_posts',
            'web_data_x_profile_posts',
            'web_data_youtube_profiles',
            'web_data_youtube_comments',
            'web_data_youtube_videos',
            'web_data_reddit_posts',
            'web_data_reddit_comments',
        ],
    },
    BROWSER: {
        id: 'browser',
        name: 'Browser Automation',
        description: 'Bright Data Scraping Browser tools for automation.',
        tools: [
            ...base_tools,
            'scraping_browser_navigate',
            'scraping_browser_go_back',
            'scraping_browser_go_forward',
            'scraping_browser_snapshot',
            'scraping_browser_fill_form',
            'scraping_browser_click_ref',
            'scraping_browser_type_ref',
            'scraping_browser_screenshot',
            'scraping_browser_network_requests',
            'scraping_browser_wait_for_ref',
            'scraping_browser_get_text',
            'scraping_browser_get_html',
            'scraping_browser_scroll',
            'scraping_browser_scroll_to_ref',
        ],
    },
    FINANCE: {
        id: 'finance',
        name: 'Finance Intelligence',
        description: 'Company, financial, and location intelligence datasets.',
        tools: [
            ...base_tools,
            'web_data_yahoo_finance_business',
        ],
    },
    BUSINESS: {
        id: 'business',
        name: 'Business Intelligence',
        description: 'Company, and location intelligence datasets.',
        tools: [
            ...base_tools,
            'web_data_crunchbase_company',
            'web_data_zoominfo_company_profile',
            'web_data_google_maps_reviews',
            'web_data_zillow_properties_listing',
            'web_data_booking_hotel_listings',
            'list_dataset_fields',
            'search_dataset',
        ],
    },
    RESEARCH: {
        id: 'research',
        name: 'Research',
        description: 'App stores, news, and developer data feeds.',
        tools: [
            ...base_tools,
            'web_data_github_repository_file',
            'web_data_reuter_news',
        ],
    },
    APP_STORES: {
        id: 'app_stores',
        name: 'App stores',
        description: 'App stores.',
        tools: [
            ...base_tools,
            'web_data_google_play_store',
            'web_data_apple_app_store',
        ],
    },
    TRAVEL: {
        id: 'travel',
        name: 'Travel',
        description: 'Travel information.',
        tools: [
            ...base_tools,
            'web_data_booking_hotel_listings',
        ],
    },
    ADVANCED_SCRAPING: {
        id: 'advanced_scraping',
        name: 'Advanced Scraping',
        description: 'Higher-throughput scraping utilities and batch helpers.',
        tools: [
            ...base_tools,
            'search_engine_batch',
            'scrape_batch',
            'scrape_as_html',
            'extract',
            'session_stats',
        ],
    },
    GEO: {
        id: 'geo',
        name: 'GEO & LLM Visibility',
        description: 'Tools for measuring and analyzing AI/LLM brand '
        +'visibility and generative engine optimization.',
        tools: [
            ...base_tools,
            'web_data_chatgpt_ai_insights',
            'web_data_grok_ai_insights',
            'web_data_perplexity_ai_insights',
        ],
    },
    CODE: {
        id: 'code',
        name: 'Code',
        description: 'Developer tools and package information datasets.',
        tools: [
            ...base_tools,
            'web_data_npm_package',
            'web_data_pypi_package',
        ],
    },
    CUSTOM: {
        id: 'custom',
        name: 'Custom',
        description: 'Placeholder for user-defined tool selections.',
        tools: [...base_tools],
    },
};

export const get_all_group_ids = ()=>{
    return Object.values(GROUPS)
        .map(group=>group.id)
        .filter(id=>id!=='custom');
};

export const get_total_tool_count = ()=>{
    const all_tools = new Set();
    for (let group of Object.values(GROUPS))
        for (let tool of group.tools)
            all_tools.add(tool);
    return all_tools.size;
};

export {base_tools};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3** (2025-05-07): **Timing out?**
  *Symptoms*: ```json {"snapshot_id":"s_m9m7d0b01imdx4s02h","message":"Your request is still in progress and cannot be retrieved in this call. Use the provided Snapshot ID to track progress via the Monitor Snapshot endpoint and download it once ready via the Download Snapshot endpoint"} ```  Any suggestions on how we could avoid timing out on things like LinkedIn scraped data? I was planning on adding a custom cache layer as a last resort, but it feels pretty hacky instead of just asking you folks for ideas.
  **Post-Mortem & Fix Analysis**:
  > Hi there,  Thank you for bringing this to our attention!  You're absolutely right—this is a 1-minute timeout configured on our side (internally, not MCP server-side).  We’ll address the issue directly on our end rather than relying on a workaround.  I’ll keep you updated here once the fix is released.
  > If you need help avoiding timeouts from Cloudflare, shoot me a message and I'd be glad to help.
  > Hi @Manouchehri,  Just wanted to update you that we've transitioned to a polling mechanism instead of using the /scrape endpoint. This change should resolve the issue mentioned in this thread. #7   I'll go ahead and close this issue now, but please don’t hesitate to reach out if you encounter any problems with the new mechanism!

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

### Incident Patch 1: `d33cfa5d` (2026-09-15)
**Commit Message**: Merge pull request #189 from brightdata/fix/redact-cdp-credentials

bump version num and update changelog

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -2,6 +2,12 @@
 
 All notable changes to this project will be documented in this file.
 
+## [2.11.3] - 2026-09-15
+
+### Security
+- Credentials embedded in URLs (`scheme://user:pass@host`) are now
+  redacted from error output.
+
 ## [2.11.2] - 2026-09-10
 
 ### Security
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.11.2",
+    "version": "2.11.3",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "@brightdata/mcp",
-            "version": "2.11.2",
+            "version": "2.11.3",
             "license": "MIT",
             "dependencies": {
                 "@modelcontextprotocol/sdk": "1.21.2",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.11.2",
+    "version": "2.11.3",
     "description": "An MCP interface into the Bright Data toolset",
     "type": "module",
     "main": "./server.js",
```

---

### Incident Patch 2: `68a6de85` (2026-09-15)
**Commit Message**: Merge pull request #188 from brightdata/fix/redact-cdp-credentials

on specific scenarios where CDP connection would fail the error would throw to the end user the connection URL with credentials baked in. implementers of the MCP could have their credentials leaked. the filter will prevent this from happening.

**File**: `browser_session.js` (modified, +17/-3)
```diff
@@ -2,6 +2,20 @@
 import * as playwright from 'playwright';
 import {Aria_snapshot_filter} from './aria_snapshot_filter.js';
 
+const cred_url_re = /((?:wss?|https?):\/\/)[^/@\s]+@/gi;
+
+const redact_url_creds = value=>
+    String(value).replace(cred_url_re, '$1[REDACTED]@');
+
+const connect_over_cdp = async endpoint=>{
+    try { return await playwright.chromium.connectOverCDP(endpoint); }
+    catch(e){
+        const err = new Error(redact_url_creds(e.message));
+        err.stack = redact_url_creds(e.stack);
+        throw err;
+    }
+};
+
 export class Browser_session {
     constructor({cdp_endpoint}){
         this.cdp_endpoint = cdp_endpoint;
@@ -50,7 +64,7 @@ export class Browser_session {
             if (!session.browser)
             {
                 log?.(`Connecting to Bright Data Scraping Browser for domain ${domain}.`);
-                session.browser = await playwright.chromium.connectOverCDP(
+                session.browser = await connect_over_cdp(
                     this.cdp_endpoint);
                 session.browserClosed = false;
                 session.browser.on('disconnected', ()=>{
@@ -65,7 +79,7 @@ export class Browser_session {
         } catch(e){
             console.error(`Error connecting to browser for domain ${domain}:`, e);
             const session = this._domainSessions.get(domain);
-            if (session) 
+            if (session)
             {
                 session.browser = null;
                 session.page = null;
@@ -76,7 +90,7 @@ export class Browser_session {
     }
 
     async get_page({url=null}={}){
-        if (url) 
+        if (url)
         {
             this._currentDomain = this._getDomain(url);
         }
```

**File**: `test/browser-session-redaction.test.js` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+'use strict'; /*jslint node:true es9:true*/
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import {Browser_session} from '../browser_session.js';
+
+const customer = 'hl_canary_customer';
+const password = 'canary-zone-password-should-not-leak';
+// port 1 is closed, so the connect fails offline in milliseconds
+const cdp_endpoint = `wss://brd-customer-${customer}-zone-mcp_browser`
+    +`:${password}@127.0.0.1:1`;
+
+test('CDP connection failures never expose zone credentials', async()=>{
+    const session = new Browser_session({cdp_endpoint});
+    await assert.rejects(()=>session.get_browser({}), e=>{
+        assert.doesNotMatch(e.message, new RegExp(password),
+            'error message must not contain the zone password');
+        assert.doesNotMatch(e.message, new RegExp(customer),
+            'error message must not contain the customer id');
+        assert.doesNotMatch(String(e.stack), new RegExp(password),
+            'error stack must not contain the zone password');
+        assert.match(e.message, /wss:\/\/\[REDACTED\]@127\.0\.0\.1:1/,
+            'the endpoint host must survive redaction');
+        return true;
+    });
+});
```

---

### Incident Patch 3: `4fa3872c` (2026-07-27)
**Commit Message**: Merge pull request #160 from brightdata/fix/playwright-aria-snapshot-api

fix playwright aria snapshot

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.11.0",
+    "version": "2.11.1",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "@brightdata/mcp",
-            "version": "2.11.0",
+            "version": "2.11.1",
             "license": "MIT",
             "dependencies": {
                 "@modelcontextprotocol/sdk": "1.21.2",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.11.0",
+    "version": "2.11.1",
     "description": "An MCP interface into the Bright Data toolset",
     "type": "module",
     "main": "./server.js",
```

---

### Incident Patch 4: `57af2277` (2026-07-27)
**Commit Message**: Merge pull request #158 from artemo-brd/fix/playwright-aria-snapshot-api

fix playwright aria snapshot

**File**: `browser_session.js` (modified, +2/-2)
```diff
@@ -126,7 +126,7 @@ export class Browser_session {
     async capture_snapshot({filtered=true}={}){
         const page = await this.get_page();
         try {
-            const full_snapshot = await page._snapshotForAI();
+            const full_snapshot = await page.ariaSnapshot({mode: 'ai'});
             if (!filtered)
             {
                 return {
@@ -280,7 +280,7 @@ export class Browser_session {
                 return page.locator(`[data-fastmcp-ref="${ref}"]`)
                     .first().describe(element);
             }
-            const snapshot = await page._snapshotForAI();
+            const snapshot = await page.ariaSnapshot({mode: 'ai'});
             if (!snapshot.includes(`[ref=${ref}]`))
                 throw new Error('Ref '+ref+' not found in the current page '
                     +'snapshot. Try capturing new snapshot.');
```

**File**: `package-lock.json` (modified, +14/-21)
```diff
@@ -12,7 +12,7 @@
                 "@modelcontextprotocol/sdk": "1.21.2",
                 "axios": "^1.11.0",
                 "fastmcp": "^3.33.0",
-                "playwright": "^1.51.1",
+                "playwright": "^1.59.0",
                 "remark": "^15.0.1",
                 "strip-markdown": "^6.0.0",
                 "zod": "^3.24.2"
@@ -650,6 +650,7 @@
             "resolved": "https://registry.npmjs.org/express/-/express-5.2.1.tgz",
             "integrity": "sha512-hIS4idWWai69NezIdRt2xFVofaF4j+6INOpJlVOLDO8zXGpUVEVzIYk12UUi2JzjEzWL3IOAxcTubgz9Po0yXw==",
             "license": "MIT",
+            "peer": true,
             "dependencies": {
                 "accepts": "^2.0.0",
                 "body-parser": "^2.2.1",
@@ -1106,6 +1107,7 @@
             "resolved": "https://registry.npmjs.org/hono/-/hono-4.12.4.tgz",
             "integrity": "sha512-ooiZW1Xy8rQ4oELQ++otI2T9DsKpV0M6c6cO6JGx4RTfav9poFFLlet9UMXHZnoM1yG0HWGlQLswBGX3RZmHtg==",
             "license": "MIT",
+            "peer": true,
             "engines": {
                 "node": ">=16.9.0"
             }
@@ -1301,17 +1303,6 @@
             "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
             "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw=="
         },
-        "node_modules/jose": {
-            "version": "5.10.0",
-            "resolved": "https://registry.npmjs.org/jose/-/jose-5.10.0.tgz",
-            "integrity": "sha512-s+3Al/p9g32Iq+oqXxkW//7jk2Vig6FF1CFqzVXoTUXt2qz89YWbL+OwS17NFYEvxC35n0FKeGO2LGYSxeM2Gg==",
-            "license": "MIT",
-            "optional": true,
-            "peer": true,
-            "funding": {
-                "url": "https://github.com/sponsors/panva"
-            }
-        },
         "node_modules/json-schema-traverse": {
             "version": "1.0.0",
             "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-1.0.0.tgz",
@@ -2173,31 +2164,33 @@
             }
         },
         "node_modules/playwright": {
-            "version": "1.56.1",
-            "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.56.1.tgz",
-            "integrity": "sha512-aFi5B0WovBHTEvpM3DzXTUaeN6eN0qWnTkKx4NQaH4Wvcmc153PdaY2UBdSYKaGYw+UyWXSVyxDUg5DoPEttjw==",
+            "version": "1.62.0",
+            "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.62.0.tgz",
+            "integrity": "sha512-Z14dG305dgaLu6foB1TXQagFiW8JfSUIUaUuPaKQ6NtBPKF1P/qXcqfh6c6K/icPqdy37JmjbiBXf6JNg6Sylw==",
+            "license": "Apache-2.0",
             "dependencies": {
-                "playwright-core": "1.56.1"
+                "playwright-core": "1.62.0"
             },
             "bin": {
                 "playwright": "cli.js"
             },
             "engines": {
-                "node": ">=18"
+                "node": ">=20"
             },
             "optionalDependencies": {
                 "fsevents": "2.3.2"
             }
         },
         "node_modules/playwright-core": {
-            "version": "1.56.1",
-            "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.56.1.tgz",
-            "integrity": "sha512-hutraynyn31F+Bifme+Ps9Vq59hKuUCz7H1kDOcBs+2oGguKkWTU50bBWrtz34OUWmIwpBTWDxaRPXrIXkgvmQ==",
+            "version": "1.62.0",
+            "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.62.0.tgz",
+            "integrity": "sha512-nsNRyq0r2zsG8AcRHWknc9QRA5XCueC7gWMrs+Gx2tlZn9hcl8zudfh00lhJPY1DE7NmZ6bDsT9g2yey8mXljA==",
+            "license": "Apache-2.0",
             "bin": {
                 "playwright-core": "cli.js"
             },
             "engines": {
-                "node": ">=18"
+                "node": ">=20"
             }
         },
         "node_modules/pretty-ms": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
         "@modelcontextprotocol/sdk": "1.21.2",
         "axios": "^1.11.0",
         "fastmcp": "^3.33.0",
-        "playwright": "^1.51.1",
+        "playwright": "^1.59.0",
         "remark": "^15.0.1",
         "strip-markdown": "^6.0.0",
         "zod": "^3.24.2"
```

---

### Incident Patch 5: `7ee9bb6c` (2026-07-26)
**Commit Message**: fix playwright aria snapshot

**File**: `browser_session.js` (modified, +2/-2)
```diff
@@ -126,7 +126,7 @@ export class Browser_session {
     async capture_snapshot({filtered=true}={}){
         const page = await this.get_page();
         try {
-            const full_snapshot = await page._snapshotForAI();
+            const full_snapshot = await page.ariaSnapshot({mode: 'ai'});
             if (!filtered)
             {
                 return {
@@ -280,7 +280,7 @@ export class Browser_session {
                 return page.locator(`[data-fastmcp-ref="${ref}"]`)
                     .first().describe(element);
             }
-            const snapshot = await page._snapshotForAI();
+            const snapshot = await page.ariaSnapshot({mode: 'ai'});
             if (!snapshot.includes(`[ref=${ref}]`))
                 throw new Error('Ref '+ref+' not found in the current page '
                     +'snapshot. Try capturing new snapshot.');
```

**File**: `package-lock.json` (modified, +14/-21)
```diff
@@ -12,7 +12,7 @@
                 "@modelcontextprotocol/sdk": "1.21.2",
                 "axios": "^1.11.0",
                 "fastmcp": "^3.33.0",
-                "playwright": "^1.51.1",
+                "playwright": "^1.59.0",
                 "remark": "^15.0.1",
                 "strip-markdown": "^6.0.0",
                 "zod": "^3.24.2"
@@ -650,6 +650,7 @@
             "resolved": "https://registry.npmjs.org/express/-/express-5.2.1.tgz",
             "integrity": "sha512-hIS4idWWai69NezIdRt2xFVofaF4j+6INOpJlVOLDO8zXGpUVEVzIYk12UUi2JzjEzWL3IOAxcTubgz9Po0yXw==",
             "license": "MIT",
+            "peer": true,
             "dependencies": {
                 "accepts": "^2.0.0",
                 "body-parser": "^2.2.1",
@@ -1106,6 +1107,7 @@
             "resolved": "https://registry.npmjs.org/hono/-/hono-4.12.4.tgz",
             "integrity": "sha512-ooiZW1Xy8rQ4oELQ++otI2T9DsKpV0M6c6cO6JGx4RTfav9poFFLlet9UMXHZnoM1yG0HWGlQLswBGX3RZmHtg==",
             "license": "MIT",
+            "peer": true,
             "engines": {
                 "node": ">=16.9.0"
             }
@@ -1301,17 +1303,6 @@
             "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
             "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw=="
         },
-        "node_modules/jose": {
-            "version": "5.10.0",
-            "resolved": "https://registry.npmjs.org/jose/-/jose-5.10.0.tgz",
-            "integrity": "sha512-s+3Al/p9g32Iq+oqXxkW//7jk2Vig6FF1CFqzVXoTUXt2qz89YWbL+OwS17NFYEvxC35n0FKeGO2LGYSxeM2Gg==",
-            "license": "MIT",
-            "optional": true,
-            "peer": true,
-            "funding": {
-                "url": "https://github.com/sponsors/panva"
-            }
-        },
         "node_modules/json-schema-traverse": {
             "version": "1.0.0",
             "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-1.0.0.tgz",
@@ -2173,31 +2164,33 @@
             }
         },
         "node_modules/playwright": {
-            "version": "1.56.1",
-            "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.56.1.tgz",
-            "integrity": "sha512-aFi5B0WovBHTEvpM3DzXTUaeN6eN0qWnTkKx4NQaH4Wvcmc153PdaY2UBdSYKaGYw+UyWXSVyxDUg5DoPEttjw==",
+            "version": "1.62.0",
+            "resolved": "https://registry.npmjs.org/playwright/-/playwright-1.62.0.tgz",
+            "integrity": "sha512-Z14dG305dgaLu6foB1TXQagFiW8JfSUIUaUuPaKQ6NtBPKF1P/qXcqfh6c6K/icPqdy37JmjbiBXf6JNg6Sylw==",
+            "license": "Apache-2.0",
             "dependencies": {
-                "playwright-core": "1.56.1"
+                "playwright-core": "1.62.0"
             },
             "bin": {
                 "playwright": "cli.js"
             },
             "engines": {
-                "node": ">=18"
+                "node": ">=20"
             },
             "optionalDependencies": {
                 "fsevents": "2.3.2"
             }
         },
         "node_modules/playwright-core": {
-            "version": "1.56.1",
-            "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.56.1.tgz",
-            "integrity": "sha512-hutraynyn31F+Bifme+Ps9Vq59hKuUCz7H1kDOcBs+2oGguKkWTU50bBWrtz34OUWmIwpBTWDxaRPXrIXkgvmQ==",
+            "version": "1.62.0",
+            "resolved": "https://registry.npmjs.org/playwright-core/-/playwright-core-1.62.0.tgz",
+            "integrity": "sha512-nsNRyq0r2zsG8AcRHWknc9QRA5XCueC7gWMrs+Gx2tlZn9hcl8zudfh00lhJPY1DE7NmZ6bDsT9g2yey8mXljA==",
+            "license": "Apache-2.0",
             "bin": {
                 "playwright-core": "cli.js"
             },
             "engines": {
-                "node": ">=18"
+                "node": ">=20"
             }
         },
         "node_modules/pretty-ms": {
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
         "@modelcontextprotocol/sdk": "1.21.2",
         "axios": "^1.11.0",
         "fastmcp": "^3.33.0",
-        "playwright": "^1.51.1",
+        "playwright": "^1.59.0",
         "remark": "^15.0.1",
         "strip-markdown": "^6.0.0",
         "zod": "^3.24.2"
```

---

### Incident Patch 6: `d691e289` (2026-04-20)
**Commit Message**: fix:release workflow

**File**: `.github/workflows/release.yml` (modified, +3/-4)
```diff
@@ -13,10 +13,9 @@ jobs:
       - uses: actions/checkout@v5
       - uses: actions/setup-node@v5
         with:
-          node-version: 22
+          node-version: 24
           cache: "npm"
-          registry-url: 'https://registry.npmjs.org'
-          scope: '@brightdata'
+          registry-url: "https://registry.npmjs.org"
       - run: npm ci
       - run: npm audit signatures
-      - run: npm publish
+      - run: npm publish --provenance --access public
```

---

### Incident Patch 7: `5eca9b9b` (2026-04-20)
**Commit Message**: Merge pull request #134 from brightdata/pr-133-convention-fixes

Surface Google SERP parse errors (supersedes #133)

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.9.4",
+    "version": "2.9.5",
     "lockfileVersion": 3,
     "requires": true,
     "packages": {
         "": {
             "name": "@brightdata/mcp",
-            "version": "2.9.4",
+            "version": "2.9.5",
             "license": "MIT",
             "dependencies": {
                 "@modelcontextprotocol/sdk": "1.21.2",
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "@brightdata/mcp",
-    "version": "2.9.4",
+    "version": "2.9.5",
     "description": "An MCP interface into the Bright Data toolset",
     "type": "module",
     "main": "./server.js",
@@ -38,6 +38,7 @@
     },
     "files": [
         "server.js",
+        "search_utils.js",
         "browser_tools.js",
         "browser_session.js",
         "aria_snapshot_filter.js",
```

**File**: `search_utils.js` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+'use strict'; /*jslint node:true es9:true*/
+
+function truncate_response(response_text, max_length = 300){
+    if (typeof response_text != 'string')
+        return '';
+    const trimmed = response_text.trim();
+    if (trimmed.length <= max_length)
+        return trimmed;
+    return `${trimmed.slice(0, max_length)}...`;
+}
+
+export function clean_google_search_payload(raw_data){
+    const data = raw_data && typeof raw_data=='object' ? raw_data : {};
+    const organic = Array.isArray(data.organic) ? data.organic : [];
+    const organic_clean = organic
+        .map(entry=>{
+            if (!entry || typeof entry!='object')
+                return null;
+            const link = typeof entry.link=='string' ? entry.link.trim() : '';
+            const title = typeof entry.title=='string'
+                ? entry.title.trim() : '';
+            const description = typeof entry.description=='string'
+                ? entry.description.trim() : '';
+            if (!link || !title)
+                return null;
+            return {link, title, description};
+        })
+        .filter(Boolean);
+    return {organic: organic_clean};
+}
+
+export function parse_google_search_response(response_text, tool_name){
+    try {
+        return clean_google_search_payload(JSON.parse(response_text));
+    } catch(e){
+        const snippet = truncate_response(response_text);
+        const details = snippet ? ` Response snippet: ${snippet}` : '';
+        throw new Error(`Unexpected non-JSON response from Bright Data`
+            +` for ${tool_name}.${details}`, {cause: e});
+    }
+}
```

**File**: `server.js` (modified, +41/-66)
```diff
@@ -6,6 +6,7 @@ import axios from 'axios';
 import {tools as browser_tools} from './browser_tools.js';
 import prompts from './prompts.js';
 import {GROUPS} from './tool_groups.js';
+import {parse_google_search_response} from './search_utils.js';
 import {createRequire} from 'node:module';
 import {remark} from 'remark';
 import strip from 'strip-markdown';
@@ -198,7 +199,7 @@ const addTool = (tool) => {
 addTool({
     name: 'search_engine',
     description: 'Scrape search results from Google, Bing or Yandex. Returns '
-        +'SERP results in JSON or Markdown (URL, title, description), Ideal for'
+        +'SERP results in JSON or Markdown (URL, title, description),Ideal for'
         +'gathering current information, news, and detailed search results.',
     annotations: {
         title: 'Search Engine',
@@ -238,15 +239,8 @@ addTool({
         });
         if (!is_google)
             return response.data;
-        try {
-            const search_data = JSON.parse(response.data);
-            return JSON.stringify(
-                clean_google_search_payload(search_data), null, 2);
-        } catch(e){
-            return JSON.stringify({
-                organic: []
-            }, null, 2);
-        }
+        return JSON.stringify(parse_google_search_response(response.data,
+            'search_engine'), null, 2);
     }),
 });
 
@@ -310,48 +304,51 @@ addTool({
     execute: tool_fn('search_engine_batch', async({queries}, ctx)=>{
         const search_promises = queries.map(({query, engine, cursor,
             geo_location})=>{
-            const is_google = (engine || 'google') === 'google';
-            const url = search_url(engine || 'google', query, cursor,
+            const normalized_engine = engine || 'google';
+            const is_google = normalized_engine === 'google';
+            const url = search_url(normalized_engine, query, cursor,
                 geo_location);
-
-            return base_request({
-                url: 'https://api.brightdata.com/request',
-                method: 'POST',
-                data: {
-                    url: is_google ? `${url}&brd_json=1` : url,
-                    zone: unlocker_zone,
-                    format: 'raw',
-                    data_format: is_google ? 'parsed_light' : 'markdown',
-                },
-                headers: api_headers(ctx.clientName, 'search_engine_batch'),
-                responseType: 'text',
-            }).then(response=>{
-                if (is_google)
-                {
-                    try {
-                        const search_data = JSON.parse(response.data);
-                        return {
-                            query,
-                            engine: engine || 'google',
-                            result: clean_google_search_payload(search_data),
-                        };
-                    } catch(e){
+            return (async()=>{
+                try {
+                    const response = await base_request({
+                        url: 'https://api.brightdata.com/request',
+                        method: 'POST',
+                        data: {
+                            url: is_google ? `${url}&brd_json=1` : url,
+                            zone: unlocker_zone,
+                            format: 'raw',
+                            data_format: is_google ? 'parsed_light'
+                                : 'markdown',
+                        },
+                        headers: api_headers(ctx.clientName,
+                            'search_engine_batch'),
+                        responseType: 'text',
+                    });
+                    if (is_google)
+                    {
                         return {
                             query,
-                            engine: engine || 'google',
-                            result: clean_google_search_payload(null),
+                            engine: normalized_engine,
+                            result: parse_goo
```

**File**: `test/search-utils.test.js` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+'use strict'; /*jslint node:true es9:true*/
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import {clean_google_search_payload, parse_google_search_response}
+    from '../search_utils.js';
+
+test('clean_google_search_payload keeps valid organic results', ()=>{
+    const payload = clean_google_search_payload({
+        organic: [
+            {
+                link: ' https://example.com ',
+                title: ' Example ',
+                description: ' Sample ',
+            },
+            {
+                link: '',
+                title: 'Missing link',
+                description: 'Ignored',
+            },
+        ],
+    });
+
+    assert.deepEqual(payload, {
+        organic: [{
+            link: 'https://example.com',
+            title: 'Example',
+            description: 'Sample',
+        }],
+    });
+});
+
+test('parse_google_search_response throws on invalid JSON body', ()=>{
+    assert.throws(
+        ()=>parse_google_search_response('<html>blocked</html>',
+            'search_engine'),
+        /Unexpected non-JSON response from Bright Data for search_engine\./);
+});
```

---

### Incident Patch 8: `0b601795` (2026-04-16)
**Commit Message**: fix packaging error

**File**: `package.json` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
     },
     "files": [
         "server.js",
+        "search_utils.js",
         "browser_tools.js",
         "browser_session.js",
         "aria_snapshot_filter.js",
```

---

### Incident Patch 9: `5e080159` (2026-04-05)
**Commit Message**: fix: corrupted workflow

**File**: `.github/workflows/release.yml` (modified, +0/-1)
```diff
@@ -17,7 +17,6 @@ jobs:
           cache: "npm"
           registry-url: 'https://registry.npmjs.org'
           scope: '@brightdata'
-      - run: npm install -g npm@latest
       - run: npm ci
       - run: npm audit signatures
       - run: npm publish
```

---

### Incident Patch 10: `830b5cb2` (2026-03-29)
**Commit Message**: fix: resolve merge conflicts

**File**: `server.js` (modified, +19/-1)
```diff
@@ -531,7 +531,7 @@ const datasets = [{
         'This can be a cache lookup, so it can be more reliable than scraping',
     ].join('\n'),
     inputs: ['keyword', 'url'],
-    fixed_values: {pages_to_search: '1'}, 
+    fixed_values: {pages_to_search: '1'},
 }, {
     id: 'walmart_product',
     dataset_id: 'gd_l95fol7l1ru6rlo116',
@@ -957,6 +957,24 @@ const datasets = [{
     inputs: ['prompt'],
     fixed_values: {url: 'https://www.perplexity.ai', index: '', country: ''},
     trigger_params: {custom_output_fields: 'answer_text_markdown'},
+}, {
+    id: 'npm_package',
+    dataset_id: 'gd_mk57m0301khq4jmsul',
+    description: [
+        'Quickly read structured npm package data.',
+        'Requires a valid npm package name (e.g., @brightdata/sdk).',
+        'This can be a cache lookup, so it can be more reliable than scraping',
+    ].join('\n'),
+    inputs: ['package_name'],
+}, {
+    id: 'pypi_package',
+    dataset_id: 'gd_mk57kc3t1wwgmnepp9',
+    description: [
+        'Quickly read structured PyPI package data.',
+        'Requires a valid PyPI package name (e.g., langchain-brightdata).',
+        'This can be a cache lookup, so it can be more reliable than scraping',
+    ].join('\n'),
+    inputs: ['package_name'],
 }];
 const dataset_id_to_title = id=>{
     return id.split('_')
```

**File**: `tool_groups.js` (modified, +10/-0)
```diff
@@ -151,6 +151,16 @@ export const GROUPS = {
             'web_data_perplexity_ai_insights',
         ],
     },
+    CODE: {
+        id: 'code',
+        name: 'Code',
+        description: 'Developer tools and package information datasets.',
+        tools: [
+            ...base_tools,
+            'web_data_npm_package',
+            'web_data_pypi_package',
+        ],
+    },
     CUSTOM: {
         id: 'custom',
         name: 'Custom',
```

#### Recent Merged Pull Requests:
- **PR #189** (2026-09-15): bump version num and update changelog (@romanv-brd)
- **PR #188** (2026-09-15): Fix/redact cdp credentials (@romanv-brd)
- **PR #183** (2026-09-11): Improve error handling and sanitization in tool execution (@artemo-brd)
- **PR #179** (closed): feat(datasets): hand back a collectable snapshot ID instead of losing billed work at the client timeout (@nirsha-brd)
- **PR #160** (2026-07-27): fix playwright aria snapshot (@artemo-brd)
- **PR #158** (2026-07-27): fix playwright aria snapshot (@artemo-brd)
- **PR #154** (2026-06-11): add reddit comments tool (@shahar-brd)
- **PR #142** (2026-06-04): Add search_dataset and list_dataset_fields tools (@meirk-brd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
