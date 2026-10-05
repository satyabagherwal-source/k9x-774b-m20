# Forensic Learning Record (Deep Inspection): react-hook-form/react-hook-form

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-hook-form-react-hook-form-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:17.036Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-hook-form/react-hook-form`
- **Description**: 📋 React Hooks for form state management and validation (Web + React Native)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 44869 stars

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

### Core Architecture Module: `src/types/utils.ts`
```
import type { NestedValue } from './form';

/*
Projects that React Hook Form installed don't include the DOM library need these interfaces to compile.
React Native applications is no DOM available. The JavaScript runtime is ES6/ES2015 only.
These definitions allow such projects to compile with only --lib ES6.

Warning: all of these interfaces are empty.
If you want type definitions for various properties, you need to add `--lib DOM` (via command line or tsconfig.json).
*/

export type Noop = () => void;

interface File extends Blob {
  readonly lastModified: number;
  readonly name: string;
}

interface FileList {
  readonly length: number;
  item(index: number): File | null;
  [index: number]: File;
}

export type Primitive =
  | null
  | undefined
  | string
  | number
  | boolean
  | symbol
  | bigint;

export type BrowserNativeObject = Date | FileList | File;

/**
 * Registry of types which the recursive type helpers ({@link Path},
 * {@link DeepPartial}, FieldErrors, ...) treat as opaque leaf values
 * instead of recursing into their properties.
 *
 * Empty by default, so it has no effect until a consumer registers a type
 * via declaration merging. Useful for rich third-party value types (Dayjs,
 * Decimal, Luxon DateTime, ...) whose members should never be addressed by
 * a form path and can be expensive for the compiler to traverse.
 * @example
 * ```
 * declare module 'react-hook-form' {
 *   interface OpaqueTypes {
 *     dayjs: Dayjs;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OpaqueTypes {}

/**
 * Union of all types registered in {@link OpaqueTypes}. `never` while the
 * registry is empty.
 */
export type OpaqueType = OpaqueTypes[keyof OpaqueTypes];

export type EmptyObject = { [K in string | number]: never };

export type NonUndefined<T> = T extends undefined ? never : T;

export type LiteralUnion<T extends U, U extends Primitive> =
  | T
  | (U & { _?: never });

export type ExtractObjects<T> = T extends infer U
  ? U extends object
    ? U
    : never
  : never;

type IsPrimitiveLike<T> = T extends Primitive ? true : false;

export type DeepPartial<T> =
  IsPrimitiveLike<T> extends true
    ? T
    : T extends BrowserNativeObject | NestedValue | OpaqueType
      ? T
      : {
          [K in keyof T]?: ExtractObjects<T[K]> extends never
            ? T[K]
            : DeepPartial<T[K]>;
        };

export type DeepPartialSkipArrayKey<T> =
  IsPrimitiveLike<T> extends true
    ? T
    : T extends BrowserNativeObject | NestedValue | OpaqueType
      ? T
      : T extends ReadonlyArray<any>
        ? { [K in keyof T]: DeepPartialSkipArrayKey<T[K]> }
        : { [K in keyof T]?: DeepPartialSkipArrayKey<T[K]> };

/**
 * Checks whether the type is any
 * See {@link https://stackoverflow.com/a/49928360/3406963}
 * @typeParam T - type which may be any
 * ```
 * IsAny<any> = true
 * IsAny<string> = false
 * ```
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Checks whether the type is never
 * @typeParam T - type which may be never
 * ```
 * IsNever<never> = true
 * IsNever<string> = false
 * ```
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Checks whether T1 can be exactly (mutually) assigned to T2
 * @typeParam T1 - type to check
 * @typeParam T2 - type to check against
 * ```
 * IsEqual<string, string> = true
 * IsEqual<'foo', 'foo'> = true
 * IsEqual<string, number> = false
 * IsEqual<string, number> = false
 * IsEqual<string, 'foo'> = false
 * IsEqual<'foo', string> = false
 * IsEqual<'foo' | 'bar', 'foo'> = boolean // 'foo' is assignable, but 'bar' is not (true | false) -> boolean
 * ```
 */
export type IsEqual<T1, T2> = T1 extends T2
  ? (<G>() => G extends T1 ? 1 : 2) extends <G>() => G extends T2 ? 1 : 2
    ? true
    : false
  : false;

export type DeepMap<T, TValue> =
  IsAny<T> extends true
    ? any
    : T extends BrowserNativeObject | NestedValue | OpaqueType
      ? TValue
      : T extends ReadonlyArray<infer U>
        ? Array<DeepMap<NonUndefined<U>, TValue> | undefined>
        : T extends object
          ? { [K in keyof T]: DeepMap<NonUndefined<T[K]>, TValue> }
          : TValue;

export type IsFlatObject<T extends object> =
  Extract<
    Exclude<T[keyof T], NestedValue | Date | FileList | OpaqueType>,
    any[] | object
  > extends never
    ? true
    : false;

export type Merge<A, B> = {
  [K in keyof A | keyof B]?: K extends keyof A & keyof B
    ? [A[K], B[K]] extends [object, object]
      ? Merge<A[K], B[K]>
      : B[K]
    : K extends keyof A
      ? A[K]
      : K extends keyof B
        ? B[K]
        : never;
};

```

### Core Architecture Module: `src/useFormState.ts`
```
import React from 'react';

import getProxyFormState from './logic/getProxyFormState';
import type {
  FieldValues,
  FormState,
  UseFormStateProps,
  UseFormStateReturn,
} from './types';
import { useFormControlContext } from './useFormControlContext';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { useResyncOnReconnect } from './useResyncOnReconnect';

/**
 * Subscribes to form state with re-renders isolated to this hook.
 * Optionally scope to specific field names to minimize re-render surface.
 *
 * @see [API](https://react-hook-form.com/docs/useformstate)
 *
 * @example
 * ```tsx
 * const { errors, isDirty } = useFormState({ control, name: "email" });
 * ```
 */
export function useFormState<
  TFieldValues extends FieldValues = FieldValues,
  TTransformedValues = TFieldValues,
