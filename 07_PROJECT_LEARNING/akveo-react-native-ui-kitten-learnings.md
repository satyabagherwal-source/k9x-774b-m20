# Forensic Learning Record (Deep Inspection): akveo/react-native-ui-kitten

> **Canonical Artifact**: `07_PROJECT_LEARNING/akveo-react-native-ui-kitten-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/akveo/react-native-ui-kitten](https://github.com/akveo/react-native-ui-kitten))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:21.633Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `akveo/react-native-ui-kitten`
- **Description**: React Native UI library built on the Eva Design System: 30+ themeable, accessible components for iOS, Android and web. TypeScript, React 19 / RN 0.81, Eva and Material themes with runtime light/dark switching, on-demand style compilation.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10665 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/components/ui/calendar/hooks/index.ts`
```
/**
 * @license
 * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

export * from './useCalendarState';
export * from './useCalendarNavigation';
export * from './useCalendarStyles';

```

### Core Architecture Module: `src/components/ui/calendar/hooks/useCalendarNavigation.ts`
```
/**
 * @license
 * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { useCallback } from 'react';
import { CalendarViewMode, CalendarViewModes, CalendarViewModeId } from '../type';
import { DateService } from '../service/date.service';

const PICKER_ROWS = 4;
const PICKER_COLUMNS = 3;
const VIEWS_IN_PICKER: number = PICKER_ROWS * PICKER_COLUMNS;

export interface UseCalendarNavigationOptions<D> {
  dateService: DateService<D>;
  viewMode: CalendarViewMode;
  visibleDate: D;
  pickerDate: D;
  min?: D;
  max?: D;
  setVisibleDate: (date: D) => void;
  setPickerDate: (date: D) => void;
  onVisibleDateChange?: (date: D, viewModeId: CalendarViewModeId) => void;
}

export interface UseCalendarNavigationResult {
  onHeaderNavigationLeftPress: () => void;
  onHeaderNavigationRightPress: () => void;
  isHeaderNavigationAllowed: () => boolean;
}

export function useCalendarNavigation<D>({
  dateService,
  viewMode,
  visibleDate,
  pickerDate,
  min,
  max,
  setVisibleDate,
  setPickerDate,
  onVisibleDateChange,
}: UseCalendarNavigationOptions<D>): UseCalendarNavigationResult {

  // Header arrows never leave the [min, max] window: paging past a bound lands on the bound
  // itself, so the last reachable page is the one holding min or max (#1759).
  const clampToBounds = useCallback((date: D): D => {
    if (min && dateService.compareDates(date, min) < 0) {
      return min;
    }
    if (max && dateService.compareDates(date, max) > 0) {
      return max;
    }
    return date;
  }, [dateService, min, max]);

  const createViewModeVisibleDate = useCallback((page: number): D => {
    switch (viewMode.id) {
      case CalendarViewModes.DATE.id: {
        return clampToBounds(dateService.addMonth(visibleDate, page));
      }
      case CalendarViewModes.MONTH.id: {
        return clampToBounds(dateService.addYear(pickerDate, page));
      }
      case CalendarViewModes.YEAR.id: {
        return clampToBounds(dateService.addYear(pickerDate, VIEWS_IN_PICKER * page));
      }
      default:
        return visibleDate;
    }
  }, [dateService, viewMode.id, visibleDate, pickerDate, clampToBounds]);

  const onHeaderNavigationLeftPress = useCallback(() => {
    const nextDate = createViewModeVisibleDate(-1);

    if (viewMode.id === CalendarViewModes.DATE.id) {
      setVisibleDate(nextDate);
      onVisibleDateChange?.(nextDate, viewMode.id);
    } else {
      setPickerDate(nextDate);
    }
  }, [createViewModeVisibleDate, viewMode.id, setVisibleDate, setPickerDate, onVisibleDateChange]);

  const onHeaderNavigationRightPress = useCallback(() => {
    const nextDate = createViewModeVisibleDate(1);

    if (viewMode.id === CalendarViewModes.DATE.id) {
      setVisibleDate(nextDate);
      onVisibleDateChange?.(nextDate, viewMode.id);
    } else {
      setPickerDate(nextDate);
    }
  }, [createViewModeVisibleDate, viewMode.id, setVisibleDate, setPickerDate, onVisibleDateChange]);

  const isHeaderNavigationAllowed = useCallback((): boolean => {
    return viewMode.id !== CalendarViewModes.MONTH.id;
  }, [viewMode.id]);

  return {
    onHeaderNavigationLeftPress,
    onHeaderNavigationRightPress,
    isHeaderNavigationAllowed,
  };
}

```

### Core Architecture Module: `src/components/ui/calendar/hooks/useCalendarState.ts`
```
/**
 * @license
 * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { useCallback, useState } from 'react';
import { CalendarViewMode, CalendarViewModes, CalendarViewModeId } from '../type';
import { DateService } from '../service/date.service';

export interface CalendarState<D> {
  viewMode: CalendarViewMode;
  visibleDate: D;
  pickerDate: D;
}

export interface UseCalendarStateResult<D> {
  state: CalendarState<D>;
  setViewMode: (viewMode: CalendarViewMode) => void;
  setVisibleDate: (date: D) => void;
  setPickerDate: (date: D) => void;
  scrollToToday: () => void;
  scrollToDate: (date: D) => void;
  onPickerNavigationPress: () => void;
  onMonthSelect: (date: D, onVisibleDateChange?: (date: D, viewModeId: CalendarViewModeId) => void) => void;
  onYearSelect: (date: D) => void;
}

export interface UseCalendarStateOptions<D> {
  dateService: DateService<D>;
  initialVisibleDate: D;
  startView?: CalendarViewMode;
  onVisibleDateChange?: (date: D, viewModeId: CalendarViewModeId) => void;
}

export function useCalendarState<D>({
  dateService,
  initialVisibleDate,
  startView = CalendarViewModes.DATE,
  onVisibleDateChange,
}: UseCalendarStateOptions<D>): UseCalendarStateResult<D> {
  const [viewMode, setViewMode] = useState<CalendarViewMode>(startView);
  const [visibleDate, setVisibleDate] = useState<D>(() =>
    dateService.getMonthStart(initialVisibleDate)
  );
  const [pickerDate, setPickerDate] = useState<D>(() =>
    dateService.getMonthStart(initialVisibleDate)
  );

  const scrollToToday = useCallback(() => {
    const today = dateService.today();
    setViewMode(CalendarViewModes.DATE);
    setVisibleDate(today);
    setPickerDate(today);
  }, [dateService]);

  const scrollToDate = useCallback((date: D) => {
    if (date) {
      setViewMode(CalendarViewModes.DATE);
      setVisibleDate(date);
      setPickerDate(date);
    }
  }, []);

  const onPickerNavigationPress = useCallback(() => {
    setViewMode(prev => prev.navigationNext());
    setPickerDate(visibleDate);
  }, [visibleDate]);

  const onMonthSelect = useCallback((date: D, onVisibleDateChangeCb?: (date: D, viewModeId: CalendarViewModeId) => void) => {
    const nextVisibleDate = dateService.createDate(
      dateService.getYear(pickerDate),
      dateService.getMonth(date),
      dateService.getDate(pickerDate),
    );

    setViewMode(prev => prev.pickNext());
    setVisibleDate(nextVisibleDate);
    setPickerDate(nextVisibleDate);

    // Call the callback after state update
    const callback = onVisibleDateChangeCb || onVisibleDateChange;
    if (callback) {
      // We need to calculate what the next view mode will be
      const nextViewMode = viewMode.pickNext();
      callback(nextVisibleDate, nextViewMode.id);
    }
  }, [dateService, pickerDate, viewMode, onVisibleDateChange]);

  const onYearSelect = useCallback((date: D) => {
    const nextPickerDate = dateService.createDate(
      dateService.getYear(date),
      dateService.getMonth(pickerDate),
      dateService.getDate(pickerDate),
    );

    setViewMode(prev => prev.pickNext());
    setPickerDate(nextPickerDate);
  }, [dateService, pickerDate]);

  return {
    state: { viewMode, visibleDate, pickerDate },
    setViewMode,
    setVisibleDate,
    setPickerDate,
    scrollToToday,
    scrollToDate,
    onPickerNavigationPress,
    onMonthSelect,
    onYearSelect,
  };
}

```

### Core Architecture Module: `src/components/ui/calendar/hooks/useCalendarStyles.ts`
```
/**
 * @license
 * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { useMemo } from 'react';
import { StyleType } from '../../../theme';
import { CalendarViewMode, CalendarViewModes } from '../type';
import { TranslationWidth } from '../i18n/type';
import { DateService } from '../service/date.service';

const PICKER_ROWS = 4;
const PICKER_COLUMNS = 3;
const VIEWS_IN_PICKER: number = PICKER_ROWS * PICKER_COLUMNS;

export interface CalendarStyles {
  container: StyleType;
  headerContainer: StyleType;
  title: StyleType;
  icon: StyleType;
  divider: StyleType;
  daysHeaderContainer: StyleType;
  row: StyleType;
  weekday: StyleType;
}

export function useCalendarStyles(evaStyle: StyleType): CalendarStyles {
  return useMemo(() => ({
    container: {
      width: evaStyle.width,
      // The mapping width is a target, not a floor: a screen narrower than it (320 dp devices,
      // #1784) must not push the last weekday column off the edge. Cells are `flex: 1`, so they
      // absorb the difference.
      maxWidth: '100%',
      paddingVertical: evaStyle.paddingVertical,
      borderColor: evaStyle.borderColor,
      borderWidth: evaStyle.borderWidth,
      borderRadius: evaStyle.borderRadius,
    },
    headerContainer: {
      paddingHorizontal: evaStyle.headerPaddingHorizontal,
      paddingVertical: evaStyle.headerPaddingVertical,
    },
    title: {
      fontSize: evaStyle.titleFontSize,
      fontWeight: evaStyle.titleFontWeight,
      color: evaStyle.titleColor,
      fontFamily: evaStyle.titleFontFamily,
    },
    icon: {
      width: evaStyle.iconWidth,
      height: evaStyle.iconHeight,
      tintColor: evaStyle.iconTintColor,
    },
    divider: {
      marginVertical: evaStyle.dividerMarginVertical,
    },
    daysHeaderContainer: {
      marginHorizontal: evaStyle.rowMarginHorizontal,
    },
    row: {
      minHeight: evaStyle.rowMinHeight,
      marginHorizontal: evaStyle.rowMarginHorizontal,
    },
    weekday: {
      fontSize: evaStyle.weekdayTextFontSize,
      fontWeight: evaStyle.weekdayTextFontWeight,
      color: evaStyle.weekdayTextColor,
      fontFamily: evaStyle.weekdayTextFontFamily,
    },
  }), [evaStyle]);
}

export interface UseCalendarTitleOptions<D> {
  dateService: DateService<D>;
  visibleDate: D;
  pickerDate: D;
  viewMode: CalendarViewMode;
  customTitle?: (datePickerDate: D, monthYearPickerDate: D, viewMode: CalendarViewMode) => string;
}

export function useCalendarTitle<D>({
  dateService,
  visibleDate,
  pickerDate,
  viewMode,
  customTitle,
}: UseCalendarTitleOptions<D>): string {
  return useMemo(() => {
    if (customTitle) {
      return customTitle(visibleDate, pickerDate, viewMode);
    }

    switch (viewMode.id) {
      case CalendarViewModes.DATE.id: {
        const month = dateService.getMonthName(visibleDate, TranslationWidth.LONG);
        const year = dateService.getYear(visibleDate);
        return `${month} ${year}`;
      }
      case CalendarViewModes.MONTH.id: {
        return `${dateService.getYear(pickerDate)}`;
      }
      case CalendarViewModes.YEAR.id: {
        const minDateFormat = dateService.getYear(pickerDate);
        const maxDateFormat = minDateFormat + VIEWS_IN_PICKER - 1;
        return `${minDateFormat} - ${maxDateFormat}`;
      }
      default:
        return '';
    }
  }, [customTitle, dateService, visibleDate, pickerDate, viewMode]);
}

```

### Core Architecture Module: `src/components/ui/datepicker/useDatepickerState.ts`
```
/**
 * @license
 * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */

import { useCallback, useState } from 'react';

export interface UseDatepickerStateResult {
  visible: boolean;
  setPickerVisible: () => void;
  setPickerInvisible: () => void;
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
}

export interface UseDatepickerStateOptions {
  onFocus?: () => void;
  onBlur?: () => void;
}

export function useDatepickerState({
  onFocus,
  onBlur,
}: UseDatepickerStateOptions): UseDatepickerStateResult {
  const [visible, setVisible] = useState(false);

  const onPickerVisible = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const onPickerInvisible = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  const setPickerVisible = useCallback(() => {
    setVisible(true);
    onPickerVisible();
  }, [onPickerVisible]);

  const setPickerInvisible = useCallback(() => {
    setVisible(false);
    onPickerInvisible();
  }, [onPickerInvisible]);

  const focus = useCallback(() => {
    setVisible(true);
    onPickerVisible();
  }, [onPickerVisible]);

  const blur = useCallback(() => {
    setVisible(false);
    onPickerInvisible();
  }, [onPickerInvisible]);

  const isFocused = useCallback((): boolean => {
    return visible;
  }, [visible]);

  return {
    visible,
    setPickerVisible,
    setPickerInvisible,
    focus,
    blur,
    isFocused,
  };
}

```

### Core Architecture Module: `src/showcases/components/button/buttonStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Layout } from '@ui-kitten/components';

export const ButtonStatesShowcase = (): React.ReactElement => (
  <Layout
    style={styles.container}
    level='1'
  >
    <Button style={styles.button}>
      Text/ACTIVE
    </Button>
    <Button
      style={styles.button}
      disabled={true}
    >
      DISABLED
    </Button>

  </Layout>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    margin: 2,
  },
});

```

### Core Architecture Module: `src/showcases/components/checkbox/checkboxStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { CheckBox, Layout } from '@ui-kitten/components';

export const CheckboxStatesShowcase = (): React.ReactElement => {

  const [activeChecked, setActiveChecked] = React.useState(false);
  const [indeterminateChecked, setIndeterminateChecked] = React.useState(false);
  const [indeterminate, setIndeterminate] = React.useState(true);

  const onIndeterminateChange = (isChecked, isIndeterminate): void => {
    setIndeterminateChecked(isChecked);
    setIndeterminate(isIndeterminate);
  };

  return (
    <Layout
      style={styles.container}
      level='1'
    >

      <CheckBox
        style={styles.checkbox}
        checked={activeChecked}
        onChange={nextChecked => setActiveChecked(nextChecked)}
      >
        Active
      </CheckBox>

      <CheckBox
        style={styles.checkbox}
        checked={indeterminateChecked}
        indeterminate={indeterminate}
        onChange={onIndeterminateChange}
      >
        Indeterminate
      </CheckBox>

      <CheckBox
        style={styles.checkbox}
        disabled={true}
      >
        Disabled
      </CheckBox>

      <CheckBox
        style={styles.checkbox}
        disabled={true}
        checked={true}
      >
        Checked Disabled
      </CheckBox>

    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkbox: {
    margin: 2,
  },
});

```

### Core Architecture Module: `src/showcases/components/circularProgressBar/circularProgressBarStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { Layout, CircularProgressBar } from '@ui-kitten/components';
import { useProgress } from '../../helpers/progress.hook';

export const CircularProgressBarStatesShowcase = (): React.ReactElement => {
  const progress = useProgress();
  return (
    <Layout
      style={styles.container}
      level='1'
    >
      <CircularProgressBar progress={progress} />
      <CircularProgressBar
        progress={progress}
        status='success'
      />
      <CircularProgressBar
        progress={progress}
        status='danger'
      />
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

```

### Core Architecture Module: `src/showcases/components/input/inputStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { Input, Layout } from '@ui-kitten/components';

export const InputStatesShowcase = (): React.ReactElement => {

  const [value, setValue] = React.useState('');

  return (
    <Layout
      style={styles.container}
      level='1'
    >

      <Input
        style={styles.input}
        value={value}
        placeholder='Active'
        onChangeText={nextValue => setValue(nextValue)}
      />

      <Input
        style={styles.input}
        disabled={true}
        placeholder='Disabled'
      />

    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    margin: 2,
  },
});


```

### Core Architecture Module: `src/showcases/components/radio/radioStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { Layout, Radio } from '@ui-kitten/components';

export const RadioStatesShowcase = (): React.ReactElement => {

  const [activeChecked, setActiveChecked] = React.useState(false);

  return (
    <Layout
      style={styles.container}
      level='1'
    >

      <Radio
        style={styles.radio}
        checked={activeChecked}
        onChange={nextChecked => setActiveChecked(nextChecked)}
      >
        Active
      </Radio>

      <Radio
        style={styles.radio}
        disabled={true}
      >
        Disabled
      </Radio>

      <Radio
        style={styles.radio}
        checked={true}
        disabled={true}
      >
        Checked Disabled
      </Radio>

    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  radio: {
    margin: 2,
  },
});


```

### Core Architecture Module: `src/showcases/components/select/selectStates.component.tsx`
```
import React from 'react';
import { StyleSheet } from 'react-native';
import { IndexPath, Layout, Select, SelectItem } from '@ui-kitten/components';

export const SelectStatesShowcase = (): React.ReactElement => {

  const [selectedIndex, setSelectedIndex] = React.useState<IndexPath | IndexPath[]>();

  return (
    <Layout
      style={styles.container}
      level='1'
    >

      <Select
        style={styles.select}
        placeholder='Active'
        selectedIndex={selectedIndex}
        onSelect={index => setSelectedIndex(index)}
      >
        <SelectItem title='Option 1' />
        <SelectItem title='Option 2' />
        <SelectItem title='Option 3' />
      </Select>

      <Select
        style={styles.select}
        placeholder='Disabled'
        disabled={true}
      >
        <SelectItem title='Option 1' />
        <SelectItem title='Option 2' />
        <SelectItem title='Option 3' />
      </Select>

    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 128,
  },
  select: {
    flex: 1,
    marginHorizontal: 2,
  },
});

```

### Core Architecture Module: `src/showcases/components/styled/styledComponentStates.component.tsx`
```
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Interaction, useStyled } from '@ui-kitten/components';

const StyledComponent: React.FC = () => {
  const { style, dispatch } = useStyled('StyledComponent', {});

  const onPressIn = (): void => {
    dispatch([Interaction.ACTIVE]);
  };

  const onPressOut = (): void => {
    dispatch([]);
  };

  return (
    <TouchableOpacity
      activeOpacity={1.0}
      style={style}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    />
  );
};

// mapping.json
// {
//   "StyledComponent": {
//     "meta": {
//       "parameters": {
//         "width": {
//           "type": "number"
//         },
//         "height": {
//           "type": "number"
//         },
//         "backgroundColor": {
//           "type": "string"
//         }
//       },
//       "appearances": {
//         "default": {
//           "default": true
//         }
//       },
//       "variantGroups": {},
//       "states": {
//         "active": {
//           "default": false,
//           "priority": 0
//         }
//       }
//     },
//     "appearances": {
//       "default": {
//         "mapping": {
//           "width": 32,
//           "height": 32,
//           "backgroundColor": "color-primary-default",
//           "state": {
//             "active": {
//               "backgroundColor": "color-primary-active"
//             }
//           }
//         }
//       }
//     }
//   }
// };

export const StyledComponentStatesShowcase = StyledComponent;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1935** (2026-10-04): **Version Packages**
  *Symptoms*: This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and the packages will be published to npm automatically. If you're not ready to do a release yet, that's fine, whenever you add more changesets to master, this PR will be updated.   # Releases ## @ui-kitten/components@6.2.0  ### Minor Changes  - [#1926](https://github.com/akveo/react-native-ui-kitten/pull/1926) [`82b9931`](https://github.com/akveo/react-native-ui-kitten/commit/82b9931b926d4d909fc7a859405b3d96ebc7748e) Thanks [@bataevvlad](https://github.com/bataevvlad)! - `Avatar` gains `name` and `status`. Without a `source`, or when the image fails to load, `name` renders   as initials (the first letter of the first two words) in a frame of the same size and shape, coloured by   `status`, and is the avatar's accessible name. The Eva and Material `Avatar` mappings gain `textFontSize`   per size, `textFontFamily` / `textFontWeight`, and a `status` variant group with `backgroundColor` /   `textColor` (#1806).  - [#1922](https://github.com/akveo/react-native-ui-kitten/pull/1922) [`e4413ec`](https://github.com/akveo/react-native-ui-kitten/commit/e4413ec7eda65d87754ecc2cd15fe234e1eb47a2) Thanks [@bataevvlad](https://github.com/bataevvlad)! - `ButtonGroup` no longer overwrites `appearance`, `status` and `size` set on a child `Button`; the child's   values win over the group's. It also gains `selectedIndex` and `onSelect`: the sel

- **Issue #1934** (2026-10-04): **fix(autocomplete): select an option with the mouse on web**
  *Symptoms*: Two web issues found while running the Storybook web QA (`website/qa/run.mjs`) during the #1931 review.  ## 1. Clicking an Autocomplete option on web did not select it  Once the input keeps its focus on the first click (#1914), a mouse click on an option does nothing: the mouse-down moves the focus away from the input, `Autocomplete` closes its list on blur, and the click lands on nothing. A CDP probe shows it step by step: input focused before the mouse-down, list gone and focus `null` after it, value unchanged after the mouse-up. On master the same happens whenever the field is focused (with master's two-tap focus it hid behind the first click).  Fix: on web the options `List` cancels the mouse-down default (`onMouseDown` → `preventDefault`, forwarded by react-native-web's `View`), so the input keeps its focus and caret and the click selects the option. Native is unchanged; taps there already keep the focus through `keyboardShouldPersistTaps='always'`.  ## 2. `props.pointerEvents is deprecated` warning on web  `Modal`'s non-blocking overlay passed `pointerEvents='box-none'` as a prop; react-native-web 0.21 warns about it. Both views now set it in their style (React Native supports `style.pointerEvents` since 0.71; the library requires 0.72).  ## Verification  - Specs: `autocomplete.spec.tsx` — on web a mouse-down on the list is prevented (fails without the fix); on native the list gets no mouse handler. `modal.spec.tsx` reads `pointerEvents` from the overlay style. - Web QA

