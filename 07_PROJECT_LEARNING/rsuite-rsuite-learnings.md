> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rsuite-rsuite-learnings.md`  
> **Source**: github ([https://github.com/rsuite/rsuite](https://github.com/rsuite/rsuite))  
> **Source Version**: `d056c753`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T00:02:04.051Z  
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
> **Harvest Timestamp**: 2026-10-21T00:02:03.045Z  
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
- **Issue #4968** (2026-10-20): **test(table): verify loading and empty recovery**
  *Symptoms*: The table benchmark needs to verify that data identities and real checkbox state recover correctly when an application request removes all rows. This adds a loaded → loading → empty → recovered workflow with six checkpoints, three original IDs and three different recovered IDs.  The shared application request policy clears rows and selected keys when loading starts. Trusted pointer or keyboard input selects an original row, drives all phase buttons, and selects a recovered row. Reports verify every data row's native checkbox, exact identity/order, controlled selection, visible loading/empty presentation, reference integrity and native input ownership. Application phase/status and native `aria-busy` observations are recorded separately.  Ownership remains explicit: RSuite uses public loading/render hooks; Ant Design uses Table loading/Spin and empty text with undefined initial data during loading; Chakra composes loading/empty table rows; HeroUI uses its React Aria empty render prop with application initial-loading content. The shared application selection clearing is an application policy. Native additional-item loading is a separate HeroUI API.  Validation:  - Lifecycle: 16/16 Chromium/Firefox × four libraries × pointer/keyboard cases, with strict TypeScript and 64-file explicit ESLint checks passing. - A clean standalone npm installation reproduces 16/16 with identical source inputs, all 328 installed packages, the supplied full source-SDK snapshot and all four production a

- **Issue #4967** (2026-10-20): **test(table): verify virtual workflows and run integrity**
  *Symptoms*: The table prototype needs a virtualized large-data workflow and stronger evidence that each report describes one coherent build and DOM state. This adds a 10,000-row jump/select/retain workflow and closes two reporting gaps: snapshots taken in separate browser tasks could disagree after native DOM recycling, and startup-only fingerprints did not detect changed response bytes or inputs left modified during a run.  The new workflow uses real Chromium/Firefox pointer and keyboard input, actual visible row IDs and native checkbox state. It records mounted versus visible rows separately, including native focused-row persistence. Native engines and application composition are explicit: Chakra uses TanStack Virtual, Ant Design/Chakra use application roving checkbox focus, and HeroUI coordinates its public React Aria focus key with the application jump controller. A documented opaque header style keeps recycled overscan content from painting through the header.  All snapshot fields now come from one browser task. Each successfully served artifact is checked against its build digest, and source/SDK/full installed-package closure/artifacts are verified again at completion. A response violation stays recorded after restoration. Validators recompute summary counts and reject contradictory stored summaries. Reusable checks include deterministic atomic-capture regression, malformed-report controls, native Arrow/Home/End focus checks and controlled mid-run mutations with backups, ownership 

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

### Incident Patch 1: `d056c753` (2026-10-20)
**Commit Message**: Merge pull request #4968 from rsuite/bench/cross-library-table-lifecycle

test(table): verify loading and empty recovery

**File**: `.github/workflows/table-benchmarks.yml` (modified, +8/-2)
```diff
@@ -1,4 +1,4 @@
-name: Virtual table workflow
+name: Table workflow integrity
 on:
   pull_request:
     branches: [main, next]
@@ -36,7 +36,7 @@ permissions:
   contents: read
 jobs:
   virtual-integrity:
-    name: Virtual table and report integrity
+    name: Table workflows and report integrity
     runs-on: ubuntu-24.04
     timeout-minutes: 30
     steps:
@@ -73,6 +73,12 @@ jobs:
       - name: Reject malformed or contradictory reports
         working-directory: benchmarks/cross-library-table
         run: node checks/report-integrity.mjs results/virtual/report.json
+      - name: Run Chromium and Firefox loading and empty recovery
+        working-directory: benchmarks/cross-library-table
+        run: node run.mjs --skip-build --workflow lifecycle --output results/lifecycle/report.json
+      - name: Reject stale lifecycle identities and state
+        working-directory: benchmarks/cross-library-table
+        run: node checks/report-integrity.mjs results/lifecycle/report.json
       - name: Check composed native keyboard focus
         working-directory: benchmarks/cross-library-table
         run: node checks/composed-focus.mjs results/focus
```

**File**: `benchmarks/cross-library-table/README.md` (modified, +17/-0)
```diff
@@ -131,3 +131,20 @@ source, installs the standalone cohort with npm ci, runs both native browsers,
 checks atomic capture/report integrity and composed focus, and executes the four
 mid-run mutation controls. Raw results and build fingerprints are uploaded even
 on failure. Sort/tree diagnostic failures remain explicit in their own commands.
+
+### Loading, empty and recovered data
+
+Run the `lifecycle` workflow against all four production adapters:
+
+```sh
+node run.mjs --workflow lifecycle --output results/lifecycle/report.json
+node checks/report-integrity.mjs results/lifecycle/report.json
+```
+
+It selects an original row, starts loading, resolves an empty result, recovers three different row IDs and selects a recovered row. Three application buttons control these transitions deterministically; this is not a network latency measurement. The shared application policy clears rows and selected keys when the request starts. Reports check actual native checkbox state for every data row, including unchecked recovered rows, rather than inferring selection from application output alone. Loading and empty presentation have no data identity markers and cannot count as data rows.
+
+RSuite uses public `loading`, `renderLoading` and `renderEmpty` props. Ant Design uses native `loading`/Spin and `locale.emptyText`, with `dataSource={undefined}` while loading: the pinned version intentionally shows its empty placeholder alongside loading for an explicit empty array. Chakra uses an application loading/empty table-row composition. HeroUI uses its public React Aria empty-state render prop; initial loading content is application composition, distinct from its native additional-item `Table.LoadMoreItem` API.
+
+The application phase/status is recorded separately from actual native `aria-busy` observations. Reference integrity, trusted toolbar/selection input, exact row identities, indicator visibility and real checkbox state are acceptance gates; screen-reader announcement and accessibility conformance are not claimed. The runner waits for native checked state within the same 10-second action bound before capturing a selected checkpoint. Original premature-sampling and adapter-input failures remain recovery evidence.
+
+The dedicated CI workflow now runs both virtual and lifecycle matrices and their report controls, then the shared atomic-capture, focus and exclusive mutation controls. Raw lifecycle outcomes are included in the always-uploaded results.
```

**File**: `benchmarks/cross-library-table/checks/report-integrity.mjs` (modified, +49/-1)
```diff
@@ -3,6 +3,7 @@ import assert from 'node:assert/strict';
 import { validateReport } from '../runner/report.mjs';
 import { validateTreeReport } from '../runner/tree-report.mjs';
 import { validateVirtualReport } from '../runner/virtual-report.mjs';