>(
  props?: UseFormStateProps<TFieldValues, TTransformedValues>,
): UseFormStateReturn<TFieldValues> {
  const formControl = useFormControlContext<
    TFieldValues,
    unknown,
    TTransformedValues
  >();
  const { control = formControl, disabled, name, exact } = props || {};

  const getCurrentFormState = () => ({
    ...control._formState,
    defaultValues:
      control._defaultValues as FormState<TFieldValues>['defaultValues'],
  });

  const [formState, updateFormState] =
    React.useState<FormState<TFieldValues>>(getCurrentFormState);
  const _localProxyFormState = React.useRef({
    isDirty: false,
    isLoading: false,
    dirtyFields: false,
    touchedFields: false,
    validatingFields: false,
    isValidating: false,
    isValid: false,
    errors: false,
  });

  const { resyncIfNeeded, snapshot } =
    useResyncOnReconnect<FormState<TFieldValues>>(getCurrentFormState);

  useIsomorphicLayoutEffect(() => {
    resyncIfNeeded(!disabled, getCurrentFormState, updateFormState);

    const unsubscribe = control._subscribe({
      name,
      formState: _localProxyFormState.current,
      exact,
      callback: (formState) => {
        !disabled &&
          updateFormState({
            ...control._formState,
            ...formState,
            defaultValues:
              control._defaultValues as FormState<TFieldValues>['defaultValues'],
          });
      },
    });

    return () => {
      unsubscribe();
      snapshot(!disabled, getCurrentFormState);
    };
  }, [control, name, disabled, exact, resyncIfNeeded, snapshot]);

  React.useEffect(() => {
    _localProxyFormState.current.isValid && control._setValid(true);
  }, [control]);

  return React.useMemo(
    () =>
      getProxyFormState(
        formState,
        control,
        _localProxyFormState.current,
        false,
      ),
    [formState, control],
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13621** (2026-07-29): **issue: `form.setValues` does not resize field arrays**
  *Symptoms*: ### Version Number  7.62.0  ### Codesandbox/Expo snack  https://codesandbox.io/p/sandbox/rhf-usefieldarray-bug-fhffjm  ### Steps to reproduce  1. Go to [the Codesandbox](https://codesandbox.io/p/sandbox/rhf-usefieldarray-bug-fhffjm). 2. Click "Add" to add more fields and remove to pop off fields. 3. Clicking "Reset" resets the form back to its original state (expected). 4. Clicking "Set User Details" resizes the array to contain two elements: "Hello World" and "Hello Mars" (expected). 5. Click "Reset". 6. Clicking "Set Form" does _not_ resize the array and instead only populates the fields already present.  ### Expected behaviour  # Explanation  In the function `setUserDetails`, I use `setValue` to set the value of the `userDetails` array. Clicking the button "Set User Details" resizes the array to contain exactly what I set it to: two elements "Hello World" and "Hello Mars".  In the function "setForm`, I use `setValue` on a parent attribute of `userDetails` (i.e., `myForm`) and set it an array of two elements: "Foo Far" and "Boo Bar". However, instead of resizing the array, like `setUserDetails` does, it instead keeps the same array size and only populates the fields that are currently present. If you use the "Add" and "Remove" buttons to add more/less than two fields, you'll see that after clicking "setForm", the number of fields does not change.  I would expect that using `setValue` would set all values in the form to the given value and reset/change any references to the 

- **Issue #13608** (2026-07-23): **[7.76.0 regression] setValue rebuilds the entire dirtyFields object every call, breaking referential stability (incl. proposed fix)**
  *Symptoms*: ### Version Number  7.76.0 – 7.81.0 (regression introduced in 7.76.0; still present on `main`)  ### Codesandbox/Expo snack  Runnable with no UI — the regression is in `createFormControl`'s dirty-tracking. Node snippet below (also reproducible in any sandbox).  Change the version between 7.81.0 and 7.75.0 to see the differences: https://codesandbox.io/p/devbox/suspicious-joliot-flkj2p   ### Steps to reproduce  `setValue(field, value, { shouldDirty: true })` on an already-dirty field, repeatedly, and observe the **object identity** of `formState.dirtyFields`:  ```js const { createFormControl } = require("react-hook-form");  const api = createFormControl({ defaultValues: { a: "", b: "" } }); // subscribe so _formState.isDirty is tracked (as a real form does) api.subscribe({ formState: { isDirty: true, dirtyFields: true }, callback: () => {} });  const refs = []; for (let i = 0; i < 4; i++) {   api.setValue("a", "x" + i, { shouldDirty: true }); // 'a' is dirty the whole time   refs.push(api.control._formState.dirtyFields); } console.log("dirty keys:", Object.keys(api.control._formState.dirtyFields)); // ["a"] throughout console.log("identity changed per setValue:", refs.slice(1).map((o, i) => o !== refs[i])); // 7.75.0 -> [false, false, false]   (object mutated in place, reference stable) // 7.81.0 -> [true,  true,  true]    (brand-new object every call) ```  ### Expected behaviour  `formState.dirtyFields` keeps a **stable object reference** when the set of dirty fields does not 
  **Post-Mortem & Fix Analysis**:
  > Follow-up after testing the proposed fix against a real app: there are actually **two distinct behaviour changes** in #13370, and the "reconcile in place" fix above only addresses the first.  1. **Referential stability** (this issue): `setValue` allocates a new `dirtyFields` object every call. Reconcile-in-place fixes this, and it's enough to stop the render-loop symptom.  2. **`shouldDirty` semantics**: because the recompute is `getDirtyFields(_defaultValues, _formValues)`, a field is now reported in `dirtyFields` whenever its **value ≠ default** — even if it was written with `setValue(name, value)` **without** `{ shouldDirty: true }`. Before 7.76 a field only appeared in `dirtyFields` when explicitly written with `shouldDirty`. This breaks the common "auto-derive field X from field Y until the user edits X" pattern:  ```ts onChange={(e) => {   setValue("name", e.target.value);   if (!dirtyFields.shortName) {                    // only true until the user edits shortName     setValue(
  > Here's a single runnable repro covering **both** behaviour changes from #13370 (no UI needed — uses `createFormControl`):  ```js const { createFormControl } = require("react-hook-form");  // --- #1 referential stability: dirtyFields identity across setValue --- const a1 = createFormControl({ defaultValues: { a: "", b: "" } }); a1.subscribe({ formState: { isDirty: true, dirtyFields: true }, callback: () => {} }); const refs = []; for (let i = 0; i < 4; i++) {   a1.setValue("a", "x" + i, { shouldDirty: true });   // 'a' stays dirty the whole time   refs.push(a1.control._formState.dirtyFields); } console.log("#1 identity changed per setValue:", refs.slice(1).map((o, i) => o !== refs[i]));  // --- #2 shouldDirty semantics: field written WITHOUT shouldDirty is reported dirty --- const a2 = createFormControl({ defaultValues: { a: "", b: "" } }); a2.subscribe({ formState: { isDirty: true, dirtyFields: true }, callback: () => {} }); a2.setValue("b", "typed", { shouldDirty: false });    // b ch
  > Going to fix issue 1 and issue 2 will update the doc to reflect.

- **Issue #13592** (2026-07-12): **issue: setValue with shouldDirty:true does not mark field/form dirty when form is disabled**
  *Symptoms*: ### Version Number  7.81.0 (still reproduces on latest `master`, af84a5d0)  ### Codesandbox/Expo snack  https://codesandbox.io/p/sandbox/97ykx8 (sandbox from the original report #13100)  ### Steps to reproduce  Follow-up to #13100, filed fresh as requested by @bluebill1049 in #13103.  1. Create a form with `useForm({ defaultValues: { foo: 'a' }, disabled: true })` 2. Register the field: `register('foo')` 3. Programmatically update: `setValue('foo', 'b', { shouldDirty: true })` 4. Read `getFieldState('foo').isDirty` and `formState.isDirty`  Minimal failing test against `master`:  ```tsx const { result } = renderHook(() =>   useForm({ defaultValues: { foo: 'a' }, disabled: true }), );  act(() => {   result.current.register('foo');   result.current.setValue('foo', 'b', { shouldDirty: true }); });  expect(result.current.getFieldState('foo').isDirty).toBe(true); // ❌ false expect(result.current.formState.isDirty).toBe(true); // ❌ false ```  Root cause: both `updateTouchAndDirty` and `_getDirty` short-circuit when `_options.disabled` is true, so even explicit programmatic `shouldDirty: true` updates can never affect dirty state.  ### Expected behaviour  `disabled` should block *user* input, but an explicit programmatic `setValue(..., { shouldDirty: true })` opts into dirty tracking, so `fieldState.isDirty` and `formState.isDirty` should become `true`.  If the current behaviour is intentional, it would be great to have it documented on `setValue`/`disabled`.  ### What browsers are y
  **Post-Mortem & Fix Analysis**:
  > @bluebill1049 Once you've had a chance to confirm whether this is a bug or expected behaviour, I'd be happy to take this up — I already have a working fix with tests from #13103 that I can rebase and resubmit as a focused PR.
  > This is a bug.
  > Thanks i have assigned to you.

- **Issue #13506** (2026-06-07): **`isDirty` not emitted to `useFormState` subscribers when `field.onChange()` called twice in same tick**
  *Symptoms*: ### Describe the bug  Calling `field.onChange()` twice with different values in the same tick updates the field value correctly, but `isDirty` is never propagated to `useFormState` subscribers in a separate component. A single `field.onChange()` call works fine.  Requires `mode: "onChange"` (async validation active).  ### Reproduction  **[StackBlitz](https://stackblitz.com/github/rishitells/rhf-isdirty-race-repro?file=src%2FApp.tsx)**  1. Click **"Two field.onChange() calls (BUG)"** - field updates but `isDirty` stays `false` 2. Refresh, click **"Single field.onChange() call (OK)"** - `isDirty` correctly becomes `true`  ### Why it happens  The `onChange` handler is async (awaits resolver). When called twice in one tick, the first call's validation resolves after the second call has already overwritten `_formValues`. The staleness guard (`isFieldValueUpdated` from PR #10082) sees a mismatch and skips the entire notification, including `isDirty`.  ### Expected behavior  `isDirty` should reach `useFormState` subscribers regardless of how many `field.onChange()` calls happen in the same tick.  ### Environment  - react-hook-form 7.71.1, react 18.3.1, zod 3.25.0, @hookform/resolvers 3.10.0
  **Post-Mortem & Fix Analysis**:
  > fixed in https://github.com/react-hook-form/react-hook-form/commit/d681dc57 thanks hygraph for the support over the years.

- **Issue #13430** (2026-05-12): **issue: setValues bug. setValues seems that the controller has not been notified to update the fields.**
  *Symptoms*: ### Version Number  7.75.0  ### Codesandbox/Expo snack  https://codesandbox.io/p/sandbox/gallant-tu-7ggh8s?file=%2Fsrc%2FApp.tsx%3A18%2C8  ```tsx import { useForm } from "react-hook-form"; import Headers from "./Header"; import "./styles.css";  import { useState } from "react";  export default function App() {   const [data, setData] = useState();   const { register, handleSubmit, setValues, getValues } = useForm({     defaultValues: {       firstName: "",     },   });    const onSet = () => {     setValues({       firstName: "111",     });   };    const onGet = () => {     setData(getValues());   };    return (     <div>       <Headers />        <form onSubmit={handleSubmit((data) => console.log(data))}>         <input {...register("firstName")} placeholder="First Name" />         <input type="submit" />       </form>        <button onClick={onSet}>set</button>       <button onClick={onGet}>get</button>       <div>{JSON.stringify(data)}</div>     </div>   ); } ```  ### Steps to reproduce  In fact,both console.log and devtool indicate that the form state has been updated.  ### Expected behaviour  Same as setValue  ### What browsers are you seeing the problem on?  _No response_  ### Relevant log output  ```shell  ```  ### Code of Conduct  - [ ] I agree to follow this project's Code of Conduct

- **Issue #13429** (2026-05-13): **issue: useFieldArray: append({ obj: null }) is silently replaced by defaultValues after remove() (regression in 7.74)**
  *Symptoms*: ### Version Number  7.75.0 (also reproducible with 7.74.0)  ### Codesandbox/Expo snack  https://codesandbox.io/p/devbox/new-tree-rqkwlg  ```tsx import {   FormProvider,   useFieldArray,   useForm,   useFormContext,   useWatch, } from "react-hook-form"; import Headers from "./Header"; import "./styles.css";  type Form = {   items: { obj: { value: string } | null }[]; };  const OPTIONS = ["A", "B", "C"];  export default function App() {   const methods = useForm<Form>({     defaultValues: { items: [{ obj: { value: "A" } }] },   });   const { control } = methods;   const { fields, append, remove } = useFieldArray({     control,     name: "items",   });   const watchedItems = useWatch({ control, name: "items" });    return (     <FormProvider {...methods}>       <div>         <Headers />          <div style={{ padding: 16, fontFamily: "system-ui" }}>           <h2>             useFieldArray: append({"{ obj: null }"}) overridden by defaultValues           </h2>           <p>             <strong>Expected:</strong> after click, row-0 = <code>(empty)</code>             , <code>items[0].obj === null</code>             <br />             <strong>Actual (rhf ≥ 7.74):</strong> row-0 ={" "}             <code>{`{"value":"A"}`}</code> (defaultValues restored)           </p>            <button             type="button"             onClick={() => {               remove(0);               append({ obj: null });             }}           >             remove(0) then append({"{ obj: null }"})     
  **Post-Mortem & Fix Analysis**:
  > was this a regression or it never worked?
  > > was this a regression or it never worked?  Regression — but my original bisect was wrong, sorry about that. It actually reproduces from **v7.73.0** (not v7.74.0). v7.72.1 is clean.  Root cause looks like **#13348 ("fix: handle nested field when parent defaultValue is null")** in `src/utils/get.ts`. The reducer used to return `null` as-is when walking through a `null` ancestor; after #13348 it returns `undefined` instead:  ```diff - isNullOrUndefined(result) ? result : result[key] + isNullOrUndefined(result) ? undefined : result[key] ```  The tail of `get()` falls back to `defaultValue` whenever `isUndefined(result)`, so after `append({ obj: null })` the call `register('items.0.obj.value')` triggers `get(values, 'items.0.obj.value', 'A')`, the walk gets coerced to `undefined`, and the defaultValue (`'A'`) is returned and written back into form state. In v7.72.0 the reducer returned `null`, so the fallback never fired.  Quick sanity check: replacing the payload with `append({ obj: { va
  > nice investigation! i will check it out.

- **Issue #13413** (2026-05-06): **issue: defaultValues becomes undefined when using useFieldArray + watch**
  *Symptoms*: ### Version Number  7.75.0  ### Codesandbox/Expo snack  https://github.com/l0gicgate/react-hook-form-issue-20260505  ### Steps to reproduce  1. Clone the repo 2. `bun run dev` 3. Open the console  <img width="1205" height="341" alt="Image" src="https://github.com/user-attachments/assets/2e190307-628b-4f8a-b83e-12cf6ea66c61" />   ### Downgrading to 7.74.0 fixes the issue:  <img width="1327" height="409" alt="Image" src="https://github.com/user-attachments/assets/e6511615-a664-46bd-8a23-0369165d2e29" />  ### Expected behaviour  `defaultValues` should never become `undefined`  ### What browsers are you seeing the problem on?  Chrome  ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > related this https://github.com/react-hook-form/react-hook-form/pull/13398

- **Issue #13403** (2026-04-29): **issue: TypeError: setValues is not a function**
  *Symptoms*: ### Version Number  7.74.0  ### Codesandbox/Expo snack  https://codesandbox.io/p/sandbox/magical-rosalind-mdrtkq  ### Steps to reproduce  My apologies but Codesandbox was not working for me correctly so I can't confirm if it works or not. What is happening is that setValues return from useForm works as expected but the one returned from useFormContext throws TypeError: setValues is not a function  ### Expected behaviour  setValues from useFormContext to not throw TypeError: setValues is not a function  ### What browsers are you seeing the problem on?  Chrome  ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct

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

### Incident Patch 1: `000faaf6` (2026-10-04)
**Commit Message**: 🐞 fix(useFieldArray): skip unregister while a parent array reindexes (#13828)

* 🐞 fix(useFieldArray): skip unregister while a parent array reindexes

With shouldUnregister, nested useFieldArray cleanup ran unregister on the
name from before a parent insert, remove, or move. That path now belongs
to the row that shifted into the index, so its values were deleted.

* Update src/useFieldArray.ts

---------

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useFieldArray.test.tsx` (modified, +90/-0)
```diff
@@ -1349,6 +1349,96 @@ describe('useFieldArray', () => {
 
       expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
     });
+
+    it('should keep the shifted nested field array when a previous row is removed with shouldUnregister', () => {
+      type FormValues = {
+        items: {
+          name: string;
+          nested: { value: string }[];
+        }[];
+      };
+
+      let getValues: UseFormReturn<FormValues>['getValues'];
+
+      const Nested = ({
+        control,
+        index,
+      }: {
+        control: Control<FormValues>;
+        index: number;
+      }) => {
+        const { fields } = useFieldArray({
+          control,
+          name: `items.${index}.nested` as 'items.0.nested',
+        });
+
+        return (
+          <>
+            {fields.map((field, i) => (
+              <input
+                key={field.id}
+                aria-label={`nested-${index}-${i}`}
+                {...control.register(
+                  `items.${index}.nested.${i}.value` as const,
+                )}
+              />
+            ))}
+          </>
+        );
+      };
+
+      const Component = () => {
+        const {
+          control,
+          register,
+          getValues: tempGetValues,
+        } = useForm<FormValues>({
+          shouldUnregister: true,
+          defaultValues: {
+            items: [
+              { name: 'a', nested: [{ value: 'a0' }] },
+              { name: 'b', nested: [{ value: 'b0' }] },
+            ],
+          },
+        });
+        const { fields, remove } = useFieldArray({ control, name: 'items' });
+
+        getValues = tempGetValues;
+
+        return (
+          <form>
+            {fields.map((field, index) => (
+              <div key={field.id}>
+                <input
+                  aria-label={`name-${index}`}
+                  {...register(`items.${index}.name` as const)}
+                />
+                <Nested control={control} index={index} />
+              </div>
+            ))}
+            <button type="button" onClick={() => remove(0)}>
+              remove first
+            </button>
+          </form>
+        );
+      };
+
+      render(<Component />);
+
+      expect(screen.getByLabelText('name-0')).toHaveValue('a');
+      expect(screen.getByLabelText('nested-0-0')).toHaveValue('a0');
+      expect(screen.getByLabelText('name-1')).toHaveValue('b');
+      expect(screen.getByLabelText('nested-1-0')).toHaveValue('b0');
+
+      fireEvent.click(screen.getByRole('button', { name: 'remove first' }));
+
+      expect(screen.getByLabelText('name-0')).toHaveValue('b');
+      expect(screen.getByLabelText('nested-0-0')).toHaveValue('b0');
+      expect(screen.queryByLabelText('name-1')).not.toBeInTheDocument();
+      expect(getValues()).toEqual({
+        items: [{ name: 'b', nested: [{ value: 'b0' }] }],
+      });
+    });
   });
 
   describe('setError', () => {
```

**File**: `src/useFieldArray.ts` (modified, +4/-0)
```diff
@@ -529,6 +529,10 @@ export function useFieldArray<
         });
       }
 
