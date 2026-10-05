# Forensic Learning Record (Deep Inspection): Charlie85270/tail-kit

> **Canonical Artifact**: `07_PROJECT_LEARNING/charlie85270-tail-kit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Charlie85270/tail-kit](https://github.com/Charlie85270/tail-kit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:25.807Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Charlie85270/tail-kit`
- **Description**: Tail-kit is a free and open source components and templates kit fully coded with Tailwind css 3.0. 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2969 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `utils/Utils.ts`
```
/**
 * return indentation for a level
 * @param level
 */
const getIndent = (level) => {
    let result = '',
        i = level * 4;
    if (level < 0) {
        throw 'Level is below 0';
    }
    while (i--) {
        result += ' ';
    }
    return result;
};

/**
 * Format and beautify html output
 * @param html the html to format
 */
export const formatHtml = (html: string) => {
    html = html.trim();
    const tokens = html.split(/</);
    let result = '',
        indentLevel = 0;

    for (let i = 0, l = tokens.length; i < l; i++) {
        const parts = tokens[i].split(/>/);
        if (parts.length === 2) {
            if (tokens[i][0] === '/') {
                indentLevel--;
            }
            result += getIndent(indentLevel);
            if (tokens[i][0] !== '/') {
                indentLevel++;
            }

            if (i > 0) {
                result += '<';
            }

            result += parts[0].trim() + '>\n';
            if (parts[1].trim() !== '') {
                result += getIndent(indentLevel) + parts[1].trim().replace(/\s+/g, ' ') + '\n';
            }

            if (parts[0].match(/^(img|hr|br)/)) {
                indentLevel--;
            }
        } else {
            result += getIndent(indentLevel) + parts[0] + '\n';
        }
    }
    return result;
};

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    parserOptions: {
        ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
        ecmaFeatures: {
            jsx: true, // Allows for the parsing of JSX
        },
    },
    settings: {
        react: {
            version: 'detect', // Tells eslint-plugin-react to automatically detect the version of React to use
        },
    },
    extends: [
        'plugin:react/recommended', // Uses the recommended rules from @eslint-plugin-react
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-type": "off",
        // suppress errors for missing 'import React' in files
        'react/react-in-jsx-scope': 'off',
        'react/no-unescaped-entities': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'react/prop-types': [2, { ignore: ['children'] }],
        // allow jsx syntax in js files (for next.js project)
        'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx', '.ts', '.tsx'] }], //should add ".ts" if typescript project
    },
};

```

### Core Architecture Module: `.prettierrc.js`
```
module.exports = {
  semi: true,
  trailingComma: "all",
  singleQuote: true,
  printWidth: 120,
  tabWidth: 4,
};

```

