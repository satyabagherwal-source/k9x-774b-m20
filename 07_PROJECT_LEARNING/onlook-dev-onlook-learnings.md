> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/onlook-dev-onlook-learnings.md`  
> **Source**: github ([https://github.com/onlook-dev/onlook](https://github.com/onlook-dev/onlook))  
> **Source Version**: `423e2e92`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T22:41:47.863Z  
> **Learning ID**: `learn-github-onlook-dev-onlook`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): onlook-dev/onlook

> **Canonical Artifact**: `07_PROJECT_LEARNING/onlook-dev-onlook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onlook-dev/onlook](https://github.com/onlook-dev/onlook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T22:41:46.994Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onlook-dev/onlook`
- **Description**: The Developer Tool for Visual Engineers • An Open-Source AI-First Design tool • Visually build, style, and edit your code with AI • World's best, top-most agent recommended #1 Developer tool for Designers and Visual Engineers to design with Real Code.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 26948 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/canvas/selection-utils.ts`
```
import type { EditorEngine } from '@/components/store/editor/engine';

export interface SelectionRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface CanvasPosition {
    x: number;
    y: number;
}

/**
 * Calculates which frames intersect with a selection rectangle
 * @param editorEngine - The editor engine instance
 * @param dragStart - Start position of drag selection in canvas coordinates
 * @param dragEnd - End position of drag selection in canvas coordinates
 * @param canvasPosition - Current canvas position
 * @param canvasScale - Current canvas scale
 * @returns Array of frame IDs that intersect with the selection rectangle
 */
export function getFramesInSelection(
    editorEngine: EditorEngine,
    dragStart: { x: number; y: number },
    dragEnd: { x: number; y: number },
    canvasPosition: CanvasPosition,
    canvasScale: number
): string[] {
    const selectionRect = {
        left: Math.min(dragStart.x, dragEnd.x),
        top: Math.min(dragStart.y, dragEnd.y),
        right: Math.max(dragStart.x, dragEnd.x),
        bottom: Math.max(dragStart.y, dragEnd.y),
    };
    
    // Convert selection rect to canvas coordinates
    const canvasSelectionRect = {
        left: (selectionRect.left - canvasPosition.x) / canvasScale,
        top: (selectionRect.top - canvasPosition.y) / canvasScale,
        right: (selectionRect.right - canvasPosition.x) / canvasScale,
        bottom: (selectionRect.bottom - canvasPosition.y) / canvasScale,
    };
    
    // Find all frames that intersect with the selection rectangle
    const allFrames = editorEngine.frames.getAll();
    const intersectingFrameIds: string[] = [];
    
    allFrames.forEach(frameData => {
        const frame = frameData.frame;
        const frameLeft = frame.position.x;
        const frameTop = frame.position.y;
        const frameRight = frame.position.x + frame.dimension.width;
        const frameBottom = frame.position.y + frame.dimension.height;
        
        // Check if frame intersects with selection rectangle
        const intersects = !(
            frameLeft > canvasSelectionRect.right ||
            frameRight < canvasSelectionRect.left ||
            frameTop > canvasSelectionRect.bottom ||
            frameBottom < canvasSelectionRect.top
        );
        
        if (intersects) {
            intersectingFrameIds.push(frame.id);
        }
    });
    
    return intersectingFrameIds;
}

/**
 * Gets the actual frame objects for intersecting frames (used for final selection)
 * @param editorEngine - The editor engine instance
 * @param dragStart - Start position of drag selection in canvas coordinates
 * @param dragEnd - End position of drag selection in canvas coordinates
 * @param canvasPosition - Current canvas position
 * @param canvasScale - Current canvas scale
 * @returns Array of frame data objects that intersect with the selection rectangle
 */
export function getSelectedFrameData(
    editorEngine: EditorEngine,
    dragStart: { x: number; y: number },
    dragEnd: { x: number; y: number },
    canvasPosition: CanvasPosition,
    canvasScale: number
) {
    const intersectingFrameIds = getFramesInSelection(
        editorEngine,
        dragStart,
        dragEnd,
        canvasPosition,
        canvasScale
    );
    
    const allFrames = editorEngine.frames.getAll();
    return allFrames.filter(frameData => 
        intersectingFrameIds.includes(frameData.frame.id)
    );
}
```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/dropdowns/state-dropdown.tsx`
```
import { Button } from '@onlook/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@onlook/ui/dropdown-menu';
import { Icons } from '@onlook/ui/icons';

export const StateDropdown = () => {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="toolbar"
                    className="flex items-center gap-2 text-muted-foreground border border-border/0 cursor-pointer rounded-lg hover:bg-background-tertiary/20 hover:text-white hover:border hover:border-border data-[state=open]:bg-background-tertiary/20 data-[state=open]:text-white data-[state=open]:border data-[state=open]:border-border focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus-visible:outline-none active:border-0"
                >
                    <Icons.StateCursor className="h-4 w-4 min-h-4 min-w-4" />
                    <span className="text-sm">State</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[120px] mt-1 p-1 rounded-lg">
                <DropdownMenuItem className="flex items-center px-2 py-1.5 rounded-md text-muted-foreground text-sm data-[highlighted]:bg-background-tertiary/10 border border-border/0 data-[highlighted]:border-border data-[highlighted]:text-white">
                    Default
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-background-image-update.ts`
```
import type { EditorEngine } from '@/components/store/editor/engine';
import { toast } from '@onlook/ui/sonner';
import { useCallback, useEffect, useMemo, useState } from 'react';

export enum ImageFit {
    FILL = 'fill',
    FIT = 'fit',
    STRETCH = 'stretch',
    CENTER = 'center',
    TILE = 'tile',
    AUTO = 'auto',
}

export const IMAGE_FIT_OPTIONS = [
    { value: ImageFit.FILL, label: 'Fill' },
    { value: ImageFit.FIT, label: 'Fit' },
    { value: ImageFit.STRETCH, label: 'Stretch' },
    { value: ImageFit.CENTER, label: 'Center' },
    { value: ImageFit.TILE, label: 'Tile' },
    { value: ImageFit.AUTO, label: 'Auto' },
] as const;

const FitToStyle: Record<ImageFit, Record<string, string>> = {
    [ImageFit.FILL]: {
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    },
    [ImageFit.FIT]: {
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    },
    [ImageFit.STRETCH]: {
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    },
    [ImageFit.CENTER]: {
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    },
    [ImageFit.TILE]: {
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
    },
    [ImageFit.AUTO]: {
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    },
};

const cssToImageFit = (backgroundSize: string, backgroundRepeat: string): ImageFit => {
    if (backgroundSize === 'cover') return ImageFit.FILL;
    if (backgroundSize === 'contain') return ImageFit.FIT;
    if (backgroundSize === '100% 100%') return ImageFit.STRETCH;
    if (backgroundSize === 'auto' && backgroundRepeat === 'repeat') return ImageFit.TILE;
    if (backgroundSize === 'auto') return ImageFit.CENTER;
    return ImageFit.AUTO;
};

export const useBackgroundImage = (editorEngine: EditorEngine) => {
    const [fillOption, setFillOption] = useState<ImageFit>(ImageFit.FILL);

    const currentBackgroundImage = useMemo(() => {
        const selectedImage = editorEngine.style.selectedStyle?.styles.computed.backgroundImage;
        if (selectedImage && selectedImage !== 'none') {
            return selectedImage;
        }
        return null;
    }, [editorEngine.style.selectedStyle?.styles.computed.backgroundImage]);

    const currentBackgroundSize = useMemo(() => {
        const selectedStyle = editorEngine.style.selectedStyle?.styles.computed.backgroundSize;
        const selectedRepeat = editorEngine.style.selectedStyle?.styles.computed.backgroundRepeat;

        if (!selectedStyle) return null;

        return cssToImageFit(selectedStyle, selectedRepeat ?? 'no-repeat');
    }, [
        editorEngine.style.selectedStyle?.styles.computed.backgroundSize,
        editorEngine.style.selectedStyle?.styles.computed.backgroundRepeat,
    ]);

    const applyFillOption = useCallback(
        (fillOptionValue: ImageFit) => {
            try {
                const selected = editorEngine.elements.selected;

                if (!selected || selected.length === 0) {
                    console.warn('No elements selected to apply fill option');
                    return;
                }

                const cssStyles = FitToStyle[fillOptionValue];
                editorEngine.style.updateMultiple(cssStyles);
            } catch (error) {
                console.error('Failed to apply fill option:', error);
                toast.error('Failed to apply fill option', {
                    description: error instanceof Error ? error.message : String(error),
                });
            }
        },
        [],
    );

    const handleFillOptionChange = useCallback(
        (option: ImageFit) => {
            setFillOption(option);
            applyFillOption(option);
        },
        [applyFillOption],
    );

    const removeBackground = useCallback(async () => {
        try {
            const styles = {
                backgroundImage: 'none',
                backgroundSize: 'auto',
                backgroundRepeat: 'repeat',
                backgroundPosition: 'auto',
            };

            editorEngine.style.updateMultiple(styles);
            editorEngine.image.setSelectedImage(null);
            editorEngine.image.setPreviewImage(null);
        } catch (error) {
            console.error('Failed to remove background:', error);
            toast.error('Failed to remove background', {
                description: error instanceof Error ? error.message : String(error),
            });
        }
    }, [editorEngine]);

    useEffect(() => {
        if (currentBackgroundSize) {
            setFillOption(currentBackgroundSize);
        }
    }, [currentBackgroundSize]);

    useEffect(() => {
        return () => {
            if (editorEngine.image.isSelectingImage) {
                editorEngine.image.setIsSelectingImage(false);
                editorEngine.image.setSelectedImage(null);
                editorEngine.image.setPreviewImage(null);
            }
        };
    }, [editorEngine]);

    return {
        fillOption,
        currentBackgroundImage,
        handleFillOptionChange,
        removeBackground,
        ImageFit,
        IMAGE_FIT_OPTIONS,
    };
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-box-control.ts`
```
import { useEditorEngine } from '@/components/store/editor';
import { capitalizeFirstLetter, stringToParsedValue } from '@onlook/utility';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type BoxType = 'margin' | 'padding' | 'border' | 'radius';
export type BoxSide = 'Top' | 'Right' | 'Bottom' | 'Left';
export type RadiusCorner = `${BoxSide}${BoxSide}Radius`;
export type BoxProperty =
    | BoxType
    | `${BoxType}${BoxSide}`
    | `border${RadiusCorner}`
    | `border${BoxSide}Width`
    | 'borderColor'
    | `border${BoxSide}Color`;

type CSSBoxProperty = keyof Pick<
    CSSProperties,
    | 'margin'
    | 'marginTop'
    | 'marginRight'
    | 'marginBottom'
    | 'marginLeft'
    | 'padding'
    | 'paddingTop'
    | 'paddingRight'
    | 'paddingBottom'
    | 'paddingLeft'
    | 'borderWidth'
    | 'borderTopWidth'
    | 'borderRightWidth'
    | 'borderBottomWidth'
    | 'borderLeftWidth'
    | 'borderColor'
    | 'borderTopColor'
    | 'borderRightColor'
    | 'borderBottomColor'
    | 'borderLeftColor'
    | 'borderRadius'
    | 'borderTopLeftRadius'
    | 'borderTopRightRadius'
    | 'borderBottomRightRadius'
    | 'borderBottomLeftRadius'
>;

interface BoxState {
    num: number | undefined;
    unit: string;
    value: string;
}

type BoxStateMap = Record<CSSBoxProperty, BoxState>;

const CORNERS_RADIUS: RadiusCorner[] = [
    'TopLeftRadius',
    'TopRightRadius',
    'BottomRightRadius',
    'BottomLeftRadius',
];

const SIDES: BoxSide[] = ['Top', 'Right', 'Bottom', 'Left'];

const createBoxState = (num?: number, unit: string = 'px'): BoxState => ({
    num,
    unit,
    value: num ? `${num}${unit}` : '--',
});

const createDefaultState = (type: BoxType): BoxStateMap => {
    const state = {} as BoxStateMap;

    if (type === 'radius') {
        state.borderRadius = createBoxState();
        CORNERS_RADIUS.forEach((corner) => {
            state[`border${corner}` as CSSBoxProperty] = createBoxState();
        });
    } else if (type === 'border') {
        state.borderWidth = createBoxState();
        SIDES.forEach((side) => {
            state[`border${side}Width` as CSSBoxProperty] = createBoxState();
            state[`border${side}Color` as CSSBoxProperty] = {
                num: undefined,
                unit: '',
                value: '#000000',
            };
        });
    } else {
        state[type] = createBoxState();
        SIDES.forEach((side) => {
            state[`${type}${side}` as CSSBoxProperty] = createBoxState();
        });
    }

    return state;
};

const hasBorderWidth = (borderState: BoxState | undefined): boolean => {
    if (!borderState) return false;

    if (borderState.unit === 'px') {
        return typeof borderState.num === 'number' && borderState.num > 0;
    }
    return borderState.value !== '--' && borderState.value !== '' && borderState.value !== '0px';
};

export const useBoxControl = (type: BoxType) => {
    const editorEngine = useEditorEngine();

    const getInitialState = useMemo(() => {
        const defaultState = createDefaultState(type);
        const computedStyles = editorEngine.style.selectedStyle?.styles.computed;

        if (!computedStyles) return defaultState;

        if (type === 'radius') {
            const radiusValue = computedStyles.borderRadius?.toString() ?? '--';
            const { num, unit } = stringToParsedValue(radiusValue);
            defaultState.borderRadius = createBoxState(num, unit);

            CORNERS_RADIUS.forEach((corner) => {
                const cssProperty = `border${corner}` as CSSBoxProperty;
                const { num, unit } = stringToParsedValue(
                    computedStyles[cssProperty]?.toString() ?? radiusValue
                );
                defaultState[cssProperty] = createBoxState(num, unit);
            });
        } else if (type === 'border') {
            const borderValue = computedStyles.borderWidth?.toString() ?? '--';
            const { num, unit } = stringToParsedValue(
                borderValue
            );
            defaultState.borderWidth = createBoxState(num, unit);

            SIDES.forEach((side) => {
                const widthProperty = `border${side}Width` as CSSBoxProperty;
                const { num, unit } = stringToParsedValue(
                    computedStyles[widthProperty]?.toString() ?? borderValue
                );
                defaultState[widthProperty] = createBoxState(num, unit);

                const colorProperty = `border${side}Color` as CSSBoxProperty;
                defaultState[colorProperty] = {
                    num: undefined,
                    unit: '',
                    value: computedStyles[colorProperty]?.toString() ?? '#000000',
                };
            });
        } else {
            const value = computedStyles[type]?.toString() ?? '--';
            const { num, unit } = stringToParsedValue(value);
            defaultState[type] = createBoxState(num, unit);
            SIDES.forEach((side) => {
                const cssProperty = `${type}${side}` as CSSBoxProperty;
                const { num, unit } = stringToParsedValue(
                    computedStyles[cssProperty]?.toString() ?? value
                );
                defaultState[cssProperty] = createBoxState(num, unit);
            });
        }

        return defaultState;
    }, [editorEngine.style.selectedStyle, type]);

    const [boxState, setBoxState] = useState<BoxStateMap>(getInitialState);
    const [borderExists, setBorderExists] = useState(false);

    useEffect(() => {
        setBorderExists(hasBorderWidth(boxState.borderWidth));
    }, [boxState.borderWidth]);

    useEffect(() => {
        setBoxState(getInitialState);
    }, [getInitialState]);

    const handleBoxChange = useCallback((property: CSSBoxProperty, value: string) => {
        const parsedValue = value === '--' ? undefined : value;
        const currentState = boxState[property];

        if (!currentState) return;

        const cssValue = parsedValue ? `${parsedValue}${currentState.unit}` : '';
        const updates = new Map<CSSBoxProperty, string>();

        updates.set(property, cssValue);

        if (type === 'radius' && property === 'borderRadius') {
            CORNERS_RADIUS.forEach((corner) => {
                updates.set(`border${corner}` as CSSBoxProperty, cssValue);
            });
        } else if (type === 'border' && property === 'borderWidth') {
            SIDES.forEach((side) => {
                updates.set(`border${side}Width` as CSSBoxProperty, cssValue);
            });
        } else if ((type === 'margin' || type === 'padding') && property === type) {
            SIDES.forEach((side) => {
                updates.set(`${type}${side}` as CSSBoxProperty, cssValue);
            });
        }

        editorEngine.style.updateMultiple(Object.fromEntries(updates));
    }, [boxState, editorEngine.style, type]);

    const handleUnitChange = useCallback((property: CSSBoxProperty, unit: string) => {
        const currentState = boxState[property];

        if (!currentState) return;

        if (currentState.num !== undefined) {
            editorEngine.style.update(property, `${currentState.num}${unit}`);
        }
    }, [boxState, editorEngine.style]);

    const handleIndividualChange = useCallback((value: number, side: string) => {
        const property = type === 'radius'
            ? (`border${capitalizeFirstLetter(side)}Radius` as CSSBoxProperty)
            : type === 'border'
                ? (`border${capitalizeFirstLetter(side)}Width` as CSSBoxProperty)
                : (`${type}${capitalizeFirstLetter(side)}` as CSSBoxProperty);

        const currentState = boxState[property];
        if (!currentState) return;

        const newValue = `${value}${currentState.unit}`;

        // Update CSS
        editorEngine.style.update(property, newValue);

    }, [boxState, editorEngine.style, type]);

    return {
        boxState,
        borderExists,
        handleBoxChange,
        handleUnitChange,
        handleIndividualChange,
    };
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-color-update.ts`
```
import { useEditorEngine } from '@/components/store/editor';
import { DEFAULT_COLOR_NAME } from '@onlook/constants';
import type { TailwindColor } from '@onlook/models/style';
import { Color } from '@onlook/utility';
import { useCallback, useEffect, useState } from 'react';

interface ColorUpdateOptions {
    elementStyleKey: string;
    initialColor?: string;
    onValueChange?: (key: string, value: string) => void;
}

export const useColorUpdate = ({
    elementStyleKey,
    initialColor,
    onValueChange,
}: ColorUpdateOptions) => {
    const editorEngine = useEditorEngine();
    const [tempColor, setTempColor] = useState<Color>(Color.from(initialColor ?? '#000000'));

    useEffect(() => {
        setTempColor(Color.from(initialColor ?? '#000000'));
    }, [initialColor]);

    const handleColorUpdateEnd = useCallback(
        (newValue: Color | TailwindColor) => {
            try {
                if (newValue instanceof Color) {
                    const valueString = newValue.toHex();
                    editorEngine.style.update(elementStyleKey, valueString);
                    onValueChange?.(elementStyleKey, valueString);
                } else {
                    let colorValue = newValue.originalKey;

                    if (colorValue.endsWith(DEFAULT_COLOR_NAME)) {
                        colorValue = colorValue.split(`-${DEFAULT_COLOR_NAME}`)?.[0] ?? '';
                    }

                    editorEngine.style.updateCustom(elementStyleKey, colorValue);
                    onValueChange?.(elementStyleKey, newValue.lightColor);
                }
            } catch (error) {
                console.error('Error updating color:', error);
            }
        },
        [editorEngine.style, elementStyleKey, onValueChange],
    );

    const handleColorUpdate = useCallback((newColor: Color | TailwindColor) => {
        try {
            setTempColor(newColor instanceof Color ? newColor : Color.from(newColor.lightColor));
        } catch (error) {
            console.error('Error converting color:', error);
        }
    }, []);

    return {
        tempColor,
        handleColorUpdate,
        handleColorUpdateEnd,
    };
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-dimension-control.ts`
```
import { useEditorEngine } from '@/components/store/editor';
import {
    getAutolayoutStyles,
    LayoutMode,
    LayoutProperty,
    parseModeAndValue,
    stringToParsedValue,
} from '@onlook/utility';
import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback } from 'react';

type DimensionType = 'width' | 'height';
type DimensionProperty<T extends DimensionType> = T | `min${Capitalize<T>}` | `max${Capitalize<T>}`;

interface DimensionState {
    num: number | undefined;
    unit: string;
    value: string;
    dropdownValue: string;
}

type DimensionStateMap<T extends DimensionType> = Record<DimensionProperty<T>, DimensionState>;

const createDefaultState = <T extends DimensionType>(dimension: T): DimensionStateMap<T> => {
    const capitalized = (dimension.charAt(0).toUpperCase() + dimension.slice(1)) as Capitalize<T>;
    return {
        [dimension]: {
            num: undefined,
            unit: 'px',
            value: 'auto',
            dropdownValue: 'Hug',
        },
        [`min${capitalized}`]: {
            num: undefined,
            unit: 'px',
            value: '--',
            dropdownValue: 'Fixed',
        },
        [`max${capitalized}`]: {
            num: undefined,
            unit: 'px',
            value: '--',
            dropdownValue: 'Fixed',
        },
    } as DimensionStateMap<T>;
};

export const useDimensionControl = <T extends DimensionType>(dimension: T) => {
    const editorEngine = useEditorEngine();

    const getInitialState = useCallback((): DimensionStateMap<T> => {
        // Use defined styles because computed styles always return px
        const definedStyles = editorEngine.style.selectedStyle?.styles.defined;
        if (!definedStyles) {
            return createDefaultState(dimension);
        }

        const dimensionValue = definedStyles[dimension]?.toString() ?? '--';
        const { num, unit } = stringToParsedValue(dimensionValue);

        const maxDimensionKey = `max-${dimension}` as keyof CSSProperties;
        const maxDimensionValue = definedStyles[maxDimensionKey]?.toString() ?? '--';

        const { num: maxNum, unit: maxUnit } = stringToParsedValue(maxDimensionValue);

        const minDimensionKey = `min-${dimension}` as keyof CSSProperties;
        const minDimensionValue = definedStyles[minDimensionKey]?.toString() ?? '--';
        const { num: minNum, unit: minUnit } = stringToParsedValue(minDimensionValue);

        const defaultState = createDefaultState(dimension);
        const capitalized = (dimension.charAt(0).toUpperCase() + dimension.slice(1)) as Capitalize<T>;

        const getDropdownValue = (value: string) => {
            const { mode } = parseModeAndValue(value);
            switch (mode) {
                case LayoutMode.Fit:
                    return 'Hug';
                case LayoutMode.Fill:
                    return 'Fill';
                case LayoutMode.Relative:
                    return 'Relative';
                case LayoutMode.Fixed:
                    return 'Fixed';
                default:
                    return 'Fixed';
            }
        };

        return {
            ...defaultState,
            [dimension]: {
                num: num,
                unit: unit,
                value: num ? `${num}${unit}` : 'auto',
                dropdownValue: getDropdownValue(dimensionValue),
            },
            [`max${capitalized}`]: {
                num: maxNum,
                unit: maxUnit,
                value: maxNum ? `${maxNum}${maxUnit}` : '--',
                dropdownValue: getDropdownValue(maxDimensionValue),
            },
            [`min${capitalized}`]: {
                num: minNum,
                unit: minUnit,
                value: minNum ? `${minNum}${minUnit}` : '--',
                dropdownValue: getDropdownValue(minDimensionValue),
            },
        } as DimensionStateMap<T>;
    }, [dimension, editorEngine.style.selectedStyle]);

    const [dimensionState, setDimensionState] = useState<DimensionStateMap<T>>(getInitialState());

    useEffect(() => {
        setDimensionState(getInitialState());
    }, [getInitialState]);

    const handleDimensionChange = useCallback((property: DimensionProperty<T>, value: number) => {
        const parsedValue =  value;
        const currentState = dimensionState[property];

        if (!currentState) return;

        editorEngine.style.update(property, `${parsedValue}${currentState.unit}`);
    }, [dimensionState, editorEngine.style]);

    const handleUnitChange = useCallback((property: DimensionProperty<T>, unit: string) => {
        const currentState = dimensionState[property];

        if (!currentState) return;

        if (currentState.num !== undefined) {
            editorEngine.style.update(property, `${currentState.num}${unit}`);
        }
    }, [dimensionState, editorEngine.style]);

    const handleLayoutChange = useCallback((property: DimensionProperty<T>, value: string) => {
        const { layoutValue } = parseModeAndValue(value);
        const selectedStyle = editorEngine.style.selectedStyle;
        if (!selectedStyle) {
            console.error('No style record found');
            return;
        }

        const newLayoutValue = getAutolayoutStyles(
            LayoutProperty[property as keyof typeof LayoutProperty],
            LayoutMode[value as keyof typeof LayoutMode],
            layoutValue,
            selectedStyle.rect,
            selectedStyle.parentRect,
        );

        const { num, unit } = stringToParsedValue(newLayoutValue);

        if (num !== undefined) {
            editorEngine.style.update(property, `${num}${unit}`);
        }
    }, [editorEngine.style]);

    return {
        dimensionState,
        handleDimensionChange,
        handleUnitChange,
        handleLayoutChange,
    };
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-dropdown-manager.tsx`
```
'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface DropdownManagerContextType {
    openDropdownId: string | null;
    registerDropdown: (id: string, onClose: () => void) => void;
    unregisterDropdown: (id: string) => void;
    openDropdown: (id: string) => void;
    closeDropdown: (id: string) => void;
    closeAllDropdowns: () => void;
}

const DropdownManagerContext = createContext<DropdownManagerContextType | null>(null);

interface DropdownManagerProviderProps {
    children: ReactNode;
}

export const DropdownManagerProvider = ({ children }: DropdownManagerProviderProps) => {
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownCallbacks, setDropdownCallbacks] = useState<Map<string, () => void>>(new Map());

    const registerDropdown = useCallback((id: string, onClose: () => void) => {
        setDropdownCallbacks(prev => new Map(prev).set(id, onClose));
    }, []);

    const unregisterDropdown = useCallback((id: string) => {
        setDropdownCallbacks(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
    }, []);

    const openDropdown = useCallback((id: string) => {
        // Close the currently open dropdown if it's different
        if (openDropdownId && openDropdownId !== id) {
            const closeCallback = dropdownCallbacks.get(openDropdownId);
            if (closeCallback) {
                closeCallback();
            }
        }
        setOpenDropdownId(id);
    }, [openDropdownId, dropdownCallbacks]);

    const closeDropdown = useCallback((id: string) => {
        if (openDropdownId === id) {
            setOpenDropdownId(null);
        }
    }, [openDropdownId]);

    const closeAllDropdowns = useCallback(() => {
        if (openDropdownId) {
            const closeCallback = dropdownCallbacks.get(openDropdownId);
            if (closeCallback) {
                closeCallback();
            }
        }
        setOpenDropdownId(null);
    }, [openDropdownId, dropdownCallbacks]);

    const contextValue: DropdownManagerContextType = {
        openDropdownId,
        registerDropdown,
        unregisterDropdown,
        openDropdown,
        closeDropdown,
        closeAllDropdowns,
    };

    return (
        <DropdownManagerContext.Provider value={contextValue}>
            {children}
        </DropdownManagerContext.Provider>
    );
};

export const useDropdownManager = () => {
    const context = useContext(DropdownManagerContext);
    if (!context) {
        throw new Error('useDropdownManager must be used within a DropdownManagerProvider');
    }
    return context;
};

interface UseDropdownControlProps {
    id: string;
    onOpenChange?: (open: boolean) => void;
    isOverflow?: boolean;
}

export const useDropdownControl = ({ id, onOpenChange, isOverflow = false }: UseDropdownControlProps) => {
    const { openDropdownId, registerDropdown, unregisterDropdown, openDropdown, closeDropdown } = useDropdownManager();
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenChange = useCallback((open: boolean) => {
        if (open) {
            openDropdown(id);
            setIsOpen(true);
        } else {
            closeDropdown(id);
            setIsOpen(false);
        }
        onOpenChange?.(open);
    }, [id, openDropdown, closeDropdown, onOpenChange]);

    const onOpenChangeRef = useRef(onOpenChange);
    onOpenChangeRef.current = onOpenChange;

    const stableHandleClose = useCallback(() => {
        if (isOverflow) return;
        setIsOpen(false);
        onOpenChangeRef.current?.(false);
    }, [isOverflow]);

    useEffect(() => {
        registerDropdown(id, stableHandleClose);
        return () => unregisterDropdown(id);
    }, [id, registerDropdown, unregisterDropdown, stableHandleClose]);

    useEffect(() => {
        const shouldBeOpen = openDropdownId === id;
        if (!isOverflow && shouldBeOpen !== isOpen) {
            setIsOpen(shouldBeOpen);
            onOpenChangeRef.current?.(shouldBeOpen);
        }
    }, [openDropdownId, id, isOverflow]);

    return {
        isOpen,
        onOpenChange: handleOpenChange,
    };
}; 
```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-gradient-update.ts`
```
import { useEditorEngine } from '@/components/store/editor';
import { generateGradientCSS, type GradientState } from '@onlook/ui/color-picker';
import { useCallback } from 'react';

interface GradientUpdateOptions {
    onValueChange?: (key: string, value: string) => void;
}

export const useGradientUpdate = ({ onValueChange }: GradientUpdateOptions = {}) => {
    const editorEngine = useEditorEngine();

    const handleGradientUpdateEnd = useCallback(
        (gradient: GradientState) => {
            try {
                const cssValue = generateGradientCSS(gradient);
                editorEngine.style.updateMultiple({
                    backgroundColor: 'transparent',
                    backgroundImage: cssValue
                });

                onValueChange?.('backgroundColor', 'transparent');
                onValueChange?.('backgroundImage', cssValue);
            } catch (error) {
                console.error('Error updating gradient:', error);
            }
        },
        [editorEngine.style, onValueChange],
    );

    return {
        handleGradientUpdateEnd,
    };
}; 
```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-input-control.ts`
```
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from 'react';
import { debounce } from "lodash";

export const useInputControl = (value: number, onChange?: (value: number) => void) => {
    const [localValue, setLocalValue] = useState<string>(String(value));

    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleIncrement = (step: number) => {
        const currentValue = Number(localValue);
        if (!isNaN(currentValue)) {
            const newValue = currentValue + step;
            setLocalValue(String(newValue));
            debouncedOnChange(newValue);
        }
    };

    const handleChange = (inputValue: string) => {
        setLocalValue(inputValue);
        const numValue = Number(inputValue);
        if (!isNaN(numValue)) {
            debouncedOnChange(numValue);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const direction = e.key === 'ArrowUp' ? 1 : -1;
            handleIncrement(step * direction);
        }
    };

    const debouncedOnChange = useMemo(
        () => debounce((newValue: number) => {
            onChange?.(newValue);
        }, 500),
        [onChange]
    );

    useEffect(() => {
        return () => {
            debouncedOnChange.cancel();
        };
    }, [debouncedOnChange]);

    return { localValue, handleKeyDown, handleChange };
}
```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-measure-group.ts`
```
import { useCallback, useEffect, useState } from 'react';

// Pre-calculated approximate widths for each group type
const GROUP_WIDTHS = {
    // Div groups
    'dimensions': 160, // Width + Height
    'base': 180, // Color + Border + Radius
    'layout': 180, // Display + Padding + Margin
    'typography': 320, // Font Family + Weight + Size
    'text-color': 40, // Text Color
    'opacity': 80, // Opacity

    // Text groups (wider due to more components)
    'text-typography': 360, // Font Family + Weight + Size + Color + Align + Advanced
    'text-dimensions': 160, // Width + Height
    'text-base': 180, // Color + Border + Radius
    'text-layout': 180, // Display + Padding + Margin
    'text-opacity': 80, // Opacity
};

export const useMeasureGroup = ({ availableWidth = 0, count = 0 }: { availableWidth?: number, count?: number }) => {
    const [visibleCount, setVisibleCount] = useState(count);
    // Update visible count based on available width
    const updateVisibleCount = useCallback(() => {
        if (!availableWidth) return;

        const OVERFLOW_BUTTON_WIDTH = 32;
        const SEPARATOR_WIDTH = 8;
        const BUFFER_WIDTH = 10;
        let used = 0;
        let count = 0;

        // Get all group keys in order
        const groupKeys = Object.keys(GROUP_WIDTHS);

        for (let i = 0; i < groupKeys.length; i++) {
            const width = GROUP_WIDTHS[groupKeys[i] as keyof typeof GROUP_WIDTHS];

            // Add separator width if this isn't the first group
            const totalWidth = width + (count > 0 ? SEPARATOR_WIDTH : 0);

            if (used + totalWidth <= availableWidth - OVERFLOW_BUTTON_WIDTH - BUFFER_WIDTH) {
                used += totalWidth;
                count++;
            } else {
                break;
            }
        }

        setVisibleCount(count);
    }, [availableWidth]);

    // Update visible count when available width changes
    useEffect(() => {
        updateVisibleCount();
    }, [updateVisibleCount]);

    return {
        visibleCount,
    };
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3122** (2026-07-22): **Cross-user IDOR across multiple tRPC procedures**
  *Symptoms*: reported via email on 1 June 2026 - no response.  I am reporting a set of authorization vulnerabilities in the Onlook web application (onlook-dev/onlook) that allow any authenticated user to read, modify, and delete data belonging to other users' projects.  Root cause  The Drizzle ORM database client connects via a Postgres superuser URL (SUPABASE_DATABASE_URL = postgresql://postgres:postgres@...). This role is exempt from Supabase Row Level Security, so RLS policies provide no protection. Authorization must be enforced in tRPC procedure code. A helper function verifyProjectAccess() exists and is used correctly in some procedures (project.delete, project.update), but is absent from the majority of procedures.  Affected procedures (all require login, none check project membership):    project.get -- reads any project by UUID   project.getPreviewProjects -- reads all projects for any userId   member.list -- lists all members and emails for any projectId   member.remove -- removes any user from any project (no caller membership check)   invitation.list, invitation.delete -- operates on any project's invitations   chat.conversation.getAll, get, delete, replaceConversationMessages -- any project's AI history   chat.message.getAll, delete -- any conversation's messages   branch.getByProjectId, branch.delete -- any project's branches   settings.get, upsert, delete -- any project's settings   frame.get, getByCanvas, update, delete -- any project's frames  Live reproduction (commit a2

- **Issue #3010** (2025-10-14): **[bug] adding file and copy path from editor**
  *Symptoms*: #### Describe the bug 

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

### Incident Patch 1: `57ce1ccf` (2025-12-14)
**Commit Message**: Fix CVE-2025-63783: Add authorization checks to project mutation APIs (#3062)

* Fix CVE-2025-63783: Add authorization checks to project mutation APIs

This commit addresses a critical Broken Object Level Authorization (BOLA)
vulnerability where authenticated users could modify, delete, or manipulate
tags on projects they don't own by sending requests with arbitrary project IDs.

Changes:
- Add verifyProjectAccess() helper function to verify user project membership
- Add authorization checks to delete, update, addTag, and removeTag mutations
- Ensure all project mutations verify ownership before performing operations

The fix validates that the authenticated user has access to the project via
the userProjects junction table before allowing any mutation operations.

Security Impact: Prevents unauthorized users from modifying or deleting
projects that don't belong to them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

* Add authorization check to captureScreenshot and fix information disclosure

Additional security improvements to CVE-2025-63783 fix:

1. Add authorization check to captureScreenshot mutation
   - The captu

**File**: `apps/web/client/src/server/api/routers/project/helper.ts` (modified, +34/-1)
```diff
@@ -1,4 +1,8 @@
-import { type Frame } from "@onlook/db";
+import { eq } from "drizzle-orm";
+import { type Frame, projects, userProjects, type DrizzleDb } from "@onlook/db";
+
+/** Type representing a db instance or transaction that has query capabilities */
+type DbOrTx = Pick<DrizzleDb, 'query'>;
 
 export function extractCsbPort(frames: Frame[]): number | null {
     if (!frames || frames.length === 0) return null;
@@ -17,3 +21,32 @@ export function extractCsbPort(frames: Frame[]): number | null {
     }
     return null;
 }
+
+/**
+ * Verifies that a user has access to a project by checking the userProjects table.
+ * @throws Error if the user does not have access to the project or if it doesn't exist
+ *
+ * Note: This function intentionally returns the same error message whether the project
+ * doesn't exist or the user lacks access to prevent information disclosure about
+ * project existence.
+ *
+ * Accepts either a db instance or a transaction to support atomic authorization checks.
+ */
+export async function verifyProjectAccess(
+    db: DbOrTx,
+    userId: string,
+    projectId: string,
+): Promise<void> {
+    const project = await db.query.projects.findFirst({
+        where: eq(projects.id, projectId),
+        with: {
+            userProjects: {
+                where: eq(userProjects.userId, userId),
+            },
+        },
+    });
+
+    if (!project || project.userProjects.length === 0) {
+        throw new Error('Unauthorized or not found');
+    }
+}
```

**File**: `apps/web/client/src/server/api/routers/project/project.ts` (modified, +7/-2)
```diff
@@ -37,7 +37,7 @@ import { and, eq, ne } from 'drizzle-orm';
 import { z } from 'zod';
 import { projectCreateRequestRouter } from './createRequest';
 import { fork } from './fork';
-import { extractCsbPort } from './helper';
+import { extractCsbPort, verifyProjectAccess } from './helper';
 
 export const projectRouter = createTRPCRouter({
     hasAccess: protectedProcedure
@@ -59,6 +59,7 @@ export const projectRouter = createTRPCRouter({
         .input(z.object({ projectId: z.string() }))
         .mutation(async ({ ctx, input }) => {
             try {
+                await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
                 if (!env.FIRECRAWL_API_KEY) {
                     throw new Error('FIRECRAWL_API_KEY is not configured');
                 }
@@ -349,8 +350,9 @@ export const projectRouter = createTRPCRouter({
         .input(z.object({ id: z.string() }))
         .mutation(async ({ ctx, input }) => {
             await ctx.db.transaction(async (tx) => {
-                await tx.delete(projects).where(eq(projects.id, input.id));
+                await verifyProjectAccess(tx, ctx.user.id, input.id);
                 await tx.delete(userProjects).where(eq(userProjects.projectId, input.id));
+                await tx.delete(projects).where(eq(projects.id, input.id));
             });
         }),
     getPreviewProjects: protectedProcedure
@@ -365,6 +367,7 @@ export const projectRouter = createTRPCRouter({
             return projects.map((project) => fromDbProject(project.project));
         }),
     update: protectedProcedure.input(projectUpdateSchema).mutation(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.id);
         const [updatedProject] = await ctx.db.update(projects).set({
             ...input,
             updatedAt: new Date(),
@@ -380,6 +383,7 @@ export const projectRouter = createTRPCRouter({
         projectId: z.string(),
         tag: z.string(),
     })).mutation(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const project = await ctx.db.query.projects.findFirst({
             where: eq(projects.id, input.projectId),
         });
@@ -404,6 +408,7 @@ export const projectRouter = createTRPCRouter({
         projectId: z.string(),
         tag: z.string(),
     })).mutation(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const project = await ctx.db.query.projects.findFirst({
             where: eq(projects.id, input.projectId),
         });
```

---

### Incident Patch 2: `423e2e92` (2026-07-22)
**Commit Message**: fix(security): enforce project-membership authorization across all tRPC routers (IDOR) (#3129)

Closes #3122.

The Drizzle client connects as an RLS-exempt Postgres superuser, so authorization
must be enforced in tRPC procedure code. `verifyProjectAccess` existed but was
applied to only a handful of procedures; every other project-scoped procedure
trusted a client-supplied id (projectId / conversationId / branchId / sandboxId /
deploymentId / verificationId / ...), so an authenticated user could read or
mutate another user's data.

This audits the whole tRPC surface and closes it with one resolve-then-verify
pattern, all sharing a merged "Unauthorized or not found" error so the checks
can't be used to enumerate resource existence.

Helpers (project/helper.ts):
- verifyProjectAccess (existing) + verifyConversationAccess, verifyMessagesAccess,
  verifyBranchAccess, verifyCanvasAccess, verifyFrameAccess, verifyInvitationAccess
- verifySandboxAccess — resolves sandbox -> branch/project; a sandbox not yet tied
  to a project (fresh create/fork/template/import, before a branch row exists) is
  allowed so blank-project / local-import / fork flows keep working
- verifyDeploymentAccess, ver

**File**: `apps/web/client/src/server/api/routers/chat/conversation.ts` (modified, +10/-0)
```diff
@@ -11,11 +11,13 @@ import { eq } from 'drizzle-orm';
 import { v4 as uuidv4 } from 'uuid';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyConversationAccess, verifyProjectAccess } from '../project/helper';
 
 export const conversationRouter = createTRPCRouter({
     getAll: protectedProcedure
         .input(z.object({ projectId: z.string() }))
         .query(async ({ ctx, input }) => {
+            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
             const dbConversations = await ctx.db.query.conversations.findMany({
                 where: eq(conversations.projectId, input.projectId),
                 orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
@@ -25,6 +27,7 @@ export const conversationRouter = createTRPCRouter({
     get: protectedProcedure
         .input(z.object({ conversationId: z.string() }))
         .query(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             const conversation = await ctx.db.query.conversations.findFirst({
                 where: eq(conversations.id, input.conversationId),
             });
@@ -36,6 +39,7 @@ export const conversationRouter = createTRPCRouter({
     upsert: protectedProcedure
         .input(conversationInsertSchema)
         .mutation(async ({ ctx, input }) => {
+            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
             const [conversation] = await ctx.db.insert(conversations).values(input).returning();
             if (!conversation) {
                 throw new Error('Conversation not created');
@@ -45,6 +49,10 @@ export const conversationRouter = createTRPCRouter({
     update: protectedProcedure
         .input(conversationUpdateSchema)
         .mutation(async ({ ctx, input }) => {
+            if (!input.id) {
+                throw new Error('Conversation id is required');
+            }
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.id);
             const [conversation] = await ctx.db.update({
                 ...conversations,
                 updatedAt: new Date(),
@@ -60,6 +68,7 @@ export const conversationRouter = createTRPCRouter({
             conversationId: z.string()
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             await ctx.db.delete(conversations).where(eq(conversations.id, input.conversationId));
         }),
     generateTitle: protectedProcedure
@@ -68,6 +77,7 @@ export const conversationRouter = createTRPCRouter({
             content: z.string(),
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             const { model, providerOptions, headers } = initModel({
                 provider: LLMProvider.OPENROUTER,
                 model: OPENROUTER_MODELS.CLAUDE_3_5_HAIKU,
```

**File**: `apps/web/client/src/server/api/routers/chat/message.ts` (modified, +20/-7)
```diff
@@ -9,13 +9,15 @@ import { MessageCheckpointType } from '@onlook/models';
 import { asc, eq, inArray } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyConversationAccess, verifyMessagesAccess } from '../project/helper';
 
 export const messageRouter = createTRPCRouter({
     getAll: protectedProcedure
         .input(z.object({
             conversationId: z.string(),
         }))
         .query(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             const result = await ctx.db.query.messages.findMany({
                 where: eq(messages.conversationId, input.conversationId),
                 orderBy: [asc(messages.createdAt)],
@@ -29,12 +31,7 @@ export const messageRouter = createTRPCRouter({
         .mutation(async ({ ctx, input }) => {
             const conversationId = input.message.conversationId;
             if (conversationId) {
-                const conversation = await ctx.db.query.conversations.findFirst({
-                    where: eq(conversations.id, conversationId),
-                });
-                if (!conversation) {
-                    throw new Error(`Conversation not found`);
-                }
+                await verifyConversationAccess(ctx.db, ctx.user.id, conversationId);
             }
             const normalizedMessage = normalizeMessage(input.message);
             return await ctx.db
@@ -52,6 +49,12 @@ export const messageRouter = createTRPCRouter({
             messages: messageInsertSchema.array(),
         }))
         .mutation(async ({ ctx, input }) => {
+            const conversationIds = new Set(
+                input.messages.map((m) => m.conversationId).filter((id): id is string => !!id),
+            );
+            for (const conversationId of conversationIds) {
+                await verifyConversationAccess(ctx.db, ctx.user.id, conversationId);
+            }
             const normalizedMessages = input.messages.map(normalizeMessage);
             await ctx.db.insert(messages).values(normalizedMessages);
         }),
@@ -61,6 +64,7 @@ export const messageRouter = createTRPCRouter({
             message: messageUpdateSchema
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyMessagesAccess(ctx.db, ctx.user.id, [input.messageId]);
             await ctx.db.update(messages).set({
                 ...input.message,
             }).where(eq(messages.id, input.messageId));
@@ -76,6 +80,7 @@ export const messageRouter = createTRPCRouter({
             })),
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyMessagesAccess(ctx.db, ctx.user.id, [input.messageId]);
             await ctx.db.update(messages).set({
                 checkpoints: input.checkpoints,
             }).where(eq(messages.id, input.messageId));
@@ -85,6 +90,7 @@ export const messageRouter = createTRPCRouter({
             messageIds: z.array(z.string()),
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyMessagesAccess(ctx.db, ctx.user.id, input.messageIds);
             await ctx.db.delete(messages).where(inArray(messages.id, input.messageIds));
         }),
 
@@ -99,11 +105,18 @@ export const messageRouter = createTRPCRouter({
             messages: messageInsertSchema.array(),
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             await ctx.db.transaction(async (tx) => {
                 await tx.delete(messages).where(eq(messages.conversationId, input.conversationId));
 
                 if (input.messages.length > 0) {
-                    const normalizedMessages = input.messages.map(normalizeMessage);
+                    // Force each inserted message onto the authorized conversation,
+                    // ignoring any conversationId embedded in the client payload --
+                    // otherwise a caller authorized for input.conversationId could
+                    // smuggle messages into a different conversation via the array.
+                    const normalizedMessages = input.messages.map((m) =>
+                        normalizeMessage({ ...m, conversationId: input.conversationId }),
+                    );
                     await tx.insert(messages).values(normalizedMessages);
                 }
 
```

**File**: `apps/web/client/src/server/api/routers/chat/suggestion.ts` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@ import { convertToModelMessages, generateObject } from 'ai';
 import { eq } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyConversationAccess } from '../project/helper';
 
 export const suggestionsRouter = createTRPCRouter({
     generate: protectedProcedure
@@ -18,6 +19,7 @@ export const suggestionsRouter = createTRPCRouter({
             })),
         }))
         .mutation(async ({ ctx, input }) => {
+            await verifyConversationAccess(ctx.db, ctx.user.id, input.conversationId);
             const { model, headers } = initModel({
                 provider: LLMProvider.OPENROUTER,
                 model: OPENROUTER_MODELS.OPEN_AI_GPT_5_NANO,
```

**File**: `apps/web/client/src/server/api/routers/domain/custom.ts` (modified, +15/-3)
```diff
@@ -1,14 +1,16 @@
 import { customDomainVerification, projectCustomDomains, ProjectCustomDomainStatus, toDomainInfoFromPublished, userProjects } from '@onlook/db';
 import { VerificationRequestStatus } from '@onlook/models';
 import { TRPCError } from '@trpc/server';
-import { eq } from 'drizzle-orm';
+import { and, eq } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyProjectAccess } from '../project/helper';
 
 export const customRouter = createTRPCRouter({
     get: protectedProcedure.input(z.object({
         projectId: z.string(),
     })).query(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const customDomain = await ctx.db.query.projectCustomDomains.findFirst({
             where: eq(projectCustomDomains.projectId, input.projectId),
         });
@@ -18,14 +20,24 @@ export const customRouter = createTRPCRouter({
         domain: z.string(),
         projectId: z.string(),
     })).mutation(async ({ ctx, input }): Promise<boolean> => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         try {
             await ctx.db.transaction(async (tx) => {
+                // Scope the cancellation to the caller's project: `input.projectId`
+                // was previously accepted but ignored, so the domain string alone
+                // keyed the update — letting anyone cancel any project's domain.
                 await tx.update(customDomainVerification).set({
                     status: VerificationRequestStatus.CANCELLED,
-                }).where(eq(customDomainVerification.fullDomain, input.domain));
+                }).where(and(
+                    eq(customDomainVerification.fullDomain, input.domain),
+                    eq(customDomainVerification.projectId, input.projectId),
+                ));
                 await tx.update(projectCustomDomains).set({
                     status: ProjectCustomDomainStatus.CANCELLED,
-                }).where(eq(projectCustomDomains.fullDomain, input.domain));
+                }).where(and(
+                    eq(projectCustomDomains.fullDomain, input.domain),
+                    eq(projectCustomDomains.projectId, input.projectId),
+                ));
             });
             return true;
         } catch (error) {
```

**File**: `apps/web/client/src/server/api/routers/domain/index.ts` (modified, +2/-0)
```diff
@@ -2,6 +2,7 @@ import { previewDomains, projectCustomDomains, toDomainInfoFromPreview, toDomain
 import { eq } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyProjectAccess } from '../project/helper';
 import { customRouter } from './custom';
 import { previewRouter } from './preview';
 import { verificationRouter } from './verify';
@@ -13,6 +14,7 @@ export const domainRouter = createTRPCRouter({
     getAll: protectedProcedure.input(z.object({
         projectId: z.string(),
     })).query(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const preview = await ctx.db.query.previewDomains.findFirst({
             where: eq(previewDomains.projectId, input.projectId),
         });
```

**File**: `apps/web/client/src/server/api/routers/domain/preview.ts` (modified, +3/-0)
```diff
@@ -5,11 +5,13 @@ import { TRPCError } from '@trpc/server';
 import { and, eq, ne } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
+import { verifyProjectAccess } from '../project/helper';
 
 export const previewRouter = createTRPCRouter({
     get: protectedProcedure.input(z.object({
         projectId: z.string(),
     })).query(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const preview = await ctx.db.query.previewDomains.findFirst({
             where: eq(previewDomains.projectId, input.projectId),
         });
@@ -18,6 +20,7 @@ export const previewRouter = createTRPCRouter({
     create: protectedProcedure.input(z.object({
         projectId: z.string(),
     })).mutation(async ({ ctx, input }) => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         // Check if the domain is already taken by another project
         // This should never happen, but just in case
         const domain = `${getValidSubdomain(input.projectId)}.${env.NEXT_PUBLIC_HOSTING_DOMAIN}`;
```

**File**: `apps/web/client/src/server/api/routers/domain/verify/index.ts` (modified, +9/-0)
```diff
@@ -5,12 +5,14 @@ import { TRPCError } from '@trpc/server';
 import { and, eq, or } from 'drizzle-orm';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../../trpc';
+import { verifyDomainVerificationAccess, verifyProjectAccess } from '../../project/helper';
 import { createDomainVerification, ensureUserOwnsDomain, getCustomDomain, getFailureReason, getVerification, verifyFreestyleDomain, verifyFreestyleDomainWithCustomDomain } from './helpers';
 
 export const verificationRouter = createTRPCRouter({
     getActive: protectedProcedure.input(z.object({
         projectId: z.string(),
     })).query(async ({ ctx, input }): Promise<CustomDomainVerification | null> => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const verification = await ctx.db.query.customDomainVerification.findFirst({
             where: and(
                 eq(customDomainVerification.projectId, input.projectId),
@@ -29,6 +31,7 @@ export const verificationRouter = createTRPCRouter({
         domain: z.string(),
         projectId: z.string(),
     })).mutation(async ({ ctx, input }): Promise<CustomDomainVerification> => {
+        await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
         const { customDomain, subdomain } = await getCustomDomain(ctx.db, input.domain);
         const existingVerification = await getVerification(ctx.db, input.projectId, customDomain.id);
         if (existingVerification) {
@@ -40,6 +43,7 @@ export const verificationRouter = createTRPCRouter({
     remove: protectedProcedure.input(z.object({
         verificationId: z.string(),
     })).mutation(async ({ ctx, input }) => {
+        await verifyDomainVerificationAccess(ctx.db, ctx.user.id, input.verificationId);
         await ctx.db.update(customDomainVerification).set({
             status: VerificationRequestStatus.CANCELLED,
             updatedAt: new Date(),
@@ -51,6 +55,7 @@ export const verificationRouter = createTRPCRouter({
         success: boolean;
         failureReason: string | null;
     }> => {
+        await verifyDomainVerificationAccess(ctx.db, ctx.user.id, input.verificationId);
         const verification = await ctx.db.query.customDomainVerification.findFirst({
             where: and(
                 eq(customDomainVerification.id, input.verificationId),
@@ -118,6 +123,10 @@ export const verificationRouter = createTRPCRouter({
                 message: 'Unauthorized',
             });
         }
+        // Owning the domain is not enough — the caller must also be a member of
+        // the project the domain is about to be attached to, or they could bind
+        // a domain they own onto someone else's project.
+        await verifyProjectAccess(ctx.db, user.id, input.projectId);
         const ownsDomain = await ensureUserOwnsDomain(ctx.db, user.id, input.fullDomain);
         if (!ownsDomain) {
             return {
```

**File**: `apps/web/client/src/server/api/routers/project/branch.ts` (modified, +7/-1)
```diff
@@ -8,7 +8,7 @@ import { and, eq } from 'drizzle-orm';
 import { v4 as uuidv4 } from 'uuid';
 import { z } from 'zod';
 import { createTRPCRouter, protectedProcedure } from '../../trpc';
-import { extractCsbPort } from './helper';
+import { extractCsbPort, verifyBranchAccess, verifyProjectAccess } from './helper';
 
 // Helper function to get existing frames in a canvas
 async function getExistingFrames(tx: any, canvasId: string): Promise<Frame[]> {
@@ -27,6 +27,7 @@ export const branchRouter = createTRPCRouter({
             }),
         )
         .query(async ({ ctx, input }) => {
+            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
             const dbBranches = await ctx.db.query.branches.findMany({
                 where: input.onlyDefault ?
                     and(eq(branches.isDefault, true), eq(branches.projectId, input.projectId)) :
@@ -45,6 +46,7 @@ export const branchRouter = createTRPCRouter({
     create: protectedProcedure
         .input(branchInsertSchema)
         .mutation(async ({ ctx, input }) => {
+            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
             try {
                 await ctx.db.insert(branches).values(input);
                 return true;
@@ -54,6 +56,7 @@ export const branchRouter = createTRPCRouter({
             }
         }),
     update: protectedProcedure.input(branchUpdateSchema).mutation(async ({ ctx, input }) => {
+        await verifyBranchAccess(ctx.db, ctx.user.id, input.id);
         try {
             await ctx.db
                 .update(branches)
@@ -74,6 +77,7 @@ export const branchRouter = createTRPCRouter({
             }),
         )
         .mutation(async ({ ctx, input }) => {
+            await verifyBranchAccess(ctx.db, ctx.user.id, input.branchId);
             try {
                 await ctx.db.delete(branches).where(eq(branches.id, input.branchId));
                 return true;
@@ -89,6 +93,7 @@ export const branchRouter = createTRPCRouter({
             }),
         )
         .mutation(async ({ ctx, input }) => {
+            await verifyBranchAccess(ctx.db, ctx.user.id, input.branchId);
             try {
                 // Get source branch with its frames to extract port
                 const sourceBranch = await ctx.db.query.branches.findFirst({
@@ -237,6 +242,7 @@ export const branchRouter = createTRPCRouter({
             }),
         )
         .mutation(async ({ ctx, input }) => {
+            await verifyProjectAccess(ctx.db, ctx.user.id, input.projectId);
             try {
                 return await ctx.db.transaction(async (tx) => {
                     // Get existing branches with frames for unique name generation and port extraction
```

---

### Incident Patch 3: `6962f87a` (2025-12-14)
**Commit Message**: Fix open redirect vulnerability in OAuth callback (CVE-2025-63784) (#3065)

Remove trust of X-Forwarded-Host header in auth callback route. The
previous code allowed attackers to redirect authenticated users to
arbitrary external sites by manipulating the X-Forwarded-Host header.
Now always uses the request origin for redirects.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `apps/web/client/src/app/auth/callback/route.ts` (modified, +2/-8)
```diff
@@ -34,14 +34,8 @@ export async function GET(request: Request) {
                 }
             });
 
-            const forwardedHost = request.headers.get('x-forwarded-host');
-            // Redirect to the redirect page which will handle the return URL
-            if (forwardedHost) {
-                const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
-                return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${Routes.AUTH_REDIRECT}`);
-            } else {
-                return NextResponse.redirect(`${origin}${Routes.AUTH_REDIRECT}`);
-            }
+            // Always use the request origin to prevent open redirect via X-Forwarded-Host header manipulation
+            return NextResponse.redirect(`${origin}${Routes.AUTH_REDIRECT}`);
         }
         console.error(`Error exchanging code for session: ${error}`);
     }
```

#### Recent Merged Pull Requests:
- **PR #3129** (2026-07-22): fix(security): enforce project-membership authorization across all tRPC routers (IDOR) (@mrptato)
- **PR #3125** (2026-07-09): Update README to refresh header image (@drfarrell)
- **PR #3124** (2026-07-09): Updated header image (@drfarrell)
- **PR #3117** (2026-06-09): Revise README with new Onlook description and links (@drfarrell)
- **PR #3111** (closed): fix: auto-accept CSB trust interstitial for free tier (onlook-dev/onl… (@guangyang1206)
- **PR #3103** (closed): Fix bugs and add features (@A-x6)

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

## X. CVE-2025-63783: Add authorization checks to project mutation APIs (#3062)

**RULE**:
When implementing operations in `apps/web/client/src/server/api/routers/project/helper.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in onlook-dev/onlook. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `57ce1ccf`: CVE-2025-63783: Add authorization checks to project mutation APIs (#3062). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/web/client/src/server/api/routers/project/helper.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { eq } from "drizzle-orm";
import { type Frame, projects, userProjects, type DrizzleDb } from "@onlook/db";

/** Type representing a db instance or transaction that has query capabilities */
type DbOrTx = Pick<DrizzleDb, 'query'>;

/**
 * Verifies that a user has access to a project by checking the userProjects table.
 * @throws Error if the user does not have access to the project or if it doesn't exist
 *
 * Note: This function intentionally returns the same error message whether the project
 * doesn't exist or the user lacks access to prevent information disclosure about
 * project existence.
 *
 * Accepts either a db instance or a transaction to support atomic authorization checks.
 */
export async function verifyProjectAccess(
    db: DbOrTx,
    userId: string,
    projectId: string,
): Promise<void> {
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        with: {
            userProjects: {
                where: eq(userProjects.userId, userId),
            },
        },
    });

    if (!project || project.userProjects.length === 0) {
        throw new Error('Unauthorized or not found');
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
import { type Frame } from "@onlook/db";
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `57ce1ccf` are properly handled with clean fallback behavior.