+      if (!shouldKeepFieldArrayValues && control._state.action) {
+        return;
+      }
+
       shouldKeepFieldArrayValues
         ? updateMounted(name, false)
         : control.unregister(name as FieldPath<TFieldValues>);
```

---

### Incident Patch 2: `7838f08f` (2026-10-04)
**Commit Message**: 🐞 fix #13802: keep input edited before the form is ready (#13827)

**File**: `src/__tests__/useForm/register.test.tsx` (modified, +90/-0)
```diff
@@ -1,4 +1,6 @@
 import React from 'react';
+import { hydrateRoot } from 'react-dom/client';
+import { renderToString } from 'react-dom/server';
 import {
   act,
   fireEvent,
@@ -16,6 +18,7 @@ import type {
   Resolver,
   ResolverResult,
   UseFormRegister,
+  UseFormReturn,
 } from '../../types';
 import { useForm } from '../../useForm';
 import { FormProvider, useFormContext } from '../../useFormContext';
@@ -2265,4 +2268,91 @@ describe('register', () => {
       await expect(trigger!()).resolves.toBe(true);
     });
   });
+
+  describe('when a server-rendered input is edited before hydration', () => {
+    it('should keep the typed text as the field value', async () => {
+      let methods: UseFormReturn<{ test: string }>;
+
+      function App() {
+        methods = useForm({ defaultValues: { test: 'default' } });
+        return <input {...methods.register('test')} />;
+      }
+
+      const container = document.createElement('div');
+      container.innerHTML = renderToString(<App />);
+      const input = container.querySelector('input') as HTMLInputElement;
+      input.value = 'typed';
+
+      await act(async () => {
+        hydrateRoot(container, <App />);
+      });
+
+      expect(input.value).toBe('typed');
+      expect(methods!.getValues('test')).toBe('typed');
+      expect(methods!.getFieldState('test').isDirty).toBe(true);
+    });
+
+    it('should keep the typed text through the values reset with keepDirtyValues', async () => {
+      let methods: UseFormReturn<{ test: string }>;
+
+      function App() {
+        methods = useForm({
+          values: { test: 'server' },
+          resetOptions: { keepDirtyValues: true },
+        });
+        return <input {...methods.register('test')} />;
+      }
+
+      const container = document.createElement('div');
+      container.innerHTML = renderToString(<App />);
+      const input = container.querySelector('input') as HTMLInputElement;
+      input.value = 'typed';
+
+      await act(async () => {
+        hydrateRoot(container, <App />);
+      });
+
+      expect(input.value).toBe('typed');
+      expect(methods!.getValues('test')).toBe('typed');
+    });
+
+    it('should keep the checkbox state as the field value', async () => {
+      let methods: UseFormReturn<{ test: boolean }>;
+
+      function App() {
+        methods = useForm({ defaultValues: { test: false } });
+        return <input type="checkbox" {...methods.register('test')} />;
+      }
+
+      const container = document.createElement('div');
+      container.innerHTML = renderToString(<App />);
+      const checkbox = container.querySelector('input') as HTMLInputElement;
+      checkbox.checked = true;
+
+      await act(async () => {
+        hydrateRoot(container, <App />);
+      });
+
+      expect(checkbox.checked).toBe(true);
+      expect(methods!.getValues('test')).toBe(true);
+    });
+
+    it('should still set a reset value into an input edited after the form is ready', async () => {
+      let methods: UseFormReturn<{ test: string }>;
+
+      function App() {
+        methods = useForm({ defaultValues: { test: 'default' } });
+        return <input {...methods.register('test')} />;
+      }
+
+      render(<App />);
+      const input = screen.getByRole('textbox') as HTMLInputElement;
+      fireEvent.input(input, { target: { value: 'typed' } });
+
+      act(() => methods!.reset({ test: 'reset' }));
+
+      expect(input.value).toBe('reset');
+      expect(methods!.getValues('test')).toBe('reset');
+    });
+  });
 });