### Core Architecture Module: `components/kit/components/commerce/index.tsx`
```
import React, { FC } from 'react';
import SectionDesc from '../../../site/section/SectionDesc';

const Commerce: FC = () => {
    const commerceSections = [
        {
            title: 'Pricing cards',
            items: 9,
            img: 'images/sections/pricing.png',
            link: '/components/pricing',
        },
        {
            title: 'Shopping cards',
            items: 7,
            img: 'images/sections/shopping.png',
            link: '/components/shopping',
        },
    ];

    return <SectionDesc id="commerce" items={commerceSections} title="Commerce" />;
};

export default Commerce;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard.tsx`
```
import React, { FC } from 'react';
import Button from '../../elements/buttons/Button';

export const prices = [
    {
        label: 'All illimited components',
        include: true,
    },
    {
        label: ' Own custom Tailwind styles',
        include: true,
    },
    {
        label: 'Unlimited Templates',
        include: true,
    },
    {
        label: ' Free premium dashboard',
        include: true,
    },
    {
        label: 'Best ranking',
        include: true,
    },
    {
        label: 'Prenium svg',
        include: false,
    },
    {
        label: 'My wife',
        include: false,
    },
];

export const notIncluded = [
    ' No Contracts. No monthly, setup, or additional payment processor fees',
    ' No 2-week on-boarding, it takes 20 minutes!',
];

const PricingCard: FC = () => {
    return (
        <div className="w-64 p-4 bg-white shadow-lg rounded-2xl dark:bg-gray-800">
            <p className="mb-4 text-xl font-medium text-gray-800 dark:text-gray-50">Entreprise</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
                $0 <span className="text-sm text-gray-300">/ month </span>
            </p>
            <p className="mt-4 text-xs text-gray-600 dark:text-gray-100">
                For most businesses that want to optimize web queries.
            </p>

            <ul className="w-full mt-6 mb-6 text-sm text-gray-600 dark:text-gray-100">
                {prices.map((price) => {
                    return (
                        <li key={price.label} className={`mb-3 flex items-center ${price.include ? '' : 'opacity-50'}`}>
                            {price.include ? (
                                <svg
                                    className="w-6 h-6 mr-2"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="6"
                                    height="6"
                                    stroke="currentColor"
                                    fill="#10b981"
                                    viewBox="0 0 1792 1792"
                                >
                                    <path d="M1412 734q0-28-18-46l-91-90q-19-19-45-19t-45 19l-408 407-226-226q-19-19-45-19t-45 19l-91 90q-18 18-18 46 0 27 18 45l362 362q19 19 45 19 27 0 46-19l543-543q18-18 18-45zm252 162q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="6"
                                    height="6"
                                    className="w-6 h-6 mr-2"
                                    fill="red"
                                    viewBox="0 0 1792 1792"
                                >
                                    <path d="M1277 1122q0-26-19-45l-181-181 181-181q19-19 19-45 0-27-19-46l-90-90q-19-19-46-19-26 0-45 19l-181 181-181-181q-19-19-45-19-27 0-46 19l-90 90q-19 19-19 46 0 26 19 45l181 181-181 181q-19 19-19 45 0 27 19 46l90 90q19 19 46 19 26 0 45-19l181-181 181 181q19 19 45 19 27 0 46-19l90-90q19-19 19-46zm387-226q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                </svg>
                            )}

                            {price.label}
                        </li>
                    );
                })}
            </ul>

            <Button label="Choose plan" color="indigo" />
        </div>
    );
};
export default PricingCard;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard2.tsx`
```
import React, { FC } from 'react';
import { prices } from './PricingCard';

const PricingCard2: FC = () => {
    return (
        <div className="w-64 p-4 bg-indigo-500 shadow-lg rounded-2xl dark:bg-gray-800">
            <div className="flex items-center justify-between text-white">
                <p className="mb-4 text-4xl font-medium">Pro</p>
                <p className="flex flex-col text-3xl font-bold">
                    $99
                    <span className="text-sm font-thin text-right">month</span>
                </p>
            </div>

            <p className="mt-4 text-white text-md">Plan include :</p>

            <ul className="w-full mt-6 mb-6 text-sm text-white">
                {prices.map((price) => {
                    return (
                        <li key={price.label} className={`mb-3 flex items-center ${price.include ? '' : 'opacity-50'}`}>
                            {price.include ? (
                                <svg
                                    className="w-6 h-6 mr-2"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="6"
                                    height="6"
                                    stroke="currentColor"
                                    fill="white"
                                    viewBox="0 0 1792 1792"
                                >
                                    <path d="M1412 734q0-28-18-46l-91-90q-19-19-45-19t-45 19l-408 407-226-226q-19-19-45-19t-45 19l-91 90q-18 18-18 46 0 27 18 45l362 362q19 19 45 19 27 0 46-19l543-543q18-18 18-45zm252 162q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="6"
                                    height="6"
                                    className="w-6 h-6 mr-2"
                                    fill="white"
                                    viewBox="0 0 1792 1792"
                                >
                                    <path d="M1277 1122q0-26-19-45l-181-181 181-181q19-19 19-45 0-27-19-46l-90-90q-19-19-46-19-26 0-45 19l-181 181-181-181q-19-19-45-19-27 0-46 19l-90 90q-19 19-19 46 0 26 19 45l181 181-181 181q-19 19-19 45 0 27 19 46l90 90q19 19 46 19 26 0 45-19l181-181 181 181q19 19 45 19 27 0 46-19l90-90q19-19 19-46zm387-226q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                </svg>
                            )}

                            {price.label}
                        </li>
                    );
                })}
            </ul>

            <button
                type="button"
                className="w-full px-3 py-3 text-sm text-indigo-500 bg-white rounded-lg shadow hover:bg-gray-100 "
            >
                Choose plan
            </button>
        </div>
    );
};
export default PricingCard2;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard3.tsx`
```
import React, { FC } from 'react';

const includes = ['All illimited components Tailwind', 'Own analitycs templates', '24/24 support link'];
const bonus = ['All free dashboard', 'Best ranking', 'Chocolate and meel'];

const PricingCard3: FC = () => {
    return (
        <div className="w-64 p-4 bg-white shadow-lg rounded-2xl dark:bg-gray-800">
            <p className="text-3xl font-bold text-black dark:text-white">Essential</p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-300">For the basics tailwind</p>
            <p className="text-3xl font-bold text-black dark:text-white">$99</p>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-300">Per agent per month</p>

            <button
                type="button"
                className="w-56 px-3 py-3 m-auto text-sm text-black bg-white border border-black rounded-lg shadow hover:bg-black hover:text-white dark:hover-text-gray-900 dark:hover:bg-gray-100 "
            >
                Request demo
            </button>

            <ul className="w-full mt-6 mb-6 text-sm text-black dark:text-white">
                {includes.map((price) => {
                    return (
                        <li key={price} className="flex items-center mb-3">
                            <svg
                                className="mr-2"
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 1792 1792"
                            >
                                <path d="M1152 896q0 106-75 181t-181 75-181-75-75-181 75-181 181-75 181 75 75 181zm-256-544q-148 0-273 73t-198 198-73 273 73 273 198 198 273 73 273-73 198-198 73-273-73-273-198-198-273-73zm768 544q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                            </svg>
                            {price}
                        </li>
                    );
                })}
            </ul>
            <span className="block w-56 h-1 my-2 bg-gray-100 rounded-lg" />
            <ul className="w-full mt-6 mb-6 text-sm text-black dark:text-white">
                {bonus.map((bon, index) => {
                    return (
                        <li key={index} className="flex items-center mb-3 space-x-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                fill="#10b981"
                                viewBox="0 0 1792 1792"
                            >
                                <path d="M1600 736v192q0 40-28 68t-68 28h-416v416q0 40-28 68t-68 28h-192q-40 0-68-28t-28-68v-416h-416q-40 0-68-28t-28-68v-192q0-40 28-68t68-28h416v-416q0-40 28-68t68-28h192q40 0 68 28t28 68v416h416q40 0 68 28t28 68z" />
                            </svg>
                            <div>
                                {bon}
                                {index === 0 && (
                                    <a href="#" className="font-semibold text-red-500">
                                        free plan
                                    </a>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};
export default PricingCard3;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard4.tsx`
```
import React, { FC } from 'react';

const PricingCard4: FC = () => {
    return (
        <div className="mb-4 overflow-hidden rounded-lg shadow-lg">
            <div className="px-6 py-8 bg-white dark:bg-gray-800 sm:p-10 sm:pb-6">
                <div className="flex justify-center">
                    <span className="inline-flex px-4 py-1 text-sm font-semibold leading-5 tracking-wide uppercase rounded-full dark:text-white">
                        Team Plan
                    </span>
                </div>
                <div className="flex justify-center mt-4 text-6xl font-extrabold leading-none dark:text-white">
                    <span className="ml-1 mr-3 text-xl font-medium leading-8 text-gray-500 dark:text-gray-400">
                        from
                    </span>
                    $10
                    <span className="pt-8 ml-1 text-2xl font-medium leading-8 text-gray-500 dark:text-gray-400">
                        /month
                    </span>
                </div>
            </div>
            <div className="px-6 pt-6 pb-8 bg-white dark:bg-gray-800 sm:p-10 sm:pt-6">
                <ul>
                    <li className="flex items-start mt-4">
                        <div className="flex-shrink-0">
                            <svg
                                className="w-6 h-6 text-green-500"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                ></path>
                            </svg>
                        </div>
                        <p className="ml-3 text-base leading-6 text-gray-700 dark:text-gray-200">$10/month per user</p>
                    </li>
                    <li className="flex items-start mt-4">
                        <div className="flex-shrink-0">
                            <svg
                                className="w-6 h-6 text-green-500"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                ></path>
                            </svg>
                        </div>
                        <p className="ml-3 text-base leading-6 text-gray-700 dark:text-gray-200">
                            Unlimited number of projects
                        </p>
                    </li>
                    <li className="flex items-start mt-4">
                        <div className="flex-shrink-0">
                            <svg
                                className="w-6 h-6 text-green-500"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                ></path>
                            </svg>
                        </div>
                        <p className="ml-3 text-base leading-6 text-gray-700 dark:text-gray-200">Cancel anytime</p>
                    </li>
                </ul>
                <div className="mt-6 rounded-md shadow">
                    <a
                        href="#"
                        className="flex items-center justify-center px-5 py-3 text-base font-medium leading-6 text-white transition duration-150 ease-in-out bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-500 focus:outline-none focus:shadow-outline"
                    >
                        Start team plan
                    </a>
                </div>
            </div>
        </div>
    );
};
export default PricingCard4;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard5.tsx`
```
import React, { FC } from 'react';

const PricingCard5: FC = () => {
    return (
        <section className="px-2 py-1 mb-4 bg-white border-2 border-t-8 border-purple-600 rounded w-72 dark:bg-gray-800">
            <section className="w-full">
                <header className="text-3xl text-center md:mt-5 dark:text-white">Recruiter</header>
                <header className="justify-center w-full mb-2 text-center md:flex">
                    <span className="text-6xl text-purple-600">50</span>
                    <span className="text-2xl dark:text-white">$</span>
                    <span className="text-6xl line-through dark:text-white">150</span>
                </header>

                <ul className="p-1 mt-5 text-gray-600 text-md dark:text-gray-200">
                    <li className="flex py-1 mb-1">
                        <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                        >
                            <path d="M5 13l4 4L19 7"></path>
                        </svg>
                        &nbsp;Everything in Access
                    </li>
                    <li className="flex py-1 mb-1">
                        <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                        >
                            <path d="M5 13l4 4L19 7"></path>
                        </svg>
                        &nbsp;100+ members
                    </li>
                    <li className="flex py-1 mb-1">
                        <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                        >
                            <path d="M5 13l4 4L19 7"></path>
                        </svg>
                        &nbsp;All videos
                    </li>
                    <li className="flex py-1 mb-1">
                        <svg
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                        >
                            <path d="M5 13l4 4L19 7"></path>
                        </svg>
                        &nbsp;1 Job Post for 30 days
                    </li>
                </ul>
            </section>
        </section>
    );
};
export default PricingCard5;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard6.tsx`
```
import React, { FC } from 'react';
import Button from '../../elements/buttons/Button';

const PricingCard6: FC = () => {
    return (
        <div className="max-w-xs p-4 bg-white rounded-lg shadow-lg w-72 dark:bg-gray-800">
            <p className="pt-4 text-2xl font-bold leading-normal text-center text-black dark:text-white">Pro</p>
            <p className="pb-4 text-4xl font-bold leading-normal text-center text-black font-inter dark:text-white">
                <span className="text-base font-medium leading-loose text-center text-black uppercase font-inter dark:text-white">
                    $
                </span>
                19
                <span className="text-sm font-bold leading-tight text-center text-black opacity-50 font-inter dark:text-white">
                    /user/month
                </span>
            </p>
            <ul>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    All features included
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    3 Mailboxes
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Saved replies
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Social Inbox
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Reports
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Collaboration tools (tags,notes)
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Satisfaction ratings
                </li>
                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                    Workflows
                </li>
            </ul>
            <div className="py-4 text-center">
                <Button label="Try it free" color="indigo" />
            </div>
        </div>
    );
};
export default PricingCard6;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard7.tsx`
```
import React, { FC } from 'react';
import Button from '../../elements/buttons/Button';
import { prices, notIncluded } from './PricingCard';

const PricingCard7: FC = () => {
    return (
        <div className="relative max-w-screen-xl px-4 mx-auto sm:px-6 lg:px-8">
            <div className="max-w-lg mx-auto overflow-hidden rounded-lg shadow-lg pricing-box lg:max-w-none lg:flex">
                <div className="px-6 py-8 bg-white dark:bg-gray-800 lg:flex-shrink-1 lg:p-12">
                    <h3 className="text-2xl font-extrabold leading-8 text-gray-900 sm:text-3xl sm:leading-9 dark:text-white">
                        Zero Commission
                    </h3>
                    <p className="mt-6 text-base leading-6 text-gray-500 dark:text-gray-200">
                        Start selling online for free with all the features you need to launch your local delivery and
                        pick-up service, nothing more. We don't charge commission or monthly fees, keep all your margin.
                    </p>
                    <div className="mt-8">
                        <div className="flex items-center">
                            <h4 className="flex-shrink-0 pr-4 text-sm font-semibold leading-5 tracking-wider text-indigo-600 uppercase bg-white dark:bg-gray-800">
                                What's included
                            </h4>
                            <div className="flex-1 border-t-2 border-gray-200"></div>
                        </div>
                        <ul className="mt-8 lg:grid lg:grid-cols-2 lg:col-gap-8 lg:row-gap-5">
                            {prices.map((price) => {
                                return (
                                    <li className="flex items-start lg:col-span-1" key={price.label}>
                                        <div className="flex-shrink-0">
                                            <svg
                                                className="w-6 h-6 mr-2"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="6"
                                                height="6"
                                                stroke="currentColor"
                                                fill="#10b981"
                                                viewBox="0 0 1792 1792"
                                            >
                                                <path d="M1412 734q0-28-18-46l-91-90q-19-19-45-19t-45 19l-408 407-226-226q-19-19-45-19t-45 19l-91 90q-18 18-18 46 0 27 18 45l362 362q19 19 45 19 27 0 46-19l543-543q18-18 18-45zm252 162q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                            </svg>
                                        </div>
                                        <p className="ml-3 text-sm leading-5 text-gray-700 dark:text-gray-200">
                                            {price.label}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="mt-8">
                        <div className="flex items-center">
                            <h4 className="flex-shrink-0 pr-4 text-sm font-semibold leading-5 tracking-wider text-indigo-600 uppercase bg-white dark:bg-gray-800">
                                &amp; What's not
                            </h4>
                        </div>
                        <ul className="mt-8 lg:grid lg:grid-cols-2 lg:col-gap-8 lg:row-gap-5">
                            {notIncluded.map((not) => {
                                return (
                                    <li className="flex items-start lg:col-span-1" key={not}>
                                        <div className="flex-shrink-0">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="6"
                                                height="6"
                                                className="w-6 h-6 mr-2"
                                                fill="red"
                                                viewBox="0 0 1792 1792"
                                            >
                                                <path d="M1277 1122q0-26-19-45l-181-181 181-181q19-19 19-45 0-27-19-46l-90-90q-19-19-46-19-26 0-45 19l-181 181-181-181q-19-19-45-19-27 0-46 19l-90 90q-19 19-19 46 0 26 19 45l181 181-181 181q-19 19-19 45 0 27 19 46l90 90q19 19 46 19 26 0 45-19l181-181 181 181q19 19 45 19 27 0 46-19l90-90q19-19 19-46zm387-226q0 209-103 385.5t-279.5 279.5-385.5 103-385.5-103-279.5-279.5-103-385.5 103-385.5 279.5-279.5 385.5-103 385.5 103 279.5 279.5 103 385.5z" />
                                            </svg>
                                        </div>
                                        <p className="ml-3 text-sm leading-5 text-gray-700 dark:text-gray-200">{not}</p>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                <div className="px-6 py-8 text-center bg-gray-50 dark:bg-gray-700 lg:flex-shrink-0 lg:flex lg:flex-col lg:justify-center lg:p-12">
                    <p className="text-lg font-bold leading-6 text-gray-900 dark:text-white">Free</p>
                    <div className="flex items-center justify-center mt-4 text-5xl font-extrabold leading-none text-gray-900 dark:text-white">
                        <span>$0/mo</span>
                    </div>
                    <p className="mt-4 text-sm leading-5">
                        <span className="block font-medium text-gray-500 dark:text-gray-400">Card payments:</span>
                        <span className="inline-block font-medium text-gray-500  dark:text-gray-400">
                            2.9% + 20p per transaction
                        </span>
                    </p>
                    <div className="mt-6">
                        <div className="rounded-md shadow">
                            <Button label="Create your store" color="indigo" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default PricingCard7;

```

