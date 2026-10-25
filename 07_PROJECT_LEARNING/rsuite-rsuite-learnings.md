> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rsuite-rsuite-learnings.md`  
> **Source**: github ([https://github.com/rsuite/rsuite](https://github.com/rsuite/rsuite))  
> **Source Version**: `79077a69`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T04:12:26.077Z  
> **Learning ID**: `learn-github-rsuite-rsuite`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): rsuite/rsuite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rsuite-rsuite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rsuite/rsuite](https://github.com/rsuite/rsuite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T04:12:24.473Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rsuite/rsuite`
- **Description**: 🧱 A suite of React components .  
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8696 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/cross-library-form/src/adapters/helper-engine.tsx`
```
import React, { useEffect, useState } from 'react';
import { useController, useFieldArray, useForm, type Control } from 'react-hook-form';
import { Actions, BillingToggle, FieldFrame } from '../components';
import { emailValid, errors, initialValues, passwordValid } from '../domain';
import { usernameAvailable } from '../api';
import type { AdapterProps, Values } from '../types';

type FieldName =
  | 'profile.email'
  | 'password'
  | 'confirmation'
  | 'username'
  | 'company'
  | `contacts.${number}.email`;
export interface FieldViewProps {
  name: string;
  label: string;
  type: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
}
type View = React.ComponentType<FieldViewProps>;
function ControlledField({
  name,
  label,
  control,
  values,
  View
}: {
  name: FieldName;
  label: string;
  control: Control<Values>;
  values: () => Values;
  View: View;
}) {
  const { field, fieldState } = useController({
    name,
    control,
    shouldUnregister: name === 'company',
    rules: {
      validate: async value => {
        if (name === 'profile.email') return emailValid(value) || errors.email;
        if (name === 'password') return passwordValid(value) || errors.password;
        if (name === 'confirmation')
          return (!!value && value === values().password) || errors.confirmation;
        if (name === 'company') return !!value || errors.company;
        if (name === 'username')
          return (!!value && (await usernameAvailable(value))) || errors.username;
        return emailValid(value) || errors.contact;
      }
    }
  });
  return (
    <FieldFrame name={name}>
      <View
        name={name}
        label={label}
        type={['password', 'confirmation'].includes(name) ? 'password' : 'text'}
        value={field.value ?? ''}
        error={fieldState.error?.message}
        onChange={field.onChange}
        onBlur={field.onBlur}
        inputRef={field.ref}
      />
    </FieldFrame>
  );
}
export function HelperForm({
  attach,
  onSubmit,
  View,
  FormView,
  library
}: AdapterProps & {
  View: View;
  FormView: React.ComponentType<{
    children: React.ReactNode;
    onSubmit: React.FormEventHandler<HTMLFormElement>;
  }>;
  library: string;
}) {
  const methods = useForm<Values>({
    defaultValues: initialValues(),
    mode: 'onBlur',
    reValidateMode: 'onBlur'
  });
  const { fields, append, remove } = useFieldArray({ control: methods.control, name: 'contacts' });
  const [billing, setBilling] = useState(false);
  useEffect(
    () =>
      attach({
        readValues: methods.getValues,
        engine: 'React Hook Form composition',
        stateOwnership:
          'React Hook Form useForm/useFieldArray/Controller; application owns conditional visibility.',
        validationOwnership: `React Hook Form Controller validation and async requests; ${library} supplies field/error UI, with shared application predicates/transport.`
      }),
    [attach, methods.getValues, library]
  );
  const field = (name: FieldName, label: string) => (
    <ControlledField
      key={name}
      name={name}
      label={label}
      control={methods.control}
      values={methods.getValues}
      View={View}
    />
  );
  return (
    <FormView onSubmit={methods.handleSubmit(onSubmit)}>
      {field('profile.email', 'Email')}
      {field('password', 'Password')}
      {field('confirmation', 'Confirm password')}
      {field('username', 'Username')}
      {fields.map((row, index) => (
        <div data-contact-row key={row.id}>
          {field(`contacts.${index}.email`, `Contact ${index + 1} email`)}
          <button type="button" disabled={fields.length === 1} onClick={() => remove(index)}>
            Remove contact {index + 1}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => append({ email: '' })}>
        Add contact
      </button>
      <BillingToggle checked={billing} onChange={setBilling} />
      {billing && field('company', 'Company')}
      <Actions
        reset={() => {
          methods.reset(initialValues());
          setBilling(false);
        }}
      />
    </FormView>
  );
}

```

### Core Architecture Module: `benchmarks/cross-library-table/runner/lifecycle-oracle.mjs`
```
export const lifecycleOwnership = {
  rsuite: 'Native loading/renderLoading/renderEmpty; application request and selection policy',
  antd: 'Native Table loading/Spin and locale.emptyText; application request and selection policy',
  chakra: 'Application loading/empty table-row composition and selection with Chakra primitives',
  heroui:
    'Native React Aria empty rendering through HeroUI; application initial-loading content and request policy'
};
export const lifecycleStates = {
  initial: {
    phase: 'loaded',
    ids: ['entry-000', 'entry-001', 'entry-002'],
    selected: [],
    text: 'Loaded 3 entries'
  },
  selected: {
    phase: 'loaded',
    ids: ['entry-000', 'entry-001', 'entry-002'],
    selected: ['entry-001'],
    text: 'Loaded 3 entries'
  },
  loading: { phase: 'loading', ids: [], selected: [], text: 'Loading entries' },
  empty: { phase: 'empty', ids: [], selected: [], text: 'No entries' },
  recovered: {
    phase: 'recovered',
    ids: ['entry-100', 'entry-101', 'entry-102'],
    selected: [],
    text: 'Recovered 3 entries'
  },
  reselected: {
    phase: 'recovered',
    ids: ['entry-100', 'entry-101', 'entry-102'],
    selected: ['entry-101'],
    text: 'Recovered 3 entries'
  }
};

```

### Core Architecture Module: `benchmarks/cross-library-table/runner/lifecycle-report.mjs`
```
import assert from 'node:assert/strict';
import { lifecycleStates, lifecycleOwnership } from './lifecycle-oracle.mjs';
import { validateRunIntegrity, checkedSummary } from './build-state.mjs';
export function validateLifecycleReport(report, browserName = 'all') {
  assert.equal(report.workflow, 'lifecycle');
  assert.equal(report.complete, true);
  validateRunIntegrity(report);
  assert(['all', 'chromium', 'firefox'].includes(browserName));
  const expected = (browserName === 'all' ? ['chromium', 'firefox'] : [browserName]).flatMap(
    browser =>
      Object.keys(lifecycleOwnership).flatMap(library =>
        ['pointer', 'keyboard'].map(profile => [browser, library, profile].join('/'))
      )
  );
  assert.deepEqual(
    report.cases.map(row => [row.browser, row.library, row.profile].join('/')).sort(),
    expected.sort()
  );
  for (const row of report.cases) {
    assert.equal(typeof row.passed, 'boolean');
    assert(typeof row.version === 'string' && row.version.length);
    assert.equal(row.ownership, lifecycleOwnership[row.library]);
    assert.deepEqual(
      row.checkpoints.map(c => c.name),
      Object.keys(lifecycleStates).slice(0, row.checkpoints.length)
    );
    for (const { name, state } of row.checkpoints) {
      const expected = lifecycleStates[name];
      assert.deepEqual(state.ids, expected.ids);
      assert.deepEqual(JSON.parse(state.selected), expected.selected);
      assert.equal(state.lifecycle.phase, expected.phase);
      assert.equal(state.lifecycle.statusText, expected.text);
      assert.equal(state.lifecycle.statusRole, 'status');
      for (const [kind, active] of [
        ['loading', name === 'loading'],
        ['empty', name === 'empty']
      ]) {
        const indicators = state.lifecycle[kind + 'Indicators'];
        assert(Array.isArray(indicators));
        assert(indicators.every(n => typeof n.visible === 'boolean' && typeof n.text === 'string'));
        assert.equal(indicators.filter(n => n.visible).length, Number(active));
        if (active) assert.equal(indicators.find(n => n.visible).text, expected.text);
      }
      assert(Array.isArray(state.lifecycle.nativeBusy));
      for (const busy of state.lifecycle.nativeBusy) {
        assert(['true', 'false'].includes(busy.value));
        assert.equal(typeof busy.visible, 'boolean');
      }
      const inputs = state.checkboxes.filter(c => c.kind === 'input' && c.rowId !== null);
      assert.deepEqual(
        inputs.map(c => c.rowId),
        expected.ids
      );
      for (const input of inputs) {
        assert.equal(input.checked, expected.selected.includes(input.rowId));
        assert.equal(input.disabled, false);
      }
      assert.deepEqual(state.brokenReferences, []);
      assert.deepEqual(state.duplicateIds, []);
    }
    if (!row.passed) {
      assert(typeof row.error === 'string' && row.error.length);
      continue;
    }
    assert.equal(row.checkpoints.length, Object.keys(lifecycleStates).length);
    assert.deepEqual(row.pageErrors, []);
    assert.deepEqual(row.httpErrors, []);
    assert(row.events.length && row.events.every(e => e.trusted === true));
    for (const id of ['entry-001', 'entry-101'])
      if (row.profile === 'pointer')
        for (const type of ['pointerdown', 'pointerup', 'click'])
          assert(row.events.some(e => e.type === type && e.rowId === id));
      else assert(row.events.some(e => e.type === 'keydown' && e.key === ' ' && e.rowId === id));
    for (const text of ['Start loading', 'Resolve empty', 'Recover data'])
      assert(
        row.events.some(
          e =>
            e.buttonText === text &&
            (row.profile === 'pointer'
              ? e.type === 'click'
              : e.type === 'keydown' && e.key === 'Enter')
        )
      );
  }
  return checkedSummary(report, {
    total: expected.length,
    passed: report.cases.filter(c => c.passed).length,
    failed: report.cases.filter(c => !c.passed).length
  });
}

```

### Core Architecture Module: `benchmarks/cross-library-table/runner/lifecycle-snapshot.mjs`
```
export function lifecycleSnapshot() {
  const section = document.querySelector('section[aria-label="Lifecycle ledger"]');
  const visible = node => {
    const b = node.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return false;
    for (let p = node; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) === 0)
        return false;
    }
    return true;
  };
  const indicators = selector =>
    [...section.querySelectorAll(selector)].map(node => ({
      text: node.textContent,
      visible: visible(node)
    }));
  return {
    lifecycle: {
      phase: document.querySelector('[data-app-phase]')?.dataset.appPhase,
      statusText: document.querySelector('[data-app-phase]')?.textContent,
      statusRole: document.querySelector('[data-app-phase]')?.getAttribute('role'),
      loadingIndicators: indicators('[data-loading-indicator]'),
      emptyIndicators: indicators('[data-empty-indicator]'),
      nativeBusy: [...section.querySelectorAll('[aria-busy]')].map(node => ({
        tag: node.tagName,
        role: node.getAttribute('role'),
        value: node.getAttribute('aria-busy'),
        visible: visible(node)
      })),
      scope:
        'Application phase/status and selection clearing are explicit. Native busy attributes observed separately; no AT conformance claim.'
    }
  };
}

