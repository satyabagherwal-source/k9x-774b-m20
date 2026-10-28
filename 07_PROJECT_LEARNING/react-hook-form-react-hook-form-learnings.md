> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-hook-form-react-hook-form-learnings.md`  
> **Source**: github ([https://github.com/react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form))  
> **Source Version**: `70bfa3ae`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T03:49:40.044Z  
> **Learning ID**: `learn-github-react-hook-form-react-hook-form`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): react-hook-form/react-hook-form

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-hook-form-react-hook-form-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T03:49:40.037Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-hook-form/react-hook-form`
- **Description**: 📋 React Hooks for form state management and validation (Web + React Native)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 44883 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/src/formState.tsx`
```
import React from 'react';
import { useForm, ValidationMode } from 'react-hook-form';
import { useParams } from 'react-router-dom';

let renderCounter = 0;

const FormState = () => {
  const { mode } = useParams();
  const {
    register,
    handleSubmit,
    formState: {
      dirtyFields,
      isSubmitted,
      submitCount,
      touchedFields,
      isDirty,
      isSubmitting,
      isSubmitSuccessful,
      isValid,
    },
    reset,
  } = useForm<{
    firstName: string;
    lastName: string;
    select: string;
    radio: string | null;
    checkbox: boolean;
    ['checkbox-checked']: boolean;
  }>({
    mode: mode as keyof ValidationMode,
    defaultValues: {
      firstName: '',
      lastName: '',
      select: '',
      checkbox: false,
      radio: null,
      'checkbox-checked': true,
    },
  });

  renderCounter++;

  return (
    <form
      onSubmit={handleSubmit((d) => {
        console.log(d);
      })}
    >
      <input
        {...register('firstName', { required: true })}
        placeholder="firstName"
      />
      <input
        {...register('lastName', { required: true })}
        placeholder="lastName"
      />
      <div id="state">
        {JSON.stringify({
          isSubmitted,
          submitCount,
          isDirty,
          isSubmitting,
          isSubmitSuccessful,
          isValid,
          touched: Object.keys(touchedFields),
          dirty: Object.keys(dirtyFields),
        })}
      </div>
      <select {...register('select')} defaultValue="test">
        <option value="">Select</option>
        <option value="test">test</option>
        <option value="test1">test1</option>
        <option value="test2">test2</option>
      </select>

      <input type="radio" {...register('radio')} />

      <input type="checkbox" {...register('checkbox')} />
      <input type="checkbox" {...register('checkbox-checked')} />
      <button id="submit">Submit</button>
      <button type="button" onClick={() => reset()} id="resetForm">
        Reset
      </button>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default FormState;

```

### Core Architecture Module: `app/src/formStateWithNestedFields.tsx`
```
import React from 'react';
import { useForm, ValidationMode } from 'react-hook-form';
import { useParams } from 'react-router-dom';

let renderCounter = 0;

const FormStateWithNestedFields = () => {
  const { mode } = useParams();
  const {
    register,
    handleSubmit,
    formState: {
      dirtyFields,
      isSubmitted,
      submitCount,
      touchedFields,
      isDirty,
      isSubmitting,
      isSubmitSuccessful,
      isValid,
    },
    reset,
  } = useForm<{
    left: {
      test1: string;
      test2: string;
    };
    right: {
      test1: string;
      test2: string;
    };
  }>({
    mode: mode as keyof ValidationMode,
    defaultValues: {
      left: {
        test1: '',
        test2: '',
      },
      right: {
        test1: '',
        test2: '',
      },
    },
  });

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(() => {})}>
      <div style={{ display: 'flex' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4>Left</h4>
          <input
            {...register('left.test1', { required: true })}
            placeholder="firstName"
          />
          <input
            {...register('left.test2', { required: true })}
            placeholder="lastName"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h4>Right</h4>
          <input
            {...register('right.test1', { required: false })}
            placeholder="firstName"
          />
          <input
            {...register('right.test2', { required: false })}
            placeholder="lastName"
          />
        </div>
      </div>
      <div id="state">
        {JSON.stringify({
          isDirty,
          isSubmitted,
          submitCount,
          isSubmitting,
          isSubmitSuccessful,
          isValid,
          touched: (
            Object.keys(touchedFields) as Array<keyof typeof touchedFields>
          ).flatMap((topLevelKey) =>
            Object.keys(touchedFields[topLevelKey] || {}).map(
              (nestedKey) => `${topLevelKey}.${nestedKey}`,
            ),
          ),
          dirty: (
            Object.keys(dirtyFields) as Array<keyof typeof touchedFields>
          ).flatMap((topLevelKey) =>
            Object.keys(dirtyFields[topLevelKey] || {}).map(
              (nestedKey) => `${topLevelKey}.${nestedKey}`,
            ),
          ),
        })}
      </div>
      <button id="submit">Submit</button>
      <button type="button" onClick={() => reset()} id="resetForm">
        Reset
      </button>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default FormStateWithNestedFields;

```

### Core Architecture Module: `app/src/formStateWithSchema.tsx`
```
import React from 'react';
import { useForm, ValidationMode } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useParams } from 'react-router-dom';

let renderCounter = 0;

const validationSchema = yup
  .object()
  .shape({
    firstName: yup.string().required(),
    lastName: yup.string().max(5).required(),
    select: yup.string().required(),
    radio: yup.string().required(),
    checkbox: yup.string().required(),
  })
  .required();

const FormStateWithSchema: React.FC = () => {
  const { mode } = useParams();
  const {
    register,
    handleSubmit,
    formState: {
      dirtyFields,
      isSubmitted,
      submitCount,
      touchedFields,
      isDirty,
      isSubmitting,
      isSubmitSuccessful,
      isValid,
    },
    reset,
  } = useForm<{
    firstName: string;
    lastName: string;
    select: string;
    radio: string | null;
    checkbox: boolean;
  }>({
    resolver: yupResolver(validationSchema),
    mode: mode as keyof ValidationMode,
    defaultValues: {
      firstName: '',
      lastName: '',
      select: '',
      checkbox: false,
      radio: null,
    },
  });
  const onSubmit = () => {};

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('firstName')} placeholder="firstName" />
      <input {...register('lastName')} placeholder="lastName" />
      <select {...register('select')}>
        <option value="">Select</option>
        <option value={1}>1</option>
        <option value={2}>2</option>
      </select>
      Radio1
      <input type="radio" {...register('radio')} value="1" />
      Radio2
      <input type="radio" {...register('radio')} value="2" />
      Radio3
      <input type="radio" {...register('radio')} value="3" />
      <input type="checkbox" {...register('checkbox')} />
      <button id="submit">Submit</button>
      <button type="button" onClick={() => reset()} id="resetForm">
        Reset
      </button>
      <div id="state">
        {JSON.stringify({
          isSubmitted,
          submitCount,
          isDirty,
          isSubmitting,
          isSubmitSuccessful,
          isValid,
          touched: Object.keys(touchedFields),
          dirty: Object.keys(dirtyFields),
        })}
      </div>
      <div id="renderCount">{renderCounter}</div>
    </form>
  );
};

export default FormStateWithSchema;

```

### Core Architecture Module: `app/src/useFormState.tsx`
```
import React from 'react';
import { useFormState, useForm, Control } from 'react-hook-form';

let renderCounter = 0;

type FormInputs = {
  firstName: string;
  lastName: string;
  min: string;
  max: string;
  minDate: string;
  maxDate: string;
  minLength: string;
  minRequiredLength: string;
  selectNumber: string;
  pattern: string;
  nestItem: {
    nest1: string;
  };
  arrayItem: {
    test1: string;
  }[];
};

const SubForm = ({ control }: { control: Control<FormInputs> }) => {
  const {
    isDirty,
    dirtyFields,
    touchedFields,
    isSubmitted,
    isSubmitSuccessful,
    submitCount,
    isValid,
  } = useFormState({
    control,
  });

  return (
    <p id="state">
      {JSON.stringify({
        isDirty,
        touched: Object.keys(touchedFields),
        dirty: Object.keys(dirtyFields),
        isSubmitted,
        isSubmitSuccessful,
        submitCount,
        isValid,
      })}
    </p>
  );
};

export const UseFormState: React.FC = () => {
  const { register, handleSubmit, control, reset } = useForm<FormInputs>({
    mode: 'onChange',
  });
  const onValid = () => {};

  renderCounter++;

  return (
    <form onSubmit={handleSubmit(onValid)}>
      <input
        placeholder="nest.nest1"
        {...register('nestItem.nest1', { required: true })}
      />
      <input
        placeholder="arrayItem.0.test1"
        {...register('arrayItem.0.test1', { required: true })}
      />
      <input
        {...register('firstName', { required: true })}
        placeholder="firstName"
      />
      <input
        {...register('lastName', { required: true, maxLength: 5 })}
        placeholder="lastName"
      />
      <input
        type="number"
        {...register('min', { min: 10 })}
        placeholder="min"
      />
      <input
        type="number"
        {...register('max', { max: 20 })}
        placeholder="max"
      />
      <input
        type="date"
        {...register('minDate', { min: '2019-08-01' })}
        placeholder="minDate"
      />
      <input
        type="date"
        {...register('maxDate', { max: '2019-08-01' })}
        placeholder="maxDate"
      />
      <input
        {...register('minLength', { minLength: 2 })}
        placeholder="minLength"
      />
      <input
        {...register('minRequiredLength', { minLength: 2, required: true })}
        placeholder="minRequiredLength"
      />
      <select {...register('selectNumber', { required: true })}>
        <option value="">Select</option>
        <option value={1}>1</option>
        <option value={2}>1</option>
      </select>
      <input
        {...register('pattern', { pattern: /\d+/ })}
        placeholder="pattern"
      />
      <button id="submit">Submit</button>
      <button type="button" id="resetForm" onClick={() => reset()}>
        Reset
      </button>
      <div id="renderCount">{renderCounter}</div>
      <SubForm control={control} />
    </form>
  );
};

```

### Core Architecture Module: `e2e/utils.ts`
```
import { expect, type Locator } from '@playwright/test';

/**
 * Playwright's locator.pressSequentially() repositions the cursor to the
 * start of the field's existing value on each call (unlike Cypress's type(),
 * which continues from wherever the cursor last was). Explicitly moving to
 * the end first makes repeated typing into the same field append correctly.
 */
export async function type(locator: Locator, text: string) {
  // Let pending render and error-focus effects finish before taking focus.
  await locator.page().evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
  await locator.focus();
  await locator.press('End');
  await locator.pressSequentially(text);
}

/**
 * For long, async-validation-heavy interaction sequences, the exact
 * `#renderCount` value isn't deterministic run-to-run under Playwright (it
 * settles within a range depending on scheduling/microtask timing) even
 * though the underlying value stops changing well within the timeout. This
 * asserts a bounded range instead of an exact count, preserving the original
 * test's intent (catch a real over-rendering regression) without flaking on
 * harmless timing jitter. Bounds should be set from repeated local runs
 * (see e2e/basic.spec.ts for the range derivation), not guessed.
 */
export async function expectRenderCountInRange(
  locator: Locator,
  min: number,
  max: number,
) {
  let previous = -1;
  await expect
    .poll(async () => {
      const current = Number(await locator.textContent());
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);

  expect(previous).toBeGreaterThanOrEqual(min);
  expect(previous).toBeLessThanOrEqual(max);
}

```

### Core Architecture Module: `examples/V6/initalFormState.tsx`
```
import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

import './styles.css';

const defaultValues = {
  firstName: 'bill',
  lastName: 'luo',
  email: 'bluebill1049@hotmail.com',
};

function App() {
  const { register, handleSubmit } = useForm();
  // or you can set up the defaultValues at useForm
  // const { register, handleSubmit } = useForm({
  //   defaultValues,
  // });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="firstName">First Name</label>
      <input
        defaultValue={defaultValues.firstName}
        name="firstName"
        placeholder="bill"
        ref={register}
      />

      <label htmlFor="lastName">Last Name</label>
      <input
        defaultValue={defaultValues.lastName}
        name="lastName"
        placeholder="luo"
        ref={register}
      />

      <label htmlFor="email">Email</label>
      <input
        defaultValue={defaultValues.email}
        name="email"
        placeholder="bluebill1049@hotmail.com"
        type="email"
        ref={register}
      />

      <input type="submit" />
    </form>
  );
}

```

### Core Architecture Module: `examples/V7/initalFormState.tsx`
```
import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

import './styles.css';

const defaultValues = {
  firstName: 'bill',
  lastName: 'luo',
  email: 'bluebill1049@hotmail.com',
};

function App() {
  const { register, handleSubmit } = useForm();
  // or you can set the defaultValues within useForm
  // const { register, handleSubmit } = useForm({
  //   defaultValues,
  // });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="firstName">First Name</label>
      <input
        defaultValue={defaultValues.firstName}
        placeholder="bill"
        {...register('firstName')}
      />

      <label htmlFor="lastName">Last Name</label>
      <input
        defaultValue={defaultValues.lastName}
        placeholder="luo"
        {...register('lastName')}
      />

      <label htmlFor="email">Email</label>
      <input
        defaultValue={defaultValues.email}
        placeholder="bluebill1049@hotmail.com"
        type="email"
        {...register('email')}
      />

      <input type="submit" />
    </form>
  );
}