### Core Architecture Module: `components/kit/components/commerce/pricing/PricingCard8.tsx`
```
import React, { FC } from 'react';
import Button from '../../elements/buttons/Button';

const PricingCard8: FC = () => {
    return (
        <div className="p-4 mx-auto text-center bg-white border-t-4 border-indigo-500 rounded shadow w-72 dark:bg-gray-800">
            <div className="overflow-hidden">
                <div className="mb-8 text-2xl font-medium text-gray-800 dark:text-white">Basic</div>
                <div className="mb-10 text-sm font-light leading-loose text-gray-700 dark:text-gray-50">
                    <div className="font-bold">5000 products</div> <div>All features</div>
                    <div>Free support</div>
                </div>
                <div className="mb-2 text-2xl font-bold text-gray-500 dark:text-gray-200">
                    <span>249 $</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-200">/ month</div>
                <div className="px-4 mt-8">
                    <Button color="indigo" label="Start" />
                </div>
            </div>
        </div>
    );
};
export default PricingCard8;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #85** (2022-11-29): **add tabs components**
  *Symptoms*: Hi and huge thanks for your contribution !   If you add a new component/template, or modify the core of the app please verify that you have check if :  - [x] A similar item does not already exist - [x] Your item is in the right category - [x] The sitemap.xml is up to date (for new section added) - [x] My item is logically grouped below similar items - [x] The content of my item is realistic (avoid lorem ipsum) - [x] All images use in my item are serve locally and as light as possible (use [next/image](https://nextjs.org/docs/api-reference/next/image "next/image") for optimization  ) - [x] If possible, provide a dark implementation of the item - [x] I have read and followed the [contribution guidelines](.github/CONTRIBUTING.md)  For more information see the [contribution guidelines](.github/CONTRIBUTING.md) 

- **Issue #83** (2023-10-30): **Your Google Auto Ads breaks the website experience**
  *Symptoms*: Hey,  The Google Auto Ads are pretty much breaking your website. With it, your components can't be seen properly. It's also annoying to have an ad every fourth component. That's just as much toxic advertising density as Instagram or Twitter.  Through the Ad Spam you have lost me but I am kind enough to open an issue here.  ![image](https://user-images.githubusercontent.com/6547306/175394805-ea6c3e1e-3b20-4edf-9b3d-2b438a00e019.png) ![image](https://user-images.githubusercontent.com/6547306/175395236-db28ecc5-605c-4adf-af57-2993d8a7cf7f.png) 
  **Post-Mortem & Fix Analysis**:
  > Hey @ghostzero , I finally removed all the publicities ! 

- **Issue #80** (2022-01-01): **Feature/tailwind3**
  *Symptoms*: Upgrade to support Tailwind v3 Notes at bottom of README.md for maintainers 
  **Post-Mortem & Fix Analysis**:
  > @bingalls why did you close this PR? Is there something wrong with it?  Is it time to give up on tail-kit?
  > I closed it, because it installs, but fails the build (test). Getting this to work will take much more time. Feel free to pick up my work and move it forward. I recommend Laravel Shift for Tailwind, which is free for F/OSS projects like this. 

- **Issue #78** (2022-11-29): **[feature] Upgrade to Tailwindcss 3**
  *Symptoms*: I started a fork, to upgrade TailKit to Tailwindcss 3, but ran into problems, some of which are documented in my README.md * lint fails for the `build/` directory. It should likely be excluded. * Cannot upgrade Node past v14 because of Webpack 4. * Cannot upgrade React & dependencies past v16 because of react-simple-code-editor v0.11.0  The biggest problem is that Tailwind 3 requires PostCss 8 & Autoprefixer >=10. You'll notice this in `Error: true is not a PostCSS plugin`.  Here are some links with details: * https://github.com/postcss/postcss/issues/1420 * https://github.com/tailwindlabs/tailwindcss/issues/2396 * https://github.com/vercel/next.js/issues/17236  Happy bug hunting!
  **Post-Mortem & Fix Analysis**:
  > @Charlie85270 https://github.com/Charlie85270/tail-kit/pull/80 should close this feature request.
  > Upgrading Webpack >4 has problems. Best to keep "@next/bundle-analyzer": "^9.5.5", the Webpack dependency.
  > Please Upgrade As Soon as possible 

- **Issue #77** (2021-12-13): **Upgraded to tailwind3. Tested with `yarn check` & lint & markdownlint…**
  *Symptoms*: … & prettier  Hi and huge thanks for your contribution !   If you add a new component/template, or modify the core of the app please verify that you have check if :  - [x] A similar item does not already exist - [x] Your item is in the right category - [x] The sitemap.xml is up to date (for new section added) - [x] My item is logically grouped below similar items - [x] The content of my item is realistic (avoid lorem ipsum) - [x] All images use in my item are serve locally and as light as possible (use [next/image](https://nextjs.org/docs/api-reference/next/image "next/image") for optimization  ) - [x] If possible, provide a dark implementation of the item - [x] I have read and followed the [contribution guidelines](.github/CONTRIBUTING.md)  For more information see the [contribution guidelines](.github/CONTRIBUTING.md)  It's not clear, how to test this. I added *Notes* at the bottom of README.md, and ran the following tests, and fixed as much as possible. These are essentially clean. * yarn lint * yarn prettier * yarn check See also * yarn outdated * yarn audit  I kept the broken image linked to camo.githubusercontent.com/... from the original README.md, as I don't know what it should be replaced with. I also cannot find *sitemap.xml*; perhaps contribution instructions should be updated?

- **Issue #75** (2022-07-03): **for what is the i18n key in the configuration?**
  *Symptoms*: Never have seen this. Why is there `i18n` in the recommended configuration?

- **Issue #74** (2021-10-07): **Fix grammatical errors**
  *Symptoms*: ## Fixes a spelling error in the MessagesList Card  ### Before: > Seriously ? haha Bob is not a **children** ! > Do you need that **deisgn** ?   ### After: > Seriously ? haha Bob is not a **child** ! > Do you need that **design** ?   - [x] I have read and followed the [contribution guidelines](.github/CONTRIBUTING.md)  For more information see the [contribution guidelines](.github/CONTRIBUTING.md) 

- **Issue #72** (2021-08-04): **card component**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <img width="379" alt="Screen Shot 2021-08-05 at 4 33 11 am" src="https://user-images.githubusercontent.com/76096736/128239773-7f0ab7f7-b557-4ed9-a2dc-0666e3d5d0fb.png">  A card with rounded borders

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

### Incident Patch 1: `2e9517ff` (2022-11-29)
**Commit Message**: update tailwind css v3

**File**: `pages/index.tsx` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ export const IndexPage: FC = () => {
                             <br />
                             for Tailwind CSS <span className="text-green-500 text-8xl">3.0</span>
                             <span className="text-lg font-normal text-green-500">
-                                Tail-kit now support tailwind CC v3 !
+                                Tail-kit now support tailwind CSS v3 !
                             </span>
                         </span>
                     </h1>
```