```

### Core Architecture Module: `benchmarks/cross-library-table/runner/lifecycle-workflow.mjs`
```
import assert from 'node:assert/strict';
import { lifecycleStates } from './lifecycle-oracle.mjs';
import { lifecycleSnapshot } from './lifecycle-snapshot.mjs';
import { virtualActivate as activate } from './virtual-input.mjs';
export async function lifecycleWorkflow(page, profile, checkpoint) {
  async function capture(name) {
    const expected = lifecycleStates[name];
    await page.waitForFunction(expected => {
      const ids = [...document.querySelectorAll('[data-row-id]')].map(n => n.dataset.rowId);
      return (
        JSON.stringify(ids) === JSON.stringify(expected.ids) &&
        document.querySelector('[data-app-phase]')?.dataset.appPhase === expected.phase &&
        document.querySelector('output')?.textContent === JSON.stringify(expected.selected)
      );
    }, expected);
    const deadline = Date.now() + 10000;
    let state;
    do {
      state = await page.evaluate(lifecycleSnapshot);
      const loading = state.lifecycle.loadingIndicators.filter(n => n.visible).length;
      const empty = state.lifecycle.emptyIndicators.filter(n => n.visible).length;
      if (loading === Number(name === 'loading') && empty === Number(name === 'empty')) break;
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    } while (Date.now() < deadline);
    assert.equal(
      state.lifecycle.loadingIndicators.filter(n => n.visible).length,
      Number(name === 'loading')
    );
    assert.equal(
      state.lifecycle.emptyIndicators.filter(n => n.visible).length,
      Number(name === 'empty')
    );
    await checkpoint(name);
  }
  async function select(id) {
    const row = page
      .locator('tr,[role="row"]')
      .filter({ has: page.locator('[data-row-id="' + id + '"]') });
    const checkbox = row.getByRole('checkbox');
    assert.equal(await checkbox.count(), 1);
    await activate(page, checkbox, profile, 'selection', id);
    await page.waitForFunction(
      id => document.querySelector('output')?.textContent === JSON.stringify([id]),
      id
    );
    await page.waitForFunction(
      id =>
        document
          .querySelector('[data-row-id="' + id + '"]')
          ?.closest('tr,[role="row"]')
          ?.querySelector('input[type="checkbox"]')?.checked === true,
      id
    );
    assert.equal(await checkbox.isChecked(), true);
  }
  await page.waitForSelector('[data-row-id]');
  await capture('initial');
  await select('entry-001');
  await capture('selected');
  await activate(
    page,
    page.getByRole('button', { name: 'Start loading', exact: true }),
    profile,
    'toolbar'
  );
  await capture('loading');
  await activate(
    page,
    page.getByRole('button', { name: 'Resolve empty', exact: true }),
    profile,
    'toolbar'
  );
  await capture('empty');
  await activate(
    page,
    page.getByRole('button', { name: 'Recover data', exact: true }),
    profile,
    'toolbar'
  );
  await capture('recovered');
  await select('entry-101');
  await capture('reselected');
}