```

**File**: `src/logic/createFormControl.ts` (modified, +8/-0)
```diff
@@ -69,6 +69,7 @@ import has from '../utils/has';
 import isBoolean from '../utils/isBoolean';
 import isCheckBoxInput from '../utils/isCheckBoxInput';
 import isDateObject from '../utils/isDateObject';
+import isEdited from '../utils/isEdited';
 import isEmptyObject from '../utils/isEmptyObject';
 import isFileInput from '../utils/isFileInput';
 import isFunction from '../utils/isFunction';
@@ -496,9 +497,12 @@ export function createFormControl<
         isUndefined(value) ? get(_defaultValues, name) : value,
       );
 
+      const isEditedBeforeReady = !!ref && !_formState.isReady && isEdited(ref);
+
       if (
         isUndefined(defaultValue) ||
         (ref && (ref as HTMLInputElement).defaultChecked) ||
+        isEditedBeforeReady ||
         shouldSkipSetValueAs
       ) {
         const fieldValue = shouldSkipSetValueAs
@@ -513,6 +517,10 @@ export function createFormControl<
         }
 
         set(_formValues, name, fieldValue);
+
+        if (isEditedBeforeReady) {
+          updateTouchAndDirty(name, fieldValue);
+        }
       } else {
         setFieldValue(name, defaultValue);
       }
```

**File**: `src/utils/isEdited.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import type { Ref } from '../types';
+
+import isCheckBoxInput from './isCheckBoxInput';
+import isRadioInput from './isRadioInput';
+
+export default (ref: Ref): boolean =>
+  isCheckBoxInput(ref)
+    ? ref.checked !== ref.defaultChecked
+    : !isRadioInput(ref) &&
+      'defaultValue' in ref &&
+      ref.value !== ref.defaultValue;
```

---

### Incident Patch 3: `72d617f1` (2026-10-02)
**Commit Message**: 🐞 fix(useWatch): update watched objects after an Activity subtree reconnects (#13819)

* 🐞 fix(useWatch): update watched objects after an Activity subtree reconnects

When a `useWatch` subscribed to an object/array path reconnects (e.g. an
`<Activity>` subtree becomes visible again) after a nested field changed,
the resync handed React a reference into the internal form values, which
are mutated in place. When the hook's state already held that same
reference, React bailed out of the update and the watcher kept rendering
the stale value. Store a copy of the resynced output instead.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Apply suggestion from @bluebill1049

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useWatch.test.tsx` (modified, +78/-0)
```diff
@@ -1112,6 +1112,84 @@ describe('useWatch', () => {
       rerender({ control: form1Result.current.control });
       expect(result.current).toBe('form1-value');
     });
+
+    itWithActivity(
+      'should update a watched parent object after a nested change while its Activity subtree was hidden',
+      () => {
+        type FormValues = {
+          steps: { image: { uri: string } }[];
+        };
+
+        const ActivityContent = React.memo(function ActivityContent({
+          control,
+        }: {
+          control: Control<FormValues>;
+        }) {
+          const steps = useWatch({ control, name: 'steps' });
+
+          return <span data-testid="watched-steps">{steps[0].image.uri}</span>;
+        });
+
+        const Component = () => {
+          const { control } = useForm<FormValues>({
+            defaultValues: {
+              steps: [{ image: { uri: 'initial' } }],
+            },
+          });
+          const [isMounted, setIsMounted] = React.useState(false);
+          const [mode, setMode] = React.useState<'hidden' | 'visible'>(
+            'visible',
+          );
+
+          return (
+            <>
+              <button type="button" onClick={() => setIsMounted(true)}>
+                Mount
+              </button>
+              <button type="button" onClick={() => setMode('hidden')}>
+                Hide
+              </button>
+              <Controller
+                control={control}
+                name="steps.0.image.uri"
+                render={({ field }) => (
+                  <button
+                    type="button"
+                    onClick={() => field.onChange('updated')}
+                  >
+                    Update
+                  </button>
+                )}
+              />
+              <button type="button" onClick={() => setMode('visible')}>
+                Show
+              </button>
+              {isMounted && (
+                <Activity mode={mode}>
+                  <ActivityContent control={control} />
+                </Activity>
+              )}
+            </>
+          );
+        };
+
+        render(<Component />);
+
+        fireEvent.click(screen.getByRole('button', { name: 'Mount' }));
+
+        expect(screen.getByTestId('watched-steps')).toHaveTextContent(
+          'initial',
+        );
+
+        fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
+        fireEvent.click(screen.getByRole('button', { name: 'Update' }));
+        fireEvent.click(screen.getByRole('button', { name: 'Show' }));
+
+        expect(screen.getByTestId('watched-steps')).toHaveTextContent(
+          'updated',
+        );
+      },
+    );
   });
 
   describe('fieldArray', () => {
```

**File**: `src/useWatch.ts` (modified, +4/-2)
```diff
@@ -1,6 +1,7 @@
 import React from 'react';
 
 import generateWatchOutput from './logic/generateWatchOutput';
+import cloneObject from './utils/cloneObject';
 import deepEqual from './utils/deepEqual';
 import type {
   Control,
@@ -211,8 +212,9 @@ export function useWatch<TFieldValues extends FieldValues>(
         !disabled,
         () => _getCurrentOutput.current(),
         (currentValue) => {
-          updateValue(currentValue);
-          _computeFormValues.current = currentValue;
+          const nextValue = cloneObject(currentValue);
+          updateValue(nextValue);
+          _computeFormValues.current = nextValue;
         },
       );
     }
```

---