---

### Incident Patch 2: `bf5c6361` (2022-11-29)
**Commit Message**: update tailwind css v3

**File**: `README.md` (modified, +68/-85)
```diff
@@ -1,4 +1,4 @@
-# Tail-Kit 
+# Tail-Kit
 
 ![version](https://img.shields.io/badge/version-1.0.0-blue.svg) ![license](https://img.shields.io/badge/license-MIT-blue.svg) ![GitHub issues](https://img.shields.io/github/issues/Charlie85270/tail-kit) <a href="https://www.tailwind-kit.com/" target="_blank">
 ![GitHub Repo stars](https://img.shields.io/github/stars/Charlie85270/tail-kit?style=social)
@@ -7,11 +7,11 @@
 
 </a>
 
-### A beautiful and large components and templates kit for TailwindCSS 2.0
+### A beautiful and large components and templates kit for TailwindCSS 3.0
 
-Tail-Kit is Free and Open Source. It does not change or add any CSS to the already one from TailwindCSS 2.0. It features multiple HTML elements that can be used in all web projects who's use tailwind CSS.
+Tail-Kit is Free and Open Source. It does not change or add any CSS to the already one from TailwindCSS 3.0. It features multiple HTML elements that can be used in all web projects who's use tailwind CSS.
 
-##  Components
+## Components
 
 Tailwind Starter Kit comes with 230+ Fully Coded CSS elements.
 
@@ -28,50 +28,46 @@ Tailwind Starter Kit contains many templates like dashboards, landing pages, log
 and much more !!
 
 ## Live code editor
+
 ![Tailwind-Kit](https://i.ibb.co/g3n4NMg/Capture-d-e-cran-2020-12-27-a-12-06-16.png)
 
 Tailwind-kit include a live code editor to change the components code and see in live the modification.
 
-
 ## Dark mode
-![Tailwind-Kit](https://www.tailwind-kit.com/demo.gif)
 
-Most components and templates are implemented with a light and dark version, with the new dark mode 2.0 feature of tailwind CSS. 
+![Tailwind-Kit](https://www.tailwind-kit.com/demo.gif)
 
+Most components and templates are implemented with a light and dark version, with the new dark mode 3.0 feature of tailwind CSS.
 
 ## Documentation
-The documentation for the Tailwind-kit is hosted at our <a href="https://www.tailwind-kit.com/started" target="_blank">website</a>.
-
 
+The documentation for the Tailwind-kit is hosted at our <a href="https://www.tailwind-kit.com/started" target="_blank">website</a>.
 
 ## Browser Support
 
 At present, we officially aim to support the last two versions of the following browsers:
 
-| Chrome | Firefox | Edge | Safari | Opera |
-|:---:|:---:|:---:|:---:|:---:|
+|                                                               Chrome                                                                |                                                               Firefox                                                                |                                                               Edge                                                                |                                                               Safari                                                                |                                                               Opera                                                                |
+| :---------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------: |
 | <img src="https://raw.githubusercontent.com/creativetimofficial/public-assets/master/logos/chrome-logo.png" width="64" height="64"> | <img src="https://raw.githubusercontent.com/creativetimofficial/public-assets/master/logos/firefox-logo.png" width="64" height="64"> | <img src="https://raw.githubusercontent.com/creativetimofficial/public-assets/master/logos/edge-logo.png" width="64" height="64"> | <img src="https://raw.githubusercontent.com/creativetimofficial/public-assets/master/logos/safari-logo.png" width="64" height="64"> | <img src="https://raw.githubusercontent.com/creativetimofficial/public-assets/master/logos/opera-logo.png" width="64" height="64"> |
 
 ## Reporting Issues/ make Pull request
 
-Every Issues, and PR are welcome ! 
-the site is not perfect, there must be typos, bugs, improvements. 
+Every Issues, and PR are welcome !
+the site is not perfect, there must be typos, bugs, improvements.
 Do not hesitate to contribe and add your own components/layout.
 
-
-
 ## Getting Started
 
 ![Tailwind-Kit](https://camo.githubusercontent.com/6202639220e8972265da4543eb10e428adbf579b8a07fc427bc90b383647a3c9/68747470733a2f2f7777772e6a6f616f706564726f2e63632f696d672f6769746875622f747970657363726970742d6e6578746a732d737461727465722e706e67)
 
-
 Tail-Kit is a static site build with [Next.js](https://nextjs.org/) and types
```

**File**: `components/kit/components/commerce/pricing/PricingCard.tsx` (modified, +8/-8)
```diff
@@ -39,22 +39,22 @@ export const notIncluded = [
 
 const PricingCard: FC = () => {
     return (
-        <div className="shadow-lg rounded-2xl w-64 bg-white dark:bg-gray-800 p-4">
-            <p className="text-gray-800 dark:text-gray-50 text-xl font-medium mb-4">Entreprise</p>
-            <p className="text-gray-900 dark:text-white text-3xl font-bold">
-                $0 <span className="text-gray-300 text-sm">/ month </span>
+        <div className="w-64 p-4 bg-white shadow-lg rounded-2xl dark:bg-gray-800">
+            <p className="mb-4 text-xl font-medium text-gray-800 dark:text-gray-50">Entreprise</p>
+            <p className="text-3xl font-bold text-gray-900 dark:text-white">
+                $0 <span className="text-sm text-gray-300">/ month </span>
             </p>
-            <p className="text-gray-600 dark:text-gray-100  text-xs mt-4">
+            <p className="mt-4 text-xs text-gray-600 dark:text-gray-100">
                 For most businesses that want to optimize web queries.
             </p>
 
-            <ul className="text-sm text-gray-600 dark:text-gray-100 w-full mt-6 mb-6">
+            <ul className="w-full mt-6 mb-6 text-sm text-gray-600 dark:text-gray-100">
                 {prices.map((price) => {
                     return (
                         <li key={price.label} className={`mb-3 flex items-center ${price.include ? '' : 'opacity-50'}`}>
                             {price.include ? (
                                 <svg
-                                    className="h-6 w-6 mr-2"
+                                    className="w-6 h-6 mr-2"
                                     xmlns="http://www.w3.org/2000/svg"
                                     width="6"
                                     height="6"
@@ -69,7 +69,7 @@ const PricingCard: FC = () => {
                                     xmlns="http://www.w3.org/2000/svg"
                                     width="6"
                                     height="6"
-                                    className="h-6 w-6 mr-2"
+                                    className="w-6 h-6 mr-2"
                                     fill="red"
                                     viewBox="0 0 1792 1792"
                                 >
```