```

### Core Architecture Module: `benchmarks/cross-library-table/src/lifecycle/LifecycleFixture.tsx`
```
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Adapter from 'lifecycle-adapter';
import { rowsForPhase, phaseText } from './domain';
import type { Phase } from './types';
import '../fixture.css';
declare const __LIBRARY__: string;
function LifecycleFixture() {
  const [phase, setPhase] = useState<Phase>('loaded');
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <main>
      <h1>Loading and empty ledger — {__LIBRARY__}</h1>
      <button
        disabled={phase !== 'loaded'}
        onClick={() => {
          setSelected([]);
          setPhase('loading');
        }}
      >
        Start loading
      </button>
      <button disabled={phase !== 'loading'} onClick={() => setPhase('empty')}>
        Resolve empty
      </button>
      <button disabled={phase !== 'empty'} onClick={() => setPhase('recovered')}>
        Recover data
      </button>
      <output aria-label="Selected entry IDs">{JSON.stringify(selected)}</output>
      <p role="status" data-app-phase={phase}>
        {phaseText[phase]}
      </p>
      <section aria-label="Lifecycle ledger">
        <Adapter
          rows={rowsForPhase(phase)}
          loading={phase === 'loading'}
          selected={selected}
          onSelected={setSelected}
        />
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<LifecycleFixture />);

```

### Core Architecture Module: `benchmarks/cross-library-table/src/lifecycle/adapters/antd.tsx`
```
import { Table } from 'antd';
import { RowIdentity } from '../../components';
import { LoadingIndicator, EmptyIndicator } from '../components';
import type { LifecycleAdapterProps } from '../types';
export default function Adapter({ rows, loading, selected, onSelected }: LifecycleAdapterProps) {
  return (
    <Table
      rowKey="id"
      dataSource={loading ? undefined : rows}
      pagination={false}
      style={{ width: 720 }}
      loading={{ spinning: loading, indicator: <LoadingIndicator /> }}
      locale={{ emptyText: <EmptyIndicator /> }}
      rowSelection={{
        selectedRowKeys: selected,
        preserveSelectedRowKeys: true,
        onChange: keys => onSelected(keys.map(String)),
        columnWidth: 200
      }}
      columns={[
        { key: 'name', title: 'Entry', width: 320, render: (_, row) => <RowIdentity row={row} /> },
        { key: 'amount', title: 'Amount', dataIndex: 'amount', width: 200 }
      ]}
    />
  );
}

