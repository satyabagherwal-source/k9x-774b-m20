# Forensic Learning Record (Deep Inspection): chakra-ui/chakra-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/chakra-ui-chakra-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chakra-ui/chakra-ui](https://github.com/chakra-ui/chakra-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:11:54.051Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chakra-ui/chakra-ui`
- **Description**: Chakra UI is a component system for building SaaS products with speed ⚡️
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 40677 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/compositions/src/examples/checkbox-card-with-states.tsx`
```
import { CheckboxCard, Stack } from "@chakra-ui/react"

export const CheckboxCardWithStates = () => {
  return (
    <Stack>
      <DemoCheckboxCard />
      <DemoCheckboxCard defaultChecked />
      <DemoCheckboxCard disabled />
      <DemoCheckboxCard defaultChecked disabled />
      <DemoCheckboxCard invalid />
    </Stack>
  )
}

const DemoCheckboxCard = (props: CheckboxCard.RootProps) => {
  return (
    <CheckboxCard.Root maxW="240px" {...props}>
      <CheckboxCard.HiddenInput />
      <CheckboxCard.Control>
        <CheckboxCard.Content>
          <CheckboxCard.Label>Next.js</CheckboxCard.Label>
          <CheckboxCard.Description>Best for apps</CheckboxCard.Description>
        </CheckboxCard.Content>
        <CheckboxCard.Indicator />
      </CheckboxCard.Control>
    </CheckboxCard.Root>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/checkbox-with-group-hook-form.tsx`
```
"use client"

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Code,
  Fieldset,
} from "@chakra-ui/react"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { useController, useForm } from "react-hook-form"
import { z } from "zod"

const formSchema = z.object({
  framework: z.array(z.string()).min(1, {
    message: "You must select at least one framework.",
  }),
})

type FormData = z.infer<typeof formSchema>

const items = [
  { label: "React", value: "react" },
  { label: "Svelte", value: "svelte" },
  { label: "Vue", value: "vue" },
  { label: "Angular", value: "angular" },
]

export const CheckboxWithGroupHookForm = () => {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(formSchema),
  })

  const framework = useController({
    control,
    name: "framework",
    defaultValue: [],
  })

  const invalid = !!errors.framework

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <Fieldset.Root invalid={invalid}>
        <Fieldset.Legend>Select your framework</Fieldset.Legend>
        <CheckboxGroup
          invalid={invalid}
          value={framework.field.value}
          onValueChange={framework.field.onChange}
          name={framework.field.name}
        >
          <Fieldset.Content>
            {items.map((item) => (
              <Checkbox.Root key={item.value} value={item.value}>
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>{item.label}</Checkbox.Label>
              </Checkbox.Root>
            ))}
          </Fieldset.Content>
        </CheckboxGroup>

        {errors.framework && (
          <Fieldset.ErrorText>{errors.framework.message}</Fieldset.ErrorText>
        )}

        <Button size="sm" type="submit" alignSelf="flex-start">
          Submit
        </Button>

        <Code>Values: {JSON.stringify(framework.field.value, null, 2)}</Code>
      </Fieldset.Root>
    </form>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/checkbox-with-hook-form.tsx`
```
"use client"

import { Button, Checkbox, Code, Field, HStack, Stack } from "@chakra-ui/react"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Controller, useController, useForm } from "react-hook-form"
import { z } from "zod"

const formSchema = z.object({
  enabled: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

export const CheckboxWithHookForm = () => {
  const form = useForm<FormData>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { enabled: false },
  })

  const enabled = useController({
    control: form.control,
    name: "enabled",
  })

  const invalid = !!form.formState.errors.enabled

  return (
    <form onSubmit={form.handleSubmit((data) => console.log(data))}>
      <Stack align="flex-start">
        <Controller
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <Field.Root invalid={invalid} disabled={field.disabled}>
              <Checkbox.Root
                checked={field.value}
                onCheckedChange={({ checked }) => field.onChange(checked)}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>Checkbox</Checkbox.Label>
              </Checkbox.Root>
              <Field.ErrorText>
                {form.formState.errors.enabled?.message}
              </Field.ErrorText>
            </Field.Root>
          )}
        />

        <HStack>
          <Button
            size="xs"
            variant="outline"
            onClick={() => form.setValue("enabled", !enabled.field.value)}
          >
            Toggle
          </Button>
          <Button size="xs" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
        </HStack>

        <Button size="sm" type="submit" alignSelf="flex-start">
          Submit
        </Button>

        <Code>Checked: {JSON.stringify(enabled.field.value, null, 2)}</Code>
      </Stack>
    </form>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/checkbox-with-states.tsx`
```
import { Checkbox, Stack } from "@chakra-ui/react"

export const CheckboxWithStates = () => {
  return (
    <Stack>
      <Checkbox.Root disabled>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Disabled</Checkbox.Label>
      </Checkbox.Root>

      <Checkbox.Root defaultChecked disabled>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Disabled</Checkbox.Label>
      </Checkbox.Root>

      <Checkbox.Root readOnly>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Readonly</Checkbox.Label>
      </Checkbox.Root>

      <Checkbox.Root invalid>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Invalid</Checkbox.Label>
      </Checkbox.Root>
    </Stack>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/checkmark-states.tsx`
```
import { Checkmark, HStack } from "@chakra-ui/react"

export const CheckmarkStates = () => {
  return (
    <HStack gap={3}>
      <Checkmark />
      <Checkmark checked />
      <Checkmark indeterminate />
      <Checkmark disabled />
      <Checkmark checked disabled />
      <Checkmark indeterminate disabled />
    </HStack>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/client-only-render-prop.tsx`
```
"use client"

import { ClientOnly, Code, Skeleton, Stack, Text } from "@chakra-ui/react"

export const ClientOnlyRenderProp = () => {
  return (
    <ClientOnly fallback={<Skeleton height="12" width="full" maxW="sm" />}>
      {() => (
        <Stack align="flex-start" gap="1" textStyle="sm">
          <Text>
            Current URL: <Code>{window.location.href}</Code>
          </Text>
          <Text>
            Screen width: <Code>{window.innerWidth}px</Code>
          </Text>
        </Stack>
      )}
    </ClientOnly>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/color-picker-with-hook-form.tsx`
```
"use client"

import {
  Button,
  ColorPicker,
  HStack,
  Portal,
  Stack,
  parseColor,
} from "@chakra-ui/react"
import { Controller, useForm } from "react-hook-form"

interface FormValues {
  color: string
}

export const ColorPickerWithHookForm = () => {
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { color: "#000000" },
  })

  const onSubmit = handleSubmit((data) => console.log(data))

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="4" align="flex-start" maxW="sm">
        <Controller
          name="color"
          control={control}
          render={({ field }) => (
            <ColorPicker.Root
              name={field.name}
              defaultValue={parseColor(field.value)}
              onValueChange={(e) => field.onChange(e.valueAsString)}
            >
              <ColorPicker.HiddenInput />
              <ColorPicker.Control>
                <ColorPicker.Input />
                <ColorPicker.Trigger />
              </ColorPicker.Control>
              <Portal>
                <ColorPicker.Positioner>
                  <ColorPicker.Content>
                    <ColorPicker.Area />
                    <HStack>
                      <ColorPicker.EyeDropper size="sm" variant="outline" />
                      <ColorPicker.Sliders />
                    </HStack>
                  </ColorPicker.Content>
                </ColorPicker.Positioner>
              </Portal>
            </ColorPicker.Root>
          )}
        />

        <Button type="submit">Submit</Button>
      </Stack>
    </form>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/combobox-with-hook-form.tsx`
```
"use client"

import {
  Button,
  Combobox,
  Field,
  Portal,
  Stack,
  useFilter,
  useListCollection,
} from "@chakra-ui/react"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

const formSchema = z.object({
  framework: z.string({ message: "Framework is required" }).min(1),
})

type FormValues = z.infer<typeof formSchema>

export const ComboboxWithHookForm = () => {
  const {
    handleSubmit,
    formState: { errors },
    control,
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
  })

  const onSubmit = handleSubmit((data) => {
    console.log("Form submitted with:", data)
    alert(`Selected framework: ${data.framework}`)
  })

  const { contains } = useFilter({ sensitivity: "base" })

  const { collection, filter } = useListCollection({
    initialItems: frameworks,
    filter: contains,
  })

  const handleInputChange = (details: Combobox.InputValueChangeDetails) => {
    filter(details.inputValue)
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="4" align="flex-start">
        <Field.Root invalid={!!errors.framework} width="320px">
          <Field.Label>Framework</Field.Label>
          <Controller
            control={control}
            name="framework"
            render={({ field }) => (
              <Combobox.Root
                collection={collection}
                value={field.value ? [field.value] : []}
                onValueChange={({ value }) => field.onChange(value[0] || "")}
                onInputValueChange={handleInputChange}
                onInteractOutside={() => field.onBlur()}
              >
                <Combobox.Control>
                  <Combobox.Input placeholder="Select framework" />
                  <Combobox.IndicatorGroup>
                    <Combobox.ClearTrigger />
                    <Combobox.Trigger />
                  </Combobox.IndicatorGroup>
                </Combobox.Control>

                <Portal>
                  <Combobox.Positioner>
                    <Combobox.Content>
                      <Combobox.Empty>No frameworks found</Combobox.Empty>
                      {collection.items.map((item) => (
                        <Combobox.Item key={item.value} item={item}>
                          {item.label}
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      ))}
                    </Combobox.Content>
                  </Combobox.Positioner>
                </Portal>
              </Combobox.Root>
            )}
          />
          <Field.ErrorText>{errors.framework?.message}</Field.ErrorText>
        </Field.Root>

        <Button size="sm" type="submit">
          Submit
        </Button>
      </Stack>
    </form>
  )
}

const frameworks = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Angular", value: "angular" },
  { label: "Svelte", value: "svelte" },
  { label: "Solid", value: "solid" },
  { label: "Qwik", value: "qwik" },
  { label: "Lit", value: "lit" },
  { label: "Alpine", value: "alpine" },
]

```

### Core Architecture Module: `apps/compositions/src/examples/date-input-with-hook-form.tsx`
```
"use client"

import { Button, DateInput, Field, Input, Stack } from "@chakra-ui/react"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  dob: z.array(z.any()).min(1, { message: "Date of birth is required" }),
})

type FormValues = z.infer<typeof formSchema>

export const DateInputWithHookForm = () => {
  const { handleSubmit, control, formState } = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { dob: [] },
  })

  const onSubmit = handleSubmit((data) => console.log(data))

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="4" align="flex-start" maxW="sm">
        <Field.Root invalid={!!formState.errors.name}>
          <Field.Label>Name</Field.Label>
          <Input placeholder="Enter your name" />
          <Field.ErrorText>{formState.errors.name?.message}</Field.ErrorText>
        </Field.Root>
        <Field.Root invalid={!!formState.errors.dob}>
          <Controller
            control={control}
            name="dob"
            render={({ field }) => (
              <DateInput.Root
                value={field.value}
                onValueChange={(e) => field.onChange(e.value)}
                invalid={!!formState.errors.dob}
              >
                <DateInput.Label>Date of birth</DateInput.Label>
                <DateInput.Control>
                  <DateInput.Segments />
                </DateInput.Control>
                <DateInput.HiddenInput />
              </DateInput.Root>
            )}
          />
          <Field.ErrorText>{formState.errors.dob?.message}</Field.ErrorText>
        </Field.Root>
        <Button type="submit">Submit</Button>
      </Stack>
    </form>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/date-picker-with-hook-form.tsx`
```
"use client"