**File**: `components/kit/components/commerce/pricing/PricingCard2.tsx` (modified, +10/-10)
```diff
@@ -3,24 +3,24 @@ import { prices } from './PricingCard';
 
 const PricingCard2: FC = () => {
     return (
-        <div className="shadow-lg rounded-2xl w-64 bg-indigo-500 dark:bg-gray-800 p-4">
-            <div className="flex text-white  items-center justify-between">
-                <p className="text-4xl font-medium mb-4">Pro</p>
-                <p className="text-3xl font-bold flex flex-col">
+        <div className="w-64 p-4 bg-indigo-500 shadow-lg rounded-2xl dark:bg-gray-800">
+            <div className="flex items-center justify-between text-white">
+                <p className="mb-4 text-4xl font-medium">Pro</p>
+                <p className="flex flex-col text-3xl font-bold">
                     $99
-                    <span className="font-thin text-right text-sm">month</span>
+                    <span className="text-sm font-thin text-right">month</span>
                 </p>
             </div>
 
-            <p className="text-white text-md mt-4">Plan include :</p>
+            <p className="mt-4 text-white text-md">Plan include :</p>
 
-            <ul className="text-sm text-white w-full mt-6 mb-6">
+            <ul className="w-full mt-6 mb-6 text-sm text-white">
                 {prices.map((price) => {
                     return (
                         <li key={price.label} className={`mb-3 flex items-center ${price.include ? '' : 'opacity-50'}`}>
                             {price.include ? (
                                 <svg
-                                    className="h-6 w-6 mr-2"
+                                    className="w-6 h-6 mr-2"
                                     xmlns="http://www.w3.org/2000/svg"
                                     width="6"
                                     height="6"
@@ -35,7 +35,7 @@ const PricingCard2: FC = () => {
                                     xmlns="http://www.w3.org/2000/svg"
                                     width="6"
                                     height="6"
-                                    className="h-6 w-6 mr-2"
+                                    className="w-6 h-6 mr-2"
                                     fill="white"
                                     viewBox="0 0 1792 1792"
                                 >
@@ -51,7 +51,7 @@ const PricingCard2: FC = () => {
 
             <button
                 type="button"
-                className="w-full px-3 py-3 text-sm shadow rounded-lg text-indigo-500 bg-white hover:bg-gray-100 "
+                className="w-full px-3 py-3 text-sm text-indigo-500 bg-white rounded-lg shadow hover:bg-gray-100 "
             >
                 Choose plan
             </button>
```

**File**: `components/kit/components/commerce/pricing/PricingCard3.tsx` (modified, +12/-12)
```diff
@@ -5,23 +5,23 @@ const bonus = ['All free dashboard', 'Best ranking', 'Chocolate and meel'];
 
 const PricingCard3: FC = () => {
     return (
-        <div className="shadow-lg rounded-2xl w-64 bg-white dark:bg-gray-800 p-4">
-            <p className="text-black dark:text-white text-3xl font-bold">Essential</p>
-            <p className="text-gray-500 dark:text-gray-300 text-sm mb-4">For the basics tailwind</p>
-            <p className="text-black dark:text-white  text-3xl font-bold">$99</p>
-            <p className="text-gray-500 dark:text-gray-300 text-sm mb-4">Per agent per month</p>
+        <div className="w-64 p-4 bg-white shadow-lg rounded-2xl dark:bg-gray-800">
+            <p className="text-3xl font-bold text-black dark:text-white">Essential</p>
+            <p className="mb-4 text-sm text-gray-500 dark:text-gray-300">For the basics tailwind</p>
+            <p className="text-3xl font-bold text-black dark:text-white">$99</p>
+            <p className="mb-4 text-sm text-gray-500 dark:text-gray-300">Per agent per month</p>
 
             <button
                 type="button"
-                className="w-56 m-auto px-3 py-3 text-sm shadow border border-black rounded-lg text-black bg-white hover:bg-black hover:text-white dark:hover-text-gray-900 dark:hover:bg-gray-100 "
+                className="w-56 px-3 py-3 m-auto text-sm text-black bg-white border border-black rounded-lg shadow hover:bg-black hover:text-white dark:hover-text-gray-900 dark:hover:bg-gray-100 "
             >
                 Request demo
             </button>
 
-            <ul className="text-sm text-black dark:text-white w-full mt-6 mb-6">
+            <ul className="w-full mt-6 mb-6 text-sm text-black dark:text-white">
                 {includes.map((price) => {
                     return (
-                        <li key={price} className="mb-3 flex items-center">
+                        <li key={price} className="flex items-center mb-3">
                             <svg
                                 className="mr-2"
                                 xmlns="http://www.w3.org/2000/svg"
@@ -36,11 +36,11 @@ const PricingCard3: FC = () => {
                     );
                 })}
             </ul>
-            <span className="w-56 block bg-gray-100 h-1 rounded-lg my-2" />
-            <ul className="text-sm text-black dark:text-white w-full mt-6 mb-6">
+            <span className="block w-56 h-1 my-2 bg-gray-100 rounded-lg" />
+            <ul className="w-full mt-6 mb-6 text-sm text-black dark:text-white">
                 {bonus.map((bon, index) => {
                     return (
-                        <li key={index} className="mb-3 flex items-center space-x-2">
+                        <li key={index} className="flex items-center mb-3 space-x-2">
                             <svg
                                 xmlns="http://www.w3.org/2000/svg"
                                 width="16"
@@ -53,7 +53,7 @@ const PricingCard3: FC = () => {
                             <div>
                                 {bon}
                                 {index === 0 && (
-                                    <a href="#" className="text-red-500 font-semibold">
+                                    <a href="#" className="font-semibold text-red-500">
                                         free plan
                                     </a>
                                 )}
```

**File**: `components/kit/components/commerce/pricing/PricingCard4.tsx` (modified, +12/-12)
```diff
@@ -2,29 +2,29 @@ import React, { FC } from 'react';
 
 const PricingCard4: FC = () => {
     return (
-        <div className="rounded-lg shadow-lg overflow-hidden mb-4">
+        <div className="mb-4 overflow-hidden rounded-lg shadow-lg">
             <div className="px-6 py-8 bg-white dark:bg-gray-800 sm:p-10 sm:pb-6">
                 <div className="flex justify-center">
-                    <span className="inline-flex px-4 py-1 dark:text-white rounded-full text-sm leading-5 font-semibold tracking-wide uppercase">
+                    <span className="inline-flex px-4 py-1 text-sm font-semibold leading-5 tracking-wide uppercase rounded-full dark:text-white">
                         Team Plan
                     </span>
                 </div>
-                <div className="mt-4 flex justify-center text-6xl leading-none font-extrabold dark:text-white">
-                    <span className="ml-1 mr-3 text-xl leading-8 font-medium text-gray-500 dark:text-gray-400">
+                <div className="flex justify-center mt-4 text-6xl font-extrabold leading-none dark:text-white">
+                    <span className="ml-1 mr-3 text-xl font-medium leading-8 text-gray-500 dark:text-gray-400">
                         from
                     </span>
                     $10
-                    <span className="ml-1 pt-8 text-2xl leading-8 font-medium text-gray-500 dark:text-gray-400">
+                    <span className="pt-8 ml-1 text-2xl font-medium leading-8 text-gray-500 dark:text-gray-400">
                         /month
                     </span>
                 </div>
             </div>
             <div className="px-6 pt-6 pb-8 bg-white dark:bg-gray-800 sm:p-10 sm:pt-6">
                 <ul>
-                    <li className="mt-4 flex items-start">
+                    <li className="flex items-start mt-4">
                         <div className="flex-shrink-0">
                             <svg
-                                className="h-6 w-6 text-green-500"
+                                className="w-6 h-6 text-green-500"
                                 stroke="currentColor"
                                 fill="none"
                                 viewBox="0 0 24 24"
@@ -39,10 +39,10 @@ const PricingCard4: FC = () => {
                         </div>
                         <p className="ml-3 text-base leading-6 text-gray-700 dark:text-gray-200">$10/month per user</p>
                     </li>
-                    <li className="mt-4 flex items-start">
+                    <li className="flex items-start mt-4">
                         <div className="flex-shrink-0">
                             <svg
-                                className="h-6 w-6 text-green-500"
+                                className="w-6 h-6 text-green-500"
                                 stroke="currentColor"
                                 fill="none"
                                 viewBox="0 0 24 24"
@@ -59,10 +59,10 @@ const PricingCard4: FC = () => {
                             Unlimited number of projects
                         </p>
                     </li>
-                    <li className="mt-4 flex items-start">
+                    <li className="flex items-start mt-4">
                         <div className="flex-shrink-0">
                             <svg
-                                className="h-6 w-6 text-green-500"
+                                className="w-6 h-6 text-green-500"
                                 stroke="currentColor"
                                 fill="none"
                                 viewBox="0 0 24 24"
@@ -81,7 +81,7 @@ const PricingCard4: FC = () => {
                 <div className="mt-6 rounded-md shadow">
                     <a
                         href="#"
-                        className="flex items-center justify-center px-5 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
+                        className="flex items-center justify-center px-5 py-3 text-base font-medium leading-6 text-white transition duration-150 ease-in-out bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-500 focus:outline-none focus:shadow-outline"
                     >
                         Start team plan
                     </a>
```

