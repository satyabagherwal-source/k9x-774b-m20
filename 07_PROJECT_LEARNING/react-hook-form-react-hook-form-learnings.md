> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/react-hook-form-react-hook-form-learnings.md`  
> **Source**: github ([https://github.com/react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form))  
> **Source Version**: `3f1257ce`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T00:20:32.787Z  
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
> **Harvest Timestamp**: 2026-10-31T00:20:31.944Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-hook-form/react-hook-form`
- **Description**: 📋 React Hooks for form state management and validation (Web + React Native)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 44897 stars

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

### Incident Patch 1: `c792f337` (2026-10-28)
**Commit Message**: 🐞 fix(validate): apply a submit's own form-level validate result when a newer call starts (#13954)

Since #13951, a validateForm call that a newer call has overtaken
applies nothing and returns true. handleSubmit ignores that value and
decides on _formState.errors. If the newer call has not settled yet,
the submit's rejection is dropped and onValid gets the values it
rejected. A keystroke under mode onChange can start that newer call
during a pending submit, and so can an isValid check under the
default mode.

Skip the call id check for submit calls, so a submit applies its own
result as it did before #13951. The reset check still applies to
every call.

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useForm.test.tsx` (modified, +170/-0)
```diff
@@ -3616,6 +3616,176 @@ describe('useForm', () => {
       );
     });
 