import {
  Button,
  DatePicker,
  Field,
  Input,
  Portal,
  Stack,
} from "@chakra-ui/react"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { parseDate } from "@internationalized/date"
import { Controller, useForm } from "react-hook-form"
import { LuCalendar } from "react-icons/lu"
import { z } from "zod"

const formSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }),
  dob: z.string().min(1, { message: "Date of birth is required" }),
})

type FormValues = z.infer<typeof formSchema>

export const DatePickerWithHookForm = () => {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(formSchema),
  })

  const onSubmit = handleSubmit((data) => alert(JSON.stringify(data)))

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="4" align="flex-start" maxW="sm">
        <Field.Root invalid={!!errors.firstName}>
          <Field.Label>First name</Field.Label>
          <Input {...register("firstName")} />
          <Field.ErrorText>{errors.firstName?.message}</Field.ErrorText>
        </Field.Root>

        <Controller
          control={control}
          name="dob"
          render={({ field }) => (
            <Field.Root invalid={!!errors.dob}>
              <DatePicker.Root
                value={field.value ? [parseDate(field.value)] : []}
                onValueChange={(e) =>
                  field.onChange(e.value[0]?.toString() ?? "")
                }
                invalid={!!errors.dob}
              >
                <DatePicker.Label>Date of birth</DatePicker.Label>
                <DatePicker.Control>
                  <DatePicker.Input placeholder="Select date" />
                  <DatePicker.IndicatorGroup>
                    <DatePicker.Trigger>
                      <LuCalendar />
                    </DatePicker.Trigger>
                  </DatePicker.IndicatorGroup>
                </DatePicker.Control>
                <Portal>
                  <DatePicker.Positioner>
                    <DatePicker.Content>
                      <DatePicker.View view="day">
                        <DatePicker.Header />
                        <DatePicker.DayTable />
                      </DatePicker.View>
                      <DatePicker.View view="month">
                        <DatePicker.Header />
                        <DatePicker.MonthTable />
                      </DatePicker.View>
                      <DatePicker.View view="year">
                        <DatePicker.Header />
                        <DatePicker.YearTable />
                      </DatePicker.View>
                    </DatePicker.Content>
                  </DatePicker.Positioner>
                </Portal>
              </DatePicker.Root>
              <Field.ErrorText>{errors.dob?.message}</Field.ErrorText>
            </Field.Root>
          )}
        />

        <Button size="sm" type="submit">
          Submit
        </Button>
      </Stack>
    </form>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/empty-state-basic.tsx`
```
import { EmptyState, VStack } from "@chakra-ui/react"
import { LuShoppingCart } from "react-icons/lu"

export const EmptyStateBasic = () => {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator>
          <LuShoppingCart />
        </EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>Your cart is empty</EmptyState.Title>
          <EmptyState.Description>
            Explore our products and add items to your cart
          </EmptyState.Description>
        </VStack>
      </EmptyState.Content>
    </EmptyState.Root>
  )
}

```

### Core Architecture Module: `apps/compositions/src/examples/empty-state-closed-component.tsx`
```
import { EmptyState as ChakraEmptyState, VStack } from "@chakra-ui/react"
import * as React from "react"