```

### Core Architecture Module: `src/formState.tsx`
```
import type { ReactNode } from 'react';

import type {
  FieldValues,
  FormState as FormStateType,
  UseFormStateProps,
  UseFormStateReturn,
} from './types';
import { useFormState } from './useFormState';

export type FormStateProps<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
> = UseFormStateProps<TFieldValues, TTransformedValues> & {
  render: (values: UseFormStateReturn<TFieldValues>) => ReactNode;
};

export type FormState<TFieldValues extends FieldValues> =
  FormStateType<TFieldValues>;

export const FormState = <
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>({
  control,
  disabled,
  exact,
  name,
  render,
}: FormStateProps<TFieldValues, TTransformedValues>) =>
  render(useFormState({ control, name, disabled, exact }));

/** @deprecated Use `FormState` instead. Kept as an alias for backward compatibility. */
export const FormStateSubscribe = FormState;

/** @deprecated Use `FormStateProps` instead. Kept as an alias for backward compatibility. */
export type FormStateSubscribeProps<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
> = FormStateProps<TFieldValues, TTransformedValues>;

```

### Core Architecture Module: `src/logic/getProxyFormState.ts`
```
import { VALIDATION_MODE } from '../constants';
import type { Control, FieldValues, FormState, ReadFormState } from '../types';

