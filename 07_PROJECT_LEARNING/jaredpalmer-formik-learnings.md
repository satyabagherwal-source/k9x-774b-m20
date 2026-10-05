# Forensic Learning Record (Deep Inspection): jaredpalmer/formik

> **Canonical Artifact**: `07_PROJECT_LEARNING/jaredpalmer-formik-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jaredpalmer/formik](https://github.com/jaredpalmer/formik))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:34:22.591Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jaredpalmer/formik`
- **Description**: Build forms in React, without the tears 😭 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 34313 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/formik/src/utils.ts`
```
import clone from 'lodash/clone';
import toPath from 'lodash/toPath';
import * as React from 'react';

// Assertions

/** @private is the value an empty array? */
export const isEmptyArray = (value?: any) =>
  Array.isArray(value) && value.length === 0;

/** @private is the given object a Function? */
export const isFunction = (obj: any): obj is Function =>
  typeof obj === 'function';

/** @private is the given object an Object? */
export const isObject = (obj: any): obj is Object =>
  obj !== null && typeof obj === 'object';

/** @private is the given object an integer? */
export const isInteger = (obj: any): boolean =>
  String(Math.floor(Number(obj))) === obj;

/** @private is the given object a string? */
export const isString = (obj: any): obj is string =>
  Object.prototype.toString.call(obj) === '[object String]';

/** @private is the given object a NaN? */
// eslint-disable-next-line no-self-compare
export const isNaN = (obj: any): boolean => obj !== obj;

/** @private Does a React component have exactly 0 children? */
export const isEmptyChildren = (children: any): boolean =>
  React.Children.count(children) === 0;

/** @private is the given object/value a promise? */
export const isPromise = (value: any): value is PromiseLike<any> =>
  isObject(value) && isFunction(value.then);

/** @private is the given object/value a type of synthetic event? */
export const isInputEvent = (value: any): value is React.SyntheticEvent<any> =>
  value && isObject(value) && isObject(value.target);

/**
 * Same as document.activeElement but wraps in a try-catch block. In IE it is
 * not safe to call document.activeElement if there is nothing focused.
 *
 * The activeElement will be null only if the document or document body is not
 * yet defined.
 *
 * @param {?Document} doc Defaults to current document.
 * @return {Element | null}
 * @see https://github.com/facebook/fbjs/blob/master/packages/fbjs/src/core/dom/getActiveElement.js
 */
export function getActiveElement(doc?: Document): Element | null {
  doc = doc || (typeof document !== 'undefined' ? document : undefined);
  if (typeof doc === 'undefined') {
    return null;
  }
  try {
    return doc.activeElement || doc.body;
  } catch (e) {
    return doc.body;
  }
}

/**
 * Deeply get a value from an object via its path.
 */
export function getIn(
  obj: any,
  key: string | string[],
  def?: any,
  p: number = 0
) {
  const path = toPath(key);
  while (obj && p < path.length) {
    obj = obj[path[p++]];
  }

  // check if path is not in the end
  if (p !== path.length && !obj) {
    return def;
  }

  return obj === undefined ? def : obj;
}

/**
 * Deeply set a value from in object via it's path. If the value at `path`
 * has changed, return a shallow copy of obj with `value` set at `path`.
 * If `value` has not changed, return the original `obj`.
 *
 * Existing objects / arrays along `path` are also shallow copied. Sibling
 * objects along path retain the same internal js reference. Since new
 * objects / arrays are only created along `path`, we can test if anything
 * changed in a nested structure by comparing the object's reference in
 * the old and new object, similar to how russian doll cache invalidation
 * works.
 *
 * In earlier versions of this function, which used cloneDeep, there were
 * issues whereby settings a nested value would mutate the parent
 * instead of creating a new object. `clone` avoids that bug making a
 * shallow copy of the objects along the update path
 * so no object is mutated in place.
 *
 * Before changing this function, please read through the following
 * discussions.
 *
 * @see https://github.com/developit/linkstate
 * @see https://github.com/jaredpalmer/formik/pull/123
 */
export function setIn(obj: any, path: string, value: any): any {
  let res: any = clone(obj); // this keeps inheritance when obj is a class
  let resVal: any = res;
  let i = 0;
  let pathArray = toPath(path);

  for (; i < pathArray.length - 1; i++) {
    const currentPath: string = pathArray[i];
    let currentObj: any = getIn(obj, pathArray.slice(0, i + 1));

    if (currentObj && (isObject(currentObj) || Array.isArray(currentObj))) {
      resVal = resVal[currentPath] = clone(currentObj);
    } else {
      const nextPath: string = pathArray[i + 1];
      resVal = resVal[currentPath] =
        isInteger(nextPath) && Number(nextPath) >= 0 ? [] : {};
    }
  }

  // Return original object if new value is the same as current
  if ((i === 0 ? obj : resVal)[pathArray[i]] === value) {
    return obj;
  }

  if (value === undefined) {
    delete resVal[pathArray[i]];
  } else {
    resVal[pathArray[i]] = value;
  }

  // If the path array has a single element, the loop did not run.
  // Deleting on `resVal` had no effect in this scenario, so we delete on the result instead.
  if (i === 0 && value === undefined) {
    delete res[pathArray[i]];
  }

  return res;
}

/**
 * Recursively a set the same value for all keys and arrays nested object, cloning
 * @param object
 * @param value
 * @param visited
 * @param response
 */
export function setNestedObjectValues<T>(
  object: any,
  value: any,
  visited: any = new WeakMap(),
  response: any = {}
): T {
  for (let k of Object.keys(object)) {
    const val = object[k];
    if (isObject(val)) {
      if (!visited.get(val)) {
        visited.set(val, true);
        // In order to keep array values consistent for both dot path  and
        // bracket syntax, we need to check if this is an array so that
        // this will output  { friends: [true] } and not { friends: { "0": true } }
        response[k] = Array.isArray(val) ? [] : {};
        setNestedObjectValues(val, value, visited, response[k]);
      }
    } else {
      response[k] = value;
    }
  }

  return response;
}