export interface EmptyStateProps extends ChakraEmptyState.RootProps {
  title: string
  description?: string
  icon?: React.ReactNode
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(props, ref) {
    const { title, description, icon, children, ...rest } = props
    return (
      <ChakraEmptyState.Root ref={ref} {...rest}>
        <ChakraEmptyState.Content>
          {icon && (
            <ChakraEmptyState.Indicator>{icon}</ChakraEmptyState.Indicator>
          )}
          {description ? (
            <VStack textAlign="center">
              <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
              <ChakraEmptyState.Description>
                {description}
              </ChakraEmptyState.Description>
            </VStack>
          ) : (
            <ChakraEmptyState.Title>{title}</ChakraEmptyState.Title>
          )}
          {children}
        </ChakraEmptyState.Content>
      </ChakraEmptyState.Root>
    )
  },
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11015** (2026-09-24): **fix(scroll-area): hide each scrollbar based on its own axis**
  *Symptoms*: Closes #11014  ## 📝 Description  The `scrollbar` slot only hid itself when neither axis overflowed. Zag stamps both `data-overflow-x` and `data-overflow-y` on every scrollbar regardless of orientation, so with horizontal-only overflow the vertical bar still matched, stayed visible, and its thumb was clamped to `MIN_THUMB_SIZE` (20px).  Each bar is now hidden from its own axis — `_vertical` checks `data-overflow-y`, `_horizontal` checks `data-overflow-x` — which is what Zag's reference CSS does. Applied to both the React theme recipe and the Panda preset recipe so the two stay in sync, plus a changeset.  ## ⛳️ Current behavior (updates)  With content wider than the viewport but not taller, a 20px vertical thumb renders at the top of the right edge.  ## 🚀 New behavior  Only the bar belonging to the axis that actually overflows is shown.  ## 💣 Is this a breaking change (Yes/No):  No.  ## 📝 Additional Information  Verified by running `panda cssgen` against the preset: before, the only hide rule emitted was `.scroll-area__scrollbar:not([data-overflow-x], [data-overflow-y])`; after, it emits `.scroll-area__scrollbar[data-orientation=vertical]:not([data-overflow-y])` and `.scroll-area__scrollbar[data-orientation=horizontal]:not([data-overflow-x])`. `vitest run packages/react/__tests__` passes (34 files, 205 tests).   <!-- greptile_comment -->  <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=67743469"><picture><source media="(prefers-color-scheme
  **Post-Mortem & Fix Analysis**:
  > [vc]: #XtKiXnyCgDSDrK01TKoABc0JPxSwNGc277qr61lN2ao=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjaGFrcmEtdjMtZG9jcyIsInByb2plY3RJZCI6InByal9iVVd3VWJsb0RkTHpvYWw2bEpSRFF0bGxCUEc2IiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93d3ciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2hha3JhLXVpL2NoYWtyYS12My1kb2NzL0Z2VVVhdkF4aTRiZDJ1NDliNTllQWRwbmc3eEoiLCJwcmV2aWV3VXJsIjoiY2hha3JhLXYzLWRvY3MtZ2l0LWZvcmstbWl4ZWxidXJnLWZpeC1zY3JvbGwtYS0yYjE0MTMtY2hha3JhLXVpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJjaGFrcmEtdWktc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX1NQQzF4Znh4aXhFSWhKZVlUNXh1Zzd4OTZMNnkiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvY2hha3JhLXVpLXN0b3J5Ym9vay83d2IzanZnZVl6M0YzaEZ2RllmOFlzNnpTSE0zIiwicHJldmlld1VybCI6ImNoYWtyYS11aS1zdG9yeWJvb2stZ2l0LWZvcmstbWl4ZWxidXJnLWZpeC1zY3ItZWZjNWJkLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJs
  > ### 🦋 Changeset detected  Latest commit: dfdd13233c6a2cd379c0cb528ba737546dab6f21  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 6 packages</summary>    | Name                    | Type  | | ----------------------- | ----- | | @chakra-ui/react        | Patch | | @chakra-ui/panda-preset | Patch | | @chakra-ui/charts       | Patch | | @chakra-ui/cli          | Patch | | @chakra-ui/codemod      | Patch | | tanstack-router-ts      | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/mixelburg/chakra-ui/new/fix/scroll-area-hide-by-orientation?filename=.changeset/mighty-queens-happen.md&value=---%0A%22%40chakra-ui%2Fpanda-preset%22%3A%20patch%0A%22%40chakra-ui%2Freact%22%3A%20patch%0A---%0A%0Afix(scroll-area)%3A%20hide%20each%20scrollbar%20base
  > Added a regression test for the new visibility contract in `packages/react/__tests__/scroll-area-recipe.test.ts`.  It pins the two per-axis rules (`_vertical` → `&:not([data-overflow-y])`, `_horizontal` → `&:not([data-overflow-x])`) and asserts the old combined rule is gone — for the React recipe and the Panda preset recipe alike, so selector drift between the two fails the suite instead of quietly bringing the phantom thumb back. Checked both directions locally: removing either rule turns the test red, restoring it turns it green.  `vitest run packages/react/__tests__` → 35 files, 207 tests passing. 

- **Issue #11014** (2026-09-24): **ScrollArea: vertical scrollbar with a 20px thumb is shown when content overflows horizontally only**
  *Symptoms*: ### Description  ScrollArea renders a visible vertical scrollbar (with a 20px minimum-size thumb) when the content overflows horizontally only.  The `scrollbar` slot in `packages/react/src/theme/recipes/scroll-area.ts:44-46` hides a bar only when neither axis overflows:  ```ts "&:not([data-overflow-x], [data-overflow-y])": {   display: "none", }, ```  Zag stamps both attributes on every scrollbar regardless of `data-orientation` (`packages/machines/scroll-area/src/scroll-area.connect.ts:139-140`):  ```ts "data-overflow-x": dataAttr(!hiddenState.scrollbarXHidden), "data-overflow-y": dataAttr(!hiddenState.scrollbarYHidden), ```  With X overflow only, the vertical scrollbar still carries `data-overflow-x`, the `:not()` does not match, and the bar renders. `setThumbSize` then computes `nextHeight * ratioY = 0` and clamps it with `Math.max(MIN_THUMB_SIZE, …)` (`scroll-area.machine.ts`, `MIN_THUMB_SIZE = 20`), producing a 20px thumb at the top of a full-height track.  Zag's own reference CSS scopes the rule per orientation (`shared/src/css/scroll-area.css`):  ```css &[data-orientation="vertical"] {   &:not([data-overflow-y]) { display: none } } ```  Proposed fix: move the hide rule out of the `scrollbar` base and into the orientation conditions — `_vertical: { "&:not([data-overflow-y])": { display: "none" } }` and `_horizontal: { "&:not([data-overflow-x])": { display: "none" } }`.  Measured on the reproduction (viewport `scrollWidth 640 / clientWidth 320`, `scrollHeight 192 / clien

- **Issue #11012** (2026-09-21): **docs(checkbox): fix controlled example with RootProvider**
  *Symptoms*: Closes #11008  ## 📝 Description  The controlled checkbox example on the Checkbox docs page was incorrect.  ## ⛳️ Current behavior (updates)  The example nested `Checkbox.Root` inside `Checkbox.RootProvider`. `RootProvider` already renders the root element and supplies the `useCheckbox` store as context, so the nested `Root` is invalid.  ## 🚀 New behavior  The checkbox parts render directly under `Checkbox.RootProvider`.  ## 💣 Is this a breaking change (Yes/No):  No  ## 📝 Additional Information   <!-- greptile_comment -->  <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=66848973"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  The PR appears safe to merge because the revised composition matches the provider API and the generated example remains synchronized.  <details><summary>Summary</summary>  This PR corrects the controlled checkbox store example by removing the redundant `Checkbox.Root` nested inside `Checkbox.RootProvider`. - Renders `HiddenInput`, `Control`, and `Label` directly under the provider-backed root. - Updates the public example registry to remain synchro
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NGIdPVyWQ5pXcExaXBoOGm/asjGkmFtuhPbT5wMuuNA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjaGFrcmEtdjMtZG9jcyIsInByb2plY3RJZCI6InByal9iVVd3VWJsb0RkTHpvYWw2bEpSRFF0bGxCUEc2IiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93d3ciLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vY2hha3JhLXVpL2NoYWtyYS12My1kb2NzLzR6bW9wZDd2S0xBd0ZrWDdCbjV3WUo1cmFKQnAiLCJwcmV2aWV3VXJsIjoiY2hha3JhLXYzLWRvY3MtZ2l0LWZvcmstYWRlYmVzaW4tY2VsbC1maXgtY2hlYy1jMDU0MmQtY2hha3JhLXVpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJjaGFrcmEtdWktc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX1NQQzF4Znh4aXhFSWhKZVlUNXh1Zzd4OTZMNnkiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvY2hha3JhLXVpLXN0b3J5Ym9vay9FekZLc0FTeDduS0phVWZORzh4Sjlhb2dvY283IiwicHJldmlld1VybCI6ImNoYWtyYS11aS1zdG9yeWJvb2stZ2l0LWZvcmstYWRlYmVzaW4tY2VsbC1maXgtZDk0M2IxLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJs
  > ### ⚠️ No Changeset found  Latest commit: d260691618d6c370c34730dd18546830f47b15e6  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/Adebesin-Cell/chakra-ui/new/fix-checkbox-store-example?filename=.changeset/two-rabbits-sing.md&value=---%0A%22%40chakra-ui%2Fcompositions%22%3A%20patch%0A%22%40chakra-ui%2Fwww%22%3A%20patch%0A---%0A%0Adocs(checkbox)%3A%20fix%20controlled%20example%20with%20RootProvider%0A)  

- **Issue #11011** (2026-09-21): **fix(react): stop tabs from clicking link triggers on programmatic value change**
  *Symptoms*: Closes #11003  ## 📝 Description  When `Tabs.Root` is controlled and `value` changes programmatically, the tabs machine now stays silent instead of dispatching a synthetic click on the newly selected trigger. This prevents unintended hard navigation when triggers are rendered `asChild` onto anchors (e.g. links driven by the URL segment).  ## ⛳️ Current behavior (updates)  Every change of the controlled `value` (including prop sync, not just user interaction) triggers `navigateIfNeeded` in the tabs machine, which calls the default `navigate` prop — `clickIfLink` — dispatching a `MouseEvent("click")` that is **non-bubbling and non-cancelable** on the anchor trigger.  As a result, when a trigger is an anchor, the browser follows its `href` as a full document navigation:  - React's delegated handlers never see the event (no bubbling), so consumer `onClick` handlers do not run. - `preventDefault()` is impossible (`cancelable: false`), so nothing can stop the navigation. - `activationMode="manual"` does not help — this is value-sync, not keyboard activation.  In Next.js App Router this breaks client-side navigation entirely: `router.push` updates the URL, the machine reacts by clicking the matching trigger, and the document navigation supersedes the in-flight RSC navigation.  ## 🚀 New behavior  `TabsRoot` now provides a default machine prop `navigate: () => {}`, so the machine no longer clicks link triggers on programmatic value changes:  - Changing `value` p
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: e0d8f8b36b0ee779a5c9e403310c55049fdddd37  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 6 packages</summary>    | Name                    | Type  | | ----------------------- | ----- | | @chakra-ui/react        | Patch | | @chakra-ui/charts       | Patch | | @chakra-ui/cli          | Patch | | @chakra-ui/codemod      | Patch | | tanstack-router-ts      | Patch | | @chakra-ui/panda-preset | Patch |  </details>  Not sure what this means? [Click here to learn what changesets are](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/AlexRixten/chakra-ui/new/fix/tabs-programmatic-selection-click?filename=.changeset/calm-mangos-dress.md&value=---%0A%22%40chakra-ui%2Freact%22%3A%20patch%0A---%0A%0Afix(react)%3A%20stop%20tabs%20from%20clicking%20link%20triggers%20on%20programmatic%20value%20chang
  > [vc]: #1SutltdNQuVYzWNI3XCUMGDk//OOWPy5HcNzgXbRJW4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjaGFrcmEtdWktc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX1NQQzF4Znh4aXhFSWhKZVlUNXh1Zzd4OTZMNnkiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvY2hha3JhLXVpLXN0b3J5Ym9vay82YnB0SGpFQjl4R0dMV3pZQnJXYlRYZko5TkVOIiwicHJldmlld1VybCI6ImNoYWtyYS11aS1zdG9yeWJvb2stZ2l0LWZvcmstYWxleHJpeHRlbi1maXgtdGEtYjIxODRjLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoiY2hha3JhLXYzLWRvY3MiLCJwcm9qZWN0SWQiOiJwcmpfYlVXd1VibG9EZEx6b2FsNmxKUkRRdGxsQlBHNiIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6ImFwcHMvd3d3IiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NoYWtyYS11aS9jaGFrcmEtdjMtZG9jcy9Bakhkc0xBeE03R1RiUFAxazY1RWFtU1lEVkJGIiwicHJldmlld1VybCI6ImNoYWtyYS12My1kb2NzLWdpdC1mb3JrLWFsZXhyaXh0ZW4tZml4LXRhYnMtcHItNzA0NmNjLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJs
  > This should be fixed or checked in Zag.js not here in Chakra.

- **Issue #11006** (2026-09-20): **accessibility: color contrast insufficient to pass AA**
  *Symptoms*: ### Description  When running accessibility checker tools (ex: WAVE), there is very low contrast between text and background colors on the following elements:  Light Mode: - fg.warning - fg.subtle - fg.error - fg.success  Dark Mode: - fg.subtle    ### Link to Reproduction  https://chakra-ui.com/docs/theming/colors  ### Steps to reproduce  1. Go to '...' 2. Click on '...' 3. Scroll down to '...' 4. See error   ### Chakra UI Version  3.37.0  ### Browser  Chrome  ### Operating System  - [x] macOS - [ ] Windows - [ ] Linux  ### Additional Information  This ends up affecting buttons, which I have been working around by updating the theme:  ```ts const buttonRecipe = defineRecipe({   compoundVariants: [     {       colorPalette: "teal",       variant: "solid",       css: {         bg: "teal.700",         _hover: { bg: "teal.700/90" },         _expanded: { bg: "teal.700/90" },       },     },     {       colorPalette: "cyan",       variant: "solid",       css: {         bg: "cyan.700",         _hover: { bg: "cyan.700/90" },         _expanded: { bg: "cyan.700/90" },       },     },     {       colorPalette: "green",       variant: "solid",       css: {         bg: "green.700",         _hover: { bg: "green.700/90" },         _expanded: { bg: "green.700/90" },       },     },     {       colorPalette: "orange",       variant: "solid",       css: {         bg: "orange.700",         _dark: { bg: "orange.500" },         _hover: { bg: "orange.700/90" },         _expanded: { bg: "orange.700

- **Issue #11005** (2026-09-15): **fix(www): add "use client" to pagination custom format example**
  *Symptoms*: Closes #  ## 📝 Description  Adds `"use client"` to the pagination custom-format example so the docs build can prerender `/docs/components/pagination`.  ## ⛳️ Current behavior (updates)  The `PaginationWithCustomFormat` example passes a `format` function to `Pagination.PageText`. Without `"use client"`, the file is a Server Component, so the function can't be serialized across the RSC boundary and the docs build fails while prerendering the page:  ``` Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".   {flex: "1", format: function format} ```  ## 🚀 New behavior  Marking the example as a client component keeps the function inside the client boundary, matching every other example that passes an inline callback. The page prerenders and the docs build passes.  ## 💣 Is this a breaking change (Yes/No):  No  ## 📝 Additional Information   <!-- greptile_comment -->  <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=64434668"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a>Confidence Score: 5/5</h2>  The PR appears safe to merge and
  **Post-Mortem & Fix Analysis**:
  > [vc]: #qNIPJ9VFdLz3g1CFF7hV/+mRtrOziuk6OTxydMDhrqQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjaGFrcmEtdWktc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX1NQQzF4Znh4aXhFSWhKZVlUNXh1Zzd4OTZMNnkiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvY2hha3JhLXVpLXN0b3J5Ym9vay81UUttOGN4TVNXUHY0WXQ4WUoxWFJDRHNoTTNaIiwicHJldmlld1VybCI6ImNoYWtyYS11aS1zdG9yeWJvb2stZ2l0LWZvcmstYWRlYmVzaW4tY2VsbC1maXgtYzZmZGFjLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoiY2hha3JhLXYzLWRvY3MiLCJwcm9qZWN0SWQiOiJwcmpfYlVXd1VibG9EZEx6b2FsNmxKUkRRdGxsQlBHNiIsInYwIjpmYWxzZSwicm9vdERpcmVjdG9yeSI6ImFwcHMvd3d3IiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NoYWtyYS11aS9jaGFrcmEtdjMtZG9jcy9VQWtCTHFqdEszRHpKbXB0VjlLTllLd3JkaHQ5IiwicHJldmlld1VybCI6ImNoYWtyYS12My1kb2NzLWJmczRrZTVrMS1jaGFrcmEtdWkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwt
  > ### ⚠️ No Changeset found  Latest commit: 2a700688a91062e127a8af7ea261e100c8260220  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/Adebesin-Cell/chakra-ui/new/fix/pagination-custom-format-use-client?filename=.changeset/dull-ghosts-invent.md&value=---%0A%22%40chakra-ui%2Fcompositions%22%3A%20patch%0A---%0A%0Afix(www)%3A%20add%20%22use%20client%22%20to%20pagination%20custom%20format%20example%0A)  

- **Issue #11004** (2026-10-02): **CSOAI — Chakra UI AI governance**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #11001** (2026-09-14): **docs(components): add examples for various component props**
  *Symptoms*: Closes #  ## 📝 Description  Consolidates several component docs example PRs into a single one. Each change adds a focused usage example (composition + a short `<ExampleTabs>` section in the component page) demonstrating a specific prop.  ## ⛳️ Current behavior (updates)  These props were undocumented, with no runnable example in the docs.  ## 🚀 New behavior  Adds examples for:  - collapsible: activity hide mode - dialog / drawer: autofocus data attributes - listbox: keyboard priority - number-input: keyboard steps - pagination: custom page text - pin-input: auto submit, sanitize value - select: virtualized list - slider: large step, custom marker labels - steps: skippable step - tags-input: allow duplicates, sanitize value  Supersedes #10982, #10983, #10984, #10985, #10986, #10987, #10988, #10989, #10990, #10991, #10992, #10996, #10997, #10998.  ## 💣 Is this a breaking change (Yes/No):  No  ## 📝 Additional Information   <!-- greptile_comment -->  <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=63700845"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=1"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=1"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=1" align="right"></picture></a>Confidence Score: 4/5</h2>  The PR appears safe
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BsEEZbtq/2/W0ZZuo+v92f27GwvIKA5Dg01lH+KodzA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJjaGFrcmEtdjMtZG9jcyIsInByb2plY3RJZCI6InByal9iVVd3VWJsb0RkTHpvYWw2bEpSRFF0bGxCUEc2Iiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd3d3IiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2NoYWtyYS11aS9jaGFrcmEtdjMtZG9jcy82cFp5UFVyeHdCUzU2OGg4NmJhN2Vwa1l3ZjZCIiwicHJldmlld1VybCI6IiIsIm5leHRDb21taXRTdGF0dXMiOiJGQUlMRUQifSx7Im5hbWUiOiJjaGFrcmEtdWktc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX1NQQzF4Znh4aXhFSWhKZVlUNXh1Zzd4OTZMNnkiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9jaGFrcmEtdWkvY2hha3JhLXVpLXN0b3J5Ym9vay9jVEpOak40RWp3dzZKWTZXbk5MQk1HZktuYXJGIiwicHJldmlld1VybCI6ImNoYWtyYS11aS1zdG9yeWJvb2stZ2l0LWZvcmstYWRlYmVzaW4tY2VsbC1kb2MtODlmNzAzLWNoYWtyYS11aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1jaGFrcmEtdWkmcmVwbz1jaGFrcmEtdWkmcHI9MTEw
  > ### ⚠️ No Changeset found  Latest commit: 4a0ce81ffdff5ef07c17433b43ec129000d7c180  Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**  <details><summary>This PR includes no changesets</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  [Click here to learn what changesets are, and how to add one](https://changesets.dev/faq).  [Click here if you're a maintainer who wants to add a changeset to this PR](https://github.com/Adebesin-Cell/chakra-ui/new/docs/component-examples?filename=.changeset/fluffy-states-spend.md&value=---%0A%22%40chakra-ui%2Freact%22%3A%20patch%0A%22%40chakra-ui%2Fcompositions%22%3A%20patch%0A%22%40chakra-ui%2Fwww%22%3A%20patch%0A---%0A%0Adocs(components)%3A%20add%20examples%20for%20various%20compone

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

### Incident Patch 1: `96116142` (2026-09-24)
**Commit Message**: fix(scroll-area): hide each scrollbar based on its own axis (#11015)

Co-authored-by: Adebesin Tolulope <[REDACTED_EMAIL]>

**File**: `.changeset/scroll-area-hide-by-orientation.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@chakra-ui/react": patch
+"@chakra-ui/panda-preset": patch
+---
+
+Hide each ScrollArea scrollbar based on its own axis, so a vertical scrollbar no
+longer renders a 20px thumb when only the content overflows horizontally.
```

**File**: `packages/panda-preset/src/slot-recipes/scroll-area.ts` (modified, +6/-3)
```diff
@@ -39,9 +39,6 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
       transition: "opacity 150ms 300ms",
       position: "relative",
       margin: "var(--scrollbar-margin)",
-      "&:not([data-overflow-x], [data-overflow-y])": {
-        display: "none",
-      },
       bg: "{colors.colorPalette.solid/10}",
       "--thumb-bg": "{colors.colorPalette.solid/25}",
       "&:is(:hover, :active)": {
@@ -54,6 +51,9 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
       _vertical: {
         width: "var(--scrollbar-size)",
         flexDirection: "column",
+        "&:not([data-overflow-y])": {
+          display: "none",
+        },
         "&::before": {
           width: "var(--scrollbar-click-area)",
           height: "100%",
@@ -63,6 +63,9 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
       _horizontal: {
         height: "var(--scrollbar-size)",
         flexDirection: "row",
+        "&:not([data-overflow-x])": {
+          display: "none",
+        },
         "&::before": {
           height: "var(--scrollbar-click-area)",
           width: "100%",
```

**File**: `packages/react/__tests__/scroll-area-recipe.test.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { scrollAreaSlotRecipe as pandaSlotRecipe } from "../../panda-preset/src/slot-recipes/scroll-area"
+import { scrollAreaSlotRecipe } from "../src/theme/recipes/scroll-area"
+
+const scrollbarVisibility = (base: Record<string, any>) => {
+  const { scrollbar } = base
+  return {
+    vertical: scrollbar._vertical?.["&:not([data-overflow-y])"],
+    horizontal: scrollbar._horizontal?.["&:not([data-overflow-x])"],
+    neitherAxis: scrollbar["&:not([data-overflow-x], [data-overflow-y])"],
+  }
+}
+
+describe("scroll-area scrollbar visibility", () => {
+  test.each([
+    ["react recipe", scrollAreaSlotRecipe.base as Record<string, any>],
+    ["panda-preset recipe", pandaSlotRecipe.base as Record<string, any>],
+  ])("%s hides each bar from its own axis", (_name, base) => {
+    expect(scrollbarVisibility(base)).toEqual({
+      vertical: { display: "none" },
+      horizontal: { display: "none" },
+      neitherAxis: undefined,
+    })
+  })
+})
```

**File**: `packages/react/src/theme/recipes/scroll-area.ts` (modified, +8/-4)
```diff
@@ -41,10 +41,6 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
       position: "relative",
       margin: "var(--scrollbar-margin)",
 
-      "&:not([data-overflow-x], [data-overflow-y])": {
-        display: "none",
-      },
-
       bg: "{colors.colorPalette.solid/10}",
       "--thumb-bg": "{colors.colorPalette.solid/25}",
       "&:is(:hover, :active)": {
@@ -60,6 +56,10 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
         width: "var(--scrollbar-size)",
         flexDirection: "column",
 
+        "&:not([data-overflow-y])": {
+          display: "none",
+        },
+
         "&::before": {
           width: "var(--scrollbar-click-area)",
           height: "100%",
@@ -71,6 +71,10 @@ export const scrollAreaSlotRecipe = defineSlotRecipe({
         height: "var(--scrollbar-size)",
         flexDirection: "row",
 
+        "&:not([data-overflow-x])": {
+          display: "none",
+        },
+
         "&::before": {
           height: "var(--scrollbar-click-area)",
           width: "100%",
```

---

### Incident Patch 2: `55aee43a` (2026-09-21)
**Commit Message**: docs(checkbox): fix controlled example with RootProvider (#11012)

**File**: `apps/compositions/src/examples/checkbox-with-store.tsx` (modified, +3/-5)
```diff
@@ -6,11 +6,9 @@ export const CheckboxWithStore = () => {
   const checkbox = useCheckbox()
   return (
     <Checkbox.RootProvider value={checkbox}>
-      <Checkbox.Root>
-        <Checkbox.HiddenInput />
-        <Checkbox.Control />
-        <Checkbox.Label>Accept terms and conditions</Checkbox.Label>
-      </Checkbox.Root>
+      <Checkbox.HiddenInput />
+      <Checkbox.Control />
+      <Checkbox.Label>Accept terms and conditions</Checkbox.Label>
     </Checkbox.RootProvider>
   )
 }
```

**File**: `apps/www/public/r/examples/checkbox.json` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@
     },
     {
       "name": "checkbox-with-store",
-      "content": "\"use client\"\nexport const CheckboxWithStore = () => {\n  const checkbox = useCheckbox()\n  return (\n    <Checkbox.RootProvider value={checkbox}>\n      <Checkbox.Root>\n        <Checkbox.HiddenInput />\n        <Checkbox.Control />\n        <Checkbox.Label>Accept terms and conditions</Checkbox.Label>\n      </Checkbox.Root>\n    </Checkbox.RootProvider>\n  )\n}\n",
+      "content": "\"use client\"\nexport const CheckboxWithStore = () => {\n  const checkbox = useCheckbox()\n  return (\n    <Checkbox.RootProvider value={checkbox}>\n      <Checkbox.HiddenInput />\n      <Checkbox.Control />\n      <Checkbox.Label>Accept terms and conditions</Checkbox.Label>\n    </Checkbox.RootProvider>\n  )\n}\n",
       "hasSnippet": false,
       "importPaths": [
         "import { Checkbox, useCheckbox } from \"@chakra-ui/react\""
```

---

### Incident Patch 3: `cbc7aacb` (2026-09-15)
**Commit Message**: fix(www): add "use client" to pagination custom format example (#11005)

**File**: `apps/compositions/src/examples/pagination-with-custom-format.tsx` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+"use client"
+
 import { ButtonGroup, IconButton, Pagination } from "@chakra-ui/react"
 import { LuChevronLeft, LuChevronRight } from "react-icons/lu"
 
```

---

### Incident Patch 4: `611bab02` (2026-09-13)
**Commit Message**: fix(react): match all breakpoints when useBreakpoint gets no list (#10976)

**File**: `.changeset/use-breakpoint-default-breakpoints.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@chakra-ui/react": patch
+---
+
+Fix `useBreakpoint` returning `"base"` on every viewport when the `breakpoints`
+option is omitted. The filter that narrows the evaluated breakpoints read an
+absent option as "match nothing" rather than "match all", so no media query was
+registered and the `fallback` was always returned.
```

**File**: `packages/react/__tests__/use-breakpoint.test.tsx` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import { renderHook } from "@testing-library/react"
+import { ChakraProvider, defaultSystem, useBreakpoint } from "../src"
+
+const wrapper = ({ children }: { children: React.ReactNode }) => (
+  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
+)
+
+// the viewport is wide enough for `base`, `sm` and `md`, but not `lg` and up
+const matching = [
+  "(min-width: 0px)",
+  "(min-width: 30rem)",
+  "(min-width: 48rem)",
+]
+
+const mockMatchMedia = () =>
+  vi.fn().mockImplementation((query: string) => ({
+    matches: matching.includes(query),
+    media: query,
+    addEventListener: () => {},
+    removeEventListener: () => {},
+  }))
+
+describe("useBreakpoint", () => {
+  let originalMatchMedia: typeof window.matchMedia
+
+  beforeEach(() => {
+    originalMatchMedia = window.matchMedia
+    window.matchMedia = mockMatchMedia() as any
+  })
+
+  afterEach(() => {
+    window.matchMedia = originalMatchMedia
+  })
+
+  test("should return the highest matching breakpoint when no breakpoints are listed", () => {
+    const { result } = renderHook(() => useBreakpoint({ ssr: false }), {
+      wrapper,
+    })
+
+    expect(result.current).toBe("md")
+  })
+
+  test("should return the highest matching breakpoint from the listed breakpoints", () => {
+    const { result } = renderHook(
+      () => useBreakpoint({ ssr: false, breakpoints: ["base", "sm", "md"] }),
+      { wrapper },
+    )
+
+    expect(result.current).toBe("md")
+  })
+
+  test("should not return a listed breakpoint that does not match", () => {
+    const { result } = renderHook(
+      () => useBreakpoint({ ssr: false, breakpoints: ["base", "lg"] }),
+      { wrapper },
+    )
+
+    expect(result.current).toBe("base")
+  })
+
+  test("should return the fallback when no breakpoint matches", () => {
+    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
+      matches: false,
+      media: query,
+      addEventListener: () => {},
+      removeEventListener: () => {},
+    })) as any
+
+    const { result } = renderHook(
+      () => useBreakpoint({ ssr: false, fallback: "sm" }),
+      { wrapper },
+    )
+
+    expect(result.current).toBe("sm")
+  })
+})
```

**File**: `packages/react/src/hooks/use-breakpoint.ts` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export function useBreakpoint(options: UseBreakpointOptions = {}) {
     })
     .filter(
       ({ breakpoint }) =>
-        !!options.breakpoints?.includes(breakpoint as BreakpointName),
+        options.breakpoints?.includes(breakpoint as BreakpointName) ?? true,
     )
 
   const fallback = breakpoints.map(({ fallback }) => fallback)
```

---

### Incident Patch 5: `837446e5` (2026-09-13)
**Commit Message**: test(react): add a react render benchmark

The three existing bench files all measure functions in isolation, which is
misleading here: `cssFn` and `transform` memoize the layer above style
resolution, so work that looks hot on its own barely runs during a render.
Measured on `renderToString`, three separate function-level wins of 34x, 9x
and 2.9x each came out to no change at all.

Adds `pnpm bench` and four benches over real trees, shaped after the cases
that actually regressed: a data table of recipe components (#10878) and a
dialog form (#9698), plus a varied page that misses the style caches.

Validated against the regression it exists to catch: reintroducing
04a1a07f1e, which stripped memo from `cssFn`, `mergeFn` and `transform`,
registers as 0.39x-0.52x here, far outside the +-5% noise floor.

Server rendering only. Mounting into jsdom measured at +-9% to +-13%, wide
enough to hide a 1.5x regression, and it adds coverage of effects and
reconciliation rather than style resolution.

**File**: `package.json` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
     "typedocs": "pnpm www generate:types",
     "typecheck": "tsgo --noEmit",
     "test": "vitest",
+    "bench": "vitest bench --run",
     "react": "pnpm --filter=@chakra-ui/react",
     "www": "pnpm --filter=./apps/www",
     "mcp": "pnpm --filter=./apps/mcp",
```

**File**: `packages/react/__tests__/render.bench.tsx` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+import type { ReactNode } from "react"
+import { renderToString } from "react-dom/server"
+// Run:     pnpm bench
+// Compare: pnpm bench --outputJson base.json   (on the base revision)
+//          pnpm bench --compare base.json      (on the branch)
+//
+// Validated against #9698: reintroducing 04a1a07f1e (memo stripped from
+// `cssFn`, `mergeFn` and `transform`) shows up here as 0.39x-0.52x, far
+// outside the +-5% noise floor.
+
+import { bench } from "vitest"
+import {
+  Badge,
+  Box,
+  Button,
+  ChakraProvider,
+  Field,
+  Heading,
+  Input,
+  Skeleton,
+  Stack,
+  Text,
+  createSystem,
+  defaultConfig,
+  defaultSystem,
+} from "../src"
+
+// Function-level benchmarks mislead here: `cssFn` and `transform` memoize the
+// layer above style resolution, so work that looks hot in isolation barely
+// runs during a render. These mount real trees instead.
+
+// Shape from #10878: a data table of recipe components, most of them
+// identical and visually inert. 30 rows => 90 buttons, 60 badges, 210 skeletons.
+function DataTable({ rows }: { rows: number }) {
+  return (
+    <Box>
+      {Array.from({ length: rows }, (_, row) => (
+        <Box key={row} display="flex" gap="2" padding="2">
+          {Array.from({ length: 7 }, (_, cell) => (
+            <Skeleton key={cell} loading={false}>
+              cell
+            </Skeleton>
+          ))}
+          <Badge colorPalette="gray">ok</Badge>
+          <Badge colorPalette="green">live</Badge>
+          <Button variant="ghost" size="xs">
+            edit
+          </Button>
+          <Button variant="ghost" size="xs">
+            copy
+          </Button>
+          <Button variant="ghost" size="xs">
+            open
+          </Button>
+        </Box>
+      ))}
+    </Box>
+  )
+}
+
+// Shape from #9698: a dialog body of form controls, mounted when it opens.
+function DialogForm({ fields }: { fields: number }) {
+  return (
+    <Stack gap="4" padding="6">
+      <Heading size="lg">Settings</Heading>
+      {Array.from({ length: fields }, (_, i) => (
+        <Field.Root key={i} invalid={i % 7 === 0}>
+          <Field.Label>Field {i}</Field.Label>
+          <Input size={i % 2 ? "sm" : "md"} variant="outline" />
+          <Field.HelperText>Helper text {i}</Field.HelperText>
+        </Field.Root>
+      ))}
+      <Stack direction="row" gap="3">
+        <Button variant="subtle" size="sm">
+          Cancel
+        </Button>
+        <Button variant="solid" size="sm" colorPalette="blue">
+          Save
+        </Button>
+      </Stack>
+    </Stack>
+  )
+}
+
+// Every instance differs, so the style caches miss far more often.
+const VARIANTS = ["solid", "subtle", "outline", "ghost"] as const
+const SIZES = ["xs", "sm", "md", "lg"] as const
+const PALETTES = ["gray", "red", "blue", "green", "purple"] as const
+
+function VariedPage({ rows }: { rows: number }) {
+  return (
+    <Box padding="4">
+      {Array.from({ length: rows }, (_, i) => (
+        <Box
+          key={i}
+          borderWidth="1px"
+          padding={i % 3 ? "2" : "4"}
+          marginTop="2"
+          rounded={i % 2 ? "sm" : "md"}
+        >
+          <Text fontSize={i % 2 ? "sm" : "md"}>Row {i}</Text>
+          <Badge colorPalette={PALETTES[i % PALETTES.length]}>tag</Badge>
+          <Button
+            variant={VARIANTS[i % VARIANTS.length]}
+            size={SIZES[i % SIZES.length]}
+            colorPalette={PALETTES[i % PALETTES.length]}
+          >
+            Action {i}
+          </Button>
+        </Box>
+      ))}
+    </Box>
+  )
+}
+
+const withProvider = (node: ReactNode, system = defaultSystem) => (
+  <ChakraProvider value={system}>{node}</ChakraProvider>
+)
+
+// Rendering allocates heavily, so a short run is dominated by GC pauses and
+// the margin of error swamps the regression being looked for. Long warmups
+// and long sample windows keep it inside a couple of percent.
+const options = { time: 2000, warmupTime: 1000 }
+
+/* -----------------------------------------------------------------------------
+ * System creation, so boot cost can be read separately from render cost
+ * -----------------------------------------------------------------------------*/
+
+bench(
+  "createSystem(defaultConfig)",
+  () => {
+    createSystem(defaultConfig)
+  },
+  options,
+)
+
+/* -----------------------------------------------------------------------------
+ * Server render, shared system. The most stable signal: no teardown, no jsdom.
+ * -----------------------------------------------------------------------------*/
+
+bench(
+  "ssr: data table (30 rows)",
+  () => {
+    renderToString(withProvider(<DataTable rows={30} />))
+  },
+  options,
+)
+
+bench(
+  "ssr: dialog form (40 fields)",
+  () => {
+    renderToString(withProvider(<DialogForm fields={40} />))
+  },
+  options,
+)
+
+bench(
+  "ssr: varied page (80 rows)",
+  () => {
+    renderToString(withProvider(<VariedPage rows={80} />))
+  },
+  options,
+
```

---

### Incident Patch 6: `29495a75` (2026-09-13)
**Commit Message**: fix(tests): correct vitest include/exclude patterns

`benchmark.exclude` was set to `["node_modules", "dist"]`. Those are plain
strings rather than globs, so they matched nothing, and setting the option at
all discarded vitest's defaults. The globber follows symlinks, so it walked
pnpm's store through `node_modules` and collected 92 bench files belonging to
dependencies: 4.4s of globbing before running any of our own benchmarks.

Both `test` and `benchmark` now extend `defaultExclude` and also skip
`.claude/`, where agent worktrees keep a second copy of the suite that was
being collected and run alongside the real one.

Bench file discovery goes from 92 files in 4439ms to 4 files in 32ms, and
`pnpm test` no longer picks up the duplicate worktree copies.

**File**: `vite.config.ts` (modified, +3/-1)
```diff
@@ -1,6 +1,7 @@
 /// <reference types="vitest" />
 import { resolve } from "path"
 import { defineConfig } from "vite"
+import { defaultExclude } from "vitest/config"
 
 export default defineConfig({
   resolve: {
@@ -15,13 +16,14 @@ export default defineConfig({
     watch: false,
     environment: "jsdom",
     include: ["**/*test.{ts,tsx}"],
+    exclude: [...defaultExclude, "**/dist/**", "**/.claude/**"],
     setupFiles: ["vitest.setup.ts"],
     coverage: {
       include: ["packages"],
     },
     benchmark: {
       include: ["**/*.bench.{ts,tsx}"],
-      exclude: ["node_modules", "dist"],
+      exclude: [...defaultExclude, "**/dist/**", "**/.claude/**"],
     },
   },
 })
```

---

### Incident Patch 7: `d4b44201` (2026-09-13)
**Commit Message**: fix(react): preserve cva variant keys that collide with CSS shorthands (#10973)

* fix(react): preserve cva variant keys that collide with CSS shorthands

* refactor(react): resolve variant selections without a second normalizer

Keeps the fix, simplifies how it is wired.

`createNormalizePropsFn` was `createNormalizeFn` minus its `getKey` option,
so the two would drift apart the next time normalization changes. What cva
needs for selections is just `normalizeValue`, which `system.ts` already has
in scope, so `normalize.ts` goes back untouched.

`resolve` no longer normalizes selections at all: `getVariantCss` normalizes
its input internally and compound matching compares raw values, so that pass
only ever fed a function that redid the work. Compound variant match rules
are now built per recipe instead of on every resolve.

Verified byte-identical output against main across 1648 recipe resolutions
(every built-in recipe and slot recipe over its variant matrix, plus
responsive array and object selections). Cold render of a 40-field form
measures 23.5ms against 24.7ms for the previous approach and 26.1ms on main.

---------

Co-authored-by: Segun Adebayo <[REDACTED_EMAIL]>

**File**: `.changeset/cva-variant-shorthand-keys.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@chakra-ui/react": patch
+---
+
+- **CVA, SVA**: Fix variants whose names collide with a CSS shorthand, such as
+  `rounded`, `bg` or `p`, being silently dropped.
```

**File**: `packages/react/__tests__/cva.test.ts` (modified, +54/-3)
```diff
@@ -151,9 +151,8 @@ describe("cva", () => {
       },
     })
 
-    // Both calls pass the same variants, so they only get separate memo
-    // entries if prop order is part of the cache key. The later prop wins,
-    // so a shared entry would hand the second call the first one's "30px".
+    // Same variants either way, so a memo key that ignored prop order would
+    // hand the second call the first one's "30px". The later prop wins.
     expect(recipe({ size: "md", tone: "solid" })).toMatchObject({
       "@layer recipes": { marginTop: "30px" },
     })
@@ -162,4 +161,56 @@ describe("cva", () => {
       "@layer recipes": { marginTop: "20px" },
     })
   })
+
+  test("keeps variant keys that collide with CSS shorthands", () => {
+    const sys = createSystem({
+      theme: {
+        breakpoints: { sm: "30em" },
+      },
+      utilities: {
+        borderRadius: { shorthand: "rounded" },
+        background: { shorthand: "bg" },
+        padding: { shorthand: "p" },
+      },
+    })
+
+    const recipe = sys.cva({
+      base: { color: "red" },
+      variants: {
+        rounded: {
+          true: {
+            borderWidth: "2px",
+            borderStyle: "solid",
+          },
+        },
+        bg: {
+          solid: { background: "blue" },
+        },
+        p: {
+          sm: { padding: "4px" },
+        },
+      },
+      compoundVariants: [
+        {
+          rounded: true,
+          bg: "solid",
+          css: { borderColor: "green" },
+        },
+      ],
+      defaultVariants: {
+        rounded: true,
+      },
+    })
+
+    expect(recipe({ bg: "solid", p: "sm" })).toMatchObject({
+      "@layer recipes": {
+        color: "red",
+        borderWidth: "2px",
+        borderStyle: "solid",
+        background: "blue",
+        padding: "4px",
+        borderColor: "green",
+      },
+    })
+  })
 })
```

**File**: `packages/react/src/styled-system/cva.ts` (modified, +41/-31)
```diff
@@ -8,11 +8,12 @@ import {
   omit,
   splitProps,
   uniq,
+  walkObject,
 } from "../utils"
 import { createCssFn } from "./css"
 import type { RecipeCreatorFn, RecipeDefinition } from "./recipe.types"
 import { EMPTY_OBJECT } from "./singleton"
-import type { Condition, CssFn, Layers } from "./types"
+import type { Condition, CssFn, Layers, SystemContext } from "./types"
 
 const defaults = (conf: any): Required<RecipeDefinition> => ({
   base: EMPTY_OBJECT,
@@ -24,47 +25,72 @@ const defaults = (conf: any): Required<RecipeDefinition> => ({
 
 interface Options {
   normalize: (styles: Dict) => Dict
+  normalizeValue: SystemContext["normalizeValue"]
   css: CssFn
   conditions: Condition
   layers: Layers
 }
 
 export function createRecipeFn(options: Options): RecipeCreatorFn {
-  const { css, conditions, normalize, layers } = options
+  const { css, conditions, normalize, normalizeValue, layers } = options
+
+  // Variant names are not CSS properties: normalizing them would rewrite
+  // a `rounded` variant to `borderRadius`.
+  const normalizeSelections = (selections: Dict) =>
+    walkObject(selections, normalizeValue, {
+      stop: (value) => Array.isArray(value),
+    })
+
+  function createCompoundVariantFn(compoundVariants: any[]) {
+    const rules = compoundVariants.map((compoundVariant) => ({
+      styles: compoundVariant.css,
+      match: Object.entries(omit(compoundVariant, ["css"])).map(
+        ([name, value]) =>
+          [name, Array.isArray(value) ? value : [value]] as const,
+      ),
+    }))
+
+    return function matchCompoundVariants(selections: Dict) {
+      let result = EMPTY_OBJECT
+      for (const { styles, match } of rules) {
+        const matches = match.every(([name, values]) =>
+          values.includes(selections[name]),
+        )
+        if (matches) result = css(result, styles)
+      }
+      return result
+    }
+  }
 
   function cva(config: Dict = {}) {
     const defaultsConfig = defaults(config)
     const { base, defaultVariants, compoundVariants } = defaultsConfig
 
+    const matchCompoundVariants = createCompoundVariantFn(compoundVariants)
+
     const variants = mapEntries(defaultsConfig.variants, (key, obj) => [
       key,
       mapEntries(obj, (optionKey, styles) => [optionKey, normalize(styles)]),
     ])
 
     const getVariantCss = createCssFn({
       conditions,
-      normalize,
+      normalize: normalizeSelections,
       transform(prop, value) {
         return variants[prop]?.[value]
       },
     })
 
     const resolve = memo(function resolve(props: Dict = {}) {
-      const variantSelections: Dict = normalize({
-        ...defaultVariants,
-        ...compact(props),
-      })
+      const selections = { ...defaultVariants, ...compact(props) }
 
-      let variantCss = { ...normalize(base) }
+      const variantCss = normalize(base)
+      mergeWith(variantCss, getVariantCss(selections))
 
-      mergeWith(variantCss, getVariantCss(variantSelections))
-
-      const compoundVariantCss = getCompoundVariantCss(
-        compoundVariants,
-        variantSelections,
+      return layers.wrap(
+        "recipes",
+        css(variantCss, matchCompoundVariants(selections)),
       )
-
-      return layers.wrap("recipes", css(variantCss, compoundVariantCss))
     })
 
     const variantKeys = Object.keys(variants)
@@ -110,22 +136,6 @@ export function createRecipeFn(options: Options): RecipeCreatorFn {
     })
   }
 
-  function getCompoundVariantCss(cvs: any[], vm: any) {
-    let result = EMPTY_OBJECT
-    cvs.forEach((cv) => {
-      const isMatching = Object.entries(cv).every(([key, value]) => {
-        if (key === "css") return true
-        const values = Array.isArray(value) ? value : [value]
-        return values.some((value) => vm[key] === value)
-      })
-      if (isMatching) {
-        result = css(result, cv.css)
-      }
-    })
-
-    return result
-  }
-
   //@ts-expect-error
   return cva
 }
```

**File**: `packages/react/src/styled-system/system.ts` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ export function createSystem(...configs: SystemConfig[]): SystemContext {
     css: css as any,
     conditions,
     normalize: normalizeFn,
+    normalizeValue,
     layers,
   })
 
```

---

### Incident Patch 8: `edef2343` (2026-09-13)
**Commit Message**: chore(deps): update @ark-ui/react to 5.39.2 (#10993)

Keeps the pinned Ark version current. 5.39.2 restores the ./hotkeys and
./interaction entrypoints that were dropped from the published package in
5.39.0/5.39.1, and carries a NavigationMenu SSR fix (a component Chakra does
not ship), so consumers see no behavior change.

**File**: `.changeset/update-ark-ui-5.39.2.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@chakra-ui/react": patch
+---
+
+**Updated Ark UI to v5.39.2**
+
+Keeps the pinned Ark version current. 5.39.2 restores the `./hotkeys` and
+`./interaction` entrypoints that were dropped from the published package in
+5.39.0/5.39.1, and includes a `NavigationMenu.Content` SSR fix (a component
+Chakra does not ship). No behavior change for existing consumers.
```

**File**: `apps/www/package.json` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     "prebuild": "pnpm generate:composition && pnpm generate:examples && pnpm build:react && pnpm generate:theme"
   },
   "dependencies": {
-    "@ark-ui/react": "5.39.0",
+    "@ark-ui/react": "5.39.2",
     "@chakra-ui/react": "workspace:*",
     "@chakra-ui/charts": "workspace:*",
     "@emotion/react": "11.14.0",
```

**File**: `packages/react/package.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
     "url": "https://storybook.chakra-ui.com"
   },
   "dependencies": {
-    "@ark-ui/react": "5.39.0",
+    "@ark-ui/react": "5.39.2",
     "@emotion/is-prop-valid": "^1.4.0",
     "@emotion/serialize": "^1.3.3",
     "@emotion/use-insertion-effect-with-fallbacks": "^1.2.0",
```

**File**: `pnpm-lock.yaml` (modified, +8/-8)
```diff
@@ -422,8 +422,8 @@ importers:
   apps/www:
     dependencies:
       '@ark-ui/react':
-        specifier: 5.39.0
-        version: 5.39.0(react-dom@19.2.6(react@19.2.6))(react@19.2.6)
+        specifier: 5.39.2
+        version: 5.39.2(react-dom@19.2.6(react@19.2.6))(react@19.2.6)
       '@chakra-ui/charts':
         specifier: workspace:*
         version: link:../../packages/charts
@@ -690,8 +690,8 @@ importers:
   packages/react:
     dependencies:
       '@ark-ui/react':
-        specifier: 5.39.0
-        version: 5.39.0(react-dom@19.2.6(react@19.2.6))(react@19.2.6)
+        specifier: 5.39.2
+        version: 5.39.2(react-dom@19.2.6(react@19.2.6))(react@19.2.6)
       '@emotion/is-prop-valid':
         specifier: ^1.4.0
         version: 1.4.0
@@ -1339,8 +1339,8 @@ packages:
     resolution: {integrity: sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==}
     engines: {node: '>=6.0.0'}
 
-  '@ark-ui/react@5.39.0':
-    resolution: {integrity: sha512-qKMyliIHgkp4TPrdr9xmkXeP9lmuEvhRJNPNah7Wnp54lspsZJY4b08rNM+NWtlnhxO1P8iChKRKcohSQgXL/g==}
+  '@ark-ui/react@5.39.2':
+    resolution: {integrity: sha512-bvfEXm/5JBVe5zmA1myB5EC4+khE18qru5A0qIgV3Qzz10Qykn27heIR5ypyGwnYoE6HgMumZhTdM0xan5mE5g==}
     peerDependencies:
       react: 19.2.6
       react-dom: 19.2.6
@@ -12838,7 +12838,7 @@ snapshots:
       '@jridgewell/gen-mapping': 0.3.13
       '@jridgewell/trace-mapping': 0.3.31
 
-  '@ark-ui/react@5.39.0(react-dom@19.2.6(react@19.2.6))(react@19.2.6)':
+  '@ark-ui/react@5.39.2(react-dom@19.2.6(react@19.2.6))(react@19.2.6)':
     dependencies:
       '@internationalized/date': 3.12.3
       '@zag-js/accordion': 1.43.3
@@ -14691,7 +14691,7 @@ snapshots:
 
   '@internationalized/number@3.6.7':
     dependencies:
-      '@swc/helpers': 0.5.15
+      '@swc/helpers': 0.5.23
 
   '@isaacs/cliui@8.0.2':
     dependencies:
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ onlyBuiltDependencies:
   - unrs-resolver
 
 minimumReleaseAgeExclude:
-  - '@ark-ui/react@5.39.0'
+  - '@ark-ui/react@5.39.2'
   - '@zag-js/accordion@1.43.1'
   - '@zag-js/anatomy@1.43.1'
   - '@zag-js/angle-slider@1.43.1'
```

---

### Incident Patch 9: `67abe9fb` (2026-09-09)
**Commit Message**: fix(file-upload): style disabled delete triggers (#10979)

**File**: `.changeset/soft-files-rest.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@chakra-ui/react": patch
+"@chakra-ui/panda-preset": patch
+---
+
+Fix disabled file upload delete triggers showing an active cursor and full-strength icon.
```

**File**: `packages/panda-preset/src/slot-recipes/file-upload.ts` (modified, +3/-0)
```diff
@@ -110,6 +110,9 @@ export const fileUploadSlotRecipe = defineSlotRecipe({
       p: "2px",
       color: "fg.muted",
       cursor: "button",
+      _disabled: {
+        layerStyle: "disabled",
+      },
     },
     itemPreview: {
       color: "fg.muted",
```

**File**: `packages/react/src/theme/recipes/file-upload.ts` (modified, +3/-0)
```diff
@@ -95,6 +95,9 @@ export const fileUploadSlotRecipe = defineSlotRecipe({
       p: "2px",
       color: "fg.muted",
       cursor: "button",
+      _disabled: {
+        layerStyle: "disabled",
+      },
     },
     itemPreview: {
       color: "fg.muted",
```

---

### Incident Patch 10: `c455101c` (2026-09-07)
**Commit Message**: fix(react): settle overlay promises when an overlay is removed (#10968)

Co-authored-by: Adebesin Tolulope <[REDACTED_EMAIL]>

**File**: `.changeset/settle-overlay-promises.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@chakra-ui/react": patch
+---
+
+Fix `createOverlay` leaving promises pending forever when an overlay is removed.
+`remove` and `removeAll` deleted the overlay without settling the promises
+handed out by `open`, `close` and `waitForExit`, so any code awaiting them was
+stuck. They now resolve with `undefined`.
```

**File**: `packages/react/__tests__/use-overlay.test.tsx` (modified, +59/-0)
```diff
@@ -16,6 +16,14 @@ const { Viewport, open, close, removeAll, getSnapshot } = createOverlay(
   },
 )
 
+const settled = <T,>(promise: Promise<T>) =>
+  Promise.race([
+    promise.then((value) => ({ status: "settled", value })),
+    new Promise<{ status: string; value?: T }>((resolve) =>
+      setTimeout(() => resolve({ status: "pending" }), 50),
+    ),
+  ])
+
 describe("createOverlay", () => {
   beforeEach(() => {
     opens.length = 0
@@ -117,4 +125,55 @@ describe("createOverlay", () => {
     overlay.remove("my-modal")
     expect(overlay.has("my-modal")).toBe(false)
   })
+
+  it("resolves the pending open() promise when the overlay is removed", async () => {
+    const overlay = createOverlay(() => <div />)
+
+    const result = overlay.open("my-modal", {})
+    overlay.remove("my-modal")
+
+    expect(await settled(result)).toEqual({
+      status: "settled",
+      value: undefined,
+    })
+  })
+
+  it("resolves the pending open() promise when all overlays are removed", async () => {
+    const overlay = createOverlay(() => <div />)
+
+    const result = overlay.open("my-modal", {})
+    overlay.removeAll()
+
+    expect(await settled(result)).toEqual({
+      status: "settled",
+      value: undefined,
+    })
+  })
+
+  it("resolves the pending close() promise when the overlay is removed", async () => {
+    const overlay = createOverlay(() => <div />)
+
+    overlay.open("my-modal", {})
+    const closed = overlay.close("my-modal")
+    overlay.remove("my-modal")
+
+    expect(await settled(closed)).toEqual({
+      status: "settled",
+      value: undefined,
+    })
+  })
+
+  it("resolves a pending waitForExit() when all overlays are removed", async () => {
+    const overlay = createOverlay(() => <div />)
+
+    overlay.open("my-modal", {})
+    void overlay.close("my-modal")
+    const exited = overlay.waitForExit("my-modal")
+    overlay.removeAll()
+
+    expect(await settled(exited)).toEqual({
+      status: "settled",
+      value: undefined,
+    })
+  })
 })
```

**File**: `packages/react/src/hooks/use-overlay.tsx` (modified, +13/-0)
```diff
@@ -169,7 +169,19 @@ export function createOverlay<TProps extends Dict, TReturn = unknown>(
     return exitPromise
   }
 
+  // a removed overlay never reaches close or exit, so settle the promises
+  // handed out by `open` and `close` instead of leaving callers awaiting forever
+  const settlePending = (id: string) => {
+    const overlay = map.get(id) as
+      | (CreateOverlayProps<TReturn> & TProps)
+      | undefined
+    if (!overlay) return
+    overlay.setReturnValue?.(undefined as TReturn)
+    overlay.setExitComplete?.()
+  }
+
   const remove = (id: string) => {
+    settlePending(id)
     map.delete(id)
     exitPromises.delete(id)
     publish()
@@ -197,6 +209,7 @@ export function createOverlay<TProps extends Dict, TReturn = unknown>(
   }
 
   const removeAll = () => {
+    for (const id of map.keys()) settlePending(id)
     map.clear()
     exitPromises.clear()
     publish()
```

---

### Incident Patch 11: `d88c3e94` (2026-09-07)
**Commit Message**: fix(react): read the important marker only at the end of a value (#10970)

Co-authored-by: Adebesin Tolulope <[REDACTED_EMAIL]>

**File**: `.changeset/important-marker-at-end.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@chakra-ui/react": patch
+---
+
+- **System**: Fix an exclamation mark anywhere inside a style value being read
+  as the `!important` marker. `content: '"!"'` rendered as an empty string,
+  `url(/a!b.png)` lost its `!`, and every such value was emitted with
+  `!important`. The marker is now only recognised at the end of the value, so
+  `color: "red!"` and `color: "red !important"` behave as before.
```

**File**: `packages/react/__tests__/css.test.ts` (modified, +24/-0)
```diff
@@ -194,6 +194,30 @@ describe("css", () => {
     `)
   })
 
+  test("important marker is only read at the end of a value", () => {
+    expect(css({ content: '"Hello!"' })).toEqual({ content: '"Hello!"' })
+    expect(css({ _before: { content: '"!"' } })).toEqual({
+      "&::before": { content: '"!"' },
+    })
+    expect(css({ backgroundImage: "url(/a!b.png)" })).toEqual({
+      backgroundImage: "url(/a!b.png)",
+    })
+    expect(css({ fontFamily: "'Wow! Sans', sans-serif" })).toEqual({
+      fontFamily: "'Wow! Sans', sans-serif",
+    })
+
+    expect(css({ color: "red!" })).toEqual({ color: "red !important" })
+    expect(css({ color: "red !important" })).toEqual({
+      color: "red !important",
+    })
+    expect(css({ color: "red!important " })).toEqual({
+      color: "red !important",
+    })
+    expect(css({ color: "red ! important" })).toEqual({
+      color: "red !important",
+    })
+  })
+
   test("expand css var token", () => {
     const result = css({
       "--banner-height": "sizes.small",
```

**File**: `packages/react/src/styled-system/css.ts` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ import { EMPTY_OBJECT, createEmptyObject } from "./singleton"
 import { sortAtRules } from "./sort-at-rules"
 import type { SystemContext } from "./types"
 
-const importantRegex = /\s*!(important)?/i
+const importantRegex = /\s*!\s*(important)?\s*$/i
 
 const isImportant = memo((v: unknown) =>
   isString(v) ? importantRegex.test(v) : false,
```

---

### Incident Patch 12: `fbc174e5` (2026-09-07)
**Commit Message**: fix(react): return zero-valued tokens from system.token (#10971)

**File**: `.changeset/token-zero-value.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@chakra-ui/react": patch
+---
+
+Fix `system.token()` and `useToken()` returning the fallback for tokens whose
+value is `0`. The lookup used `||` instead of `??`, so
+`useToken("zIndex", "base")` returned the string `"base"` instead of `0`, while
+`tokens.getVar()` already used `??`.
```

**File**: `packages/react/__tests__/system.test.ts` (modified, +18/-0)
```diff
@@ -289,6 +289,24 @@ describe("system", () => {
     expect(sys.token("colors.teal.200")).toBe("#light")
   })
 
+  test("system.token resolves tokens whose value is zero", () => {
+    const sys = createSystem({
+      theme: {
+        tokens: {
+          zIndex: {
+            base: { value: 0 },
+            docked: { value: 10 },
+          },
+        },
+      },
+    })
+
+    expect(sys.token("zIndex.base")).toBe(0)
+    expect(sys.token("zIndex.base", "base")).toBe(0)
+    expect(sys.token("zIndex.docked")).toBe(10)
+    expect(sys.token("zIndex.unknown", "fallback")).toBe("fallback")
+  })
+
   test("system.css preserves property order in memo cache keys (#10952)", () => {
     const sys = createSystem({})
     const widthThenHeight = sys.css({ width: "100px", height: "200px" })
```

**File**: `packages/react/src/styled-system/system.ts` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ export function createSystem(...configs: SystemConfig[]): SystemContext {
   const tokenMap = getTokenMap(tokens)
 
   const tokenFn: TokenFn = (path: string, fallback?: any) => {
-    return tokenMap.get(path)?.value || fallback
+    return tokenMap.get(path)?.value ?? fallback
   }
 
   tokenFn.var = (path: string, fallback?: any) => {
```

---

### Incident Patch 13: `1eb59bce` (2026-09-05)
**Commit Message**: fix(flex, square): apply the array form of the css prop (#10966)

Co-authored-by: Lope <[REDACTED_EMAIL]>

**File**: `.changeset/fix-flex-square-css-array.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"@chakra-ui/react": patch
+---
+
+- **Flex, Square**: Fix the array form of the `css` prop being silently dropped.
+  Both components merged the incoming `css` into their base styles with an
+  object spread, which turns an array into index keys instead of merging its
+  entries. They now pass `css={[baseStyles, props.css]}`, matching
+  `AspectRatio`, `Bleed` and `Float`. `Circle` renders through `Square`, so it
+  is fixed too
```

**File**: `packages/react/__tests__/css-prop.test.tsx` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+import { Box, Circle, Flex, Square } from "@chakra-ui/react"
+import { render } from "./core/render"
+
+describe("css prop", () => {
+  it("applies an array css prop on Box", () => {
+    const { getByTestId } = render(
+      <Box data-testid="box" css={[{ position: "fixed" }]} />,
+    )
+    expect(getByTestId("box")).toHaveStyle({ position: "fixed" })
+  })
+
+  it("applies an array css prop on Flex alongside its layout styles", () => {
+    const { getByTestId } = render(
+      <Flex
+        data-testid="flex"
+        direction="column"
+        css={[{ position: "fixed" }]}
+      />,
+    )
+    expect(getByTestId("flex")).toHaveStyle({ position: "fixed" })
+    expect(getByTestId("flex")).toHaveStyle({ flexDirection: "column" })
+  })
+
+  it("applies an array css prop on Square alongside its centering styles", () => {
+    const { getByTestId } = render(
+      <Square data-testid="square" size="10" css={[{ position: "fixed" }]} />,
+    )
+    expect(getByTestId("square")).toHaveStyle({ position: "fixed" })
+    expect(getByTestId("square")).toHaveStyle({ alignItems: "center" })
+  })
+
+  it("applies an array css prop on Circle, which renders through Square", () => {
+    const { getByTestId } = render(
+      <Circle data-testid="circle" size="10" css={[{ position: "fixed" }]} />,
+    )
+    expect(getByTestId("circle")).toHaveStyle({ position: "fixed" })
+    expect(getByTestId("circle")).toHaveStyle({ borderRadius: "9999px" })
+  })
+
+  it("applies an object css prop on Flex alongside its layout styles", () => {
+    const { getByTestId } = render(
+      <Flex
+        data-testid="flex"
+        direction="column"
+        css={{ position: "fixed" }}
+      />,
+    )
+    expect(getByTestId("flex")).toHaveStyle({ position: "fixed" })
+    expect(getByTestId("flex")).toHaveStyle({ flexDirection: "column" })
+  })
+
+  it("applies an object css prop on Square alongside its centering styles", () => {
+    const { getByTestId } = render(
+      <Square data-testid="square" size="10" css={{ position: "fixed" }} />,
+    )
+    expect(getByTestId("square")).toHaveStyle({ position: "fixed" })
+    expect(getByTestId("square")).toHaveStyle({ alignItems: "center" })
+  })
+
+  it("lets the css prop win over a base style it collides with on Flex", () => {
+    const { getByTestId } = render(
+      <Flex
+        data-testid="flex"
+        direction="column"
+        css={{ flexDirection: "row" }}
+      />,
+    )
+    expect(getByTestId("flex")).toHaveStyle({ flexDirection: "row" })
+  })
+
+  it("lets the css prop win over a base style it collides with on Square", () => {
+    const { getByTestId } = render(
+      <Square data-testid="square" size="10" css={{ alignItems: "start" }} />,
+    )
+    expect(getByTestId("square")).toHaveStyle({ alignItems: "start" })
+  })
+})
```

**File**: `packages/react/src/components/flex/flex.tsx` (modified, +13/-11)
```diff
@@ -38,17 +38,19 @@ export const Flex = forwardRef<HTMLDivElement, FlexProps>(
       <chakra.div
         ref={ref}
         {...rest}
-        css={{
-          display: inline ? "inline-flex" : "flex",
-          flexDirection: direction,
-          alignItems: align,
-          justifyContent: justify,
-          flexWrap: wrap,
-          flexBasis: basis,
-          flexGrow: grow,
-          flexShrink: shrink,
-          ...props.css,
-        }}
+        css={[
+          {
+            display: inline ? "inline-flex" : "flex",
+            flexDirection: direction,
+            alignItems: align,
+            justifyContent: justify,
+            flexWrap: wrap,
+            flexBasis: basis,
+            flexGrow: grow,
+            flexShrink: shrink,
+          },
+          props.css,
+        ]}
       />
     )
   },
```

**File**: `packages/react/src/components/square/index.tsx` (modified, +10/-8)
```diff
@@ -19,14 +19,16 @@ export const Square = forwardRef<HTMLDivElement, SquareProps>(
         {...rest}
         ref={ref}
         boxSize={size}
-        css={{
-          display: "flex",
-          alignItems: "center",
-          justifyContent: "center",
-          flexShrink: 0,
-          flexGrow: 0,
-          ...props.css,
-        }}
+        css={[
+          {
+            display: "flex",
+            alignItems: "center",
+            justifyContent: "center",
+            flexShrink: 0,
+            flexGrow: 0,
+          },
+          props.css,
+        ]}
       />
     )
   },
```

---

### Incident Patch 14: `6107f36c` (2026-09-04)
**Commit Message**: fix(cli): allow install on Node.js 26

Fixes #10963

**File**: `.changeset/cli-boxen-node-26.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@chakra-ui/cli": patch
+---
+
+Fix `@chakra-ui/cli` failing to install on Node.js 26.
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@
     "@types/babel__core": "^7.20.5",
     "@types/cli-table": "^0.3.4",
     "@types/debug": "^4.1.12",
-    "@visulima/boxen": "^2.0.10",
+    "@visulima/boxen": "^5.0.0",
     "chokidar": "5.0.0",
     "cli-table": "^0.3.11",
     "commander": "14.0.3",
```

**File**: `pnpm-lock.yaml` (modified, +6/-6)
```diff
@@ -576,8 +576,8 @@ importers:
         specifier: ^4.1.12
         version: 4.1.12
       '@visulima/boxen':
-        specifier: ^2.0.10
-        version: 2.0.10
+        specifier: ^5.0.0
+        version: 5.0.0
       chokidar:
         specifier: 5.0.0
         version: 5.0.0
@@ -6121,9 +6121,9 @@ packages:
   '@vanilla-extract/private@1.0.6':
     resolution: {integrity: sha512-ytsG/JLweEjw7DBuZ/0JCN4WAQgM9erfSTdS1NQY778hFQSZ6cfCDEZZ0sgVm4k54uNz6ImKB33AYvSR//fjxw==}
 
-  '@visulima/boxen@2.0.10':
-    resolution: {integrity: sha512-ljghUzl32eUxIixARh8HBBJ2SXz2mJoD7C7Tl9/AEerN/PNihq1PMkzX/QPvMYOXpKrwoPt8ISNOc2EUacX5Wg==}
-    engines: {node: '>=20.18 <=25.x'}
+  '@visulima/boxen@5.0.0':
+    resolution: {integrity: sha512-IGbBM21w5YSGzeDhBJ5/0XAen+tBc/fzCnbD2gMVqcG8mGolyNFMK9vK8mlAkchSgvfqYrJtwRtLzrv2IPhtzg==}
+    engines: {node: ^22.14.0 || >=24.10.0}
     os: [darwin, linux, win32]
 
   '@vitejs/plugin-react@6.0.1':
@@ -17577,7 +17577,7 @@ snapshots:
 
   '@vanilla-extract/private@1.0.6': {}
 
-  '@visulima/boxen@2.0.10': {}
+  '@visulima/boxen@5.0.0': {}
 
   '@vitejs/plugin-react@6.0.1(vite@8.0.2(@types/node@24.10.12)(esbuild@0.27.3)(jiti@2.6.1)(terser@5.46.0)(tsx@4.22.4)(yaml@2.9.0))':
     dependencies:
```

---

### Incident Patch 15: `51f0eac7` (2026-09-04)
**Commit Message**: fix: honor cursor tokens on cards, slider, and disabled states

Checkbox Card, Radio Card, and Slider never read their cursor tokens, so
theme overrides did nothing. Disabled styles hardcoded not-allowed instead
of tokens.cursor.disabled.

**File**: `.changeset/cursor-token-slots.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@chakra-ui/react": patch
+"@chakra-ui/panda-preset": patch
+---
+
+Fix Checkbox Card, Radio Card, and Slider ignoring their cursor tokens, so
+overriding `tokens.cursor.checkbox`, `radio`, or `slider` in the theme did
+nothing. Disabled elements now use `tokens.cursor.disabled` instead of a
+hardcoded `not-allowed`, and Listbox items use `tokens.cursor.option`.
```

**File**: `packages/panda-preset/src/layer-styles.ts` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ export const layerStyles = defineLayerStyles({
   disabled: {
     value: {
       opacity: "0.5",
-      cursor: "not-allowed",
+      cursor: "disabled",
     },
   },
   none: {
```

**File**: `packages/panda-preset/src/slot-recipes/checkbox-card.ts` (modified, +2/-0)
```diff
@@ -20,8 +20,10 @@ export const checkboxCardSlotRecipe = defineSlotRecipe({
       borderRadius: "l2",
       flex: "1",
       focusVisibleRing: "outside",
+      cursor: "checkbox",
       _disabled: {
         opacity: "0.8",
+        cursor: "disabled",
       },
       _invalid: {
         outline: "2px solid",
```

**File**: `packages/panda-preset/src/slot-recipes/listbox.ts` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ export const listboxSlotRecipe = defineSlotRecipe({
       display: "flex",
       alignItems: "center",
       gap: "2",
-      cursor: "pointer",
+      cursor: "option",
       justifyContent: "space-between",
       flex: "1",
       textAlign: "start",
```

**File**: `packages/panda-preset/src/slot-recipes/radio-card.ts` (modified, +2/-0)
```diff
@@ -28,11 +28,13 @@ export const radioCardSlotRecipe = defineSlotRecipe({
       userSelect: "none",
       position: "relative",
       borderRadius: "l2",
+      cursor: "radio",
       _focus: {
         bg: "colorPalette.muted/20",
       },
       _disabled: {
         opacity: "0.5",
+        cursor: "disabled",
       },
       _checked: {
         zIndex: "1",
```

**File**: `packages/panda-preset/src/slot-recipes/segment-group.ts` (modified, +2/-0)
```diff
@@ -32,8 +32,10 @@ export const segmentGroupSlotRecipe = defineSlotRecipe({
       position: "relative",
       color: "fg",
       borderRadius: "var(--segment-radius)",
+      cursor: "button",
       _disabled: {
         opacity: "0.5",
+        cursor: "disabled",
       },
       "&:has(input:focus-visible)": {
         focusRing: "outside",
```

**File**: `packages/panda-preset/src/slot-recipes/slider.ts` (modified, +5/-0)
```diff
@@ -34,6 +34,10 @@ export const sliderSlotRecipe = defineSlotRecipe({
       display: "inline-flex",
       alignItems: "center",
       position: "relative",
+      cursor: "slider",
+      _disabled: {
+        cursor: "disabled",
+      },
     },
     track: {
       overflow: "hidden",
@@ -78,6 +82,7 @@ export const sliderSlotRecipe = defineSlotRecipe({
       zIndex: "2",
       borderRadius: "full",
       transition: "shadow",
+      cursor: "slider",
       _focusVisible: {
         ring: "3px",
         ringColor: "colorPalette.focusRing/50",
```

**File**: `packages/panda-preset/src/slot-recipes/switch.ts` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ export const switchSlotRecipe = defineSlotRecipe({
       transition: "backgrounds",
       _disabled: {
         opacity: "0.5",
-        cursor: "not-allowed",
+        cursor: "disabled",
       },
       _invalid: {
         outline: "2px solid",
```

#### Recent Merged Pull Requests:
- **PR #11015** (2026-09-24): fix(scroll-area): hide each scrollbar based on its own axis (@mixelburg)
- **PR #11012** (2026-09-21): docs(checkbox): fix controlled example with RootProvider (@Adebesin-Cell)
- **PR #11011** (closed): fix(react): stop tabs from clicking link triggers on programmatic value change (@AlexRixten)
- **PR #11005** (2026-09-15): fix(www): add "use client" to pagination custom format example (@Adebesin-Cell)
- **PR #11001** (2026-09-14): docs(components): add examples for various component props (@Adebesin-Cell)
- **PR #10998** (closed): docs(steps): add skippable step example (@salehghotbani)
- **PR #10997** (closed): docs(slider): add custom marker labels example (@salehghotbani)
- **PR #10996** (closed): docs(select): select virtualized example (@salehghotbani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