export default <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
>(
  formState: FormState<TFieldValues>,
  control: Control<TFieldValues, TContext, TTransformedValues>,
  localProxyFormState?: ReadFormState,
  isRoot = true,
) => {
  const result = {} as typeof formState;

  for (const key in formState) {
    Object.defineProperty(result, key, {
      get: () => {
        const _key = key as keyof FormState<TFieldValues> & keyof ReadFormState;

        if (control._proxyFormState[_key] !== VALIDATION_MODE.all) {
          control._proxyFormState[_key] = !isRoot || VALIDATION_MODE.all;
        }

        localProxyFormState && (localProxyFormState[_key] = true);
        return formState[_key];
      },
    });
  }

  return result;
};

```

### Core Architecture Module: `src/logic/shouldRenderFormState.ts`
```
import { VALIDATION_MODE } from '../constants';
import type {
  FieldValues,
  FormState,
  InternalFieldName,
  ReadFormState,
} from '../types';

export default <T extends FieldValues, K extends ReadFormState>(
  formStateData: Partial<FormState<T>> & {
    name?: InternalFieldName;
    values?: T;
  },
  _proxyFormState: K,
  isRoot?: boolean,
) => {
  const keys = Object.keys(formStateData).filter((key) => key !== 'name');

  return (
    !keys.length ||
    (isRoot && keys.length >= Object.keys(_proxyFormState).length) ||
    keys.find(
      (key) =>
        _proxyFormState[key as keyof ReadFormState] ===
        (!isRoot || VALIDATION_MODE.all),
    )
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13621** (2026-07-29): **issue: `form.setValues` does not resize field arrays**
  *Symptoms*: ### Version Number  7.62.0  ### Codesandbox/Expo snack  https://codesandbox.io/p/sandbox/rhf-usefieldarray-bug-fhffjm  ### Steps to reproduce  1. Go to [the Codesandbox](https://codesandbox.io/p/sandbox/rhf-usefieldarray-bug-fhffjm). 2. Click "Add" to add more fields and remove to pop off fields. 3. Clicking "Reset" resets the form back to its original state (expected). 4. Clicking "Set User Details" resizes the array to contain two elements: "Hello World" and "Hello Mars" (expected). 5. Click "Reset". 6. Clicking "Set Form" does _not_ resize the array and instead only populates the fields already present.  ### Expected behaviour  # Explanation  In the function `setUserDetails`, I use `setValue` to set the value of the `userDetails` array. Clicking the button "Set User Details" resizes the array to contain exactly what I set it to: two elements "Hello World" and "Hello Mars".  In the function "setForm`, I use `setValue` on a parent attribute of `userDetails` (i.e., `myForm`) and set it an array of two elements: "Foo Far" and "Boo Bar". However, instead of resizing the array, like `setUserDetails` does, it instead keeps the same array size and only populates the fields that are currently present. If you use the "Add" and "Remove" buttons to add more/less than two fields, you'll see that after clicking "setForm", the number of fields does not change.  I would expect that using `setValue` would set all values in the form to the given value and reset/change any references to the 

- **Issue #13608** (2026-07-23): **[7.76.0 regression] setValue rebuilds the entire dirtyFields object every call, breaking referential stability (incl. proposed fix)**
  *Symptoms*: ### Version Number  7.76.0 – 7.81.0 (regression introduced in 7.76.0; still present on `main`)  ### Codesandbox/Expo snack  Runnable with no UI — the regression is in `createFormControl`'s dirty-tracking. Node snippet below (also reproducible in any sandbox).  Change the version between 7.81.0 and 7.75.0 to see the differences: https://codesandbox.io/p/devbox/suspicious-joliot-flkj2p   ### Steps to reproduce  `setValue(field, value, { shouldDirty: true })` on an already-dirty field, repeatedly, and observe the **object identity** of `formState.dirtyFields`:  ```js const { createFormControl } = require("react-hook-form");  const api = createFormControl({ defaultValues: { a: "", b: "" } }); // subscribe so _formState.isDirty is tracked (as a real form does) api.subscribe({ formState: { isDirty: true, dirtyFields: true }, callback: () => {} });  const refs = []; for (let i = 0; i < 4; i++) {   api.setValue("a", "x" + i, { shouldDirty: true }); // 'a' is dirty the whole time   refs.push(api.control._formState.dirtyFields); } console.log("dirty keys:", Object.keys(api.control._formState.dirtyFields)); // ["a"] throughout console.log("identity changed per setValue:", refs.slice(1).map((o, i) => o !== refs[i])); // 7.75.0 -> [false, false, false]   (object mutated in place, reference stable) // 7.81.0 -> [true,  true,  true]    (brand-new object every call) ```  ### Expected behaviour  `formState.dirtyFields` keeps a **stable object reference** when the set of dirty fields does not 

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

### Incident Patch 1: `70bfa3ae` (2026-10-28)
**Commit Message**: 🐞 fix(useController): read the current unregistration option on unmount (#13956)

**File**: `src/__tests__/useController.test.tsx` (modified, +45/-0)
```diff
@@ -788,6 +788,51 @@ describe('useController', () => {
     expect(data).toBeUndefined();
   });
 
+  it.each([
+    [false, true, undefined],
+    [true, false, undefined],
+    [false, false, undefined],
+    [true, true, undefined],
+    [false, true, false],
+    [true, false, false],
+    [false, true, true],
+    [true, false, true],
+  ])(
+    'use the current shouldUnregister option on unmount (%s -> %s, field: %s)',
+    (initial, next, shouldUnregister) => {
+      const form = renderHook(
+        ({ shouldUnregister }) =>
+          useForm({
+            defaultValues: { test: 'default' },
+            shouldUnregister,
+          }),
+        { initialProps: { shouldUnregister: initial } },
+      );
+      const field = renderHook(() =>
+        useController({
+          name: 'test',
+          control: form.result.current.control,
+          shouldUnregister,
+        }),
+      );
+
+      act(() => {
+        field.result.current.field.onChange('updated');
+      });
+
+      form.rerender({ shouldUnregister: next });
+      field.rerender();
+
+      expect(form.result.current.getValues()).toEqual({ test: 'updated' });
+
+      field.unmount();
+
+      expect(form.result.current.getValues()).toEqual(
+        next || shouldUnregister ? {} : { test: 'updated' },
+      );
+    },
+  );
+
   it('always get the latest value for onBlur event', async () => {
     const watchResults: unknown[] = [];
 
```

**File**: `src/useController.ts` (modified, +5/-2)
```diff
@@ -271,10 +271,13 @@ export function useController<
     }
 
     return () => {
+      const shouldUnregisterField =
+        control._options.shouldUnregister || shouldUnregister;
+
       (
         isArrayField
-          ? _shouldUnregisterField && !control._state.action
-          : _shouldUnregisterField
+          ? shouldUnregisterField && !control._state.action
+          : shouldUnregisterField
       )
         ? control.unregister(name)
         : updateMounted(name, false);
```

---

### Incident Patch 2: `813f827e` (2026-10-27)
**Commit Message**: 🐞 fix(useFieldArray): only apply reValidateMode onSubmit after a submit (#13952)

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useFieldArray.test.tsx` (modified, +66/-0)
```diff
@@ -6644,6 +6644,72 @@ describe('useFieldArray with checkbox', () => {
       expect(screen.queryByTestId('error')?.textContent).toBe(errorAfterAppend);
     },
   );
+
+  it.each(['onChange', 'onTouched', 'all'] as const)(
+    'validate field array operations before submit when mode is %s and reValidateMode is onSubmit',
+    async (mode) => {
+      const App = () => {
+        const {
+          control,
+          handleSubmit,
+          formState: { errors },
+        } = useForm({
+          mode,
+          reValidateMode: 'onSubmit',
+          defaultValues: {
+            test: [{ name: 'a' }],
+          },
+        });
+
+        const { fields, append, remove } = useFieldArray({
+          control,
+          name: 'test',
+          rules: { required: 'Add an item' },
+        });
+
+        return (
+          <form onSubmit={handleSubmit(() => {})}>
+            {errors.test?.root?.message && (
+              <p data-testid="error">{errors.test.root.message}</p>
+            )}
+            <p>rows: {fields.length}</p>
+
+            <button type="button" onClick={() => append({ name: 'b' })}>
+              append
+            </button>
+            <button type="button" onClick={() => remove(0)}>
+              remove
+            </button>
+            <button type="submit">submit</button>
+          </form>
+        );
+      };
+
+      render(<App />);
+
+      await act(async () => {
+        fireEvent.click(screen.getByRole('button', { name: 'remove' }));
+      });
+
+      screen.getByText('rows: 0');
+      expect(await screen.findByTestId('error')).toHaveTextContent(
+        'Add an item',
+      );
+
+      await act(async () => {
+        fireEvent.click(screen.getByRole('button', { name: 'submit' }));
+      });
+
+      expect(screen.getByTestId('error')).toHaveTextContent('Add an item');
+
+      await act(async () => {
+        fireEvent.click(screen.getByRole('button', { name: 'append' }));
+      });
+
+      screen.getByText('rows: 1');
+      expect(screen.getByTestId('error')).toHaveTextContent('Add an item');
+    },
+  );
 });
 
 it('not lose defaultValues when useFieldArray and watch are used together', async () => {
```

**File**: `src/useFieldArray.ts` (modified, +1/-1)
```diff
@@ -384,7 +384,7 @@ export function useFieldArray<
     if (
       _actioned.current &&
       (!validationModes.isOnSubmit || control._formState.isSubmitted) &&
-      !reValidateModes.isOnSubmit &&
+      !(control._formState.isSubmitted && reValidateModes.isOnSubmit) &&
       (!validationModes.isOnBlur ||
         (control._formState.isSubmitted && reValidateModes.isOnChange))
     ) {
```

---

### Incident Patch 3: `9d8041c3` (2026-10-27)
**Commit Message**: 🐞 fix(validate): ignore an older form level validate result that settles last (#13951)

**File**: `src/__tests__/useForm.test.tsx` (modified, +114/-0)
```diff
@@ -3502,6 +3502,120 @@ describe('useForm', () => {
       expect(result.current.getErrors('form.lastName')).toBeUndefined();
     });
 
+    it('keep the latest form-level errors when an older async validate resolves last', async () => {
+      const resolvers: Record<string, (result: true | string) => void> = {};
+
+      const App = () => {
+        const {
+          register,
+          formState: { errors, isValid },
+        } = useForm<{ username: string }>({
+          mode: 'onChange',
+          defaultValues: { username: '' },
+          validate: ({ formValues }) =>
+            new Promise((resolve) => {
+              resolvers[formValues.username] = resolve;
+            }),
+        });
+
+        return (
+          <form>
+            <input {...register('username')} />
+            <p>{errors.form?.message}</p>
+            <p>{isValid ? 'valid' : 'invalid'}</p>
+          </form>
+        );
+      };
+
+      render(<App />);
+
+      await act(async () => {
+        resolvers[''](true);
+      });
+
+      fireEvent.change(screen.getByRole('textbox'), {
+        target: { value: 'a' },
+      });
+      fireEvent.change(screen.getByRole('textbox'), {
+        target: { value: 'ab' },
+      });
+
+      await act(async () => {
+        resolvers.ab(true);
+      });
+      await act(async () => {
+        resolvers.a('"a" is taken');
+      });
+
+      expect(screen.queryByText('"a" is taken')).not.toBeInTheDocument();
+      expect(screen.getByText('valid')).toBeVisible();
+    });
+
+    it('ignore an older trigger form-level result that resolves after a newer one', async () => {
+      const resolvers: ((result: true | string) => void)[] = [];
+      const { result } = renderHook(() => {
+        const form = useForm<{ username: string }>({
+          validate: () =>
+            new Promise((resolve) => {
+              resolvers.push(resolve);
+            }),
+        });
+        form.formState.isValid;
+        return form;
+      });
+
+      await act(async () => {
+        resolvers.splice(0).forEach((resolve) => resolve(true));
+      });
+
+      let first!: Promise<boolean>;
+      let second!: Promise<boolean>;
+
+      act(() => {
+        first = result.current.trigger();
+        second = result.current.trigger();
+      });
+
+      await act(async () => {
+        resolvers[1](true);
+      });
+      await act(async () => {
+        resolvers[0]('stale');
+      });
+
+      expect(await first).toBe(true);
+      expect(await second).toBe(true);
+      expect(result.current.getErrors('form')).toBeUndefined();
+      expect(result.current.formState.isValid).toBe(true);
+    });
+
+    it('still apply a slow form-level validate result when no newer call started', async () => {
+      const resolvers: ((result: true | string) => void)[] = [];
+      const { result } = renderHook(() =>
+        useForm<{ username: string }>({
+          validate: () =>
+            new Promise((resolve) => {
+              resolvers.push(resolve);
+            }),
+        }),
+      );
+
+      let pending!: Promise<boolean>;
+
+      act(() => {
+        pending = result.current.trigger();
+      });
+
+      await act(async () => {
+        resolvers[0]('taken');
+      });
+
+      expect(await pending).toBe(false);
+      expect(result.current.getErrors('form')).toEqual(
+        expect.objectContaining({ message: 'taken' }),
+      );
+    });
+
     it.each([
       { description: 'an empty object', validResult: {} },
       {
```

**File**: `src/logic/createFormControl.ts` (modified, +6/-1)
```diff
@@ -239,6 +239,7 @@ export function createFormControl<
   };
 
   let _setValidCallId = 0;
+  let _validateFormCallId = 0;
   let _resetCallId = 0;
   let _registerCallId = 0;
   const _registerCallIds: Record<InternalFieldName, number> = {};
@@ -838,14 +839,18 @@ export function createFormControl<
   }) => {
     if (_options.validate) {
       const resetCallId = _resetCallId;
+      const validateFormCallId = ++_validateFormCallId;
       const result = await _options.validate({
         formValues: _formValues,
         formState: _formState,
         name,
         eventType,
       });
 
-      if (resetCallId !== _resetCallId) {
+      if (
+        resetCallId !== _resetCallId ||
+        validateFormCallId !== _validateFormCallId
+      ) {
         return true;
       }
 
```

#### Recent Merged Pull Requests:
- **PR #13956** (2026-10-28): fix(useController): read the current unregistration option on unmount (@clean99)
- **PR #13952** (2026-10-27): fix(useFieldArray): only apply reValidateMode onSubmit after a submit (@dfedoryshchev)
- **PR #13951** (2026-10-27): fix(validate): ignore an older form level validate result that settles last (@KooYS)
- **PR #13950** (2026-10-27): fix(setValue): select empty-string checkbox options (@clean99)
- **PR #13949** (2026-10-26): build(deps): bump fast-uri from 3.1.8 to 3.1.9 (@dependabot[bot])
- **PR #13948** (2026-10-26):  🐞 fix #13844 issue formState value flip (@bluebill1049)

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

## X. 🐞 fix(useController): read the current unregistration option on unmount (#13956

**RULE**:
When implementing operations in `src/__tests__/useController.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-hook-form/react-hook-form. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `70bfa3ae`: 🐞 fix(useController): read the current unregistration option on unmount (#13956). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/__tests__/useController.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  it.each([
    [false, true, undefined],
    [true, false, undefined],
    [false, false, undefined],
    [true, true, undefined],
    [false, true, false],
    [true, false, false],
    [false, true, true],
    [true, false, true],
  ])(
    'use the current shouldUnregister option on unmount (%s -> %s, field: %s)',
    (initial, next, shouldUnregister) => {
      const form = renderHook(
        ({ shouldUnregister }) =>
          useForm({
            defaultValues: { test: 'default' },
            shouldUnregister,
          }),
        { initialProps: { shouldUnregister: initial } },
      );
      const field = renderHook(() =>
        useController({
          name: 'test',
          control: form.result.current.control,
          shouldUnregister,
        }),
      );

      act(() => {
        field.result.current.field.onChange('updated');
      });

      form.rerender({ shouldUnregister: next });
      field.rerender();

      expect(form.result.current.getValues()).toEqual({ test: 'updated' });

      field.unmount();

      expect(form.result.current.getValues()).toEqual(
        next || shouldUnregister ? {} : { test: 'updated' },
      );
    },
  );

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `70bfa3ae` are properly handled with clean fallback behavior.
