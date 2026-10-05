# Forensic Learning Record (Deep Inspection): onlook-dev/onlook

> **Canonical Artifact**: `07_PROJECT_LEARNING/onlook-dev-onlook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onlook-dev/onlook](https://github.com/onlook-dev/onlook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:06.823Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onlook-dev/onlook`
- **Description**: The Developer Tool for Designers • An Open-Source AI-First Design tool • Visually build, style, and edit your code with AI • World's best, top-most agent recommended #1 Developer tool for Designers to design with Real Code.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 26858 stars

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

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/hooks/use-text-control.ts`
```
import { useEditorEngine } from '@/components/store/editor';
import type { Font } from '@onlook/models';
import { convertFontString } from '@onlook/utility';
import { useEffect, useState } from 'react';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

interface TextState {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textAlign: TextAlign;
    textColor: string;
    letterSpacing: string;
    capitalization: string;
    textDecorationLine: string;
    lineHeight: string;
}

const DefaultState: TextState = {
    fontFamily: '--',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'left',
    textColor: '#000000',
    letterSpacing: '0',
    capitalization: 'none',
    textDecorationLine: 'none',
    lineHeight: '1.5',
};

export const useTextControl = () => {
    const editorEngine = useEditorEngine();

    const getInitialState = (): TextState => {
        return {
            fontFamily: convertFontString(
                editorEngine.style.selectedStyle?.styles.computed.fontFamily ??
                DefaultState.fontFamily,
            ),
            fontSize: parseInt(
                editorEngine.style.selectedStyle?.styles.computed.fontSize?.toString() ??
                DefaultState.fontSize.toString(),
            ),
            fontWeight:
                editorEngine.style.selectedStyle?.styles.computed.fontWeight?.toString() ??
                DefaultState.fontWeight,
            textAlign: (editorEngine.style.selectedStyle?.styles.computed.textAlign ??
                DefaultState.textAlign) as TextAlign,
            textColor:
                editorEngine.style.selectedStyle?.styles.computed.color ?? DefaultState.textColor,
            letterSpacing:
                editorEngine.style.selectedStyle?.styles.computed.letterSpacing?.toString() ??
                DefaultState.letterSpacing,
            capitalization:
                editorEngine.style.selectedStyle?.styles.computed.textTransform?.toString() ??
                DefaultState.capitalization,
            textDecorationLine:
                editorEngine.style.selectedStyle?.styles.computed.textDecorationLine?.toString() ??
                DefaultState.textDecorationLine,
            lineHeight:
                editorEngine.style.selectedStyle?.styles.computed.lineHeight?.toString() ??
                DefaultState.lineHeight,
        };
    };

    const [textState, setTextState] = useState<TextState>(getInitialState());

    useEffect(() => {
        setTextState(getInitialState());
    }, [editorEngine.style.selectedStyle]);

    const handleFontFamilyChange = (fontFamily: Font) => {
        editorEngine.style.updateFontFamily('fontFamily', fontFamily);
        // Reload all views after a delay to ensure the font is applied
        setTimeout(async () => {
            await editorEngine.frames.reloadAllViews();
        }, 500);
    };

    const handleFontSizeChange = (fontSize: number) => {
        setTextState((prev) => ({
            ...prev,
            fontSize,
        }));
        editorEngine.style.update('fontSize', `${fontSize}px`);
    };

    const handleFontWeightChange = (fontWeight: string) => {
        setTextState((prev) => ({
            ...prev,
            fontWeight,
        }));
        editorEngine.style.update('fontWeight', fontWeight);
    };

    const handleTextAlignChange = (textAlign: TextAlign) => {
        setTextState((prev) => ({
            ...prev,
            textAlign,
        }));
        editorEngine.style.update('textAlign', textAlign);
    };

    const handleTextColorChange = (textColor: string) => {
        setTextState((prev) => ({
            ...prev,
            textColor,
        }));
    };

    const handleLetterSpacingChange = (letterSpacing: string) => {
        setTextState((prev) => ({
            ...prev,
            letterSpacing,
        }));
        editorEngine.style.update('letterSpacing', `${letterSpacing}px`);
    };

    const handleCapitalizationChange = (capitalization: string) => {
        setTextState((prev) => ({
            ...prev,
            capitalization,
        }));
        editorEngine.style.update('textTransform', capitalization);
    };

    const handleTextDecorationChange = (textDecorationLine: string) => {
        setTextState((prev) => ({
            ...prev,
            textDecorationLine,
        }));
        editorEngine.style.update('textDecorationLine', textDecorationLine);
    };

    const handleLineHeightChange = (lineHeight: string) => {
        setTextState((prev) => ({
            ...prev,
            lineHeight,
        }));
        editorEngine.style.update('lineHeight', lineHeight);
    };

    return {
        textState,
        handleFontFamilyChange,
        handleFontSizeChange,
        handleFontWeightChange,
        handleTextAlignChange,
        handleTextColorChange,
        handleLetterSpacingChange,
        handleCapitalizationChange,
        handleTextDecorationChange,
        handleLineHeightChange,
    };
};