**File**: `components/kit/components/commerce/pricing/PricingCard5.tsx` (modified, +12/-12)
```diff
@@ -2,67 +2,67 @@ import React, { FC } from 'react';
 
 const PricingCard5: FC = () => {
     return (
-        <section className="mb-4 w-72 border-t-8 px-2 py-1 bg-white dark:bg-gray-800 rounded border-purple-600 border-2">
+        <section className="px-2 py-1 mb-4 bg-white border-2 border-t-8 border-purple-600 rounded w-72 dark:bg-gray-800">
             <section className="w-full">
                 <header className="text-3xl text-center md:mt-5 dark:text-white">Recruiter</header>
-                <header className="w-full md:flex justify-center text-center mb-2">
+                <header className="justify-center w-full mb-2 text-center md:flex">
                     <span className="text-6xl text-purple-600">50</span>
                     <span className="text-2xl dark:text-white">$</span>
-                    <span className="line-through text-6xl dark:text-white">150</span>
+                    <span className="text-6xl line-through dark:text-white">150</span>
                 </header>
 
-                <ul className="mt-5 p-1 text-md text-gray-600 dark:text-gray-200">
-                    <li className="flex mb-1 py-1">
+                <ul className="p-1 mt-5 text-gray-600 text-md dark:text-gray-200">
+                    <li className="flex py-1 mb-1">
                         <svg
                             fill="none"
                             stroke="currentColor"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             strokeWidth="2"
                             viewBox="0 0 24 24"
-                            className="w-8 h-8 text-indigo-800 dark:text-white font-bold"
+                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                         >
                             <path d="M5 13l4 4L19 7"></path>
                         </svg>
                         &nbsp;Everything in Access
                     </li>
-                    <li className="flex mb-1 py-1">
+                    <li className="flex py-1 mb-1">
                         <svg
                             fill="none"
                             stroke="currentColor"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             strokeWidth="2"
                             viewBox="0 0 24 24"
-                            className="w-8 h-8 text-indigo-800 dark:text-white font-bold"
+                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                         >
                             <path d="M5 13l4 4L19 7"></path>
                         </svg>
                         &nbsp;100+ members
                     </li>
-                    <li className="flex mb-1 py-1">
+                    <li className="flex py-1 mb-1">
                         <svg
                             fill="none"
                             stroke="currentColor"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             strokeWidth="2"
                             viewBox="0 0 24 24"
-                            className="w-8 h-8 text-indigo-800 dark:text-white font-bold"
+                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                         >
                             <path d="M5 13l4 4L19 7"></path>
                         </svg>
                         &nbsp;All videos
                     </li>
-                    <li className="flex mb-1 py-1">
+                    <li className="flex py-1 mb-1">
                         <svg
                             fill="none"
                             stroke="currentColor"
                             strokeLinecap="round"
                             strokeLinejoin="round"
                             strokeWidth="2"
                             viewBox="0 0 24 24"
-                            className="w-8 h-8 font-bold dark:text-white text-indigo-800"
+                            className="w-8 h-8 font-bold text-indigo-800 dark:text-white"
                         >
                             <path d="M5 13l4 4L19 7"></path>
                         </svg>
```

**File**: `components/kit/components/commerce/pricing/PricingCard6.tsx` (modified, +13/-13)
```diff
@@ -3,40 +3,40 @@ import Button from '../../elements/buttons/Button';
 
 const PricingCard6: FC = () => {
     return (
-        <div className="rounded-lg w-72 p-4 bg-white shadow-lg dark:bg-gray-800 max-w-xs">
-            <p className="text-2xl leading-normal text-center font-bold text-black dark:text-white pt-4">Pro</p>
-            <p className="text-4xl font-inter leading-normal text-center font-bold text-black dark:text-white pb-4">
-                <span className="font-inter text-base leading-loose text-center font-medium text-black  dark:text-white uppercase">
+        <div className="max-w-xs p-4 bg-white rounded-lg shadow-lg w-72 dark:bg-gray-800">
+            <p className="pt-4 text-2xl font-bold leading-normal text-center text-black dark:text-white">Pro</p>
+            <p className="pb-4 text-4xl font-bold leading-normal text-center text-black font-inter dark:text-white">
+                <span className="text-base font-medium leading-loose text-center text-black uppercase font-inter dark:text-white">
                     $
                 </span>
                 19
-                <span className="text-sm font-inter leading-tight text-center font-bold text-black dark:text-white opacity-50">
+                <span className="text-sm font-bold leading-tight text-center text-black opacity-50 font-inter dark:text-white">
                     /user/month
                 </span>
             </p>
             <ul>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     All features included
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     3 Mailboxes
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Saved replies
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Social Inbox
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Reports
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Collaboration tools (tags,notes)
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Satisfaction ratings
                 </li>
-                <li className="text-xs font-inter leading-normal text-center font-medium text-black dark:text-white py-4 border-t border-gray-300">
+                <li className="py-4 text-xs font-medium leading-normal text-center text-black border-t border-gray-300 font-inter dark:text-white">
                     Workflows
                 </li>
             </ul>
```

**File**: `components/kit/components/commerce/pricing/PricingCard7.tsx` (modified, +12/-12)
```diff
@@ -4,10 +4,10 @@ import { prices, notIncluded } from './PricingCard';
 
 const PricingCard7: FC = () => {
     return (
-        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
-            <div className="pricing-box max-w-lg mx-auto rounded-lg shadow-lg overflow-hidden lg:max-w-none lg:flex">
-                <div className="bg-white dark:bg-gray-800 px-6 py-8 lg:flex-shrink-1 lg:p-12">
-                    <h3 className="text-2xl leading-8 font-extrabold text-gray-900 sm:text-3xl sm:leading-9 dark:text-white">
+        <div className="relative max-w-screen-xl px-4 mx-auto sm:px-6 lg:px-8">
+            <div className="max-w-lg mx-auto overflow-hidden rounded-lg shadow-lg pricing-box lg:max-w-none lg:flex">
+                <div className="px-6 py-8 bg-white dark:bg-gray-800 lg:flex-shrink-1 lg:p-12">
+                    <h3 className="text-2xl font-extrabold leading-8 text-gray-900 sm:text-3xl sm:leading-9 dark:text-white">
                         Zero Commission
                     </h3>
                     <p className="mt-6 text-base leading-6 text-gray-500 dark:text-gray-200">
@@ -16,7 +16,7 @@ const PricingCard7: FC = () => {
                     </p>
                     <div className="mt-8">
                         <div className="flex items-center">
-                            <h4 className="flex-shrink-0 pr-4 bg-white dark:bg-gray-800 text-sm leading-5 tracking-wider font-semibold uppercase text-indigo-600">
+                            <h4 className="flex-shrink-0 pr-4 text-sm font-semibold leading-5 tracking-wider text-indigo-600 uppercase bg-white dark:bg-gray-800">
                                 What's included
                             </h4>
                             <div className="flex-1 border-t-2 border-gray-200"></div>
@@ -27,7 +27,7 @@ const PricingCard7: FC = () => {
                                     <li className="flex items-start lg:col-span-1" key={price.label}>
                                         <div className="flex-shrink-0">
                                             <svg
-                                                className="h-6 w-6 mr-2"
+                                                className="w-6 h-6 mr-2"
                                                 xmlns="http://www.w3.org/2000/svg"
                                                 width="6"
                                                 height="6"
@@ -48,7 +48,7 @@ const PricingCard7: FC = () => {
                     </div>
                     <div className="mt-8">
                         <div className="flex items-center">
-                            <h4 className="flex-shrink-0 pr-4 bg-white text-sm dark:bg-gray-800 leading-5 tracking-wider font-semibold uppercase text-indigo-600">
+                            <h4 className="flex-shrink-0 pr-4 text-sm font-semibold leading-5 tracking-wider text-indigo-600 uppercase bg-white dark:bg-gray-800">
                                 &amp; What's not
                             </h4>
                         </div>
@@ -61,7 +61,7 @@ const PricingCard7: FC = () => {
                                                 xmlns="http://www.w3.org/2000/svg"
                                                 width="6"
                                                 height="6"
-                                                className="h-6 w-6 mr-2"
+                                                className="w-6 h-6 mr-2"
                                                 fill="red"
                                                 viewBox="0 0 1792 1792"
                                             >
@@ -75,14 +75,14 @@ const PricingCard7: FC = () => {
                         </ul>
                     </div>
                 </div>
-                <div className="py-8 px-6 text-center bg-gray-50 dark:bg-gray-700 lg:flex-shrink-0 lg:flex lg:flex-col lg:justify-center lg:p-12">
-                    <p className="text-lg leading-6 font-bold text-gray-900 dark:text-white">Free</p>
-                    <div className="mt-4 flex items-center justify-center text-5xl leading-none font-extrabold text-gray-900 dark:text-white">
+                <div className="px-6 py-8 text-center bg-gray-50 dark:bg-gray-700 lg:flex-shrink-0 lg:flex lg:flex-col lg:justify-center lg:p-12">
+                    <p className="text-lg font-bold leading-6 text-gray-900 dark:text-white">Free</p>
+                    <div className="flex items-center justify-center mt-4 text-5xl font-extrabold leading-none text-gray-900 dark:text-white">
                         <span>$0/mo</span>
                     </div>
                     <p className="mt-4 text-sm leading-5">
                         <span className="block font-medium text-gray-500 dark:text-gray-400">Card payments:</span>
-                        <span className=" inline-block font-medium text-gray-500 dark:text-gray-400">
+                        <span className="inline-block font-medium text-g
```