### Incident Patch 4: `a814cbf6` (2026-10-02)
**Commit Message**: 🐞 fix(reset): keep isDirty false when reset without values uses keepDefaultValues (#13820)

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useForm/reset.test.tsx` (modified, +43/-0)
```diff
@@ -353,6 +353,49 @@ describe('reset', () => {
     expect(screen.getByText('{"firstName":true}')).toBeVisible();
   });
 
+  it('should not be dirty after reset without values when keepDefaultValues is set', async () => {
+    function App() {
+      const {
+        register,
+        reset,
+        formState: { isDirty, dirtyFields },
+      } = useForm({
+        defaultValues: {
+          firstName: 'test',
+        },
+      });
+
+      return (
+        <form>
+          <input {...register('firstName')} placeholder="First Name" />
+          <p>{isDirty ? 'dirty' : 'pristine'}</p>
+          <p>{JSON.stringify(dirtyFields)}</p>
+
+          <button
+            type="button"
+            onClick={() => reset(undefined, { keepDefaultValues: true })}
+          >
+            reset
+          </button>
+        </form>
+      );
+    }
+
+    render(<App />);
+
+    fireEvent.input(screen.getByRole('textbox'), {
+      target: { value: 'changed' },
+    });
+
+    expect(await screen.findByText('dirty')).toBeVisible();
+
+    fireEvent.click(screen.getByRole('button'));
+
+    expect(await screen.findByText('pristine')).toBeVisible();
+    expect(screen.getByText('{}')).toBeVisible();
+    expect(screen.getByRole('textbox')).toHaveValue('test');
+  });
+
   it('should not reset if keepStateOption is specified', async () => {
     let formState = {};
     const onSubmit = jest.fn();
```

**File**: `src/logic/createFormControl.ts` (modified, +1/-0)
```diff
@@ -2201,6 +2201,7 @@ export function createFormControl<
             ? _getDirty()
             : !!(
                 keepStateOptions.keepDefaultValues &&
+                formValues &&
                 !deepEqual(formValues, _defaultValues)
               ),
       isSubmitted: keepStateOptions.keepIsSubmitted
```

---

### Incident Patch 5: `7d1bce13` (2026-10-02)
**Commit Message**: 🐞 fix: restore Controller blur validation after reset (#13817)

* fix: restore Controller blur validation after reset

* Update useController.ts

---------

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/controller.reset-blur.test.tsx` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import React from 'react';
+import { act, fireEvent, render, screen } from '@testing-library/react';
+
+import { Controller } from '../controller';
+import type { UseFormReturn } from '../types';
+import { useForm } from '../useForm';
+
+describe('Controller blur after reset', () => {
+  it('validates a mounted field without requiring a value change or render', async () => {
+    let form: UseFormReturn<{ name: string }>;
+    const validate = jest.fn((value: string) => !!value || 'Name required');
+    const Field = React.memo(
+      ({ control }: Pick<UseFormReturn<{ name: string }>, 'control'>) => (
+        <Controller
+          control={control}
+          name="name"
+          rules={{ validate }}
+          render={({ field }) => <input aria-label="Name" {...field} />}
+        />
+      ),
+    );
+    Field.displayName = 'ResetField';
+    const App = () => {
+      form = useForm({ mode: 'onTouched', defaultValues: { name: '' } });
+      return <Field control={form.control} />;
+    };
+    render(<App />);
+    act(() => form.reset({ name: '' }));
+    await act(async () => fireEvent.blur(screen.getByLabelText('Name')));
+    expect(validate).toHaveBeenCalledWith('', { name: '' });
+    expect(form!.getFieldState('name').error?.message).toBe('Name required');
+  });
+});
```

**File**: `src/useController.ts` (modified, +18/-11)
```diff
@@ -148,17 +148,24 @@ export function useController<
     [name, control],
   );
 
-  const onBlur = React.useCallback(
-    () =>
-      _registerProps.current.onBlur({
-        target: {
-          value: get(control._formValues, name),
-          name: name as InternalFieldName,
-        },
-        type: EVENTS.BLUR,
-      }),
-    [name, control._formValues],
-  );
+  const onBlur = React.useCallback(() => {
+    const value = get(control._formValues, name);
+
+    if (!get(control._fields, name)) {
+      _registerProps.current = control.register(name, {
+        ..._props.current.rules,
+        value,
+      });
+    }
+
+    return _registerProps.current.onBlur({
+      target: {
+        value,
+        name: name as InternalFieldName,
+      },
+      type: EVENTS.BLUR,
+    });
+  }, [name, control]);
 
   const ref = React.useCallback(
     (elm: any) => {
```

---

### Incident Patch 6: `003e4022` (2026-10-01)
**Commit Message**: 🐞 fix(watch): read shouldUnregister from the current options when a field registers (#13814)

**File**: `src/__tests__/useForm/watch.test.tsx` (modified, +32/-0)
```diff
@@ -8,6 +8,7 @@ import {
 } from '@testing-library/react';
 
 import { Controller } from '../../controller';
+import { createFormControl } from '../../logic/createFormControl';
 import type { Control, FieldValues } from '../../types';
 import { useFieldArray } from '../../useFieldArray';
 import { useForm } from '../../useForm';
@@ -529,6 +530,37 @@ describe('watch', () => {
     ]);
   });
 
+  it('should flush additional render when shouldUnregister is set on useForm with a formControl', async () => {
+    const { formControl } = createFormControl<{ test: string }>();
+
+    const App = () => {
+      const [show, setShow] = useState(false);
+      const { watch, register } = useForm<{ test: string }>({
+        formControl,
+        shouldUnregister: true,
+      });
+      const result = watch();
+
+      return (
+        <div>
+          {show && <input {...register('test')} />}
+          <button type="button" onClick={() => setShow(true)}>
+            show
+          </button>
+          <p>{JSON.stringify(result)}</p>
+        </div>
+      );
+    };
+
+    render(<App />);
+
+    expect(screen.getByText('{}')).toBeVisible();
+
+    fireEvent.click(screen.getByRole('button'));
+
+    expect(await screen.findByText('{"test":""}')).toBeVisible();
+  });
+
   it('should not be able to overwrite global watch state', () => {
     function Watcher<T extends FieldValues>({
       control,
```

**File**: `src/logic/createFormControl.ts` (modified, +1/-1)
```diff
@@ -540,7 +540,7 @@ export function createFormControl<
         }
 
         if (
-          props.shouldUnregister &&
+          _options.shouldUnregister &&
           wasUnsetInFormValues &&
           !isUndefined(get(_formValues, name)) &&
           isWatched(name, _names)
```

---

### Incident Patch 7: `3264a9b1` (2026-09-30)
**Commit Message**: 🍖 build(deps): bump fast-uri from 3.1.2 to 3.1.8 (#13811)

Bumps [fast-uri](https://github.com/fastify/fast-uri) from 3.1.2 to 3.1.8.
- [Release notes](https://github.com/fastify/fast-uri/releases)
- [Commits](https://github.com/fastify/fast-uri/compare/v3.1.2...v3.1.8)

---
updated-dependencies:
- dependency-name: fast-uri
  dependency-version: 3.1.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `pnpm-lock.yaml` (modified, +5/-4)
```diff
@@ -1839,6 +1839,7 @@ packages:
   eslint@9.39.4:
     resolution: {integrity: sha512-XoMjdBOwe/esVgEvLmNsD3IRHkm7fbKIUGvrleloJXUZgDHig2IPWNniv+GwjyJXzuNqVjlr5+4yVUZjycJwfQ==}
     engines: {node: ^18.18.0 || ^20.9.0 || >=21.1.0}
+    deprecated: This version is no longer supported. Please see https://eslint.org/version-support for other options.
     hasBin: true
     peerDependencies:
       jiti: '*'
@@ -1901,8 +1902,8 @@ packages:
   fast-levenshtein@2.0.6:
     resolution: {integrity: sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==}
 
-  fast-uri@3.1.2:
-    resolution: {integrity: sha512-rVjf7ArG3LTk+FS6Yw81V1DLuZl1bRbNrev6Tmd/9RaroeeRRJhAt7jg/6YFxbvAQXUCavSoZhPPj6oOx+5KjQ==}
+  fast-uri@3.1.8:
+    resolution: {integrity: sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==}
 
   fb-watchman@2.0.2:
     resolution: {integrity: sha512-p5161BqbuCaSnB8jIbzQHOlpgsPmK5rJVDfDKO91Axs5NC1uu3HRQm6wt9cd9/+GtQQIO53JdGXXoyDpTAsgYA==}
@@ -4627,7 +4628,7 @@ snapshots:
   ajv@8.18.0:
     dependencies:
       fast-deep-equal: 3.1.3
-      fast-uri: 3.1.2
+      fast-uri: 3.1.8
       json-schema-traverse: 1.0.0
       require-from-string: 2.0.2
 
@@ -5337,7 +5338,7 @@ snapshots:
 
   fast-levenshtein@2.0.6: {}
 
-  fast-uri@3.1.2: {}
+  fast-uri@3.1.8: {}
 
   fb-watchman@2.0.2:
     dependencies:
```

---

### Incident Patch 8: `f1821883` (2026-09-30)
**Commit Message**: 🐞 fix: compare form values stored under a `ref` key (#13812)

deepEqual skipped every `ref` key so DOM refs inside field errors would
not be compared, but it applied that to form values as well. A field
named `ref` never made the form dirty, and setValue on an object whose
only change was its `ref` property was treated as a no-op, so the old
value was submitted.

Only ignore `ref` when comparing field errors.

Co-authored-by: breken-ai <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/__tests__/useForm/formState.test.tsx` (modified, +24/-0)
```diff
@@ -1136,6 +1136,30 @@ describe('formState', () => {
     expect(screen.getByText(JSON.stringify({ fruits: true }))).toBeVisible();
   });
 
+  it('should mark the form dirty when a field named `ref` changes', async () => {
+    const App = () => {
+      const {
+        register,
+        formState: { isDirty },
+      } = useForm({ defaultValues: { ref: '', note: '' } });
+
+      return (
+        <form>
+          <input {...register('ref')} placeholder="ref" />
+          <p>{isDirty ? 'dirty' : 'pristine'}</p>
+        </form>
+      );
+    };
+
+    render(<App />);
+
+    fireEvent.input(screen.getByPlaceholderText('ref'), {
+      target: { value: 'A-100' },
+    });
+
+    expect(await screen.findByText('dirty')).toBeVisible();
+  });
+
   it('should update isDirty with getFieldState at child component', () => {
     type FormValues = {
       test?: string;
```

**File**: `src/__tests__/useForm/setValue.test.tsx` (modified, +17/-0)
```diff
@@ -605,6 +605,23 @@ describe('setValue', () => {
     });
   });
 
+  it('should update an object value that contains a `ref` key', () => {
+    const { result } = renderHook(() =>
+      useForm({
+        defaultValues: { order: { ref: 'A-100', quantity: 1 } },
+      }),
+    );
+
+    act(() => {
+      result.current.setValue('order', { ref: 'B-200', quantity: 1 });
+    });
+
+    expect(result.current.getValues('order')).toEqual({
+      ref: 'B-200',
+      quantity: 1,
+    });
+  });
+
   describe('with watch', () => {
     it('should get watched value', () => {
       const { result } = renderHook(() => {
```

**File**: `src/__tests__/utils/deepEqual.test.ts` (modified, +28/-0)
```diff
@@ -230,4 +230,32 @@ describe('deepEqual', () => {
     expect(deepEqual({ items: [] }, { items: {} })).toBeFalsy();
     expect(deepEqual({ items: {} }, { items: [] })).toBeFalsy();
   });
+
+  it('should compare values stored under a `ref` key', () => {
+    expect(deepEqual({ ref: 'A-100' }, { ref: 'B-200' })).toBeFalsy();
+    expect(
+      deepEqual({ order: { ref: 'A-100' } }, { order: { ref: 'B-200' } }),
+    ).toBeFalsy();
+    expect(deepEqual([{ ref: 'A-100' }], [{ ref: 'A-100' }])).toBeTruthy();
+  });
+
+  it('should ignore the `ref` key when comparing field errors', () => {
+    const input1 = document.createElement('input');
+    const input2 = document.createElement('input');
+
+    expect(
+      deepEqual(
+        { type: 'required', message: 'required', ref: input1 },
+        { type: 'required', message: 'required', ref: input2 },
+        true,
+      ),
+    ).toBeTruthy();
+    expect(
+      deepEqual(
+        { type: 'required', message: 'required', ref: input1 },
+        { type: 'pattern', message: 'required', ref: input1 },
+        true,
+      ),
+    ).toBeFalsy();
+  });
 });
```

**File**: `src/logic/createFormControl.ts` (modified, +3/-1)
```diff
@@ -681,7 +681,9 @@ export function createFormControl<
     }
 
     if (
-      (error ? !deepEqual(previousFieldError, error) : previousFieldError) ||
+      (error
+        ? !deepEqual(previousFieldError, error, true)
+        : previousFieldError) ||
       !isEmptyObject(fieldState) ||
       shouldUpdateValid
     ) {
```

**File**: `src/utils/deepEqual.ts` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@ const isEmptyObjectWithCustomPrototype = (object: object, keys: string[]) =>
 export default function deepEqual(
   object1: unknown,
   object2: unknown,
+  isErrorObject = false,
   visited = new WeakMap<object, WeakSet<object>>(),
 ) {
   if (object1 === object2) {
@@ -62,14 +63,14 @@ export default function deepEqual(
       return false;
     }
 
-    if (key !== 'ref') {
+    if (!isErrorObject || key !== 'ref') {
       const val2 = (object2 as Record<string, unknown>)[key];
 
       if (
         (isDateObject(val1) && isDateObject(val2)) ||
         ((isObject(val1) || Array.isArray(val1)) &&
           (isObject(val2) || Array.isArray(val2)))
-          ? !deepEqual(val1, val2, visited)
+          ? !deepEqual(val1, val2, isErrorObject, visited)
           : !Object.is(val1, val2)
       ) {
         return false;
```

---

### Incident Patch 9: `09d2e7c2` (2026-09-30)
**Commit Message**: 🌭 build(deps): bump joi from 18.2.5 to 18.2.6 in /app (#13810)

Bumps [joi](https://github.com/hapijs/joi) from 18.2.5 to 18.2.6.
- [Commits](https://github.com/hapijs/joi/compare/v18.2.5...v18.2.6)

---
updated-dependencies:
- dependency-name: joi
  dependency-version: 18.2.6
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `app/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
     "@emotion/styled": "^11.14.0",
     "@hookform/resolvers": "3.9.0",
     "@mui/material": "^5.16.13",
-    "joi": "^18.2.5",
+    "joi": "^18.2.6",
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "react-hook-form": "file:..",
```

**File**: `app/pnpm-lock.yaml` (modified, +16/-10)
```diff
@@ -16,13 +16,13 @@ importers:
         version: 11.14.0(@emotion/react@11.14.0(@types/react@19.0.2)(react@19.0.0))(@types/react@19.0.2)(react@19.0.0)
       '@hookform/resolvers':
         specifier: 3.9.0
-        version: 3.9.0(react-hook-form@file:..(react@19.0.0))
+        version: 3.9.0(react-hook-form@file:..(@types/react@19.0.2)(react@19.0.0))
       '@mui/material':
         specifier: ^5.16.13
         version: 5.16.13(@emotion/react@11.14.0(@types/react@19.0.2)(react@19.0.0))(@emotion/styled@11.14.0(@emotion/react@11.14.0(@types/react@19.0.2)(react@19.0.0))(@types/react@19.0.2)(react@19.0.0))(@types/react@19.0.2)(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
       joi:
-        specifier: ^18.2.5
-        version: 18.2.5
+        specifier: ^18.2.6
+        version: 18.2.6
       react:
         specifier: ^19.0.0
         version: 19.0.0
@@ -31,7 +31,7 @@ importers:
         version: 19.0.0(react@19.0.0)
       react-hook-form:
         specifier: file:..
-        version: file:..(react@19.0.0)
+        version: file:..(@types/react@19.0.2)(react@19.0.0)
       react-router-dom:
         specifier: ^6.28.1
         version: 6.28.1(react-dom@19.0.0(react@19.0.0))(react@19.0.0)
@@ -791,8 +791,8 @@ packages:
     resolution: {integrity: sha512-UfoeMA6fIJ8wTYFEUjelnaGI67v6+N7qXJEvQuIGa99l4xsCruSYOVSQ0uPANn4dAzm8lkYPaKLrrijLq7x23w==}
     engines: {node: '>= 0.4'}
 
-  joi@18.2.5:
-    resolution: {integrity: sha512-+gEA7rLfaNWx9JzawWPrPetSZwT16NUqHtECDgjyAJreXcs4TM7tx2Pa+VVJJK0YHM83ybrVdaT6UekHH50FJQ==}
+  joi@18.2.6:
+    resolution: {integrity: sha512-8MD5jy4xIcTQi/pHbc10auxclVoJS3pPNiLaTNfW0eh90GbOPU+Y2AjDQnuQsUcHUGNJxqTMmAW6Ho895RaKPA==}
     engines: {node: '>= 20'}
 
   js-tokens@4.0.0:
@@ -880,7 +880,11 @@ packages:
     resolution: {directory: .., type: directory}
     engines: {node: '>=18.0.0'}
     peerDependencies:
+      '@types/react': '*'
       react: ^16.8.0 || ^17 || ^18 || ^19
+    peerDependenciesMeta:
+      '@types/react':
+        optional: true
 
   react-is@16.13.1:
     resolution: {integrity: sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==}
@@ -1353,9 +1357,9 @@ snapshots:
     dependencies:
       '@hapi/hoek': 11.0.7
 
-  '@hookform/resolvers@3.9.0(react-hook-form@file:..(react@19.0.0))':
+  '@hookform/resolvers@3.9.0(react-hook-form@file:..(@types/react@19.0.2)(react@19.0.0))':
     dependencies:
-      react-hook-form: file:..(react@19.0.0)
+      react-hook-form: file:..(@types/react@19.0.2)(react@19.0.0)
 
   '@jridgewell/gen-mapping@0.3.8':
     dependencies:
@@ -1697,7 +1701,7 @@ snapshots:
     dependencies:
       hasown: 2.0.2
 
-  joi@18.2.5:
+  joi@18.2.6:
     dependencies:
       '@hapi/address': 5.1.1
       '@hapi/formula': 3.0.2
@@ -1773,9 +1777,11 @@ snapshots:
       react: 19.0.0
       scheduler: 0.25.0
 
-  react-hook-form@file:..(react@19.0.0):
+  react-hook-form@file:..(@types/react@19.0.2)(react@19.0.0):
     dependencies:
       react: 19.0.0
+    optionalDependencies:
+      '@types/react': 19.0.2
 
   react-is@16.13.1: {}
 
```

---

### Incident Patch 10: `c4dc4456` (2026-09-29)
**Commit Message**: 🐞 fix(validate): read shouldUseNativeValidation from the current options when stopping at the first error (#13806)

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/useForm/handleSubmit.test.tsx` (modified, +82/-0)
```diff
@@ -9,6 +9,7 @@ import {
 } from '@testing-library/react';
 
 import { VALIDATION_MODE } from '../../constants';
+import { createFormControl } from '../../logic/createFormControl';
 import { useFieldArray } from '../../useFieldArray';
 import { useForm } from '../../useForm';
 import isFunction from '../../utils/isFunction';
@@ -332,6 +333,87 @@ describe('handleSubmit', () => {
     jest.useRealTimers();
   });
 
+  it('should stop at the first invalid field with native validation', async () => {
+    const { result } = renderHook(() =>
+      useForm<{ firstName: string; lastName: string }>({
+        shouldUseNativeValidation: true,
+      }),
+    );
+
+    result.current.register('firstName', { required: true });
+    result.current.register('lastName', { required: true });
+
+    await act(async () => {
+      await result.current.handleSubmit(noop)({
+        preventDefault: noop,
+        persist: noop,
+      } as React.SyntheticEvent);
+    });
+
+    expect(result.current.control._formState.errors.firstName?.type).toBe(
+      'required',
+    );
+    expect(result.current.control._formState.errors.lastName).toBeUndefined();
+  });
+
+  it('should stop at the first invalid field when native validation is set on useForm with a formControl', async () => {
+    const { formControl } = createFormControl<{
+      firstName: string;
+      lastName: string;
+    }>();
+
+    const { result } = renderHook(() =>
+      useForm<{ firstName: string; lastName: string }>({
+        formControl,
+        shouldUseNativeValidation: true,
+      }),
+    );
+
+    result.current.register('firstName', { required: true });
+    result.current.register('lastName', { required: true });
+
+    await act(async () => {
+      await result.current.handleSubmit(noop)({
+        preventDefault: noop,
+        persist: noop,
+      } as React.SyntheticEvent);
+    });
+
+    expect(result.current.control._formState.errors.firstName?.type).toBe(
+      'required',
+    );
+    expect(result.current.control._formState.errors.lastName).toBeUndefined();
+  });
+
+  it('should report every invalid field once native validation is turned off', async () => {
+    const { result, rerender } = renderHook(
+      ({ shouldUseNativeValidation }) =>
+        useForm<{ firstName: string; lastName: string }>({
+          shouldUseNativeValidation,
+        }),
+      { initialProps: { shouldUseNativeValidation: true } },
+    );
+
+    rerender({ shouldUseNativeValidation: false });
+
+    result.current.register('firstName', { required: true });
+    result.current.register('lastName', { required: true });
+
+    await act(async () => {
+      await result.current.handleSubmit(noop)({
+        preventDefault: noop,
+        persist: noop,
+      } as React.SyntheticEvent);
+    });
+
+    expect(result.current.control._formState.errors.firstName?.type).toBe(
+      'required',
+    );
+    expect(result.current.control._formState.errors.lastName?.type).toBe(
+      'required',
+    );
+  });
+
   it('should submit form data when inputs are removed', async () => {
     const { result, unmount } = renderHook(() =>
       useForm<{
```

**File**: `src/logic/createFormControl.ts` (modified, +1/-1)
```diff
@@ -901,7 +901,7 @@ export function createFormControl<
               : unset(_formState.errors, _f.name);
           }
 
-          if (props.shouldUseNativeValidation && fieldError[_f.name]) {
+          if (_options.shouldUseNativeValidation && fieldError[_f.name]) {
             break;
           }
         }
```

---

### Incident Patch 11: `0104fceb` (2026-09-29)
**Commit Message**: 🐞 fix(cloneObject): clone objects with a null prototype (#13808)

* 🐞 fix(cloneObject): clone objects with a null prototype

* Apply suggestion from @bluebill1049

---------

Co-authored-by: Bill <[REDACTED_EMAIL]>

**File**: `src/__tests__/logic/createFormControl.test.ts` (modified, +19/-0)
```diff
@@ -215,4 +215,23 @@ describe('createFormControl', () => {
     });
     expect(probeReads).toBe(1);
   });
+
+  it('should not share a null prototype defaultValues object with form values', () => {
+    const defaultValues = Object.assign(Object.create(null), {
+      name: '',
+    }) as { name: string };
+    const { control, register, setValue, getValues } = createFormControl({
+      defaultValues,
+    });
+
+    register('name');
+    control._state.mount = true;
+
+    setValue('name', 'changed');
+
+    expect(getValues('name')).toBe('changed');
+    expect(control._defaultValues.name).toBe('');
+    expect(defaultValues.name).toBe('');
+    expect(control._getDirty()).toBe(true);
+  });
 });
```

**File**: `src/__tests__/utils/cloneObject.test.ts` (modified, +18/-0)
```diff
@@ -221,4 +221,22 @@ describe('clone', () => {
     const copy = cloneObject(dateTime);
     expect(copy._tag).toBe('Utc');
   });
+
+  it('should clone object with null prototype', () => {
+    const data = Object.assign(Object.create(null), {
+      name: 'test',
+      nested: Object.assign(Object.create(null), { value: 1 }),
+    });
+    const copy = cloneObject(data);
+
+    expect(copy).not.toBe(data);
+    expect(copy.nested).not.toBe(data.nested);
+    expect(Object.getPrototypeOf(copy)).toBeNull();
+
+    copy.name = 'changed';
+    copy.nested.value = 2;
+
+    expect(data.name).toBe('test');
+    expect(data.nested.value).toBe(1);
+  });
 });
```

**File**: `src/utils/cloneObject.ts` (modified, +3/-2)
```diff
@@ -18,12 +18,13 @@ export default function cloneObject<T>(data: T): T {
   }
 
   const isArray = Array.isArray(data);
+  const prototype = Object.getPrototypeOf(data);
 
-  if (!isArray && (data as object).constructor !== Object) {
+  if (!isArray && prototype && (data as object).constructor !== Object) {
     return data;
   }
 
-  const copy = isArray ? [] : Object.create(Object.getPrototypeOf(data));
+  const copy = isArray ? [] : Object.create(prototype);
 
   for (const key in data) {
     if (Object.prototype.hasOwnProperty.call(data, key)) {
```

---

### Incident Patch 12: `31b1b011` (2026-09-29)
**Commit Message**: 🐞 fix(useWatch): prefer form defaultValues over the hook's own defaultValue for array names (#13805)

Before the form mounts, _getWatch used the hook's defaultValue as the whole value source when an array of names was passed, so useForm defaultValues were ignored and fields missing from the hook defaultValue resolved to undefined. Read from _defaultValues for any named watch and let generateWatchOutput fall back to the hook defaultValue per field, matching the single-name behaviour from #13635.

**File**: `src/__tests__/useWatch.test.tsx` (modified, +20/-0)
```diff
@@ -149,6 +149,26 @@ describe('useWatch', () => {
     expect(result.current).toEqual(['test', 'test1']);
   });
 
+  it('should prefer the form default values over its own default value for array of inputs', () => {
+    const { result } = renderHook(() => {
+      const { control } = useForm<{ test: string; test1: string }>({
+        defaultValues: {
+          test: 'form default',
+          test1: 'form default1',
+        },
+      });
+      return useWatch({
+        control,
+        name: ['test', 'test1'],
+        defaultValue: {
+          test: 'inline fallback',
+        },
+      });
+    });
+
+    expect(result.current).toEqual(['form default', 'form default1']);
+  });
+
   it('should keep its own default value for array of inputs after a value change', async () => {
     const Form = () => {
       const { control, setValue } = useForm<{ test: string; test1: string }>(
```

**File**: `src/logic/createFormControl.ts` (modified, +1/-1)
```diff
@@ -946,7 +946,7 @@ export function createFormControl<
   ) => {
     const values = _state.mount
       ? _formValues
-      : isUndefined(defaultValue) || isString(names)
+      : isUndefined(defaultValue) || !isUndefined(names)
         ? _defaultValues
         : defaultValue;
 
```

---

### Incident Patch 13: `d62c62b8` (2026-09-28)
**Commit Message**: 🐞 fix: produce a new errors reference from the remaining error updates (#13800)

* fix: produce a new errors reference from the remaining error updates

handleSubmit and trigger with built-in validation, resetField,
unregister and field array operations changed formState.errors in
place and emitted the same object, so React.memo children and React
Compiler output that read errors kept showing the previous errors.
Copy the object after changing it, as updateErrors, setError and
clearErrors already do.

* fix: produce a new errors reference from useFieldArray validation

The validation that useFieldArray runs after an array operation set or
cleared the array's errors on the existing formState.errors object and
emitted it again, in the resolver branch, the built-in branch and when
the root error is cleared. Copy the object before emitting it.

**File**: `src/__tests__/useForm/formState.test.tsx` (modified, +142/-1)
```diff
@@ -10,7 +10,13 @@ import {
 
 import { VALIDATION_MODE } from '../../constants';
 import { Controller } from '../../controller';
-import type { Control, FormState, UseFormGetFieldState } from '../../types';
+import type {
+  Control,
+  FormState,
+  UseFieldArrayReturn,
+  UseFormGetFieldState,
+  UseFormReturn,
+} from '../../types';
 import { useController } from '../../useController';
 import { useFieldArray } from '../../useFieldArray';
 import { useForm } from '../../useForm';
@@ -1914,6 +1920,141 @@ describe('formState', () => {
     expect(refAfterSecondError).not.toBe(refAfterCleared);
   });
 
+  type FormValues = { test: string; other: string; rows: { value: string }[] };
+  type Form = UseFormReturn<FormValues> & { remove: (index: number) => void };
+
+  it.each([
+    [
+      'handleSubmit',
+      'test',
+      (form: Form) => form.handleSubmit(noop)(),
+      'other',
+    ],
+    ['trigger', 'test', (form: Form) => form.trigger('test'), ''],
+    ['resetField', 'test', (form: Form) => form.resetField('test'), ''],
+    ['unregister', 'test', (form: Form) => form.unregister('test'), ''],
+    ['remove', 'rows.0.value', (form: Form) => form.remove(0), ''],
+  ] as const)(
+    'should produce a new errors reference after %s so memoized child components re-render',
+    async (_, errorName, action, expected) => {
+      const ErrorNames = React.memo(function ErrorNames({
+        errors,
+      }: {
+        errors: FormState<FormValues>['errors'];
+      }) {
+        return <p data-testid="error">{Object.keys(errors).join(',')}</p>;
+      });
+      let form = {} as Form;
+
+      function App() {
+        const methods = useForm<FormValues>({
+          defaultValues: { test: 'value', other: '', rows: [{ value: '' }] },
+        });
+        const { remove } = useFieldArray({
+          control: methods.control,
+          name: 'rows',
+        });
+        form = { ...methods, remove };
+
+        return (
+          <>
+            <input {...methods.register('test', { required: true })} />
+            <input {...methods.register('other', { required: true })} />
+            <ErrorNames errors={methods.formState.errors} />
+          </>
+        );
+      }
+
+      render(<App />);
+
+      act(() => form.setError(errorName, { type: 'server' }));
+      expect(screen.getByTestId('error').textContent).toBe(
+        errorName.split('.')[0],
+      );
+
+      await act(async () => {
+        await action(form);
+      });
+      expect(screen.getByTestId('error').textContent).toBe(expected);
+    },
+  );
+
+  type RowsValues = { rows: { value: string }[] };
+  const minRows = { value: 2, message: 'min' };
+
+  it.each([
+    [
+      'resolver validation',
+      {
+        resolver: async ({ rows }: RowsValues) =>
+          rows.length < minRows.value
+            ? { values: {}, errors: { rows: { type: 'min', message: 'min' } } }
+            : { values: { rows }, errors: {} },
+      },
+      false,
+      'min',
+    ],
+    ['built-in validation', { rules: { minLength: minRows } }, false, 'min'],
+    [
+      'built-in validation clearing the root error',
+      { rules: { minLength: minRows } },
+      true,
+      'none',
+    ],
+  ] as const)(
+    'should produce a new errors reference after useFieldArray %s so memoized child components re-render',
+    async (_, options, hasRootError, expected) => {
+      const RootError = React.memo(function RootError({
+        errors,
+      }: {
+        errors: FormState<RowsValues>['errors'];
+      }) {
+        return (
+          <p data-testid="error">
+            {(errors.rows && errors.rows.root && errors.rows.root.message) ||
+              'none'}
+          </p>
+        );
+      });
+      let form = {} as UseFormReturn<RowsValues> & {
+        fieldArray: UseFieldArrayReturn<RowsValues>;
+      };
+
+      function App() {
+        const methods = useForm<RowsValues>({
+          mode: 'onChange',
+          defaultValues: { rows: [{ value: 'a' }, { value: 'b' }] },
+          resolver: 'resolver' in options ? options.resolver : undefined,
+        });
+        const fieldArray = useFieldArray({
+          control: methods.control,
+          name: 'rows',
+          rules: 'rules' in options ? options.rules : undefined,
+        });
+        form = { ...methods, fieldArray };
+
+        return <RootError errors={methods.formState.errors} />;
+      }
+
+      render(<App />);
+
+      if (hasRootError) {
+        act(() => form.setError('rows.root', { type: 'min', message: 'min' }));
+        expect(screen.getByTestId('error').textContent).toBe('min');
+      }
+
+      act(() =>
+        hasRootError
+          ? form.fieldArray.append({ value: 'c' })
+          : form.fieldArray.remove(0),
+      );
+
+      await waitFor(() =>
+        expect(screen.getByTestId('error').textContent).toBe(expected),
+      );
+    },
+  );
+
   describe('with Activity', () => {
     itWithActivity(
       'should resync isSubmit
```

**File**: `src/logic/createFormControl.ts` (modified, +9/-0)
```diff
@@ -348,6 +348,7 @@ export function createFormControl<
 
         shouldSetValues && set(_formState.errors, name, errors);
         unsetEmptyArray(_formState.errors, name);
+        _formState.errors = { ..._formState.errors };
       }
 
       const touchedFieldsArray = get(_formState.touchedFields, name);
@@ -1509,6 +1510,8 @@ export function createFormControl<
       }
     }
 
+    _formState.errors = { ..._formState.errors };
+
     _subjects.state.next({
       ...(!isString(name) ||
       (_isTracked('isValid') && isValid !== _formState.isValid)
@@ -1763,6 +1766,10 @@ export function createFormControl<
         unset(_defaultValues, fieldName);
     }
 
+    if (!options.keepError) {
+      _formState.errors = { ..._formState.errors };
+    }
+
     _valuesSubscribers.size &&
       _subjects.state.next({
         values: cloneObject(_formValues),
@@ -1980,6 +1987,7 @@ export function createFormControl<
         }
 
         unset(_formState.errors, ROOT_ERROR_TYPE);
+        _formState.errors = { ..._formState.errors };
       }
 
       if (_names.disabled.size) {
@@ -2047,6 +2055,7 @@ export function createFormControl<
       if (!options.keepError) {
         cancelDelayedErrorTree(name);
         unset(_formState.errors, name);
+        _formState.errors = { ..._formState.errors };
         _setValid();
       }
 
```

**File**: `src/useFieldArray.ts` (modified, +9/-5)
```diff
@@ -427,6 +427,7 @@ export function useFieldArray<
             } else {
               unset(control._formState.errors, name);
             }
+            control._formState.errors = { ...control._formState.errors };
             control._subjects.state.next({
               errors: control._formState.errors as FieldErrors<TFieldValues>,
             });
@@ -444,18 +445,21 @@ export function useFieldArray<
             true,
           ).then((error) => {
             if (!isEmptyObject(error)) {
+              updateFieldArrayRootError(
+                control._formState.errors as FieldErrors<TFieldValues>,
+                error,
+                name,
+              );
+              control._formState.errors = { ...control._formState.errors };
               control._subjects.state.next({
-                errors: updateFieldArrayRootError(
-                  control._formState.errors as FieldErrors<TFieldValues>,
-                  error,
-                  name,
-                ) as FieldErrors<TFieldValues>,
+                errors: control._formState.errors as FieldErrors<TFieldValues>,
               });
             } else {
               const existingError = get(control._formState.errors, name);
 
               if (existingError && existingError[ROOT_ERROR_TYPE]) {
                 unset(control._formState.errors, `${name}.${ROOT_ERROR_TYPE}`);
+                control._formState.errors = { ...control._formState.errors };
                 control._subjects.state.next({
                   errors: control._formState
                     .errors as FieldErrors<TFieldValues>,
```

---

### Incident Patch 14: `dee20d69` (2026-09-27)
**Commit Message**:  🫓 save bytes: replace optional chaining and nullish coalescing (#13798)

**File**: `src/logic/createFormControl.ts` (modified, +5/-5)
```diff
@@ -590,7 +590,7 @@ export function createFormControl<
           const defaultFieldValue = get(_defaultValues, name);
           const field = get(_fields, name);
           const dirtyValue =
-            !field?._f &&
+            !(field && field._f) &&
             (isObject(defaultFieldValue) || Array.isArray(defaultFieldValue))
               ? getDirtyFields(defaultFieldValue, fieldValue, undefined, field)
               : true;
@@ -737,8 +737,7 @@ export function createFormControl<
               { [name]: error } as Partial<Record<string, FieldError>>,
               name,
             )
-          : error?.type ||
-              error?.message ||
+          : (error && (error.type || error.message)) ||
               Array.isArray(error) ||
               (isObject(error) && hasNestedFields)
             ? set(_formState.errors, name, error)
@@ -1673,7 +1672,8 @@ export function createFormControl<
 
   const _subscribe: FromSubscribe<TFieldValues> = (props) => {
     const valuesSubscriber = { name: props.name, exact: props.exact };
-    (props.formState as Record<string, unknown>)?.values &&
+    props.formState &&
+      props.formState.values &&
       _valuesSubscribers.add(valuesSubscriber);
     const { unsubscribe } = _subjects.state.subscribe({
       next: (
@@ -1692,7 +1692,7 @@ export function createFormControl<
           )
         ) {
           const values =
-            formState.values ?? ({ ..._formValues } as TFieldValues);
+            formState.values || ({ ..._formValues } as TFieldValues);
 
           props.callback({
             ..._formState,
```

**File**: `src/logic/schemaErrorLookup.ts` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ export default function schemaErrorLookup<T extends FieldValues = FieldValues>(
 } {
   const error = get(errors, name);
 
-  if (error?.type || error?.message || Array.isArray(error)) {
+  if ((error && (error.type || error.message)) || Array.isArray(error)) {
     return {
       error,
       name,
```

**File**: `src/logic/unsetEmptyArray.ts` (modified, +1/-1)
```diff
@@ -6,6 +6,6 @@ export default <T>(ref: T, name: string) => {
   const array = get(ref, name);
 
   !compact(array).length &&
-    !(array as { root?: unknown })?.root &&
+    !(array && (array as { root?: unknown }).root) &&
     unset(ref, name);
 };
```

**File**: `src/useFieldArray.ts` (modified, +5/-2)
```diff
@@ -399,10 +399,13 @@ export function useFieldArray<
           const error = get(result.errors, name);
           const existingError = get(control._formState.errors, name);
           const existingErrorType =
-            existingError && (existingError.type || existingError.root?.type);
+            existingError &&
+            (existingError.type ||
+              (existingError.root && existingError.root.type));
           const existingErrorMessage =
             existingError &&
-            (existingError.message || existingError.root?.message);
+            (existingError.message ||
+              (existingError.root && existingError.root.message));
 
           if (
             existingError
```

**File**: `src/useForm.ts` (modified, +7/-2)
```diff
@@ -141,7 +141,7 @@ export function useForm<
 
   React.useEffect(() => {
     if (_hadValidate.current && !props.validate) {
-      _formControl.current?.clearErrors(FORM_ERROR_TYPE);
+      _formControl.current && _formControl.current.clearErrors(FORM_ERROR_TYPE);
     }
     _hadValidate.current = !!props.validate;
   }, [props.validate]);
@@ -170,7 +170,12 @@ export function useForm<
         keepFieldsRef: true,
         ...control._options.resetOptions,
       });
-      if (!control._options.resetOptions?.keepIsValid) {
+      if (
+        !(
+          control._options.resetOptions &&
+          control._options.resetOptions.keepIsValid
+        )
+      ) {
         control._setValid();
       }
       _values.current = props.values;
```

---

### Incident Patch 15: `0d24669b` (2026-09-26)
**Commit Message**: 🐞 fix #13790: setError and clearErrors produce a new errors reference (#13791)

**File**: `src/__tests__/useForm/formState.test.tsx` (modified, +71/-0)
```diff
@@ -1843,6 +1843,77 @@ describe('formState', () => {
     expect(refAfterCleared).not.toBe(refAfterSecondError);
   });
 
+  it('should produce a new errors reference on setError and clearErrors so memoized child components re-render', async () => {
+    type FormValues = { test: string };
+    const errorRefs: object[] = [];
+
+    function ErrorDisplay({
+      errors,
+    }: {
+      errors: FormState<FormValues>['errors'];
+    }) {
+      errorRefs.push(errors);
+      return <p data-testid="error">{errors.test?.message ?? ''}</p>;
+    }
+
+    function App() {
+      const {
+        setError,
+        clearErrors,
+        formState: { errors },
+      } = useForm<FormValues>({
+        defaultValues: { test: '' },
+      });
+      return (
+        <>
+          <ErrorDisplay errors={errors} />
+          <button
+            type="button"
+            onClick={() =>
+              setError('test', { type: 'server', message: 'first' })
+            }
+          >
+            setFirst
+          </button>
+          <button
+            type="button"
+            onClick={() =>
+              setError('test', { type: 'server', message: 'second' })
+            }
+          >
+            setSecond
+          </button>
+          <button type="button" onClick={() => clearErrors('test')}>
+            clear
+          </button>
+        </>
+      );
+    }
+
+    render(<App />);
+
+    fireEvent.click(screen.getByRole('button', { name: 'setFirst' }));
+    await waitFor(() =>
+      expect(screen.getByTestId('error')).toHaveTextContent('first'),
+    );
+    const refAfterFirstError = errorRefs.at(-1);
+
+    fireEvent.click(screen.getByRole('button', { name: 'setSecond' }));
+    await waitFor(() =>
+      expect(screen.getByTestId('error')).toHaveTextContent('second'),
+    );
+    const refAfterSecondError = errorRefs.at(-1);
+
+    fireEvent.click(screen.getByRole('button', { name: 'clear' }));
+    await waitFor(() =>
+      expect(screen.getByTestId('error')).toHaveTextContent(''),
+    );
+    const refAfterCleared = errorRefs.at(-1);
+
+    expect(refAfterFirstError).not.toBe(refAfterSecondError);
+    expect(refAfterSecondError).not.toBe(refAfterCleared);
+  });
+
   describe('with Activity', () => {
     itWithActivity(
       'should resync isSubmitting after Activity restoration when a submit resolves while hidden',
```

**File**: `src/logic/createFormControl.ts` (modified, +2/-0)
```diff
@@ -1566,6 +1566,7 @@ export function createFormControl<
       names.forEach((inputName) => {
         cancelDelayedErrorTree(inputName);
         unset(_formState.errors, inputName);
+        _formState.errors = { ..._formState.errors };
         _subjects.state.next({
           name: inputName,
           errors: _formState.errors,
@@ -1599,6 +1600,7 @@ export function createFormControl<
       ...error,
       ref,
     });
+    _formState.errors = { ..._formState.errors };
 
     _subjects.state.next({
       name,
```

#### Recent Merged Pull Requests:
- **PR #13829** (2026-10-04): test(swap): cover self-index no-op behaviour (@zigzagdev)
- **PR #13828** (2026-10-04): 🐞 fix(useFieldArray): skip unregister while a parent array reindexes (@charan-rathore)
- **PR #13827** (2026-10-04): 🐞 fix #13802: keep input edited before the form is ready (@AdzerKI)
- **PR #13826** (2026-10-03): improve rc compatible (@bluebill1049)
- **PR #13824** (2026-10-03): test(useFieldArray): cover `insert()` index boundary behaviour (negative, out-of-range) (@zigzagdev)
- **PR #13823** (2026-10-03): ⚡️perf(subscribe): avoid allocations when matching subscription names (@bluebill1049)
- **PR #13822** (2026-10-03): test(insert): cover index boundary behavior (start, negative, out-of-range) (@zigzagdev)
- **PR #13821** (2026-10-02): 🧪 test(json): cover safeJSON stringify and parse edge cases (@kory-kaai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