```

### Core Architecture Module: `apps/web/client/src/app/project/[id]/_components/editor-bar/utils/gradient.ts`
```
export const hasGradient = (bgImage?: string): boolean => {
    return !!(bgImage && 
              bgImage !== 'none' && 
              (bgImage.includes('gradient') || 
               bgImage.includes('linear-gradient') || 
               bgImage.includes('radial-gradient') || 
               bgImage.includes('conic-gradient')));
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

- **Issue #2926** (2025-10-03): **[bug] creating env files Error Supabase keys not found**
  *Symptoms*: #### Describe the bug  when I refer to the docker installation https://docs.onlook.com/self-hosting/docker-compose and type '`bun run setup:env`' in a ubuntu host, there rasied a error log     ``` $cd packages/scripts && bun run start $ bun run build && node dist/index.js $ bun build src/index.ts --outdir=dist --target=node Bundled 103 modules in 18ms   index.js  0.34 MB  (entry point) 🔑 Onlook Environment Setup Script ================================== ✔ Docker is running. 🚀 Starting Supabase backend... ✖ Failed to extract Supabase keys. Error creating .env files: Error: Supabase keys not found     at ChildProcess.onClose (file:///home/xx/github/onlook/packages/scripts/dist/index.js:10428:14)     at ChildProcess.emit (node:events:517:28)     at maybeClose (node:internal/child_process:1098:16)     at ChildProcess._handle.onexit (node:internal/child_process:303:5) error: script "start" exited with code 1 error: script "setup:env" exited with code 1 ```   the repo is 'master' branch

- **Issue #2917** (2025-09-30): **[bug] setup script is broken in the new version of Supabase**
  *Symptoms*: #### Describe the bug Anon keys and Service role keys have been changed and no longer show up correctly

- **Issue #2908** (2025-09-30): **[bug] Branch and window dragging use the wrong references**
  *Symptoms*: #### Describe the bug  This has happened in two cases:  1) When a user creates a new branch and then tries to drag the webframe topbar to arrange it, it acts as if the user is dragging the original branch  2) When the user has one window selected and tries to drag another adjacent window, it pretends like the first window is the one still in focused.   ![Image](https://github.com/user-attachments/assets/8458a147-dbfb-4707-ad44-1241ac375e83)  The expected behavior would be that the user can click on any webframe and it would select and drag that topframe. Right now it seems to keep the first frame selected and because the mouse hovers over a topbar area it enables the ability to drag / move the frame. 
  **Post-Mortem & Fix Analysis**:
  > hey i'd like to participate, can i work on this?
  > Go for it @DavidReque !

- **Issue #2865** (2025-09-19): **[bug] The entire chat UI disappears on new chat creation for a second**
  *Symptoms*: #### Describe the bug May be related to #2851, but when a new chat is created, the empty state + the chat input element just disappears for a second.  <img width="387" height="898" alt="Image" src="https://github.com/user-attachments/assets/369af72f-c0e2-4925-a34e-f206718ed073" />  Also, any text or selection that was included in the initial chat input gets removed. Ideally the user should be able to bring that along to the new message. 
  **Post-Mortem & Fix Analysis**:
  > This should be solved in main. Can you verify?
  > https://github.com/onlook-dev/onlook/pull/2879

- **Issue #2856** (2025-09-19): **[bug] Sometimes AI thinks to manually introdue its own OIDs**
  *Symptoms*: #### Describe the bug  Need to prevent the AI from thinking it needs to introduce OIDs programmatically.  <img width="908" height="1016" alt="Image" src="https://github.com/user-attachments/assets/b5c7fb5b-22f0-47c0-8a6e-dbd5b450f75e" />
  **Post-Mortem & Fix Analysis**:
  > Updated the system prompt

- **Issue #2806** (2025-09-06): **Logout does not clear session**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @Kitenite I’d be happy to try fixing this issue myself
  > Это серьезная ситуация? Мне стоит завязывать со всем этим как вы считаете?  чт, 4 сент. 2025 г., 17:07 Binu Baiju ***@***.***>:  > *binu-baiju* left a comment (onlook-dev/onlook#2806) > <https://github.com/onlook-dev/onlook/issues/2806#issuecomment-3253383393> > > @Kitenite <https://github.com/Kitenite> > I’d be happy to try fixing this issue myself > > — > Reply to this email directly, view it on GitHub > <https://github.com/onlook-dev/onlook/issues/2806#issuecomment-3253383393>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AXA63AS2ZGTAMSXSZL4PQAD3RATRVAVCNFSM6AAAAACFTXNQ6WVHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHMZTENJTGM4DGMZZGM> > . > You are receiving this because you are subscribed to this thread.Message > ID: ***@***.***> > 

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

### Incident Patch 1: `423e2e92` (2026-07-22)
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

### Incident Patch 2: `a242be58` (2026-02-27)
**Commit Message**: Website v1.5: AI-native copy revamp, new pages, and UX improvements (#3086)

* AI-native revamp, 404, more pages

* Improved designs / layouts / pages

* Fix sitemap.ts type import for verbatimModuleSyntax

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Add mobile mockup preview to workflow solution sections

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Fix mobile mockup to match features page style

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Increase mobile mockup container height to 600px

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Increase mobile mockup height to 760px

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Increase mobile mockup height to 800px

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Adjust mobile mockup: height 860px, reduce bottom margin

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Fix mobile mockup: height 880px, remove bottom margin

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Fix mobile mockup positioning: top-aligned, 500px container

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Add mobile mockup preview to workflow pages

Added responsive mobile preview of the Onlook interfa

**File**: `apps/web/client/public/assets/logo-claude-code.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Claude</title><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"></path></svg>
\ No newline at end of file
```

**File**: `apps/web/client/public/assets/logo-codex.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg fill="white" fill-rule="evenodd" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>OpenAI</title><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path></svg>
\ No newline at end of file
```

**File**: `apps/web/client/public/onlook-preload-script.js` (modified, +4/-1)
```diff
@@ -16,7 +16,10 @@ var U4=Object.create;var{getPrototypeOf:J4,defineProperty:Je,getOwnPropertyNames
             nextjs-portal {
                 display: none;
             }
-        `,document.head.appendChild(r)}catch(r){console.warn("Error injecting default styles",r)}}static getInstance(){if(!rn.instance)rn.instance=new rn;return rn.instance}get stylesheet(){let r=document.getElementById("onlook-stylesheet")||this.createStylesheet();return r.textContent=r.textContent||"",Su(r.textContent)}set stylesheet(r){let t=document.getElementById("onlook-stylesheet")||this.createStylesheet();t.textContent=Vu(r)}createStylesheet(){let r=document.createElement("style");return r.id="onlook-stylesheet",document.head.appendChild(r),r}find(r,t){let i=[];return xo(r,{visit:"Rule",enter:(o)=>{if(o.type==="Rule"){let n=o;if(n.prelude.type==="SelectorList")n.prelude.children.forEach((e)=>{if(Vu(e)===t)i.push(o)})}}}),i}updateStyle(r,t){let i=Ne(r,!1),o=this.stylesheet;for(let[n,e]of Object.entries(t)){let l=this.jsToCssProperty(n),u=this.find(o,i);if(!u.length)this.addRule(o,i,l,e.value);else u.forEach((g)=>{if(g.type==="Rule")this.updateRule(g,l,e.value)})}this.stylesheet=o}addRule(r,t,i,o){let n={type:"Rule",prelude:{type:"SelectorList",children:[{type:"Selector",children:[{type:"TypeSelector",name:t}]}]},block:{type:"Block",children:[{type:"Declaration",property:i,value:{type:"Raw",value:o}}]}};if(r.type==="StyleSheet")r.children.push(n)}updateRule(r,t,i){let o=!1;if(xo(r.block,{visit:"Declaration",enter:(n)=>{if(n.property===t){if(n.value={type:"Raw",value:i},i==="")r.block.children=r.block.children.filter((e)=>e.property!==t);o=!0}}}),!o)if(i==="")r.block.children=r.block.children.filter((n)=>n.property!==t);else r.block.children.push({type:"Declaration",property:t,value:{type:"Raw",value:i},important:!1})}getJsStyle(r){let t=this.stylesheet,i=this.find(t,r),o={};if(!i.length)return o;return i.forEach((n)=>{if(n.type==="Rule")xo(n,{visit:"Declaration",enter:(e)=>{o[this.cssToJsProperty(e.property)]=e.value.value}})}),o}jsToCssProperty(r){if(!r)return"";return r.replace(/([A-Z])/g,"-$1").toLowerCase()}cssToJsProperty(r){if(!r)return"";return r.replace(/-([a-z])/g,(t)=>t[1]?.toUpperCase()??"")}removeStyles(r,t){let i=Ne(r,!1),o=this.stylesheet;this.find(o,i).forEach((e)=>{if(e.type==="Rule"){let l=t.map((u)=>this.jsToCssProperty(u));e.block.children=e.block.children.filter((u)=>!l.includes(u.property))}}),this.stylesheet=o}clear(){this.stylesheet=Su("")}}var ot=rn.getInstance();function _x(r,t){return ot.updateStyle(r,t.updated),Ni(r,!0)}function Ox(r,t){ot.updateStyle(r,{backgroundImage:{value:`url(${t})`,type:"value"}})}function Dx(r){ot.updateStyle(r,{backgroundImage:{value:"none",type:"value"}})}function Ap(r,t){let i=Array.from(r.children);if(i.length===0)return 0;let o=0,n=1/0;i.forEach((u,g)=>{let c=u.getBoundingClientRect(),m=c.top+c.height/2,v=Math.abs(t-m);if(v<n)n=v,o=g});let e=i[o]?.getBoundingClientRect();if(!e)return 0;let l=e.top+e.height/2;return t>l?o+1:o}function px(r,t){let i=Bp(r,t);if(!i)return null;let o=window.getComputedStyle(i).display;if(o==="flex"||o==="grid"){let e=Ap(i,t);return{type:"index",targetDomId:Pr(i),targetOid:Gr(i)||Qr(i)||null,index:e,originalIndex:e}}return{type:"append",targetDomId:Pr(i),targetOid:Gr(i)||Qr(i)||null}}function Bp(r,t){let i=q$(r,t);if(!i)return null;let o=!0;while(i&&o)if(o=j$.has(i.tagName.toLowerCase()),o)i=i.parentElement;return i}function Ix(r,t){let i=Q(t.targetDomId);if(!i){console.warn(`Target element not found: ${t.targetDomId}`);return}let o=jx(r);switch(t.type){case"append":i.appendChild(o);break;case"prepend":i.prepend(o);break;case"index":if(t.index===void 0||t.index<0){console.warn(`Invalid index: ${t.index}`);return}if(t.index>=i.children.length)i.appendChild(o);else i.insertBefore(o,i.children.item(t.index));break;default:console.warn(`Invalid position: ${t}`),Ye(t)}let n=lr(o,!0),e=zr(o);return{domEl:n,newMap:e}}function jx(r){let t=document.createElement(r.tagName);t.setAttribute("data-onlook-inserted","true");for(let[i,o]of Object.entries(r.attributes))t.setAttribute(i,o);if(r.textContent!==null&&r.textContent!==void 0)t.textContent=r.textContent;for(let[i,o]of Object.entries(r.styles))t.style.setProperty(ot.jsToCssProperty(i),o);for(let i of r.children){let o=jx(i);t.appendChild(o)}return t}function kx(r){let t=Q(r.targetDomId);if(!t)return console.warn(`Target element not found: ${r.targetDomId}`),null;let i=null;switch(r.type){case"append":i=t.lastElementChild;break;case"prepend":i=t.firstElementChild;break;case"index":if(r.index!==-1)i=t.children.item(r.index);else return console.warn(`Invalid index: ${r.index}`),null;break;default:console.warn(`Invalid position: ${r}`),Ye(r)}if(i){let o=lr(i,!0);i.style.display="none";let n=t.parentElement?zr(t.parentElement):null;return{domEl:o,newMap:n}}else return console.warn("No element found to remove at the specified location"),null}function Ux(r,t){let i=Q(r);if(!i)return console.warn("Element not 
```

**File**: `apps/web/client/src/app/_components/hero/ai-frontend-hero.tsx` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+'use client';
+
+import { useRouter } from 'next/navigation';
+import { motion } from 'motion/react';
+
+import { Button } from '@onlook/ui/button';
+
+import { ExternalRoutes } from '@/utils/constants';
+import { useGitHubStats } from '../top-bar/github';
+import { UnicornBackground } from './unicorn-background';
+
+export function AiFrontendHero() {
+    const router = useRouter();
+    const { formatted: starCount } = useGitHubStats();
+
+    const handleBookDemo = () => {
+        window.open(ExternalRoutes.BOOK_DEMO, '_blank');
+    };
+
+    return (
+        <div className="relative flex h-full w-full flex-col items-center justify-center gap-12 p-8 text-center text-lg">
+            <UnicornBackground />
+            <div className="relative z-20 flex max-w-3xl flex-col items-center gap-6 pt-4 pb-2">
+                <motion.h1
+                    className="text-foreground-secondary mb-4 text-sm font-medium tracking-wider uppercase"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    AI for Frontend Development
+                </motion.h1>
+                <motion.p
+                    className="text-center text-4xl !leading-[1.1] leading-tight font-light text-balance md:text-6xl"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    AI That Builds With Your Components, Not Around Them
+                </motion.p>
+                <motion.p
+                    className="text-foreground-secondary mx-auto max-w-xl text-center text-lg text-balance"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    Stop generating throwaway code. Onlook's AI is constrained to your design system — your buttons, your cards, your layouts. What you create is a PR your engineers can merge.
+                </motion.p>
+                <motion.div
+                    className="mt-8"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    <Button
+                        variant="secondary"
+                        size="lg"
+                        className="hover:bg-foreground-primary hover:text-background-primary cursor-pointer p-6 transition-all duration-300"
+                        onClick={handleBookDemo}
+                    >
+                        Book a Demo
+                    </Button>
+                </motion.div>
+                <motion.div
+                    className="text-foreground-secondary mt-8 flex items-center justify-center gap-6 text-sm"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    <div className="flex items-center gap-2">
+                        <span>{starCount}+ GitHub stars</span>
+                    </div>
+                    <div className="bg-foreground-secondary h-1 w-1 rounded-full"></div>
+                    <div className="flex items-center gap-2">
+                        <span>YC W25</span>
+                    </div>
+                    <div className="bg-foreground-secondary h-1 w-1 rounded-full"></div>
+                    <div className="flex items-center gap-2">
+                        <span>Open Source</span>
+                    </div>
+                </motion.div>
+            </div>
+        </div>
+    );
+}
```

**File**: `apps/web/client/src/app/_components/hero/claude-code-hero.tsx` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+'use client';
+
+import { motion } from 'motion/react';
+
+import { Button } from '@onlook/ui/button';
+import { Icons } from '@onlook/ui/icons';
+
+import { ExternalRoutes } from '@/utils/constants';
+import { useGitHubStats } from '../top-bar/github';
+import { UnicornBackground } from './unicorn-background';
+
+export function ClaudeCodeHero() {
+    const { formatted: starCount } = useGitHubStats();
+
+    return (
+        <div className="relative flex h-full w-full flex-col items-center justify-center gap-12 p-8 text-center text-lg">
+            <UnicornBackground />
+            <div className="relative z-20 flex max-w-3xl flex-col items-center gap-6 pt-4 pb-2">
+                <motion.h1
+                    className="text-foreground-secondary mb-4 text-sm font-medium tracking-wider uppercase"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    Workflows
+                </motion.h1>
+                <motion.p
+                    className="text-center text-4xl !leading-[1.1] leading-tight font-light text-balance md:text-6xl"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    Claude Code for Designers
+                </motion.p>
+                <motion.h2
+                    className="text-foreground-secondary mx-auto max-w-xl text-center text-lg text-balance"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    The visual canvas your AI workflow is missing. Claude Code builds it. Onlook lets you design it.
+                </motion.h2>
+                <motion.div
+                    className="mt-8 flex flex-row gap-4"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    <Button
+                        asChild
+                        size="lg"
+                        className="bg-foreground-primary text-background-primary hover:bg-foreground-hover cursor-pointer p-6 transition-all duration-300"
+                    >
+                        <a href={ExternalRoutes.BOOK_DEMO} target="_blank" rel="noopener noreferrer">
+                            Book a Demo
+                            <Icons.ArrowRight className="ml-2 h-4 w-4" />
+                        </a>
+                    </Button>
+                </motion.div>
+                <motion.div
+                    className="text-foreground-secondary mt-8 flex items-center justify-center gap-6 text-sm"
+                    initial={{ opacity: 0, filter: 'blur(4px)' }}
+                    animate={{ opacity: 1, filter: 'blur(0px)' }}
+                    transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
+                    style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
+                >
+                    <div className="flex items-center gap-2">
+                        <span>{starCount}+ GitHub stars</span>
+                    </div>
+                    <div className="bg-foreground-secondary h-1 w-1 rounded-full"></div>
+                    <div className="flex items-center gap-2">
+                        <span>YC W25</span>
+                    </div>
+                    <div className="bg-foreground-secondary h-1 w-1 rounded-full"></div>
+                    <div className="flex items-center gap-2">
+                        <span>Open Source</span>
+                    </div>
+                </motion.div>
+            </div>
+        </div>
+    );
+}
```

**File**: `apps/web/client/src/app/_components/hero/features-hero.tsx` (modified, +4/-5)
```diff
@@ -24,7 +24,7 @@ export function FeaturesHero() {
                     transition={{ duration: 0.6, ease: 'easeOut' }}
                     style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
                 >
-                    Visual Editor for React &amp; TailwindCSS Apps
+                    Features
                 </motion.h1>
                 <motion.p
                     className="text-center text-4xl !leading-[1] leading-tight font-light text-balance md:text-6xl"
@@ -33,17 +33,16 @@ export function FeaturesHero() {
                     transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                     style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
                 >
-                    The React Editor You've Been Waiting For
+                    Design with Your Real Components
                 </motion.p>
                 <motion.h2
-                    className="text-foreground-secondary mx-auto max-w-xl text-center text-lg"
+                    className="text-foreground-secondary mx-auto max-w-xl text-center text-lg text-balance"
                     initial={{ opacity: 0, filter: 'blur(4px)' }}
                     animate={{ opacity: 1, filter: 'blur(0px)' }}
                     transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                     style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
                 >
-                    Code as you design. Build React applications visually while Onlook writes
-                    reliable code you can trust, exactly where it needs to go.
+                    Connect your codebase. Design on the canvas. Ship PRs.
                 </motion.h2>
                 <motion.div
                     className="mt-8"
```

**File**: `apps/web/client/src/app/_components/hero/index.tsx` (modified, +2/-4)
```diff
@@ -73,11 +73,9 @@ export function Hero() {
                         transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                         style={{ willChange: 'opacity, filter', transform: 'translateZ(0)' }}
                     >
-                        Onlook is a next-generation visual code editor
+                        Design with your real components.
                         <br />
-                        that lets designers and product managers craft
-                        <br />
-                        web experiences with AI
+                        Ship PRs, not prototypes.
                     </motion.p>
                     <HighDemand />
                     <CreateError />
```

**File**: `apps/web/client/src/app/_components/landing-page/ai-features-intro-section.tsx` (modified, +3/-3)
```diff
@@ -5,13 +5,13 @@ export function AiFeaturesIntroSection() {
         <div className="w-full max-w-6xl mx-auto py-32 px-8 text-center">
             <div className="max-w-3xl mx-auto">
                 <h2 className="text-foreground-secondary text-sm font-medium uppercase tracking-wider mb-6">
-                    AI Design Tools with Visual Control
+                    Design on an Infinite Canvas
                 </h2>
                 <p className="text-foreground-primary text-2xl md:text-5xl leading-[1.1] font-light mb-8 text-balance">
-                    Visual Design Control Supercharged with AI
+                    Point at what you want. AI knows exactly what you mean.
                 </p>
                 <p className="text-foreground-secondary text-lg max-w-xl mx-auto text-balance">
-                    Get the precision of visual editing with the speed of AI generation. Design with complete creative control while AI handles the heavy lifting - from maintaining brand consistency to generating responsive layouts that match your exact vision.
+                    No more describing "the button in the top right" — just click it. AI is constrained to your design system, so outputs stay on-brand every time.
                 </p>
             </div>
         </div>
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

---

### Incident Patch 4: `2e6cda3b` (2025-12-14)
**Commit Message**: Fix DOM XSS vulnerability in text editor (CVE-2025-63785) (#3064)

* Fix DOM XSS vulnerability in text editor (CVE-2025-63785)

Escape HTML entities before inserting content via innerHTML to prevent
cross-site scripting attacks. User input is now sanitized using textContent
before being converted to HTML with <br> tags for newlines.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

* Improve XSS fix with CRLF normalization and DOM-based escaping

- Normalize Windows (CRLF) and Mac (CR) line endings to LF
- Use text nodes (createTextNode) for auto-escaping instead of innerHTML
- Build DOM by appending text nodes interleaved with explicit <br> elements
- Document security invariant: only escaped text and explicit <br> allowed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `apps/web/preload/script/api/elements/text.ts` (modified, +14/-3)
```diff
@@ -89,9 +89,20 @@ function removeEditingAttributes(el: HTMLElement) {
 }
 
 function updateTextContent(el: HTMLElement, content: string): void {
-    // Convert newlines to <br> tags in the DOM
-    const htmlContent = content.replace(/\n/g, '<br>');
-    el.innerHTML = htmlContent;
+    // SECURITY INVARIANT: Only escaped text nodes and explicit <br> elements are allowed.
+    // 1. Normalize line endings (CRLF/CR -> LF)
+    // 2. Split on newlines to get text segments
+    // 3. Build DOM with text nodes (auto-escaped) interleaved with <br> elements
+    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
+    const lines = normalized.split('\n');
+
+    el.innerHTML = '';
+    lines.forEach((line, index) => {
+        el.appendChild(document.createTextNode(line));
+        if (index < lines.length - 1) {
+            el.appendChild(document.createElement('br'));
+        }
+    });
 }
 
 function extractTextContent(el: HTMLElement): string {
```

---

### Incident Patch 5: `57ce1ccf` (2025-12-14)
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

### Incident Patch 6: `ccd2302f` (2025-10-24)
**Commit Message**: Fix: Upgrade next (#3028)

**File**: `apps/web/client/next.config.ts` (modified, +0/-3)
```diff
@@ -9,9 +9,6 @@ import './src/env';
 
 const nextConfig: NextConfig = {
     devIndicators: false,
-    eslint: {
-        ignoreDuringBuilds: true,
-    },
     ...(process.env.STANDALONE_BUILD === 'true' && { output: 'standalone' }),
 };
 
```

**File**: `apps/web/client/package.json` (modified, +9/-5)
```diff
@@ -81,7 +81,7 @@
         "lucide-react": "^0.486.0",
         "mobx-react-lite": "^4.1.0",
         "motion": "^12.23.19",
-        "next": "15.5.4",
+        "next": "16.0.0",
         "next-intl": "^4.0.2",
         "next-themes": "^0.4.6",
         "octokit": "^5.0.3",
@@ -91,10 +91,10 @@
         "prosemirror-commands": "^1.7.1",
         "prosemirror-history": "^1.4.1",
         "prosemirror-keymap": "^1.2.2",
-        "react": "^19.0.0",
+        "react": "19.2.0",
         "react-arborist": "^3.4.3",
         "react-codemirror-merge": "4.23.10",
-        "react-dom": "^19.0.0",
+        "react-dom": "19.2.0",
         "react-hotkeys-hook": "^5.0.1",
         "react-markdown": "^10.1.0",
         "remark-gfm": "^4.0.1",
@@ -118,8 +118,8 @@
         "@tailwindcss/postcss": "^4.0.15",
         "@types/culori": "^4.0.0",
         "@types/node": "^20.14.10",
-        "@types/react": "^19.0.0",
-        "@types/react-dom": "^19.0.0",
+        "@types/react": "19.2.2",
+        "@types/react-dom": "19.2.2",
         "@types/webfontloader": "^1.6.38",
         "eslint": "^9.0.0",
         "postcss": "^8.5.3",
@@ -129,5 +129,9 @@
     },
     "ct3aMetadata": {
         "initVersion": "7.39.2"
+    },
+    "overrides": {
+        "@types/react": "19.2.2",
+        "@types/react-dom": "19.2.2"
     }
 }
\ No newline at end of file
```

**File**: `apps/web/client/src/app/project/[id]/_components/canvas/frame/view.tsx` (modified, +260/-236)
```diff
@@ -1,26 +1,21 @@
 'use client';
 
-import { useEditorEngine } from '@/components/store/editor';
+import type { IframeHTMLAttributes } from 'react';
+import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
+import { observer } from 'mobx-react-lite';
+import { connect, WindowMessenger } from 'penpal';
+
 import type { Frame } from '@onlook/models';
-import {
-    PENPAL_PARENT_CHANNEL,
-    type PenpalChildMethods,
-    type PenpalParentMethods,
-    type PromisifiedPendpalChildMethods,
+import type {
+    PenpalChildMethods,
+    PenpalParentMethods,
+    PromisifiedPendpalChildMethods,
 } from '@onlook/penpal';
+import { PENPAL_PARENT_CHANNEL } from '@onlook/penpal';
 import { WebPreview, WebPreviewBody } from '@onlook/ui/ai-elements';
 import { cn } from '@onlook/ui/utils';
-import { observer } from 'mobx-react-lite';
-import { WindowMessenger, connect } from 'penpal';
-import {
-    forwardRef,
-    useEffect,
-    useImperativeHandle,
-    useMemo,
-    useRef,
-    useState,
-    type IframeHTMLAttributes,
-} from 'react';
+
+import { useEditorEngine } from '@/components/store/editor';
 
 export type IFrameView = HTMLIFrameElement & {
     setZoomLevel: (level: number) => void;
@@ -37,7 +32,11 @@ const createSafeFallbackMethods = (): PromisifiedPendpalChildMethods => {
 
             return async (..._args: any[]) => {
                 const method = String(prop);
-                if (method.startsWith('get') || method.includes('capture') || method.includes('build')) {
+                if (
+                    method.startsWith('get') ||
+                    method.includes('capture') ||
+                    method.includes('build')
+                ) {
                     return null;
                 }
                 if (method.includes('Count')) {
@@ -48,7 +47,7 @@ const createSafeFallbackMethods = (): PromisifiedPendpalChildMethods => {
                 }
                 return undefined;
             };
-        }
+        },
     });
 };
 
@@ -62,246 +61,271 @@ interface FrameViewProps extends IframeHTMLAttributes<HTMLIFrameElement> {
 }
 
 export const FrameComponent = observer(
-    forwardRef<IFrameView, FrameViewProps>(({ frame, reloadIframe, onConnectionFailed, onConnectionSuccess, penpalTimeoutMs = 5000, isInDragSelection = false, ...props }, ref) => {
-        const editorEngine = useEditorEngine();
-        const iframeRef = useRef<HTMLIFrameElement>(null);
-        const zoomLevel = useRef(1);
-        const isConnecting = useRef(false);
-        const connectionRef = useRef<ReturnType<typeof connect> | null>(null);
-        const [penpalChild, setPenpalChild] = useState<PenpalChildMethods | null>(null);
-        const isSelected = editorEngine.frames.isSelected(frame.id);
-        const isActiveBranch = editorEngine.branches.activeBranch.id === frame.branchId;
+    forwardRef<IFrameView, FrameViewProps>(
+        (
+            {
+                frame,
+                reloadIframe,
+                onConnectionFailed,
+                onConnectionSuccess,
+                penpalTimeoutMs = 5000,
+                isInDragSelection = false,
+                ...restProps
+            },
+            ref,
+        ) => {
+            const { popover, ...props } = restProps;
+            const editorEngine = useEditorEngine();
+            const iframeRef = useRef<HTMLIFrameElement>(null);
+            const zoomLevel = useRef(1);
+            const isConnecting = useRef(false);
+            const connectionRef = useRef<ReturnType<typeof connect> | null>(null);
+            const [penpalChild, setPenpalChild] = useState<PenpalChildMethods | null>(null);
+            const isSelected = editorEngine.frames.isSelected(frame.id);
+            const isActiveBranch = editorEngine.branches.activeBranch.id === frame.branchId;
 
-        const setupPenpalConnection = () => {
-            try {
-                if (!iframeRef.current?.contentWindow) {
-                    console.error(`${PENPAL_PARENT_CHANNEL} (${frame.id}) - No iframe found`);
-                    onConnectionFailed();
-                    return;
-                }
-
-                if (isConnecting.current) {
-                    console.log(
-                        `${PENPAL_PARENT_CHANNEL} (${frame.id}) - Connection already in progress`,
-                    );
-                    return;
-                }
-                isConnecting.current = true;
+            const setupPenpalConnection = () => {
+                try {
+                    if (!iframeRef.current?.contentWindow) {
+                        console.error(`${PENPAL_PARENT_CHANNEL} (${frame.id}) - No iframe found`);
+                        onConnectionFailed();
+                        return;
+                    }
 
-                // Destroy any existing connection
-                if (connectionRef.current) {
-                    connectionRef.current.destroy();
-                    connectionRef.current =
```

**File**: `apps/web/client/src/app/project/[id]/_components/left-panel/code-panel/code-tab/sidebar/file-tree.tsx` (modified, +4/-2)
```diff
@@ -1,3 +1,5 @@
+'use client';
+
 import { type FileEntry } from '@onlook/file-system/hooks';
 import { pathsEqual } from '@onlook/utility';
 import React, { useEffect, useMemo, useRef, useState } from 'react';
@@ -32,7 +34,7 @@ export const FileTree = ({
     const inputRef = useRef<HTMLInputElement>(null);
     const [searchQuery, setSearchQuery] = useState('');
     const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
-    const { ref: treeContainerRef, width: filesWidth, height: filesHeight } = useResizeObserver();
+    const { ref: resizeObserverRef, width: filesWidth, height: filesHeight } = useResizeObserver();
 
     // Create flat entry index for efficient operations
     const flatEntryIndex = useMemo(() => {
@@ -190,7 +192,7 @@ export const FileTree = ({
                 onRefresh={onRefresh}
                 onKeyDown={handleKeyDown}
             />
-            <div ref={treeContainerRef} className="w-full text-xs px-2 flex-1 min-h-0">
+            <div ref={resizeObserverRef} className="w-full text-xs px-2 flex-1 min-h-0">
                 {isLoading ? (
                     <div className="flex flex-col justify-start items-center h-full text-sm text-foreground/50 pt-4">
                         <div className="animate-spin h-6 w-6 border-2 border-foreground-hover rounded-full border-t-transparent mb-2"></div>
```

**File**: `apps/web/client/src/app/projects/import/local/_components/select-folder.tsx` (modified, +4/-2)
```diff
@@ -389,8 +389,10 @@ export const NewSelectFolder = () => {
                         type="file"
                         style={{ display: 'none' }}
                         onChange={handleFileInputChange}
-                        directory=""
-                        webkitdirectory=""
+                        {...({
+                            directory: '',
+                            webkitdirectory: '',
+                        } as React.InputHTMLAttributes<HTMLInputElement>)}
                     />
                 </motion.div>
             );
```

**File**: `apps/web/client/src/proxy.ts` (renamed, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import { updateSession } from '@/utils/supabase/middleware';
 import { type NextRequest } from 'next/server';
 
-export async function middleware(request: NextRequest) {
+export async function proxy(request: NextRequest) {
     // update user's auth session
     return await updateSession(request);
 }
```

**File**: `docs/content/docs/getting-started/core-features.mdx` (modified, +4/-6)
```diff
@@ -13,12 +13,10 @@ Onlook provides a range of features to help designers and developers work togeth
 ## Key Features
 
 <Cards>
-  <Card title="Visual Editor" href="#" />
-  <Card title="Code Integration" href="#" />
-  <Card title="AI Assistance" href="#" />
-  <Card title="Figma to Onlook" href="#" />
-  <Card title="Theme System" href="#" />
-  <Card title="Deployment" href="#" />
+  <Card title="Visual Editor" href="#visual-editor" />
+  <Card title="Code Integration" href="#code-integration" />
+  <Card title="AI Assistance" href="#ai-assistance" />
+  <Card title="Figma to Onlook" href="#figma-to-onlook" />
 </Cards>
 
 ## Visual Editor
```

**File**: `docs/next-sitemap.config.js` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 /** @type {import('next-sitemap').IConfig} */
-module.exports = {
+export default {
   siteUrl: 'https://docs.onlook.dev',
   generateRobotsTxt: false, // handled by route handler
   generateIndexSitemap: true,
```

---

### Incident Patch 7: `06bb72d3` (2025-10-22)
**Commit Message**: Fix: ensure that chat scrolls to bottom properly (even when resizing etc.) (#3024)

* First attempt at fixing chat scroll

* Much better

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-input/index.tsx` (modified, +11/-13)
```diff
@@ -1,8 +1,8 @@
 'use client';
 
+import { useEffect, useMemo, useRef, useState } from 'react';
 import { observer } from 'mobx-react-lite';
 import { useTranslations } from 'next-intl';
-import { useEffect, useMemo, useRef, useState } from 'react';
 import { v4 as uuidv4 } from 'uuid';
 import { z } from 'zod';
 
@@ -34,7 +34,6 @@ interface ChatInputProps {
     isStreaming: boolean;
     onStop: () => Promise<void>;
     onSendMessage: SendMessage;
-    onScrollToBottom: () => void;
     queuedMessages: QueuedMessage[];
     removeFromQueue: (id: string) => void;
 }
@@ -52,7 +51,6 @@ export const ChatInput = observer(
         isStreaming,
         onStop,
         onSendMessage,
-        onScrollToBottom,
         queuedMessages,
         removeFromQueue,
     }: ChatInputProps) => {
@@ -155,9 +153,6 @@ export const ChatInput = observer(
             try {
                 await onSendMessage(savedInput, chatMode);
                 setInputValue('');
-                setTimeout(() => {
-                    onScrollToBottom();
-                }, 0);
             } catch (error) {
                 console.error('Error sending message', error);
                 toast.error('Failed to send message. Please try again.');
@@ -288,7 +283,8 @@ export const ChatInput = observer(
                         source: 'external',
                         content: base64URL,
                         mimeType: file.type,
-                        displayName: customDisplayName && files.length === 1 ? customDisplayName : file.name,
+                        displayName:
+                            customDisplayName && files.length === 1 ? customDisplayName : file.name,
                     };
                     imageContexts.push(contextImage);
                 } catch (error) {
@@ -454,7 +450,7 @@ export const ChatInput = observer(
                                     <Button
                                         size={'icon'}
                                         variant={'secondary'}
-                                        className="text-smallPlus w-fit h-full py-0.5 px-2.5 text-primary bg-background-primary rounded-full"
+                                        className="text-smallPlus text-primary bg-background-primary h-full w-fit rounded-full px-2.5 py-0.5"
                                         onClick={() => {
                                             setActionTooltipOpen(false);
                                             void onStop();
@@ -463,19 +459,21 @@ export const ChatInput = observer(
                                         <Icons.Stop />
                                     </Button>
                                 </TooltipTrigger>
-                                <TooltipContent side="top" sideOffset={6} hideArrow>{'Stop response'}</TooltipContent>
+                                <TooltipContent side="top" sideOffset={6} hideArrow>
+                                    {'Stop response'}
+                                </TooltipContent>
                             </Tooltip>
                         ) : (
                             <Button
                                 size={'icon'}
                                 variant={'secondary'}
                                 className={cn(
-                                    "text-smallPlus w-fit h-full py-0.5 px-2.5 rounded-full",
+                                    'text-smallPlus h-full w-fit rounded-full px-2.5 py-0.5',
                                     inputEmpty
-                                        ? "text-primary"
+                                        ? 'text-primary'
                                         : chatMode === ChatType.ASK
-                                            ? "bg-blue-300 text-background hover:bg-blue-600"
-                                            : "bg-foreground-primary text-background hover:bg-foreground-primary/80"
+                                            ? 'text-background bg-blue-300 hover:bg-blue-600'
+                                            : 'bg-foreground-primary text-background hover:bg-foreground-primary/80',
                                 )}
                                 disabled={inputEmpty}
                                 onClick={() => void sendMessage()}
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/index.tsx` (modified, +3/-32)
```diff
@@ -13,8 +13,7 @@ import { Icons } from '@onlook/ui/icons';
 import { assertNever } from '@onlook/utility';
 import { observer } from 'mobx-react-lite';
 import { useTranslations } from 'next-intl';
-import { forwardRef, useCallback, useImperativeHandle } from 'react';
-import { useStickToBottomContext } from 'use-stick-to-bottom';
+import { useCallback } from 'react';
 import { AssistantMessage } from './assistant-message';
 import { ErrorMessage } from './error-message';
 import { UserMessage } from './user-message';
@@ -26,11 +25,7 @@ interface ChatMessagesProps {
     error?: Error;
 }
 
-export interface ChatMessagesHandle {
-    scrollToBottom: () => void;
-}
-
-const ChatMessagesInner = observer(({
+export const ChatMessages = observer(({
     messages,
     onEditMessage,
     isStreaming,
@@ -80,7 +75,7 @@ const ChatMessagesInner = observer(({
     }
 
     return (
-        <>
+        <Conversation>
             <ConversationContent className="p-0 m-0">
                 {messages.map((message) => renderMessage(message))}
                 {error && <ErrorMessage error={error} />}
@@ -90,30 +85,6 @@ const ChatMessagesInner = observer(({
                 </div>}
             </ConversationContent>
             <ConversationScrollButton />
-        </>
-    );
-});
-
-export const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(({ messages, onEditMessage, isStreaming, error }, ref) => {
-    const ScrollController = () => {
-        const { scrollToBottom } = useStickToBottomContext();
-
-        useImperativeHandle(ref, () => ({
-            scrollToBottom,
-        }), [scrollToBottom]);
-
-        return null;
-    };
-
-    return (
-        <Conversation>
-            <ScrollController />
-            <ChatMessagesInner
-                messages={messages}
-                onEditMessage={onEditMessage}
-                isStreaming={isStreaming}
-                error={error}
-            />
         </Conversation>
     );
 });
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-tab-content/index.tsx` (modified, +1/-9)
```diff
@@ -1,8 +1,7 @@
 import { type ChatMessage } from '@onlook/models';
-import { useRef } from 'react';
 import { useChat } from '../../../../_hooks/use-chat';
 import { ChatInput } from '../chat-input';
-import { type ChatMessagesHandle, ChatMessages } from '../chat-messages';
+import { ChatMessages } from '../chat-messages';
 import { ErrorSection } from '../error';
 
 interface ChatTabContentProps {
@@ -21,16 +20,10 @@ export const ChatTabContent = ({
         projectId,
         initialMessages,
     });
-    const chatMessagesRef = useRef<ChatMessagesHandle>(null);
-
-    const handleScrollToBottom = () => {
-        chatMessagesRef.current?.scrollToBottom();
-    };
 
     return (
         <div className="flex flex-col h-full justify-end gap-2 pt-2">
             <ChatMessages
-                ref={chatMessagesRef}
                 messages={messages}
                 isStreaming={isStreaming}
                 error={error}
@@ -42,7 +35,6 @@ export const ChatTabContent = ({
                 isStreaming={isStreaming}
                 onStop={stop}
                 onSendMessage={sendMessage}
-                onScrollToBottom={handleScrollToBottom}
                 queuedMessages={queuedMessages}
                 removeFromQueue={removeFromQueue}
             />
```

---

### Incident Patch 8: `59df63f7` (2025-10-20)
**Commit Message**: Fix performance of chat panel during streaming (#3020)

* Still not perfect, something struggling during tool edit streaming

* Pin bun version to avoid issues with bun 1.3

* Try bun 1.2.23

**File**: `.github/workflows/ci.yml` (modified, +3/-4)
```diff
@@ -17,8 +17,7 @@ jobs:
 
   #     - uses: oven-sh/setup-bun@v1
   #       with:
-  #         bun-version: latest
-
+  #         bun-version: 1.2.21
   #     - name: Cache dependencies
   #       uses: actions/cache@v4
   #       with:
@@ -41,7 +40,7 @@ jobs:
 
       - uses: oven-sh/setup-bun@v1
         with:
-          bun-version: latest
+          bun-version: 1.2.21
 
       - name: Cache dependencies
         uses: actions/cache@v4
@@ -65,7 +64,7 @@ jobs:
 
       - uses: oven-sh/setup-bun@v1
         with:
-          bun-version: latest
+          bun-version: 1.2.21
 
       - name: Cache dependencies
         uses: actions/cache@v4
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/assistant-message.tsx` (modified, +5/-1)
```diff
@@ -1,7 +1,9 @@
 import type { ChatMessage } from '@onlook/models';
+import { observer } from 'mobx-react-lite';
+import { memo } from 'react';
 import { MessageContent } from './message-content';
 
-export const AssistantMessage = ({ message, isStreaming }: { message: ChatMessage, isStreaming: boolean }) => {
+const AssistantMessageComponent = ({ message, isStreaming }: { message: ChatMessage, isStreaming: boolean }) => {
     return (
         <div className="px-4 py-2 text-small content-start flex flex-col text-wrap gap-2">
             <MessageContent
@@ -13,3 +15,5 @@ export const AssistantMessage = ({ message, isStreaming }: { message: ChatMessag
         </div>
     );
 };
+
+export const AssistantMessage = memo(observer(AssistantMessageComponent));
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/message-content/index.tsx` (modified, +4/-1)
```diff
@@ -2,9 +2,10 @@ import type { ChatMessage } from '@onlook/models';
 import { Reasoning, ReasoningContent, ReasoningTrigger, Response } from '@onlook/ui/ai-elements';
 import { cn } from '@onlook/ui/utils';
 import type { ToolUIPart } from 'ai';
+import { observer } from 'mobx-react-lite';
 import { ToolCallDisplay } from './tool-call-display';
 
-export const MessageContent = ({
+const MessageContentComponent = ({
     messageId,
     parts,
     applied,
@@ -69,3 +70,5 @@ export const MessageContent = ({
         </div>
     );
 };
+
+export const MessageContent = observer(MessageContentComponent);
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/message-content/tool-call-display.tsx` (modified, +5/-2)
```diff
@@ -1,14 +1,15 @@
 import { FuzzyEditFileTool, SearchReplaceEditTool, SearchReplaceMultiEditFileTool, TerminalCommandTool, TypecheckTool, WebSearchTool, WriteFileTool } from '@onlook/ai';
 import type { WebSearchResult } from '@onlook/models';
 import type { ToolUIPart } from 'ai';
+import { observer } from 'mobx-react-lite';
 import stripAnsi from 'strip-ansi';
 import { type z } from 'zod';
 import { BashCodeDisplay } from '../../code-display/bash-code-display';
 import { CollapsibleCodeBlock } from '../../code-display/collapsible-code-block';
 import { SearchSourcesDisplay } from '../../code-display/search-sources-display';
 import { ToolCallSimple } from './tool-call-simple';
 
-export const ToolCallDisplay = ({
+const ToolCallDisplayComponent = ({
     messageId,
     toolPart,
     isStream,
@@ -224,4 +225,6 @@ export const ToolCallDisplay = ({
             key={toolPart.toolCallId}
         />
     );
-}
+};
+
+export const ToolCallDisplay = observer(ToolCallDisplayComponent);
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/message-content/tool-call-simple.tsx` (modified, +9/-6)
```diff
@@ -2,16 +2,17 @@ import { BaseTool, TOOLS_MAP } from '@onlook/ai';
 import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@onlook/ui/ai-elements';
 import { Icons } from '@onlook/ui/icons';
 import type { ToolUIPart } from 'ai';
+import { memo } from 'react';
 
-export function ToolCallSimple({
+const ToolCallSimpleComponent = ({
     toolPart,
     className,
     loading,
 }: {
     toolPart: ToolUIPart;
     className?: string;
     loading?: boolean;
-}) {
+}) => {
     const toolName = toolPart.type.split('-')[1] ?? '';
     const ToolClass = TOOLS_MAP.get(toolName);
     const Icon = ToolClass?.icon ?? Icons.QuestionMarkCircled;
@@ -21,12 +22,14 @@ export function ToolCallSimple({
         <Tool className={className}>
             <ToolHeader loading={loading} title={title} type={toolPart.type} state={toolPart.state} icon={<Icon className="w-4 h-4 flex-shrink-0" />} />
             <ToolContent>
-                <ToolInput input={toolPart.input} />
-                <ToolOutput errorText={toolPart.errorText} output={toolPart.output} />
+                <ToolInput input={toolPart.input} isStreaming={loading} />
+                <ToolOutput errorText={toolPart.errorText} output={toolPart.output} isStreaming={loading} />
             </ToolContent>
         </Tool>
-    )
-}
+    );
+};
+
+export const ToolCallSimple = memo(ToolCallSimpleComponent);
 
 function getDefaultToolLabel(toolName: string): string {
     return toolName?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/user-message.tsx` (modified, +5/-2)
```diff
@@ -1,4 +1,4 @@
-import React, { useEffect, useRef, useState } from 'react';
+import React, { memo, useEffect, useRef, useState } from 'react';
 import { nanoid } from 'nanoid';
 
 import type { ChatMessage, GitMessageCheckpoint } from '@onlook/models';
@@ -21,6 +21,7 @@ import { cn } from '@onlook/ui/utils';
 import type { EditMessage } from '@/app/project/[id]/_hooks/use-chat';
 import { useEditorEngine } from '@/components/store/editor';
 import { restoreCheckpoint } from '@/components/store/editor/git';
+import { observer } from 'mobx-react-lite';
 import { SentContextPill } from '../context-pills/sent-context-pill';
 import { MessageContent } from './message-content';
 import { MultiBranchRevertModal } from './multi-branch-revert-modal';
@@ -41,7 +42,7 @@ export const getUserMessageContent = (message: ChatMessage) => {
         .join('');
 };
 
-export const UserMessage = ({ onEditMessage, message }: UserMessageProps) => {
+const UserMessageComponent = ({ onEditMessage, message }: UserMessageProps) => {
     const editorEngine = useEditorEngine();
     const [isCopied, setIsCopied] = useState(false);
     const [isEditing, setIsEditing] = useState(false);
@@ -328,3 +329,5 @@ export const UserMessage = ({ onEditMessage, message }: UserMessageProps) => {
         </div>
     );
 };
+
+export const UserMessage = memo(observer(UserMessageComponent));
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/code-display/collapsible-code-block.tsx` (modified, +39/-33)
```diff
@@ -5,7 +5,8 @@ import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@onlook/ui/
 import { Icons } from '@onlook/ui/icons';
 import { cn, getTruncatedFileName } from '@onlook/ui/utils';
 import { AnimatePresence, motion } from 'motion/react';
-import { useState } from 'react';
+import { observer } from 'mobx-react-lite';
+import { memo, useState } from 'react';
 
 interface CollapsibleCodeBlockProps {
     path: string;
@@ -16,7 +17,7 @@ interface CollapsibleCodeBlockProps {
     branchId?: string;
 }
 
-export const CollapsibleCodeBlock = ({
+const CollapsibleCodeBlockComponent = ({
     path,
     content,
     isStream,
@@ -36,6 +37,10 @@ export const CollapsibleCodeBlock = ({
         return isOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 };
     };
 
+    const branch = branchId
+        ? editorEngine.branches.allBranches.find(b => b.id === branchId)
+        : editorEngine.branches.activeBranch;
+
     return (
         <div className="group relative">
             <Collapsible open={isOpen} onOpenChange={setIsOpen}>
@@ -70,16 +75,11 @@ export const CollapsibleCodeBlock = ({
                                     )}
                                 >
                                     <span className="truncate flex-1 min-w-0">{getTruncatedFileName(path)}</span>
-                                    {(() => {
-                                        const branch = branchId
-                                            ? editorEngine.branches.allBranches.find(b => b.id === branchId)
-                                            : editorEngine.branches.activeBranch;
-                                        return branch && (
-                                            <span className="text-foreground-tertiary group-hover:text-foreground-secondary text-mini ml-0.5 flex-shrink-0 truncate max-w-24">
-                                                {' • '}{branch.name}
-                                            </span>
-                                        );
-                                    })()}
+                                    {branch && (
+                                        <span className="text-foreground-tertiary group-hover:text-foreground-secondary text-mini ml-0.5 flex-shrink-0 truncate max-w-24">
+                                            {' • '}{branch.name}
+                                        </span>
+                                    )}
                                 </div>
                             </div>
                         </CollapsibleTrigger>
@@ -93,28 +93,32 @@ export const CollapsibleCodeBlock = ({
                                 transition={{ duration: 0.2, ease: 'easeInOut' }}
                                 style={{ overflow: 'hidden' }}
                             >
-                                <div className="border-t">
-                                    <CodeBlock code={content} language="jsx" className="text-xs overflow-x-auto" />
-                                    <div className="flex justify-end gap-1.5 p-1 border-t">                                        <Button
-                                        size="sm"
-                                        variant="ghost"
-                                        className="h-7 px-2 text-foreground-secondary hover:text-foreground font-sans select-none"
-                                        onClick={copyToClipboard}
-                                    >
-                                        {copied ? (
-                                            <>
-                                                <Icons.Check className="h-4 w-4 mr-2" />
-                                                Copied
-                                            </>
-                                        ) : (
-                                            <>
-                                                <Icons.Copy className="h-4 w-4 mr-2" />
-                                                Copy
-                                            </>
-                                        )}
-                                    </Button>
+                                {/* Only render this content when open to avoid rendering the expensive code block. */}
+                                {isOpen && (
+                                    <div className="border-t">
+                                        <CodeBlock code={content} language="jsx" isStreaming={isStream} className="text-xs overflow-x-auto" />
+                                        <div className="flex justify-end gap-1.5 p-1 border-t">
+                                            <Button
+                                                size="sm"
+                                                variant="ghost"
+                                                className="h-7 px-2 text-foreground-secondary hover:text-foreground font-sans select-none"
+                                                onClick={copyT
```

**File**: `bun.lock` (modified, +11/-37)
```diff
@@ -8,38 +8,8 @@
       },
     },
     "apps/admin": {
-      "name": "@onlook/admin",
-      "version": "0.1.0",
-      "dependencies": {
-        "@onlook/db": "*",
-        "@onlook/ui": "*",
-        "@onlook/utility": "*",
-        "@supabase/ssr": "^0.6.1",
-        "@supabase/supabase-js": "^2.45.4",
-        "@t3-oss/env-nextjs": "^0.12.0",
-        "@tanstack/react-query": "^5.69.0",
-        "@trpc/client": "^11.0.0",
-        "@trpc/react-query": "^11.0.0",
-        "@trpc/server": "^11.0.0",
-        "next": ">=15.5.3",
-        "react": "^19.0.0",
-        "react-dom": "^19.0.0",
-        "server-only": "^0.0.1",
-        "superjson": "^2.2.1",
-        "zod": "^4.1.3",
-      },
-      "devDependencies": {
-        "@onlook/eslint": "*",
-        "@onlook/typescript": "*",
-        "@tailwindcss/postcss": "^4.0.15",
-        "@types/node": "^20.14.10",
-        "@types/react": "^19.0.0",
-        "@types/react-dom": "^19.0.0",
-        "eslint": "^9.0.0",
-        "postcss": "^8.5.3",
-        "tailwindcss": "^4.0.15",
-        "typescript": "^5.5.4",
-      },
+      "name": "admin",
+      "version": "0.0.0",
     },
     "apps/backend": {
       "name": "@onlook/backend",
@@ -1350,8 +1320,6 @@
 
     "@octokit/webhooks-types": ["@octokit/webhooks-types@7.6.1", "", {}, "sha512-S8u2cJzklBC0FgTwWVLaM8tMrDuDMVE4xiTK4EYXM9GntyvrdbSoxqDQa+Fh57CCNApyIpyeqPhhFEmHPfrXgw=="],
 
-    "@onlook/admin": ["@onlook/admin@workspace:apps/admin"],
-
     "@onlook/ai": ["@onlook/ai@workspace:packages/ai"],
 
     "@onlook/backend": ["@onlook/backend@workspace:apps/backend"],
@@ -1876,7 +1844,7 @@
 
     "@types/ms": ["@types/ms@2.1.0", "", {}, "sha512-GsCCIZDE/p3i96vtEqx+7dBUGXrc7zeSK3wwPHIaRThS+9OhWIXRqzs4d6k1SVU8g91DrNRWxWUGhp5KXQb2VA=="],
 
-    "@types/node": ["@types/node@20.19.17", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-gfehUI8N1z92kygssiuWvLiwcbOB3IRktR6hTDgJlXMYh5OvkPSRmgfoBUmfZt+vhwJtX7v1Yw4KvvAf7c5QKQ=="],
+    "@types/node": ["@types/node@22.15.12", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-K0fpC/ZVeb8G9rm7bH7vI0KAec4XHEhBam616nVJCV51bKzJ6oA3luG4WdKoaztxe70QaNjS/xBmcDLmr4PiGw=="],
 
     "@types/node-fetch": ["@types/node-fetch@2.6.13", "", { "dependencies": { "@types/node": "*", "form-data": "^4.0.4" } }, "sha512-QGpRVpzSaUs30JBSGPjOg4Uveu384erbHBoT1zeONvyCfwQxIkUshLAOqN/k9EjGviPRmWTTe6aH2qySWKTVSw=="],
 
@@ -2008,6 +1976,8 @@
 
     "acorn-jsx": ["acorn-jsx@5.3.2", "", { "peerDependencies": { "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0" } }, "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ=="],
 
+    "admin": ["admin@workspace:apps/admin"],
+
     "agent-base": ["agent-base@7.1.4", "", {}, "sha512-MnA+YT8fwfJPgBx3m60MNqakm30XOkyIoH1y6huTQvC0PwZG7ki8NacLBcrPbNoo8vEZy7Jpuk7+jMO+CUovTQ=="],
 
     "agentkeepalive": ["agentkeepalive@4.6.0", "", { "dependencies": { "humanize-ms": "^1.2.1" } }, "sha512-kja8j7PjmncONqaTsB8fQ+wE2mSU2DJ9D4XKoJ5PFWIdRMa6SLSN1ff4mOr4jCbfRSsxR4keIiySJU0N9T5hIQ=="],
@@ -4678,8 +4648,6 @@
 
     "@octokit/rest/@octokit/plugin-paginate-rest": ["@octokit/plugin-paginate-rest@11.4.4-cjs.2", "", { "dependencies": { "@octokit/types": "^13.7.0" }, "peerDependencies": { "@octokit/core": "5" } }, "sha512-2dK6z8fhs8lla5PaOTgqfCGBxgAv/le+EhPs27KklPhm1bKObpu6lXzwfUEQ16ajXzqNrKMujsFyo9K2eaoISw=="],
 
-    "@onlook/docs/@types/node": ["@types/node@22.15.12", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-K0fpC/ZVeb8G9rm7bH7vI0KAec4XHEhBam616nVJCV51bKzJ6oA3luG4WdKoaztxe70QaNjS/xBmcDLmr4PiGw=="],
-
     "@onlook/email/react": ["react@19.1.0", "", {}, "sha512-FS+XFBNvn3GTAWq26joslQgWNoFu08F4kl0J4CgdNKADkdSGXQyTCnKteIAJy96Br6YbpEU1LSzV5dYtjMkMDg=="],
 
     "@onlook/email/react-dom": ["react-dom@19.1.0", "", { "dependencies": { "scheduler": "^0.26.0" }, "peerDependencies": { "react": "^19.1.0" } }, "sha512-Xs1hdnE+DyKgeHJeJznQmYMIBG3TKIHJJT95Q58nHLSrElKlGQqDTR2HQ9fx5CN/Gk6Vh/kupBTDLU11/nDk/g=="],
@@ -4690,6 +4658,10 @@
 
     "@onlook/github/@types/node": ["@types/node@18.19.127", "", { "dependencies": { "undici-types": "~5.26.4" } }, "sha512-gSjxjrnKXML/yo0BO099uPixMqfpJU0TKYjpfLU7TrtA2WWDki412Np/RSTPRil1saKBhvVVKzVx/p/6p94nVA=="],
 
+    "@onlook/prettier/@types/node": ["@types/node@20.19.17", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-gfehUI8N1z92kygssiuWvLiwcbOB3IRktR6hTDgJlXMYh5OvkPSRmgfoBUmfZt+vhwJtX7v1Yw4KvvAf7c5QKQ=="],
+
+    "@onlook/scripts/@types/node": ["@types/node@20.19.17", "", { "dependencies": { "undici-types": "~6.21.0" } }, "sha512-gfehUI8N1z92kygssiuWvLiwcbOB3IRktR6hTDgJlXMYh5OvkPSRmgfoBUmfZt+vhwJtX7v1Yw4KvvAf7c5QKQ=="],
+
     "@onlook/stripe/dotenv": ["dotenv@16.6.1", "", {}, "sha512-uBq4egWHTcTt33a72vpSG0z3HnPuIl6NqYcTrKEg2azoEyl2hpW0zqlxysq2pK9HlDIHyHyakeYaYnSAwd8bow=="],
 
     "@onlook/ui/react": ["react@18.3.1", "", { "dependencies": { "loose-envify": "^1.1.0" } }, "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i
```

---

### Incident Patch 9: `98bfe0b6` (2025-10-14)
**Commit Message**: fix: drop over images (#3017)

**File**: `apps/web/client/src/app/project/[id]/_components/left-panel/design-panel/image-tab/image-item.tsx` (modified, +7/-0)
```diff
@@ -173,6 +173,13 @@ export const ImageItem = ({ image, projectId, branchId, onImageDragStart, onImag
                 className="aspect-square bg-background-secondary rounded-md border border-border-primary overflow-hidden cursor-pointer hover:border-border-onlook transition-colors relative"
                 onDragStart={handleDragStart}
                 onDragEnd={onImageDragEnd}
+                onDragOver={(e) => {
+                    // Allow external file drops by preventing default but not stopping propagation
+                    const isExternalDrag = e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/json');
+                    if (isExternalDrag) {
+                        e.preventDefault();
+                    }
+                }}
                 onMouseDown={onImageMouseDown}
                 onMouseUp={onImageMouseUp}
             >
```

---

### Incident Patch 10: `71639253` (2025-10-14)
**Commit Message**: fix: message rendering (#3016)

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/index.tsx` (modified, +5/-5)
```diff
@@ -40,7 +40,7 @@ const ChatMessagesInner = observer(({
     const t = useTranslations();
 
     const renderMessage = useCallback(
-        (message: ChatMessage, index: number) => {
+        (message: ChatMessage) => {
             let messageNode;
             switch (message.role) {
                 case 'assistant':
@@ -61,9 +61,9 @@ const ChatMessagesInner = observer(({
                 default:
                     assertNever(message.role);
             }
-            return <div key={`message-${message.id}-${index}`} className="my-2">{messageNode}</div>;
+            return <div key={message.id} className="my-2">{messageNode}</div>;
         },
-        [onEditMessage],
+        [onEditMessage, isStreaming],
     );
 
     if (!messages || messages.length === 0) {
@@ -82,7 +82,7 @@ const ChatMessagesInner = observer(({
     return (
         <>
             <ConversationContent className="p-0 m-0">
-                {messages.map((message, index) => renderMessage(message, index))}
+                {messages.map((message) => renderMessage(message))}
                 {error && <ErrorMessage error={error} />}
                 {isStreaming && <div className="flex w-full h-full flex-row items-center gap-2 px-4 my-2 text-small content-start text-foreground-secondary">
                     <Icons.LoadingSpinner className="animate-spin" />
@@ -106,7 +106,7 @@ export const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(({
     };
 
     return (
-        <Conversation className="h-full w-full flex-1">
+        <Conversation>
             <ScrollController />
             <ChatMessagesInner
                 messages={messages}
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/code-display/collapsible-code-block.tsx` (modified, +2/-9)
```diff
@@ -1,11 +1,9 @@
 import { useEditorEngine } from '@/components/store/editor';
-import { api } from '@/trpc/react';
 import { CodeBlock } from '@onlook/ui/ai-elements';
 import { Button } from '@onlook/ui/button';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@onlook/ui/collapsible';
 import { Icons } from '@onlook/ui/icons';
 import { cn, getTruncatedFileName } from '@onlook/ui/utils';
-import { observer } from 'mobx-react-lite';
 import { AnimatePresence, motion } from 'motion/react';
 import { useState } from 'react';
 
@@ -18,13 +16,12 @@ interface CollapsibleCodeBlockProps {
     branchId?: string;
 }
 
-export const CollapsibleCodeBlock = observer(({
+export const CollapsibleCodeBlock = ({
     path,
     content,
     isStream,
     branchId,
 }: CollapsibleCodeBlockProps) => {
-    const { data: settings } = api.user.settings.get.useQuery();
     const editorEngine = useEditorEngine();
     const [isOpen, setIsOpen] = useState(false);
     const [copied, setCopied] = useState(false);
@@ -36,9 +33,6 @@ export const CollapsibleCodeBlock = observer(({
     };
 
     const getAnimation = () => {
-        if (isStream && settings?.chat?.expandCodeBlocks) {
-            return { height: 'auto', opacity: 1 };
-        }
         return isOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 };
     };
 
@@ -90,7 +84,6 @@ export const CollapsibleCodeBlock = observer(({
                             </div>
                         </CollapsibleTrigger>
                     </div>
-
                     <CollapsibleContent forceMount>
                         <AnimatePresence mode="wait">
                             <motion.div
@@ -129,4 +122,4 @@ export const CollapsibleCodeBlock = observer(({
             </Collapsible>
         </div >
     );
-});
+};
```

---

### Incident Patch 11: `cf313231` (2025-10-14)
**Commit Message**: fix: message observers (#3015)

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/index.tsx` (modified, +21/-22)
```diff
@@ -94,28 +94,27 @@ const ChatMessagesInner = observer(({
     );
 });
 
-export const ChatMessages = observer(
-    forwardRef<ChatMessagesHandle, ChatMessagesProps>(({ messages, onEditMessage, isStreaming, error }, ref) => {
-        const ScrollController = () => {
-            const { scrollToBottom } = useStickToBottomContext();
+export const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(({ messages, onEditMessage, isStreaming, error }, ref) => {
+    const ScrollController = () => {
+        const { scrollToBottom } = useStickToBottomContext();
 
-            useImperativeHandle(ref, () => ({
-                scrollToBottom,
-            }), [scrollToBottom]);
+        useImperativeHandle(ref, () => ({
+            scrollToBottom,
+        }), [scrollToBottom]);
 
-            return null;
-        };
+        return null;
+    };
+
+    return (
+        <Conversation className="h-full w-full flex-1">
+            <ScrollController />
+            <ChatMessagesInner
+                messages={messages}
+                onEditMessage={onEditMessage}
+                isStreaming={isStreaming}
+                error={error}
+            />
+        </Conversation>
+    );
+});
 
-        return (
-            <Conversation className="h-full w-full flex-1">
-                <ScrollController />
-                <ChatMessagesInner
-                    messages={messages}
-                    onEditMessage={onEditMessage}
-                    isStreaming={isStreaming}
-                    error={error}
-                />
-            </Conversation>
-        );
-    })
-);
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/message-content/index.tsx` (modified, +59/-62)
```diff
@@ -2,73 +2,70 @@ import type { ChatMessage } from '@onlook/models';
 import { Reasoning, ReasoningContent, ReasoningTrigger, Response } from '@onlook/ui/ai-elements';
 import { cn } from '@onlook/ui/utils';
 import type { ToolUIPart } from 'ai';
-import { observer } from 'mobx-react-lite';
 import { ToolCallDisplay } from './tool-call-display';
 
-export const MessageContent = observer(
-    ({
-        messageId,
-        parts,
-        applied,
-        isStream,
-    }: {
-        messageId: string;
-        parts: ChatMessage['parts'];
-        applied: boolean;
-        isStream: boolean;
-    }) => {
-        let lastIncompleteToolIndex = -1;
-        if (isStream) {
-            for (let i = parts.length - 1; i >= 0; i--) {
-                const part = parts[i];
-                if (part?.type.startsWith('tool-')) {
-                    const toolPart = part as ToolUIPart;
-                    if (toolPart.state !== 'output-available') {
-                        lastIncompleteToolIndex = i;
-                        break;
-                    }
+export const MessageContent = ({
+    messageId,
+    parts,
+    applied,
+    isStream,
+}: {
+    messageId: string;
+    parts: ChatMessage['parts'];
+    applied: boolean;
+    isStream: boolean;
+}) => {
+    let lastIncompleteToolIndex = -1;
+    if (isStream) {
+        for (let i = parts.length - 1; i >= 0; i--) {
+            const part = parts[i];
+            if (part?.type.startsWith('tool-')) {
+                const toolPart = part as ToolUIPart;
+                if (toolPart.state !== 'output-available') {
+                    lastIncompleteToolIndex = i;
+                    break;
                 }
             }
         }
+    }
 
-        const renderedParts = parts.map((part, idx) => {
-            if (part?.type === 'text') {
-                return (
-                    <Response key={part.text}>
-                        {part.text}
-                    </Response>
+    const renderedParts = parts.map((part, idx) => {
+        if (part?.type === 'text') {
+            return (
+                <Response key={part.text}>
+                    {part.text}
+                </Response>
 
-                );
-            } else if (part?.type.startsWith('tool-')) {
-                const toolPart = part as ToolUIPart;// Only show loading animation for the last incomplete tool call
-                const isLoadingThisTool = isStream && idx === lastIncompleteToolIndex;
-                return (
-                    <ToolCallDisplay
-                        messageId={messageId}
-                        toolPart={toolPart}
-                        key={toolPart.toolCallId}
-                        isStream={isLoadingThisTool}
-                        applied={applied}
-                    />
-                );
-            } else if (part?.type === 'reasoning') {
-                const isLastPart = idx === parts.length - 1;
-                return (
-                    <Reasoning key={part.text} className={cn(
-                        "px-2 m-0 items-center gap-2 text-foreground-tertiary",
-                        isStream && isLastPart && "bg-gradient-to-l from-white/20 via-white/90 to-white/20 bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer filter drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
-                    )} isStreaming={isStream}>
-                        <ReasoningTrigger />
-                        <ReasoningContent className="text-xs">{part.text}</ReasoningContent>
-                    </Reasoning>
-                );
-            }
-        })
+            );
+        } else if (part?.type.startsWith('tool-')) {
+            const toolPart = part as ToolUIPart;// Only show loading animation for the last incomplete tool call
+            const isLoadingThisTool = isStream && idx === lastIncompleteToolIndex;
+            return (
+                <ToolCallDisplay
+                    messageId={messageId}
+                    toolPart={toolPart}
+                    key={toolPart.toolCallId}
+                    isStream={isLoadingThisTool}
+                    applied={applied}
+                />
+            );
+        } else if (part?.type === 'reasoning') {
+            const isLastPart = idx === parts.length - 1;
+            return (
+                <Reasoning key={part.text} className={cn(
+                    "px-2 m-0 items-center gap-2 text-foreground-tertiary",
+                    isStream && isLastPart && "bg-gradient-to-l from-white/20 via-white/90 to-white/20 bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer filter drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]"
+                )} isStreaming={isStream}>
+                    <ReasoningTrigger />
+                    <ReasoningContent className="text-xs">{part.text}</ReasoningContent>
+                </Reasoning>
+            );
+        }
+    })
 
-        return (
-            <div className="select-text">
-          
```

---

### Incident Patch 12: `a340d3c8` (2025-10-14)
**Commit Message**: fix: allow selecting (#3008)

**File**: `apps/admin` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 6e3f069b0223cc23dbcf13baf841b3ea1656bbf7
+Subproject commit 78b0654a2ba431f3ff5bd6688f4f3f6e7222c0ef
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/chat-messages/message-content/index.tsx` (modified, +2/-2)
```diff
@@ -66,9 +66,9 @@ export const MessageContent = observer(
         })
 
         return (
-            <>
+            <div className="select-text">
                 {renderedParts}
-            </>
+            </div>
         );
     },
 );
```

---

### Incident Patch 13: `acb8ed63` (2025-10-13)
**Commit Message**: fix: remove default mobile frame (#3003)

**File**: `apps/web/client/src/server/api/routers/project/fork.ts` (modified, +1/-8)
```diff
@@ -154,14 +154,7 @@ function createDefaultFramesForDefaultBranch(
         type: DefaultFrameType.DESKTOP,
     });
 
-    const mobileFrame = createDefaultFrame({
-        canvasId,
-        branchId: defaultBranchMap.newBranch.id,
-        url: defaultBranchMap.newSandboxUrl,
-        type: DefaultFrameType.MOBILE,
-    });
-
-    return [desktopFrame, mobileFrame];
+    return [desktopFrame];
 }
 
 export const fork = protectedProcedure
```

**File**: `apps/web/client/src/server/api/routers/project/project.ts` (modified, +0/-7)
```diff
@@ -284,13 +284,6 @@ export const projectRouter = createTRPCRouter({
                     type: DefaultFrameType.DESKTOP,
                 });
                 await tx.insert(frames).values(desktopFrame);
-                const mobileFrame = createDefaultFrame({
-                    canvasId: newCanvas.id,
-                    branchId: newBranch.id,
-                    url: input.sandboxUrl,
-                    type: DefaultFrameType.MOBILE,
-                });
-                await tx.insert(frames).values(mobileFrame);
 
                 // 6. Create the default chat conversation
                 await tx.insert(conversations).values(createDefaultConversation(newProject.id));
```

**File**: `packages/db/src/defaults/frame.ts` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@ export enum DefaultFrameType {
 }
 
 export const DefaultDesktopFrame = {
-    x: '5',
-    y: '0',
+    x: '150',
+    y: '40',
     width: '1536',
     height: '960',
 } as const;
```

---

### Incident Patch 14: `e55350f4` (2025-10-13)
**Commit Message**: fix: select first frame and conversation arrow ui (#3002)

**File**: `apps/web/client/src/components/store/editor/frames/manager.ts` (modified, +8/-3)
```diff
@@ -34,9 +34,14 @@ export class FramesManager {
     }
 
     applyFrames(frames: Frame[]) {
-        for (const frame of frames) {
-            this._frameIdToData.set(frame.id, { frame, view: null, selected: false });
-        }
+        frames.forEach((frame, index) => {
+            this._frameIdToData.set(frame.id, {
+                frame,
+                view: null,
+                // Select the first frame
+                selected: index === 0
+            });
+        });
     }
 
     get selected(): FrameData[] {
```

**File**: `packages/ui/src/components/ai-elements/conversation.tsx` (modified, +2/-2)
```diff
@@ -74,13 +74,13 @@ export const ConversationScrollButton = ({
         !isAtBottom && (
             <Button
                 className={cn(
-                    'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
+                    'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full bg-background-onlook/20 backdrop-blur-lg text-foreground-onlook opacity-100 hover:bg-foreground-primary hover:text-background-onlook border-[0.5px] border-foreground-primary/20',
                     className,
                 )}
                 onClick={handleScrollToBottom}
                 size="icon"
                 type="button"
-                variant="outline"
+                variant="default"
                 {...props}
             >
                 <ArrowDownIcon className="size-4" />
```

---

### Incident Patch 15: `f6269ed6` (2025-10-13)
**Commit Message**: fix: update ui (#3001)

**File**: `apps/web/client/src/app/project/[id]/_components/editor-bar/inputs/input-color.tsx` (modified, +2/-2)
```diff
@@ -34,7 +34,6 @@ export const InputColor = ({ color, elementStyleKey, onColorChange }: InputColor
         <div className="flex h-9 w-full items-center">
             <div className="bg-background-tertiary/50 mr-[1px] flex h-full flex-1 items-center rounded-l-md px-3 py-1.5 pl-1.5">
                 <Popover onOpenChange={setIsOpen}>
-                    <PopoverAnchor className="absolute bottom-0 left-0" />
                     <PopoverTrigger>
                         <div className="flex items-center">
                             <div
@@ -52,8 +51,9 @@ export const InputColor = ({ color, elementStyleKey, onColorChange }: InputColor
                     </PopoverTrigger>
                     <PopoverContent
                         className="w-[224px] overflow-hidden rounded-lg p-0 shadow-xl backdrop-blur-lg"
-                        side="bottom"
+                        side="left"
                         align="start"
+                        alignOffset={-24}
                     >
                         <ColorPickerContent
                             color={tempColor}
```

**File**: `apps/web/client/src/app/project/[id]/_components/editor-bar/text-inputs/font/font-family-selector.tsx` (modified, +10/-38)
```diff
@@ -7,7 +7,7 @@ import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@onlook/
 import { Icons } from '@onlook/ui/icons';
 import { toNormalCase } from '@onlook/utility';
 import { observer } from 'mobx-react-lite';
-import { useEffect, useState } from 'react';
+import { useEffect } from 'react';
 import { useDropdownControl } from '../../hooks/use-dropdown-manager';
 import { useTextControl } from '../../hooks/use-text-control';
 import { HoverOnlyTooltip } from '../../hover-tooltip';
@@ -16,16 +16,11 @@ import { FontFamily } from './font-family';
 
 export const FontFamilySelector = observer(() => {
     const editorEngine = useEditorEngine();
-    const [search, setSearch] = useState('');
     const { handleFontFamilyChange, textState } = useTextControl();
     const { isOpen, onOpenChange } = useDropdownControl({
         id: 'font-family-dropdown',
     });
 
-    const filteredFonts = editorEngine.font.fonts.filter((font) =>
-        font.family.toLowerCase().includes(search.toLowerCase()),
-    );
-
     // TODO: use file system like code tab
     useEffect(() => {
         if (!editorEngine.activeSandbox.session.provider) {
@@ -40,7 +35,6 @@ export const FontFamilySelector = observer(() => {
         if (editorEngine.state.leftPanelTab === LeftPanelTabValue.BRAND) {
             editorEngine.state.leftPanelTab = null;
         }
-        setSearch('');
     };
 
     return (
@@ -69,39 +63,17 @@ export const FontFamilySelector = observer(() => {
             </HoverOnlyTooltip>
             <DropdownMenuContent
                 side="bottom"
-                align="start"
-                className="mt-1 min-w-[300px] max-h-[400px] overflow-y-auto rounded-xl p-0 bg-background shadow-lg border border-border flex flex-col"
+                align="center"
+                className="mt-1 min-w-[240px] max-h-[400px] overflow-y-auto rounded-xl p-0 bg-background shadow-lg border border-border flex flex-col"
             >
-                <div className="flex justify-between items-center pl-4 pr-2.5 py-1.5 border-b border-border">
-                    <h2 className="text-sm font-normal text-foreground">Fonts</h2>
-                    <Button
-                        variant="ghost"
-                        size="icon"
-                        className="h-7 w-7 rounded-md hover:bg-background-secondary"
-                        onClick={handleClose}
-                    >
-                        <Icons.CrossS className="h-4 w-4" />
-                    </Button>
-                </div>
-                <div className="px-4 py-2">
-                    <input
-                        type="text"
-                        value={search}
-                        onChange={(e) => setSearch(e.target.value)}
-                        placeholder="Search fonts..."
-                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
-                        aria-label="Search fonts"
-                        tabIndex={0}
-                    />
-                    <div className="text-sm text-muted-foreground mb-1 mt-2">Brand fonts</div>
-                </div>
-                <div className="flex-1 overflow-y-auto px-2 pb-2 divide-y divide-border">
-                    {filteredFonts.length === 0 ? (
-                        <div className="flex justify-center items-center h-20">
-                            <span className="text-sm text-muted-foreground">No fonts found</span>
+                <div className="flex-1 overflow-y-auto px-2 pb-2 pt-2 divide-y divide-border">
+                    {editorEngine.font.fonts.length === 0 ? (
+                        <div className="flex justify-center items-center flex-col h-20 text-center">
+                            <Icons.Brand className="h-5 w-5 text-muted-foreground mb-1" />
+                            <span className="text-sm text-muted-foreground">No fonts found <br /> Add fonts from the Brand Tab</span>
                         </div>
                     ) : (
-                        filteredFonts.map((font) => (
+                        editorEngine.font.fonts.map((font) => (
                             <div key={font.id} className="py-1">
                                 <FontFamily
                                     name={font.family}
@@ -125,7 +97,7 @@ export const FontFamilySelector = observer(() => {
                             onOpenChange(false);
                         }}
                     >
-                        Manage Brand fonts
+                        Browse more fonts
                     </Button>
                 </div>
             </DropdownMenuContent>
```

**File**: `apps/web/client/src/app/project/[id]/_components/right-panel/chat-tab/controls.tsx` (modified, +27/-19)
```diff
@@ -8,6 +8,7 @@ export const ChatControls = observer(() => {
     const editorEngine = useEditorEngine();
 
     const isStartingNewConversation = editorEngine.chat.conversation.creatingConversation;
+    const isDisabled = editorEngine.chat.isStreaming || isStartingNewConversation;
 
     const handleNewChat = () => {
         editorEngine.chat.conversation.startNewConversation();
@@ -18,26 +19,33 @@ export const ChatControls = observer(() => {
         <div className="flex flex-row">
             <Tooltip>
                 <TooltipTrigger asChild>
-                    <Button
-                        variant={'ghost'}
-                        size={'icon'}
-                        className="py-1 px-2 w-fit h-fit bg-transparent hover:!bg-transparent cursor-pointer group text-foreground-secondary hover:text-foreground-primary"
-                        onClick={handleNewChat}
-                        disabled={editorEngine.chat.isStreaming || isStartingNewConversation}
-                    >
-                        {isStartingNewConversation ? (
-                            <>
-                                <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
-                                <span className="text-small">New Chat</span>
-                            </>
-                        ) : (
-                            <>
-                                <Icons.Edit className="h-4 w-4" />
-                                <span className="text-small">New Chat</span>
-                            </>
-                        )}
-                    </Button>
+                    <span className="inline-block">
+                        <Button
+                            variant={'ghost'}
+                            size={'icon'}
+                            className="py-1 px-2 w-fit h-fit bg-transparent hover:!bg-transparent cursor-pointer group text-foreground-secondary hover:text-foreground-primary"
+                            onClick={handleNewChat}
+                            disabled={isDisabled}
+                        >
+                            {isStartingNewConversation ? (
+                                <>
+                                    <Icons.LoadingSpinner className="h-4 w-4 animate-spin" />
+                                    <span className="text-small">New Chat</span>
+                                </>
+                            ) : (
+                                <>
+                                    <Icons.Edit className="h-4 w-4" />
+                                    <span className="text-small">New Chat</span>
+                                </>
+                            )}
+                        </Button>
+                    </span>
                 </TooltipTrigger>
+                {isDisabled && (
+                    <TooltipContent side="bottom" hideArrow>
+                        AI is still loading
+                    </TooltipContent>
+                )}
             </Tooltip>
         </div>
     );
```

**File**: `apps/web/client/src/app/project/[id]/_components/top-bar/branch.tsx` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export const BranchDisplay = observer(() => {
                     </span>
                 </Button>
             </DropdownMenuTrigger>
-            <DropdownMenuContent align="start" className="w-[320px] p-0">
+            <DropdownMenuContent align="start" className="w-[240px] p-0">
                 <BranchList
                     branches={allBranches}
                     activeBranch={activeBranch}
```

#### Recent Merged Pull Requests:
- **PR #3129** (2026-07-22): fix(security): enforce project-membership authorization across all tRPC routers (IDOR) (@mrptato)
- **PR #3125** (2026-07-09): Update README to refresh header image (@drfarrell)
- **PR #3124** (2026-07-09): Updated header image (@drfarrell)
- **PR #3117** (2026-06-09): Revise README with new Onlook description and links (@drfarrell)
- **PR #3111** (closed): fix: auto-accept CSB trust interstitial for free tier (onlook-dev/onl… (@guangyang1206)
- **PR #3103** (closed): Fix bugs and add features (@A-x6)
- **PR #3099** (closed): feat:开发vscode插件，支持本地环境；Nextjs升级；AI功能支持自定义baseurl、APIKey (@LittleWangUpup)
- **PR #3096** (closed): fix(mobile-preview): live edits propagate to Expo Go without restart (@epinnock)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