```

### Core Architecture Module: `website/src/components/utils/throttle.ts`
```
export const throttle = (func: any, limit: any) => {
  let inThrottle: any;
  return function () {
    const args = arguments;
    // @ts-ignore
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

```

### Core Architecture Module: `website/src/lib/blog/mdxUtils.ts`
```
import fs from 'fs';
import path from 'path';

// POSTS_PATH is useful when you want to get the path to a specific file
export const POSTS_PATH = path.join(process.cwd(), 'src', 'blog');

// postFilePaths is the list of all mdx files inside the POSTS_PATH directory
export const postFilePaths = fs
  .readdirSync(POSTS_PATH)
  // Only include md(x) files
  .filter(path => /\.mdx?$/.test(path));

```

### Core Architecture Module: `website/src/lib/fs-utils.tsx`
```
import fs from 'fs';
import { promisify } from 'util';

export const readFile = promisify(fs.readFile);
export const writeFile = promisify(fs.writeFile);

```

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  extends: [
    'react-app',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
};

```

### Core Architecture Module: `app/next-env.d.ts`
```
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.

```

### Core Architecture Module: `app/pages/_app.js`
```
import React from 'react';
import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

export default MyApp;

```

### Core Architecture Module: `app/pages/basic.js`
```
import React from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const Basic = () => {
  const renderCount = React.useRef(0);
  return (
    <div>
      <h1>Sign Up</h1>
      <Formik
        initialValues={{
          firstName: '',
          lastName: '',
          email: '',
          favorite: '',
          checked: [],
          picked: '',
        }}
        validationSchema={Yup.object().shape({
          email: Yup.string()
            .email('Invalid email address')
            .required('Required'),
          firstName: Yup.string().required('Required'),
          lastName: Yup.string()
            .min(2, 'Must be longer than 2 characters')
            .max(20, 'Nice try, nobody has a last name that long')
            .required('Required'),
        })}
        onSubmit={async values => {
          await new Promise(r => setTimeout(r, 500));
          alert(JSON.stringify(values, null, 2));
        }}
      >
        <Form>
          <Field name="firstName" placeholder="Jane" />
          <ErrorMessage name="firstName" component="p" />

          <Field name="lastName" placeholder="Doe" />
          <ErrorMessage name="lastName" component="p" />

          <Field
            id="email"
            name="email"
            placeholder="jane@acme.com"
            type="email"
          />
          <ErrorMessage name="email" component="p" />

          <label>
            <Field type="checkbox" name="toggle" />
            <span style={{ marginLeft: 3 }}>Toggle</span>
          </label>

          <div id="checkbox-group">Checkbox Group </div>
          <div role="group" aria-labelledby="checkbox-group">
            <label>
              <Field type="checkbox" name="checked" value="One" />
              One
            </label>
            <label>
              <Field type="checkbox" name="checked" value="Two" />
              Two
            </label>
            <label>
              <Field type="checkbox" name="checked" value="Three" />
              Three
            </label>
          </div>
          <div id="my-radio-group">Picked</div>
          <div role="group" aria-labelledby="my-radio-group">
            <label>
              <Field type="radio" name="picked" value="One" />
              One
            </label>
            <label>
              <Field type="radio" name="picked" value="Two" />
              Two
            </label>
          </div>
          <button type="submit">Submit</button>
          <div id="renderCounter">{renderCount.current++}</div>
        </Form>
      </Formik>
    </div>
  );
};

export default Basic;

```

### Core Architecture Module: `app/pages/index.tsx`
```
import React from 'react';
import Link from 'next/link';

function Home() {
  return (
    <main>
      <h1>Formik Examples and Fixtures</h1>
      <ul>
        <li>
          <Link href="/basic">Basic</Link>
        </li>
        <li>
          <Link href="/async-submission">Async Submission</Link>
        </li>
      </ul>
      <style jsx>{`
        main {
          max-width: 500px;
          margin: 2rem auto;
          padding-bottom: 20rem;
        }
        a {
          display: block;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          color: rgb(68, 122, 221);
          text-decoration: underline;
          font-size: 20px;
        }
        ul {
          margin: 0;
          padding: 0;
        }
        li {
          margin-left: 1rem;
        }
      `}</style>
    </main>
  );
}

export default Home;

```

### Core Architecture Module: `app/pages/sign-in.js`
```
import React, { useEffect, useState } from 'react';
import { ErrorMessage, Field, Form, FormikProvider, useFormik } from 'formik';
import * as Yup from 'yup';
import { useRouter } from 'next/router';

const SignIn = () => {
  const router = useRouter();
  const [errorLog, setErrorLog] = useState([]);

  const formik = useFormik({
    validateOnMount: router.query.validateOnMount === 'true',
    validateOnBlur: router.query.validateOnBlur !== 'false',
    validateOnChange: router.query.validateOnChange !== 'false',
    initialValues: { username: '', password: '' },
    validationSchema: Yup.object().shape({
      username: Yup.string().required('Required'),
      password: Yup.string().required('Required'),
    }),
    onSubmit: async values => {
      await new Promise(r => setTimeout(r, 500));
      alert(JSON.stringify(values, null, 2));
    },
  });

  useEffect(() => {
    if (formik.errors.username && formik.touched.username) {
      setErrorLog(logs => [
        ...logs,
        {
          name: 'username',
          value: formik.values.username,
          error: formik.errors.username,
        },
      ]);
    }

    if (formik.errors.password && formik.touched.password) {
      setErrorLog(logs => [
        ...logs,
        {
          name: 'password',
          value: formik.values.password,
          error: formik.errors.password,
        },
      ]);
    }
  }, [
    formik.values.username,
    formik.errors.username,
    formik.touched.username,
    formik.values.password,
    formik.errors.password,
    formik.touched.password,
  ]);

  return (
    <div>
      <h1>Sign In</h1>

      <FormikProvider value={formik}>
        <Form>
          <div>
            <Field name="username" placeholder="Username" />
            <ErrorMessage name="username" component="p" />
          </div>

          <div>
            <Field name="password" placeholder="Password" type="password" />
            <ErrorMessage name="password" component="p" />
          </div>

          <button type="submit" disabled={!formik.isValid}>
            Submit
          </button>

          <button
            type="reset"
            onClick={() => {
              setErrorLog([]);
            }}
          >
            Reset
          </button>

          <pre id="error-log">{JSON.stringify(errorLog, null, 2)}</pre>
        </Form>
      </FormikProvider>
    </div>
  );
};

export default SignIn;

```

### Core Architecture Module: `examples/AsyncValidation.js`
```
import React from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import { Debug } from './Debug';

// Async Validation
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const validate = values => {
  return sleep(300).then(() => {
    const errors = {};

    if (['admin', 'null', 'god'].includes(values.username)) {
      errors.username = 'Nice try';
    }

    if (!values.username) {
      errors.username = 'Required';
    }

    if (Object.keys(errors).length) {
      throw errors;
    }
  });
};

const Username = () => (
  <div>
    <h1>Pick a username</h1>
    <Formik
      initialValues={{
        username: '',
      }}
      validate={validate}
      onSubmit={values => {
        sleep(500).then(() => {
          alert(JSON.stringify(values, null, 2));
        });
      }}
      render={({ errors, touched }) => (
        <Form>
          <label htmlFor="username">Username</label>
          <Field name="username" type="text" />
          <ErrorMessage name="username" />
          <button type="submit">Submit</button>
          <Debug />
        </Form>
      )}
    />
  </div>
);

export default Username;

```

### Core Architecture Module: `examples/CombinedValidations.js`
```
import React from 'react';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { Debug } from './Debug';

const Schema = Yup.object().shape({
  email: Yup.string().required('This field is required'),
});

// Async Validation
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const validate = values =>
  sleep(300).then(() => {
    return {
      zip: 'This field is required',
    };
  });

const isRequired = message => value => (!!value ? undefined : message);

const FieldLevelValidation = () => (
  <div>
    <h1>Pick a username</h1>
    <Formik
      validationSchema={Schema}
      validate={validate}
      initialValues={{
        username: '',
        email: '',
        zip: '',
      }}
      onSubmit={values => {
        sleep(500).then(() => {
          alert(JSON.stringify(values, null, 2));
        });
      }}
      render={({
        errors,
        touched,
        setFieldValue,
        setFieldTouched,
        validateField,
        validateForm,
      }) => (
        <Form>
          <label htmlFor="username">Username</label>
          <div>
            <Field
              name="username"
              validate={isRequired('This field is required')}
              type="text"
              placeholder="username"
            />
            <ErrorMessage name="username" />
          </div>
          <br />
          <div>
            <Field
              name="email"
              validate={isRequired('This field is required')}
              type="text"
              placeholder="email"
            />
            <ErrorMessage name="email" />
          </div>
          <br />
          <div>
            <Field
              name="zip"
              validate={isRequired('This field is required')}
              type="text"
              placeholder="zip"
            />
            <ErrorMessage name="zip" />
          </div>
          <br />
          <button type="submit">Submit</button>
          <Debug />
        </Form>
      )}
    />
  </div>
);

export default FieldLevelValidation;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4053** (2025-11-10): **Version Packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## formik@2.4.9  ### Patch Changes  -   [#4051](https://github.com/jaredpalmer/formik/pull/4051) [`8f9d04d`](https://github.com/jaredpalmer/formik/commit/8f9d04d206146ca941facf37ddd9ddb459c459dc) Thanks [@Moumouls](https://github.com/Moumouls)! - fix: jsx ref for react 19  ## formik-native@2.1.32  ### Patch Changes  -   Updated dependencies \[[`8f9d04d`](https://github.com/jaredpalmer/formik/commit/8f9d04d206146ca941facf37ddd9ddb459c459dc)]:     -   formik@2.4.9 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #IF4g37wtU3VlGo+xmBaNnWdreLps1Gayu7bThl2YG6k=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9mb3JtaWsvZm9ybWlrLWRvY3MvQ3VHbW9zcFBHTnI5ZlV2VFlmdkF3NkdyMWVoSCIsInByZXZpZXdVcmwiOiJmb3JtaWstZG9jcy1naXQtY2hhbmdlc2V0LXJlbGVhc2UtbWFpbi1mb3JtaWsudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJmb3JtaWstZG9jcy1naXQtY2hhbmdlc2V0LXJlbGVhc2UtbWFpbi1mb3JtaWsudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/formik/formik-docs/CuGmospPGNr9fUvTYfvAw6Gr1
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4053/builds/651470) or the icon next to each commit SHA.
  > thanks @jaredpalmer !

- **Issue #4051** (2025-11-10): **fix: jsx ref for react 19**
  *Symptoms*: https://github.com/jaredpalmer/formik/issues/4052
  **Post-Mortem & Fix Analysis**:
  > @Moumouls is attempting to deploy a commit to the **Formik** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=Formik&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22c98cb002b7026b7926064b86f7ef18f91d812a28%22%7D%2C%22id%22%3A%22Qmcdi7oWhgRhsSJ6sDaNKTgoLeLvSUav8szzZJn3b9G6ut%22%2C%22org%22%3A%22jaredpalmer%22%2C%22prId%22%3A4051%2C%22repo%22%3A%22formik%22%7D).  
  > ###  🦋  Changeset detected  Latest commit: 21b96b610f8f7b5e0be02504cf45b972e82c350e  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 2 packages</summary>    | Name          | Type  | | ------------- | ----- | | formik        | Patch | | formik-native | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/Moumouls/formik/new/moumouls/fix-jsx-ref-react-19?filename=.changeset/cuddly-pens-promise.md&value=---%0A%22formik%22%3A%20patch%0A---%0A%0Afix%3A%20jsx%20ref%20for%20react%2019%0A)  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4051/builds/651221) or the icon next to each commit SHA.

- **Issue #4046** (2025-11-07): **Replace Google Fonts with system fonts to fix build timeout**
  *Symptoms*: Next.js build was failing with `ETIMEDOUT` errors when fetching Inter font from Google Fonts, particularly in CI/CD environments with restricted network access.  ## Changes  - Removed `next/font/google` imports from all pages and components - Replaced `inter.className` with Tailwind's `font-sans` utility  ## Implementation  **Before:** ```tsx import { Inter } from 'next/font/google';  const inter = Inter({ subsets: ['latin'] });  export default function PostPage() {   return <div className={inter.className}>...</div> } ```  **After:** ```tsx export default function PostPage() {   return <div className="font-sans">...</div> } ```  Tailwind's `font-sans` uses native system fonts (ui-sans-serif, system-ui, -apple-system, etc.), eliminating the network dependency while maintaining visual consistency.  ## Files Modified - `website/src/pages/blog/[slug].tsx` - `website/src/pages/blog/index.tsx`   - `website/src/pages/index.tsx` - `website/src/pages/users.tsx` - `website/src/pages/docs/[...slug].tsx` - `website/src/components/LayoutDocs.tsx`  <!-- START COPILOT CODING AGENT SUFFIX -->    <details>  <summary>Original prompt</summary>  > 11:53:30  >     at emitErrorEvent (node:_http_client:107:11) > 11:53:30  >     at TLSSocket.socketErrorListener (node:_http_client:574:5) > 11:53:30  >     at TLSSocket.emit (node:events:519:28) > 11:53:30  >     at TLSSocket.emit (node:domain:489:12) > 11:53:30  >     at emitErrorNT (node:internal/streams/destroy:170:8) > 11:53:30  >     at emitError
  **Post-Mortem & Fix Analysis**:
  > ###  ⚠️  No Changeset found  Latest commit: 41c17fb6722617ebcb0ae93156513701ebf6d5ce  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/jaredpalmer/formik/new/copilot/fix-next-font-error?filename=.changeset/slow-parents-look.md&value=---%0A%22fdocs3%22%3A%20patch%0A---%0A%0A%5BWIP%5D%20Fix%20error%20fetching%20Inter%20font%20from%20Google%20Fonts%0A)  
  > [vc]: #Ox9CLEzEh7YJIILNZ9DwxzPBGs+ma40fNaD52HvM2+U=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9mb3JtaWsvZm9ybWlrLWRvY3MvSEdreUo4TXRkdU5Hcm12TlBCSjNkVmg2NktURCIsInByZXZpZXdVcmwiOiJmb3JtaWstZG9jcy1naXQtY29waWxvdC1maXgtbmV4dC1mb250LWVycm9yLWZvcm1pay52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImZvcm1pay1kb2NzLWdpdC1jb3BpbG90LWZpeC1uZXh0LWZvbnQtZXJyb3ItZm9ybWlrLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6IndlYnNpdGUifV19 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/formik/formik-docs/HGkyJ8MtduNGr
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4046/builds/651130) or the icon next to each commit SHA.

- **Issue #4045** (2025-11-07): **Version Packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to main, this PR will be updated.   # Releases ## formik@2.4.8  ### Patch Changes  -   [#4042](https://github.com/jaredpalmer/formik/pull/4042) [`1de45de`](https://github.com/jaredpalmer/formik/commit/1de45decf8fd70c038fca88dc1a6543aac269553) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Replace JSX.IntrinsicElements with React.JSX.IntrinsicElements for React 19 compatibility. The global JSX namespace was removed in React 19, so we now use React.JSX.IntrinsicElements instead.  ## formik-native@2.1.31  ### Patch Changes  -   Updated dependencies \[[`1de45de`](https://github.com/jaredpalmer/formik/commit/1de45decf8fd70c038fca88dc1a6543aac269553)]:     -   formik@2.4.8 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #bF7ZFf8T0QunqtkYc/oJaBt2kw7vSTa5ZfljIR/SD2g=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9mb3JtaWsvZm9ybWlrLWRvY3MvMnVQekpyS1FzUVFtaWZDVGo0RHZGbmo0a0ZrUiIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiRkFJTEVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSJ9XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Error](https://vercel.com/static/status/error.svg) [Error](https://vercel.com/formik/formik-docs/2uPzJrKQsQQmifCTj4DvFnj4kFkR) |  |  | Nov 7, 2025 4:53pm |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4045/builds/651123) or the icon next to each commit SHA.

- **Issue #4044** (2025-11-07): **Upgrade Turborepo from v1.9.9 to v2.6.0**
  *Symptoms*: Migrates to Turborepo v2.6.0 to leverage improved caching, performance optimizations, and modern configuration schema.  ## Changes  - **package.json**: Add required `packageManager` field, update turbo to `^2.6.0` - **turbo.json**: Rename `pipeline` → `tasks` (v2 breaking change), update schema URL - **.gitignore**: Exclude `.turbo` cache directory  ## Migration Notes  Turborepo v2 introduces strict environment variable handling by default. Current configuration requires no `env`/`globalEnv` declarations as tasks don't rely on environment-specific variables. If builds fail in CI due to missing env vars, add them to the respective task definitions in `turbo.json`.  Verified with official `@turbo/codemod migrate` tool - no additional migrations required.  > [!WARNING] > > <details> > <summary>Firewall rules blocked me from connecting to one or more addresses (expand for details)</summary> > > #### I tried to connect to the following addresses, but was blocked by firewall rules: > > - `fonts.googleapis.com` >   - Triggering command: `/usr/local/bin/node /home/REDACTED/work/formik/formik/website/node_modules/.bin/next build` (dns block) > > If you need me to access, download, or install something from one of these locations, you can either: > > - Configure [Actions setup steps](https://gh.io/copilot/actions-setup-steps) to set up my environment, which run before the firewall is enabled > - Add the appropriate URLs or hosts to the custom allowlist in this repository's [Copilot cod
  **Post-Mortem & Fix Analysis**:
  > ###  ⚠️  No Changeset found  Latest commit: c8e5527ff4c1f2ab9a876f8df71dd24b443f7efe  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/jaredpalmer/formik/new/copilot/upgrade-to-latest-turborepo?filename=.changeset/cyan-yaks-pump.md&value=---%0A%0A---%0A%0A%5BWIP%5D%20Update%20to%20the%20latest%20version%20of%20turborepo%0A)  
  > [vc]: #3UchHLS7k2VMHmjPEahlkIa3s1+jVc4mh4Cw3F3szfw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsInJvb3REaXJlY3RvcnkiOiJ3ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2Zvcm1pay9mb3JtaWstZG9jcy9GaGR5ZDkzZ3c3SDdZR1pwaUhnSENuM1FRUnpDIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Error](https://vercel.com/static/status/error.svg) [Error](https://vercel.com/formik/formik-docs/Fhdyd93gw7H7YGZpiHgHCn3QQRzC) |  |  | Nov 7, 2025 4:41pm |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4044/builds/651120) or the icon next to each commit SHA.

- **Issue #4043** (2025-11-07): **Upgrade changesets/action to v1.5.3 and npm packages**
  *Symptoms*: Release workflow failing with `Unable to resolve action 'changesets/action@1.4.8', unable to find version '1.4.8'`. Version 1.4.8 doesn't exist.  ## Changes  - **GitHub Action**: `changesets/action@1.4.8` → `changesets/action@v1.5.3` - **NPM packages**:   - `@changesets/cli`: `^2.10.3` → `^2.29.7`   - `@changesets/changelog-github`: `^0.2.7` → `^0.5.1`  All changes are version bumps to latest stable releases. No API or behavior changes.  > [!WARNING] > > <details> > <summary>Firewall rules blocked me from connecting to one or more addresses (expand for details)</summary> > > #### I tried to connect to the following addresses, but was blocked by firewall rules: > > - `fonts.googleapis.com` >   - Triggering command: `/usr/local/bin/node /home/REDACTED/work/formik/formik/website/node_modules/.bin/next build` (dns block) > > If you need me to access, download, or install something from one of these locations, you can either: > > - Configure [Actions setup steps](https://gh.io/copilot/actions-setup-steps) to set up my environment, which run before the firewall is enabled > - Add the appropriate URLs or hosts to the custom allowlist in this repository's [Copilot coding agent settings](https://github.com/jaredpalmer/formik/settings/copilot/coding_agent) (admins only) > > </details>  <!-- START COPILOT CODING AGENT SUFFIX -->    <details>  <summary>Original prompt</summary>  > Look at last failed action run for Release workflow. It gave this error: >  >  > Error: Unable to resolve ac
  **Post-Mortem & Fix Analysis**:
  > ###  ⚠️  No Changeset found  Latest commit: 81e87da2ae8cbb0fbb49c1d0d99ee25f81a9caa5  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/jaredpalmer/formik/new/copilot/update-changesets-package?filename=.changeset/stale-paws-count.md&value=---%0A%0A---%0A%0AUpgrade%20changesets%2Faction%20to%20v1.5.3%20and%20npm%20packages%0A)  
  > [vc]: #Jk5S2isUxl64vQNGqpgq+pfRjPclr3iFQbr0ixSrbQg=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsInJvb3REaXJlY3RvcnkiOiJ3ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2Zvcm1pay9mb3JtaWstZG9jcy81b2RVODZmQmNlSmtvdzNtampGRDIyaUZBVmlZIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Error](https://vercel.com/static/status/error.svg) [Error](https://vercel.com/formik/formik-docs/5odU86fBceJkow3mjjFD22iFAViY) |  |  | Nov 7, 2025 4:46pm |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4043/builds/651121) or the icon next to each commit SHA.

- **Issue #4042** (2025-11-07): **Add changeset for React 19 compatibility (PR #4012)**
  *Symptoms*: Creates a changeset file for the React 19 support changes merged in PR #4012, which replaced `JSX.IntrinsicElements` with `React.JSX.IntrinsicElements` to support React 19's removal of the global JSX namespace.  ## Changes - Added `.changeset/react-19-support.md` documenting the type definition updates - Marked as `patch` version bump (compatibility fix maintaining backward compatibility)  This changeset will be consumed by `@changesets/cli` during the next release to generate changelog entries and bump package versions.  <!-- START COPILOT CODING AGENT SUFFIX -->    <details>  <summary>Original prompt</summary>  > Run / draft changeset fir the last PR i just merged to main for React 19 support   </details>    <!-- START COPILOT CODING AGENT TIPS --> ---  ✨ Let Copilot coding agent [set things up for you](https://github.com/jaredpalmer/formik/issues/new?title=✨+Set+up+Copilot+instructions&body=Configure%20instructions%20for%20this%20repository%20as%20documented%20in%20%5BBest%20practices%20for%20Copilot%20coding%20agent%20in%20your%20repository%5D%28https://gh.io/copilot-coding-agent-tips%29%2E%0A%0A%3COnboard%20this%20repo%3E&assignees=copilot) — coding agent works faster and does higher quality work when set up for your repo. 
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: c6bba2739f90d77260c22b94546571792bf8ed2d  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 2 packages</summary>    | Name          | Type  | | ------------- | ----- | | formik        | Patch | | formik-native | Patch |  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/jaredpalmer/formik/new/copilot/draft-changeset-react-19?filename=.changeset/gentle-lemons-destroy.md&value=---%0A%0A---%0A%0A%5BWIP%5D%20Run%20draft%20changeset%20for%20React%2019%20support%0A)  
  > [vc]: #ATrN/nERFnAChd2ySXDm9UlDthJPIMrF/pWZBM705Hw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsInJvb3REaXJlY3RvcnkiOiJ3ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2Zvcm1pay9mb3JtaWstZG9jcy9CQ1RYUDVLM0NRQzFmWGZad1lHekZRREM4QzVaIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | [formik-docs](https://vercel.com/formik/formik-docs) | ![Error](https://vercel.com/static/status/error.svg) [Error](https://vercel.com/formik/formik-docs/BCTXP5K3CQC1fXfZwYGzFQDC8C5Z) |  |  | Nov 7, 2025 4:06pm |  
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4042/builds/651110) or the icon next to each commit SHA.

- **Issue #4030** (2025-04-28): **Updated code older react version to newer version syntax**
  *Symptoms*: Root.render method was older updated to newer react syntax
  **Post-Mortem & Fix Analysis**:
  > ###  ⚠️  No Changeset found  Latest commit: 2dbb674e823681982a878b96cc12b68aa7b362e6  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/Aswinprasanth97/formik/new/patch-1?filename=.changeset/cyan-dancers-rhyme.md&value=---%0A%0A---%0A%0AUpdated%20code%20older%20react%20version%20to%20newer%20version%20syntax%0A)  
  > [vc]: #JYn3IZvNh5DXfUkVDcjWQcbQjHvLaAxbz1PKEZG6Sng=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJmb3JtaWstZG9jcyIsInJvb3REaXJlY3RvcnkiOiJ3ZWJzaXRlIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2Zvcm1pay9mb3JtaWstZG9jcy9CNzVhSGl5VEQzNEpGemhka0RDQ3U0cTZkU3BZIiwicHJldmlld1VybCI6ImZvcm1pay1kb2NzLWdpdC1mb3JrLWFzd2lucHJhc2FudGg5Ny1wYXRjaC0xLWZvcm1pay52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IklHTk9SRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19XX0= **The latest updates on your projects**. Learn more about [Vercel for Git ↗︎](https://vercel.link/github-learn-more)   <details><summary>1 Skipped Deployment</summary>  | Name | Status | Preview | Comments | Updated (UTC) | | :--- | :----- | :------ | :------- | :------ | | **formik-docs** | ⬜️ Ignored ([Inspect](https://vercel.com/formik/formik-docs/B75aHiyTD34JFzhdkDCCu4q6dSpY)) | [Visit Preview](https://formik-docs-git-fork-aswinprasanth97-patch-1-formik.vercel.app) |
  > This pull request is automatically built and testable in [CodeSandbox](https://codesandbox.io).    To see build info of the built libraries, click [here](https://ci.codesandbox.io/status/jaredpalmer/formik/pr/4030/builds/599937) or the icon next to each commit SHA.

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

### Incident Patch 1: `8f9d04d2` (2025-11-10)
**Commit Message**: fix: jsx ref for react 19 (#4051)

https://github.com/jaredpalmer/formik/issues/4052

**File**: `.changeset/light-phones-remain.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"formik": patch
+---
+
+fix: jsx ref for react 19
```

**File**: `packages/formik/src/types.tsx` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ export interface SharedRenderProps<T> {
   /**
    * Field component to render. Can either be a string like 'select' or a component.
    */
-  component?: keyof JSX.IntrinsicElements | React.ComponentType<T | void>;
+  component?: keyof React.JSX.IntrinsicElements | React.ComponentType<T | void>;
 
   /**
    * Render prop (works like React router's <Route render={props =>} />)
```

---

### Incident Patch 2: `0e0cf9ea` (2024-10-09)
**Commit Message**: Fix: Render children in MySelect component to display options (#3998)

The original example did not render the **children** prop, which resulted in the **select** element not displaying the options passed as children. This PR updates the **MySelect** component to properly handle the **children** prop and render the options inside the dropdown.

### Changes Made
Updated MySelect component to include the children prop inside the select element.
This ensures that the options passed as children (e.g., <option> tags) are correctly displayed in the dropdown list.

### Issue Addressed
Incorrect example in the documentation where options passed to the MySelect component were not being rendered.

### Testing
Verified that the options now render correctly in the MySelect component by testing it with the provided example from the tutorial.

### Additional Notes
This PR only fixes the example in the docs and does not introduce any breaking changes.

**File**: `docs/tutorial.md` (modified, +2/-1)
```diff
@@ -849,12 +849,13 @@ const MyCheckbox = ({ children, ...props }) => {
   );
 };
 
-const MySelect = ({ label, ...props }) => {
+const MySelect = ({children, label, ...props }) => {
   const [field, meta] = useField(props);
   return (
     <div>
       <label htmlFor={props.id || props.name}>{label}</label>
       <select {...field} {...props} />
+      {children}
       {meta.touched && meta.error ? (
         <div className="error">{meta.error}</div>
       ) : null}
```

---

### Incident Patch 3: `0e617dbf` (2024-08-29)
**Commit Message**: Typo_Fixed_in_useField.md (#3978)

This Pull request fixes a typing error that was present in the /docs/api/useField.md .

**File**: `docs/api/useField.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ id: useField
 title: useField()
 ---
 
-`useField` is a custom React hook that will automagically help you hook up inputs to Formik. You can and should use it to build your own custom input primitives. There are 2 ways to use it.
+`useField` is a React hook used to thread Formik behaviors into arbitrary field components. It provides the greatest amount of flexibility for scenarios where `Field` is inappropriate. There are two ways to use it.
 
 ## Example
 
```

---

### Incident Patch 4: `f57ca9bc` (2024-04-10)
**Commit Message**: Fix #3948 - Changing state was also causing change of initial value (#3949)

Resolves Issue #3948

This addresses the problem of the dirty field not updating when the value of a nested object changes. The root cause of this issue is that the `initialValues` coming from props were directly assigned to the `useRef`, which did not perform a deep copy. Without a deep copy, it was modifying the original `initialValues` props along with the current state. Consequently, when comparing them for equality, the result was true

**File**: `.changeset/empty-vans-bathe.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'formik': patch
+---
+
+Changing the state inside formik was changing reference of initialValues provided via props, deep cloning the initialvalues will fix it.
```

**File**: `packages/formik/src/Formik.tsx` (modified, +5/-4)
```diff
@@ -1,5 +1,6 @@
 import deepmerge from 'deepmerge';
 import isPlainObject from 'lodash/isPlainObject';
+import cloneDeep from 'lodash/cloneDeep';
 import * as React from 'react';
 import isEqual from 'react-fast-compare';
 import invariant from 'tiny-warning';
@@ -173,10 +174,10 @@ export function useFormik<Values extends FormikValues = FormikValues>({
 
   const [, setIteration] = React.useState(0);
   const stateRef = React.useRef<FormikState<Values>>({
-    values: props.initialValues,
-    errors: props.initialErrors || emptyErrors,
-    touched: props.initialTouched || emptyTouched,
-    status: props.initialStatus,
+    values: cloneDeep(props.initialValues),
+    errors: cloneDeep(props.initialErrors) || emptyErrors,
+    touched: cloneDeep(props.initialTouched) || emptyTouched,
+    status: cloneDeep(props.initialStatus),
     isSubmitting: false,
     isValidating: false,
     submitCount: 0,
```

**File**: `packages/formik/test/Formik.test.tsx` (modified, +44/-0)
```diff
@@ -61,6 +61,20 @@ const InitialValues = {
   age: 30,
 };
 
+const InitialValuesWithNestedObject = {
+  content: {
+    items: [
+      {
+        cards: [
+          {
+            desc: 'Initial Desc',
+          },
+        ],
+      },
+    ],
+  },
+};
+
 function renderFormik<V extends FormikValues = Values>(
   props?: Partial<FormikConfig<V>>
 ) {
@@ -1454,4 +1468,34 @@ describe('<Formik>', () => {
 
     expect(innerRef.current).toEqual(getProps());
   });
+
+  it('should not modify original initialValues object', () => {
+    render(
+      <Formik initialValues={InitialValuesWithNestedObject} onSubmit={noop}>
+        {formikProps => (
+          <input
+            data-testid="desc-input"
+            value={formikProps.values.content.items[0].cards[0].desc}
+            onChange={e => {
+              const copy = { ...formikProps.values.content };
+              copy.items[0].cards[0].desc = e.target.value;
+              formikProps.setValues({
+                ...formikProps.values,
+                content: copy,
+              });
+            }}
+          />
+        )}
+      </Formik>
+    );
+    const input = screen.getByTestId('desc-input');
+
+    fireEvent.change(input, {
+      target: {
+        value: 'New Value',
+      },
+    });
+
+    expect(InitialValuesWithNestedObject.content.items[0].cards[0].desc).toEqual('Initial Desc');
+  });
 });
```

---

### Incident Patch 5: `c6ceb654` (2024-04-10)
**Commit Message**: Fix grammatical error in field.md (#3928)

**File**: `docs/api/field.md` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ Either a React component or the name of an HTML element to render. That is, one
 - A valid HTML element name
 - A custom React component
 
-Custom React components will be passed `onChange`, `onBlur`, `name`, and `value` plus any other props passed to directly to `<Field>`.
+Custom React components will be passed `onChange`, `onBlur`, `name`, and `value` plus any other props passed directly to `<Field>`.
 
 Default is `'input'` (so an `<input>` is rendered by default)
 
```

---

### Incident Patch 6: `ba15818e` (2024-04-10)
**Commit Message**: Fix broken code example in FastField API docs + update CONTRIBUTING.md `master` references to `main` (#3958)

Title pretty much summarises it.

**File**: `.github/CONTRIBUTING.md` (modified, +3/-3)
```diff
@@ -69,8 +69,8 @@ git remote add upstream https://github.com/formik/formik.git
 3. Synchronize your local `next` branch with the upstream one:
 
 ```sh
-git checkout master
-git pull upstream master
+git checkout main
+git pull upstream main
 ```
 
 4. Install the dependencies with [yarn](https://yarnpkg.com) (npm isn't supported):
@@ -122,7 +122,7 @@ the results. If any of them fail, refer to [Checks and how to fix them](#checks-
 
 Make sure the following is true:
 
-- The branch is targeted at `master` for ongoing development. We do our best to keep `master` in good shape, with all tests passing. Code that lands in `master` must be compatible with the latest stable release. It may contain additional features, but no breaking changes. We should be able to release a new minor version from the tip of `master` at any time.
+- The branch is targeted at `main` for ongoing development. We do our best to keep `main` in good shape, with all tests passing. Code that lands in `main` must be compatible with the latest stable release. It may contain additional features, but no breaking changes. We should be able to release a new minor version from the tip of `main` at any time.
 - If a feature is being added:
   - If the result was already achievable with the library, explain why this feature needs to be added.
   - If this is a common use case, consider adding an example to the documentation.
```

**File**: `docs/api/fastfield.md` (modified, +6/-5)
```diff
@@ -57,7 +57,8 @@ const Basic = () => (
           alert(JSON.stringify(values, null, 2));
         }, 500);
       }}
-      render={formikProps => (
+    >
+      {formikProps => (
         <Form>
           {/** This <FastField> only updates for changes made to
            values.firstName, touched.firstName, errors.firstName */}
@@ -66,8 +67,8 @@ const Basic = () => (
 
           {/** Updates for all changes because it's from the
            top-level formikProps which get all updates */}
-          {form.touched.firstName && form.errors.firstName && (
-            <div>{form.errors.firstName}</div>
+          {formikProps.touched.firstName && formikProps.errors.firstName && (
+            <div>{formikProps.errors.firstName}</div>
           )}
 
           <label htmlFor="middleInitial">Middle Initial</label>
@@ -105,7 +106,7 @@ const Basic = () => (
            and all changes by all <Field>s and <FastField>s */}
           <label htmlFor="lastName">LastName</label>
           <Field name="lastName" placeholder="Baby">
-            {() => (
+            {({ field, form, meta }) => (
               <div>
                 <input {...field} />
                 {/**  Works because this is inside
@@ -125,7 +126,7 @@ const Basic = () => (
           <button type="submit">Submit</button>
         </Form>
       )}
-    />
+    </Formik>
   </div>
 );
 ```
```

---

### Incident Patch 7: `ce305f5b` (2023-09-12)
**Commit Message**: Merge pull request #3871 from SophanySC/fix/ISSUE-3846-setValue-docs

fix-docs: return type of setValue in docs did not match the function typing

**File**: `docs/api/formik.md` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ Set `touched` imperatively. Calling this will trigger validation to run if `vali
 
 If `validateOnBlur` is set to `true` and there are errors, they will be resolved in the returned `Promise`.
 
-#### `setValues: (fields: React.SetStateAction<{ [field: string]: any }>, shouldValidate?: boolean) => void`
+#### `setValues: (fields: React.SetStateAction<{ [field: string]: any }>, shouldValidate?: boolean) => Promise<void | FormikErrors<Values>>`
 
 Set `values` imperatively. Calling this will trigger validation to run if `validateOnChange` is set to `true` (which it is by default). You can also explicitly prevent/skip validation by passing a second argument as `false`.
 
```

---

### Incident Patch 8: `a2350135` (2023-09-06)
**Commit Message**: docs: Fix incorrect submission FAQ formatting

Add spacing between lines to support proper inline code formatting.

**File**: `docs/guides/form-submission.md` (modified, +5/-2)
```diff
@@ -60,6 +60,9 @@ If `isValidating` is `true` and `isSubmitting` is `true`.
 
 <details>
 <summary>Why does isSubmitting remain true after submission?</summary>
-  If the submission handler returns a promise, make sure it is correctly resolved or rejected when called.
-  If the submission handler does not return a promise, make sure `setSubmitting(false)` is called at the end of the handler.
+  
+If the submission handler returns a promise, make sure it is correctly resolved or rejected when called.
+
+If the submission handler does not return a promise, make sure `setSubmitting(false)` is called at the end of the handler.
+
 </details>
```

---

### Incident Patch 9: `868b8f09` (2023-09-06)
**Commit Message**: docs: Fix `isSubmitting` FAQ entry

Wrap FAQ entry in `details correctly.

Remove use of inline code markers in `summary` as it seems like they are not supported.

**File**: `docs/guides/form-submission.md` (modified, +2/-1)
```diff
@@ -57,8 +57,9 @@ Disable whatever is triggering submission if `isSubmitting` is `true`.
 If `isValidating` is `true` and `isSubmitting` is `true`.
 
 </details>
-<summary>Why does `isSubmitting` remain `true` after submission?</summary>
+
 <details>
+<summary>Why does isSubmitting remain true after submission?</summary>
   If the submission handler returns a promise, make sure it is correctly resolved or rejected when called.
   If the submission handler does not return a promise, make sure `setSubmitting(false)` is called at the end of the handler.
 </details>
```

---

### Incident Patch 10: `09d81cec` (2023-09-05)
**Commit Message**: Merge branch 'main' into fix/ISSUE-3846-setValue-docs

**File**: `packages/formik/src/Formik.tsx` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ export function useFormik<Values extends FormikValues = FormikValues>({
         dispatchFn();
       }
     },
-    [props.initialErrors, props.initialStatus, props.initialTouched]
+    [props.initialErrors, props.initialStatus, props.initialTouched, props.onReset]
   );
 
   React.useEffect(() => {
```

**File**: `website/src/pages/docs/[...slug].tsx` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ function SidebarRoutes({
       const href = '/docs/[...slug]';
       const pagePath = removeFromLast(path!, '.');
       const pathname = addTagToSlug(pagePath, tag);
-      const selected = slug.startsWith(pagePath);
+      const selected = (slug === pagePath);
       const route = { href, path, title, pathname, selected };
       return (
         <SidebarPost
```

---

### Incident Patch 11: `da58b292` (2023-09-02)
**Commit Message**: Fix deprecated type in React 18 (#3547)

Replace StatelessComponent by FunctionComponent in withFormik.tsx
fix #3546 

PR to solve the problem with the removed type in react 18
I saw that you have a build/types branch, but it hasn't changed since 2020, so I did the direct PR in master



---

### Incident Patch 12: `0e476bdf` (2023-09-02)
**Commit Message**: To fix the navbar highlight. (#3856)

https://github.com/jaredpalmer/formik/issues/3854

**File**: `website/src/pages/docs/[...slug].tsx` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ function SidebarRoutes({
       const href = '/docs/[...slug]';
       const pagePath = removeFromLast(path!, '.');
       const pathname = addTagToSlug(pagePath, tag);
-      const selected = slug.startsWith(pagePath);
+      const selected = (slug === pagePath);
       const route = { href, path, title, pathname, selected };
       return (
         <SidebarPost
```

---

### Incident Patch 13: `5c01ee77` (2023-08-31)
**Commit Message**: FIX: Fixed resetForm function dependency issue (#3872)

Closes: #3861

As i mentioned in the issue section that the unexpected behaviour is comming while using resetForm function due to missing dependency. Here is the fix.

**File**: `packages/formik/src/Formik.tsx` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ export function useFormik<Values extends FormikValues = FormikValues>({
         dispatchFn();
       }
     },
-    [props.initialErrors, props.initialStatus, props.initialTouched]
+    [props.initialErrors, props.initialStatus, props.initialTouched, props.onReset]
   );
 
   React.useEffect(() => {
```

---

### Incident Patch 14: `305f3197` (2023-08-21)
**Commit Message**: fix: return type of setValue in docs did not match the function typing

**File**: `docs/api/formik.md` (modified, +1/-1)
```diff
@@ -216,7 +216,7 @@ Set `touched` imperatively. Calling this will trigger validation to run if `vali
 
 If `validateOnBlur` is set to `true` and there are errors, they will be resolved in the returned `Promise`.
 
-#### `setValues: (fields: React.SetStateAction<{ [field: string]: any }>, shouldValidate?: boolean) => void`
+#### `setValues: (fields: React.SetStateAction<{ [field: string]: any }>, shouldValidate?: boolean) => Promise<void | FormikErrors<Values>>`
 
 Set `values` imperatively. Calling this will trigger validation to run if `validateOnChange` is set to `true` (which it is by default). You can also explicitly prevent/skip validation by passing a second argument as `false`.
 
```

---

### Incident Patch 15: `704da499` (2023-08-02)
**Commit Message**: Fixing distorted UI of footer 'Notify me' Button (#3851)

https://github.com/jaredpalmer/formik/issues/3737

**File**: `website/src/components/Footer.tsx` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ export const Footer: React.FC<FooterProps> = props => {
             <form
               action="https://api.formik.com/submit/palmerhq/formik-newsletter"
               method="post"
-              className="mt-4 sm:flex sm:max-w-md"
+              className="mt-4 lg:flex lg:max-w-md"
             >
               <input type="hidden" name="_honeypot" value="" />
               <input
```

#### Recent Merged Pull Requests:
- **PR #4053** (2025-11-10): Version Packages (@github-actions[bot])
- **PR #4051** (2025-11-10): fix: jsx ref for react 19 (@Moumouls)
- **PR #4046** (closed): Replace Google Fonts with system fonts to fix build timeout (@Copilot)
- **PR #4045** (2025-11-07): Version Packages (@github-actions[bot])
- **PR #4044** (2025-11-07): Upgrade Turborepo from v1.9.9 to v2.6.0 (@Copilot)
- **PR #4043** (2025-11-07): Upgrade changesets/action to v1.5.3 and npm packages (@Copilot)
- **PR #4042** (2025-11-07): Add changeset for React 19 compatibility (PR #4012) (@Copilot)
- **PR #4030** (closed): Updated code older react version to newer version syntax (@Aswinprasanth97)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