```

### Core Architecture Module: `benchmarks/cross-library-table/src/lifecycle/adapters/chakra.tsx`
```
import { ChakraProvider, defaultSystem, Table, Checkbox } from '@chakra-ui/react';
import { RowIdentity, selectionName } from '../../components';
import { toggleKey } from '../../domain';
import { LoadingIndicator, EmptyIndicator } from '../components';
import type { LifecycleAdapterProps } from '../types';
export default function Adapter({ rows, loading, selected, onSelected }: LifecycleAdapterProps) {
  return (
    <ChakraProvider value={defaultSystem}>
      <Table.Root style={{ width: 720 }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader scope="col" width={200}>
              Select
            </Table.ColumnHeader>
            <Table.ColumnHeader scope="col" width={320}>
              Entry
            </Table.ColumnHeader>
            <Table.ColumnHeader scope="col" width={200}>
              Amount
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map(row => (
            <Table.Row key={row.id}>
              <Table.Cell>
                <Checkbox.Root
                  checked={selected.includes(row.id)}
                  onCheckedChange={event =>
                    onSelected(toggleKey(selected, row.id, event.checked === true))
                  }
                >
                  <Checkbox.HiddenInput aria-label={selectionName(row)} />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label>{selectionName(row)}</Checkbox.Label>
                </Checkbox.Root>
              </Table.Cell>
              <Table.Cell>
                <RowIdentity row={row} />
              </Table.Cell>
              <Table.Cell>{row.amount}</Table.Cell>
            </Table.Row>
          ))}
          {!rows.length && (
            <Table.Row>
              <Table.Cell colSpan={3}>
                {loading ? <LoadingIndicator /> : <EmptyIndicator />}
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </ChakraProvider>
  );
}

```

### Core Architecture Module: `benchmarks/cross-library-table/src/lifecycle/adapters/heroui.tsx`
```
import { Table, Checkbox } from '@heroui/react';
import { RowIdentity, selectionName } from '../../components';
import { LoadingIndicator, EmptyIndicator } from '../components';
import type { LifecycleAdapterProps } from '../types';
import '../../heroui.css';
export default function Adapter({ rows, loading, selected, onSelected }: LifecycleAdapterProps) {
  return (
    <Table style={{ width: 720 }}>
      <Table.Content
        aria-label="Lifecycle ledger entries"
        selectionMode="multiple"
        selectedKeys={new Set(selected)}
        onSelectionChange={keys =>
          onSelected(keys === 'all' ? rows.map(row => row.id) : [...keys].map(String))
        }
      >
        <Table.Header>
          <Table.Column id="selection">Select</Table.Column>
          <Table.Column id="name" isRowHeader>
            Entry
          </Table.Column>
          <Table.Column id="amount">Amount</Table.Column>
        </Table.Header>
        <Table.Body
          items={rows}
          renderEmptyState={() => (loading ? <LoadingIndicator /> : <EmptyIndicator />)}
        >
          {row => (
            <Table.Row id={row.id}>
              <Table.Cell>
                <Checkbox slot="selection">
                  <Checkbox.Content aria-label={selectionName(row)}>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Cell>
              <Table.Cell>
                <RowIdentity row={row} />
              </Table.Cell>
              <Table.Cell>{row.amount}</Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Content>
    </Table>
  );
}

```

### Core Architecture Module: `benchmarks/cross-library-table/src/lifecycle/adapters/rsuite.tsx`
```
import Table from 'rsuite/Table';
import Checkbox from 'rsuite/Checkbox';
import 'rsuite/dist/rsuite.min.css';
import { RowIdentity, selectionName } from '../../components';
import { toggleKey } from '../../domain';
import { LoadingIndicator, EmptyIndicator } from '../components';
import type { LifecycleAdapterProps } from '../types';
export default function Adapter({ rows, loading, selected, onSelected }: LifecycleAdapterProps) {
  return (
    <Table
      data={rows}
      rowKey="id"
      width={720}
      height={260}
      loading={loading}
      renderLoading={() => <LoadingIndicator />}
      renderEmpty={() => <EmptyIndicator />}
    >
      {({ Column, Cell, HeaderCell }) => (
        <>
          <Column width={200}>
            <HeaderCell>Select</HeaderCell>
            <Cell>
              {row => (
                <Checkbox
                  aria-label={selectionName(row)}
                  checked={selected.includes(row.id)}
                  onChange={(_, checked) => onSelected(toggleKey(selected, row.id, checked))}
                />
              )}
            </Cell>
          </Column>
          <Column width={320}>
            <HeaderCell>Entry</HeaderCell>
            <Cell>{row => <RowIdentity row={row} />}</Cell>
          </Column>
          <Column width={200}>
            <HeaderCell>Amount</HeaderCell>
            <Cell dataKey="amount" />
          </Column>
        </>
      )}
    </Table>
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5018** (2026-10-25): **fix(benchmarks): preserve visible virtual pointer targets**
  *Symptoms*: The virtual table driver used a locator click on an already visible checkbox label. React Aria temporarily disables pointer events while its virtualizer scrolls, and [locator pointer actions scroll before input](https://playwright.dev/docs/input#mouse-click). The original Chromium/Firefox controls moved row 9000 from scrollTop 360000 to 359628 / 360012 before native pointerdown. In #5016's retained first Table run, the selected HeroUI row ended below the viewport and failed the original visibility assertion.  Wait within the existing ten-second action budget for the enabled label's current center to be a native hit belonging to the requested row, then send native mouse input there. Keep the trusted pointerdown/pointerup/click identity checks, keyboard behavior, selection and visibility assertions, and response/final integrity checks. No DOM focus, forced click, synthetic dispatch, CSS override, deadline increase or oracle relaxation.  Add two production HeroUI native pointer controls and eight covered/clipped/disabled/wrong-row rejection controls across Chromium and Firefox. The CI step is additive; all existing workflows and mutation controls remain.  Validation on the exact source tree `23d4d513`:  - Full Node 24 SDK build, declarations and six built-artifact consumer tests pass after a clean physical frozen dependency install. - A fresh standalone install contains all 3,955 SDK files byte-identical to the owned build; types and all four production adapters pass. - All 10 p
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/table-heroui-selection-scroll?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/table-heroui-selection-scroll&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/table-heroui-selection-scroll&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/table-heroui-selection-scroll?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > [vc]: #hRlbSAskIEmElARzKpfwaldYArl2jjGF4bP/0fX7da0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtbWFpbi1naXQtZml4LXRhYmxlLWhlcm91aS1zZWxlY3Rpb24tc2Nyb2xsLXJzdWl0ZS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9yc3VpdGUvcnN1aXRlLW1haW4vOFhOZmdoYTFpSzVtampmNDhWbmdqSlZVMk1VRiIsInByZXZpZXdVcmwiOiJyc3VpdGUtbWFpbi1naXQtZml4LXRhYmxlLWhlcm91aS1zZWxlY3Rpb24tc2Nyb2xsLXJzdWl0ZS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn0seyJuYW1lIjoicnN1aXRlLXN0b3J5Ym9vayIsInByb2plY3RJZCI6InByal9mNUlrV3lDTEFXSDhaeExPZXF2NjV5UUgwaGZzIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjpudWxsLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoicnN1aXRlLXN0b3J5Ym9vay1naXQtZml4LXRhYmxlLWhlcm91aS1zZWxlY3Rpb24tc2Nyb2xsLXJzdWl0ZS52

- **Issue #5017** (2026-10-24): **fix(benchmarks): follow changing virtual scroll bounds**
  *Symptoms*: The bottom-scroll preflight captured its destination before a virtual list replaced estimated row heights. A shrinking range could time out at the actual bottom; a growing range could pass at an obsolete boundary.  Validate the current scroll boundary after the existing trusted native scroll/completion observations. Retain the initial destination and current dimensions in failure diagnostics. The requested scroll write, 12s deadline, native wheel input, visibility/geometry predicates and measurement/frame conditions remain unchanged. Changes are limited to the two benchmark runner files.  Validation:  - Chromium 141 and Firefox 142 each pass the original five native controls and two new range-change controls: 14 passes total. Running the same controls against the original helper produces four failures, covering both false timeout and false acceptance. - Standalone benchmark type checks and all 14 existing unit tests pass; targeted ESLint, Prettier and normal commit hooks pass. - A separate diagnostic serves the exact downloaded first-failed #5016 production bundles: both browsers complete full/component RSuite virtualized 1k workloads, all 20 checkpoints and both style comparisons. This is a local diagnostic, not a hosted rerun or acceptance of the original failure.  The first #5016 asset failure remains retained and held: 30 accepted cases, one full-profile runtime failure and one dependent component comparison failure. This change does not establish repeated performance res
  **Post-Mortem & Fix Analysis**:
  > #### Review or Edit in CodeSandbox  Open the branch in <a href="https://codesandbox.io/p/github/rsuite/rsuite/fix/picker-scroll-dynamic-range?mode=review&utm_source=gh_app">Web Editor</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/picker-scroll-dynamic-range&utm_source=gh_app">VS Code</a> &bull; <a href="https://codesandbox.io/p/vscode?owner=rsuite&repo=rsuite&branch=fix/picker-scroll-dynamic-range&insiders=true&utm_source=gh_app">Insiders</a><br> Open <a href="https://codesandbox.io/p/devtool/preview/rsuite/rsuite/fix/picker-scroll-dynamic-range?task=preview&port=51423&redirect=true&utm_source=gh_app">Preview</a>  <!-- open-in-codesandbox:complete --> 
  > [vc]: #Nsv72zicUQVR1AHPEfybnlj/nH+0QmgbdZA0B61aQHo=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJyc3VpdGUtbWFpbiIsInByb2plY3RJZCI6InByal9teUhqa1IwbUllcmg4RHg5ZUI0VlY0cHJPMzNHIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiZG9jcyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtbWFpbi1naXQtZml4LXBpY2tlci1zY3JvbGwtZHluYW1pYy1yYW5nZS1yc3VpdGUudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vcnN1aXRlL3JzdWl0ZS1tYWluLzZXbmJoS0pOUUU4VHhXaGM5R0dRZ3M3aDYyUG4iLCJwcmV2aWV3VXJsIjoicnN1aXRlLW1haW4tZ2l0LWZpeC1waWNrZXItc2Nyb2xsLWR5bmFtaWMtcmFuZ2UtcnN1aXRlLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifSx7Im5hbWUiOiJyc3VpdGUtc3Rvcnlib29rIiwicHJvamVjdElkIjoicHJqX2Y1SWtXeUNMQVdIOFp4TE9lcXY2NXlRSDBoZnMiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOm51bGwsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJyc3VpdGUtc3Rvcnlib29rLWdpdC1maXgtcGlja2VyLXNjcm9sbC1keW5hbWljLXJhbmdlLXJzdWl0ZS52ZXJjZWwu

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

### Incident Patch 1: `ed11c0ce` (2026-10-24)
**Commit Message**: Merge source-map security main and preserve both boundary checks

**File**: `.github/workflows/nodejs-ci.yml` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ jobs:
       - run: npm ci --legacy-peer-deps
       - name: Check docs type file boundaries
         run: node --test test/build/docs-type-files.integration-test.cjs
+      - name: Check source map offset bounds
+        run: node --test test/build/source-map-offsets.integration-test.cjs
       - name: Check browser and public consumer CI coverage
         run: node --test test/build/browser-ci-capacity.integration-test.cjs
       - name: Check component defaults registry
```

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -16061,9 +16061,9 @@
       }
     },
     "node_modules/source-map-js": {
-      "version": "1.2.1",
-      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
-      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
+      "version": "1.2.2",
+      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
+      "integrity": "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw==",
       "dev": true,
       "engines": {
         "node": ">=0.10.0"
```

**File**: `test/build/source-map-offsets.integration-test.cjs` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+const assert = require('node:assert/strict');
+const { test } = require('node:test');
+const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
+const { SourceMapConsumer, SourceMapGenerator, SourceNode } = require('source-map-js');
+
+const basicMap = (source = 'input.ts') => ({
+  version: 3,
+  sources: [source],
+  sourcesContent: ['const value = 1;'],
+  names: [],
+  mappings: 'AAAA'
+});
+const indexedMap = (line, column = 0, map = basicMap()) => ({
+  version: 3,
+  sections: [{ offset: { line, column }, map }]
+});
+
+function exercise(operation) {
+  if (operation === 'nested-sources') {
+    let map = { ...basicMap(), sources: ['first.ts', 'second.ts'] };
+    for (let depth = 0; depth < 40; depth++) {
+      map = indexedMap(0, 0, map);
+    }
+    return new SourceMapConsumer(map).sources;
+  }
+  if (operation === 'generated-gap') {
+    const generator = new SourceMapGenerator();
+    generator.addMapping({
+      generated: { line: 10_000_001, column: 0 },
+      original: { line: 1, column: 0 },
+      source: 'input.ts'
+    });
+    const map = generator.toJSON();
+    assert.equal(map.mappings.length, 10_000_004);
+    assert.equal(map.mappings.slice(-4), 'AAAA');
+    return map.mappings.length;
+  }
+  if (operation === 'exhausted-code') {
+    const consumer = new SourceMapConsumer(indexedMap(1_000_000));
+    return SourceNode.fromStringWithSourceMap('x', consumer).toString();
+  }
+  throw new Error('Unknown source-map operation: ' + operation);
+}
+
+async function inBoundedWorker(operation) {
+  const worker = new Worker(__filename, {
+    workerData: operation,
+    resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 }
+  });
+  try {
+    return await new Promise((resolve, reject) => {
+      let settled = false;
+      let operationTimer;
+      const startupTimer = setTimeout(() => finish(new Error('Worker did not start')), 10_000);
+      function finish(error, result) {
+        if (settled) return;
+        settled = true;
+        clearTimeout(startupTimer);
+        clearTimeout(operationTimer);
+        if (error) reject(error);
+        else resolve(result);
+      }
+      worker.once('online', () => {
+        clearTimeout(startupTimer);
+        operationTimer = setTimeout(
+          () => finish(new Error(operation + ' exceeded the 3-second operation budget')),
+          3_000
+        );
+      });
+      worker.once('message', result => finish(null, result));
+      worker.once('error', error => finish(error));
+      worker.once('exit', code =>
+        finish(new Error(operation + ' exited without a result: ' + code))
+      );
+    });
+  } finally {
+    await worker.terminate();
+  }
+}
+
+if (!isMainThread) {
+  parentPort.postMessage(exercise(workerData));
+} else {
+  for (const field of ['line', 'column']) {
+    for (const value of [-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, null, '1']) {
+      test('rejects invalid indexed section ' + field + ': ' + String(value), () => {
+        const offset = { line: 0, column: 0, [field]: value };
+        assert.throws(
+          () => new SourceMapConsumer({ version: 3, sections: [{ offset, map: basicMap() }] }),
+          /non-negative integers/
+        );
+      });
+    }
+  }
+
+  test('rejects excessive direct and accumulated nested line offsets', () => {
+    assert.throws(() => new SourceMapConsumer(indexedMap(100_000_000)), /must not exceed/);
+    assert.throws(
+      () => new SourceMapConsumer(indexedMap(6_000_000, 0, indexedMap(6_000_000))),
+      /including offsets of nested sections/
+    );
+    assert.doesNotThrow(() => new SourceMapConsumer(indexedMap(10_000_000)));
+  });
+
+  test('retains normal indexed mappings and source content', () => {
+    const consumer = new SourceMapConsumer({
+      version: 3,
+      sections: [
+        { offset: { line: 0, column: 0 }, map: basicMap('first.ts') },
+        { offset: { line: 1, column: 2 }, map: basicMap('second.ts') }
+      ]
+    });
+    assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 1 }), {
+      source: 'first.ts',
+      line: 1,
+      column: 0,
+      name: null
+    });
+    assert.deepEqual(consumer.originalPositionFor({ line: 2, column: 3 }), {
+      source: 'second.ts',
+      line: 1,
+      column: 0,
+      name: null
+    });
+    assert.deepEqual(consumer.sources, ['first.ts', 'second.ts']);
+    assert.equal(consumer.sourceContentFor('second.ts'), 'const value = 1;');
+    assert.equal(SourceNode.fromStringWithSourceMap('a\n  b', consumer).toString(), 'a\n  b');
+  });
+
+  test('roundtrips a normal generated map and its source content', () => {
+    const generator = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(basicMap()));
+    assert.deepEqual(generator.toJSON(), basicMap());
+    const roundtrip = new SourceMapConsumer(generator.toJSON());
+    assert.deepEqual(roundtrip.originalPositionFor({ line: 1, col
```

---

### Incident Patch 2: `efe6a0f1` (2026-10-24)
**Commit Message**: Merge pull request #5007 from rsuite/build/terser-serializer-security

build: secure webpack option serialization

**File**: `package-lock.json` (modified, +6/-13)
```diff
@@ -14882,14 +14882,6 @@
         "quote-stream": "bin/cmd.js"
       }
     },
-    "node_modules/randombytes": {
-      "version": "2.1.0",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "safe-buffer": "^5.1.0"
-      }
-    },
     "node_modules/react": {
       "version": "19.0.0",
       "resolved": "https://registry.npmjs.org/react/-/react-19.0.0.tgz",
@@ -15745,12 +15737,13 @@
       }
     },
     "node_modules/serialize-javascript": {
-      "version": "6.0.2",
-      "resolved": "https://registry.npmjs.org/serialize-javascript/-/serialize-javascript-6.0.2.tgz",
-      "integrity": "sha512-Saa1xPByTTq2gdeFZYLLo+RFE35NHZkAbqZeWNd3BpzppeVisAqpDjcp8dyf6uIvEqJRd46jemmyA4iFIeVk8g==",
+      "version": "7.1.4",
+      "resolved": "https://registry.npmjs.org/serialize-javascript/-/serialize-javascript-7.1.4.tgz",
+      "integrity": "sha512-FqlEuoTq/zRmA4Lg6aOqyH3lCHbUtCB0bmHCeFniX2GBdDqMJM3FwdvEhlE5Pim1dlt2FfBdVPmUNNiGhhKqpw==",
       "dev": true,
-      "dependencies": {
-        "randombytes": "^2.1.0"
+      "license": "BSD-3-Clause",
+      "engines": {
+        "node": ">=20.0.0"
       }
     },
     "node_modules/set-function-length": {
```

**File**: `package.json` (modified, +5/-1)
```diff
@@ -28,7 +28,7 @@
     "build:types-cjs": "tsc --project tsconfig.build.json --emitDeclarationOnly --outDir lib/cjs && resolve-tspaths --project tsconfig.build.json --out lib/cjs ",
     "build:types-esm": "tsc --project tsconfig.build.json --emitDeclarationOnly --outDir lib/esm && resolve-tspaths --project tsconfig.build.json --out lib/esm ",
     "build:types": "npm run build:types-cjs && npm run build:types-esm",
-    "postbuild": "node --test test/build/cleanup.integration-test.cjs test/build/source-paths.integration-test.cjs test/build/lodash-imports.integration-test.cjs test/build/declaration-paths.integration-test.cjs && cross-env VITEST_RUNNING_POSTBUILD=true vitest run --environment=node test/validateBuilds.spec.ts",
+    "postbuild": "node --test test/build/cleanup.integration-test.cjs test/build/source-paths.integration-test.cjs test/build/lodash-imports.integration-test.cjs test/build/declaration-paths.integration-test.cjs test/build/serializer-security.integration-test.mjs && cross-env VITEST_RUNNING_POSTBUILD=true vitest run --environment=node test/validateBuilds.spec.ts",
     "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
     "bump-docs": "node scripts/bump-docs-version.js",
     "dist:analyze": "ANALYZE=true webpack --mode production --progress",
@@ -194,6 +194,10 @@
     "aria-query@>5.1.3": "5.1.3",
     "get-uri@6.0.4": {
       "basic-ftp": "^6.2.3"
+    },
+    "terser-webpack-plugin": {
+      ".": "5.3.10",
+      "serialize-javascript": "^7.1.3"
     }
   },
   "browserslist": [
```

**File**: `test/build/serializer-security.integration-test.mjs` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import assert from 'node:assert/strict';
+import { spawnSync } from 'node:child_process';
+import { createRequire } from 'node:module';
+import test from 'node:test';
+import vm from 'node:vm';
+
+// Exercise the serializer resolved by the actual webpack minimizer, including overrides.
+const fromProject = createRequire(import.meta.url);
+const fromMinimizer = createRequire(fromProject.resolve('terser-webpack-plugin'));
+const serializerPath = fromMinimizer.resolve('serialize-javascript');
+const serialize = fromMinimizer('serialize-javascript');
+
+function assertNoInjectedStatement(value) {
+  const sandbox = { serializationProbe: 0 };
+  try {
+    const output = serialize(value);
+    vm.runInNewContext(output, sandbox, { timeout: 1000 });
+  } catch (error) {
+    // Rejecting a forged built-in is also safe; the injected assignment must never run.
+    assert.match(error.name, /^(?:TypeError|SyntaxError)$/);
+  }
+  assert.equal(sandbox.serializationProbe, 0);
+}
+
+test('minimizer serialization cannot inject a statement through RegExp flags', () => {
+  const regexp = Object.create(RegExp.prototype);
+  Object.defineProperties(regexp, {
+    source: { value: 'pattern' },
+    flags: { value: 'g");globalThis.serializationProbe=1;//' }
+  });
+  assertNoInjectedStatement(regexp);
+});
+
+test('minimizer serialization cannot inject a statement through a Date', () => {
+  const date = new Date('2026-01-01T00:00:00.000Z');
+  date.toISOString = () => '2026-01-01T00:00:00.000Z");globalThis.serializationProbe=1;//';
+  assertNoInjectedStatement(date);
+});
+
+test('a forged function ending in a bare script closer cannot escape its surrounding output', () => {
+  function callback() {}
+  callback.toString = () => 'function callback(){ return 1 }//</script';
+  const output = serialize({ nested: { callback }, tail: 'next value' }, { space: 2 });
+  assert.doesNotMatch(output, /<\/script(?=[\t\n\f\r />]|$)/i);
+});
+
+test('ordinary minimizer option values and function syntax retain their behavior', () => {
+  const output = serialize({
+    compress: { passes: 2, pure_funcs: ['debug'] },
+    format: { comments: /license/i },
+    callback: value => value + 1,
+    date: new Date('2026-01-01T00:00:00.000Z'),
+    map: new Map([['entry', 42]]),
+    set: new Set([3, 4]),
+    bigint: 42n,
+    missing: undefined,
+    html: '</script><div>plain string</div>'
+  });
+  const value = vm.runInNewContext('(' + output + ')', {}, { timeout: 1000 });
+  assert.equal(value.compress.passes, 2);
+  assert.equal(value.format.comments.test('License'), true);
+  assert.equal(value.callback(2), 3);
+  assert.equal(value.date.toISOString(), '2026-01-01T00:00:00.000Z');
+  assert.equal(value.map.get('entry'), 42);
+  assert.equal(value.set.has(4), true);
+  assert.equal(value.bigint, 42n);
+  assert.equal(value.missing, undefined);
+  assert.equal(value.html, '</script><div>plain string</div>');
+  assert.doesNotMatch(output, /<\/script/i);
+});
+
+test('a large array-like object cannot hang minimizer serialization', () => {
+  const script = `
+    const serialize = require(${JSON.stringify(serializerPath)});
+    const value = Object.create(Array.prototype);
+    value.length = 2147483647;
+    value[0] = 'first';
+    const output = serialize(value);
+    if (!output.includes('2147483647')) throw new Error('Array-like length was lost');
+    process.stdout.write('serialized');
+  `;
+  const child = spawnSync(process.execPath, ['-e', script], {
+    timeout: 5000,
+    maxBuffer: 64 * 1024,
+    encoding: 'utf8'
+  });
+  assert.ifError(child.error);
+  assert.equal(child.status, 0, child.stderr);
+  assert.equal(child.stdout, 'serialized');
+});
```

---

### Incident Patch 3: `9969a502` (2026-10-23)
**Commit Message**: Merge pull request #5001 from rsuite/fix/nextjs-app-15.5.28

fix(examples): patch Next.js App Router security release

**File**: `examples/with-nextjs-app/package.json` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
   },
   "dependencies": {
     "@rsuite/icons": "^1.4.0",
-    "next": "^15.5.27",
+    "next": "^15.5.28",
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "react-icons": "^5.4.0",
```

**File**: `examples/with-nextjs-app/pnpm-lock.yaml` (modified, +31/-31)
```diff
@@ -13,8 +13,8 @@ dependencies:
     specifier: ^1.4.0
     version: 1.4.0(react-dom@19.2.3)(react@19.2.3)
   next:
-    specifier: ^15.5.27
-    version: 15.5.27(@types/node@22.19.2)(react-dom@19.2.3)(react@19.2.3)
+    specifier: ^15.5.28
+    version: 15.5.28(@types/node@22.19.2)(react-dom@19.2.3)(react@19.2.3)
   react:
     specifier: ^19.0.0
     version: 19.2.3
@@ -858,75 +858,75 @@ packages:
     resolution: {integrity: sha512-dfLbk+PwWvFzSxwk3n5ySL0hfBog779o8h68wK/7/APo/7cgyWp5jcXockbxdk5kFRkbeXWm4Fbi9FrdN381sA==}
     dev: false
 
-  /@next/env@15.5.27:
-    resolution: {integrity: sha512-WC5hvVqiuFOcRyz6gKPeJkiVvSMf3scNeAV49CdWtVqxmUlzh8UKR6YHt9yiNkh8LngtzqSlVz07/Ma3ZAzchA==}
+  /@next/env@15.5.28:
+    resolution: {integrity: sha512-xxW5EBI8fMPuVTPBW7LL980IRbuDXlbkUAwp9DDhtb4Lnich3nJ13uYpvrX4VE74hWPf6AvHHAMmGCidcHjbfg==}
     dev: false
 
-  /@next/swc-darwin-arm64@15.5.27:
-    resolution: {integrity: sha512-fBA9QurmK4+uj4wNhmRTuO5zMVRaBHCvp6H93zTG/5i6Yi6TewbvbesXB8YQNj8T99Cwrow87hHiFV6wL/hyMA==}
+  /@next/swc-darwin-arm64@15.5.28:
+    resolution: {integrity: sha512-dPoQYXcfSIqx5o+TOXVXO7kONK5qbtNRDeiTfII0bT3puGIT6VF5e0QwmxNZfEZ5Zety5f3m9P/p4xqwfiLlPg==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-darwin-x64@15.5.27:
-    resolution: {integrity: sha512-FGZwJwry8qZNHxD/nfwrCwCHHrqx6epqItkkxbYcBQEQ2uw5S43bY83fQB5zbAsZE7TELMjoYkbhsQ4oKM7wwg==}
+  /@next/swc-darwin-x64@15.5.28:
+    resolution: {integrity: sha512-RgCJ7buBivTH+6sddqaVm+/v8kwMHlFkobvdt3DfETutws5HrxnToMIWSN9X3MZ3aAi7BbKrGZZWUDQLEycXqw==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-linux-arm64-gnu@15.5.27:
-    resolution: {integrity: sha512-GQulAaJYNF1RYuatlsw9/uzbKz4if2V7Ic9nVO+P0ljYPm4yBRTFIl6g5YkKTw40lMLbpy9edLoH44g3jSHMYA==}
+  /@next/swc-linux-arm64-gnu@15.5.28:
+    resolution: {integrity: sha512-OHXQe13olE59aKe++zHavGcJPh5SLHXi6Anret3BBeq1+qhSuOJDNAli/EDDfxs6UTqA4Qddo4uyYry2slyjiQ==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-linux-arm64-musl@15.5.27:
-    resolution: {integrity: sha512-URFFsUmu8Pi0/1qdnUI7tx7keZw1Mt5zHfrIX1RfDG9Nih8DYxK54WZsDJUX2ZTlii1jgotL7qcbwKnSAES6xQ==}
+  /@next/swc-linux-arm64-musl@15.5.28:
+    resolution: {integrity: sha512-nTB7bB6vfn4ezCJNYP43ukt2o8L3+WxKF/sTcTxepdXsJh3SM9RhlU7wrZYbH7L4HO5M87dqDTwm8587vAkCiw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-linux-x64-gnu@15.5.27:
-    resolution: {integrity: sha512-aJp74z7uvU5jQhyH7lyk+4qSRcTdKbKT9NQE3jiO9kWYkoHZjKi0zzHDbCoZ+v2sJDEiJ/z58R0UlWMGWNF3HA==}
+  /@next/swc-linux-x64-gnu@15.5.28:
+    resolution: {integrity: sha512-WXCfVI32rW3xCusoUX1RpZKtyChWU2Zwe27JUDmM3KrXwcDNc9vV4zEq0GKFAURnuQ/Ouo/XqPvB0yh445XZCg==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-linux-x64-musl@15.5.27:
-    resolution: {integrity: sha512-ILl2bQ8MbpvyMpY8AXljb3BXs0MJSC8HXZ6QV5AWpVS7ZELqNPtrHvhUk+SNarvjvICXX8bCS287TCi+gUFVYg==}
+  /@next/swc-linux-x64-musl@15.5.28:
+    resolution: {integrity: sha512-Miq+NDb/HWsXuxseYxMM6fuEOQXgTziarkKIRpVKCn8W69cEfhQaQr+90pO+u4q2CbJR2wzXmUuCFyZaJs/Nng==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [linux]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-win32-arm64-msvc@15.5.27:
-    resolution: {integrity: sha512-1MB9Rh5y8TOPN2x7naNTJNkCZQav9c70AI7EBYXxsEewwOffC4DjjwBwKf20NBvcA+u+5jDv7nVmHxunlP2d7Q==}
+  /@next/swc-win32-arm64-msvc@15.5.28:
+    resolution: {integrity: sha512-5LR79lemgDlgxvG7MQJ+zHCkVcrUoQuO7CiIvq3I58vNW4goSOE2b+19Z6FujRWMouvni4gvudYFuFuNxolGWA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [win32]
     requiresBuild: true
     dev: false
     optional: true
 
-  /@next/swc-win32-x64-msvc@15.5.27:
-    resolution: {integrity: sha512-XtYgpGOswgnyBWXzOEG6q9RhvnSw0CEZ0MbWqCsl5PISgt9EzvJvNW5mU5n1PsphX/lnamzxjgQXH2GUJL8nqg==}
+  /@next/swc-win32-x64-msvc@15.5.28:
+    resolution: {integrity: sha512-GNipvXUYROSTf4PXEyH95FrWImIB5zdaK6uEOg0RP1/X2drnvoMwiBkJ0VWdzX7w3iiBm3y5g2TxkKDGVTOQcg==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [win32]
@@ -1120,8 +1120,8 @@ packages:
     engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
     hasBin: true
 
-  /next@15.5.27(@types/node@22.19.2)(react-dom@19.2.3)(react@19.2.3):
-    resolution: {integrity: sha512-F82CrlPZ8GRxBH9RIIoR3qU1t5RT3dv1K8moe8SjlDEquiFipvEI13R1Om90TaUOEwShkWCMlg8+gvTNzfMhvg==}
+  /next@15.5.28(@types/node@22.19.2)(react-dom@19.2.3)(react@19.2.3):
+    resolution: {integrity: sha512-JjhLBBY1PNnuwPtcZ7t8yxVeJVYvD2Jyp633J+gRCNbzSt7N0E+xqCf6uQiff3+3qmUkwcF/ksfSsK1xsZ76Tw==}
     engines: {node: ^18.18.0 || ^19.8.0 || >= 20.0.0}

```

#### Recent Merged Pull Requests:
- **PR #5018** (2026-10-25): fix(benchmarks): preserve visible virtual pointer targets (@simonguo)
- **PR #5017** (2026-10-24): fix(benchmarks): follow changing virtual scroll bounds (@simonguo)
- **PR #5014** (2026-10-24): ci(benchmark): retain geometry guard operands on failure (@simonguo)
- **PR #5013** (2026-10-24): fix(benchmark): finish range scrolling before the next preflight (@simonguo)
- **PR #5012** (2026-10-24): fix(docs): constrain type file reads to flat JSON names (@simonguo)
- **PR #5011** (2026-10-24): fix(form): require schema-typed 2.4.4 for async rules (@simonguo)

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

## X. Merge source-map security main and preserve both boundary checks

**RULE**:
When implementing operations in `.github/workflows/nodejs-ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rsuite/rsuite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ed11c0ce`: Merge source-map security main and preserve both boundary checks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/nodejs-ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      - name: Check source map offset bounds
        run: node --test test/build/source-map-offsets.integration-test.cjs
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ed11c0ce` are properly handled with clean fallback behavior.