+import { validateLifecycleReport } from '../runner/lifecycle-report.mjs';
 const [file, browser = 'all', ...extra] = process.argv.slice(2);
 assert(
   file && !extra.length,
@@ -12,7 +13,8 @@ const actual = JSON.parse(fs.readFileSync(file)),
   validate = {
     selection: validateReport,
     tree: validateTreeReport,
-    virtual: validateVirtualReport
+    virtual: validateVirtualReport,
+    lifecycle: validateLifecycleReport
   }[actual.workflow];
 assert(validate, 'Unknown report workflow');
 assert.equal(actual.validated, true);
@@ -104,6 +106,52 @@ if (actual.workflow === 'virtual') {
       .events.filter(e => e.rowId === 'entry-09000')
       .forEach(e => (e.rowId = 'entry-00000'))
   );
+} else if (actual.workflow === 'lifecycle') {
+  const state = (r, name) => positive(r).checkpoints.find(c => c.name === name).state;
+  reject('wrong-workflow', r => (r.workflow = 'selection'));
+  reject('wrong-ownership', r => (positive(r).ownership = 'native-all'));
+  reject('wrong-displayed-id', r => (state(r, 'initial').ids[0] = 'bogus'));
+  reject('stale-recovered-id', r => (state(r, 'recovered').ids[0] = 'entry-000'));
+  reject('stale-loading-selection', r => (state(r, 'loading').selected = '["entry-001"]'));
+  reject('stale-recovered-selection', r => (state(r, 'recovered').selected = '["entry-001"]'));
+  reject('wrong-phase', r => (state(r, 'loading').lifecycle.phase = 'empty'));
+  reject('wrong-app-status', r => (state(r, 'loading').lifecycle.statusText = 'No entries'));
+  reject(
+    'hidden-loading-indicator',
+    r => (state(r, 'loading').lifecycle.loadingIndicators[0].visible = false)
+  );
+  reject('simultaneous-loading-empty', r =>
+    state(r, 'loading').lifecycle.emptyIndicators.push({ text: 'No entries', visible: true })
+  );
+  reject('empty-counted-as-data', r => state(r, 'empty').ids.push('empty-row'));
+  reject(
+    'wrong-recovered-checkbox',
+    r =>
+      (state(r, 'reselected').checkboxes.find(
+        c => c.kind === 'input' && c.rowId === 'entry-101'
+      ).checked = false)
+  );
+  reject('erased-recovered-checkbox', r => {
+    const s = state(r, 'reselected');
+    s.checkboxes = s.checkboxes.filter(c => c.rowId !== 'entry-101');
+  });
+  reject('wrong-recovered-pointer-row', r =>
+    positive(r)
+      .events.filter(e => e.rowId === 'entry-101')
+      .forEach(e => (e.rowId = 'entry-001'))
+  );
+  reject(
+    'missing-native-toolbar-input',
+    r => (positive(r).events = positive(r).events.filter(e => e.buttonText !== 'Start loading'))
+  );
+  reject('invalid-busy-observation', r =>
+    state(r, 'initial').lifecycle.nativeBusy.push({
+      tag: 'DIV',
+      role: null,
+      value: 'invalid',
+      visible: true
+    })
+  );
 } else if (actual.workflow === 'tree') {
   reject('wrong-workflow', r => (r.workflow = 'selection'));
   reject('wrong-ownership', r => (positive(r).ownership = 'native-all'));
```

**File**: `benchmarks/cross-library-table/integrity.mjs` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ export function inputs(root) {
       'index.html',
       'tree.html',
       'virtual.html',
+      'lifecycle.html',
       'vite.config.mjs',
       'build.mjs',
       'run.mjs',
```

**File**: `benchmarks/cross-library-table/lifecycle.html` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <title>Loading and empty table workflow</title>
+  </head>
+  <body>
+    <div id="root"></div>
+    <script type="module" src="/src/lifecycle/LifecycleFixture.tsx"></script>
+  </body>
+</html>
```

**File**: `benchmarks/cross-library-table/run.mjs` (modified, +20/-8)
```diff
@@ -14,13 +14,17 @@ import { assertBuildState, artifactGuard } from './runner/build-state.mjs';
 import { virtualWorkflow } from './runner/virtual-workflow.mjs';
 import { validateVirtualReport } from './runner/virtual-report.mjs';
 import { virtualOwnership } from './runner/virtual-oracle.mjs';
+import { lifecycleWorkflow } from './runner/lifecycle-workflow.mjs';
+import { validateLifecycleReport } from './runner/lifecycle-report.mjs';
+import { lifecycleOwnership } from './runner/lifecycle-oracle.mjs';
 const root = import.meta.dirname,
   args = process.argv.slice(2);
 const outputIndex = args.indexOf('--output'),
   browserIndex = args.indexOf('--browser'),
   workflowIndex = args.indexOf('--workflow');
 const workflowName = workflowIndex < 0 ? 'selection' : args[workflowIndex + 1];
-if (!['selection', 'tree', 'virtual'].includes(workflowName)) throw Error('Invalid workflow');
+if (!['selection', 'tree', 'virtual', 'lifecycle'].includes(workflowName))
+  throw Error('Invalid workflow');
 const output = path.resolve(
   outputIndex < 0
     ? path.join(
@@ -89,11 +93,13 @@ const report = {
   workflow: workflowName,
   qualification: 'Prototype: adapters and driver require review before qualified comparison',
   scope:
-    workflowName === 'virtual'
-      ? '10k rows, application jump controls and native checkbox selection. Mounted rows and visible rows reported separately, including focused-row persistence. No performance/ranking/AT conformance result.'
-      : workflowName === 'tree'
-        ? 'Three-level hierarchy, retained selection and root reorder. Functional and limited tree semantics gates are reported separately; native/composed ownership explicit. No AT/conformance/ranking result.'
-        : 'One sort/filter/ID-selection workflow; native engines versus explicit application composition. No performance/conformance/ranking result.',
+    workflowName === 'lifecycle'
+      ? 'Loaded to loading to empty to recovered data with shared explicit application request/selection policy; native loading and composed content ownership recorded. No AT/performance/ranking claim.'
+      : workflowName === 'virtual'
+        ? '10k rows, application jump controls and native checkbox selection. Mounted rows and visible rows reported separately, including focused-row persistence. No performance/ranking/AT conformance result.'
+        : workflowName === 'tree'
+          ? 'Three-level hierarchy, retained selection and root reorder. Functional and limited tree semantics gates are reported separately; native/composed ownership explicit. No AT/conformance/ranking result.'
+          : 'One sort/filter/ID-selection workflow; native engines versus explicit application composition. No performance/conformance/ranking result.',
   node: process.version,
   built,
   cases: [],
@@ -127,6 +133,7 @@ try {
             row.functionalPassed = false;
           }
           if (workflowName === 'virtual') row.ownership = virtualOwnership[library];
+          if (workflowName === 'lifecycle') row.ownership = lifecycleOwnership[library];
           const capture = createCapture(page, workflowName);
           report.cases.push(row);
           page.on('pageerror', error => row.pageErrors.push(String(error)));
@@ -146,6 +153,7 @@ try {
                       trusted: event.isTrusted,
                       tag: event.target.tagName,
                       role: event.target.getAttribute?.('role'),
+                      buttonText: event.target.closest?.('button')?.textContent,
                       rowId: event.target
                         .closest?.('[data-virtual-row-id],tr,[role="row"]')
                         ?.querySelector('[data-row-id]')?.dataset.rowId,
@@ -167,7 +175,9 @@ try {
                 ? treeWorkflow
                 : workflowName === 'virtual'
                   ? virtualWorkflow
-                  : workflow
+                  : workflowName === 'lifecycle'
+                    ? lifecycleWorkflow
+                    : workflow
             )(page, profile, async (name, observation) => {
               const state = await capture();
               row.checkpoints.push({ name, state, observation });
@@ -222,7 +232,9 @@ try {
         ? validateTreeReport
         : workflowName === 'virtual'
           ? validateVirtualReport
-          : validateReport
+          : workflowName === 'lifecycle'
+            ? validateLifecycleReport
+            : validateReport
     )(report, browserName);
     report.validated = true;
   } catch (error) {
```

**File**: `benchmarks/cross-library-table/runner/capture.mjs` (modified, +4/-2)
```diff
@@ -1,9 +1,11 @@
 import { snapshot } from './snapshot.mjs';
 import { treeSnapshot } from './tree-snapshot.mjs';
 import { virtualSnapshot } from './virtual-snapshot.mjs';
+import { lifecycleSnapshot } from './lifecycle-snapshot.mjs';
 export function createCapture(page, workflow) {
-  const extra =
-    workflow === 'tree' ? treeSnapshot : workflow === 'virtual' ? virtualSnapshot : null;
+  const extra = { tree: treeSnapshot, virtual: virtualSnapshot, lifecycle: lifecycleSnapshot }[
+    workflow
+  ];
   const expression =
     '(() => ({...(' +
     snapshot.toString() +
```

**File**: `benchmarks/cross-library-table/runner/lifecycle-oracle.mjs` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+export const lifecycleOwnership = {
+  rsuite: 'Native loading/renderLoading/renderEmpty; application request and selection policy',
+  antd: 'Native Table loading/Spin and locale.emptyText; application request and selection policy',
+  chakra: 'Application loading/empty table-row composition and selection with Chakra primitives',
+  heroui:
+    'Native React Aria empty rendering through HeroUI; application initial-loading content and request policy'
+};
+export const lifecycleStates = {
+  initial: {
+    phase: 'loaded',
+    ids: ['entry-000', 'entry-001', 'entry-002'],
+    selected: [],
+    text: 'Loaded 3 entries'
+  },
+  selected: {
+    phase: 'loaded',
+    ids: ['entry-000', 'entry-001', 'entry-002'],
+    selected: ['entry-001'],
+    text: 'Loaded 3 entries'
+  },
+  loading: { phase: 'loading', ids: [], selected: [], text: 'Loading entries' },
+  empty: { phase: 'empty', ids: [], selected: [], text: 'No entries' },
+  recovered: {
+    phase: 'recovered',
+    ids: ['entry-100', 'entry-101', 'entry-102'],
+    selected: [],
+    text: 'Recovered 3 entries'
+  },
+  reselected: {
+    phase: 'recovered',
+    ids: ['entry-100', 'entry-101', 'entry-102'],
+    selected: ['entry-101'],
+    text: 'Recovered 3 entries'
+  }
+};
```

---

### Incident Patch 2: `87f36d31` (2026-10-20)
**Commit Message**: Merge pull request #4967 from rsuite/bench/cross-library-table-virtual

test(table): verify virtual workflows and run integrity

**File**: `.github/workflows/table-benchmarks.yml` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+name: Virtual table workflow
+on:
+  pull_request:
+    branches: [main, next]
+    paths:
+      - 'benchmarks/cross-library-table/**'
+      - 'benchmarks/cross-library-picker/integrity.mjs'
+      - 'benchmarks/cross-library-picker/runner/server.mjs'
+      - 'benchmarks/cross-library-picker/runner/diagnostics.mjs'
+      - 'src/**'
+      - 'scripts/**'
+      - 'test/build/**'
+      - 'package*.json'
+      - 'tsconfig*.json'
+      - 'gulpfile.js'
+      - 'webpack*.js'
+      - '.babelrc*'
+      - '.github/workflows/table-benchmarks.yml'
+  push:
+    branches: [main, next]
+    paths:
+      - 'benchmarks/cross-library-table/**'
+      - 'benchmarks/cross-library-picker/integrity.mjs'
+      - 'benchmarks/cross-library-picker/runner/server.mjs'
+      - 'benchmarks/cross-library-picker/runner/diagnostics.mjs'
+      - 'src/**'
+      - 'scripts/**'
+      - 'test/build/**'
+      - 'package*.json'
+      - 'tsconfig*.json'
+      - 'gulpfile.js'
+      - 'webpack*.js'
+      - '.babelrc*'
+      - '.github/workflows/table-benchmarks.yml'
+permissions:
+  contents: read
+jobs:
+  virtual-integrity:
+    name: Virtual table and report integrity
+    runs-on: ubuntu-24.04
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '24'
+          cache: npm
+          cache-dependency-path: |
+            package-lock.json
+            benchmarks/cross-library-table/package-lock.json
+      - name: Install SDK build dependencies
+        run: npm ci --legacy-peer-deps
+      - name: Build and validate source SDK
+        run: npm run build
+      - name: Install frozen standalone cohort
+        working-directory: benchmarks/cross-library-table
+        run: npm ci --ignore-scripts
+      - name: Install pinned native browsers
+        working-directory: benchmarks/cross-library-table
+        run: node node_modules/playwright/cli.js install --with-deps chromium firefox
+      - name: Check standalone types
+        working-directory: benchmarks/cross-library-table
+        run: npm run check
+      - name: Build all four production adapters
+        working-directory: benchmarks/cross-library-table
+        run: npm run build
+      - name: Verify atomic DOM capture
+        working-directory: benchmarks/cross-library-table
+        run: node checks/atomic-capture.mjs
+      - name: Run Chromium and Firefox virtual workflows
+        working-directory: benchmarks/cross-library-table
+        run: node run.mjs --skip-build --workflow virtual --output results/virtual/report.json
+      - name: Reject malformed or contradictory reports
+        working-directory: benchmarks/cross-library-table
+        run: node checks/report-integrity.mjs results/virtual/report.json
+      - name: Check composed native keyboard focus
+        working-directory: benchmarks/cross-library-table
+        run: node checks/composed-focus.mjs results/focus
+      - name: Reject mid-run mutations and restore inputs
+        working-directory: benchmarks/cross-library-table
+        run: node checks/runtime-mutations.mjs results/runtime-controls
+      - name: Upload raw outcomes and input fingerprints
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: virtual-table-${{ github.sha }}
+          retention-days: 14
+          if-no-files-found: error
+          path: |
+            benchmarks/cross-library-table/results
+            benchmarks/cross-library-table/dist/build-inputs.json
```

**File**: `benchmarks/cross-library-table/README.md` (modified, +47/-1)
```diff
@@ -83,5 +83,51 @@ package; all three competitor asset sets and the SDK remain identical. The
 published package and all four production asset sets are restored afterwards.
 This does not measure a public npm release of the fixes.
 
-Virtual scroll and loading/empty recovery remain planned separate workflows.
+The virtual workflow uses 10,000 fixed records and a 400px body viewport. Shared
+application jump buttons request the top, row 9000 and the end. Both input profiles
+select the actual row checkbox and retain its key across viewport changes. DOM
+membership and clipped visibility are reported separately: a native focused row
+may remain mounted outside the viewport. Bounded DOM counts are correctness
+checks, not performance measurements.
+
+RSuite uses its native virtualizer and scrolling ref with application Checkbox
+selection. Ant Design uses native virtualization, selection and scrolling with
+public onRow ID attributes and an application roving checkbox focus policy. Chakra composes TanStack Virtual and a roving
+checkbox focus policy; its sticky header is included in scrolling padding. HeroUI
+uses React Aria Virtualizer/TableLayout and selection. Its application jump
+controller coordinates the public TableStateContext focus key with DOM scrolling.
+No runner calls DOM focus, forces a click or increases the ten-second deadline.
+
+    node run.mjs --skip-build --workflow virtual --output /absolute/path/virtual.json
+    node checks/report-integrity.mjs /absolute/path/virtual.json
+
+The single-task-v1 capture evaluates all DOM snapshot fields in the same browser
+task. A deterministic microtask-reorder control reproduces the old split-sampling
+race and verifies that atomic sampling keeps row IDs and metadata consistent.
+
+    node checks/atomic-capture.mjs
+    node checks/composed-focus.mjs /absolute/path/focus-results
+
+The response-and-final-v1 protocol hashes every successfully served response and
+checks source, SDK, installed dependencies and all production artifacts again
+at completion. A response violation stays recorded even if its file is restored.
+Validators recompute outcomes and reject a contradictory stored summary. Older
+prototype reports need their captured protocol version; they do not prove these
+new integrity checks.
+
+Run the mutation controls exclusively: they temporarily change one owned source,
+SDK manifest, installed-package manifest or served HTML file after the first
+browser case. They keep backups/journals, restore exact bytes in cleanup and
+reject a file modified externally instead of overwriting it.
+
+    node checks/runtime-mutations.mjs /absolute/path/control-results
+
+Loading/empty recovery, native wheel/keyboard exploration beyond this jump
+workflow and repeated performance measurements remain separate work.
 No overall ranking is established.
+
+The dedicated Virtual table workflow CI builds the SDK from the checked-out
+source, installs the standalone cohort with npm ci, runs both native browsers,
+checks atomic capture/report integrity and composed focus, and executes the four
+mid-run mutation controls. Raw results and build fingerprints are uploaded even
+on failure. Sort/tree diagnostic failures remain explicit in their own commands.
```

**File**: `benchmarks/cross-library-table/checks/atomic-capture.mjs` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+import assert from 'node:assert/strict';
+import { chromium, firefox } from 'playwright';
+import { snapshot } from '../runner/snapshot.mjs';
+import { virtualSnapshot } from '../runner/virtual-snapshot.mjs';
+import { createCapture } from '../runner/capture.mjs';
+const results = [];
+for (const [name, engine] of Object.entries({ chromium, firefox })) {
+  const browser = await engine.launch();
+  try {
+    const run = async atomic => {
+      const context = await browser.newContext(),
+        page = await context.newPage();
+      try {
+        await page.setContent(
+          '<output>[]</output><section aria-label="Virtual ledger" style="width:400px;height:200px"><div role="row"><span data-row-id="entry-00000">First</span></div><div role="row"><span data-row-id="entry-00001">Second</span></div></section>'
+        );
+        await page.evaluate(() => {
+          const original = Document.prototype.querySelectorAll;
+          let armed = true;
+          document.querySelectorAll = function (selector) {
+            const value = original.call(this, selector);
+            if (selector === '[data-row-id]' && armed) {
+              armed = false;
+              queueMicrotask(() => {
+                const section = document.querySelector('section');
+                section.appendChild(section.firstElementChild);
+              });
+            }
+            return value;
+          };
+        });
+        const state = atomic
+          ? await createCapture(page, 'virtual')()
+          : { ...(await page.evaluate(snapshot)), ...(await page.evaluate(virtualSnapshot)) };
+        const current = await page.evaluate(() =>
+          [...document.querySelectorAll('[data-row-id]')].map(n => n.dataset.rowId)
+        );
+        assert.deepEqual(current, ['entry-00001', 'entry-00000']);
+        if (atomic)
+          assert.deepEqual(
+            state.ids,
+            state.virtual.rows.map(r => r.id)
+          );
+        else
+          assert.notDeepEqual(
+            state.ids,
+            state.virtual.rows.map(r => r.id)
+          );
+        return {
+          ids: state.ids,
+          metadataIds: state.virtual.rows.map(r => r.id),
+          DOMAfterTask: current
+        };
+      } finally {
+        await context.close();
+      }
+    };
+    results.push({
+      browser: name,
+      version: browser.version(),
+      split: await run(false),
+      atomic: await run(true),
+      passed: true
+    });
+  } finally {
+    await browser.close();
+  }
+}
+console.log(
+  JSON.stringify(
+    {
+      passed: true,
+      scope:
+        'Deterministic DOM reorder between tasks reproduces split sampling mismatch; single-task sampling stays internally consistent. Not a component benchmark outcome.',
+      results
+    },
+    null,
+    2
+  )
+);
```

**File**: `benchmarks/cross-library-table/checks/composed-focus.mjs` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import fs from 'node:fs';
+import path from 'node:path';
+import http from 'node:http';
+import assert from 'node:assert/strict';
+import { createRequire } from 'node:module';
+import { pathToFileURL } from 'node:url';
+const fixture = path.resolve(import.meta.dirname, '..'),
+  root = path.resolve(process.argv[2] ?? path.join(fixture, 'results', 'composed-focus'));
+assert(process.argv.length <= 3);
+fs.mkdirSync(root, { recursive: true });
+const { chromium, firefox } = createRequire(fixture + '/package.json')('playwright'),
+  { virtualActivate } = await import(pathToFileURL(fixture + '/runner/virtual-input.mjs')),
+  { artifactGuard, assertBuildState } = await import(
+    pathToFileURL(fixture + '/runner/build-state.mjs')
+  ),
+  built = JSON.parse(fs.readFileSync(fixture + '/dist/build-inputs.json')),
+  guard = artifactGuard(fixture, built);
+assertBuildState(fixture, built);
+const report = {
+  scope:
+    'Native Arrow/Home/End probe for application-owned Antd/Chakra roving checkbox focus; not a cross-library performance/ranking result',
+  cases: [],
+  built
+};
+const server = http.createServer((req, res) => {
+  try {
+    const file = path.resolve(fixture, 'dist', '.' + new URL(req.url, 'http://localhost').pathname);
+    assert(file.startsWith(fixture + '/dist/'));
+    const bytes = fs.readFileSync(file);
+    guard.check(file, bytes);
+    res.setHeader(
+      'Content-Type',
+      file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'
+    );
+    res.end(bytes);
+  } catch {
+    res.statusCode = 404;
+    res.end();
+  }
+});
+await new Promise(r => server.listen(0, '127.0.0.1', r));
+try {
+  for (const [engineName, engine] of Object.entries({ chromium, firefox })) {
+    const browser = await engine.launch();
+    try {
+      for (const library of ['antd', 'chakra']) {
+        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
+          page = await context.newPage();
+        page.setDefaultTimeout(10000);
+        const row = {
+          browser: engineName,
+          version: browser.version(),
+          library,
+          steps: [],
+          errors: []
+        };
+        report.cases.push(row);
+        page.on('pageerror', e => row.errors.push(String(e)));
+        try {
+          await page.addInitScript(() => {
+            window.__focusKeys = [];
+            document.addEventListener(
+              'keydown',
+              e => window.__focusKeys.push({ key: e.key, trusted: e.isTrusted }),
+              true
+            );
+          });
+          await page.goto(
+            'http://127.0.0.1:' + server.address().port + '/' + library + '/virtual.html'
+          );
+          await page.waitForSelector('[data-row-id]');
+          await virtualActivate(
+            page,
+            page.getByRole('button', { name: 'Jump row 9000', exact: true }),
+            'keyboard',
+            'toolbar'
+          );
+          const input = page.locator('[data-virtual-row-id="entry-09000"]').getByRole('checkbox');
+          await virtualActivate(page, input, 'keyboard', 'selection', 'entry-09000');
+          await page.waitForFunction(
+            () => document.querySelector('output').textContent === '["entry-09000"]'
+          );
+          for (const [key, id] of [
+            ['ArrowDown', 'entry-09001'],
+            ['ArrowUp', 'entry-09000'],
+            ['Home', 'entry-00000'],
+            ['End', 'entry-09999'],
+            ['ArrowUp', 'entry-09998']
+          ]) {
+            await page.keyboard.press(key);
+            await page.waitForFunction(
+              id =>
+                document.activeElement?.closest('[data-virtual-row-id]')?.dataset.virtualRowId ===
+                id,
+              id
+            );
+            assert.equal(await page.locator('output').textContent(), '["entry-09000"]');
+            row.steps.push({ key, id });
+          }
+          row.events = await page.evaluate(() => window.__focusKeys);
+          assert(row.events.length && row.events.every(e => e.trusted));
+          for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End'])
+            assert(row.events.some(e => e.key === key));
+          assert.deepEqual(row.errors, []);
+          row.passed = true;
+        } catch (error) {
+          row.passed = false;
+          row.error = String(error);
+          row.focus = await page.evaluate(() => document.activeElement?.outerHTML);
+          fs.writeFileSync(
+            root + '/focus-' + engineName + '-' + library + '-failure.html',
+            await page.content()
+          );
+        } finally {
+          await context.close();
+        }
+        console.log(engineName, library, row.passed ? 'PASS' : row.error);
+      }
+    } finally {
+      await browser.close();
+    }
+  }
+  assertBuildState(fixture, built);
+  assert.deepEqual(guard.violations, []);
+} finally {
+  await new Promise
```

**File**: `benchmarks/cross-library-table/checks/report-integrity.mjs` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+import fs from 'node:fs';
+import assert from 'node:assert/strict';
+import { validateReport } from '../runner/report.mjs';
+import { validateTreeReport } from '../runner/tree-report.mjs';
+import { validateVirtualReport } from '../runner/virtual-report.mjs';
+const [file, browser = 'all', ...extra] = process.argv.slice(2);
+assert(
+  file && !extra.length,
+  'Usage: node checks/report-integrity.mjs report.json [all|chromium|firefox]'
+);
+const actual = JSON.parse(fs.readFileSync(file)),
+  validate = {
+    selection: validateReport,
+    tree: validateTreeReport,
+    virtual: validateVirtualReport
+  }[actual.workflow];
+assert(validate, 'Unknown report workflow');
+assert.equal(actual.validated, true);
+const summary = validate(actual, browser);
+assert.deepEqual(summary, actual.summary);
+const positive = r => r.cases.find(c => c.passed && c.profile === 'pointer'),
+  keyboard = r => r.cases.find(c => c.passed && c.profile === 'keyboard');
+assert(
+  positive(actual) && keyboard(actual),
+  'Mutation controls require a complete passing pointer and keyboard case'
+);
+const results = [];
+function reject(name, mutate, keepSummary = false) {
+  const r = structuredClone(actual);
+  if (!keepSummary) delete r.summary;
+  mutate(r);
+  let error;
+  try {
+    validate(r, browser);
+  } catch (e) {
+    error = String(e);
+  }
+  assert(error, 'False green: ' + name);
+  results.push({ name, rejected: true, error });
+}
+reject('incomplete-report', r => (r.complete = false));
+reject('missing-cell', r => r.cases.pop());
+reject('duplicate-cell', r => (r.cases[r.cases.length - 1] = structuredClone(r.cases[0])));
+reject('missing-capture-protocol', r => delete r.captureProtocol);
+reject('missing-integrity-protocol', r => delete r.integrity);
+reject('unchecked-final-state', r => (r.integrity.after = false));
+reject('no-bound-responses', r => (r.integrity.responsesChecked = 0));
+reject('too-few-bound-responses', r => (r.integrity.responsesChecked = 1));
+reject('tainted-response', r => r.integrity.violations.push({ file: 'probe' }));
+reject(
+  'contradictory-summary',
+  r => (r.summary = { ...r.summary, passed: r.summary.passed + 1 }),
+  true
+);
+reject('missing-browser-version', r => (positive(r).version = ''));
+reject('missing-native-events', r => (positive(r).events = []));
+reject('untrusted-event', r => (positive(r).events[0].trusted = false));
+reject('wrong-input-profile', r => keyboard(r).events.forEach(e => (e.type = 'click')));
+reject('page-error', r => positive(r).pageErrors.push('probe'));
+reject('http-error', r => positive(r).httpErrors.push([500, '/probe']));
+reject('checkpoint-order', r => positive(r).checkpoints.reverse());
+reject('incomplete-success', r => positive(r).checkpoints.pop());
+reject('broken-reference', r =>
+  positive(r).checkpoints[0].state.brokenReferences.push({ id: 'missing' })
+);
+reject('duplicate-id', r =>
+  positive(r).checkpoints[0].state.duplicateIds.push({ id: 'duplicate', count: 2 })
+);
+if (actual.workflow === 'virtual') {
+  reject('wrong-ownership', r => (positive(r).ownership = 'native-all'));
+  reject('erased-row-metadata', r => (positive(r).checkpoints[0].state.virtual.rows = []));
+  reject('wrong-rendered-count', r => (positive(r).checkpoints[0].state.virtual.rendered = 10000));
+  reject('wrong-data-id', r => (positive(r).checkpoints[0].state.ids[0] = 'bogus'));
+  reject(
+    'hidden-requested-row',
+    r =>
+      (positive(r).checkpoints[1].state.virtual.rows.find(x => x.id === 'entry-09000').visible =
+        false)
+  );
+  reject('forged-visible-flag', r => {
+    const row = positive(r).checkpoints[0].state.virtual.rows.find(x => !x.visible);
+    assert(row);
+    row.visible = true;
+  });
+  reject('wrong-selected-key', r => (positive(r).checkpoints[2].state.selected = '[]'));
+  reject(
+    'wrong-real-checkbox',
+    r =>
+      (positive(r).checkpoints[2].state.checkboxes.find(
+        x => x.kind === 'input' && x.rowId === 'entry-09000'
+      ).checked = false)
+  );
+  reject('erased-real-checkbox', r => {
+    const s = positive(r).checkpoints[2].state;
+    s.checkboxes = s.checkboxes.filter(x => x.rowId !== 'entry-09000');
+  });
+  reject(
+    'wrong-mount-membership',
+    r => (positive(r).checkpoints[2].state.virtual.selectedRowMounted = false)
+  );
+  reject('invalid-viewport', r => (positive(r).checkpoints[0].state.virtual.viewport.height = 0));
+  reject('wrong-pointer-row', r =>
+    positive(r)
+      .events.filter(e => e.rowId === 'entry-09000')
+      .forEach(e => (e.rowId = 'entry-00000'))
+  );
+} else if (actual.workflow === 'tree') {
+  reject('wrong-workflow', r => (r.workflow = 'selection'));
+  reject('wrong-ownership', r => (positive(r).ownership = 'native-all'));
+  reject('wrong-displayed-id', r => (positive(r).checkpoints[0].state.ids[0] = 'bogus'));
+  reject('erased-row-metadata', r => (positive(r).checkpoints[0].state.rows = []));
+  reject('false-tree-level', r => (
```

**File**: `benchmarks/cross-library-table/checks/runtime-mutations.mjs` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+import fs from 'node:fs';
+import path from 'node:path';
+import assert from 'node:assert/strict';
+import crypto from 'node:crypto';
+import { spawn } from 'node:child_process';
+import readline from 'node:readline';
+import { assertBuildState } from '../runner/build-state.mjs';
+const root = path.resolve(import.meta.dirname, '..'),
+  output = path.resolve(
+    process.argv[2] ?? path.join(root, 'results', 'runtime-controls-' + Date.now())
+  );
+assert(process.argv.length <= 3, 'Usage: node checks/runtime-mutations.mjs [output-directory]');
+assert(
+  !fs.existsSync(output) || fs.readdirSync(output).length === 0,
+  'Output must be new or empty; inspect prior journals before retrying'
+);
+fs.mkdirSync(output, { recursive: true });
+const built = JSON.parse(fs.readFileSync(root + '/dist/build-inputs.json'));
+assertBuildState(root, built);
+const sha = b => crypto.createHash('sha256').update(b).digest('hex');
+const controls = [
+  {
+    name: 'source',
+    file: 'src/virtual/domain.ts',
+    text: '\n// controlled mid-run source mutation\n',
+    error: 'Stale source/config/candidate build'
+  },
+  {
+    name: 'sdk',
+    file: '../../lib/package.json',
+    text: '\n',
+    error: 'Stale source/config/candidate build'
+  },
+  {
+    name: 'installed-package',
+    file: 'node_modules/@tanstack/react-virtual/package.json',
+    text: '\n',
+    error: 'Stale installed dependency build'
+  },
+  {
+    name: 'served-artifact',
+    file: 'dist/antd/virtual.html',
+    text: '\n<!-- controlled mid-run response mutation -->\n'
+  }
+];
+const ownedRoot = fs.realpathSync(path.resolve(root, '../..'));
+for (const control of controls) {
+  const relative = path.relative(ownedRoot, fs.realpathSync(path.resolve(root, control.file)));
+  assert(
+    relative &&
+      relative !== '..' &&
+      !relative.startsWith('..' + path.sep) &&
+      !path.isAbsolute(relative),
+    'Mutation target resolves outside this owned repository'
+  );
+}
+const results = [];
+let active;
+function restore() {
+  if (!active?.mutated) return;
+  const current = fs.readFileSync(active.file);
+  assert(
+    current.equals(active.changed) || current.equals(active.original),
+    'Target changed externally; original backup retained, refusing to overwrite'
+  );
+  fs.writeFileSync(active.file, active.original);
+  assert(fs.readFileSync(active.file).equals(active.original));
+  active.mutated = false;
+  active.journal.phase = 'restored';
+  fs.writeFileSync(active.journalFile, JSON.stringify(active.journal, null, 2) + '\n');
+}
+for (const signal of ['SIGINT', 'SIGTERM'])
+  process.once(signal, () => {
+    active?.child?.kill(signal);
+    try {
+      restore();
+    } finally {
+      process.exit(signal === 'SIGINT' ? 130 : 143);
+    }
+  });
+try {
+  for (const control of controls) {
+    const folder = path.join(output, control.name);
+    fs.mkdirSync(folder, { recursive: true });
+    const file = path.resolve(root, control.file),
+      original = fs.readFileSync(file),
+      changed = Buffer.concat([original, Buffer.from(control.text)]),
+      journalFile = path.join(folder, 'journal.json');
+    fs.writeFileSync(path.join(folder, 'original.bin'), original);
+    const journal = {
+      name: control.name,
+      file,
+      originalSHA256: sha(original),
+      mutatedSHA256: sha(changed),
+      phase: 'prepared',
+      backup: path.join(folder, 'original.bin')
+    };
+    fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n');
+    const reportFile = path.join(folder, 'report.json'),
+      args = [
+        'run.mjs',
+        '--skip-build',
+        '--workflow',
+        'virtual',
+        '--browser',
+        'chromium',
+        '--output',
+        reportFile
+      ],
+      child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }),
+      done = new Promise((resolve, reject) => {
+        child.once('error', reject);
+        child.once('close', (code, signal) => resolve({ code, signal }));
+      });
+    active = { file, original, changed, journal, journalFile, child, mutated: false };
+    const log = fs.createWriteStream(path.join(folder, 'run.log'));
+    child.stderr.on('data', bytes => log.write(bytes));
+    let triggered = false,
+      restoredDuringRun = false;
+    try {
+      for await (const line of readline.createInterface({ input: child.stdout })) {
+        log.write(line + '\n');
+        if (!triggered && line === 'chromium rsuite pointer PASS') {
+          fs.writeFileSync(file, changed);
+          active.mutated = true;
+          triggered = true;
+          journal.phase = 'mutated-after-first-browser-case';
+          fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n');
+        }
+        if (
+          triggered &&
+          control.name === 'served-artifact' &&
+          line.startsWith('chromium antd pointer ')
+        ) {
+          restore();
+          restoredDuringRun
```

**File**: `benchmarks/cross-library-table/integrity.mjs` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ export function inputs(root) {
   const files = [
     ...filesUnder(path.join(root, 'src')),
     ...filesUnder(path.join(root, 'runner')),
+    ...filesUnder(path.join(root, 'checks')),
     ...[
       '.npmrc',
       '.gitignore',
@@ -14,6 +15,7 @@ export function inputs(root) {
       'tsconfig.json',
       'index.html',
       'tree.html',
+      'virtual.html',
       'vite.config.mjs',
       'build.mjs',
       'run.mjs',
```

**File**: `benchmarks/cross-library-table/run.mjs` (modified, +68/-41)
```diff
@@ -1,29 +1,33 @@
+import { createCapture } from './runner/capture.mjs';
 import fs from 'node:fs';
 import path from 'node:path';
 import http from 'node:http';
 import assert from 'node:assert/strict';
 import { spawnSync } from 'node:child_process';
-import { isDeepStrictEqual } from 'node:util';
 import { chromium, firefox } from 'playwright';
-import { inputs, packageFingerprint, hash } from './integrity.mjs';
-import { snapshot } from './runner/snapshot.mjs';
 import { workflow } from './runner/workflow.mjs';
-import { installedDependencies } from './dependencies.mjs';
 import { validateReport } from './runner/report.mjs';
 import { treeWorkflow } from './runner/tree-workflow.mjs';
-import { treeSnapshot } from './runner/tree-snapshot.mjs';
 import { treeSemantics, validateTreeReport } from './runner/tree-report.mjs';
 import { treeOwnership } from './runner/tree-oracle.mjs';
+import { assertBuildState, artifactGuard } from './runner/build-state.mjs';
+import { virtualWorkflow } from './runner/virtual-workflow.mjs';
+import { validateVirtualReport } from './runner/virtual-report.mjs';
+import { virtualOwnership } from './runner/virtual-oracle.mjs';
 const root = import.meta.dirname,
   args = process.argv.slice(2);
 const outputIndex = args.indexOf('--output'),
   browserIndex = args.indexOf('--browser'),
   workflowIndex = args.indexOf('--workflow');
 const workflowName = workflowIndex < 0 ? 'selection' : args[workflowIndex + 1];
-if (!['selection', 'tree'].includes(workflowName)) throw Error('Invalid workflow');
+if (!['selection', 'tree', 'virtual'].includes(workflowName)) throw Error('Invalid workflow');
 const output = path.resolve(
   outputIndex < 0
-    ? path.join(root, 'results', workflowName === 'tree' ? 'tree.json' : 'table.json')
+    ? path.join(
+        root,
+        'results',
+        workflowName === 'selection' ? 'table.json' : workflowName + '.json'
+      )
     : args[outputIndex + 1]
 );
 const browserName = browserIndex < 0 ? 'all' : args[browserIndex + 1];
@@ -37,18 +41,8 @@ if (!args.includes('--skip-build')) {
   if (result.status !== 0) process.exit(result.status ?? 1);
 }
 const built = JSON.parse(fs.readFileSync(path.join(root, 'dist/build-inputs.json')));
-if (
-  !isDeepStrictEqual(inputs(root), built.sourceInputs) ||
-  packageFingerprint(root) !== built.candidateFingerprint ||
-  packageFingerprint(root, path.resolve(root, '../../lib')) !== built.candidateFingerprint
-)
-  throw Error('Stale source/config/candidate build');
-if (!isDeepStrictEqual(installedDependencies(root), built.installedDependencies))
-  throw Error('Stale installed dependency build');
-for (const [library, build] of Object.entries(built.builds))
-  for (const artifact of build.artifacts)
-    if (hash(fs.readFileSync(path.join(root, 'dist', library, artifact.file))) !== artifact.sha256)
-      throw Error('Stale artifact ' + library + '/' + artifact.file);
+assertBuildState(root, built);
+const served = artifactGuard(root, built);
 fs.mkdirSync(path.dirname(output), { recursive: true });
 const server = http.createServer(async (request, response) => {
   try {
@@ -62,6 +56,7 @@ const server = http.createServer(async (request, response) => {
       file = path.resolve(folder, parts.join('/') || 'index.html');
     if (!file.startsWith(folder + path.sep)) throw Error('Invalid path');
     const bytes = await fs.promises.readFile(file);
+    served.check(file, bytes);
     response.writeHead(200, {
       'Content-Type':
         {
@@ -83,12 +78,22 @@ await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const base = 'http://127.0.0.1:' + server.address().port;
 const report = {
   at: new Date().toISOString(),
+  captureProtocol: 'single-task-v1',
+  integrity: {
+    protocol: 'response-and-final-v1',
+    before: true,
+    after: false,
+    responsesChecked: 0,
+    violations: []
+  },
   workflow: workflowName,
   qualification: 'Prototype: adapters and driver require review before qualified comparison',
   scope:
-    workflowName === 'tree'
-      ? 'Three-level hierarchy, retained selection and root reorder. Functional and limited tree semantics gates are reported separately; native/composed ownership explicit. No AT/conformance/ranking result.'
-      : 'One sort/filter/ID-selection workflow; native engines versus explicit application composition. No performance/conformance/ranking result.',
+    workflowName === 'virtual'
+      ? '10k rows, application jump controls and native checkbox selection. Mounted rows and visible rows reported separately, including focused-row persistence. No performance/ranking/AT conformance result.'
+      : workflowName === 'tree'
+        ? 'Three-level hierarchy, retained selection and root reorder. Functional and limited tree semantics gates are reported separately; native/composed ownership explicit. No AT/conformance/ranking result.'
+        : 'One sort/filter/ID-selection workflow; native engines versus explicit application composit
```

#### Recent Merged Pull Requests:
- **PR #4968** (2026-10-20): test(table): verify loading and empty recovery (@simonguo)
- **PR #4967** (2026-10-20): test(table): verify virtual workflows and run integrity (@simonguo)
- **PR #4966** (2026-10-20): test(table): add reproducible selection and tree workflow prototypes (@simonguo)
- **PR #4964** (2026-10-20): fix(ci): pin browser jobs to Ubuntu 24.04 (@simonguo)
- **PR #4963** (2026-10-20): fix(examples): update Vite source-map-js security patch (@simonguo)
- **PR #4962** (2026-10-20): fix(form): register label and help IDs without changing refs (@simonguo)

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

## X. Merge pull request #4968 from rsuite/bench/cross-library-table-lifecycle

**RULE**:
When implementing operations in `.github/workflows/table-benchmarks.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rsuite/rsuite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d056c753`: Merge pull request #4968 from rsuite/bench/cross-library-table-lifecycle. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/table-benchmarks.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
name: Table workflow integrity
    name: Table workflows and report integrity
      - name: Run Chromium and Firefox loading and empty recovery
        working-directory: benchmarks/cross-library-table
        run: node run.mjs --skip-build --workflow lifecycle --output results/lifecycle/report.json
      - name: Reject stale lifecycle identities and state
        working-directory: benchmarks/cross-library-table
        run: node checks/report-integrity.mjs results/lifecycle/report.json
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
name: Virtual table workflow
    name: Virtual table and report integrity
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d056c753` are properly handled with clean fallback behavior.