- **Issue #1933** (2026-10-04): **fix(falsy-text): render a 0 label**
  *Symptoms*: Stacked on #1917 (`fix/empty-label-text-node`); GitHub retargets it to `master` when #1917 merges.  ## Problem  Labels and titles accept numbers (`children` of `Button`, `CheckBox`, `Radio`, `Toggle`; `Input` label / caption; `ListItem` title; ...), but `FalsyText` starts with `if (!component) return null`, so `0` renders nothing. Before #1917 the controls' own `{children && ...}` guard turned `0` into a bare text node in a `View` (a crash on native); after #1917 it is a blank label.  ## Fix  `FalsyText` renders nothing only for `null`, `undefined`, `false` and `''`; `0` renders as text through the same paths as any other string or number. The JSDoc says so.  ## Verification  - Specs: `falsyText.spec.tsx` (`null` / `undefined` / `''` / `false` render nothing, `0` renders "0"); `emptyLabel.spec.tsx` (#1917's spec) gains a `0` label case for `Button`, `CheckBox`, `Radio` and `Toggle`. 5 of the new cases fail without the change. - Devices, with a temporary (uncommitted) showcase row of the four controls labelled `{0}`, debug build on a Metro serving the branch: Android Pixel 7 (API 34) and iPhone 17 show no label on #1917 alone and "0" on all four with this change. - Gates: `yarn test --runInBand` (75 suites, 1903 tests), `turbo build components`, `yarn typecheck:all`, lint (0 errors).  Changeset: `@ui-kitten/components` patch. 

- **Issue #1932** (2026-10-04): **test(e2e): reach showcase sections through a deep link**
  *Symptoms*: ## Problem  `popover-android.ad`, the only Android replay, scrolls a fixed 13 times and then waits for the Popover section. Sections added above Popover since it was written make it stop at the List section, so it fails at step 18 on master and on every branch.  ## Fix  - The showcase handles `uikitten-showcases://section/<Title>` (the section `title` in `app.navigator.tsx`): it scrolls the list so that section starts at the top (`scrollToIndex`, with an `onScrollToIndexFailed` fallback for rows that are not laid out yet), for both the initial URL and links opened while running. - `popover-android.ad` opens `uikitten-showcases://section/Popover` instead of scrolling. - `e2e/README.md`: how to reach a section, and a note that `agent-device test` clears the app's dev-server binding when a script's `open` has no `--metro-*` flags. A debug build then falls back to `:8081` even with `test --metro-port`, so a local run against another Metro port needs the flags in a scratch copy of the scripts.  The iOS scripts are left alone (#1918 rewrites them); on the iOS simulator every URL open raises an "Open in …?" confirmation, so they would need an alert step to use the link.  ## Verification  - Android emulator (Pixel 7, API 34): `popover-android.ad` passes (23.6s) against a Metro serving this branch. Opening the link for Popover, ViewPager and Datepicker puts each section title at the top. - iOS simulator (iPhone 17): the link scrolls to the section after the confirmation prompt. - Gate

- **Issue #1931** (2026-10-04): **fix(autocomplete): derive the input test ids from testID**
  *Symptoms*: ## Problem  `Autocomplete` passes the consumer `testID` to its options `Popover` and gives its `Input` the fixed test id `@autocomplete/input`. Every autocomplete's field is therefore `@@autocomplete/input/input`, so two autocompletes on one screen cannot be told apart in tests (found while testing `textInputRef` in #1927: the showcase's `input-native-ref-autocomplete` field was exposed as `@@autocomplete/input/input`).  ## Fix  The input's test id is derived from `testID`: `@<testID>/input`, which `Input` turns into `@@<testID>/input/input` for the field and `@@<testID>/input/container` for its container. Without a `testID` it keeps `@autocomplete/input`. The showcase autocomplete uses `testID='autocomplete'`, so its ids and the `autocomplete.ad` replay are unchanged. The `Popover` keeps the consumer `testID`. JSDoc and a docs row describe the ids.  ## Verification  - Specs (`autocomplete.spec.tsx`): two autocompletes expose `@@from/input/input` and `@@to/input/input`; no `testID` keeps `@@autocomplete/input/input`. The first fails on master. - Android emulator (Pixel 7, API 34): `AutocompleteBlur` (`testID='autocomplete-blur'`) exposes `@@autocomplete-blur/input/input` next to `@@autocomplete/input/input`; `fill` by the new id filters the list. - iOS simulator (iPhone 17): typing in both showcase autocompletes still works. The iOS accessibility tree is cut off before `AutocompleteBlur` on master (fixed by #1918), so the id itself was checked on Android and in jest. - Gates:

- **Issue #1930** (2026-10-04): **fix(theme): keep font weights with the System family on Android**
  *Symptoms*: ## Problem  On Android every text with weight `500` or `600` renders regular: `s1` / `s2` subtitles, labels, radio and checkbox text, the `Avatar` initials from #1926. iOS shows them semibold.  The Eva and Material mappings set `text-font-family: "System"`. React Native Android does not treat `System` as the platform font: any `fontFamily` name goes through `ReactFontManager.getTypeface`, which looks up the family by `nearestStyle` (only regular or bold, `weight < 700` -> regular) and falls back to `Typeface.create(name, style)`. The numeric weight is only kept when `fontFamily` is unset (`ReactTypefaceUtils.applyStyles`, `typefaceStyle.apply(Typeface.DEFAULT)`). So `600` became `400`, while `700+` still looked bold.  This is a different cause from #1793 (custom fonts registered with only a regular face), which stays documented in the branding guide.  ## Fix  - New internal `theme/style/platformFontFamily.ts`: `resolvePlatformFontFamily(key, value, os = Platform.OS)` resolves a `*fontFamily` value of `System` to `undefined` on Android. `StyleService.createThemedEntry` (every mapping and `StyleService.create` style goes through it) calls it. The key stays, so a later consumer style still overrides as before; iOS and custom families are unchanged. - `FalsyText`'s fast path checks that the style has a `fontFamily` key instead of a defined value, so the Android text keeps skipping the extra styled `Text`. - Branding guide: a paragraph under "Font weights on Android".  ## Verifica

- **Issue #1929** (2026-10-04): **feat(view-pager): add PageIndicator**
  *Symptoms*: ## Problem  `ViewPager` gives no indication of how many pages there are or which one is visible; apps that move from tabs to a pager lose that cue (#1355). `onOffsetChange` reports raw pixels and the consumer `onLayout` was dropped, so even a hand-rolled indicator could not follow the swipe.  ## Fix  - New `PageIndicator` (`src/components/ui/viewPager/pageIndicator.component.tsx`, exported from the ui barrel): one dot per `pageCount`, the selected dot wider and coloured by `status` (default `primary`). Props: `selectedIndex`, `progress` (fractional page position; the dots grow / shrink between pages), `onSelect` (dot press), `dotStyle`, `dotAccessibilityLabel`, `appearance`. Dots are `Pressable`s with `role='button'` and `aria-selected`; test ids `@<testID>/dot-<i>`. - Eva and Material mappings: a `PageIndicator` block (`paddingHorizontal` / `paddingVertical` 8, `dotWidth` / `dotHeight` 8, `dotBorderRadius` 4, `dotMarginHorizontal` 4, `dotBackgroundColor` `background-basic-color-4`, `selectedDotWidth` 16) with a `status` variant group for `selectedDotBackgroundColor` (`primary` default, `basic` = `text-basic-color`, `control` = `color-control-default`). Inserted before `Popover` in both files. - `ViewPager` now forwards a consumer `onLayout` (it was swallowed by the internal one). The laid-out view is the content strip, `pages x page width` wide, so `pageWidth = layout.width / pageCount`; documented on `onLayout` and `onOffsetChange`. Arrows stay app-side (`onSelect(index ± 1

- **Issue #1928** (2026-10-04): **feat(theme): type theme tokens from the theme JSON**
  *Symptoms*: ## Problem  `ThemeType` is `Record<string, string>`, so `useTheme()`, the `useThemeValue` selectors and `light` / `dark` from `@ui-kitten/eva` offer no token names; a typo in `theme['color-primary-500']` is invisible to the editor (#1682, cross-posted to eva-design/eva#101; the Eva packages live in this repo).  ## Fix  - `scripts/generate-theme-types.js` (`yarn theme-types:generate`) reads the light / dark theme JSON of `src/eva` and `src/material` (it fails if light and dark define different tokens) and writes, committed:   - `src/eva/themes/keys.d.ts`: `EvaThemeKey` (union of the 312 tokens) and `EvaTheme` (`{ [K in EvaThemeKey]: string } & { [token: string]: string }`); `src/material/themes/keys.d.ts`: `MaterialThemeKey` / `MaterialTheme`;   - `src/{eva,material}/themes/{light,dark}.d.ts` in their existing format (regenerated byte for byte, so nothing changes there);   - `src/components/theme/theme/themeKeys.ts`: `KnownThemeKey`, the union of both design systems' tokens. A generated copy rather than an import, so `@ui-kitten/components` does not depend on a design system package for its types. - `@ui-kitten/eva` / `@ui-kitten/material` `index.d.ts`: `light` / `dark` typed as `EvaTheme` / `MaterialTheme`, key types exported. - `@ui-kitten/components`: `ThemeType = { [K in KnownThemeKey]?: ThemeValue } & Record<string, ThemeValue>` (an intersection, per the TS2411 note in `themeStore.ts`), `ThemeKey = LiteralUnion<KnownThemeKey>`; `KnownThemeKey` and `ThemeKey` exported. `us

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