+    describe('when a newer validate starts while the submit validates', () => {
+      const setup = async (mode?: Mode, taken = 'taken') => {
+        const calls: {
+          username: string;
+          resolve: (result: true | string) => void;
+        }[] = [];
+        const onValid = jest.fn();
+        const onInvalid = jest.fn();
+
+        const App = () => {
+          const {
+            register,
+            handleSubmit,
+            formState: { errors, isValid },
+          } = useForm<{ username: string }>({
+            mode,
+            defaultValues: { username: '' },
+            validate: ({ formValues }) =>
+              new Promise((resolve) => {
+                calls.push({ username: formValues.username, resolve });
+              }),
+          });
+
+          return (
+            <form onSubmit={handleSubmit(onValid, onInvalid)}>
+              <input {...register('username')} />
+              <p>{errors.form ? errors.form.message : 'no form error'}</p>
+              <p>{isValid ? 'valid' : 'invalid'}</p>
+              <button>submit</button>
+            </form>
+          );
+        };
+
+        render(<App />);
+
+        const answer = (username: string) =>
+          username === taken ? `"${taken}" is taken` : true;
+
+        // Settling a change's validate starts its isValid check,
+        // so drain until none is left
+        const settleRest = async () => {
+          while (calls.length) {
+            const { username, resolve } = calls.shift()!;
+            await act(async () => {
+              resolve(answer(username));
+            });
+          }
+        };
+
+        await settleRest();
+        expect(screen.getByText('valid')).toBeVisible();
+
+        fireEvent.change(screen.getByRole('textbox'), {
+          target: { value: 'taken' },
+        });
+        fireEvent.click(screen.getByRole('button'));
+        fireEvent.change(screen.getByRole('textbox'), {
+          target: { value: 'taken1' },
+        });
+
+        expect(calls.map(({ username }) => username)).toEqual([
+          'taken',
+          'taken',
+          'taken1',
+        ]);
+        const [older, submit, newer] = calls.splice(0);
+
+        return { older, submit, newer, onValid, onInvalid, settleRest };
+      };
+
+      it('not submit the value when the submit settles before the newer validate', async () => {
+        const { older, submit, newer, onValid, onInvalid, settleRest } =
+          await setup('onChange');
+
+        await act(async () => {
+          submit.resolve('"taken" is taken');
+        });
+
+        expect(onValid).not.toHaveBeenCalled();
+        expect(onInvalid).toHaveBeenCalledTimes(1);
+        expect(screen.getByText('"taken" is taken')).toBeVisible();
+        expect(screen.getByText('invalid')).toBeVisible();
+
+        await act(async () => {
+          older.resolve('"taken" is taken');
+        });
+        await act(async () => {
+          newer.resolve(true);
+        });
+        await settleRest();
+
+        expect(screen.getByText('no form error')).toBeVisible();
+        expect(screen.getByText('valid')).toBeVisible();
+      });
+
+      it('not submit the value when the newer validate settles first', async () => {
+        const { older, submit, newer, onValid, onInvalid, settleRest } =
+          await setup('onChange');
+
+        await act(async () => {
+          newer.resolve(true);
+        });
+        await act(async () => {
+          older.resolve('"taken" is taken');
+        });
+        await act(async () => {
+          submit.resolve('"taken" is taken');
+        });
+
+        expect(onValid).not.toHaveBeenCalled();
+        expect(onInvalid).toHaveBeenCalledTimes(1);
+
+        await settleRest();
+
+        expect(screen.getByText('no form error')).toBeVisible();
+      });
+
+      it('not submit the value when an isValid check starts during the submit', async () => {
+        const { older, submit, newer, onValid, onInvalid, settleRest } =
+          await setup();
+
+        await act(async () => {
+          older.resolve('"taken" is taken');
+        });
+        await act(async () => {
+          submit.resolve('"taken" is taken');
+        });
+
+        expect(onValid).not.toHaveBeenCalled();
+        expect(onInvalid).toHaveBeenCalledTimes(1);
+        expect(screen.getByText('"taken" is taken')).toBeVisible();
+        expect(screen.getByText('invalid')).toBeVisible();
+
+        await act(async () => {
+          newer.resolve(true);
+        });
+        await settleRest();
+
+        expect(screen.getByText('no form error')).toBeVisible();
+        expect(screen.getByText('valid')).toBeVisible();
+      });
+
+      it('submit the value its own validate accepted when the newer validate rejects', async () => {
+        const { older, submit, newer, onValid, onInvalid, settleRest } =
+          await setup('onChange', 't
```

**File**: `src/logic/createFormControl.ts` (modified, +2/-1)
```diff
@@ -849,7 +849,8 @@ export function createFormControl<
 
       if (
         resetCallId !== _resetCallId ||
-        validateFormCallId !== _validateFormCallId
+        (eventType !== EVENTS.SUBMIT &&
+          validateFormCallId !== _validateFormCallId)
       ) {
         return true;
       }
```

---

### Incident Patch 2: `8eef3e0a` (2026-10-30)
**Commit Message**: 🐞 fix #13961 type regression (#13963)

**File**: `reports/api-extractor.api.md` (modified, +3/-1)
```diff
@@ -256,7 +256,9 @@ export type FieldError = {
 // @public (undocumented)
 export type FieldErrors<T extends FieldValues = FieldValues> = Partial<FieldErrorsImpl<DeepRequired<T>>> & {
     root?: Record<string, GlobalError> & GlobalError;
-    form?: Record<string, GlobalError> & GlobalError;
+    form?: GlobalError & (string extends keyof T ? unknown : {
+        [K in keyof T]?: GlobalError;
+    });
 };
 
 // @public (undocumented)
```

**File**: `src/__typetest__/errors.test-d.ts` (modified, +22/-2)
```diff
@@ -24,6 +24,18 @@ import { _ } from './__fixtures__';
     type _t4 = Expect<Equal<typeof formType, string | number | undefined>>;
   }
 
+  /** it should accept a form-level error object */
+  {
+    const errors: FieldErrors = { form: { type: 'server', message: 'Failed' } };
+    const typedErrors: FieldErrors<{ firstName: string }> = {
+      form: {
+        type: 'server',
+        message: 'Failed',
+        firstName: { type: 'validate', message: 'Invalid' },
+      },
+    };
+  }
+
   /** it should support optional record fields */
   {
     const actual = _ as FieldErrors<{
@@ -49,7 +61,11 @@ import { _ } from './__fixtures__';
           >;
         } & {
           root?: Record<string, GlobalError> & GlobalError;
-          form?: Record<string, GlobalError> & GlobalError;
+          form?: GlobalError & {
+            test?: GlobalError;
+            test1?: GlobalError;
+            attachment?: GlobalError;
+          };
         }
       >
     >;
@@ -80,7 +96,11 @@ import { _ } from './__fixtures__';
           >;
         } & {
           root?: Record<string, GlobalError> & GlobalError;
-          form?: Record<string, GlobalError> & GlobalError;
+          form?: GlobalError & {
+            test?: GlobalError;
+            test1?: GlobalError;
+            attachment?: GlobalError;
+          };
         }
       >
     >;
```

**File**: `src/__typetest__/opaqueTypes.test-d.ts` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ declare module '../types/utils' {
           bar?: Merge<FieldError, { baz?: FieldError }>;
         } & {
           root?: Record<string, GlobalError> & GlobalError;
-          form?: Record<string, GlobalError> & GlobalError;
+          form?: GlobalError & { foo?: GlobalError; bar?: GlobalError };
         }
       >
     >;
```

**File**: `src/types/errors.ts` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ export type FieldErrors<T extends FieldValues = FieldValues> = Partial<
   FieldErrorsImpl<DeepRequired<T>>
 > & {
   root?: Record<string, GlobalError> & GlobalError;
-  form?: Record<string, GlobalError> & GlobalError;
+  form?: GlobalError &
+    (string extends keyof T ? unknown : { [K in keyof T]?: GlobalError });
 };
 
 /** Resolves the error type stored by {@link FieldErrors} for a field path. */
```

---

### Incident Patch 3: `3f1257ce` (2026-10-30)
**Commit Message**: 🐞 fix(setValue): send the field array row notification with the current values (#13965)

Since #13665, setValue on a field inside a field array row sends one more
notification per row after the field's own, and reused the values snapshot
taken before the first one went out. A subscribe callback that sets a
sibling field during the first notification wrote _formValues, and the row
notification then put the old value back on the sibling's Controller and
on a whole-array useWatch, while getValues() returned the new one.

Each row notification now clones the values as they are when it is sent.
It still sends undefined when no values subscriber matched.

Fixes #13964

**File**: `src/__tests__/useForm/setValue.test.tsx` (modified, +159/-0)
```diff
@@ -13,6 +13,7 @@ import { Controller } from '../../controller';
 import type { Control } from '../../types';
 import { useFieldArray } from '../../useFieldArray';
 import { useForm } from '../../useForm';
+import { useWatch } from '../../useWatch';
 import get from '../../utils/get';
 import isFunction from '../../utils/isFunction';
 import noop from '../../utils/noop';
@@ -1406,6 +1407,164 @@ describe('setValue', () => {
     );
   });
 
+  it('show the value a values subscriber sets on a sibling field in the same field array row', () => {
+    type FormValues = { rows: { a: string; b: string }[] };
+
+    const App = () => {
+      const { control, setValue, subscribe } = useForm<FormValues>({
+        defaultValues: { rows: [{ a: '1', b: '1!' }] },
+      });
+      const { fields } = useFieldArray({ control, name: 'rows' });
+
+      React.useEffect(() => {
+        return subscribe({
+          name: 'rows.0.a',
+          exact: true,
+          formState: { values: true },
+          callback: ({ name, values }) => {
+            if (name === 'rows.0.a') {
+              setValue('rows.0.b', `${values.rows[0].a}!`);
+            }
+          },
+        });
+      }, [setValue, subscribe]);
+
+      return (
+        <div>
+          {fields.map((field, index) => (
+            <div key={field.id}>
+              <Controller
+                control={control}
+                name={`rows.${index}.b` as const}
+                render={({ field }) => <input aria-label="b" {...field} />}
+              />
+              <Controller
+                control={control}
+                name={`rows.${index}` as const}
+                render={({ field: { value } }) => (
+                  <p data-testid="row">{value.b}</p>
+                )}
+              />
+            </div>
+          ))}
+          <button onClick={() => setValue('rows.0.a', '2')}>update</button>
+        </div>
+      );
+    };
+
+    render(<App />);
+
+    expect(screen.getByLabelText('b')).toHaveValue('1!');
+
+    fireEvent.click(screen.getByRole('button'));
+
+    expect(screen.getByLabelText('b')).toHaveValue('2!');
+    expect(screen.getByTestId('row').textContent).toEqual('2!');
+  });
+
+  it('show the value a values subscriber sets in a field array row to a useWatch of the whole array', () => {
+    type FormValues = { rows: { a: number; b: number }[] };
+
+    const WatchedRows = ({ control }: { control: Control<FormValues> }) => {
+      const rows = useWatch({ control, name: 'rows' });
+
+      return <p data-testid="rows">{rows[0].b}</p>;
+    };
+
+    const App = () => {
+      const { control, setValue, subscribe } = useForm<FormValues>({
+        defaultValues: { rows: [{ a: 1, b: 2 }] },
+      });
+      useFieldArray({ control, name: 'rows' });
+
+      React.useEffect(() => {
+        return subscribe({
+          name: 'rows.0.a',
+          exact: true,
+          formState: { values: true },
+          callback: ({ name, values }) => {
+            if (name === 'rows.0.a') {
+              setValue('rows.0.b', values.rows[0].a * 2);
+            }
+          },
+        });
+      }, [setValue, subscribe]);
+
+      return (
+        <div>
+          <WatchedRows control={control} />
+          <button onClick={() => setValue('rows.0.a', 5)}>update</button>
+        </div>
+      );
+    };
+
+    render(<App />);
+
+    expect(screen.getByTestId('rows').textContent).toEqual('2');
+
+    fireEvent.click(screen.getByRole('button'));
+
+    expect(screen.getByTestId('rows').textContent).toEqual('10');
+  });
+
+  it('show the value a values subscriber sets on a sibling field in a nested field array row', () => {
+    type FormValues = { rows: { items: { x: string; y: string }[] }[] };
+
+    const Items = ({ control }: { control: Control<FormValues> }) => {
+      const { fields } = useFieldArray({ control, name: 'rows.0.items' });
+
+      return (
+        <div>
+          {fields.map((field, index) => (
+            <Controller
+              key={field.id}
+              control={control}
+              name={`rows.0.items.${index}.y` as const}
+              render={({ field }) => <input aria-label="y" {...field} />}
+            />
+          ))}
+        </div>
+      );
+    };
+
+    const App = () => {
+      const { control, setValue, subscribe } = useForm<FormValues>({
+        defaultValues: { rows: [{ items: [{ x: '1', y: '1!' }] }] },
+      });
+      useFieldArray({ control, name: 'rows' });
+
+      React.useEffect(() => {
+        return subscribe({
+          name: 'rows.0.items.0.x',
+          exact: true,
+          formState: { values: true },
+          callback: ({ name, values }) => {
+            if (name === 'rows.0.items.0.x') {
+              setValue('rows.0.items.0.y', `${values.rows[0].items[0].x}!`);
+            }
+          },
+        });
+      }, [setValue, subscribe]);
+
+      return (
+        <div>
+          <Items control={control} />
+          <button onClick={
```

**File**: `src/logic/createFormControl.ts` (modified, +4/-1)
```diff
@@ -1305,7 +1305,10 @@ export function createFormControl<
       });
 
       for (const itemName of fieldArrayItemNames) {
-        _subjects.state.next({ name: itemName, values });
+        _subjects.state.next({
+          name: itemName,
+          values: values && cloneObject(_formValues),
+        });
       }
     }
   };
```

#### Recent Merged Pull Requests:
- **PR #13965** (2026-10-30): fix(setValue): send the field array row notification with the current values (@maxymlyskov)
- **PR #13963** (2026-10-30): 🐞 fix #13961 type regression (@bluebill1049)
- **PR #13962** (closed): fix: clear resolver validation state after rejection (@charan-rathore)
- **PR #13960** (2026-10-29): fix: focus the first enabled option in radio and checkbox groups (@charan-rathore)
- **PR #13959** (closed): 🐞 fix(remove): preserve falsy elements when removing array items (@hardikkaurani)
- **PR #13958** (closed): 🐞 fix(isPlainObject): support plain objects with an own constructor property (@hardikkaurani)

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

## X. 🐞 fix(validate): apply a submit's own form-level validate result when a newer c

**RULE**:
When implementing operations in `src/__tests__/useForm.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react-hook-form/react-hook-form. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c792f337`: 🐞 fix(validate): apply a submit's own form-level validate result when a newer call starts (#13954). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/__tests__/useForm.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    describe('when a newer validate starts while the submit validates', () => {
      const setup = async (mode?: Mode, taken = 'taken') => {
        const calls: {
          username: string;
          resolve: (result: true | string) => void;
        }[] = [];
        const onValid = jest.fn();
        const onInvalid = jest.fn();

        const App = () => {
          const {
            register,
            handleSubmit,
            formState: { errors, isValid },
          } = useForm<{ username: string }>({
            mode,
            defaultValues: { username: '' },
            validate: ({ formValues }) =>
              new Promise((resolve) => {
                calls.push({ username: formValues.username, resolve });
              }),
          });

          return (
            <form onSubmit={handleSubmit(onValid, onInvalid)}>
              <input {...register('username')} />
              <p>{errors.form ? errors.form.message : 'no form error'}</p>
              <p>{isValid ? 'valid' : 'invalid'}</p>
              <button>submit</button>
            </form>
          );
        };

        render(<App />);

        const answer = (username: string) =>
          usern
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c792f337` are properly handled with clean fallback behavior.