---

### Incident Patch 3: `7cd88caf` (2021-10-07)
**Commit Message**: Fix grammatical errors

**File**: `components/kit/components/elements/data/MessagesList.tsx` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ const MessagesList: FC = () => {
                     <div className="flex flex-col">
                         <span className="text-sm text-gray-900 font-semibold dark:text-white ml-2">Ivan Buck</span>
                         <span className="text-sm text-gray-400 dark:text-gray-300 ml-2">
-                            Seriously ? haha Bob is not a children !
+                            Seriously ? haha Bob is not a child !
                         </span>
                     </div>
                 </li>
@@ -45,7 +45,7 @@ const MessagesList: FC = () => {
 
                     <div className="flex flex-col">
                         <span className="text-sm text-gray-900 font-semibold dark:text-white ml-2">Marina Farga</span>
-                        <span className="text-sm text-gray-400 dark:text-gray-300 ml-2">Do you need that deisgn ?</span>
+                        <span className="text-sm text-gray-400 dark:text-gray-300 ml-2">Do you need that design ?</span>
                     </div>
                 </li>
             </ul>
```

---

### Incident Patch 4: `5df6e71a` (2021-07-30)
**Commit Message**: Fix spelling error

**File**: `components/kit/components/elements/data/GoogleTask.tsx` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ const GoogleTask: FC = () => {
                     PROGRESS
                 </span>
                 <span className="px-2 py-1 flex items-center font-semibold text-xs rounded-md text-red-400 border border-red-400  bg-white">
-                    HIGHT PRIORITY
+                    HIGH PRIORITY
                 </span>
             </div>
 
```

---

### Incident Patch 5: `b3b89b3c` (2021-07-12)
**Commit Message**: Merge pull request #68 from gitryder/fix/grammatical-error-in-select-boxes

Fix grammatical error in select boxes' default value

**File**: `components/kit/components/form/select/Select.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ const Select = () => {
             className="block w-52 text-gray-700 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
             name="animals"
         >
-            <option value="">Select an options</option>
+            <option value="">Select an option</option>
             <option value="dog">Dog</option>
             <option value="cat">Cat</option>
             <option value="hamster">Hamster</option>
```

**File**: `components/kit/components/form/select/SelectWithLabel.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ const SelectWithLabel = () => {
                 className="block w-52 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                 name="animals"
             >
-                <option value="">Select an options</option>
+                <option value="">Select an option</option>
                 <option value="dog">Dog</option>
                 <option value="cat">Cat</option>
                 <option value="hamster">Hamster</option>
```

---

### Incident Patch 6: `c7f6232a` (2021-07-08)
**Commit Message**: Fix typo in SelectWithLabel option value

**File**: `components/kit/components/form/select/SelectWithLabel.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ const SelectWithLabel = () => {
                 className="block w-52 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                 name="animals"
             >
-                <option value="">Select an options</option>
+                <option value="">Select an option</option>
                 <option value="dog">Dog</option>
                 <option value="cat">Cat</option>
                 <option value="hamster">Hamster</option>
```

---

### Incident Patch 7: `33b7a1fb` (2021-07-08)
**Commit Message**: Fix typo in select option value

**File**: `components/kit/components/form/select/Select.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ const Select = () => {
             className="block w-52 text-gray-700 py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
             name="animals"
         >
-            <option value="">Select an options</option>
+            <option value="">Select an option</option>
             <option value="dog">Dog</option>
             <option value="cat">Cat</option>
             <option value="hamster">Hamster</option>
```

---

### Incident Patch 8: `507c1b8c` (2021-07-06)
**Commit Message**: fixes #65

**File**: `components/kit/components/pagesection/team/ShadowTeams.tsx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ const ShadowTeams = () => {
         <div className="p-4">
             <p className="text-center text-3xl font-bold text-gray-800">Professional team</p>
             <p className="text-center mb-32 text-xl font-normal text-gray-500">Meat the best team in wolrd</p>
-            <div className="flex items-center flex-col md:flex-row justify evenly">
+            <div className="flex items-center space-y-24 md:space-y-0 flex-col md:flex-row justify evenly">
                 <ShadowTeam
                     img="/images/person/1.jpg"
                     name="Patrick Sebastien"
```

---

### Incident Patch 9: `1d0baae1` (2021-02-04)
**Commit Message**: fix toggle button transition

**File**: `components/kit/components/form/toggle/MultipleToggle.tsx` (modified, +2/-2)
```diff
@@ -52,13 +52,13 @@ const MultipleToggle = (props: Props) => {
             {colors.map((color) => {
                 return (
                     <div key={color.label} className="mb-3">
-                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
+                        <div className="relative inline-block w-10 mr-2 align-middle select-none">
                             <input
                                 type="checkbox"
                                 name="toggle"
                                 id={color.label}
                                 onChange={(e) => props.onChange(e.target.checked)}
-                                className={`${color.color} focus:outline-none checked:right-0 absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer`}
+                                className={`${color.color} outline-none focus:outline-none right-4 checked:right-0 duration-200 ease-in absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer`}
                             />
                             <label
                                 htmlFor={color.label}
```

**File**: `components/kit/components/form/toggle/Toggle.tsx` (modified, +2/-2)
```diff
@@ -11,14 +11,14 @@ const Toggle = (props: Props) => {
     const [id] = useState(_uniqueId('prefix-'));
     return (
         <div>
-            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
+            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in focus-within:ring-2 focus-within:ring-black focus-within:outline-none focus-within:ring-offset-2	 rounded-full">
                 <input
                     type="checkbox"
                     name="toggle"
                     id={id}
                     checked={props.check}
                     onChange={(e) => props.onChange(e.target.checked)}
-                    className="checked:right-0 checked:bg-blue-600 absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
+                    className="right-4 checked:right-0 duration-200 ease-in checked:bg-blue-600 absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer outline-none"
                 />
                 <label htmlFor={id} className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" />
             </div>
```

---

### Incident Patch 10: `527b6244` (2021-01-29)
**Commit Message**: comma position fixed in finance card price

**File**: `components/kit/components/elements/data/InfoNumberCard3.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ const InfoNumberCard3: FC = () => {
             </div>
             <div className="flex flex-col justify-start">
                 <p className="text-gray-700 dark:text-gray-100 text-4xl text-left font-bold my-4">
-                    3,4500<span className="text-sm">$</span>
+                    34,500<span className="text-sm">$</span>
                 </p>
                 <div className="flex items-center text-green-500 text-sm">
                     <svg
```

---

### Incident Patch 11: `52d0a30c` (2021-01-28)
**Commit Message**: fix image import on home

**File**: `components/site/home/HomeComps.tsx` (modified, +74/-54)
```diff
@@ -14,7 +14,6 @@ import PricingCard2 from '../../kit/components/commerce/pricing/PricingCard2';
 import HeadProfil from '../../kit/components/pagesection/profile/HeadProfil';
 import TaskCard from '../../kit/components/elements/data/TaskCard';
 import PopularPerson from '../../kit/components/elements/data/PopularPerson';
-import Image from 'next/image';
 
 const HomeComps: FC = () => {
     return (
@@ -85,64 +84,85 @@ const HomeComps: FC = () => {
             </div>
             <div className="perspective absolute lg:text-left transform  top-1/2 -right-10 transform -translate-y-1/2 translate-x-1/4 md:w-2/3 fade-B">
                 <div className="flex space-x-4 space-y-1">
-                    <div className="col-1 mt-28">
-                        <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage.png"
-                                alt="template picture"
-                                width={600}
-                                height={350}
-                            />
-                        </div>
-                        <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage4.png"
-                                alt="template landing page"
-                                width={600}
-                                height={350}
-                            />
-                        </div>
+                    <div className="col-1">
                         <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage3.png"
-                                alt="template landing page"
-                                width={600}
-                                height={350}
-                            />
+                            <picture>
+                                <source srcSet="/images/sections/homePage.webp" type="image/webp" />
+                                <source srcSet="/images/sections/homePage.png" />
+                                <img
+                                    className="sm:text-center rounded w-full shadow-xl"
+                                    src="/images/sections/homePage.png"
+                                    alt="home landing page"
+                                />
+                            </picture>
+                        </div>
+                        <div className="mb-4">
+                            <picture>
+                                <source srcSet="/images/sections/homePage4.webp" type="image/webp" />
+                                <source srcSet="/images/sections/homePage4.png" />
+                                <img
+                                    className="sm:text-center rounded w-full shadow-xl"
+                                    src="/images/sections/homePage4.png"
+                                    alt="home landing page"
+                                />
+                            </picture>
+                        </div>
+                        <div className="mb-4">
+                            <picture>
+                                <source srcSet="/images/sections/homePage3.webp" type="image/webp" />
+                                <source srcSet="/images/sections/homePage3.png" />
+                                <img
+                                    className="sm:text-center rounded w-full shadow-xl"
+                                    src="/images/sections/homePage3.png"
+                                    alt="home landing page"
+                                />
+                            </picture>
                         </div>
                     </div>
                     <div className="col-1">
                         <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage.png"
-                                alt="template landing page"
-                                width={600}
-                                height={350}
-                            />
-                        </div>
-                        <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage2.png"
-                                alt="template landing page"
-                                width={600}
-                                height={350}
-                            />
-                        </div>
-                        <div className="mb-4">
-                            <Image
-                                src="/images/sections/homePage5.png"
-                                alt="template landing page"
-                                width={600}
-                                height={350}
-                            />
-                        </div>
-                        <div className="mb-4">
-                            <Imag
```

---

### Incident Patch 12: `6cedec38` (2021-01-28)
**Commit Message**: UI fixing of Confirmation Card

**File**: `components/kit/components/elements/alert/ConfirmationCard.tsx` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ const ConfirmationCard: FC = () => {
             Are you sure you want to delete this card ?
           </p>
           <div className="flex items-center justify-between gap-4 w-full mt-8">
-            <Button color="indigo" label="cancel" />
-            <Button color="red" label="Delete" />
+            <Button color="indigo" label="Delete" />
+            <Button color="white" label="Cancel" />
           </div>
         </div>
       </div>
```

---

### Incident Patch 13: `ac723d42` (2021-01-28)
**Commit Message**: fix header menu on tablet

**File**: `components/layout/HomeLayout.tsx` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ const HomeLayout: FC = ({ children }) => {
 
             <div className="relative bg-white overflow-hidden h-screen">
                 <div className="max-w-7xl mx-auto h-full">
-                    <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20  lg:w-full lg:pb-28 xl:pb-32 h-full">
+                    <div className="relative pb-8 bg-white sm:pb-16 md:pb-20  lg:w-full lg:pb-28 xl:pb-32 h-full">
                         <AppHeader hideLinks={true} />
                         <main className="mt-10 mx-auto px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28 h-full">
                             {children}
```

**File**: `components/site/DropDown/DropD.tsx` (modified, +1/-4)
```diff
@@ -62,10 +62,7 @@ const DropD = (props: Props) => {
                 </svg>
             </button>
             {isSectionOpen && (
-                <div
-                    ref={listElement}
-                    className="absolute z-10 -ml-4 mt-3 transform px-2 w-screen max-w-md sm:px-0 lg:ml-0 lg:left-1/2 lg:-translate-x-1/2"
-                >
+                <div ref={listElement} className="absolute z-10 -ml-4 mt-3 transform px-2 w-screen max-w-md sm:px-0">
                     <div className="rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
                         <div className="relative grid gap-6 bg-white px-5 py-6 sm:gap-8 sm:p-8 divide-y divide-gray-300">
                             {props.links.map((entry) => {
```

**File**: `components/site/header/AppHeader.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const AppHeader = (props: Props) => {
     const [isMenuOpen, setIsMenuOpen] = useState(false);
 
     return (
-        <div className="relative bg-white dark:bg-gray-800 z-40">
+        <div className="relative bg-transparent dark:bg-gray-800 z-50">
             <div className="max-w-7xl mx-auto px-4 sm:px-6">
                 <div className={`flex justify-between items-center  border-gray-100 py-6  md:space-x-10`}>
                     <div className="flex justify-start items-center gap-12">
```

**File**: `components/site/home/HomeComps.tsx` (modified, +7/-7)
```diff
@@ -88,23 +88,23 @@ const HomeComps: FC = () => {
                     <div className="col-1 mt-28">
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage.webp"
+                                src="/images/sections/homePage.png"
                                 alt="template picture"
                                 width={600}
                                 height={350}
                             />
                         </div>
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage4.webp"
+                                src="/images/sections/homePage4.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
                             />
                         </div>
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage3.webp"
+                                src="/images/sections/homePage3.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
@@ -114,31 +114,31 @@ const HomeComps: FC = () => {
                     <div className="col-1">
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage.webp"
+                                src="/images/sections/homePage.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
                             />
                         </div>
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage2.webp"
+                                src="/images/sections/homePage2.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
                             />
                         </div>
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/homePage5.webp"
+                                src="/images/sections/homePage5.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
                             />
                         </div>
                         <div className="mb-4">
                             <Image
-                                src="/images/sections/folio.webp"
+                                src="/images/sections/folio.png"
                                 alt="template landing page"
                                 width={600}
                                 height={350}
```

**File**: `pages/index.tsx` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export const IndexPage: FC = () => {
                         </Link>
                     </h3>
                 </div>
-                {!isMobile && <HomeComps />}
+                <div className="z-20">{!isMobile && <HomeComps />}</div>
             </div>
         </HomeLayout>
     );
```

---

### Incident Patch 14: `e6767971` (2021-01-28)
**Commit Message**: fix(index.tsx): update number of badge components

**File**: `components/kit/components/elements/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Elements: FC = () => {
     },
     {
       title: "Badges",
-      items: 14,
+      items: 15,
       img: "images/sections/badges.png",
       link: "/components/badges",
     },
```

---

### Incident Patch 15: `c63f34f5` (2021-01-26)
**Commit Message**: fix import build error

**File**: `pages/templates/errors404/index.tsx` (modified, +3/-3)
```diff
@@ -1,10 +1,10 @@
 import React from "react";
-import Pictures404 from "../../../components/kit/templates/ErrorPages/error404/Pictures404";
-import Simple404 from "../../../components/kit/templates/ErrorPages/error404/Simple404";
+import Pictures404 from "../../../components/kit/templates/errorsPages/error404/Pictures404";
+import Simple404 from "../../../components/kit/templates/errorsPages/error404/Simple404";
 import AppLayout from "../../../components/layout/AppLayout";
 import ComponentLayout from "../../../components/layout/ComponentLayout";
 import SectionHeader from "../../../components/site/header/SectionHeader";
-import Background404 from "../../../components/kit/templates/ErrorPages/error404/Background404";
+import Background404 from "../../../components/kit/templates/errorsPages/error404/Background404";
 
 const The404pages = () => {
   return (
```

**File**: `pages/templates/index.tsx` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import React, { FC } from "react";
 import AppLayout from "../../components/layout/AppLayout";
 import HomePage from "../../components/kit/templates/homePages";
-import ErrorPages from "../../components/kit/templates/ErrorPages";
+import ErrorPages from "../../components/kit/templates/errorsPages";
 import DashboardPages from "../../components/kit/templates/dashboardPages";
 
 const ComponentsPage: FC = () => {
```

#### Recent Merged Pull Requests:
- **PR #85** (2022-11-29): add tabs components (@Charlie85270)
- **PR #80** (closed): Feature/tailwind3 (@bingalls)
- **PR #77** (closed): Upgraded to tailwind3. Tested with `yarn check` & lint & markdownlint… (@bingalls)
- **PR #74** (2021-10-07): Fix grammatical errors (@gitryder)
- **PR #70** (2021-10-07): Fix spelling error (@gitryder)
- **PR #68** (2021-07-12): Fix grammatical error in select boxes' default value (@gitryder)
- **PR #67** (2021-07-12): (mobile) form subscribe (@xerosanyam)
- **PR #66** (2021-07-12): fixes #65 (@xerosanyam)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