### Incident Patch 1: `82b9931b` (2026-10-04)
**Commit Message**: feat(avatar): render initials from name (#1926)

* feat(avatar): render initials from name

Avatar was an Image only, so an account without a picture had nothing to
show. `name` renders as initials in a frame of the same size and shape
when there is no source or the image fails to load, coloured by the new
`status` variant of the Avatar mapping. Closes #1806.

* fix(avatar): keep basic initials readable in dark themes

The basic status used text-basic-color on color-basic-default. In the
Eva and Material dark themes both resolve to near-white, so the initials
vanished. Use color-basic-800 like the filled basic Button.

* fix(avatar): show initials for a source without a uri

`source={{ uri: user.photoUrl }}` with a null or empty uri rendered an
Image that never loads or fails, so Android showed an empty space
instead of the initials. Such a source now counts as missing. Initials
take the first code point of each word (an emoji or a non-BMP letter
stayed half a surrogate pair), a whitespace-only name renders no
initials frame and no blank label, and a consumer aria-label /
accessibilityLabel wins over the name on the initials frame.

**File**: `.changeset/avatar-initials.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+---
+"@ui-kitten/components": minor
+"@ui-kitten/eva": minor
+"@ui-kitten/material": minor
+---
+
+`Avatar` gains `name` and `status`. Without a `source`, or when the image fails to load, `name` renders
+as initials (the first letter of the first two words) in a frame of the same size and shape, coloured by
+`status`, and is the avatar's accessible name. The Eva and Material `Avatar` mappings gain `textFontSize`
+per size, `textFontFamily` / `textFontWeight`, and a `status` variant group with `backgroundColor` /
+`textColor` (#1806).
```

**File**: `src/components/ui/avatar/avatar.component.tsx` (modified, +137/-5)
```diff
@@ -5,15 +5,20 @@
  * Licensed under the MIT License. See License.txt in the project root for license information.
  */
 
-import React, { useMemo } from 'react';
+import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import {
   Image,
+  ImageErrorEventData,
   ImageProps,
   ImageStyle,
+  NativeSyntheticEvent,
   StyleSheet,
+  Text,
+  View,
 } from 'react-native';
 import {
   EvaSize,
+  EvaStatus,
   LiteralUnion,
 } from '../../devsupport';
 import { useStyled, StyleType } from '../../theme';
@@ -36,6 +41,17 @@ export type AvatarProps<P = ImageProps> = P & {
    * Defaults to *medium*.
    */
   size?: EvaSize;
+  /**
+   * Name shown as initials (the first letter of the first two words) when there is no `source`
+   * or the image fails to load. Also the accessible name of the avatar.
+   */
+  name?: string;
+  /**
+   * Status of the initials frame: its background and text colours.
+   * Can be `basic`, `primary`, `success`, `info`, `warning`, `danger` or `control`.
+   * Defaults to *basic*.
+   */
+  status?: EvaStatus;
   /**
    * A component to render.
    * Defaults to Image.
@@ -46,6 +62,43 @@ export type AvatarProps<P = ImageProps> = P & {
 
 export type AvatarElement = React.ReactElement<AvatarProps>;
 
+/**
+ * Initials shown in place of a missing or failed image: the first letter of the first two words.
+ */
+export const initialsOf = (name: string): string => {
+  return name
+    .trim()
+    .split(/\s+/)
+    .filter(Boolean)
+    .slice(0, 2)
+    // `Array.from` splits by code point, so an emoji or a letter outside the BMP stays whole.
+    .map(word => Array.from(word)[0].toUpperCase())
+    .join('');
+};
+
+/**
+ * Whether `source` points at an image: a bundled asset, or at least one entry with a uri. A
+ * `{ uri: null }` / `''` source (a user without a photo) renders nothing and never fails.
+ */
+const hasImageSource = (source: ImageProps['source']): boolean => {
+  if (!source) {
+    return false;
+  }
+  if (typeof source === 'number') {
+    return true;
+  }
+  const sources = Array.isArray(source) ? source : [source];
+  return sources.some(item => Boolean(item?.uri));
+};
+
+const sourceKeyOf = (source: ImageProps['source']): string | number | undefined => {
+  if (!source || typeof source === 'number') {
+    return source as number | undefined;
+  }
+  const sources = Array.isArray(source) ? source : [source];
+  return sources.map(item => item.uri ?? '').join('|');
+};
+
 /**
  * An Image with additional styles provided by Eva.
  *
@@ -59,6 +112,13 @@ export type AvatarElement = React.ReactElement<AvatarProps>;
  * Can be `tiny`, `small`, `medium`, `large`, or `giant`.
  * Defaults to *medium*.
  *
+ * @property {string} name - Name shown as initials (the first letter of the first two words)
+ * when there is no `source` or the image fails to load. Also the accessible name of the avatar.
+ *
+ * @property {string} status - Status of the initials frame: its background and text colours.
+ * Can be `basic`, `primary`, `success`, `info`, `warning`, `danger` or `control`.
+ * Defaults to *basic*.
+ *
  * @property {React.ComponentType} ImageComponent - A component to render.
  * Defaults to Image.
  *
@@ -72,6 +132,9 @@ export type AvatarElement = React.ReactElement<AvatarProps>;
  * @overview-example AvatarShape
  * Also, it may have different shape configurable with `shape` property.
  *
+ * @overview-example AvatarInitials
+ * Without a `source`, or when the image fails to load, `name` renders as initials coloured by `status`.
+ *
  * @overview-example AvatarImageComponent
  * Avatar may have different root component to render images.
  * This might be helpful when needed to improve image loading with 3rd party image libraries.
@@ -83,19 +146,40 @@ export const Avatar = <P extends ImageProps = ImageProps>(
     appearance,
     shape,
     size,
+    name,
+    status,
     style,
     ImageComponent = Image,
     ...imageProps
   } = props;
 
+  const { source, onError: onErrorProp } = imageProps as ImageProps;
+  const [imageFailed, setImageFailed] = useState(false);
+
+  // Retry once the image itself changes; an inline `source={{ uri }}` literal is a new object on
+  // every render of the parent, so compare by uri rather than by identity.
+  const sourceKey = sourceKeyOf(source);
+  useEffect(() => {
+    setImageFailed(false);
+  }, [sourceKey]);
+
   const { style: evaStyle } = useStyled('Avatar', {
     appearance,
     shape,
     size,
+    status,
   });
 
   const componentStyle = useMemo(() => {
-    const { roundCoefficient, ...containerParameters } = evaStyle as StyleType & { roundCoefficient?: number };
+    const {
+      roundCoefficient,
+      backgroundColor,
+      textColor,
+      textFontSize,
+      textFontWeight,
+      textFontFamily,
+      ...containerParameters
+    } = evaStyle as StyleType & { roundCoefficient?: number };
 
     // @ts-ignore: avoid checking `containerParameters`
     const baseStyle: ImageStyl
```

**File**: `src/components/ui/avatar/avatar.spec.tsx` (modified, +201/-1)
```diff
@@ -9,18 +9,33 @@ import React from 'react';
 import {
   Image,
   StyleSheet,
+  Text,
 } from 'react-native';
-import { render } from '@testing-library/react-native';
 import {
+  act,
+  fireEvent,
+  render,
+} from '@testing-library/react-native';
+import {
+  dark,
   light,
   mapping,
 } from '@ui-kitten/eva';
 import { ApplicationProvider } from '../../theme';
 import {
   Avatar,
   AvatarProps,
+  initialsOf,
 } from './avatar.component';
 
+const themeValue = (name: string): string => {
+  let value: string = light[name];
+  while (typeof value === 'string' && value.startsWith('$')) {
+    value = light[value.slice(1)];
+  }
+  return value;
+};
+
 describe('@avatar: component checks', () => {
 
   const TestAvatar = (props: Partial<AvatarProps>): React.ReactElement => (
@@ -79,4 +94,189 @@ describe('@avatar: component checks', () => {
     expect(borderRadius).toEqual(0);
   });
 
+  describe('initials', () => {
+    it('should derive initials from the first two words', () => {
+      expect(initialsOf('Jane Doe')).toEqual('JD');
+      expect(initialsOf('  ada   lovelace  byron ')).toEqual('AL');
+      expect(initialsOf('Plato')).toEqual('P');
+    });
+
+    it('should keep emoji and characters outside the BMP whole', () => {
+      expect(initialsOf('😀 bob')).toEqual('😀B');
+      expect(initialsOf('𝒜da Lovelace')).toEqual('𝒜L');
+    });
+
+    it('should treat a source without a uri as missing', () => {
+      for (const source of [{ uri: null }, { uri: '' }, [{ uri: '' }, { uri: undefined }, { uri: '' }]]) {
+        const component = render(
+          <TestAvatar
+            source={source as never}
+            name='Jane Doe'
+          />,
+        );
+        expect(component.queryByText('JD')).toBeTruthy();
+        expect(component.UNSAFE_queryByType(Image)).toBeNull();
+      }
+    });
+
+    it('should show nothing but the image for a whitespace-only name', () => {
+      const component = render(
+        <TestAvatar
+          source={undefined}
+          name='   '
+        />,
+      );
+
+      expect(component.UNSAFE_queryByType(Text)).toBeNull();
+      expect(component.UNSAFE_getByType(Image).props['aria-label']).toBeUndefined();
+    });
+
+    it('should prefer the consumer accessible name on the initials frame', () => {
+      const component = render(
+        <TestAvatar
+          source={undefined}
+          name='Jane Doe'
+          aria-label='Profile photo of Jane'
+        />,
+      );
+
+      expect(component.getByLabelText('Profile photo of Jane')).toBeTruthy();
+      expect(component.queryByLabelText('Jane Doe')).toBeNull();
+    });
+
+    it('should render initials instead of an image without a source', () => {
+      const component = render(
+        <TestAvatar
+          source={undefined}
+          name='Jane Doe'
+        />,
+      );
+
+      expect(component.UNSAFE_queryByType(Image)).toBeFalsy();
+      expect(component.queryByText('JD')).toBeTruthy();
+      expect(component.queryByLabelText('Jane Doe')).toBeTruthy();
+    });
+
+    it('should keep rendering the image when a name is set and the source loads', () => {
+      const component = render(
+        <TestAvatar name='Jane Doe' />,
+      );
+
+      expect(component.UNSAFE_queryByType(Image)).toBeTruthy();
+      expect(component.queryByText('JD')).toBeFalsy();
+    });
+
+    it('should fall back to initials when the image fails and forward onError', async () => {
+      const onError = jest.fn();
+      const component = render(
+        <TestAvatar
+          name='Jane Doe'
+          onError={onError}
+        />,
+      );
+
+      await act(async () => {
+        fireEvent(component.UNSAFE_getByType(Image), 'error', { nativeEvent: { error: 'boom' } });
+      });
+
+      expect(onError).toHaveBeenCalledTimes(1);
+      expect(component.UNSAFE_queryByType(Image)).toBeFalsy();
+      expect(component.queryByText('JD')).toBeTruthy();
+    });
+
+    it('should keep the fallback when the same uri is passed as a new object and retry on a new uri', async () => {
+      const Wrapper = ({ uri }: { uri: string }): React.ReactElement => (
+        <TestAvatar
+          name='Jane Doe'
+          source={{ uri }}
+        />
+      );
+      const component = render(<Wrapper uri='https://example.com/a.png' />);
+
+      await act(async () => {
+        fireEvent(component.UNSAFE_getByType(Image), 'error', { nativeEvent: { error: 'boom' } });
+      });
+      component.rerender(<Wrapper uri='https://example.com/a.png' />);
+
+      expect(component.queryByText('JD')).toBeTruthy();
+
+      component.rerender(<Wrapper uri='https://example.com/b.png' />);
+
+      expect(component.UNSAFE_queryByType(Image)).toBeTruthy();
+      expect(component.queryByText('JD')).toBeFalsy();
+    });
+
+    it('should render nothing but the image without a name', () => {
+      const component = render(
+        <TestAvatar source={undefined} />,
+      );
+
+      expect(component.UNSAFE
```

**File**: `src/eva/mapping.json` (modified, +82/-6)
```diff
@@ -63,6 +63,21 @@
                     },
                     "height": {
                         "type": "number"
+                    },
+                    "backgroundColor": {
+                        "type": "string"
+                    },
+                    "textColor": {
+                        "type": "string"
+                    },
+                    "textFontSize": {
+                        "type": "number"
+                    },
+                    "textFontWeight": {
+                        "type": "string"
+                    },
+                    "textFontFamily": {
+                        "type": "string"
                     }
                 },
                 "appearances": {
@@ -98,13 +113,39 @@
                         "giant": {
                             "default": false
                         }
+                    },
+                    "status": {
+                        "basic": {
+                            "default": true
+                        },
+                        "primary": {
+                            "default": false
+                        },
+                        "success": {
+                            "default": false
+                        },
+                        "info": {
+                            "default": false
+                        },
+                        "warning": {
+                            "default": false
+                        },
+                        "danger": {
+                            "default": false
+                        },
+                        "control": {
+                            "default": false
+                        }
                     }
                 },
                 "states": {}
             },
             "appearances": {
                 "default": {
-                    "mapping": {},
+                    "mapping": {
+                        "textFontFamily": "text-font-family",
+                        "textFontWeight": "text-subtitle-1-font-weight"
+                    },
                     "variantGroups": {
                         "shape": {
                             "round": {
@@ -120,23 +161,58 @@
                         "size": {
                             "tiny": {
                                 "width": "size-tiny",
-                                "height": "size-tiny"
+                                "height": "size-tiny",
+                                "textFontSize": 10
                             },
                             "small": {
                                 "width": "size-small",
-                                "height": "size-small"
+                                "height": "size-small",
+                                "textFontSize": 13
                             },
                             "medium": {
                                 "width": "size-medium",
-                                "height": "size-medium"
+                                "height": "size-medium",
+                                "textFontSize": 16
                             },
                             "large": {
                                 "width": "size-large",
-                                "height": "size-large"
+                                "height": "size-large",
+                                "textFontSize": 22
                             },
                             "giant": {
                                 "width": "size-giant",
-                                "height": "size-giant"
+                                "height": "size-giant",
+                                "textFontSize": 30
+                            }
+                        },
+                        "status": {
+                            "basic": {
+                                "backgroundColor": "color-basic-default",
+                                "textColor": "color-basic-800"
+                            },
+                            "primary": {
+                                "backgroundColor": "color-primary-default",
+                                "textColor": "text-control-color"
+                            },
+                            "success": {
+                                "backgroundColor": "color-success-default",
+                                "textColor": "text-control-color"
+                            },
+                            "info": {
+                                "backgroundColor": "color-info-default",
+                                "textColor": "text-control-color"
+                            },
+                            "warning": {
+                                "backgroundColor": "color-warning-default",
+                                "textColor": "text-control-color"
+                            },
+                            "danger": {
+                                "backgroundColor": "color-danger-default",
+                                "text
```

**File**: `src/material/mapping.json` (modified, +82/-6)
```diff
@@ -63,6 +63,21 @@
                     },
                     "height": {
                         "type": "number"
+                    },
+                    "backgroundColor": {
+                        "type": "string"
+                    },
+                    "textColor": {
+                        "type": "string"
+                    },
+                    "textFontSize": {
+                        "type": "number"
+                    },
+                    "textFontWeight": {
+                        "type": "string"
+                    },
+                    "textFontFamily": {
+                        "type": "string"
                     }
                 },
                 "appearances": {
@@ -98,13 +113,39 @@
                         "giant": {
                             "default": false
                         }
+                    },
+                    "status": {
+                        "basic": {
+                            "default": true
+                        },
+                        "primary": {
+                            "default": false
+                        },
+                        "success": {
+                            "default": false
+                        },
+                        "info": {
+                            "default": false
+                        },
+                        "warning": {
+                            "default": false
+                        },
+                        "danger": {
+                            "default": false
+                        },
+                        "control": {
+                            "default": false
+                        }
                     }
                 },
                 "states": {}
             },
             "appearances": {
                 "default": {
-                    "mapping": {},
+                    "mapping": {
+                        "textFontFamily": "text-font-family",
+                        "textFontWeight": "text-subtitle-1-font-weight"
+                    },
                     "variantGroups": {
                         "shape": {
                             "round": {
@@ -120,23 +161,58 @@
                         "size": {
                             "tiny": {
                                 "width": "size-tiny",
-                                "height": "size-tiny"
+                                "height": "size-tiny",
+                                "textFontSize": 10
                             },
                             "small": {
                                 "width": "size-small",
-                                "height": "size-small"
+                                "height": "size-small",
+                                "textFontSize": 13
                             },
                             "medium": {
                                 "width": "size-medium",
-                                "height": "size-medium"
+                                "height": "size-medium",
+                                "textFontSize": 16
                             },
                             "large": {
                                 "width": "size-large",
-                                "height": "size-large"
+                                "height": "size-large",
+                                "textFontSize": 22
                             },
                             "giant": {
                                 "width": "size-giant",
-                                "height": "size-giant"
+                                "height": "size-giant",
+                                "textFontSize": 30
+                            }
+                        },
+                        "status": {
+                            "basic": {
+                                "backgroundColor": "color-basic-default",
+                                "textColor": "color-basic-800"
+                            },
+                            "primary": {
+                                "backgroundColor": "color-primary-default",
+                                "textColor": "text-control-color"
+                            },
+                            "success": {
+                                "backgroundColor": "color-success-default",
+                                "textColor": "text-control-color"
+                            },
+                            "info": {
+                                "backgroundColor": "color-info-default",
+                                "textColor": "text-control-color"
+                            },
+                            "warning": {
+                                "backgroundColor": "color-warning-default",
+                                "textColor": "text-control-color"
+                            },
+                            "danger": {
+                                "backgroundColor": "color-danger-default",
+                                "text
```

**File**: `src/showcases/components/avatar/avatarInitials.component.tsx` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import React from 'react';
+import { StyleSheet } from 'react-native';
+import { Avatar, Layout, Text } from '@ui-kitten/components';
+
+const SIZES = ['tiny', 'small', 'medium', 'large', 'giant'] as const;
+const STATUSES = ['basic', 'primary', 'success', 'info', 'warning', 'danger'] as const;
+
+export const AvatarInitialsShowcase = (): React.ReactElement => (
+  <Layout
+    testID='avatar-initials'
+    style={styles.container}
+    level='1'
+  >
+    <Text category='c1' style={styles.label}>
+      Sizes, no source
+    </Text>
+    <Layout style={styles.row} level='1'>
+      {SIZES.map(size => (
+        <Avatar
+          key={size}
+          testID={`avatar-initials-${size}`}
+          style={styles.avatar}
+          size={size}
+          name='Jane Doe'
+        />
+      ))}
+    </Layout>
+
+    <Text category='c1' style={styles.label}>
+      Statuses
+    </Text>
+    <Layout style={styles.row} level='1'>
+      {STATUSES.map(status => (
+        <Avatar
+          key={status}
+          testID={`avatar-initials-${status}`}
+          style={styles.avatar}
+          status={status}
+          name='Ada Lovelace'
+        />
+      ))}
+    </Layout>
+
+    <Text category='c1' style={styles.label}>
+      Failed image falls back
+    </Text>
+    <Layout style={styles.row} level='1'>
+      <Avatar
+        testID='avatar-initials-failed'
+        style={styles.avatar}
+        size='large'
+        shape='rounded'
+        status='primary'
+        name='Broken Link'
+        source={{ uri: 'https://invalid.invalid/no-such-image.png' }}
+      />
+      <Avatar
+        testID='avatar-initials-loaded'
+        style={styles.avatar}
+        size='large'
+        shape='rounded'
+        name='Icon Image'
+        source={require('../../assets/icon.png')}
+      />
+    </Layout>
+  </Layout>
+);
+
+const styles = StyleSheet.create({
+  container: {
+    gap: 4,
+  },
+  label: {
+    marginTop: 8,
+    marginBottom: 4,
+    color: '#8F9BB3',
+  },
+  row: {
+    flexDirection: 'row',
+    flexWrap: 'wrap',
+    alignItems: 'center',
+  },
+  avatar: {
+    margin: 4,
+  },
+});
```

**File**: `src/showcases/navigation/app.navigator.tsx` (modified, +2/-0)
```diff
@@ -70,6 +70,7 @@ import { SelectScrollToSelectedShowcase } from '../components/select/selectScrol
 import { SelectPlacementShowcase } from '../components/select/selectPlacement.component';
 import { ButtonGroupToggleShowcase } from '../components/buttonGroup/buttonGroupToggle.component';
 import { DatepickerFullWidthShowcase } from '../components/datepicker/datepickerFullWidth.component';
+import { AvatarInitialsShowcase } from '../components/avatar/avatarInitials.component';
 import {
   IconGallery1Showcase,
   IconGallery2Showcase,
@@ -209,6 +210,7 @@ const SECTIONS: ShowcaseSection[] = [
   { title: 'SelectPlacement', Component: SelectPlacementShowcase },
   { title: 'ButtonGroupToggle', Component: ButtonGroupToggleShowcase },
   { title: 'DatepickerFullWidth', Component: DatepickerFullWidthShowcase },
+  { title: 'AvatarInitials', Component: AvatarInitialsShowcase },
 ];
 
 const keyExtractor = (item: ShowcaseSection): string => item.title;
```

**File**: `website/docs/components/avatar.mdx` (modified, +13/-0)
```diff
@@ -53,6 +53,8 @@ const AvatarExample = () => (
 | Property | Type | Default | Description |
 |----------|------|---------|-------------|
 | `source` | `ImageSourcePropType` | - | Image source (local require or remote URI). |
+| `name` | `string` | `undefined` | Shown as initials (first letter of the first two words) when there is no `source` or the image fails to load; also the accessible name. |
+| `status` | `'basic' \| 'primary' \| 'success' \| 'info' \| 'warning' \| 'danger' \| 'control'` | `'basic'` | Background and text colours of the initials frame. |
 | `shape` | `'round' \| 'rounded' \| 'square'` | `'round'` | Shape of the avatar. |
 | `size` | `'tiny' \| 'small' \| 'medium' \| 'large' \| 'giant'` | `'medium'` | Size of the avatar. |
 | `style` | `ImageStyle` | `undefined` | Additional styles applied to the avatar image. |
@@ -61,6 +63,17 @@ const AvatarExample = () => (
 
 Avatar also accepts all props of the component given to `ImageComponent`, which by default is React Native's `Image`.
 
+## Initials
+
+Without a `source`, or when the image fails to load, `name` renders as initials in a frame of the same size and shape, coloured by `status`:
+
+```tsx
+<Avatar name="Jane Doe" status="primary" size="large" />
+<Avatar name="Jane Doe" source={{ uri: 'https://example.com/avatar.jpg' }} />
+```
+
+The text size per avatar `size` and the status colours come from the `Avatar` mapping (`textFontSize`, `backgroundColor`, `textColor`).
+
 ## Storybook
 
 Live examples coming soon via Storybook.
```

---

### Incident Patch 2: `e42b1314` (2026-10-04)
**Commit Message**: fix(input, select, datepicker): space the caption with captionMarginTop (#1921)

* fix(input): space the caption with captionMarginTop

The caption margin was destructured from the mapping and never applied
since the caption container was removed, so a caption sat flush under the
field. The margin now goes on the caption text only when a caption
renders. The Eva Input mapping lacked the token entirely; it is back at 4,
matching Material. Closes #1434.

* fix(select, datepicker): space the caption with captionMarginTop

Select and Datepicker captions sat flush under the field while Input now
uses captionMarginTop. Both apply the token to the caption; the Eva
mapping gains it for Select and Datepicker (Material had it). Datepicker
fed the token into its popover's marginBottom, which is removed.

**File**: `.changeset/input-caption-margin.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@ui-kitten/components": patch
+"@ui-kitten/eva": patch
+---
+
+`Input`, `Select`, `Datepicker` and `RangeDatepicker` space their caption from the field by the mapping `captionMarginTop` (4 in Eva and Material); the token was defined but never applied, so captions sat flush under the field. The Eva mapping gains the token for `Input`, `Select` and `Datepicker` (Material already had it). The `Datepicker` popover no longer takes `captionMarginTop` as its bottom margin. Screens with captions move them 4 dp down.
```

**File**: `src/components/ui/datepicker/datepicker.spec.tsx` (modified, +10/-0)
```diff
@@ -32,6 +32,7 @@ import {
   DatepickerRef,
 } from './datepicker.component';
 import { Calendar } from '../calendar/calendar.component';
+import { Popover } from '../popover/popover.component';
 import { CalendarViewModes } from '../calendar/type';
 
 jest.mock('react-native', () => {
@@ -203,6 +204,15 @@ describe('@datepicker: component checks', () => {
     expect(component.queryByText('I love Babel')).toBeTruthy();
   });
 
+  it('should space the caption with the mapping captionMarginTop and leave the popover margin alone', async () => {
+    const component = render(<TestDatepicker caption='I love Babel' />);
+
+    const { marginTop } = StyleSheet.flatten(component.getByText('I love Babel').props.style);
+    expect(marginTop).toEqual(mapping.components.Datepicker.appearances.default.mapping.captionMarginTop);
+    expect(marginTop).toBeGreaterThan(0);
+    expect(StyleSheet.flatten(component.UNSAFE_getByType(Popover).props.style).marginBottom).toBeUndefined();
+  });
+
   it('should render caption as string', async () => {
     const component = render(
       <TestDatepicker caption='I love Babel' />,
```

**File**: `src/components/ui/datepicker/rangeDatepicker.spec.tsx` (modified, +8/-0)
```diff
@@ -153,6 +153,14 @@ describe('@range-datepicker: component checks', () => {
     expect(component.queryByText('I love Babel')).toBeTruthy();
   });
 
+  it('should space the caption with the mapping captionMarginTop', async () => {
+    const component = render(<TestRangeDatepicker caption='I love Babel' />);
+
+    const { marginTop } = StyleSheet.flatten(component.getByText('I love Babel').props.style);
+    expect(marginTop).toEqual(mapping.components.Datepicker.appearances.default.mapping.captionMarginTop);
+    expect(marginTop).toBeGreaterThan(0);
+  });
+
   it('should render caption as string', async () => {
     const component = render(
       <TestRangeDatepicker caption='I love Babel' />,
```

**File**: `src/components/ui/datepicker/useDatepickerStyles.ts` (modified, +1/-1)
```diff
@@ -83,6 +83,7 @@ export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
         fontWeight: labelFontWeight,
       },
       captionLabel: {
+        marginTop: captionMarginTop,
         fontSize: captionFontSize,
         fontWeight: captionFontWeight,
         fontFamily: captionFontFamily,
@@ -93,7 +94,6 @@ export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
         // The calendar inside sizes the popover (its mapping width is 344); cap the popover at the
         // window so the calendar, which is `maxWidth: '100%'`, shrinks with it on narrow screens.
         maxWidth: windowWidth - 2 * DATEPICKER_POPOVER_WINDOW_INSET,
-        marginBottom: captionMarginTop,
       },
     };
   }, [evaStyle, windowWidth]);
```

**File**: `src/components/ui/input/input.component.tsx` (modified, +1/-1)
```diff
@@ -285,7 +285,6 @@ const InputComponent = React.forwardRef<InputRef, InputProps>(
         labelMarginBottom,
         labelFontWeight,
         labelFontFamily,
-        // eslint-disable-next-line @typescript-eslint/no-unused-vars
         captionMarginTop,
         captionColor,
         captionFontSize,
@@ -324,6 +323,7 @@ const InputComponent = React.forwardRef<InputRef, InputProps>(
           fontFamily: labelFontFamily,
         },
         captionLabel: {
+          marginTop: captionMarginTop,
           fontSize: captionFontSize,
           fontWeight: captionFontWeight,
           fontFamily: captionFontFamily,
```

**File**: `src/components/ui/input/input.spec.tsx` (modified, +22/-0)
```diff
@@ -176,6 +176,28 @@ describe('@input: component checks', () => {
     expect(component.queryByText('I love Babel')).toBeTruthy();
   });
 
+  it('should space the caption from the field with the mapping captionMarginTop', () => {
+    const component = render(
+      <TestInput caption='I love Babel' />,
+    );
+
+    const caption = component.getByText('I love Babel');
+    const { marginTop } = StyleSheet.flatten(caption.props.style);
+
+    expect(marginTop).toEqual(mapping.components.Input.appearances.default.mapping.captionMarginTop);
+    expect(marginTop).toBeGreaterThan(0);
+  });
+
+  it('should render no caption element without a caption', () => {
+    const component = render(
+      <TestInput label='Label' />,
+    );
+
+    const texts = component.UNSAFE_queryAllByType(Text);
+
+    expect(texts.length).toEqual(1);
+  });
+
   it('should render component passed to caption prop', () => {
     const Caption = (props): React.ReactElement<ImageProps> => (
       <Image
```

**File**: `src/components/ui/select/select.component.tsx` (modified, +2/-0)
```diff
@@ -279,6 +279,7 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
         labelMarginBottom,
         labelFontWeight,
         labelFontFamily,
+        captionMarginTop,
         captionColor,
         captionFontSize,
         captionFontWeight,
@@ -326,6 +327,7 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
           color: labelColor,
         },
         caption: {
+          marginTop: captionMarginTop,
           fontSize: captionFontSize,
           fontWeight: captionFontWeight,
           fontFamily: captionFontFamily,
```

**File**: `src/components/ui/select/select.spec.tsx` (modified, +8/-0)
```diff
@@ -228,6 +228,14 @@ describe('@select: component checks', () => {
     expect(StyleSheet.flatten(firstOption.props.style).fontSize).toBeLessThan(15);
   });
 
+  it('should space the caption with the mapping captionMarginTop', () => {
+    const component = render(<TestSelect caption='I love Babel' />);
+
+    const { marginTop } = StyleSheet.flatten(component.getByText('I love Babel').props.style);
+    expect(marginTop).toEqual(mapping.components.Select.appearances.default.mapping.captionMarginTop);
+    expect(marginTop).toBeGreaterThan(0);
+  });
+
   it('should render placeholder', () => {
     const component = render(
       <TestSelect placeholder='I love Babel' />,
```

---

### Incident Patch 3: `6ac12994` (2026-10-04)
**Commit Message**: fix(select): scroll to the selected option on open (#1924)

* fix(select): scroll to the selected option on open

The options list mounted at the top every time it opened, so a selection
past the visible rows was out of view on reopen. The list now scrolls to
the (first) selected option once its content is laid out, with the
FlatList offset fallback for rows outside the render window. Closes #822.

* fix(select): bound the scroll-to-selected retries

A failed scrollToIndex retried from its own failure handler without a
limit, so a row that never got a frame kept the list retrying every
50 ms while open. Retries are now capped at five per opening (the last
of 30 options needs two or three on iOS and Android, since the first
failure comes before any row is measured), the pending retry is dropped
when the list closes or unmounts, and a multi select scrolls to its
topmost selected row instead of the first one in selection order.

**File**: `.changeset/select-scroll-to-selected.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Select` scrolls its options to the selected one when the list opens (the first selected option of a
+multi-select, the group row of a grouped option), so a selection past the visible rows is in view on
+reopen. A `listProps.initialScrollIndex` takes over when set (#822).
```

**File**: `src/components/ui/select/select.component.tsx` (modified, +78/-3)
```diff
@@ -5,7 +5,7 @@
  * Licensed under the MIT License. See License.txt in the project root for license information.
  */
 
-import React, { ReactNode, useCallback, useMemo, useRef, useState, useImperativeHandle } from 'react';
+import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react';
 import {
   Animated,
   GestureResponderEvent,
@@ -95,6 +95,7 @@ export interface SelectRef {
 const CHEVRON_DEG_COLLAPSED = -180;
 const CHEVRON_DEG_EXPANDED = 0;
 const CHEVRON_ANIM_DURATION = 200;
+const MAX_SCROLL_RETRIES = 5;
 
 /**
  * A dropdown menu for selecting options.
@@ -172,6 +173,11 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
     } = props;
 
     const [listVisible, setListVisible] = useState(false);
+    const optionsListRef = useRef<ListRef | null>(null);
+    const scrollToSelectedPendingRef = useRef(false);
+    // Fallback retries used in this opening; the timer is dropped when the list closes or unmounts.
+    const scrollRetryCountRef = useRef(0);
+    const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
     const serviceRef = useRef(new SelectService());
     const expandAnimationRef = useRef(new Animated.Value(0));
 
@@ -196,6 +202,24 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
       return Array.isArray(selectedIndex) ? selectedIndex : [selectedIndex];
     }, [selectedIndex]);
 
+    // Row of the options list that holds the selected option, the topmost one for a multi select
+    // (selection order is not list order): a grouped option lives inside the row of its group.
+    const selectedListIndex = useMemo((): number => {
+      const rows = selectedIndices
+        .filter(Boolean)
+        .map((index): number => index.section >= 0 ? index.section : index.row);
+      return rows.length > 0 ? Math.min(...rows) : -1;
+    }, [selectedIndices]);
+
+    const clearScrollRetry = useCallback((): void => {
+      if (scrollRetryTimerRef.current !== null) {
+        clearTimeout(scrollRetryTimerRef.current);
+        scrollRetryTimerRef.current = null;
+      }
+    }, []);
+
+    useEffect(() => clearScrollRetry, [clearScrollRetry]);
+
     const expandToRotateInterpolation = useMemo(() => {
       return expandAnimation.interpolate({
         inputRange: [CHEVRON_DEG_COLLAPSED, CHEVRON_DEG_EXPANDED],
@@ -296,6 +320,8 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
     const setOptionsListVisible = useCallback(() => {
       const hasData = data.length > 0;
       if (hasData) {
+        scrollToSelectedPendingRef.current = true;
+        scrollRetryCountRef.current = 0;
         setListVisible(true);
         dispatch([Interaction.ACTIVE]);
         createExpandAnimation(-CHEVRON_DEG_COLLAPSED).start(() => {
@@ -305,12 +331,13 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
     }, [data.length, dispatch, createExpandAnimation, onFocusProp]);
 
     const setOptionsListInvisible = useCallback(() => {
+      clearScrollRetry();
       setListVisible(false);
       dispatch([]);
       createExpandAnimation(CHEVRON_DEG_EXPANDED).start(() => {
         onBlurProp?.(null);
       });
-    }, [dispatch, createExpandAnimation, onBlurProp]);
+    }, [dispatch, createExpandAnimation, onBlurProp, clearScrollRetry]);
 
     // Imperative handle for ref
     useImperativeHandle(ref, () => ({
@@ -359,6 +386,52 @@ const SelectComponent = React.forwardRef<SelectRef, SelectProps>(
       setOptionsListInvisible();
     }, [setOptionsListInvisible]);
 
+    const setListRefs = useCallback((instance: ListRef | null): void => {
+      optionsListRef.current = instance;
+      if (typeof listRef === 'function') {
+        listRef(instance);
+      } else if (listRef) {
+        (listRef as React.MutableRefObject<ListRef | null>).current = instance;
+      }
+    }, [listRef]);
+
+    // The list mounts scrolled to the top every time it opens; bring the selected option into
+    // view once its content is laid out. A consumer `initialScrollIndex` takes over.
+    const onListContentSizeChange = useCallback((width: number, height: number): void => {
+      listProps?.onContentSizeChange?.(width, height);
+      if (!scrollToSelectedPendingRef.current) {
+        return;
+      }
+      scrollToSelectedPendingRef.current = false;
+      const index = selectedListIndex;
+      if (listProps?.initialScrollIndex !== undefined || index <= 0 || index >= data.length) {
+        return;
+      }
+      optionsListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
+    }, [listProps, selectedListIndex, data.length]);
+
+    // Rows past the render window have no frame yet: jump near them by the average row
+    // height, then retry once the window has caught up. Each jump renders more rows and refines the
+    // average, so a long list needs a few rounds (two to three for the last of 30 options on iOS and
+    // Android: the firs
```

**File**: `src/components/ui/select/select.spec.tsx` (modified, +146/-0)
```diff
@@ -15,6 +15,7 @@ import {
   TouchableOpacity,
 } from 'react-native';
 import {
+  act,
   fireEvent,
   render,
   RenderAPI,
@@ -422,6 +423,151 @@ I love Babel
     expect(typeof listRef.current.scrollToIndex).toBe('function');
   });
 
+  describe('scroll to the selected option on open', () => {
+    const ManyOptions = React.forwardRef((props: Partial<SelectProps>, ref: React.Ref<SelectRef>) => (
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Select
+          ref={ref}
+          {...props}
+        >
+          {Array.from({ length: 30 }, (_, index) => (
+            <SelectItem
+              key={index}
+              title={`Option ${index + 1}`}
+            />
+          ))}
+        </Select>
+      </ApplicationProvider>
+    ));
+    ManyOptions.displayName = 'ManyOptions';
+
+    let scrollToIndex: jest.SpyInstance;
+
+    beforeEach(() => {
+      scrollToIndex = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => undefined);
+    });
+
+    afterEach(() => {
+      scrollToIndex.mockRestore();
+    });
+
+    const openAndLayout = async (component: RenderAPI): Promise<void> => {
+      fireEvent.press(touchables.findControlTouchable(component));
+      const list = await waitFor(() => component.UNSAFE_getByType(FlatList));
+      fireEvent(list, 'contentSizeChange', 300, 1200);
+    };
+
+    it('should scroll the list to the selected option', async () => {
+      const component = render(
+        <ManyOptions selectedIndex={new IndexPath(24)} />,
+      );
+
+      await openAndLayout(component);
+
+      expect(scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 24, animated: false }));
+    });
+
+    it('should scroll to the topmost selected option of a multi select', async () => {
+      const component = render(
+        <ManyOptions
+          multiSelect={true}
+          selectedIndex={[new IndexPath(20), new IndexPath(12)]}
+        />,
+      );
+
+      await openAndLayout(component);
+
+      expect(scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 12 }));
+    });
+
+    it('should stop retrying a failed scroll after a few rounds', async () => {
+      jest.useFakeTimers();
+      const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
+      const component = render(<ManyOptions selectedIndex={new IndexPath(24)} />);
+      await openAndLayout(component);
+      const list = component.UNSAFE_getByType(FlatList);
+      const failure = { index: 24, highestMeasuredFrameIndex: 9, averageItemLength: 40 };
+
+      // Every attempt fails: the first try plus five retries, then nothing more.
+      for (let attempt = 0; attempt < 10; attempt++) {
+        list.props.onScrollToIndexFailed(failure);
+        act(() => jest.advanceTimersByTime(60));
+      }
+
+      expect(scrollToIndex).toHaveBeenCalledTimes(6);
+      scrollToOffset.mockRestore();
+      jest.useRealTimers();
+    });
+
+    it('should drop a pending retry when the list closes', async () => {
+      jest.useFakeTimers();
+      const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
+      const component = render(<ManyOptions selectedIndex={new IndexPath(24)} />);
+      await openAndLayout(component);
+
+      component.UNSAFE_getByType(FlatList).props.onScrollToIndexFailed({ index: 24, highestMeasuredFrameIndex: 9, averageItemLength: 40 });
+      act(() => component.getByTestId('@backdrop').props.onResponderRelease({ nativeEvent: {} }));
+      act(() => jest.advanceTimersByTime(200));
+
+      expect(scrollToIndex).toHaveBeenCalledTimes(1);
+      scrollToOffset.mockRestore();
+      jest.useRealTimers();
+    });
+
+    it('should not scroll without a selection or when the first option is selected', async () => {
+      const component = render(
+        <ManyOptions />,
+      );
+      await openAndLayout(component);
+
+      const first = render(
+        <ManyOptions selectedIndex={new IndexPath(0)} />,
+      );
+      await openAndLayout(first);
+
+      expect(scrollToIndex).not.toHaveBeenCalled();
+    });
+
+    it('should leave scrolling to a consumer initialScrollIndex', async () => {
+      const component = render(
+        <ManyOptions
+          selectedIndex={new IndexPath(24)}
+          listProps={{ initialScrollIndex: 3, getItemLayout: (_data, index) => ({ length: 40, offset: 40 * index, index }) }}
+        />,
+      );
+
+      await openAndLayout(component);
+
+      expect(scrollToIndex).not.toHaveBeenCalled();
+    });
+
+    it('should scroll to the row of the group that holds the selected option', async () => {
+      const component = render(
+        <ApplicationProvider
+          mapping={mapping}
+          theme={light}
+        >
+          <Select selectedIndex={new IndexPath(1, 2)}>
+            <SelectItem title='Option 1' />
+            <SelectItem title='Opti
```

**File**: `src/showcases/components/select/selectScrollToSelected.component.tsx` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import React from 'react';
+import { StyleSheet } from 'react-native';
+import { IndexPath, Layout, Select, SelectItem, Text } from '@ui-kitten/components';
+
+const OPTIONS = Array.from({ length: 30 }, (_, index) => `Option ${index + 1}`);
+
+export const SelectScrollToSelectedShowcase = (): React.ReactElement => {
+
+  const [selectedIndex, setSelectedIndex] = React.useState<IndexPath | IndexPath[]>(new IndexPath(29));
+  const row = (selectedIndex as IndexPath).row;
+
+  return (
+    <Layout
+      testID='select-scroll'
+      style={styles.container}
+      level='1'
+    >
+      <Text testID='select-scroll-value'>{`Selected: ${row + 1}`}</Text>
+      <Select
+        testID='select-scroll-select'
+        selectedIndex={selectedIndex}
+        onSelect={index => setSelectedIndex(index)}
+      >
+        {OPTIONS.map((title, index) => (
+          <SelectItem
+            key={title}
+            testID={`select-scroll-option-${index + 1}`}
+            title={title}
+          />
+        ))}
+      </Select>
+    </Layout>
+  );
+};
+
+const styles = StyleSheet.create({
+  container: {
+    minHeight: 128,
+  },
+});
```

**File**: `src/showcases/navigation/app.navigator.tsx` (modified, +2/-0)
```diff
@@ -66,6 +66,7 @@ import { AutocompleteSimpleUsageShowcase } from '../components/autocomplete/auto
 import { AutocompleteBlurShowcase } from '../components/autocomplete/autocompleteBlur.component';
 import { ViewPagerSimpleUsageShowcase } from '../components/viewPager/viewPagerSimpleUsage.component';
 import { ModalDecimalSizeShowcase } from '../components/modal/modalDecimalSize.component';
+import { SelectScrollToSelectedShowcase } from '../components/select/selectScrollToSelected.component';
 import {
   IconGallery1Showcase,
   IconGallery2Showcase,
@@ -201,6 +202,7 @@ const SECTIONS: ShowcaseSection[] = [
   { title: 'CalendarHermes', Component: CalendarHermesShowcase },
   { title: 'PopoverAnchorFlex', Component: PopoverAnchorFlexShowcase },
   { title: 'AutocompleteBlur', Component: AutocompleteBlurShowcase },
+  { title: 'SelectScrollToSelected', Component: SelectScrollToSelectedShowcase },
 ];
 
 const keyExtractor = (item: ShowcaseSection): string => item.title;
```

**File**: `website/docs/components/select.mdx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ const SelectExample = () => {
 
 | Property | Type | Default | Description |
 |----------|------|---------|-------------|
-| `selectedIndex` | `IndexPath \| IndexPath[]` | `undefined` | The selected item index (or array for multi-select). |
+| `selectedIndex` | `IndexPath \| IndexPath[]` | `undefined` | The selected item index (or array for multi-select). When the list opens it scrolls to the selected option (the first one for multi-select, the group row for a grouped option); a `listProps.initialScrollIndex` takes over. |
 | `onSelect` | `(index: IndexPath \| IndexPath[]) => void` | - | Called when an item is selected. |
 | `placeholder` | `string \| number \| (props) => ReactElement` | `'Select Option'` | Placeholder displayed when no item is selected. |
 | `label` | `string \| number \| (props) => ReactElement` | `undefined` | Label displayed above the select. |
```

**File**: `website/stories/select.stories.tsx` (modified, +23/-1)
```diff
@@ -1,6 +1,6 @@
 import React from 'react';
 import type { Meta, StoryObj } from '@storybook/react-vite';
-import { Select, SelectItem } from '@ui-kitten/components';
+import { IndexPath, Select, SelectItem } from '@ui-kitten/components';
 
 const meta: Meta<typeof Select> = {
   title: 'Components/Select',
@@ -33,3 +33,25 @@ export const Default: Story = {
     </Select>
   ),
 };
+
+const ScrollToSelectedSelect = (args: React.ComponentProps<typeof Select>): React.ReactElement => {
+  const [selectedIndex, setSelectedIndex] = React.useState<IndexPath | IndexPath[]>(new IndexPath(29));
+  return (
+    <Select
+      {...args}
+      selectedIndex={selectedIndex}
+      onSelect={setSelectedIndex}
+    >
+      {Array.from({ length: 30 }, (_, index) => (
+        <SelectItem key={index} title={`Option ${index + 1}`} />
+      ))}
+    </Select>
+  );
+};
+
+export const ScrollToSelected: Story = {
+  args: {
+    label: 'Opens scrolled to the selected option',
+  },
+  render: (args) => <ScrollToSelectedSelect {...args} />,
+};
```

---

### Incident Patch 4: `73e990f1` (2026-10-04)
**Commit Message**: fix(autocomplete): select an option with the mouse on web (#1934)

* fix(modal): pass pointerEvents through the style

react-native-web 0.21 warns that the pointerEvents prop is deprecated.
The non-blocking overlay views now set it in their style, which React
Native supports since 0.71 (the library requires 0.72).

* fix(autocomplete): select an option with the mouse on web

On web a mouse-down on an option moved the focus away from the input
first; the blur closed the list and the press landed on nothing. The
options list now cancels the mouse-down default on web, so the input
keeps its focus and the press selects the option.

* chore: add changeset for the web autocomplete fix

**File**: `.changeset/web-autocomplete-option-press.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+On web, clicking an `Autocomplete` option with the mouse selects it: the mouse-down no longer moves the focus away from the input, whose blur closed the list before the click arrived. `Modal` sets `pointerEvents` through its style, which removes react-native-web's "props.pointerEvents is deprecated" warning.
```

**File**: `src/components/ui/autocomplete/autocomplete.component.tsx` (modified, +11/-0)
```diff
@@ -10,6 +10,7 @@ import {
   Keyboard,
   ListRenderItemInfo,
   NativeSyntheticEvent,
+  Platform,
   StyleSheet,
   TextInputFocusEventData,
   TextInputSubmitEditingEventData,
@@ -44,6 +45,15 @@ export interface AutocompleteRef {
   clear: () => void;
 }
 
+// On web a mouse-down on an option moves the focus away from the input before the press arrives;
+// the blur closes the list, so the press lands on nothing. Cancelling the mouse-down keeps the
+// input focused (its keyboard and caret stay) and lets the press select the option. Native taps
+// already keep the focus through `keyboardShouldPersistTaps`.
+const keepInputFocused = (event: { preventDefault: () => void }): void => event.preventDefault();
+const listWebProps = (): { onMouseDown?: typeof keepInputFocused } => (
+  Platform.OS === 'web' ? { onMouseDown: keepInputFocused } : {}
+);
+
 /**
  * Autocomplete is a normal text input enhanced by a panel of suggested options.
  *
@@ -246,6 +256,7 @@ const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
       anchor={renderInputElement}
     >
       <List
+        {...listWebProps()}
         style={styles.list}
         keyboardShouldPersistTaps='always'
         data={data}
```

**File**: `src/components/ui/autocomplete/autocomplete.spec.tsx` (modified, +36/-0)
```diff
@@ -10,6 +10,7 @@ import {
   Image,
   ImageProps,
   Keyboard,
+  Platform,
   Text,
   TextInput,
   TouchableOpacity,
@@ -34,6 +35,7 @@ import {
   AutocompleteItem,
   AutocompleteItemProps,
 } from './autocompleteItem.component';
+import { List } from '../list/list.component';
 import {
   TouchableWeb,
   TouchableWithoutFeedback,
@@ -453,4 +455,38 @@ describe('@autocomplete: component checks', () => {
     expect(component.getByTestId('@@autocomplete/input/input')).toBeTruthy();
   });
 
+
+  describe('web option press', () => {
+
+    const originalOS = Platform.OS;
+    const setOS = (os: typeof Platform.OS): void => {
+      Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
+    };
+
+    afterEach(() => setOS(originalOS));
+
+    const openList = async (): Promise<ReturnType<typeof render>> => {
+      const component = render(<TestAutocomplete />);
+      fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
+      await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
+      return component;
+    };
+
+    it('should keep the input focused when an option is pressed with the mouse on web', async () => {
+      setOS('web');
+      const component = await openList();
+      const preventDefault = jest.fn();
+
+      fireEvent(component.UNSAFE_getByType(List), 'mouseDown', { preventDefault });
+
+      expect(preventDefault).toHaveBeenCalled();
+    });
+
+    it('should not add a mouse handler on native', async () => {
+      setOS('ios');
+      const component = await openList();
+
+      expect(component.UNSAFE_getByType(List).props.onMouseDown).toBeUndefined();
+    });
+  });
 });
```

**File**: `src/components/ui/modal/modal.component.tsx` (modified, +5/-3)
```diff
@@ -363,8 +363,7 @@ const ModalOverlay = ({ children }: ModalOverlayProps): React.ReactElement => {
     <MeasureElement onMeasure={onMeasure}>
       <View
         testID='@modal/overlay'
-        style={StyleSheet.absoluteFill}
-        pointerEvents='box-none'
+        style={[StyleSheet.absoluteFill, styles.boxNone]}
       >
         <View
           style={{
@@ -373,8 +372,8 @@ const ModalOverlay = ({ children }: ModalOverlayProps): React.ReactElement => {
             top: -origin.y,
             width,
             height,
+            pointerEvents: 'box-none',
           }}
-          pointerEvents='box-none'
         >
           {children}
         </View>
@@ -392,4 +391,7 @@ const styles = StyleSheet.create({
   modalView: {
     position: 'absolute',
   },
+  boxNone: {
+    pointerEvents: 'box-none',
+  },
 });
```

**File**: `src/components/ui/modal/modal.spec.tsx` (modified, +1/-1)
```diff
@@ -419,7 +419,7 @@ describe('@modal: panel checks', () => {
 
     expect(component.UNSAFE_queryByType(RNModal)).toBeFalsy();
     expect(component.queryByTestId('@backdrop')).toBeFalsy();
-    expect(component.getByTestId('@modal/overlay').props.pointerEvents).toEqual('box-none');
+    expect(StyleSheet.flatten(component.getByTestId('@modal/overlay').props.style).pointerEvents).toEqual('box-none');
     expect(component.queryByText('Suggestions')).toBeTruthy();
   });
 
```

---

### Incident Patch 5: `00168faf` (2026-10-04)
**Commit Message**: fix(autocomplete): derive the input test ids from testID (#1931)

* fix(autocomplete): derive the input test ids from testID

* test(web-qa): follow the Autocomplete input test id

**File**: `.changeset/autocomplete-input-test-id.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Autocomplete` derives its input field's test ids from `testID` (`@@<testID>/input/input`, container `@@<testID>/input/container`) instead of the fixed `@@autocomplete/input/input`, so several autocompletes on one screen can be told apart in tests. Without a `testID` the field keeps the old id.
```

**File**: `src/components/ui/autocomplete/autocomplete.component.tsx` (modified, +7/-2)
```diff
@@ -62,6 +62,11 @@ export interface AutocompleteRef {
  *
  * @property {(number) => void} onSelect - Called when option is pressed.
  *
+ * @property {string} testID - Test id of the options list. The input field derives its own ids from it:
+ * the field is `@@<testID>/input/input` and its container `@@<testID>/input/container`, so several
+ * autocompletes on one screen stay distinguishable. Without a `testID` the field keeps the
+ * `@@autocomplete/input/input` id.
+ *
  * @note The options list floats above the app through the `ApplicationProvider` panel without a
  * backdrop: the first tap on an option selects it, and the first tap on a control next to the
  * field reaches that control. The list closes when the input blurs, when an option is selected,
@@ -221,14 +226,14 @@ const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
         <Input
           {...inputProps}
           ref={inputRef}
-          testID='@autocomplete/input'
+          testID={testID ? `@${testID}/input` : '@autocomplete/input'}
           onFocus={onInputFocus}
           onBlur={onInputBlur}
           onSubmitEditing={onInputSubmitEditing}
         />
       </View>
     );
-  }, [inputProps, onInputFocus, onInputBlur, onInputSubmitEditing]);
+  }, [inputProps, testID, onInputFocus, onInputBlur, onInputSubmitEditing]);
 
   return (
     <Popover
```

**File**: `src/components/ui/autocomplete/autocomplete.spec.tsx` (modified, +36/-0)
```diff
@@ -417,4 +417,40 @@ describe('@autocomplete: component checks', () => {
     componentRef.current.clear();
   });
 
+  it('should derive the input test ids from testID', () => {
+    const component = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Autocomplete testID='from'>
+          <AutocompleteItem title='Option 1' />
+        </Autocomplete>
+        <Autocomplete testID='to'>
+          <AutocompleteItem title='Option 1' />
+        </Autocomplete>
+      </ApplicationProvider>,
+    );
+
+    expect(component.getByTestId('@@from/input/input')).toBeTruthy();
+    expect(component.getByTestId('@@to/input/input')).toBeTruthy();
+    expect(component.getByTestId('@@to/input/container')).toBeTruthy();
+    expect(component.queryByTestId('@@autocomplete/input/input')).toBeNull();
+  });
+
+  it('should keep the default input test id without testID', () => {
+    const component = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Autocomplete>
+          <AutocompleteItem title='Option 1' />
+        </Autocomplete>
+      </ApplicationProvider>,
+    );
+
+    expect(component.getByTestId('@@autocomplete/input/input')).toBeTruthy();
+  });
+
 });
```

**File**: `website/docs/components/autocomplete.mdx` (modified, +1/-0)
```diff
@@ -74,6 +74,7 @@ const AutocompleteExample = () => {
 | `placement` | `string \| PopoverPlacement` | `'bottom'` | Position of the suggestions list relative to the input. The `inner` placements cover the field. |
 | `onFocus` | `(event) => void` | `undefined` | Called when the input gains focus; the list opens when there are suggestions. |
 | `onBlur` | `(event) => void` | `undefined` | Called when the input loses focus; the list closes. |
+| `testID` | `string` | `undefined` | Test id of the suggestions list. The input field uses `@@<testID>/input/input` (container `@@<testID>/input/container`); without it the field is `@@autocomplete/input/input`. |
 
 ### AutocompleteItem
 
```

**File**: `website/qa/run.mjs` (modified, +3/-3)
```diff
@@ -198,13 +198,13 @@ for (const [id, tag] of [['qa-checkbox', 'checkbox'], ['qa-toggle', 'toggle'], [
   const tn = await c.rect(T('qa-topnav-action')); await c.qa(); await c.click(tn.x + 12, tn.cy); const tnq = await c.qa();
   const tnInfo = await c.ev(`(() => { const e = document.querySelector('${T('qa-topnav-action')}'); const p = e.parentElement; return { tag: e.tagName, role: e.getAttribute('role'), cls: e.className.slice(0,60), html: e.outerHTML.slice(0, 300), parentRole: p.getAttribute('role'), parentRect: JSON.stringify(p.getBoundingClientRect()), topAt: (() => { const t = document.elementFromPoint(${tn.cx}, ${tn.cy}); return t && (t.tagName + '/' + (t.getAttribute('data-testid') || '') + '/' + t.getAttribute('role')); })() }; })()`);
   rep('top navigation action press', tnq.includes('topnav:press'), `size ${tn.w}x${tn.h} ${JSON.stringify(tnq)} ${JSON.stringify(tnInfo)}`);
-  await c.ev(`document.querySelector('${T('@@autocomplete/input-anchor/input')}').scrollIntoView({ block: 'center' })`); await c.sleep(200);
-  const ac = await c.rect(T('@@autocomplete/input-anchor/input')); await c.click(ac.x + 30, ac.cy); await c.sleep(200); await c.qa(); await c.type('an'); await c.sleep(400);
+  await c.ev(`document.querySelector('${T('@@qa-autocomplete/input/input')}').scrollIntoView({ block: 'center' })`); await c.sleep(200);
+  const ac = await c.rect(T('@@qa-autocomplete/input/input')); await c.click(ac.x + 30, ac.cy); await c.sleep(200); await c.qa(); await c.type('an'); await c.sleep(400);
   const opts = await c.ev(`['Banana','Apple','Cherry'].map(t => !![...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === t && e.getBoundingClientRect().width > 0))`);
   await c.shot(`${E}/autocomplete-open.png`);
   rep('autocomplete list filters while typing', JSON.stringify(opts) === '[true,false,false]', JSON.stringify(opts));
   const ban = await c.rectText('Banana'); await c.qa(); await c.click(ban.cx, ban.cy); await c.sleep(300); const aq = await c.qa();
-  const acv = await c.ev(`document.querySelector('${T('@@autocomplete/input-anchor/input')}').value`);
+  const acv = await c.ev(`document.querySelector('${T('@@qa-autocomplete/input/input')}').value`);
   rep('autocomplete item press fills input', aq.includes('ac-select:Banana') && acv === 'Banana', JSON.stringify(aq) + ' val=' + acv);
 }
 // ---- Keyboard: Tab order, focus style, Enter/Space
```

---

### Incident Patch 6: `a524b748` (2026-10-04)
**Commit Message**: fix(popover): point the indicator at the anchor (#1920)

* fix(popover): point the indicator at the anchor

When the content is moved to stay on screen (a wide tooltip anchored
near an edge, or the start/end placements the service falls back to),
the indicator stayed at the content's own centre or fixed offset and no
longer pointed at the anchor; on a narrow tooltip it could sit past the
content edge and disappear. Popover now derives the cross-axis distance
between the anchor centre and the placed content centre and PopoverView
translates the indicator by it, clamped inside the content edges.

* fix(popover): keep the content in place in right-to-left layouts

The indicator offset centred the whole PopoverView container, which in
right-to-left layouts moved a content narrower than the window to the
opposite side of its anchor on Android. Only the indicator is centred
now. The offset is a physical distance and translateX is physical on
both platforms, so it is no longer negated in RTL; iOS pointed the
indicator away from the anchor.

**File**: `.changeset/popover-indicator-anchor.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Tooltip` (and any `Popover` with an `indicator`) keeps its arrow pointing at the anchor when the content was moved to stay on screen, for example a wide tooltip on a button near a screen edge: the arrow follows the anchor centre instead of staying in the middle of the tooltip, and stays inside the tooltip's edges.
```

**File**: `src/components/ui/popover/popover.component.tsx` (modified, +21/-0)
```diff
@@ -28,6 +28,7 @@ import {
 import { ModalService } from '../../theme';
 import { Modal, ModalProps, RNModalProps } from '../modal/modal.component';
 import {
+  INDICATOR_EDGE_MARGIN,
   PopoverView,
   PopoverViewElement,
   PopoverViewProps,
@@ -90,6 +91,8 @@ export interface UsePopoverMeasurementResult {
   childFrame: Frame;
   actualPlacement: PopoverPlacement;
   contentPosition: Point;
+  /** Cross-axis distance from the content centre to the anchor centre, for the indicator. */
+  indicatorOffset: number;
   contentFlexPosition: StyleProp<ViewStyle>;
   forceMeasure: boolean;
   /** Attach to the anchor's `MeasureElement` so the hook can re-measure the anchor on demand. */
@@ -126,6 +129,7 @@ export function usePopoverMeasurement({
     PopoverPlacements.parse(placement)
   );
   const [contentPosition, setContentPosition] = useState<Point>(Point.outscreen());
+  const [indicatorOffset, setIndicatorOffset] = useState<number>(0);
 
   // Refs for values needed in callbacks without causing re-renders
   const childFrameRef = useRef<Frame>(childFrame);
@@ -224,6 +228,20 @@ export function usePopoverMeasurement({
       const displayFrame = placementService.fit(computedPlacement.frame(placementOptions), placementOptions.bounds);
       const newContentPosition = displayFrame.origin;
 
+      // The indicator points at the anchor's centre even after the content was moved to stay on
+      // screen (a tooltip near a screen edge, #1920); it stays inside the content's edges.
+      const isVertical = computedPlacement.flex().direction.startsWith('column');
+      const anchorCenter = isVertical
+        ? anchorFrame.origin.x + anchorFrame.size.width / 2
+        : anchorFrame.origin.y + anchorFrame.size.height / 2;
+      const contentCenter = isVertical
+        ? displayFrame.origin.x + displayFrame.size.width / 2
+        : displayFrame.origin.y + displayFrame.size.height / 2;
+      const contentExtent = isVertical ? displayFrame.size.width : displayFrame.size.height;
+      const travel = Math.max(0, contentExtent / 2 - INDICATOR_EDGE_MARGIN);
+      const newIndicatorOffset = Math.round(Math.max(-travel, Math.min(travel, anchorCenter - contentCenter)));
+      setIndicatorOffset((current) => current === newIndicatorOffset ? current : newIndicatorOffset);
+
       // A move of at most one point is ignored: a fractional content size measures one point
       // wider or narrower depending on where it sits, and following that re-measures forever.
       if (
@@ -338,6 +356,7 @@ export function usePopoverMeasurement({
     childFrame,
     actualPlacement,
     contentPosition,
+    indicatorOffset,
     contentFlexPosition,
     forceMeasure,
     anchorMeasureRef,
@@ -447,6 +466,7 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
   const {
     childFrame,
     actualPlacement,
+    indicatorOffset,
     contentFlexPosition,
     forceMeasure,
     anchorMeasureRef,
@@ -496,6 +516,7 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
         {...viewProps}
         contentContainerStyle={[contentContainerStyle, styles.popoverView, contentFlexPosition]}
         layoutDirection={PopoverPlacements.parse(actualPlacement).flex()}
+        indicatorOffset={indicatorOffset}
       >
         {renderContentElement()}
       </PopoverView>
```

**File**: `src/components/ui/popover/popover.indicator.spec.tsx` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+import React from 'react';
+import { StyleSheet, Text, View } from 'react-native';
+import {
+  fireEvent,
+  render,
+  waitFor,
+} from '@testing-library/react-native';
+import { light, mapping } from '@ui-kitten/eva';
+import { ApplicationProvider } from '../../theme';
+import { Popover } from './popover.component';
+import { PopoverView } from './popoverView.component';
+import { RTLService } from '../../devsupport';
+
+type MeasureCallback = (x: number, y: number, width: number, height: number) => void;
+
+declare global {
+  // eslint-disable-next-line no-var
+  var measureCalls: MeasureCallback[];
+}
+
+/*
+ * The indicator keeps pointing at the anchor when the content had to move to stay on screen
+ * (#1920). The jest window is 750 x 1334.
+ */
+jest.mock('react-native', () => {
+  const ActualReactNative = jest.requireActual('react-native');
+
+  ActualReactNative.UIManager.measureInWindow = (node, callback) => {
+    global.measureCalls.push(callback);
+  };
+  Object.defineProperty(ActualReactNative, 'findNodeHandle', { value: () => 1 });
+
+  return ActualReactNative;
+});
+
+describe('@popover: indicator offset', () => {
+
+  beforeEach(() => {
+    global.measureCalls = [];
+  });
+
+  const TestPopover = (props: { visible: boolean; placement?: string }): React.ReactElement => (
+    <ApplicationProvider mapping={mapping} theme={light}>
+      <Popover
+        visible={props.visible}
+        placement={props.placement}
+        anchor={() => <View testID='anchor' />}
+      >
+        <Text>content</Text>
+      </Popover>
+    </ApplicationProvider>
+  );
+
+  const popoverView = (component: ReturnType<typeof render>) => component.UNSAFE_getByType(PopoverView);
+
+  const contentPosition = (component: ReturnType<typeof render>): { left: number; top: number } => {
+    const style = Object.assign({}, ...[popoverView(component).props.contentContainerStyle].flat(Infinity).filter(Boolean));
+    return { left: style.left, top: style.top };
+  };
+
+  const open = async (
+    anchor: [number, number, number, number],
+    content: [number, number],
+    placement?: string,
+  ): Promise<ReturnType<typeof render>> => {
+    const component = render(<TestPopover visible={false} placement={placement} />);
+    component.rerender(<TestPopover visible={true} placement={placement} />);
+    await waitFor(() => expect(component.getByText('content')).toBeTruthy());
+
+    global.measureCalls.shift()(...anchor);
+    fireEvent(popoverView(component), 'layout', {
+      nativeEvent: { layout: { x: 0, y: 0, width: content[0], height: content[1] } },
+    });
+    global.measureCalls.pop()(-999, -999, ...content);
+    await waitFor(() => expect(contentPosition(component).top).not.toEqual(-999));
+    return component;
+  };
+
+  it('should keep the indicator centred when the content is centred on the anchor', async () => {
+    const component = await open([300, 300, 100, 40], [200, 50]);
+
+    expect(contentPosition(component)).toEqual({ left: 250, top: 340 });
+    expect(popoverView(component).props.indicatorOffset).toEqual(0);
+  });
+
+  it('should move the indicator to the anchor when the content is pushed back on screen', async () => {
+    // Anchor near the right edge: a centred 400 wide content would end at 880, so the placement
+    // falls back to `bottom end` (content right edge on the anchor's right edge, 710) and the
+    // content centre sits 170 points left of the anchor centre.
+    const component = await open([650, 300, 60, 40], [400, 50]);
+
+    expect(contentPosition(component)).toEqual({ left: 310, top: 340 });
+    expect(popoverView(component).props.indicatorOffset).toEqual(170);
+  });
+
+  it('should keep the indicator inside the content', async () => {
+    // A narrow content next to an anchor at the very edge: the anchor centre is beyond the content
+    // edge, so the indicator stops at the edge margin instead.
+    const component = await open([730, 300, 20, 40], [60, 50]);
+
+    expect(contentPosition(component).left).toEqual(690);
+    expect(popoverView(component).props.indicatorOffset).toEqual(16);
+  });
+
+  it('should measure the offset vertically for a side placement', async () => {
+    // Right placement, anchor near the bottom: `right end` keeps the content inside the window,
+    // its centre 140 points above the anchor centre; the indicator stops at the edge margin (136).
+    const component = await open([100, 1300, 60, 20], [100, 300], 'right');
+
+    expect(contentPosition(component)).toEqual({ left: 160, top: 1020 });
+    expect(popoverView(component).props.indicatorOffset).toEqual(136);
+  });
+
+  describe('PopoverView with an indicator offset', () => {
+
+    const renderView = (): ReturnType<typeof render> => render(
+      <ApplicationProvider mapping={mapping} theme={light}>
+        <PopoverView
+          testID='content'
+          layoutDirection={{ direction: 'column', alignment: 'flex-start' }}
+          indicatorOf
```

**File**: `src/components/ui/popover/popoverView.component.tsx` (modified, +35/-4)
```diff
@@ -30,13 +30,26 @@ type AnimatedViewStyle = ViewStyle;
 export interface PopoverViewProps extends ViewProps {
   contentContainerStyle?: StyleProp<AnimatedViewStyle>;
   layoutDirection?: FlexPlacement;
+  /**
+   * Distance, along the axis the content runs across (x for top/bottom placements, y for
+   * left/right), from the centre of the content to where the indicator should point. Set by
+   * `Popover` from the anchor position, so the indicator keeps pointing at the anchor when the
+   * content had to move to stay on screen. Without it the indicator follows the placement
+   * alignment.
+   */
+  indicatorOffset?: number;
   indicator?: (props: ViewProps) => React.ReactElement;
 }
 
 export type PopoverViewElement = React.ReactElement<PopoverViewProps>;
 
 const INDICATOR_OFFSET = 8;
 const INDICATOR_WIDTH = 6;
+/**
+ * How far the indicator may travel from the centre of the content, measured from its edges: the
+ * indicator stays whole inside the content's rounded corners.
+ */
+export const INDICATOR_EDGE_MARGIN = INDICATOR_OFFSET + INDICATOR_WIDTH;
 
 /**
  * Internal view component for Popover that renders the content and indicator.
@@ -48,6 +61,7 @@ const PopoverViewComponent = forwardRef<View, PopoverViewProps>(({
   onLayout,
   indicator,
   layoutDirection,
+  indicatorOffset,
   ...viewProps
 }, ref) => {
   const { style: evaStyle } = useStyled('Popover', {});
@@ -79,7 +93,12 @@ const PopoverViewComponent = forwardRef<View, PopoverViewProps>(({
       };
     }
 
-    const { direction, alignment } = layoutDirection;
+    const { direction } = layoutDirection;
+    const hasIndicatorOffset = indicatorOffset !== undefined;
+    // With an anchor-based offset the indicator starts from the centre and is moved from there.
+    // Only the indicator is centred (`alignSelf`); the container keeps the placement alignment so
+    // the content itself stays where the placement put it.
+    const alignment = hasIndicatorOffset ? 'center' : layoutDirection.alignment;
 
     const isVertical: boolean = direction.startsWith('column');
     const isStart: boolean = alignment.endsWith('start');
@@ -109,8 +128,20 @@ const PopoverViewComponent = forwardRef<View, PopoverViewProps>(({
       ],
     };
 
+    // The offset is applied first, i.e. in the container's coordinates, before the rotations that
+    // orient the indicator itself.
+    // `indicatorOffset` is a physical distance (window coordinates, left to right) and React Native
+    // applies `translateX` physically in right-to-left layouts too, so it is not mirrored there
+    // (checked on iOS and Android with `I18nManager.forceRTL`).
+    const offsetTransform = !hasIndicatorOffset
+      ? []
+      : isVertical
+        ? [{ translateX: indicatorOffset }]
+        : [{ translateY: indicatorOffset }];
+
     const indicatorTransforms: TransformsStyle = {
       transform: [
+        ...offsetTransform,
         { rotate: `${indicatorRotate}deg` },
         { rotate: `${indicatorReverseRotate}deg` },
         // Translate indicator "to start" if we have `-start` alignment
@@ -123,12 +154,12 @@ const PopoverViewComponent = forwardRef<View, PopoverViewProps>(({
     return {
       container: {
         flexDirection: direction,
-        alignItems: alignment,
+        alignItems: layoutDirection.alignment,
       },
       content: contentTransforms,
-      indicator: indicatorTransforms,
+      indicator: hasIndicatorOffset ? [{ alignSelf: 'center' }, indicatorTransforms] : indicatorTransforms,
     };
-  }, [layoutDirection, indicator]);
+  }, [layoutDirection, indicator, indicatorOffset]);
 
   return (
     <View
```

---

### Incident Patch 7: `c9dd4e35` (2026-10-04)
**Commit Message**: fix(popover): keep content clear of the keyboard and follow the anchor (#1919)

* fix(popover): keep content clear of the keyboard, follow anchor

The placement bounds were the whole window, so an Autocomplete near the
bottom of a screen opened its list under the software keyboard. The
keyboard height now shrinks the bounds: a list that does not fit below
the field flips above it, an anchor hidden by the keyboard gets its
content clamped right above the keyboard, and the placement is redone
when the keyboard shows or hides while the popover is open.

Nothing told a popover that its anchor moved while a non-blocking
overlay (Autocomplete) was open, so the list stayed where the field used
to be while the screen scrolled. The anchor is measured once per frame
while such a popover is visible, through a new imperative handle on
MeasureElement; the content follows the anchor and goes off screen while
the anchor is outside the window.

* perf(popover): listen to the keyboard only while open

Every popover subscribed to the keyboard events and re-measured its
anchor on each one, so a screen of closed Selects made hundreds of
native measurements per keyboard show or hide, and the on-demand


**File**: `.changeset/popover-keyboard-anchor-tracking.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Popover` (and `Autocomplete`, `Select`, `Datepicker`, `Tooltip`, `OverflowMenu`) keeps its content out from under the software keyboard: the keyboard height is subtracted from the placement bounds, so a list that would open under the keyboard flips to the other side of the anchor, and the placement is redone when the keyboard appears or hides while the popover is open. A non-blocking popover (`Autocomplete`) now follows its anchor while the screen behind it scrolls, and hides the content while the anchor is out of view.
```

**File**: `src/components/devsupport/components/measure/measure.component.tsx` (modified, +19/-3)
```diff
@@ -91,6 +91,11 @@ export interface MeasureElementProps {
 }
 
 export type MeasuringElement = React.ReactElement;
+
+export interface MeasureElementRef {
+  /** Measures the child now; the result arrives through `onMeasure`. */
+  measure: () => void;
+}
 /**
  * Measures child element size and it's screen position asynchronously.
  * Returns measure result in `onMeasure` callback.
@@ -115,13 +120,13 @@ export type MeasuringElement = React.ReactElement;
  * but `force` property may be used to measure any time it's needed.
  * DON'T USE THIS FLAG IF THE COMPONENT RENDERS FIRST TIME OR YOU KNOW `onLayout` WILL BE CALLED.
  */
-export const MeasureElement: React.FC<MeasureElementProps> = ({
+export const MeasureElement = React.forwardRef<MeasureElementRef, MeasureElementProps>(({
   enabled = true,
   force,
   shouldUseTopInsets = false,
   onMeasure,
   children,
-}): MeasuringElement => {
+}, measureRef): MeasuringElement => {
 
   const ref = React.useRef({} as any);
   // On web, store the actual DOM element from the onLayout event target.
@@ -229,6 +234,15 @@ export const MeasureElement: React.FC<MeasureElementProps> = ({
     }
   });
 
+  // A disabled wrapper measures nothing, on layout or on demand.
+  React.useImperativeHandle(measureRef, () => ({
+    measure: (): void => {
+      if (enabled) {
+        measureSelf();
+      }
+    },
+  }));
+
   // Disabled: keep the ref (and, on web, the DOM node a later forced measurement needs), measure nothing.
   const captureWebDomNode = (event: any): void => {
     const target = event?.nativeEvent?.target;
@@ -242,4 +256,6 @@ export const MeasureElement: React.FC<MeasureElementProps> = ({
   const onLayoutHandler = enabled ? enabledLayoutHandler : disabledLayoutHandler;
 
   return React.cloneElement(children, { ref, onLayout: onLayoutHandler });
-};
+});
+
+MeasureElement.displayName = 'MeasureElement';
```

**File**: `src/components/devsupport/components/measure/type.ts` (modified, +13/-0)
```diff
@@ -90,6 +90,19 @@ export class Frame {
     return this.origin.equals(other.origin) && this.size.equals(other.size);
   }
 
+  /**
+   * Whether the two frames share any area.
+   */
+  public intersects(other: Frame): boolean {
+    if (!other) {
+      return false;
+    }
+    return this.origin.x < other.origin.x + other.size.width
+      && other.origin.x < this.origin.x + this.size.width
+      && this.origin.y < other.origin.y + other.size.height
+      && other.origin.y < this.origin.y + this.size.height;
+  }
+
   /**
    * Creates new frame aligned to left of other
    */
```

**File**: `src/components/devsupport/index.ts` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ export {
 export {
   MeasureElement,
   type MeasureElementProps,
+  type MeasureElementRef,
   type MeasuringElement,
 } from './components/measure/measure.component';
 export {
```

**File**: `src/components/ui/popover/popover.component.tsx` (modified, +111/-1)
```diff
@@ -7,6 +7,9 @@
 
 import React, { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle, memo } from 'react';
 import {
+  Dimensions,
+  Keyboard,
+  KeyboardEvent,
   Platform,
   StyleSheet,
   View,
@@ -17,6 +20,7 @@ import {
 import {
   Frame,
   MeasureElement,
+  MeasureElementRef,
   MeasuringElement,
   Point,
   RenderFCProp,
@@ -74,6 +78,11 @@ export interface UsePopoverMeasurementOptions {
   placement: PopoverPlacement | string;
   fullWidth: boolean;
   visible: boolean;
+  /**
+   * Whether the content blocks the screen behind it. A non-blocking popover leaves the anchor
+   * scrollable, so its frame is tracked while the popover is open.
+   */
+  blocking?: boolean;
   onPlacementChange?: (placement: PopoverPlacement) => void;
 }
 
@@ -83,10 +92,21 @@ export interface UsePopoverMeasurementResult {
   contentPosition: Point;
   contentFlexPosition: StyleProp<ViewStyle>;
   forceMeasure: boolean;
+  /** Attach to the anchor's `MeasureElement` so the hook can re-measure the anchor on demand. */
+  anchorMeasureRef: React.RefObject<MeasureElementRef | null>;
   onChildMeasure: (frame: Frame) => void;
   onContentMeasure: (frame: Frame) => void;
 }
 
+/**
+ * The area the content may occupy: the window minus the software keyboard. Keyboard events report
+ * the keyboard height in the same points as the window, so the bottom edge moves up by that much.
+ */
+const boundsWithKeyboard = (keyboardHeight: number): Frame => {
+  const window = Frame.window();
+  return new Frame(0, 0, window.size.width, Math.max(0, window.size.height - keyboardHeight));
+};
+
 /**
  * Custom hook for popover measurement and placement logic.
  * Can be reused by Tooltip, OverflowMenu, and other popover-based components.
@@ -95,6 +115,7 @@ export function usePopoverMeasurement({
   placement,
   fullWidth,
   visible,
+  blocking = true,
   onPlacementChange,
 }: UsePopoverMeasurementOptions): UsePopoverMeasurementResult {
   // State
@@ -114,6 +135,9 @@ export function usePopoverMeasurement({
   // The last measured content frame, kept so the placement can be redone when the anchor frame
   // arrives after the content was measured, or moves while the popover is open.
   const contentFrameRef = useRef<Frame | null>(null);
+  // Height of the software keyboard, subtracted from the placement bounds (#1919).
+  const keyboardHeightRef = useRef<number>(0);
+  const anchorMeasureRef = useRef<MeasureElementRef | null>(null);
 
   // Keep refs in sync with state
   childFrameRef.current = childFrame;
@@ -174,7 +198,7 @@ export function usePopoverMeasurement({
         width,
         contentFrame.size.height
       );
-      return new PlacementOptions(frame, anchorFrame, Frame.window(), Frame.zero());
+      return new PlacementOptions(frame, anchorFrame, boundsWithKeyboard(keyboardHeightRef.current), Frame.zero());
     },
     [fullWidth]
   );
@@ -183,6 +207,17 @@ export function usePopoverMeasurement({
   const placeContent = useCallback(
     (contentFrame: Frame, anchorFrame: Frame): void => {
       const placementOptions = findPlacementOptions(contentFrame, anchorFrame);
+
+      // An anchor scrolled out of the window has nothing to attach to: keep the content off screen
+      // rather than pinned to the window edge, and bring it back once the anchor returns. An anchor
+      // that is only covered by the keyboard still gets its content, clamped above the keyboard.
+      if (!anchorFrame.intersects(Frame.window())) {
+        if (!Point.outscreen().equals(contentPositionRef.current)) {
+          setContentPosition(Point.outscreen());
+        }
+        return;
+      }
+
       const computedPlacement = placementService.find(preferredPlacement, placementOptions);
 
       // `find` falls back to the preferred placement when nothing fits; keep that frame on screen.
@@ -217,6 +252,73 @@ export function usePopoverMeasurement({
     }
   }, [placeContent]);
 
+  // Places the content again from the frames already measured, e.g. after the bounds changed.
+  const replaceContent = useCallback((): void => {
+    if (visibleRef.current && contentFrameRef.current && !childFrameRef.current.equals(Frame.zero())) {
+      placeContent(contentFrameRef.current, childFrameRef.current);
+    }
+  }, [placeContent]);
+
+  // The keyboard shrinks the area the content may use, so a list that would open under it flips
+  // to the other side of the anchor instead. The anchor is measured again as well: the keyboard
+  // often scrolls or resizes the layout around it. Only an open popover listens: a closed one has
+  // nothing to place, and a screen full of closed Selects would otherwise re-measure every anchor
+  // on each keyboard event. Opening reads the keyboard that is already up.
+  useEffect(() => {
+    if (!visible) {
+      return;
+    }
+    const applyKeyboardHeight = (next: number): void => {
+      if (next === keyboardHeightRef.current) {
+        return;
+      }
+      keyboardHeig
```

**File**: `src/components/ui/popover/popover.keyboard.spec.tsx` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+import React from 'react';
+import { DeviceEventEmitter, Dimensions, Keyboard, Text, View } from 'react-native';
+import {
+  fireEvent,
+  render,
+  waitFor,
+} from '@testing-library/react-native';
+import { light, mapping } from '@ui-kitten/eva';
+import { ApplicationProvider } from '../../theme';
+import { Popover } from './popover.component';
+import { PopoverView } from './popoverView.component';
+
+type MeasureCallback = (x: number, y: number, width: number, height: number) => void;
+
+declare global {
+  // eslint-disable-next-line no-var
+  var measureCalls: MeasureCallback[];
+}
+
+/*
+ * The placement bounds shrink by the software keyboard and a non-blocking popover follows an
+ * anchor that moves while it is open (#1919). The jest window is 750 x 1334.
+ */
+jest.mock('react-native', () => {
+  const ActualReactNative = jest.requireActual('react-native');
+
+  ActualReactNative.UIManager.measureInWindow = (node, callback) => {
+    global.measureCalls.push(callback);
+  };
+  Object.defineProperty(ActualReactNative, 'findNodeHandle', { value: () => 1 });
+
+  return ActualReactNative;
+});
+
+describe('@popover: keyboard and anchor tracking', () => {
+
+  beforeEach(() => {
+    global.measureCalls = [];
+  });
+
+  afterEach(() => {
+    DeviceEventEmitter.emit('keyboardDidHide', {});
+  });
+
+  const TestPopover = (props: { visible: boolean; blocking?: boolean }): React.ReactElement => (
+    <ApplicationProvider mapping={mapping} theme={light}>
+      <Popover
+        visible={props.visible}
+        blocking={props.blocking}
+        anchor={() => <View testID='anchor' />}
+      >
+        <Text>content</Text>
+      </Popover>
+    </ApplicationProvider>
+  );
+
+  const contentPosition = (component: ReturnType<typeof render>): { left: number; top: number } => {
+    const view = component.UNSAFE_getByType(PopoverView);
+    const style = Object.assign({}, ...[view.props.contentContainerStyle].flat(Infinity).filter(Boolean));
+    return { left: style.left, top: style.top };
+  };
+
+  // Opens the popover with a 200 x 40 anchor at (10, 900) and a 100 x 300 content.
+  const open = async (blocking?: boolean): Promise<ReturnType<typeof render>> => {
+    const component = render(<TestPopover visible={false} blocking={blocking} />);
+    component.rerender(<TestPopover visible={true} blocking={blocking} />);
+    await waitFor(() => expect(component.getByText('content')).toBeTruthy());
+
+    // Every queued call so far measures the anchor (the forced one, plus one per frame while a
+    // non-blocking popover tracks it); the content's own call is queued by its layout event.
+    global.measureCalls.shift()(10, 900, 200, 40);
+    fireEvent(component.UNSAFE_getByType(PopoverView), 'layout', {
+      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 300 } },
+    });
+    global.measureCalls.pop()(-999, -999, 100, 300);
+    // Below the anchor, centered: (10 + (200 - 100) / 2, 900 + 40).
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: 60, top: 940 }));
+    return component;
+  };
+
+  it('should flip above the anchor when the keyboard covers the space below', async () => {
+    const component = await open();
+
+    // 940 + 300 no longer fits above the keyboard (1334 - 300 = 1034): the content flips on top.
+    DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 1034, screenX: 0, width: 750 } });
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: 60, top: 600 }));
+
+    DeviceEventEmitter.emit('keyboardDidHide', {});
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: 60, top: 940 }));
+  });
+
+  it('should keep the content above the keyboard when the anchor is covered by it', async () => {
+    const component = await open();
+
+    // The anchor moves under a 300 point keyboard (window bottom is 1334): no placement fits, so
+    // the preferred one is clamped to the bounds, right above the keyboard.
+    DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 1034, screenX: 0, width: 750 } });
+    fireEvent(component.getByTestId('anchor'), 'layout', {
+      nativeEvent: { layout: { x: 10, y: 1200, width: 200, height: 40 } },
+    });
+    global.measureCalls.pop()(10, 1200, 200, 40);
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: 60, top: 734 }));
+  });
+
+  it('should measure the anchor again when the keyboard changes', async () => {
+    await open();
+    global.measureCalls.length = 0;
+
+    DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300, screenY: 1034, screenX: 0, width: 750 } });
+
+    expect(global.measureCalls.length).toBeGreaterThan(0);
+  });
+
+  it('should not track the anchor of a blocking popover', async () => {
+    await open(true);
+    global.measureCalls.length = 0;
+
+    await new Promise((resolve) => setTimeout(resolve, 50));
+
+    e
```

---

### Incident Patch 8: `ff7c7013` (2026-10-04)
**Commit Message**: fix(falsy-text): render a 0 label (#1933)

* fix(falsy-text): render a 0 label

* docs(changeset): warn about number && text props rendering 0

**File**: `.changeset/falsy-text-zero.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@ui-kitten/components": patch
+---
+
+A numeric `0` label or title now renders as "0" instead of nothing. `FalsyText` (used for the labels, captions and titles of `Button`, `CheckBox`, `Radio`, `Toggle`, `Input`, `ListItem` and others) rendered nothing for any falsy value; it now skips only `null`, `undefined`, `false` and an empty string.
+
+Apps that hide a text prop with a number and `&&` now show a stray "0": `` description={count && `${count} items`} `` renders "0" when `count` is 0, as React itself does for `{0 && ...}`. Use `count > 0 && ...` instead.
```

**File**: `src/components/devsupport/components/falsyText/falsyText.component.tsx` (modified, +4/-2)
```diff
@@ -21,7 +21,8 @@ export interface FalsyTextProps extends Omit<TextProps, 'children'> {
  * Helper component for optional text properties.
  *
  * Accepts same props as Text component,
- * and `component` which may be a string, a function, null or undefined.
+ * and `component` which may be a string, a number, a function, null or undefined.
+ * `null`, `undefined`, `false` and an empty string render nothing; `0` renders as text.
  *
  * If it is null or undefined, will render nothing.
  * If it is a function, will call it with props passed to this component.
@@ -80,7 +81,8 @@ export class FalsyText extends React.Component<FalsyTextProps> {
   public render(): React.ReactElement {
     const { component, ...textProps } = this.props;
 
-    if (!component) {
+    // `0` is a label (a counter, a price); only an absent or empty value renders nothing.
+    if (component === undefined || component === null || component === '' || (component as unknown) === false) {
       return null;
     }
 
```

**File**: `src/components/devsupport/components/falsyText/falsyText.spec.tsx` (modified, +10/-0)
```diff
@@ -21,6 +21,16 @@ describe('@falsy-text: component checks', () => {
     expect(component.toJSON()).toBeNull();
   });
 
+  it.each([null, undefined, '', false])('should render nothing for %p', (value) => {
+    const component = render(wrap(<FalsyText component={value as unknown as string} />));
+    expect(component.toJSON()).toBeNull();
+  });
+
+  it('should render 0 as text', () => {
+    const component = render(wrap(<FalsyText component={0} />));
+    expect(component.getByText('0')).toBeTruthy();
+  });
+
   it('should render a plain RN Text when the parent supplies a complete text style', () => {
     const component = render(wrap(
       <FalsyText
```

**File**: `src/components/ui/button/emptyLabel.spec.tsx` (modified, +6/-0)
```diff
@@ -53,4 +53,10 @@ describe('@controls: empty label', () => {
 
     expect(component.getByText('Label')).toBeTruthy();
   });
+
+  it.each(cases)('%s should render a 0 label as text', (_name, element) => {
+    const component = render(<Provider>{React.cloneElement(element, {}, 0)}</Provider>);
+
+    expect(component.getByText('0')).toBeTruthy();
+  });
 });
```

---

### Incident Patch 9: `6e656a9c` (2026-10-04)
**Commit Message**: fix(popover): place content once the anchor is measured (#1914)

* fix(popover): place content once anchor is measured

* perf(popover): measure the anchor only once the popover was shown

The anchor stays wrapped in MeasureElement from the first render so the
tree keeps its shape, but a closed popover measured it on every layout,
undoing the lazy mount from 118f94aa. MeasureElement gains `enabled`;
Popover enables it on the first show, where the forced measurement
supplies the anchor frame and the content waits off screen until then.

**File**: `.changeset/popover-first-open-placement.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Popover` (and `Select`, `Datepicker`, `Tooltip`, `OverflowMenu`) no longer draws its content at the window origin for a frame on the first open (#1910). The anchor keeps the same place in the element tree from the start, so opening the popover no longer remounts it (an `Autocomplete` field no longer loses focus on the first tap); a closed popover still measures nothing. The content stays off screen until the anchor frame is known and follows the anchor when its frame changes while open.
```

**File**: `src/components/devsupport/components/measure/measure.component.tsx` (modified, +20/-2)
```diff
@@ -74,6 +74,13 @@ const needsStatusBarOffset = (): boolean => {
 };
 
 export interface MeasureElementProps {
+  /**
+   * Whether the element is measured on layout. When `false` the child keeps its place in the tree
+   * and its ref, but nothing is measured (on web the DOM node is still captured for a later forced
+   * measurement). Lets a caller keep the tree shape stable while measuring only when needed.
+   * Defaults to `true`.
+   */
+  enabled?: boolean;
   force?: boolean;
   shouldUseTopInsets?: boolean;
   onMeasure: (frame: Frame) => void;
@@ -109,6 +116,7 @@ export type MeasuringElement = React.ReactElement;
  * DON'T USE THIS FLAG IF THE COMPONENT RENDERS FIRST TIME OR YOU KNOW `onLayout` WILL BE CALLED.
  */
 export const MeasureElement: React.FC<MeasureElementProps> = ({
+  enabled = true,
   force,
   shouldUseTopInsets = false,
   onMeasure,
@@ -216,12 +224,22 @@ export const MeasureElement: React.FC<MeasureElementProps> = ({
   // Use useLayoutEffect to measure synchronously after render when force is true
   // This avoids "Cannot update during an existing state transition" warning
   React.useLayoutEffect(() => {
-    if (force) {
+    if (enabled && force) {
       measureSelf();
     }
   });
 
-  const onLayoutHandler = Platform.OS === 'web' ? handleLayoutWeb : measureSelf;
+  // Disabled: keep the ref (and, on web, the DOM node a later forced measurement needs), measure nothing.
+  const captureWebDomNode = (event: any): void => {
+    const target = event?.nativeEvent?.target;
+    if (target instanceof HTMLElement) {
+      webDomNodeRef.current = target;
+    }
+  };
+
+  const disabledLayoutHandler = Platform.OS === 'web' ? captureWebDomNode : undefined;
+  const enabledLayoutHandler = Platform.OS === 'web' ? handleLayoutWeb : measureSelf;
+  const onLayoutHandler = enabled ? enabledLayoutHandler : disabledLayoutHandler;
 
   return React.cloneElement(children, { ref, onLayout: onLayoutHandler });
 };
```

**File**: `src/components/ui/popover/popover.component.tsx` (modified, +69/-42)
```diff
@@ -110,11 +110,16 @@ export function usePopoverMeasurement({
   const childFrameRef = useRef<Frame>(childFrame);
   const contentPositionRef = useRef<Point>(contentPosition);
   const actualPlacementRef = useRef<PopoverPlacement>(actualPlacement);
+  const visibleRef = useRef<boolean>(visible);
+  // The last measured content frame, kept so the placement can be redone when the anchor frame
+  // arrives after the content was measured, or moves while the popover is open.
+  const contentFrameRef = useRef<Frame | null>(null);
 
   // Keep refs in sync with state
   childFrameRef.current = childFrame;
   contentPositionRef.current = contentPosition;
   actualPlacementRef.current = actualPlacement;
+  visibleRef.current = visible;
 
   // Service instance - stable across renders
   const placementService = useRef(new PopoverPlacementService()).current;
@@ -134,8 +139,11 @@ export function usePopoverMeasurement({
 
   // When becoming invisible, reset position to offscreen
   useEffect(() => {
-    if (!visible && !Point.outscreen().equals(contentPositionRef.current)) {
-      setContentPosition(Point.outscreen());
+    if (!visible) {
+      contentFrameRef.current = null;
+      if (!Point.outscreen().equals(contentPositionRef.current)) {
+        setContentPosition(Point.outscreen());
+      }
     }
   }, [visible]);
 
@@ -156,13 +164,6 @@ export function usePopoverMeasurement({
     return { left, top, maxWidth: windowWidth };
   }, [contentPosition, windowWidth]);
 
-  // Callback when anchor element is measured
-  const onChildMeasure = useCallback((frame: Frame): void => {
-    if (!frame.equals(childFrameRef.current)) {
-      setChildFrame(frame);
-    }
-  }, []);
-
   // Helper to calculate placement options
   const findPlacementOptions = useCallback(
     (contentFrame: Frame, anchorFrame: Frame): PlacementOptions => {
@@ -178,10 +179,10 @@ export function usePopoverMeasurement({
     [fullWidth]
   );
 
-  // Callback when popover content is measured
-  const onContentMeasure = useCallback(
-    (anchorFrame: Frame): void => {
-      const placementOptions = findPlacementOptions(anchorFrame, childFrameRef.current);
+  // Places the content next to the anchor from the two measured frames.
+  const placeContent = useCallback(
+    (contentFrame: Frame, anchorFrame: Frame): void => {
+      const placementOptions = findPlacementOptions(contentFrame, anchorFrame);
       const computedPlacement = placementService.find(preferredPlacement, placementOptions);
 
       // `find` falls back to the preferred placement when nothing fits; keep that frame on screen.
@@ -201,6 +202,36 @@ export function usePopoverMeasurement({
     [findPlacementOptions, placementService, preferredPlacement]
   );
 
+  // Callback when anchor element is measured
+  const onChildMeasure = useCallback((frame: Frame): void => {
+    if (frame.equals(childFrameRef.current)) {
+      return;
+    }
+    childFrameRef.current = frame;
+    setChildFrame(frame);
+    // The content may have been measured before the anchor (the first open races the two
+    // measurements, #1910), or the anchor may move while the popover is open: place it again
+    // against the frame that just arrived.
+    if (visibleRef.current && contentFrameRef.current) {
+      placeContent(contentFrameRef.current, frame);
+    }
+  }, [placeContent]);
+
+  // Callback when popover content is measured
+  const onContentMeasure = useCallback(
+    (contentFrame: Frame): void => {
+      contentFrameRef.current = contentFrame;
+      // Until the anchor has been measured there is nothing to place the content against; it
+      // stays off screen instead of being drawn at the window origin and jumping into place once
+      // the anchor frame arrives (#1910).
+      if (childFrameRef.current.equals(Frame.zero())) {
+        return;
+      }
+      placeContent(contentFrame, childFrameRef.current);
+    },
+    [placeContent]
+  );
+
   return {
     childFrame,
     actualPlacement,
@@ -260,7 +291,8 @@ export function usePopoverMeasurement({
  * supportedOrientations -
  * Allows the modal to be rotated to any of the specified orientations.
  * On iOS, the modal is still restricted by what's specified
- * in your app's Info.plist's UISupportedInterfaceOrientations field
+ * in your app's Info.plist's UISupportedInterfaceOrientations field.
+ * Defaults to every orientation, so the popover follows the app.
  *
  * @property {StyleProp<ViewStyle>} backdropStyle - Style of backdrop.
  *
@@ -319,8 +351,11 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
     onPlacementChange,
   });
 
-  // Measurement and modal machinery are mounted the first time the popover becomes visible;
-  // until then a closed popover costs exactly its anchor.
+  // The modal machinery is mounted the first time the popover becomes visible. The anchor stays
+  // wrapped in `MeasureElement` from the start so the element tree keeps its shape (moving the
+  // anchor into the w
```

**File**: `src/components/ui/popover/popover.firstOpen.spec.tsx` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+import React from 'react';
+import { Modal as RNModal, Text, View } from 'react-native';
+import {
+  fireEvent,
+  render,
+  waitFor,
+} from '@testing-library/react-native';
+import { light, mapping } from '@ui-kitten/eva';
+import { ApplicationProvider } from '../../theme';
+import { MeasureElement } from '../../devsupport';
+import { Popover } from './popover.component';
+import { PopoverView } from './popoverView.component';
+
+type MeasureCallback = (x: number, y: number, width: number, height: number) => void;
+
+declare global {
+  // eslint-disable-next-line no-var
+  var measureCalls: MeasureCallback[];
+}
+
+/*
+ * Every `measureInWindow` call is queued so that a test decides in which order the anchor and
+ * the content are measured (#1910).
+ */
+jest.mock('react-native', () => {
+  const ActualReactNative = jest.requireActual('react-native');
+
+  ActualReactNative.UIManager.measureInWindow = (node, callback) => {
+    global.measureCalls.push(callback);
+  };
+  // The test renderer has no native tags; any truthy handle lets `MeasureElement` reach the mock.
+  // (`react-native` exposes its exports through getters, hence `defineProperty`.)
+  Object.defineProperty(ActualReactNative, 'findNodeHandle', { value: () => 1 });
+
+  return ActualReactNative;
+});
+
+describe('@popover: first open', () => {
+
+  beforeEach(() => {
+    global.measureCalls = [];
+  });
+
+  const mounts: string[] = [];
+
+  // The anchor is a host view (so that `MeasureElement` can attach its ref) with a child that
+  // records its mounts.
+  const MountProbe = (): null => {
+    React.useEffect(() => {
+      mounts.push('anchor');
+    }, []);
+    return null;
+  };
+
+  const TestPopover = (props: { visible: boolean }): React.ReactElement => (
+    <ApplicationProvider mapping={mapping} theme={light}>
+      <Popover
+        visible={props.visible}
+        anchor={() => (
+          <View testID='anchor'>
+            <MountProbe />
+          </View>
+        )}
+      >
+        <Text>content</Text>
+      </Popover>
+    </ApplicationProvider>
+  );
+
+  const contentPosition = (component: ReturnType<typeof render>): { left: number; top: number } => {
+    const view = component.UNSAFE_getByType(PopoverView);
+    const style = Object.assign({}, ...[view.props.contentContainerStyle].flat(Infinity).filter(Boolean));
+    return { left: style.left, top: style.top };
+  };
+
+  it('should measure the anchor before the popover has ever been visible', () => {
+    const component = render(<TestPopover visible={false} />);
+
+    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toEqual(1);
+    expect(component.UNSAFE_queryAllByType(RNModal).length).toEqual(0);
+  });
+
+  it('should not remount the anchor on the first open', async () => {
+    mounts.length = 0;
+    const component = render(<TestPopover visible={false} />);
+    expect(mounts).toEqual(['anchor']);
+
+    component.rerender(<TestPopover visible={true} />);
+    await waitFor(() => expect(component.getByText('content')).toBeTruthy());
+
+    expect(mounts).toEqual(['anchor']);
+    expect(component.getByTestId('anchor')).toBeTruthy();
+  });
+
+  it('should keep the content off screen until the anchor is measured, then place it', async () => {
+    const component = render(<TestPopover visible={false} />);
+    component.rerender(<TestPopover visible={true} />);
+    await waitFor(() => expect(component.getByText('content')).toBeTruthy());
+
+    // The forced anchor measurement is queued first; the content is measured from its layout.
+    const anchorMeasure = global.measureCalls.shift();
+    expect(anchorMeasure).toBeDefined();
+
+    fireEvent(component.UNSAFE_getByType(PopoverView), 'layout', {
+      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 50 } },
+    });
+    const contentMeasure = global.measureCalls.shift();
+    expect(contentMeasure).toBeDefined();
+
+    // Content measured while the anchor frame is still unknown: nothing to place it against.
+    contentMeasure(-999, -999, 100, 50);
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: -999, top: -999 }));
+
+    // The anchor frame arrives afterwards: the content is placed below it, centered.
+    anchorMeasure(10, 300, 200, 40);
+    await waitFor(() => expect(contentPosition(component)).toEqual({ left: 60, top: 340 }));
+  });
+
+  it('should follow the anchor when its frame changes while open', async () => {
+    const component = render(<TestPopover visible={false} />);
+    component.rerender(<TestPopover visible={true} />);
+    await waitFor(() => expect(component.getByText('content')).toBeTruthy());
+
+    const anchorMeasure = global.measureCalls.shift();
+    anchorMeasure(10, 300, 200, 40);
+    fireEvent(component.UNSAFE_getByType(PopoverView), 'layout', {
+      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 50 } },
+    });
+    global.measureCalls.shift()(-999, -999, 100, 50);
+    awa
```

**File**: `src/components/ui/popover/popover.lazy.spec.tsx` (modified, +50/-7)
```diff
@@ -1,14 +1,33 @@
 import React from 'react';
 import { Modal as RNModal, Text, View } from 'react-native';
-import { render, waitFor } from '@testing-library/react-native';
+import { fireEvent, render, waitFor } from '@testing-library/react-native';
 import { light, mapping } from '@ui-kitten/eva';
 import { ApplicationProvider } from '../../theme';
 import { MeasureElement } from '../../devsupport';
 import { Popover } from './popover.component';
+import { Modal } from '../modal/modal.component';
+
+declare global {
+  // eslint-disable-next-line no-var
+  var anchorMeasureCount: number;
+}
+
+// Count `measureInWindow` calls; the test renderer has no native tags, so any truthy handle lets
+// `MeasureElement` reach the mock (`react-native` exposes its exports through getters).
+jest.mock('react-native', () => {
+  const ActualReactNative = jest.requireActual('react-native');
+  ActualReactNative.UIManager.measureInWindow = (): void => {
+    global.anchorMeasureCount += 1;
+  };
+  Object.defineProperty(ActualReactNative, 'findNodeHandle', { value: () => 1 });
+  return ActualReactNative;
+});
 
 /*
- * A popover that has never been visible renders only its anchor. Once shown it mounts the
- * measurement and modal machinery and keeps it mounted after hiding, so re-opening stays cheap.
+ * A popover that has never been visible renders its anchor inside an idle measurement wrapper:
+ * the tree already has its final shape (the anchor is not remounted on the first open) but nothing
+ * is measured. Once shown it measures the anchor, mounts the modal machinery and keeps it mounted
+ * after hiding, so re-opening stays cheap.
  */
 describe('@popover: lazy overlay', () => {
 
@@ -23,11 +42,11 @@ describe('@popover: lazy overlay', () => {
     </ApplicationProvider>
   );
 
-  it('should render only the anchor while it has never been visible', () => {
+  it('should render only the measured anchor while it has never been visible', () => {
     const component = render(<TestPopover visible={false} />);
 
     expect(component.getByTestId('anchor')).toBeTruthy();
-    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toEqual(0);
+    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toEqual(1);
     expect(component.UNSAFE_queryAllByType(RNModal).length).toEqual(0);
     expect(component.queryByText('content')).toBeNull();
   });
@@ -37,7 +56,7 @@ describe('@popover: lazy overlay', () => {
     component.rerender(<TestPopover visible={true} />);
 
     await waitFor(() => expect(component.getByText('content')).toBeTruthy());
-    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toBeGreaterThan(0);
+    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toBeGreaterThan(1);
     expect(component.getByTestId('anchor')).toBeTruthy();
   });
 
@@ -48,6 +67,30 @@ describe('@popover: lazy overlay', () => {
     component.rerender(<TestPopover visible={false} />);
 
     expect(component.queryByText('content')).toBeNull();
-    expect(component.UNSAFE_queryAllByType(MeasureElement).length).toBeGreaterThan(0);
+    expect(component.UNSAFE_queryAllByType(Modal).length).toEqual(1);
+  });
+
+  it('should not measure the anchor while it has never been visible', () => {
+    global.anchorMeasureCount = 0;
+
+    const component = render(<TestPopover visible={false} />);
+    fireEvent(component.getByTestId('anchor'), 'layout', {
+      nativeEvent: { layout: { x: 0, y: 0, width: 100, height: 40 } },
+    });
+
+    expect(component.getByTestId('anchor').props.onLayout).toBeUndefined();
+    expect(global.anchorMeasureCount).toEqual(0);
+  });
+
+  it('should measure the anchor on the first open without remounting it', async () => {
+    global.anchorMeasureCount = 0;
+
+    const component = render(<TestPopover visible={false} />);
+    const anchorBefore = component.getByTestId('anchor');
+    component.rerender(<TestPopover visible={true} />);
+
+    await waitFor(() => expect(global.anchorMeasureCount).toBeGreaterThan(0));
+    expect(component.getByTestId('anchor')).toBe(anchorBefore);
+    expect(component.getByTestId('anchor').props.onLayout).toEqual(expect.any(Function));
   });
 });
```

---

### Incident Patch 10: `ce75d36b` (2026-10-04)
**Commit Message**: fix(controls): render nothing for an empty label (#1917)

**File**: `.changeset/empty-label-text-node.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Button`, `CheckBox`, `Radio` and `Toggle` render nothing for an empty string label instead of an empty text node inside their `View` (#1913), which react-native-web reported as "Unexpected text node".
```

**File**: `src/components/ui/button/button.component.tsx` (modified, +4/-6)
```diff
@@ -253,12 +253,10 @@ const ButtonComponent = React.forwardRef<TouchableWeb, ButtonProps>(
             component={accessoryLeft}
           />
         )}
-        {children && (
-          <FalsyText
-            style={componentStyle.text}
-            component={children}
-          />
-        )}
+        <FalsyText
+          style={componentStyle.text}
+          component={children}
+        />
         {accessoryRight && (
           <FalsyFC
             style={componentStyle.icon}
```

**File**: `src/components/ui/button/emptyLabel.spec.tsx` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import React from 'react';
+import { render } from '@testing-library/react-native';
+import { light, mapping } from '@ui-kitten/eva';
+import { ApplicationProvider } from '../../theme';
+import { Button } from './button.component';
+import { CheckBox } from '../checkbox/checkbox.component';
+import { Radio } from '../radio/radio.component';
+import { Toggle } from '../toggle/toggle.component';
+
+/*
+ * `'' && <Label />` evaluates to `''`, and React renders that empty string as a text node inside
+ * the control's `View` ("Unexpected text node" on react-native-web, #1913). An empty label has to
+ * render nothing, like `null` or `undefined`.
+ */
+describe('@controls: empty label', () => {
+
+  type Json = ReturnType<ReturnType<typeof render>['toJSON']>;
+
+  const collectStrings = (node: Json | Json[] | string | null): string[] => {
+    if (node === null || node === undefined) {
+      return [];
+    }
+    if (typeof node === 'string') {
+      return [node];
+    }
+    if (Array.isArray(node)) {
+      return node.flatMap(collectStrings);
+    }
+    return collectStrings((node.children ?? []) as Json[]);
+  };
+
+  const Provider = ({ children }: { children: React.ReactElement }): React.ReactElement => (
+    <ApplicationProvider mapping={mapping} theme={light}>
+      {children}
+    </ApplicationProvider>
+  );
+
+  const cases: Array<[string, React.ReactElement]> = [
+    ['Button', <Button key='button'>{''}</Button>],
+    ['CheckBox', <CheckBox key='checkbox'>{''}</CheckBox>],
+    ['Radio', <Radio key='radio'>{''}</Radio>],
+    ['Toggle', <Toggle key='toggle'>{''}</Toggle>],
+  ];
+
+  it.each(cases)('%s should render no text node for an empty string label', (_name, element) => {
+    const component = render(<Provider>{element}</Provider>);
+
+    expect(collectStrings(component.toJSON())).toEqual([]);
+  });
+
+  it.each(cases)('%s should still render a non-empty label', (_name, element) => {
+    const component = render(<Provider>{React.cloneElement(element, {}, 'Label')}</Provider>);
+
+    expect(component.getByText('Label')).toBeTruthy();
+  });
+});
```

**File**: `src/components/ui/checkbox/checkbox.component.tsx` (modified, +4/-6)
```diff
@@ -238,12 +238,10 @@ const CheckBoxComponent: React.FC<CheckBoxProps> = (props): TouchableWebElement
           </Animated.View>
         </View>
       </Animated.View>
-      {children && (
-        <FalsyText
-          style={componentStyle.text}
-          component={children}
-        />
-      )}
+      <FalsyText
+        style={componentStyle.text}
+        component={children}
+      />
     </TouchableWeb>
   );
 };
```

**File**: `src/components/ui/radio/radio.component.tsx` (modified, +4/-6)
```diff
@@ -218,12 +218,10 @@ const RadioComponent: React.FC<RadioProps> = (props): TouchableWebElement => {
           />
         </View>
       </Animated.View>
-      {children && (
-        <FalsyText
-          style={componentStyle.text}
-          component={children}
-        />
-      )}
+      <FalsyText
+        style={componentStyle.text}
+        component={children}
+      />
     </TouchableWeb>
   );
 };
```

**File**: `src/components/ui/toggle/toggle.component.tsx` (modified, +4/-3)
```diff
@@ -295,9 +295,10 @@ const ToggleComponent: React.FC<ToggleProps> = (props): React.ReactElement<ViewP
           </View>
       </TouchableWeb>
 
-      {children && (
-        <FalsyText style={componentStyle.text} component={children} />
-      )}
+      <FalsyText
+        style={componentStyle.text}
+        component={children}
+      />
     </View>
   );
 };
```

---

### Incident Patch 11: `4c78a53a` (2026-10-04)
**Commit Message**: fix(modal): allow every orientation by default (#1915)

**File**: `.changeset/modal-supported-orientations.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Modal` and `Popover` (so also `Select`, `Datepicker`, `RangeDatepicker`, `OverflowMenu`, `Tooltip`) allow every orientation by default (#1911). React Native's `Modal` supports portrait only when `supportedOrientations` is omitted, so a popover opened while the device was in landscape came up rotated. iOS still restricts the modal to the orientations in the app's `Info.plist`.
```

**File**: `src/components/ui/modal/modal.component.tsx` (modified, +17/-2)
```diff
@@ -68,6 +68,20 @@ export interface ModalProps extends ViewProps, BackdropPresentingConfig, RNModal
 
 export type ModalElement = React.ReactElement<ModalProps>;
 
+/**
+ * React Native's `Modal` presents in portrait only when `supportedOrientations` is omitted (its
+ * native default), so a popover opened on an iPad held in landscape came up rotated (#1911).
+ * Every orientation is allowed by default; iOS still intersects this with the app's
+ * `UISupportedInterfaceOrientations`, so the modal follows whatever the app itself allows.
+ */
+const ALL_ORIENTATIONS: ReactNativeModalProps['supportedOrientations'] = [
+  'portrait',
+  'portrait-upside-down',
+  'landscape',
+  'landscape-left',
+  'landscape-right',
+];
+
 /**
  * A wrapper that presents content above an enclosing view.
  *
@@ -101,7 +115,8 @@ export type ModalElement = React.ReactElement<ModalProps>;
  * supportedOrientations -
  * Allows the modal to be rotated to any of the specified orientations.
  * On iOS, the modal is still restricted by what's specified
- * in your app's Info.plist's UISupportedInterfaceOrientations field
+ * in your app's Info.plist's UISupportedInterfaceOrientations field.
+ * Defaults to every orientation, so the modal follows the app.
  *
  * @property {() => void} onBackdropPress - Called when the modal is visible and the view below it was touched.
  * Useful when needed to close the modal on outside touches.
@@ -144,7 +159,7 @@ const ModalComponent: React.FC<ModalProps> = ({
   onBackdropPress,
   animationType,
   hardwareAccelerated,
-  supportedOrientations,
+  supportedOrientations = ALL_ORIENTATIONS,
   onShow,
   ...viewProps
 }) => {
```

**File**: `src/components/ui/modal/modal.spec.tsx` (modified, +28/-0)
```diff
@@ -347,6 +347,34 @@ describe('@modal: panel checks', () => {
     expect(hasAncestorOfType(modal, ScrollView)).toBe(false);
   });
 
+  it('should allow every orientation unless supportedOrientations is given', () => {
+    const component = render(
+      <Provider>
+        <Modal visible={true}>
+          <Text>content</Text>
+        </Modal>
+      </Provider>,
+    );
+
+    expect(component.UNSAFE_getByType(RNModal).props.supportedOrientations).toEqual([
+      'portrait',
+      'portrait-upside-down',
+      'landscape',
+      'landscape-left',
+      'landscape-right',
+    ]);
+
+    component.rerender(
+      <Provider>
+        <Modal visible={true} supportedOrientations={['portrait']}>
+          <Text>content</Text>
+        </Modal>
+      </Provider>,
+    );
+
+    expect(component.UNSAFE_getByType(RNModal).props.supportedOrientations).toEqual(['portrait']);
+  });
+
   it('should render inline without ApplicationProvider and warn once', () => {
     const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
 
```

---

### Incident Patch 12: `a8db98a4` (2026-10-04)
**Commit Message**: fix(theme): keep font weights with the System family on Android (#1930)

* fix(theme): keep font weights with the System family on Android

React Native Android treats any fontFamily as a custom family and rounds
fontWeight to regular or bold, so 500/600 text with the default System
family rendered regular. Resolve System to no family on Android so the
platform font keeps the numeric weight; iOS and custom families are
unchanged.

* refactor(theme): move the System font rule to its own module

resolvePlatformFontFamily takes the platform as a parameter, so its
spec covers Android and iOS without redefining Platform.OS for the
whole suite. StyleService.createThemedEntry calls it.

**File**: `.changeset/android-system-font-weight.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+On Android, text with the default `System` font family now keeps its exact `fontWeight`. React Native Android treats any `fontFamily` as a custom family and rounds the weight to regular or bold, so `500` / `600` text (subtitles, labels, radio and checkbox text, avatar initials) rendered regular. Styles resolved from the theme now leave the family unset when it is `System` on Android; iOS and custom families are unchanged.
```

**File**: `src/components/devsupport/components/falsyText/falsyText.component.tsx` (modified, +3/-1)
```diff
@@ -67,8 +67,10 @@ const hasCompleteTextStyle = (props: TextProps): boolean => {
   }
   const style: TextStyle = StyleSheet.flatten(props.style) || {};
 
+  // `fontFamily` may be present with `undefined`: the mapping resolves `System` to no family on
+  // Android (see `resolvePlatformFontFamily`), which still means the style set it.
   return style.color !== undefined
-    && style.fontFamily !== undefined
+    && 'fontFamily' in style
     && style.fontSize !== undefined
     && style.fontWeight !== undefined;
 };
```

**File**: `src/components/theme/style/platformFontFamily.spec.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { resolvePlatformFontFamily } from './platformFontFamily';
+
+describe('@platform-font-family: resolvePlatformFontFamily', () => {
+
+  it('should drop the System family on Android for font family keys', () => {
+    expect(resolvePlatformFontFamily('fontFamily', 'System', 'android')).toBeUndefined();
+    expect(resolvePlatformFontFamily('textFontFamily', 'System', 'android')).toBeUndefined();
+    expect(resolvePlatformFontFamily('titleFontfamily', 'System', 'android')).toBeUndefined();
+  });
+
+  it('should keep the System family on iOS and web', () => {
+    expect(resolvePlatformFontFamily('fontFamily', 'System', 'ios')).toEqual('System');
+    expect(resolvePlatformFontFamily('textFontFamily', 'System', 'web')).toEqual('System');
+  });
+
+  it('should keep a custom family on Android', () => {
+    expect(resolvePlatformFontFamily('fontFamily', 'Roboto-Medium', 'android')).toEqual('Roboto-Medium');
+  });
+
+  it('should keep System under a key that is not a font family', () => {
+    expect(resolvePlatformFontFamily('accessibilityLabel', 'System', 'android')).toEqual('System');
+    expect(resolvePlatformFontFamily('fontWeight', 'System', 'android')).toEqual('System');
+  });
+
+  it('should keep non-string values', () => {
+    expect(resolvePlatformFontFamily('fontFamily', undefined, 'android')).toBeUndefined();
+    expect(resolvePlatformFontFamily('fontFamily', 16, 'android')).toEqual(16);
+  });
+});
```

**File**: `src/components/theme/style/platformFontFamily.ts` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+/**
+ * @license
+ * Copyright Akveo. All Rights Reserved.
+ * Copyright (c) 2024-2026 Vlad Bataev and UI Kitten Contributors.
+ * Licensed under the MIT License. See License.txt in the project root for license information.
+ */
+
+import {
+  Platform,
+  PlatformOSType,
+} from 'react-native';
+
+const FONT_FAMILY_KEY = /fontFamily$/i;
+const SYSTEM_FONT_FAMILY = 'System';
+
+/**
+ * Resolves a themed style value for the current platform's font handling.
+ *
+ * `System` names the platform font. iOS resolves it as such, but React Native Android treats any
+ * `fontFamily` as a custom family: it rounds `fontWeight` to normal or bold (the asset lookup only
+ * knows `_bold` files) and falls back to the default typeface, so 500 and 600 render as 400.
+ * Without a `fontFamily` Android keeps the numeric weight on the default typeface.
+ *
+ * So on Android a `System` value of a `*fontFamily` key resolves to `undefined`. Callers keep the key
+ * (with `undefined`) so a flattened style still reports that the mapping set a font family; see
+ * `FalsyText`. Every other value, key and platform passes through unchanged.
+ */
+export const resolvePlatformFontFamily = (
+  key: string,
+  value: unknown,
+  os: PlatformOSType = Platform.OS,
+): unknown => {
+  if (os === 'android' && value === SYSTEM_FONT_FAMILY && FONT_FAMILY_KEY.test(key)) {
+    return undefined;
+  }
+  return value;
+};
```

**File**: `src/components/theme/style/style.service.tsx` (modified, +2/-1)
```diff
@@ -12,6 +12,7 @@ import {
   ThemeType,
   useTheme,
 } from '../theme/theme.service';
+import { resolvePlatformFontFamily } from './platformFontFamily';
 
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 export type StyleType = Record<string, any>;
@@ -108,7 +109,7 @@ export class StyleService {
     const themed: StyleType = {};
     for (const key in style) {
       const value = style[key];
-      themed[key] = ThemeService.getValue(value, theme, value);
+      themed[key] = resolvePlatformFontFamily(key, ThemeService.getValue(value, theme, value));
     }
     return themed;
   };
```

**File**: `src/components/theme/style/style.spec.tsx` (modified, +10/-0)
```diff
@@ -136,6 +136,16 @@ describe('@style-service: service method checks', () => {
     });
   });
 
+  it('should resolve font families for the running platform', () => {
+    // Jest runs as iOS: `System` stays. The Android rule is covered in platformFontFamily.spec.ts.
+    const value = StyleService.createThemedEntry(
+      { fontFamily: 'text-font-family', fontWeight: '600' },
+      { 'text-font-family': 'System' },
+    );
+
+    expect(value).toEqual({ fontFamily: 'System', fontWeight: '600' });
+  });
+
 });
 
 describe('@useStyled: functional component checks', () => {
```

**File**: `website/docs/guides/branding.md` (modified, +2/-0)
```diff
@@ -252,6 +252,8 @@ To have every weight resolve on Android, register the faces under one family nam
 
 Then set only `text-font-family` to that family name; the weight tokens pick the face on both platforms. A separate family per weight, as in the example above, works on Android only when each family that carries a heavy weight token also ships a `_bold` file.
 
+The default `text-font-family` is `System`, the platform font. React Native Android treats any `fontFamily` name as a custom family and rounds the weight to regular or bold, so on Android Eva drops a `System` family from the resolved styles and lets the platform font keep the exact weight (`500`, `600`, …). A custom family name is passed through unchanged.
+
 ---
 
 ## Summary
```

---

### Incident Patch 13: `c7c9d257` (2026-09-27)
**Commit Message**: fix(autocomplete): float the options without a backdrop

The options list was a modal with a backdrop, so the first tap on a
control beside the field only closed the list, and the field was mirrored
by a second input inside the modal whose blur never reached the consumer
on iOS. Modal and Popover gain a `blocking` prop; with `blocking={false}`
the content is a plain view in the ApplicationProvider panel with no
native modal and no backdrop, so touches outside it reach the app.
Autocomplete uses it with a single real input: the list opens on focus,
closes on blur, selection, submit and keyboard dismissal, and `onBlur` is
the input's own event. Default placement is now `bottom`.
Closes #1578, closes #1755.

**File**: `.changeset/autocomplete-non-blocking-list.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+`Autocomplete` no longer opens its suggestions in a modal. The list floats above the app through the `ApplicationProvider` panel without a backdrop, so the first tap on a button beside the field reaches that button instead of only closing the list, and the field is a single real `TextInput`: `onFocus` / `onBlur` are its own focus events and `onBlur` fires when it loses focus. The list closes on blur, on selection, on submit and when the keyboard is dismissed. The default `placement` is now `bottom` (the `inner` placements cover the field). `Modal` and `Popover` gain a `blocking` prop (default `true`) that exposes the same non-blocking presentation.
```

**File**: `src/components/ui/autocomplete/autocomplete.component.tsx` (modified, +42/-52)
```diff
@@ -7,6 +7,7 @@
 
 import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, memo } from 'react';
 import {
+  Keyboard,
   ListRenderItemInfo,
   NativeSyntheticEvent,
   StyleSheet,
@@ -61,11 +62,13 @@ export interface AutocompleteRef {
  *
  * @property {(number) => void} onSelect - Called when option is pressed.
  *
- * @note Setting `keyboardShouldPersistTaps='handled'` on an enclosing `ScrollView`, `FlatList` or
- * `SectionList` is no longer required as of 6.0.0-beta.3; it is still harmless. The options popup
- * is presented through the `ApplicationProvider` panel, so it is no longer a React descendant of
- * the enclosing list and the first tap on an option selects it instead of only dismissing the
- * keyboard.
+ * @note The options list floats above the app through the `ApplicationProvider` panel without a
+ * backdrop: the first tap on an option selects it, and the first tap on a control next to the
+ * field reaches that control. The list closes when the input blurs, when an option is selected,
+ * on submit and when the keyboard is dismissed. With the React Native default
+ * `keyboardShouldPersistTaps='never'` on an enclosing `ScrollView`, a tap outside the focused
+ * input first dismisses the keyboard, which blurs the input and closes the list; set
+ * `keyboardShouldPersistTaps='handled'` on that list to let such a tap reach its target at once.
  *
  * @property {string} status - Status of the component.
  * Can be `basic`, `primary`, `success`, `info`, `warning`, `danger` or `control`.
@@ -91,12 +94,13 @@ export interface AutocompleteRef {
  *
  * @property {string | PopoverPlacement} placement - Position of the options list relative to the input field.
  * Can be `left`, `top`, `right`, `bottom`, `left start`, `left end`, `top start`, `top end`, `right start`,
- * `right end`, `bottom start` or `bottom end`.
+ * `right end`, `bottom start` or `bottom end`. The `inner` placements cover the field.
  * Defaults to *bottom*.
  *
- * @property {() => void} onFocus - Called when options list becomes visible.
+ * @property {(event) => void} onFocus - Called when the input field gains focus; the options list opens
+ * when there are options to show.
  *
- * @property {() => void} onBlur - Called when options list becomes invisible.
+ * @property {(event) => void} onBlur - Called when the input field loses focus; the options list closes.
  *
  * @property {InputProps} ...InputProps - Any props applied to Input component.
  *
@@ -118,15 +122,15 @@ export interface AutocompleteRef {
 const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
   children,
   onSelect,
-  placement = 'inner top',
+  placement = 'bottom',
   testID,
   onFocus: onFocusProp,
+  onBlur: onBlurProp,
   onSubmitEditing: onSubmitEditingProp,
   ...inputProps
 }, ref) => {
   const [listVisible, setListVisible] = useState(false);
   const inputRef = useRef<InputRef>(null);
-  const inputRefAnchor = useRef<InputRef>(null);
   const prevChildCountRef = useRef(React.Children.count(children));
 
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
@@ -161,6 +165,19 @@ const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
     prevChildCountRef.current = currentChildCount;
   }, [data.length, listVisible]);
 
+  // The list floats above the app without a backdrop (#1578), so nothing outside the component
+  // reports an outside tap. Closing the keyboard is the one signal the platform gives for
+  // "done with this field" that does not come through the input itself.
+  useEffect(() => {
+    if (!listVisible) {
+      return;
+    }
+    const subscription = Keyboard.addListener('keyboardDidHide', () => {
+      setListVisible(false);
+    });
+    return () => subscription.remove();
+  }, [listVisible]);
+
   const setOptionsListVisible = useCallback(() => {
     const hasData = data.length > 0;
     if (hasData) {
@@ -177,24 +194,16 @@ const AutocompleteComponent = forwardRef<AutocompleteRef, AutocompleteProps>(({
     onFocusProp?.(event);
   }, [setOptionsListVisible, onFocusProp]);
 
-  const onAnchorInputFocus = useCallback((event: NativeSyntheticEvent<TextInputFocusEventData>): void => {
-    inputRefAnchor.current?.blur();
-    setOptionsListVisible();
-    inputRef.current?.focus();
-    onFocusProp?.(event);
-  }, [setOptionsListVisible, onFocusProp]);
+  const onInputBlur = useCallback((event: NativeSyntheticEvent<TextInputFocusEventData>): void => {
+    setOptionsListInvisible();
+    onBlurProp?.(event);
+  }, [setOptionsListInvisible, onBlurProp]);
 
   const onInputSubmitEditing = useCallback((e: NativeSyntheticEvent<TextInputSubmitEditingEventData>): void => {
     setOptionsListInvisible();
     onSubmitEditingProp?.(e);
   }, [setOptionsListInvisible, onSubmitEditingProp]);
 
-  const onBackdropPress = useCallback((): void => {
-    inputRef.current?.blur();
-    inputRefAnchor.current?.blur();
-    setOption
```

**File**: `src/components/ui/autocomplete/autocomplete.spec.tsx` (modified, +43/-11)
```diff
@@ -9,11 +9,13 @@ import React from 'react';
 import {
   Image,
   ImageProps,
+  Keyboard,
   Text,
   TextInput,
   TouchableOpacity,
 } from 'react-native';
 import {
+  act,
   fireEvent,
   render,
   waitFor,
@@ -300,29 +302,59 @@ describe('@autocomplete: component checks', () => {
     expect(onSelect).toBeCalledWith(1);
   });
 
-  it('should hide options when backdrop is pressed', async () => {
+  it('should not block the screen while options are visible', async () => {
     const component = render(
       <TestAutocomplete />,
     );
 
     fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
     await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
 
-    const backdrop = await waitFor(() => {
-      const el = component.queryByTestId('@backdrop');
-      expect(el).toBeTruthy();
-      return el;
-    });
-    // Backdrop uses PanResponder - call the handler directly
-    const responderRelease = backdrop.props.onResponderRelease;
-    if (responderRelease) {
-      responderRelease({ nativeEvent: {} });
-    }
+    // No backdrop: the first tap on anything beside the field reaches it (#1578).
+    expect(component.queryByTestId('@backdrop')).toBeFalsy();
+    expect(component.queryByTestId('@modal/overlay')).toBeTruthy();
+  });
+
+  it('should hide options when the input blurs', async () => {
+    const onBlur = jest.fn();
+    const component = render(
+      <TestAutocomplete onBlur={onBlur} />,
+    );
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'blur');
 
     await waitFor(() => {
       expect(component.queryByText('Option 1')).toBeFalsy();
       expect(component.queryByText('Option 2')).toBeFalsy();
     });
+    // The field's own blur reaches the consumer (#1755).
+    expect(onBlur).toBeCalledTimes(1);
+  });
+
+  it('should hide options when the keyboard is dismissed', async () => {
+    const listeners: Record<string, () => void> = {};
+    const addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
+      listeners[event] = handler as () => void;
+      return { remove: jest.fn() } as never;
+    });
+
+    const component = render(
+      <TestAutocomplete />,
+    );
+
+    fireEvent(component.UNSAFE_queryByType(TextInput), 'focus');
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeTruthy());
+    expect(listeners.keyboardDidHide).toBeTruthy();
+
+    act(() => {
+      listeners.keyboardDidHide();
+    });
+
+    await waitFor(() => expect(component.queryByText('Option 1')).toBeFalsy());
+    addListener.mockRestore();
   });
 
   it('should call onFocus', async () => {
```

**File**: `src/components/ui/modal/modal.component.tsx` (modified, +78/-4)
```diff
@@ -23,6 +23,7 @@ import {
   ViewStyle,
   Modal as RNModal,
   ModalProps as ReactNativeModalProps,
+  useWindowDimensions,
 } from 'react-native';
 import {
   Frame,
@@ -55,6 +56,13 @@ export interface ModalProps extends ViewProps, BackdropPresentingConfig, RNModal
    * Modals nested inside an inline modal render inline as well.
    */
   renderInline?: boolean;
+  /**
+   * Whether the presented content blocks the screen behind it. With `blocking={false}` the
+   * content floats above the app in the `ApplicationProvider` panel without a native modal or a
+   * backdrop: touches outside it reach the views underneath and `onBackdropPress` never fires.
+   * Falls back to the blocking native modal when the content renders inline.
+   */
+  blocking?: boolean;
   children?: React.ReactNode;
 }
 
@@ -106,6 +114,13 @@ export type ModalElement = React.ReactElement<ModalProps>;
  * @property {string} backdropAccessibilityLabel - Accessible name for the dismissable backdrop.
  * When omitted, the backdrop is hidden from assistive technology.
  *
+ * @property {boolean} blocking - Whether the content blocks the screen behind it. With `false`, the content
+ * floats above the app through the `ApplicationProvider` panel without a native modal or a backdrop: touches
+ * outside it reach the views underneath and `onBackdropPress` is never called. Use it for transient
+ * content such as suggestion lists that must not steal the first tap on a neighbouring control.
+ * Inline rendering (`renderInline`, or no `ApplicationProvider`) always blocks.
+ * Defaults to true.
+ *
  * @property {ViewProps} ...ViewProps - Any props applied to View component.
  *
  * @overview-example ModalSimpleUsage
@@ -122,6 +137,7 @@ const ModalComponent: React.FC<ModalProps> = ({
   visible = false,
   shouldUseContainer = true,
   renderInline = false,
+  blocking = true,
   children,
   backdropStyle,
   backdropAccessibilityLabel,
@@ -143,6 +159,7 @@ const ModalComponent: React.FC<ModalProps> = ({
   const themeStore = useContext(ThemeStoreContext);
   const id = useId();
   const usePanel = !!registry && !renderInline;
+  const useOverlay = usePanel && !blocking;
   const itemContextValue = useMemo(() => ({ id }), [id]);
 
   if (registry === undefined && !renderInline && !didWarnMissingPanel && process.env.NODE_ENV !== 'production') {
@@ -187,8 +204,9 @@ const ModalComponent: React.FC<ModalProps> = ({
       <View
         // Scopes VoiceOver to the modal contents on iOS, and emits
         // `aria-modal` on the web. Android already gets this from the
-        // underlying native modal window.
-        aria-modal={true}
+        // underlying native modal window. Non-blocking content is not a
+        // modal: the rest of the screen stays reachable.
+        aria-modal={blocking}
         onAccessibilityEscape={onBackdropPress}
         {...viewProps}
         style={[style, styles.modalView, contentFlexPosition]}
@@ -201,14 +219,30 @@ const ModalComponent: React.FC<ModalProps> = ({
   const renderMeasuringContentElement = (): MeasuringElement => {
     return (
       <MeasureElement
-        shouldUseTopInsets={ModalService.getShouldUseTopInsets}
+        shouldUseTopInsets={useOverlay ? false : ModalService.getShouldUseTopInsets}
         onMeasure={onContentMeasure}
       >
         {renderContentElement()}
       </MeasureElement>
     );
   };
 
+  // Non-blocking content is a plain view in the panel, laid out over the whole window so that
+  // the window coordinates produced by `MeasureElement` apply directly. The panel usually sits
+  // at the window origin; when it does not (a header above `ApplicationProvider`), the view
+  // measures its own offset and shifts itself back to the origin.
+  const renderOverlay = (): React.ReactElement => {
+    const content = shouldUseContainer ? renderMeasuringContentElement() : children;
+    return (
+      <ModalPanelItemContext.Provider value={itemContextValue}>
+        <ModalOverlay>
+          {content}
+        </ModalOverlay>
+        <ModalPanelOutlet parentId={id} />
+      </ModalPanelItemContext.Provider>
+    );
+  };
+
   const renderRNModal = (): React.ReactElement => {
     const content = shouldUseContainer ? renderMeasuringContentElement() : children;
 
@@ -261,7 +295,7 @@ const ModalComponent: React.FC<ModalProps> = ({
     <MappingContext.Provider value={mapping}>
       <ThemeStoreContext.Provider value={themeStore}>
         <ThemeContext.Provider value={theme}>
-          {renderRNModal()}
+          {useOverlay ? renderOverlay() : renderRNModal()}
         </ThemeContext.Provider>
       </ThemeStoreContext.Provider>
     </MappingContext.Provider>
@@ -296,6 +330,46 @@ const ModalComponent: React.FC<ModalProps> = ({
 
 ModalComponent.displayName = 'Modal';
 
+interface ModalOverlayProps {
+  children?: React.ReactNode;
+}
+
+const ModalOverlay = ({ children }: ModalOverlayProps): React.ReactElement => {
+  const { width, height } = useWindowDimensions();
+  c
```

**File**: `src/components/ui/modal/modal.spec.tsx` (modified, +21/-0)
```diff
@@ -374,6 +374,27 @@ describe('@modal: panel checks', () => {
     warn.mockRestore();
   });
 
+  it('should float above the app without a native modal when not blocking', () => {
+    const component = render(
+      <ApplicationProvider
+        mapping={mapping}
+        theme={light}
+      >
+        <Modal
+          visible={true}
+          blocking={false}
+        >
+          <Text>Suggestions</Text>
+        </Modal>
+      </ApplicationProvider>,
+    );
+
+    expect(component.UNSAFE_queryByType(RNModal)).toBeFalsy();
+    expect(component.queryByTestId('@backdrop')).toBeFalsy();
+    expect(component.getByTestId('@modal/overlay').props.pointerEvents).toEqual('box-none');
+    expect(component.queryByText('Suggestions')).toBeTruthy();
+  });
+
   it('should render inline when renderInline is set', () => {
     const component = render(
       <Provider>
```

**File**: `src/components/ui/popover/popover.component.tsx` (modified, +16/-1)
```diff
@@ -49,6 +49,12 @@ export interface PopoverProps extends PopoverViewProps, PopoverModalProps, RNMod
    */
   anchorContainerStyle?: StyleProp<ViewStyle>;
   fullWidth?: boolean;
+  /**
+   * Whether the popover blocks the screen behind it. With `false` the content floats above the
+   * app without a backdrop: touches outside it reach the views underneath (so a neighbouring
+   * button gets its first tap) and `onBackdropPress` never fires. See `Modal`.
+   */
+  blocking?: boolean;
   /**
    * Called when the actual placement changes.
    * This can differ from the requested placement if there's not enough space.
@@ -231,6 +237,11 @@ export function usePopoverMeasurement({
  *
  * @property {boolean} fullWidth - Whether a content component should take the width of `anchor`.
  *
+ * @property {boolean} blocking - Whether the popover blocks the screen behind it. With `false` the content
+ * floats above the app without a backdrop: touches outside it reach the views underneath and
+ * `onBackdropPress` is never called. Dismiss it from your own state (an input blur, a selection).
+ * Defaults to true.
+ *
  * @property {string | PopoverPlacement} placement - Position of the content component relative to the `anchor`.
  * Can be `left`, `top`, `right`, `bottom`, `left start`, `left end`, `top start`, `top end`, `right start`,
  * `right end`, `bottom start`, `bottom end`, `inner`, `inner top` or `inner bottom`.
@@ -279,6 +290,7 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
   anchor,
   anchorContainerStyle,
   fullWidth = false,
+  blocking = true,
   visible = false,
   backdropStyle,
   backdropAccessibilityLabel,
@@ -378,7 +390,9 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
     >
       <MeasureElement
         force={forceMeasure}
-        shouldUseTopInsets={ModalService.getShouldUseTopInsets}
+        // The status bar compensation targets native modal windows; non-blocking content is laid
+        // out in the same coordinate space the anchor is measured in.
+        shouldUseTopInsets={blocking ? ModalService.getShouldUseTopInsets : false}
         onMeasure={onChildMeasure}
       >
         {anchor()}
@@ -394,6 +408,7 @@ const PopoverComponent = forwardRef<View, PopoverProps>(({
         onShow={onShow}
         onBackdropPress={onBackdropPress}
         renderInline={renderInline}
+        blocking={blocking}
       >
         {renderMeasuringPopoverElement()}
       </Modal>
```

**File**: `src/showcases/components/autocomplete/autocompleteBlur.component.tsx` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+import React, { useCallback } from 'react';
+import { StyleSheet, View } from 'react-native';
+import { Autocomplete, AutocompleteItem, Button, Text } from '@ui-kitten/components';
+
+// #1755 / #1578: an Autocomplete beside a Button. The counters echo how many times the
+// Autocomplete's `onBlur` fired and how many times the Button was pressed, so a device run can
+// tell whether the first tap on the Button reaches it while the options list is open.
+
+const movies = [
+  { title: 'Star Wars' },
+  { title: 'Back to the Future' },
+  { title: 'The Matrix' },
+  { title: 'Inception' },
+  { title: 'Interstellar' },
+];
+
+const filter = (item, query): boolean => item.title.toLowerCase().includes(query.toLowerCase());
+
+export const AutocompleteBlurShowcase = (): React.ReactElement => {
+  const [value, setValue] = React.useState(null);
+  const [data, setData] = React.useState(movies);
+  const [blurs, setBlurs] = React.useState(0);
+  const [presses, setPresses] = React.useState(0);
+
+  const onSelect = useCallback((index): void => {
+    setValue(data[index].title);
+  }, [data]);
+
+  const onChangeText = useCallback((query): void => {
+    setValue(query);
+    setData(movies.filter(item => filter(item, query)));
+  }, []);
+
+  const renderOption = (item, index): React.ReactElement => (
+    <AutocompleteItem
+      key={index}
+      testID={`autocomplete-blur-item-${index + 1}`}
+      title={item.title}
+    />
+  );
+
+  return (
+    <>
+      <Text testID='autocomplete-blur-value'>{`blurs: ${blurs}, presses: ${presses}`}</Text>
+      <View style={styles.row}>
+        <Autocomplete
+          testID='autocomplete-blur'
+          style={styles.field}
+          placeholder='Type a movie'
+          value={value}
+          onSelect={onSelect}
+          onChangeText={onChangeText}
+          onBlur={() => setBlurs(count => count + 1)}
+        >
+          {data.map(renderOption)}
+        </Autocomplete>
+        <Button
+          testID='autocomplete-blur-button'
+          onPress={() => setPresses(count => count + 1)}
+        >
+          SUBMIT
+        </Button>
+      </View>
+    </>
+  );
+};
+
+const styles = StyleSheet.create({
+  row: {
+    flexDirection: 'row',
+    alignItems: 'flex-start',
+  },
+  field: {
+    flex: 1,
+    marginRight: 8,
+  },
+});
```

**File**: `src/showcases/components/autocomplete/autocompleteSimpleUsage.component.tsx` (modified, +0/-1)
```diff
@@ -38,7 +38,6 @@ export const AutocompleteSimpleUsageShowcase = (): React.ReactElement => {
       testID='autocomplete'
       placeholder='Place your Text'
       value={value}
-      placement='inner top'
       onSelect={onSelect}
       onChangeText={onChangeText}
     >
```

---

### Incident Patch 14: `f73b265b` (2026-09-27)
**Commit Message**: fix(view-pager): hide off-screen pages from screen readers

Every page stays mounted and is only translated off screen, so VoiceOver
and TalkBack walked into pages the user could not see. The page wrapper
now carries aria-hidden for every index other than selectedIndex, which
React Native maps to accessibilityElementsHidden on iOS and
importantForAccessibility='no-hide-descendants' on Android. Closes #1658.

**File**: `.changeset/view-pager-hidden-pages.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Hide the non-selected `ViewPager` (and therefore `TabView`) pages from assistive technology. Every page stays mounted and translated off screen, so VoiceOver and TalkBack walked into pages the user could not see; the page wrappers now carry `aria-hidden` (`accessibilityElementsHidden` on iOS, `importantForAccessibility='no-hide-descendants'` on Android) for every index other than `selectedIndex`.
```

**File**: `src/components/ui/tab/tab.spec.tsx` (modified, +3/-2)
```diff
@@ -212,8 +212,9 @@ describe('@tab-view: component checks', () => {
       <TestTabView />,
     );
 
+    // The non-selected page is mounted but hidden from assistive technology.
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should not render content elements if disabled by shouldLoadComponent prop', () => {
@@ -222,7 +223,7 @@ describe('@tab-view: component checks', () => {
     );
 
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeFalsy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeFalsy();
   });
 
   it('should render tab indicator correctly', () => {
```

**File**: `src/components/ui/viewPager/viewPager.component.tsx` (modified, +8/-1)
```diff
@@ -196,8 +196,15 @@ function ViewPagerComponent<ChildrenProps = {}>(
 
   const renderComponentChild = (source: React.ReactElement<ChildrenProps>, index: number): React.ReactElement => {
     const contentView = shouldLoadComponent(index) ? source : null;
+    // Pages other than the selected one are translated off screen but still mounted, so screen
+    // readers would walk into them (#1658). `aria-hidden` maps to `accessibilityElementsHidden`
+    // on iOS, `importantForAccessibility='no-hide-descendants'` on Android and `aria-hidden` on web.
     return (
-      <View key={index} style={styles.contentContainer}>
+      <View
+        key={index}
+        style={styles.contentContainer}
+        aria-hidden={index !== selectedIndex}
+      >
         {contentView}
       </View>
     );
```

**File**: `src/components/ui/viewPager/viewPager.spec.tsx` (modified, +32/-3)
```diff
@@ -6,7 +6,11 @@
  */
 
 import React from 'react';
-import { GestureResponderHandlers, Text } from 'react-native';
+import {
+  GestureResponderHandlers,
+  Text,
+  View,
+} from 'react-native';
 import {
   act,
   fireEvent,
@@ -69,8 +73,9 @@ describe('@view-pager: component checks', () => {
       </TestViewPager>,
     );
 
+    // The non-selected page is mounted but hidden from assistive technology.
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should call shouldLoadComponent for each child', () => {
@@ -102,7 +107,31 @@ describe('@view-pager: component checks', () => {
     );
 
     expect(component.queryByText('Tab 0')).toBeTruthy();
-    expect(component.queryByText('Tab 1')).toBeFalsy();
+    expect(component.queryByText('Tab 1', { includeHiddenElements: true })).toBeFalsy();
+  });
+
+  it('should hide every page but the selected one from assistive technology', () => {
+    const component = render(
+      <TestViewPager selectedIndex={1}>
+        <Text>
+          Tab 0
+        </Text>
+        <Text>
+          Tab 1
+        </Text>
+        <Text>
+          Tab 2
+        </Text>
+      </TestViewPager>,
+    );
+
+    const pages = component.UNSAFE_getAllByType(View)
+      .filter(view => typeof view.props['aria-hidden'] === 'boolean');
+
+    expect(pages.map(page => page.props['aria-hidden'])).toEqual([true, false, true]);
+    expect(component.queryByText('Tab 1')).toBeTruthy();
+    expect(component.queryByText('Tab 0')).toBeFalsy();
+    expect(component.queryByText('Tab 0', { includeHiddenElements: true })).toBeTruthy();
   });
 
   it('should disable swipe gesture when swipeEnabled is false', () => {
```

---

### Incident Patch 15: `af419a39` (2026-09-27)
**Commit Message**: fix(datepicker): keep the calendar inside narrow windows

The Eva and Material mappings give Calendar a fixed width of 344, wider
than a 320 dp screen. The Datepicker popover took that width, was clamped
to x=0 by the popover bounds fix and lost the Saturday column past the
right edge. The Calendar container is now capped at its parent width and
the picker popover at the window width minus an 8 dp inset, so the day
cells (already flex: 1) absorb the difference. Closes #1784.

**File**: `.changeset/datepicker-narrow-screen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@ui-kitten/components": patch
+---
+
+Keep the `Datepicker` and `RangeDatepicker` calendar inside the window on screens narrower than the mapping's 344 dp calendar width (320 dp devices): the picker popover is clamped to the window width with an 8 dp inset on each side, and the `Calendar` / `RangeCalendar` container is capped at its parent width so day cells flex instead of the Saturday column being clipped at the right edge.
```

**File**: `src/components/ui/calendar/calendar.spec.tsx` (modified, +10/-0)
```diff
@@ -11,6 +11,7 @@ import {
   TouchableWithoutFeedback,
 } from '../../devsupport';
 import {
+  StyleSheet,
   TouchableOpacity,
   View,
 } from 'react-native';
@@ -478,4 +479,13 @@ describe('@calendar: component checks', () => {
     expect((componentRef.current.getPickerDate() as Date).getFullYear()).toEqual(2020);
   });
 
+  it('should cap the container at the parent width so narrow screens do not clip a column', () => {
+    const component = render(<TestCalendar testID='calendar' />);
+
+    const containerStyle = StyleSheet.flatten(component.getByTestId('calendar').props.style);
+
+    expect(containerStyle.width).toEqual(expect.any(Number));
+    expect(containerStyle.maxWidth).toEqual('100%');
+  });
+
 });
```

**File**: `src/components/ui/calendar/hooks/useCalendarStyles.ts` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@ export function useCalendarStyles(evaStyle: StyleType): CalendarStyles {
   return useMemo(() => ({
     container: {
       width: evaStyle.width,
+      // The mapping width is a target, not a floor: a screen narrower than it (320 dp devices,
+      // #1784) must not push the last weekday column off the edge. Cells are `flex: 1`, so they
+      // absorb the difference.
+      maxWidth: '100%',
       paddingVertical: evaStyle.paddingVertical,
       borderColor: evaStyle.borderColor,
       borderWidth: evaStyle.borderWidth,
```

**File**: `src/components/ui/datepicker/datepicker.spec.tsx` (modified, +26/-0)
```diff
@@ -8,6 +8,7 @@
 import React from 'react';
 import { TouchableWithoutFeedback } from '../../devsupport';
 import {
+  Dimensions,
   StyleSheet,
   Text,
   TouchableOpacity,
@@ -690,4 +691,29 @@ describe('@datepicker: component checks', () => {
     expect(onVisibleDateChange).toBeCalled();
   });
 
+  describe('popover width', () => {
+    const findViewMaxWidths = (api: RenderAPI): number[] => api.UNSAFE_getAllByType(View)
+      .map(view => StyleSheet.flatten(view.props.style)?.maxWidth)
+      .filter((maxWidth): maxWidth is number => typeof maxWidth === 'number');
+
+    afterEach(() => {
+      jest.restoreAllMocks();
+    });
+
+    it('should cap the popover at the window width minus the inset', async () => {
+      const dimensionsGet = Dimensions.get;
+      jest.spyOn(Dimensions, 'get').mockImplementation((dimension) => {
+        const actual = dimensionsGet.call(Dimensions, dimension);
+        return dimension === 'window' ? { ...actual, width: 320, height: 568 } : actual;
+      });
+
+      const component = render(<TestDatepicker />);
+
+      fireEvent.press(touchables.findInputTouchable(component));
+      await waitFor(() => component.UNSAFE_getByType(Calendar));
+
+      expect(findViewMaxWidths(component)).toContain(320 - 2 * 8);
+    });
+  });
+
 });
```

**File**: `src/components/ui/datepicker/useDatepickerStyles.ts` (modified, +13/-1)
```diff
@@ -5,8 +5,15 @@
  */
 
 import { useMemo } from 'react';
+import { useWindowDimensions } from 'react-native';
 import { StyleType } from '../../theme';
 
+/**
+ * Space kept between the picker popover and each window edge when the window is narrower than
+ * the mapping's `popoverWidth` (#1784).
+ */
+export const DATEPICKER_POPOVER_WINDOW_INSET = 8;
+
 export interface DatepickerStyles {
   control: StyleType;
   text: StyleType;
@@ -18,6 +25,8 @@ export interface DatepickerStyles {
 }
 
 export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
+  const { width: windowWidth } = useWindowDimensions();
+
   return useMemo(() => {
     const {
       textMarginHorizontal,
@@ -81,8 +90,11 @@ export function useDatepickerStyles(evaStyle: StyleType): DatepickerStyles {
       },
       popover: {
         width: popoverWidth,
+        // The calendar inside sizes the popover (its mapping width is 344); cap the popover at the
+        // window so the calendar, which is `maxWidth: '100%'`, shrinks with it on narrow screens.
+        maxWidth: windowWidth - 2 * DATEPICKER_POPOVER_WINDOW_INSET,
         marginBottom: captionMarginTop,
       },
     };
-  }, [evaStyle]);
+  }, [evaStyle, windowWidth]);
 }
```

#### Recent Merged Pull Requests:
- **PR #1935** (2026-10-04): Version Packages (@github-actions[bot])
- **PR #1934** (2026-10-04): fix(autocomplete): select an option with the mouse on web (@bataevvlad)
- **PR #1933** (2026-10-04): fix(falsy-text): render a 0 label (@bataevvlad)
- **PR #1932** (2026-10-04): test(e2e): reach showcase sections through a deep link (@bataevvlad)
- **PR #1931** (2026-10-04): fix(autocomplete): derive the input test ids from testID (@bataevvlad)
- **PR #1930** (2026-10-04): fix(theme): keep font weights with the System family on Android (@bataevvlad)
- **PR #1929** (2026-10-04): feat(view-pager): add PageIndicator (@bataevvlad)
- **PR #1928** (2026-10-04): feat(theme): type theme tokens from the theme JSON (@bataevvlad)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
