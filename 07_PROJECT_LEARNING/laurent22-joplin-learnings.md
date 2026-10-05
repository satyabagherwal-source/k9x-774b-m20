# Forensic Learning Record (Deep Inspection): laurent22/joplin

> **Canonical Artifact**: `07_PROJECT_LEARNING/laurent22-joplin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/laurent22/joplin](https://github.com/laurent22/joplin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:37.193Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `laurent22/joplin`
- **Description**: Joplin - the privacy-focused note taking app with sync capabilities for Windows, macOS, Linux, Android and iOS.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 56602 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Bookmark.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import * as Range from './Range';

const DOM = DOMUtils.DOM;

/**
 * Returns a range bookmark. This will convert indexed bookmarks into temporary span elements with
 * index 0 so that they can be restored properly after the DOM has been modified. Text bookmarks will not have spans
 * added to them since they can be restored after a dom operation.
 *
 * So this: <p><b>|</b><b>|</b></p>
 * becomes: <p><b><span data-mce-type="bookmark">|</span></b><b data-mce-type="bookmark">|</span></b></p>
 *
 * @param  {DOMRange} rng DOM Range to get bookmark on.
 * @return {Object} Bookmark object.
 */
const createBookmark = function (rng) {
  const bookmark = {};

  const setupEndPoint = function (start?) {
    let offsetNode, container, offset;

    container = rng[start ? 'startContainer' : 'endContainer'];
    offset = rng[start ? 'startOffset' : 'endOffset'];

    if (container.nodeType === 1) {
      offsetNode = DOM.create('span', { 'data-mce-type': 'bookmark' });

      if (container.hasChildNodes()) {
        offset = Math.min(offset, container.childNodes.length - 1);

        if (start) {
          container.insertBefore(offsetNode, container.childNodes[offset]);
        } else {
          DOM.insertAfter(offsetNode, container.childNodes[offset]);
        }
      } else {
        container.appendChild(offsetNode);
      }

      container = offsetNode;
      offset = 0;
    }

    bookmark[start ? 'startContainer' : 'endContainer'] = container;
    bookmark[start ? 'startOffset' : 'endOffset'] = offset;
  };

  setupEndPoint(true);

  if (!rng.collapsed) {
    setupEndPoint();
  }

  return bookmark;
};

const resolveBookmark = function (bookmark) {
  function restoreEndPoint(start?) {
    let container, offset, node;

    const nodeIndex = function (container) {
      let node = container.parentNode.firstChild, idx = 0;

      while (node) {
        if (node === container) {
          return idx;
        }

        // Skip data-mce-type=bookmark nodes
        if (node.nodeType !== 1 || node.getAttribute('data-mce-type') !== 'bookmark') {
          idx++;
        }

        node = node.nextSibling;
      }

      return -1;
    };

    container = node = bookmark[start ? 'startContainer' : 'endContainer'];
    offset = bookmark[start ? 'startOffset' : 'endOffset'];

    if (!container) {
      return;
    }

    if (container.nodeType === 1) {
      offset = nodeIndex(container);
      container = container.parentNode;
      DOM.remove(node);

      if (!container.hasChildNodes() && DOM.isBlock(container)) {
        container.appendChild(DOM.create('br'));
      }
    }

    bookmark[start ? 'startContainer' : 'endContainer'] = container;
    bookmark[start ? 'startOffset' : 'endOffset'] = offset;
  }

  restoreEndPoint(true);
  restoreEndPoint();

  const rng = DOM.createRng();

  rng.setStart(bookmark.startContainer, bookmark.startOffset);

  if (bookmark.endContainer) {
    rng.setEnd(bookmark.endContainer, bookmark.endOffset);
  }

  return Range.normalizeRange(rng);
};

export {
  createBookmark,
  resolveBookmark
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Delete.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

interface DOMUtils {
  isBlock: Function,
  remove: Function,
  $: Function,
  getParent: Function,
  getParents: Function,
  getRoot: Function,
  isEmpty: Function,
}

import { Element, HTMLLIElement, Node, Range as DomRange } from '@ephox/dom-globals';
import { Arr } from '@ephox/katamari';
import { Compare, Element as SugarElement } from '@ephox/sugar';
// import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import RangeUtils from 'tinymce/core/api/dom/RangeUtils';
import TreeWalker from 'tinymce/core/api/dom/TreeWalker';
import Editor from 'tinymce/core/api/Editor';
import VK from 'tinymce/core/api/util/VK';
import { flattenListSelection, outdentListSelection } from '../actions/Indendation';
import * as ToggleList from '../actions/ToggleList';
import * as Bookmark from './Bookmark';
import * as NodeType from './NodeType';
import * as NormalizeLists from './NormalizeLists';
import * as Range from './Range';
import * as Selection from './Selection';

const findNextCaretContainer = function (editor: Editor, rng: DomRange, isForward: Boolean, root: Node): Node {
  let node = rng.startContainer;
  const offset = rng.startOffset;

  if (NodeType.isTextNode(node) && (isForward ? offset < node.data.length : offset > 0)) {
    return node;
  }

  const nonEmptyBlocks = editor.schema.getNonEmptyElements();
  if (node.nodeType === 1) {
    node = RangeUtils.getNode(node, offset);
  }

  const walker = new TreeWalker(node, root);

  // Delete at <li>|<br></li> then jump over the bogus br
  if (isForward) {
    if (NodeType.isBogusBr(editor.dom, node)) {
      walker.next();
    }
  }

  while ((node = walker[isForward ? 'next' : 'prev2']())) {
    if (node.nodeName === 'LI' && !node.hasChildNodes()) {
      return node;
    }

    if (nonEmptyBlocks[node.nodeName]) {
      return node;
    }

    if (NodeType.isTextNode(node) && node.data.length > 0) {
      return node;
    }
  }
};

const hasOnlyOneBlockChild = function (dom: DOMUtils, elm: Element): boolean {
  const childNodes = elm.childNodes;
  return childNodes.length === 1 && !NodeType.isListNode(childNodes[0]) && dom.isBlock(childNodes[0]);
};

const unwrapSingleBlockChild = function (dom: DOMUtils, elm: Element) {
  if (hasOnlyOneBlockChild(dom, elm)) {
    dom.remove(elm.firstChild, true);
  }
};

const moveChildren = function (dom: DOMUtils, fromElm: Element, toElm: Element) {
  let node, targetElm;

  targetElm = hasOnlyOneBlockChild(dom, toElm) ? toElm.firstChild : toElm;
  unwrapSingleBlockChild(dom, fromElm);

  if (!NodeType.isEmpty(dom, fromElm, true)) {
    while ((node = fromElm.firstChild)) {
      targetElm.appendChild(node);
    }
  }
};

const mergeLiElements = function (dom: DOMUtils, fromElm: Element, toElm: Element) {
  let node, listNode;
  const ul = fromElm.parentNode;

  if (!NodeType.isChildOfBody(dom, fromElm) || !NodeType.isChildOfBody(dom, toElm)) {
    return;
  }

  if (NodeType.isListNode(toElm.lastChild)) {
    listNode = toElm.lastChild;
  }

  if (ul === toElm.lastChild) {
    if (NodeType.isBr(ul.previousSibling)) {
      dom.remove(ul.previousSibling);
    }
  }

  node = toElm.lastChild;
  if (node && NodeType.isBr(node) && fromElm.hasChildNodes()) {
    dom.remove(node);
  }

  if (NodeType.isEmpty(dom, toElm, true)) {
    dom.$(toElm).empty();
  }

  moveChildren(dom, fromElm, toElm);

  if (listNode) {
    toElm.appendChild(listNode);
  }

  const contains = Compare.contains(SugarElement.fromDom(toElm), SugarElement.fromDom(fromElm));

  const nestedLists = contains ? dom.getParents(fromElm, NodeType.isListNode, toElm) : [];

  dom.remove(fromElm);

  Arr.each(nestedLists, (list) => {
    if (NodeType.isEmpty(dom, list) && list !== dom.getRoot()) {
      dom.remove(list);
    }
  });
};

const mergeIntoEmptyLi = function (editor: Editor, fromLi: HTMLLIElement, toLi: HTMLLIElement) {
  editor.dom.$(toLi).empty();
  mergeLiElements(editor.dom, fromLi, toLi);
  editor.selection.setCursorLocation(toLi);
};

const mergeForward = function (editor: Editor, rng: DomRange, fromLi: HTMLLIElement, toLi: HTMLLIElement) {
  const dom = editor.dom;

  if (dom.isEmpty(toLi)) {
    mergeIntoEmptyLi(editor, fromLi, toLi);
  } else {
    const bookmark = Bookmark.createBookmark(rng);
    mergeLiElements(dom, fromLi, toLi);
    editor.selection.setRng(Bookmark.resolveBookmark(bookmark));
  }
};

const mergeBackward = function (editor: Editor, rng: DomRange, fromLi: HTMLLIElement, toLi: HTMLLIElement) {
  const bookmark = Bookmark.createBookmark(rng);
  mergeLiElements(editor.dom, fromLi, toLi);
  const resolvedBookmark = Bookmark.resolveBookmark(bookmark);
  editor.selection.setRng(resolvedBookmark);
};

const backspaceDeleteFromListToListCaret = function (editor: Editor, isForward: boolean) {
  const dom = editor.dom, selection = editor.selection;
  const selectionStartElm = selection.getStart();
  const root = Selection.getClosestListRootElm(editor, selectionStartElm);
  const li = dom.getParent(selection.getStart(), 'LI', root) as HTMLLIElement;

  if (li) {
    const ul = li.parentNode;
    if (ul === editor.getBody() && NodeType.isEmpty(dom, ul)) {
      return true;
    }

    const rng = Range.normalizeRange(selection.getRng());
    const otherLi = dom.getParent(findNextCaretContainer(editor, rng, isForward, root), 'LI', root) as HTMLLIElement;

    if (otherLi && otherLi !== li) {
      editor.undoManager.transact(() => {
        if (isForward) {
          mergeForward(editor, rng, otherLi, li);
        } else {
          if (NodeType.isFirstChild(li)) {
            outdentListSelection(editor);
          } else {
            mergeBackward(editor, rng, li, otherLi);
          }
        }
      });

      return true;
    } else if (!otherLi) {
      if (!isForward && rng.startOffset === 0 && rng.endOffset === 0) {
        editor.undoManager.transact(() => {
          flattenListSelection(editor);
        });

        return true;
      }
    }
  }

  return false;
};

const removeBlock = function (dom: DOMUtils, block: Element, root: Node) {
  const parentBlock = dom.getParent(block.parentNode, dom.isBlock, root);

  dom.remove(block);
  if (parentBlock && dom.isEmpty(parentBlock)) {
    dom.remove(parentBlock);
  }
};

const backspaceDeleteIntoListCaret = function (editor: Editor, isForward: boolean) {
  const dom = editor.dom;
  const selectionStartElm = editor.selection.getStart();
  const root = Selection.getClosestListRootElm(editor, selectionStartElm);
  const block = dom.getParent(selectionStartElm, dom.isBlock, root);

  if (block && dom.isEmpty(block)) {
    const rng = Range.normalizeRange(editor.selection.getRng());
    const otherLi = dom.getParent(findNextCaretContainer(editor, rng, isForward, root), 'LI', root);

    if (otherLi) {
      editor.undoManager.transact(function () {
        removeBlock(dom, block, root);
        ToggleList.mergeWithAdjacentLists(dom, otherLi.parentNode);
        editor.selection.select(otherLi, true);
        editor.selection.collapse(isForward);
      });

      return true;
    }
  }

  return false;
};

const backspaceDeleteCaret = function (editor: Editor, isForward: boolean): boolean {
  return backspaceDeleteFromListToListCaret(editor, isForward) || backspaceDeleteIntoListCaret(editor, isForward);
};

const backspaceDeleteRange = function (editor: Editor): boolean {
  const selectionStartElm = editor.selection.getStart();
  const root = Selection.getClosestListRootElm(editor, selectionStartElm);
  const startListParent = editor.dom.getParent(selectionStartElm, 'LI,DT,DD', root);

  if (startListParent || Selection.getSelectedListItems(editor).length > 0) {
    editor.undoManager.transact(function () {
      editor.execCommand('Delete');
      NormalizeLists.normalizeLists(editor.dom, editor.getBody());
    });

    return true;
  }

  return false;
};

const backspaceDelete = function (editor: Editor, isForward: boolean): boolean {
  return editor.selection.isCollapsed() ? backspaceDeleteCaret(editor, isForward) : backspaceDeleteRange(editor);
};

const setup = function (editor: Editor) {
  editor.on('keydown', function (e) {
    if (e.keyCode === VK.BACKSPACE) {
      if (backspaceDelete(editor, false)) {
        e.preventDefault();
      }
    } else if (e.keyCode === VK.DELETE) {
      if (backspaceDelete(editor, true)) {
        e.preventDefault();
      }
    }
  });
};

export {
  setup,
  backspaceDelete
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/DlIndentation.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import Editor from 'tinymce/core/api/Editor';
import { Compare, Replication, Element, Traverse } from '@ephox/sugar';
import * as SplitList from './SplitList';
import { Indentation } from '../listModel/Indentation';
import { Arr } from '@ephox/katamari';

const outdentDlItem = (editor: Editor, item: Element): void => {
  if (Compare.is(item, 'dd')) {
    Replication.mutate(item, 'dt');
  } else if (Compare.is(item, 'dt')) {
    Traverse.parent(item).each((dl) => SplitList.splitList(editor, dl.dom(), item.dom()));
  }
};

const indentDlItem = (item: Element): void => {
  if (Compare.is(item, 'dt')) {
    Replication.mutate(item, 'dd');
  }
};

const dlIndentation = (editor: Editor, indentation: Indentation, dlItems: Element[]) => {
  if (indentation === Indentation.Indent) {
    Arr.each(dlItems, indentDlItem);
  } else {
    Arr.each(dlItems, (item) => outdentDlItem(editor, item));
  }
};

export {
  dlIndentation
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Keyboard.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import VK from 'tinymce/core/api/util/VK';
import * as Settings from '../api/Settings';
import * as Delete from './Delete';
import { outdentListSelection, indentListSelection } from '../actions/Indendation';

const setupTabKey = function (editor) {
  editor.on('keydown', function (e) {
    // Check for tab but not ctrl/cmd+tab since it switches browser tabs
    if (e.keyCode !== VK.TAB || VK.metaKeyPressed(e)) {
      return;
    }

    editor.undoManager.transact(() => {
      if (e.shiftKey ? outdentListSelection(editor) : indentListSelection(editor)) {
        e.preventDefault();
      }
    });
  });
};

const setup = function (editor) {
  if (Settings.shouldIndentOnTab(editor)) {
    setupTabKey(editor);
  }

  Delete.setup(editor);
};

export {
  setup
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/ListAction.ts`
```
export const enum ListAction {
  ToggleUlList = 'ToggleUlList',
  ToggleOlList = 'ToggleOlList',
  ToggleDLList = 'ToggleDLList',
  IndentList = 'IndentList',
  OutdentList = 'OutdentList'
}

export const listToggleActionFromListName = (listName: 'UL' | 'OL' | 'DL'): ListAction => {
  switch (listName) {
    case 'UL': return ListAction.ToggleUlList;
    case 'OL': return ListAction.ToggleOlList;
    case 'DL': return ListAction.ToggleDLList;
  }
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Mouse.ts`
```
import { isJoplinChecklistItem } from '../listModel/JoplinListUtil';


const setup = function (editor) {
    const editorClickHandler = (event) => {
        if (!isJoplinChecklistItem(event.target)) return;

        // We only process the click if it's within the checkbox itself (and not the label).
        // That checkbox, based on
        // the current styling is in the negative margin, so offsetX is negative when clicking
        // on the checkbox itself, and positive when clicking on the label. This is strongly
        // dependent on how the checkbox is styled, so if the style is changed, this might need
        // to be updated too.
        // For the styling, see:
        // packages/renderer/MdToHtml/rules/checkbox.ts
        //
        // The previous solution was to use "pointer-event: none", which mostly work, however
        // it means that links are no longer clickable when they are within the checkbox label.
        if (event.offsetX >= 0) return;

        editor.execCommand('ToggleJoplinChecklistItem', false, { element: event.target });
    }
    editor.on('click', editorClickHandler);
};

export { setup };
```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/NodeType.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Node, Text } from '@ephox/dom-globals';

const isTextNode = function (node: Node): node is Text {
  return node && node.nodeType === 3;
};

const isListNode = function (node: Node) {
  return node && (/^(OL|UL|DL)$/).test(node.nodeName);
};

const isOlUlNode = function (node: Node) {
  return node && (/^(OL|UL)$/).test(node.nodeName);
};

const isListItemNode = function (node: Node) {
  return node && /^(LI|DT|DD)$/.test(node.nodeName);
};

const isDlItemNode = function (node: Node) {
  return node && /^(DT|DD)$/.test(node.nodeName);
};

const isTableCellNode = function (node: Node) {
  return node && /^(TH|TD)$/.test(node.nodeName);
};

const isBr = function (node: Node) {
  return node && node.nodeName === 'BR';
};

const isFirstChild = function (node: Node) {
  return node.parentNode.firstChild === node;
};

const isLastChild = function (node: Node) {
  return node.parentNode.lastChild === node;
};

const isTextBlock = function (editor, node: Node) {
  return node && !!editor.schema.getTextBlockElements()[node.nodeName];
};

const isBlock = function (node: Node, blockElements) {
  return node && node.nodeName in blockElements;
};

const isBogusBr = function (dom, node: Node) {
  if (!isBr(node)) {
    return false;
  }

  if (dom.isBlock(node.nextSibling) && !isBr(node.previousSibling)) {
    return true;
  }

  return false;
};

const isEmpty = function (dom, elm, keepBookmarks?) {
  const empty = dom.isEmpty(elm);

  if (keepBookmarks && dom.select('span[data-mce-type=bookmark]', elm).length > 0) {
    return false;
  }

  return empty;
};

const isChildOfBody = function (dom, elm) {
  return dom.isChildOf(elm, dom.getRoot());
};

export {
  isTextNode,
  isListNode,
  isOlUlNode,
  isDlItemNode,
  isListItemNode,
  isTableCellNode,
  isBr,
  isFirstChild,
  isLastChild,
  isTextBlock,
  isBlock,
  isBogusBr,
  isEmpty,
  isChildOfBody
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/NormalizeLists.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import Tools from 'tinymce/core/api/util/Tools';
import * as NodeType from './NodeType';

const DOM = DOMUtils.DOM;

const normalizeList = function (dom, ul) {
  let sibling;
  const parentNode = ul.parentNode;

  // Move UL/OL to previous LI if it's the only child of a LI
  if (parentNode.nodeName === 'LI' && parentNode.firstChild === ul) {
    sibling = parentNode.previousSibling;
    if (sibling && sibling.nodeName === 'LI') {
      sibling.appendChild(ul);

      if (NodeType.isEmpty(dom, parentNode)) {
        DOM.remove(parentNode);
      }
    } else {
      DOM.setStyle(parentNode, 'listStyleType', 'none');
    }
  }

  // Append OL/UL to previous LI if it's in a parent OL/UL i.e. old HTML4
  if (NodeType.isListNode(parentNode)) {
    sibling = parentNode.previousSibling;
    if (sibling && sibling.nodeName === 'LI') {
      sibling.appendChild(ul);
    }
  }
};

const normalizeLists = function (dom, element) {
  Tools.each(Tools.grep(dom.select('ol,ul', element)), function (ul) {
    normalizeList(dom, ul);
  });
};

export {
  normalizeList,
  normalizeLists
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Range.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import RangeUtils from 'tinymce/core/api/dom/RangeUtils';
import * as NodeType from './NodeType';
import { Range, Node } from '@ephox/dom-globals';

interface Point {
  container: Node;
  offset: number;
}

const getNormalizedPoint = (container: Node, offset: number): Point => {
  if (NodeType.isTextNode(container)) {
    return { container, offset };
  }

  const node = RangeUtils.getNode(container, offset);
  if (NodeType.isTextNode(node)) {
    return {
      container: node,
      offset: offset >= container.childNodes.length ? node.data.length : 0
    };
  } else if (node.previousSibling && NodeType.isTextNode(node.previousSibling)) {
    return {
      container: node.previousSibling,
      offset: node.previousSibling.data.length
    };
  } else if (node.nextSibling && NodeType.isTextNode(node.nextSibling)) {
    return {
      container: node.nextSibling,
      offset: 0
    };
  }

  return { container, offset };
};

const normalizeRange = (rng: Range): Range => {
  const outRng = rng.cloneRange();

  const rangeStart = getNormalizedPoint(rng.startContainer, rng.startOffset);
  outRng.setStart(rangeStart.container, rangeStart.offset);

  const rangeEnd = getNormalizedPoint(rng.endContainer, rng.endOffset);
  outRng.setEnd(rangeEnd.container, rangeEnd.offset);

  return outRng;
};

export {
  getNormalizedPoint,
  normalizeRange
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/Selection.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import { Node } from '@ephox/dom-globals';
import { Arr, Option } from '@ephox/katamari';
import { HTMLElement } from '@ephox/sand';
import Editor from 'tinymce/core/api/Editor';
import Tools from 'tinymce/core/api/util/Tools';
import * as NodeType from './NodeType';

const getParentList = function (editor) {
  const selectionStart = editor.selection.getStart(true);

  return editor.dom.getParent(selectionStart, 'OL,UL,DL', getClosestListRootElm(editor, selectionStart));
};

const isParentListSelected = function (parentList, selectedBlocks) {
  return parentList && selectedBlocks.length === 1 && selectedBlocks[0] === parentList;
};

const findSubLists = function (parentList) {
  return Tools.grep(parentList.querySelectorAll('ol,ul,dl'), function (elm: Node) {
    return NodeType.isListNode(elm);
  });
};

const getSelectedSubLists = function (editor) {
  const parentList = getParentList(editor);
  const selectedBlocks = editor.selection.getSelectedBlocks();

  if (isParentListSelected(parentList, selectedBlocks)) {
    return findSubLists(parentList);
  } else {
    return Tools.grep(selectedBlocks, function (elm: Node) {
      return NodeType.isListNode(elm) && parentList !== elm;
    });
  }
};

const findParentListItemsNodes = function (editor, elms) {
  const listItemsElms = Tools.map(elms, function (elm) {
    const parentLi = editor.dom.getParent(elm, 'li,dd,dt', getClosestListRootElm(editor, elm));

    return parentLi ? parentLi : elm;
  });

  return [...new Set(listItemsElms)];
};

const getSelectedListItems = function (editor) {
  const selectedBlocks = editor.selection.getSelectedBlocks();
  return Tools.grep(findParentListItemsNodes(editor, selectedBlocks), function (block) {
    return NodeType.isListItemNode(block);
  });
};

const getSelectedDlItems = (editor: Editor): Node[] => {
  return Arr.filter(getSelectedListItems(editor), NodeType.isDlItemNode);
};

const getClosestListRootElm = function (editor, elm) {
  const parentTableCell = editor.dom.getParents(elm, 'TD,TH');
  const root = parentTableCell.length > 0 ? parentTableCell[0] : editor.getBody();

  return root;
};

const findLastParentListNode = (editor: Editor, elm: Node): Option<Node> => {
  const parentLists = editor.dom.getParents(elm, 'ol,ul', getClosestListRootElm(editor, elm));
  return Arr.last(parentLists);
};

const getSelectedLists = (editor: Editor): Node[] => {
  const firstList = findLastParentListNode(editor, editor.selection.getStart());
  const subsequentLists = Arr.filter(editor.selection.getSelectedBlocks(), NodeType.isOlUlNode);

  return firstList.toArray().concat(subsequentLists);
};

const getSelectedListRoots = (editor: Editor): Node[] => {
  const selectedLists = getSelectedLists(editor);
  return getUniqueListRoots(editor, selectedLists);
};

const getUniqueListRoots = (editor: Editor, lists: Node[]): Node[] => {
  const listRoots = Arr.map(lists, (list) => findLastParentListNode(editor, list).getOr(list));
  return [...new Set(listRoots)];
};

const isList = (editor: Editor): boolean => {
  const list = getParentList(editor);
  return HTMLElement.isPrototypeOf(list);
};

export {
  isList,
  getParentList,
  getSelectedSubLists,
  getSelectedListItems,
  getClosestListRootElm,
  getSelectedDlItems,
  getSelectedListRoots
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/SplitList.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import * as NodeType from './NodeType';
import { createTextBlock } from './TextBlock';
import Tools from 'tinymce/core/api/util/Tools';

const DOM = DOMUtils.DOM;

const splitList = function (editor, ul, li) {
  let tmpRng, fragment, bookmarks, node, newBlock;

  const removeAndKeepBookmarks = function (targetNode) {
    Tools.each(bookmarks, function (node) {
      targetNode.parentNode.insertBefore(node, li.parentNode);
    });

    DOM.remove(targetNode);
  };

  bookmarks = DOM.select('span[data-mce-type="bookmark"]', ul);
  newBlock = createTextBlock(editor, li);
  tmpRng = DOM.createRng();
  tmpRng.setStartAfter(li);
  tmpRng.setEndAfter(ul);
  fragment = tmpRng.extractContents();

  for (node = fragment.firstChild; node; node = node.firstChild) {
    if (node.nodeName === 'LI' && editor.dom.isEmpty(node)) {
      DOM.remove(node);
      break;
    }
  }

  if (!editor.dom.isEmpty(fragment)) {
    DOM.insertAfter(fragment, ul);
  }

  DOM.insertAfter(newBlock, ul);

  if (NodeType.isEmpty(editor.dom, li.parentNode)) {
    removeAndKeepBookmarks(li.parentNode);
  }

  DOM.remove(li);

  if (NodeType.isEmpty(editor.dom, ul)) {
    DOM.remove(ul);
  }
};

export {
  splitList
};

```

### Core Architecture Module: `Assets/TinyMCE/JoplinLists/src/main/ts/core/TextBlock.ts`
```
/**
 * Copyright (c) Tiny Technologies, Inc. All rights reserved.
 * Licensed under the LGPL or a commercial license.
 * For LGPL see License.txt in the project root for license information.
 * For commercial licenses see https://www.tiny.cloud/
 */

import * as NodeType from './NodeType';
import { DocumentFragment, Node } from '@ephox/dom-globals';
import Editor from 'tinymce/core/api/Editor';
import * as Settings from '../api/Settings';

const createTextBlock = (editor: Editor, contentNode: Node): DocumentFragment => {
  const dom = editor.dom;
  const blockElements = editor.schema.getBlockElements();
  const fragment = dom.createFragment();
  const blockName = Settings.getForcedRootBlock(editor);
  let node, textBlock, hasContentNode;

  if (blockName) {
    textBlock = dom.create(blockName);

    if (textBlock.tagName === blockName.toUpperCase()) {
      dom.setAttribs(textBlock, Settings.getForcedRootBlockAttrs(editor));
    }

    if (!NodeType.isBlock(contentNode.firstChild, blockElements)) {
      fragment.appendChild(textBlock);
    }
  }

  if (contentNode) {
    while ((node = contentNode.firstChild)) {
      const nodeName = node.nodeName;

      if (!hasContentNode && (nodeName !== 'SPAN' || node.getAttribute('data-mce-type') !== 'bookmark')) {
        hasContentNode = true;
      }

      if (NodeType.isBlock(node, blockElements)) {
        fragment.appendChild(node);
        textBlock = null;
      } else {
        if (blockName) {
          if (!textBlock) {
            textBlock = dom.create(blockName);
            fragment.appendChild(textBlock);
          }

          textBlock.appendChild(node);
        } else {
          fragment.appendChild(node);
        }
      }
    }
  }

  if (!blockName) {
    fragment.appendChild(dom.create('br'));
  } else {
    // BR is needed in empty blocks
    if (!hasContentNode) {
      textBlock.appendChild(dom.create('br', { 'data-mce-bogus': '1' }));
    }
  }

  return fragment;
};

export {
  createTextBlock
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16754** (2026-10-05): **Desktop: Fixes #16745: Ignore key presses in table cells during IME composition**
  *Symptoms*: When typing with an IME (for example Pinyin on macOS) in a table cell, pressing Enter to confirm the composition was handled by the cell's keydown handler as if it were a normal Enter. That synced the half-composed text into the table, dispatched the change to CodeMirror and rebuilt the table widget, so the cell lost focus and the confirmed text ended up in the main editor outside the table.  The cell already tracks composition state, but onkeydown never looked at it. This adds an early return at the top of the handler when a composition is in progress (the existing isComposing flag or the event's own isComposing). That covers Enter, and Tab, which would otherwise sync and rebuild the table in the same way while an IME popup is open. By reading the code, Escape would blur the cell during composition too, so the same guard covers it, but I haven't tested that one.  I added a test in renderTables.test.ts that sends Enter and Tab keydown events with isComposing set and checks that the document is unchanged, the cell isn't rebuilt and the key isn't default-prevented, plus a case showing a normal Enter still updates the table. The two composing cases fail without the change. I haven't been able to try it with a real IME, so I'd appreciate anyone who can confirm on macOS with a Chinese input method.
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > I have read the CLA Document and I hereby sign the CLA
  > Thanks for the pull request and for taking the time to contribute.  At the moment, due to limited review capacity, we're only accepting pull requests from long-term contributors who are already familiar with the project and its development process. As a result, I'm going to close this PR.  This is not a reflection on the quality of your work. We simply don't have the resources right now to properly review and maintain contributions from new contributors. [More information in this discussion](https://discourse.joplinapp.org/t/pull-requests-from-new-contributors-are-temporarily-paused/50133).  Thanks again for your interest in the project and for taking the time to contribute.

- **Issue #16753** (2026-10-05): **Mobile, Desktop: Fixes #16721: Preserve required app version in sync warnings**
  *Symptoms*: ## Summary  Fixes #16721.  The synchronization upgrade warning can initially show the remote server's required application version, then switch to the older version cached locally when release metadata is loaded or cannot be fetched. That leaves users with incorrect upgrade instructions.  This fix carries the remote `appMinVersion` with the `MUST_UPGRADE_APP` action and stores it separately in Redux. Both desktop and mobile banners use that warning-specific version. Local synchronization metadata is not changed, and warnings without a structured version retain their existing message fallback.  ## Testing  Automated checks performed on Windows with Node 24.19.0 and the repository's Yarn 4.16.0:  - Full workspace build and TypeScript compilation passed. - The synchronization and reducer regressions fail with the original implementation and pass with the fix. - The Android banner regression fails with the original banner, which requests release information for `3.7.0` instead of the required `100.0.0`. - Both focused library suites passed: 96 tests. - The mobile warning suite passed: 7 tests, including release metadata fetch failure. - After the reducer regression was placed inside its existing suite, its 72 tests passed again. - Repository commit hooks passed lint, spellcheck and ignored-file verification for all seven changed files.  Desktop bundling passed, but the isolated Electron visual run timed out during initialization. No desktop screenshot or physical-device testing i
  **Post-Mortem & Fix Analysis**:
  > <br/>Thank you for your submission, we really appreciate it. Like many open-source projects, we ask that you sign our [Contributor License Agreement](https://github.com/laurent22/joplin/blob/dev/readme/cla.md) before we can accept your contribution. You can sign the CLA by just posting a Pull Request Comment same as the below format.<br/>    - - -    I have read the CLA Document and I hereby sign the CLA    - - -    <sub>You can retrigger this bot by commenting **recheck** in this Pull Request. </sub><sub>Posted by the **CLA Assistant Lite bot**.</sub>
  > Thanks for the pull request and for taking the time to contribute.  At the moment, due to limited review capacity, we're only accepting pull requests from long-term contributors who are already familiar with the project and its development process. As a result, I'm going to close this PR.  This is not a reflection on the quality of your work. We simply don't have the resources right now to properly review and maintain contributions from new contributors. [More information in this discussion](https://discourse.joplinapp.org/t/pull-requests-from-new-contributors-are-temporarily-paused/50133).  Thanks again for your interest in the project and for taking the time to contribute.

- **Issue #16738** (2026-10-04): **Chore: Resolves #16119: Remove --no-sandbox checks in installation script**
  *Symptoms*: …, deferring instead to runtime checks in AppImage stub  # Background Since upgrading to AppImage type 2 runtimes in #15043 - the `AppRun` script in the AppImage has been automatically applying `--no-sandbox` where required, independently of the `.desktop` script. This PR removes the checks from the installation script, meaning the list doesn't have to be adjusted in the future simplifying the complexity. Additionally benefiting security in situations where users might adjust system policy to allow unprivileged user namespaces.  # Relevant AppImage Code (run the AppImage with `--AppImage-extract` and then open `squashfs-root/AppRun`)  ```bash HAVE_NO_SANDBOX=0 for arg in "${args[@]}" ; do   if [ "$arg" = --no-sandbox ] ; then     HAVE_NO_SANDBOX=1     break   fi done NO_SANDBOX=() # Use 'unshare -Ur true' as a heuristic to detect whether user namespaces are available. # Notes: #   - When running as root, this check will always succeed even if the sandbox configuration #     actually relies on unprivileged user namespaces. In practice, Chrome/Electron usually #     disables or adjusts the sandbox separately when running as root, so this probe is mostly #     a no-op in that scenario. #   - On minimal systems (e.g. Alpine or stripped-down containers) 'unshare' may not exist. #     In that case the shell will return exit code 127 ("command not found"), which will cause #     us to add '--no-sandbox'. This is an intentional fail-safe: we prefer the app to

- **Issue #16736** (2026-10-03): **New Notebook title focus is lost**
  *Symptoms*: ### Operating system  Windows  ### Joplin version  3.7.21 (prod, win32)  ### Desktop version info  Joplin 3.7.21 (prod, win32)  Device: win32, 12th Gen Intel(R) Core(TM) i7-12700K Client ID: d1dd0896c7c84e6fa659576912de51ba Sync Version: 3 Profile Version: 54 Keychain Supported: Yes Alternative instance ID: - Sync target: Dropbox Editor: Rich Text  Revision: e41516e  Backup: 1.5.1 Freehand Drawing: 4.3.0  ### Current behaviour  **Summary** When trying to enter a new notebook name, if a note is open in the background, the focus is moved from the New Notebook input box to the beginning of the open note title. If no note is open in the background, the focus is kept in the New Notebook title input box.  The behavior on an Android phone is that it doesn't work at all. No focus change, no new notebook.   **Steps to Reproduce:** 1. Open application and select a note to open it. 2. From the upper left corner, select the plus (+) symbol to the right of NOTEBOOKS. 3. On the dialog box that appears, the cursor will blink in the Title input box for 2 seconds and then shift to the beginning of the open note in the background. When you start typing, the text appears at the beginning of the title of the open note. 4. If you now click in the title input box and thereby force the focus on it, you will have 1 second to type a letter before the focus is lost again to the open note title.  https://github.com/user-attachments/assets/145a5dba-a986-4ad6-855b-5400e7ec834a https://github.com/user-att
  **Post-Mortem & Fix Analysis**:
  > Found a plug-in that was causing the problem. Removing the plug-in solved the issue.

- **Issue #16727** (2026-10-02): **Desktop, Mobile: Fix displayed note updated_time is reverted to the remote updated_time upon auto merging a conflict**
  *Symptoms*: A change is auto merged, the updated_time on the note is set to Math.max(time.unixMs(), remoteNote.updated_time + 1). This is to ensure the updated_time is at least 1 ms newer than the last change the client and server has agreed upon, to ensure the change will to propagated to all clients. But if the local time is newer, use that instead, because technically a new update to the note has been made. However when the current time is higher, this is not shown in the UI in practice, because the user_updated_time was not being updated inline with the amended updated_time.  This PR aligns the user_updated_time to match the new updated_time value for auto merged conflicts. Note that although technically the sync_time updates in the conflict resolution could be aligned to match the updated_time set on the note, this is not strictly necessary for the synchronization of these changes to work correctly, so I have left this logic untouched.  ### Testing  **See videos:**  Before change:  https://github.com/user-attachments/assets/f983db82-3bf4-4167-8451-8db4d4826690  After change:  https://github.com/user-attachments/assets/2b445bf3-59ea-4d97-befb-9c2c8dbb7d4d

- **Issue #16725** (2026-10-02): **Desktop, Mobile: Resolves #16724: Label the note list padlock on desktop and match its colour to the title on mobile**
  *Symptoms*: Resolves #16724  ## Summary  Two small follow-ups on the note lock UI that is already merged, from review notes on it.  On mobile, the padlock shown next to a locked note in the note list was drawn in the faded text colour, so it looked light grey next to the title while the desktop one is dark. It now uses the same colour as the title text.  On desktop, the same padlock had no accessibility label. The three note list layouts now render it with an image role and the label "Locked", the same text the mobile list already uses. The label is supplied alongside the locked flag when a row is rendered, the same way as the "Local only" icon, so the templates stay data driven.  ## Testing  - `@joplin/lib`: renderTemplate, renderViewProps and isSyncDisabledConflict - `@joplin/app-desktop`: the NoteListItem, NoteList and NoteListHeader utils - lib, desktop and mobile builds, lint, spellcheck - Desktop: read the padlock's attributes in the running app for a locked note in the list, role "img" and label "Locked" - Mobile web: locked note in the list with the padlock in the title colour, screenshot below  ## Screenshots  **Mobile, padlock in the title colour**  <img width="300" alt="01-mobile-padlock-title-colour" src="https://github.com/user-attachments/assets/525b9110-059c-4aed-9c4b-95d784d4944e" />  **Desktop, unchanged look, label added**  <img width="1280" height="800" alt="02-desktop-padlock" src="https://github.com/user-attachments/assets/c21bab2e-3caf-4c83

- **Issue #16708** (2026-09-30): **Desktop: Fixes #16698: Preserve long OneNote page titles on import**
  *Symptoms*: ## Problem  OneNote pages with long titles can disappear during import even though the section's table of contents lists them. The converter uses the page title as the generated HTML filename. Its filename sanitizer truncates the combined title and `.html` suffix at 255 bytes. With a title around 260 characters, the suffix is lost; Joplin's next stage only scans files ending in `.html`, so it never imports that page.  ## Change  Reserve space for the extension and, when needed, the uniqueness suffix before shortening the temporary filename. Shortening stops on a UTF-8 character boundary. The full title stays in the generated HTML metadata and becomes the Joplin note title. This also ensures two long titles with the same prefix receive distinct HTML filenames.  ## Verification  - New regression test failed on the previous implementation because the generated filename lacked `.html`; it passes with this change. It also checks duplicate long titles and multibyte characters. - `cargo test --workspace --locked` passed for the OneNote converter workspace, including the existing conversion tests. - Converted the two-page public sample attached to #16698 locally. Both pages produced `.html` files, and the longer title remained intact in the generated HTML. The sample archive is not included in this PR. - `rustfmt --check --edition 2024 renderer/src/section.rs` and `git diff --check` passed. - Strict Clippy reported warnings in unchanged code (`seek_from_current`, `module_inception`, 
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > I have read the CLA Document and I hereby sign the CLA

- **Issue #16707** (2026-09-30): **Mobile: Adding syncronization to a fresh mobile app does not fetch existing content properly**
  *Symptoms*: ### Operating system  iOS  ### Joplin version  Joplin Mobile 13.7.6  ### Desktop version info  Joplin Mobile 13.7.6   ### Current behaviour  When installing a fresh Joplin mobile app and configuring the syncronization to an existing Dropbox or Nextcloud storage, there is no option to "Delete local data and re-download from sync target".  This option is visible in desktop app under "Show advanced settings".  In my opinion, when you set up the synchronization to a new server for a first time, or change the target, it should NEVER assume that you are about to send your local data.  Instead, either ask the user whether: * Delete local data and fetch content from server * Upload local data to empty syncronization server. This should fail if the sync target already have data. * Merge local data with server content  Or if you do not ask, check if the syncronization server have some content, then assume the first one. If there is no content on the syncronization server, then assume the second one.  Last one seem to be the default now, and it seem to be problematic. You need to setup all your Joplin devices beforehand, otherwise it starts uploading the "Welcome to Joplin" files, and sometimes (at least with Nextcloud/Webdav sync) it is out of sync. I have only managed to get this right by setting up the mobile client first and only after it is working, set up the desktop clients.  ### Expected behaviour  I would expect that installing a fresh copy of Joplin mobile client and setting u
  **Post-Mortem & Fix Analysis**:
  > For feature suggestions please use the forum 

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

### Incident Patch 1: `aaa6f8e3` (2026-10-05)
**Commit Message**: Doc: Resolves #16603: Add documentation for conflict auto-merge and desktop resolution UI (#16604)

Co-authored-by: Laurent Cozic <[REDACTED_EMAIL]>

**File**: `readme/dev/spec/conflict_auto_merge.md` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+# Conflict auto-merge
+
+When the same note is edited on two devices before they sync, if a change is made when one of the devices was not fully synced, Joplin creates a conflict note. Auto-merge avoids this when the edits don't overlap, using a three-way merge. It runs on the client that syncs second; other devices just receive the merged note.
+
+## Base version
+
+The merge needs three versions: **base** (the last version this device and the sync target agreed on), **local** and **remote**.
+
+The base is stored per sync target in `sync_items.base_body` and `base_title`. It is recorded after an upload, after a download, and after a conflict, whichever version is left in the original note. If a downloaded note is encrypted, the base is cleared until it is decrypted, so that a conflict before decryption creates a normal conflict note.
+
+## Merge
+
+The merge is line-based. Regions changed by only one side are taken as-is. Regions changed by both sides are auto-merged if both made the same change, otherwise they become a conflict. Edits on the same or adjacent lines therefore conflict. Word-level merging was tried and dropped because it could silently duplicate text. Titles follow the same rule.
+
+If everything merges, the merged note is saved over the local note, becomes the new base, and its `updated_time` is moved past the remote time so it gets uploaded. If some regions conflict, a conflict note is still created, but both notes already include the non-conflicting changes, so they differ only where there's a real conflict.
+
+## Fallback to a conflict note
+
+The merge is skipped, and a normal conflict note is created, when:
+
+- `sync.autoMergeConflicts` setting is off
+- there is no recorded base
+- the item is read-only or either note is locked
+- either note cannot be decrypted
+- an edit which touches identical lines, since the diff can't tell which one changed and may duplicate content.
+- the diff exceeds its bounds (`maxEditLength` 5000, timeout 1000ms)
+
+## E2EE
+
+An encrypted remote note is decrypted in memory for the merge without being saved. If a conflict note is created, the original note is saved with the decrypted (and partially merged) remote content.
+
+## Code
+
+- `services/conflict/diffNotes.ts`: merge engine (`autoMerge()`) and the duplicate-line guard
+- `services/conflict/boundedDiff3.ts`: fork of `node-diff3`'s `diff3MergeRegions()` using a bounded diff
+- `services/conflict/autoMergeNote.ts`: merges title and body of a note
+- `services/synchronizer/utils/handleConflictAction.ts`: runs the merge during sync and applies the result
+- `models/BaseItem.ts`: stores the base and keeps it when a sync doesn't provide a new one
```

---

### Incident Patch 2: `618f7e4f` (2026-10-05)
**Commit Message**: fix(deps): update dependency prosemirror-dropcursor to v1.8.3 (#16749)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `packages/editor/package.json` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@
     "dompurify": "3.4.11",
     "orderedmap": "2.1.1",
     "prosemirror-commands": "1.7.1",
-    "prosemirror-dropcursor": "1.8.2",
+    "prosemirror-dropcursor": "1.8.3",
     "prosemirror-example-setup": "1.2.3",
     "prosemirror-gapcursor": "1.4.0",
     "prosemirror-history": "1.5.0",
```

**File**: `yarn.lock` (modified, +13/-2)
```diff
@@ -12788,7 +12788,7 @@ __metadata:
     jest-environment-jsdom: "npm:29.7.0"
     orderedmap: "npm:2.1.1"
     prosemirror-commands: "npm:1.7.1"
-    prosemirror-dropcursor: "npm:1.8.2"
+    prosemirror-dropcursor: "npm:1.8.3"
     prosemirror-example-setup: "npm:1.2.3"
     prosemirror-gapcursor: "npm:1.4.0"
     prosemirror-history: "npm:1.5.0"
@@ -48549,7 +48549,18 @@ __metadata:
   languageName: node
   linkType: hard
 
-"prosemirror-dropcursor@npm:1.8.2, prosemirror-dropcursor@npm:^1.0.0":
+"prosemirror-dropcursor@npm:1.8.3":
+  version: 1.8.3
+  resolution: "prosemirror-dropcursor@npm:1.8.3"
+  dependencies:
+    prosemirror-state: "npm:^1.0.0"
+    prosemirror-transform: "npm:^1.1.0"
+    prosemirror-view: "npm:^1.1.0"
+  checksum: 10/184ffdcbbf7f3184f37bb8d02f77318f7c8cdd0c8f45346fc7cabc7cb0cad19f8fc76d892e25d00bf54e37e304ced57eecbc290b54d6c0b99e2d057c521440a9
+  languageName: node
+  linkType: hard
+
+"prosemirror-dropcursor@npm:^1.0.0":
   version: 1.8.2
   resolution: "prosemirror-dropcursor@npm:1.8.2"
   dependencies:
```

---

### Incident Patch 3: `5bffa4b7` (2026-10-04)
**Commit Message**: Chore: Fix flaky test checker

**File**: `.github/scripts/repeat_changed_tests.sh` (modified, +5/-3)
```diff
@@ -54,15 +54,17 @@ for package in $packages; do
 		continue
 	fi
 
-	# Paths must be relative to the package for `--runTestsByPath`.
-	packageTestFiles=$(echo "$testFiles" | grep -E "^packages/$package/" | sed -E "s|^packages/$package/||")
+	# Pass the file names without their extension: some packages run the
+	# TypeScript sources while others run the compiled files, and Jest matches
+	# these patterns against the full path either way.
+	packageTestNames=$(echo "$testFiles" | grep -E "^packages/$package/" | xargs -n 1 basename | sed -E 's#\.[a-z]+$##')
 
 	cd "$packageDir"
 	for i in $(seq 1 "$REPEAT_COUNT"); do
 		echo "Running $package tests - attempt $i/$REPEAT_COUNT..."
 
 		# shellcheck disable=SC2086
-		if ! yarn jest --runTestsByPath $packageTestFiles --forceExit; then
+		if ! yarn jest $packageTestNames --forceExit; then
 			echo "Tests failed on attempt $i/$REPEAT_COUNT in $package - they are flaky if earlier attempts passed"
 			exit 1
 		fi
```

---

### Incident Patch 4: `cd32d862` (2026-10-03)
**Commit Message**: Chore: Fixed flaky test

**File**: `packages/utils/fs.test.ts` (modified, +3/-4)
```diff
@@ -1,16 +1,15 @@
 /* eslint-disable import/prefer-default-export */
 
 import { mkdirp } from 'fs-extra';
-import { utimes } from 'fs/promises';
+import { mkdtemp, utimes } from 'fs/promises';
 import { FileLocker } from './fs';
 import { msleep, Second } from './time';
 
 const baseTempDir = `${__dirname}/../app-cli/tests/tmp`;
 
 export const createTempDir = async () => {
-	const p = `${baseTempDir}/${Date.now()}`;
-	await mkdirp(p);
-	return p;
+	await mkdirp(baseTempDir);
+	return mkdtemp(`${baseTempDir}/`);
 };
 
 describe('fs', () => {
```

---

### Incident Patch 5: `8db668e2` (2026-10-03)
**Commit Message**: Chore: Trying to fix flaky test on CI

**File**: `packages/app-mobile/components/screens/NoteRevisionViewer.test.tsx` (modified, +7/-6)
```diff
@@ -203,15 +203,16 @@ describe('screens/NoteRevisionViewer', () => {
 		const note = await createNoteWithTestRevisions(3);
 		render(<WrappedRevisionViewerScreen noteId={note.id}/>);
 
-		const dropdown = screen.getByRole('button', { name: 'Select a revision...' });
-		fireEvent.press(dropdown);
-
-		// Select the second revision
+		// Opening the dropdown before the revisions have loaded leaves its list permanently
+		// empty, so retry the press until the items are there.
 		await waitFor(() => {
-			const firstRevision = screen.getAllByRole('menuitem')[1];
-			fireEvent.press(firstRevision);
+			fireEvent.press(screen.getByHintText('Revision: Opens dropdown'));
+			expect(screen.getAllByRole('menuitem')).toHaveLength(3);
 		});
 
+		// Select the second revision
+		fireEvent.press(screen.getAllByRole('menuitem')[1]);
+
 		await waitFor(async () => {
 			expect(await getRevisionViewerText()).toBe('Update 2');
 		});
```

---

### Incident Patch 6: `0164f34d` (2026-10-02)
**Commit Message**: Chore: Trying to fix flaky iOS UI test by waiting for elements before tapping

**File**: `packages/app-mobile/ios/JoplinUITests/JoplinUITests.swift` (modified, +21/-10)
```diff
@@ -1,6 +1,16 @@
 import XCTest
 
 
+extension XCUIElement {
+	// XCUITest only retries finding an element for a few seconds, which isn't always enough on CI.
+	func waitThenTap(_ description: String, timeout: TimeInterval = 30.0) {
+		if !waitForExistence(timeout: timeout) {
+			XCTFail("Failed to find \(description)")
+		}
+		tap()
+	}
+}
+
 final class JoplinUITests: XCTestCase {
 
 	override func setUpWithError() throws {
@@ -23,11 +33,12 @@ final class JoplinUITests: XCTestCase {
 
 		// Should be able to fill the note body
 		let markdownEditor = app.textViews["Markdown editor"].firstMatch
-		markdownEditor.tap()
+		// The editor is rendered in a WebView, which can take a while to load on CI
+		markdownEditor.waitThenTap("the Markdown editor", timeout: 60.0)
 		markdownEditor.typeText("Note body.")
-		
+
 		let stopEditing = app.buttons["Stop editing"].firstMatch
-		stopEditing.tap()
+		stopEditing.waitThenTap("the \"stop editing\" button")
 		
 		// Should render
 		let noteBodyText = app.staticTexts["Note body."]
@@ -48,7 +59,7 @@ class MainScreen {
 	}
 
 	func openSidebar(app: XCUIApplication) -> SidebarScreen {
-		sidebarToggle(app).firstMatch.tap()
+		sidebarToggle(app).firstMatch.waitThenTap("the sidebar toggle")
 		return SidebarScreen()
 	}
 	
@@ -58,22 +69,22 @@ class MainScreen {
 	}
 	
 	func newNote(app: XCUIApplication) {
-		app.buttons["Add new"].tap()
-		
+		app.buttons["Add new"].waitThenTap("the \"add new\" button")
+
 		let newNoteButton = app.buttons
 				.element(matching: NSPredicate(format: "label LIKE \"*New note\""))
-		newNoteButton.firstMatch.tap()
+		newNoteButton.firstMatch.waitThenTap("the \"new note\" button")
 	}
 }
 
 class SidebarScreen {
 	func newFolder(app: XCUIApplication, name: String) {
 		let newFolderButton = app.buttons
 				.element(matching: NSPredicate(format: "label LIKE \"*New Notebook\""))
-		newFolderButton.firstMatch.tap()
+		newFolderButton.firstMatch.waitThenTap("the \"new notebook\" button")
 
 		let titleField = app.textFields["Enter notebook title"]
-		titleField.firstMatch.tap()
+		titleField.firstMatch.waitThenTap("the notebook title field")
 		titleField.firstMatch.typeText(name)
 		
 		let filledTitle = app.textFields[name]
@@ -84,6 +95,6 @@ class SidebarScreen {
 			// TODO: Fix this issue and fail if the typed title couldn't be found.
 		}
 
-		app.buttons["Save changes"].firstMatch.tap()
+		app.buttons["Save changes"].firstMatch.waitThenTap("the \"save changes\" button")
 	}
 }
```

---

### Incident Patch 7: `2603333a` (2026-10-02)
**Commit Message**: Desktop: Fixes #15865: Fix toolbar state becoming disabled on a secondary window when the note has been moved (#16620)

**File**: `packages/app-desktop/commands/openNoteInNewWindow.ts` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ export const runtime = (): CommandRuntime => {
 				windowId: `window-${noteId}-${idCounter++}`,
 				defaultAppWindowState: {
 					...createAppDefaultWindowState(),
+					notes: [note],
 					noteVisiblePanes: Setting.value('noteVisiblePanes'),
 					editorCodeView: Setting.value('editor.codeView'),
 				},
```

**File**: `packages/app-desktop/gui/NoteEditor/NoteEditor.tsx` (modified, +1/-1)
```diff
@@ -390,7 +390,7 @@ function NoteEditorContent(props: NoteEditorProps) {
 				throw error;
 			}
 		}
-	}, [formNote.id, props.syncUserId, shareCache]);
+	}, [formNote.id, formNote.deleted_time, props.syncUserId, shareCache]);
 
 	const onBodyWillChange = useCallback((event: { changeId: number }) => {
 		handleProvisionalFlag();
```

**File**: `packages/lib/BaseApplication.ts` (modified, +21/-1)
```diff
@@ -3,7 +3,7 @@ import Logger, { TargetType, LoggerWrapper } from '@joplin/utils/Logger';
 import shim from './shim';
 import { setupProxySettings } from './shim-init-node';
 import BaseService from './services/BaseService';
-import reducer, { getNotesParent, serializeNotesParent, setStore, State } from './reducer';
+import reducer, { defaultWindowId, getNotesParent, serializeNotesParent, setStore, State } from './reducer';
 import KeychainServiceDriverNode from './services/keychain/KeychainServiceDriver.node';
 import KeychainServiceDriverElectron from './services/keychain/KeychainServiceDriver.electron';
 import { setLocale } from './locale';
@@ -492,6 +492,7 @@ export default class BaseApplication {
 	protected async generalMiddleware(store: any, next: any, action: any) {
 		// appLogger.debug('Reducer action', this.reducerActionToString(action));
 
+		const previousState = store.getState() as State;
 		const result = next(action);
 		let refreshNotes = false;
 		let doRefreshFolders: boolean | string = false;
@@ -501,6 +502,22 @@ export default class BaseApplication {
 		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mirrors the generalMiddleware variance above; reduxSharedMiddleware accepts the same union
 		await reduxSharedMiddleware(store, next, action, ((action: any) => { this.dispatch(action); }) as any);
 		const newState = store.getState() as State;
+		const activeNoteSourceChanged = action.type === 'NOTE_UPDATE_ONE' &&
+			previousState.windowId !== defaultWindowId &&
+			previousState.windowId === newState.windowId && (
+			previousState.notesParentType !== newState.notesParentType ||
+				previousState.selectedFolderId !== newState.selectedFolderId ||
+				previousState.selectedSmartFilterId !== newState.selectedSmartFilterId ||
+				previousState.selectedTagId !== newState.selectedTagId ||
+				previousState.selectedSearchId !== newState.selectedSearchId
+		);
+		if (activeNoteSourceChanged) {
+			Setting.setValue('activeFolderId', newState.selectedFolderId);
+			Setting.setValue('notesParent', serializeNotesParent(getNotesParent(newState)));
+			this.currentFolder_ = newState.selectedFolderId ? await Folder.load(newState.selectedFolderId) : null;
+			refreshNotes = true;
+			refreshNotesUseSelectedNoteId = true;
+		}
 
 		if (this.hasGui() && ['NOTE_UPDATE_ONE', 'NOTE_DELETE', 'FOLDER_UPDATE_ONE', 'FOLDER_DELETE'].indexOf(action.type) >= 0) {
 			if (!(await reg.syncTarget().syncStarted())) void reg.scheduleSync(reg.syncAsYouTypeInterval(), { syncSteps: Synchronizer.partialSyncSteps });
@@ -571,6 +588,9 @@ export default class BaseApplication {
 		// Refreshing notes after switching windows helps ensure that the selected note/tags/other state
 		// is correct for the current window.
 		if (action.type === 'WINDOW_FOCUS' && action.lastWindowId !== action.windowId) {
+			Setting.setValue('activeFolderId', newState.selectedFolderId);
+			Setting.setValue('notesParent', serializeNotesParent(getNotesParent(newState)));
+			this.currentFolder_ = newState.selectedFolderId ? await Folder.load(newState.selectedFolderId) : null;
 			refreshNotes = true;
 			refreshNotesUseSelectedNoteId = true;
 		}
```

**File**: `packages/lib/models/Note.ts` (modified, +8/-1)
```diff
@@ -760,7 +760,14 @@ export default class Note extends BaseItem {
 			updated_time: time.unixMs(),
 		};
 
-		return Note.save(modifiedNote, { autoTimestamp: false, ...saveOptions });
+		return Note.save(modifiedNote, {
+			autoTimestamp: false,
+			...saveOptions,
+			dispatchOptions: {
+				...saveOptions?.dispatchOptions,
+				noteMovedToFolder: true,
+			},
+		});
 	}
 
 	public static changeNoteType(note: NoteEntity, type: string) {
```

**File**: `packages/lib/models/utils/types.ts` (modified, +4/-1)
```diff
@@ -52,7 +52,10 @@ export interface SaveOptions {
 	provisional?: boolean;
 	ignoreProvisionalFlag?: boolean;
 	dispatchUpdateAction?: boolean;
-	dispatchOptions?: { preserveSelection: boolean };
+	dispatchOptions?: {
+		preserveSelection?: boolean;
+		noteMovedToFolder?: boolean;
+	};
 	disableReadOnlyCheck?: boolean;
 	useNoteLock?: boolean;
 	// Encrypt with this key captured when the note was decrypted, instead of the live session key.
```

**File**: `packages/lib/reducer.test.ts` (modified, +317/-11)
```diff
@@ -6,6 +6,7 @@ import BaseModel from './BaseModel';
 import Folder from './models/Folder';
 import ItemChange from './models/ItemChange';
 import getConflictFolderId from './models/utils/getConflictFolderId';
+import getTrashFolderId from './services/trash/getTrashFolderId';
 import { ALL_NOTES_FILTER_ID } from './reserved-ids';
 
 function initTestState(folders: FolderEntity[], selectedFolderIndex: number, notes: NoteEntity[], selectedNoteIndexes: number[], tags: TagEntity[] = null, selectedTagIndex: number = null) {
@@ -1040,12 +1041,14 @@ describe('reducer', () => {
 		expect(conflictState.notes.map(note => note.id)).toEqual([conflictNote.id]);
 	});
 
-	test('sync moving the selected note in a background window should not change its selection', async () => {
+	it.each([
+		['locally', ItemChange.SOURCE_UNSPECIFIED, 2, 1],
+		['during sync', ItemChange.SOURCE_SYNC, 0, 0],
+	])('moving the selected note %s should keep it open in a background window', async (_description, changeSource, primarySelectedIndex, expectedPrimarySelectedIndex) => {
 		const folders = await createNTestFolders(2);
 		const notes = await createNTestNotes(3, folders[0]);
 
-		// Primary window selects note[0]
-		let state = initTestState(folders, 0, notes, [0]);
+		let state = initTestState(folders, 0, notes, [primarySelectedIndex]);
 
 		// Background window selects note[2]
 		const secondaryWindowId = 'window1';
@@ -1058,22 +1061,325 @@ describe('reducer', () => {
 			parent_id: folders[1].id,
 		};
 
+		state = reducer(state, {
+			type: 'NOTE_UPDATE_ONE',
+			note: movedNote,
+			changeSource,
+		});
+
+		// The background window should retain both the selection and the note metadata used
+		// to determine whether editor toolbar commands are enabled.
+		expect(state.backgroundWindows[secondaryWindowId].selectedNoteIds).toEqual([notes[2].id]);
+		expect(state.backgroundWindows[secondaryWindowId].notes).toEqual([movedNote]);
+		expect(state.backgroundWindows[secondaryWindowId].selectedFolderId).toBe(folders[1].id);
+		expect(state.backgroundWindows[secondaryWindowId].selectedFolderIds).toEqual([folders[1].id]);
+		expect(state.backgroundWindows[secondaryWindowId].notesSource).toBe('');
+
+		expect(state.selectedNoteIds).toEqual([notes[expectedPrimarySelectedIndex].id]);
+
+		state = reducer(state, { type: 'WINDOW_FOCUS', windowId: secondaryWindowId });
+		state = reducer(state, { type: 'NOTE_UPDATE_ALL', notes: [movedNote], notesSource: 'test' });
+		expect(state.selectedNoteIds).toEqual([movedNote.id]);
+		expect(state.notes).toContainEqual(movedNote);
+	});
+
+	test('moving one of multiple selected notes should not change a background window folder', async () => {
+		const folders = await createNTestFolders(2);
+		const notes = await createNTestNotes(3, folders[0]);
+		const secondaryWindowId = 'window1';
+		let state = initTestState(folders, 0, notes, [0]);
+		state = createBackgroundWindow(state, secondaryWindowId, notes[2], notes);
+		state = reducer(state, { type: 'WINDOW_FOCUS', windowId: secondaryWindowId });
+		state = reducer(state, { type: 'NOTE_SELECT', ids: [notes[1].id, notes[2].id] });
+		state = reducer(state, { type: 'WINDOW_FOCUS', windowId: defaultWindowId });
+
+		state = reducer(state, {
+			type: 'NOTE_UPDATE_ONE',
+			note: { ...notes[2], parent_id: folders[1].id },
+		});
+
+		expect(state.backgroundWindows[secondaryWindowId].selectedFolderId).toBe(folders[0].id);
+		expect(state.backgroundWindows[secondaryWindowId].notes.map(n => n.id)).toEqual([notes[0].id, notes[1].id]);
+	});
+
+	it.each([
+		['locally', ItemChange.SOURCE_UNSPECIFIED],
+		['during sync', ItemChange.SOURCE_SYNC],
+	])('moving a selected note without a parent %s should switch its background window to All Notes', async (_description, changeSource) => {
+		const folders = await createNTestFolders(1);
+		const notes = await createNTestNotes(1, folders[0]);
+		const secondaryWindowId = 'window1';
+		let state = initTestState(folders, 0, notes, [0]);
+		state = createBackgroundWindow(state, secondaryWindowId, notes[0], notes);
+
+		const movedNote = { ...notes[0], parent_id: '' };
+		state = reducer(state, { type: 'NOTE_UPDATE_ONE', note: movedNote, changeSource });
+
+		const secondaryWindow = state.backgroundWindows[secondaryWindowId];
+		expect(secondaryWindow.notesParentType).toBe('SmartFilter');
+		expect(secondaryWindow.selectedSmartFilterId).toBe(ALL_NOTES_FILTER_ID);
+		expect(secondaryWindow.selectedFolderId).toBeNull();
+		expect(secondaryWindow.selectedFolderIds).toEqual([]);
+		expect(secondaryWindow.notes).toEqual([movedNote]);
+	});
+
+	test('moving a selected note during sync should follow its folder ID even if the folder is not loaded', async () => {
+		const folders = await createNTestFolders(1);
+		const notes = await createNTestNotes(1, folders[0]);
+		const secondaryWindowId = 'window1';
+		let state = initTestState(folders, 0, notes, [0]);
+		state = createBackgroundWindow(state, secondaryWindowId, notes[0], notes);
+
+		
```

**File**: `packages/lib/reducer.ts` (modified, +56/-4)
```diff
@@ -22,7 +22,7 @@ export interface SearchEntry {
 }
 import { getListRendererIds } from './services/noteList/renderers';
 import { ComplexTerm, ProcessResultsRow } from './services/search/SearchEngine';
-import { getDisplayParentId } from './services/trash';
+import { getDisplayParentId, getTrashFolderId } from './services/trash';
 import Logger from '@joplin/utils/Logger';
 import { SettingsRecord } from './models/settings/types';
 import { Toast, ToastType } from './services/plugins/api/types';
@@ -1179,10 +1179,23 @@ const reducer = produce((draft: Draft<State> = defaultState, action: any) => {
 			{
 				const modNote: NoteEntity = action.note;
 				const handleWindowState = (windowDraft: Draft<WindowState>) => {
+					const isSecondaryWindow = windowDraft.windowId !== defaultWindowId;
 					const isViewingAllNotes = (windowDraft.notesParentType === 'SmartFilter' && windowDraft.selectedSmartFilterId === ALL_NOTES_FILTER_ID);
 					const isViewingConflictFolder = windowDraft.notesParentType === 'Folder' && windowDraft.selectedFolderId === Folder.conflictFolderId();
+					const isOnlySelectedInSecondaryWindow = isSecondaryWindow && windowDraft.selectedNoteIds.length === 1 && windowDraft.selectedNoteIds[0] === modNote.id;
+					const noteDisplayParentId = (note: NoteEntity) => {
+						if (note.deleted_time) return getDisplayParentId(note, draft.folders.find(f => f.id === note.parent_id));
+						if (note.is_conflict) return Folder.conflictFolderId();
+						return getDisplayParentId(note, draft.folders.find(f => f.id === note.parent_id));
+					};
 
 					const noteIsInCurrentView = function(note: NoteEntity, folderId: string) {
+						// Deleted conflicts belong to Trash. This check needs to happen before the
+						// conflict check because is_conflict is only available after decryption.
+						if (note.deleted_time) {
+							const noteDisplayParentId = getDisplayParentId(note, draft.folders.find(f => f.id === note.parent_id));
+							return folderId === noteDisplayParentId;
+						}
 						if (note.is_conflict) return isViewingConflictFolder;
 						if (isViewingAllNotes) return true;
 						const noteDisplayParentId = getDisplayParentId(note, draft.folders.find(f => f.id === note.parent_id));
@@ -1196,8 +1209,48 @@ const reducer = produce((draft: Draft<State> = defaultState, action: any) => {
 					for (let i = 0; i < newNotes.length; i++) {
 						const n = newNotes[i];
 						if (n.id === modNote.id) {
-							const previousDisplayParentId = ('parent_id' in n) ? getDisplayParentId(n, draft.folders.find(f => f.id === n.parent_id)) : '';
-							if (n.is_conflict && !modNote.is_conflict) {
+							const previousDisplayParentId = ('parent_id' in n) ? noteDisplayParentId(n) : '';
+							// is_conflict is encrypted. During sync, retain the conflict identity from
+							// the existing deleted note until the restored placeholder is decrypted.
+							const isEncryptedRestoredConflict = !!n.is_conflict && !!n.deleted_time && !modNote.deleted_time && !!modNote.encryption_applied;
+							const displayParentId = isEncryptedRestoredConflict ? Folder.conflictFolderId() : noteDisplayParentId(modNote);
+							const conflictTrashStateChanged = !!n.is_conflict && (!!modNote.is_conflict || isEncryptedRestoredConflict) && !!n.deleted_time !== !!modNote.deleted_time;
+							const conflictBecameRegularNote = !!n.is_conflict && !modNote.is_conflict;
+							const regularNoteMoved = !n.is_conflict && !modNote.is_conflict && previousDisplayParentId !== displayParentId;
+							const displayParentChanged = !!action.noteMovedToFolder || conflictTrashStateChanged || conflictBecameRegularNote || regularNoteMoved;
+							const shouldFollowMovedNote = isOnlySelectedInSecondaryWindow && windowDraft.notesParentType === 'Folder' && displayParentChanged;
+							if (shouldFollowMovedNote) {
+								const parentFolder = draft.folders.find(f => f.id === displayParentId);
+								const isVirtualFolder = displayParentId === getTrashFolderId() || displayParentId === Folder.conflictFolderId();
+								if (parentFolder) {
+									windowDraft.notesParentType = 'Folder';
+									windowDraft.selectedSmartFilterId = null;
+									windowDraft.selectedFolderId = displayParentId;
+									windowDraft.selectedFolderIds = [displayParentId];
+								} else if (isVirtualFolder) {
+									windowDraft.notesParentType = 'Folder';
+									windowDraft.selectedSmartFilterId = null;
+									windowDraft.selectedFolderId = displayParentId;
+									windowDraft.selectedFolderIds = [displayParentId];
+								} else if (action.changeSource === ItemChange.SOURCE_SYNC && displayParentId) {
+									// Sync can deliver a note before its parent folder. Select the destination
+									// by ID now; the folder list and focus refresh will populate it later.
+									windowDraft.notesParentType = 'Folder';
+									windowDraft.selectedSmartFilterId = null;
+									windowDraft.selectedFolderId = displayParentId;
+									windowDraft.sel
```

---

### Incident Patch 8: `c64cfb19` (2026-10-02)
**Commit Message**: Desktop: Fix infinite loop in some cases when the notebook ordering is set to "updated date" (#16692)

**File**: `packages/lib/models/Folder.test.ts` (modified, +15/-0)
```diff
@@ -126,6 +126,21 @@ describe('models/Folder', () => {
 		expect(folders[3].id).toBe(f2.id);
 	}));
 
+	it('should order by last modified, handling cycles', async () => {
+		let f1 = await Folder.save({ title: 'folder1' });
+		const f2 = await Folder.save({ title: 'folder2', parent_id: f1.id });
+		const f3 = await Folder.save({ title: 'folder3', parent_id: f2.id });
+		f1 = await Folder.save({ id: f1.id, parent_id: f3.id });
+		await Note.save({ title: 'note3', parent_id: f3.id });
+
+		// Should not crash
+		await Folder.orderByLastModified([
+			await Folder.load(f3.id),
+			await Folder.load(f2.id),
+			await Folder.load(f1.id),
+		], 'desc');
+	});
+
 	it('should add node counts', (async () => {
 		const f1 = await Folder.save({ title: 'folder1' });
 		const f2 = await Folder.save({ title: 'folder2', parent_id: f1.id });
```

**File**: `packages/lib/models/Folder.ts` (modified, +4/-3)
```diff
@@ -337,22 +337,23 @@ export default class Folder extends BaseItem {
 			return null;
 		};
 
-		const applyChildTimeToParent = (folderId: string) => {
+		const applyChildTimeToParent = (folderId: string, visitedIds: string[]) => {
 			const parent = findFolderParent(folderId);
 			if (!parent) return;
+			if (visitedIds.includes(folderId)) return;
 
 			if (folderIdToTime[parent.id] && folderIdToTime[parent.id] >= folderIdToTime[folderId]) {
 				// Don't change so that parent has the same time as the last updated child
 			} else {
 				folderIdToTime[parent.id] = folderIdToTime[folderId];
 			}
 
-			applyChildTimeToParent(parent.id);
+			applyChildTimeToParent(parent.id, [...visitedIds, folderId]);
 		};
 
 		for (const folderId in folderIdToTime) {
 			if (!folderIdToTime.hasOwnProperty(folderId)) continue;
-			applyChildTimeToParent(folderId);
+			applyChildTimeToParent(folderId, []);
 		}
 
 		const mod = dir === 'DESC' ? +1 : -1;
```

---

### Incident Patch 9: `c199af7c` (2026-10-02)
**Commit Message**: Desktop, Mobile: Fix displayed note updated_time is reverted to the remote updated_time upon auto merging a conflict (#16727)

**File**: `packages/lib/services/synchronizer/utils/handleConflictAction.ts` (modified, +8/-4)
```diff
@@ -96,12 +96,14 @@ export default async (action: SyncAction, ItemClass: typeof BaseItem, remoteExis
 			// Only the title and body are replaced, so fields such as user_updated_time stay
 			// consistent with the normal conflict path. The decrypted copy drops the cipher text
 			const remoteNote = decryptedRemoteNote;
+			// Ahead of the remote time so the merge uploads as a local change
+			const newUpdatedTime = Math.max(time.unixMs(), remoteNote.updated_time + 1);
 			const mergedNote: NoteEntity = {
 				...remoteNote,
 				title: merge.resolvedLocal.title,
 				body: merge.resolvedLocal.body,
-				// Ahead of the remote time so the merge uploads as a local change
-				updated_time: Math.max(time.unixMs(), remoteNote.updated_time + 1),
+				updated_time: newUpdatedTime,
+				user_updated_time: newUpdatedTime,
 			};
 			// Both sides now share the merged output, so it becomes the base for later conflicts
 			const mergedBase = {
@@ -142,12 +144,14 @@ export default async (action: SyncAction, ItemClass: typeof BaseItem, remoteExis
 				const remoteUnchanged = merge.resolvedCurrent.title === remoteNote.title && merge.resolvedCurrent.body === remoteNote.body;
 
 				local = { ...local, title: merge.resolvedLocal.title, body: merge.resolvedLocal.body } as NoteEntity;
+				// Ahead of the remote time so the merged changes upload as a local change
+				const newUpdatedTime = Math.max(time.unixMs(), remoteNote.updated_time + 1);
 				remoteContent = {
 					...remoteNote,
 					title: merge.resolvedCurrent.title,
 					body: merge.resolvedCurrent.body,
-					// Ahead of the remote time so the merged changes upload as a local change
-					updated_time: remoteUnchanged ? remoteNote.updated_time : Math.max(time.unixMs(), remoteNote.updated_time + 1),
+					updated_time: remoteUnchanged ? remoteNote.updated_time : newUpdatedTime,
+					user_updated_time: remoteUnchanged ? remoteNote.user_updated_time : newUpdatedTime,
 				} as NoteEntity;
 			}
 
```

---

### Incident Patch 10: `d9f0b420` (2026-09-25)
**Commit Message**: Desktop: Fixes #16215: Increase defaultAutoSelectFamilyAttemptTimeout to 500 ms (#16576)

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -704,6 +704,7 @@ packages/app-desktop/utils/customProtocols/registerCustomProtocols.js
 packages/app-desktop/utils/getAssetPath.js
 packages/app-desktop/utils/initReact.js
 packages/app-desktop/utils/initializeCommandService.js
+packages/app-desktop/utils/initializeNetworkConnectionAttemptTimeout.js
 packages/app-desktop/utils/isSafeToOpen.test.js
 packages/app-desktop/utils/isSafeToOpen.js
 packages/app-desktop/utils/layout/layoutKeyToLabel.js
```

**File**: `.ignore.eslint` (modified, +1/-0)
```diff
@@ -730,6 +730,7 @@ packages/app-desktop/utils/customProtocols/registerCustomProtocols.js
 packages/app-desktop/utils/getAssetPath.js
 packages/app-desktop/utils/initReact.js
 packages/app-desktop/utils/initializeCommandService.js
+packages/app-desktop/utils/initializeNetworkConnectionAttemptTimeout.js
 packages/app-desktop/utils/isSafeToOpen.test.js
 packages/app-desktop/utils/isSafeToOpen.js
 packages/app-desktop/utils/layout/layoutKeyToLabel.js
```

**File**: `packages/app-desktop/main-html.ts` (modified, +3/-0)
```diff
@@ -38,8 +38,11 @@ import PerformanceLogger from '@joplin/lib/PerformanceLogger';
 import * as pdfJs from 'pdfjs-dist';
 import { isAppleSilicon } from 'is-apple-silicon';
 import restart from './services/restart';
+import initializeNetworkConnectionAttemptTimeout from './utils/initializeNetworkConnectionAttemptTimeout';
 require('@sentry/electron/renderer');
 
+initializeNetworkConnectionAttemptTimeout();
+
 // Allows components to use React as a global
 window.React = React;
 
```

**File**: `packages/app-desktop/main.ts` (modified, +3/-0)
```diff
@@ -13,6 +13,9 @@ const packageInfo = require('./packageInfo.js');
 import { isCallbackUrl } from '@joplin/lib/callbackUrlUtils';
 import determineBaseAppDirs from '@joplin/lib/determineBaseAppDirs';
 import registerCustomProtocols from './utils/customProtocols/registerCustomProtocols';
+import initializeNetworkConnectionAttemptTimeout from './utils/initializeNetworkConnectionAttemptTimeout';
+
+initializeNetworkConnectionAttemptTimeout();
 
 // Electron takes the application name from package.json `name` and
 // displays this in the tray icon toolip and message box titles, however in
```

**File**: `packages/app-desktop/utils/initializeNetworkConnectionAttemptTimeout.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+const net = require('net') as typeof import('net') & {
+	getDefaultAutoSelectFamilyAttemptTimeout: ()=> number;
+	setDefaultAutoSelectFamilyAttemptTimeout: (value: number)=> void;
+};
+
+export default () => {
+	// Prior to Node 26, the default value is 250 ms, which is too low in some situations. Increase the default to match the Node 26
+	// default of 500 ms, at least until the app is upgraded to Node 26
+	net.setDefaultAutoSelectFamilyAttemptTimeout(Math.max(net.getDefaultAutoSelectFamilyAttemptTimeout(), 500));
+};
```

---

### Incident Patch 11: `c32c50fb` (2026-09-25)
**Commit Message**: Desktop: Fixes #16628: Prevent note being selected in the primary window when a secondary window is closed when it's not in focus (#16629)

**File**: `packages/app-desktop/app.test.ts` (modified, +29/-1)
```diff
@@ -1,7 +1,7 @@
 import BaseApplication, { shouldPreserveSelectedNoteOnSmartFilterSelect } from '@joplin/lib/BaseApplication';
 import ItemChange from '@joplin/lib/models/ItemChange';
 import Note from '@joplin/lib/models/Note';
-import { defaultState } from '@joplin/lib/reducer';
+import { defaultState, defaultWindowId, State } from '@joplin/lib/reducer';
 import { ALL_NOTES_FILTER_ID } from '@joplin/lib/reserved-ids';
 import { NoteEntity } from '@joplin/lib/services/database/types';
 import ExternalEditWatcher from '@joplin/lib/services/ExternalEditWatcher';
@@ -47,6 +47,34 @@ describe('app', () => {
 		expect(shouldPreserveSelectedNoteOnSmartFilterSelect(state, ALL_NOTES_FILTER_ID)).toBe(expected);
 	});
 
+	test('should not apply a note refresh after the active window changes', async () => {
+		const secondaryState = {
+			...defaultState,
+			windowId: 'secondary-window',
+			notesParentType: 'Folder',
+			selectedFolderId: 'secondary-folder',
+			selectedNoteIds: ['secondary-note'],
+		} as State;
+		let activeState = secondaryState;
+		const dispatch = jest.fn();
+		const storeMock = jest.spyOn(app(), 'store').mockReturnValue({
+			dispatch,
+			getState: () => activeState,
+		} as unknown as ReturnType<ReturnType<typeof app>['store']>);
+		const previewsMock = jest.spyOn(Note, 'previews').mockImplementation(async () => {
+			activeState = { ...defaultState, windowId: defaultWindowId } as State;
+			return [{ id: 'secondary-note' }] as NoteEntity[];
+		});
+
+		try {
+			await app().refreshNotes(secondaryState, true);
+			expect(dispatch).not.toHaveBeenCalled();
+		} finally {
+			previewsMock.mockRestore();
+			storeMock.mockRestore();
+		}
+	});
+
 	beforeEach(async () => {
 		await setupDatabaseAndSynchronizer(0);
 		await switchClient(0);
```

**File**: `packages/lib/BaseApplication.ts` (modified, +4/-0)
```diff
@@ -278,6 +278,10 @@ export default class BaseApplication {
 			}
 		}
 
+		// The active window may have changed while the note query was running. Applying this
+		// result to another window would replace its note list and selection with stale state.
+		if (this.store().getState().windowId !== state.windowId) return;
+
 		this.store().dispatch({
 			type: 'SET_HIGHLIGHTED',
 			words: highlightedWords,
```

---

### Incident Patch 12: `0a8bfffb` (2026-09-25)
**Commit Message**: Desktop, Mobile: Fix table editor losing and mis-rendering inline markdown (#16632)

**File**: `packages/editor/CodeMirror/extensions/rendering/renderTables.test.ts` (modified, +66/-0)
```diff
@@ -39,6 +39,13 @@ describe('renderTables', () => {
 		{ input: 'a **b** c', expected: 'a b c', inner: 'a <strong>b</strong> c' },
 		// Escaped pipes are unescaped for display.
 		{ input: 'a \\| b', expected: 'a | b', inner: 'a | b' },
+		// Nested markup renders both layers.
+		{ input: '**[label](https://example.com)**', expected: 'label', inner: '<strong><a href="https://example.com">label</a></strong>' },
+		{ input: '[**label**](https://example.com)', expected: 'label', inner: '<a href="https://example.com"><strong>label</strong></a>' },
+		{ input: '*[label](https://example.com)*', expected: 'label', inner: '<em><a href="https://example.com">label</a></em>' },
+		{ input: '**~~strike~~**', expected: 'strike', inner: '<strong><del>strike</del></strong>' },
+		// Code spans stay literal.
+		{ input: '`**not bold**`', expected: '**not bold**', inner: '<code>**not bold**</code>' },
 	])('renderInlineMarkdown should render $input', ({ input, expected, inner }) => {
 		const div = document.createElement('div');
 		renderInlineMarkdown(div, input);
@@ -202,4 +209,63 @@ describe('renderTables', () => {
 		}
 	});
 
+	test.each([
+		'**[label](https://example.com)**',
+		'**bold**',
+		'*italic*',
+		'`code`',
+	])('focus/blur cycles should not degrade cell markdown: %s', async (cellSource) => {
+		jest.useFakeTimers();
+		let editor: EditorView | null = null;
+		try {
+			const markdown = `| a | b |\n|---|---|\n| ${cellSource} | y |`;
+			editor = await createEditor(markdown);
+			document.body.appendChild(editor.dom);
+
+			// Each cycle re-renders the cell without editing it.
+			for (let i = 0; i < 3; i++) {
+				const cell = findCellTextDivs(editor)[2];
+				focusCell(cell);
+				cell.dispatchEvent(new Event('blur'));
+				jest.advanceTimersByTime(200);
+				jest.runOnlyPendingTimers();
+
+				const rendered = findCellTextDivs(editor)[2];
+				expect(rendered.classList.contains('cm-tw-raw')).toBe(false);
+			}
+
+			expect(editor.state.doc.toString()).toContain(cellSource);
+		} finally {
+			editor?.destroy();
+			jest.useRealTimers();
+		}
+	});
+
+	test('a blurred cell should not write its rendered text back to the document', async () => {
+		jest.useFakeTimers();
+		let editor: EditorView | null = null;
+		try {
+			editor = await createEditor('| a | b |\n|---|---|\n| **[x](http://e.com)** | y |');
+			document.body.appendChild(editor.dom);
+
+			const cell = findCellTextDivs(editor)[2];
+			focusCell(cell);
+			cell.dispatchEvent(new Event('blur'));
+			jest.advanceTimersByTime(200);
+			jest.runOnlyPendingTimers();
+
+			// An input event on the now-rendered cell, as a stray mutation
+			// would fire, must not harvest its stripped text.
+			const rendered = findCellTextDivs(editor)[2];
+			rendered.dispatchEvent(new Event('input'));
+			jest.advanceTimersByTime(700);
+			jest.runOnlyPendingTimers();
+
+			expect(editor.state.doc.toString()).toContain('**[x](http://e.com)**');
+		} finally {
+			editor?.destroy();
+			jest.useRealTimers();
+		}
+	});
+
 });
```

**File**: `packages/editor/CodeMirror/extensions/rendering/renderTables.ts` (modified, +101/-57)
```diff
@@ -27,6 +27,8 @@ const W = 'cm-tw';
 const CELL = 'cm-tw-c';
 const HDR = 'cm-tw-h';
 const CTX = 'cm-tw-ctx';
+// Marks a cell holding raw source. Only these may be read back into the model.
+const RAW = 'cm-tw-raw';
 
 // Cache for rendered table widget heights so CodeMirror can estimate
 // heights correctly for scroll position and coordinate mapping.
@@ -59,45 +61,54 @@ const escapeHtml = (s: string): string => {
 // shown as plain |. The assembled HTML is run through DOMPurify before
 // insertion, so unsafe URL schemes (javascript:, data:, ...) and any tags
 // or attributes that slipped through the regex are removed.
-export const renderInlineMarkdown = (parent: HTMLElement, text: string) => {
-	// Normalise: escaped pipes → |, and split on literal <br> for soft breaks.
-	const normalised = text.replace(/\\\|/g, '|');
-	const segments = normalised.split(/<br\s*\/?>/i);
+// Wrapper contents recurse so nested markup works (**[label](url)** is a bold
+// link). Code spans do not: their contents are literal in markdown.
+const inlineMarkdownToHtml = (segment: string): string => {
+	// Single regex with alternatives, scanned left-to-right. Each branch
+	// captures its inner content. Single * and _ emphasis use word-
+	// boundary guards so identifiers like `foo_bar_baz` or `a*b*c` are
+	// not rendered as emphasis.
+	const re = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|(?<![A-Za-z0-9])\*([^*]+)\*(?![A-Za-z0-9])|(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])|`([^`]+)`|~~([\s\S]+?)~~|\[([^\]]*)\]\(([^)\s]+)\)/g;
 	const parts: string[] = [];
-	for (let s = 0; s < segments.length; s++) {
-		if (s > 0) parts.push('<br>');
-		const segment = segments[s];
-		// Single regex with alternatives, scanned left-to-right. Each branch
-		// captures its inner content. Single * and _ emphasis use word-
-		// boundary guards so identifiers like `foo_bar_baz` or `a*b*c` are
-		// not rendered as emphasis.
-		const re = /\*\*([^*]+)\*\*|__([^_]+)__|(?<![A-Za-z0-9])\*([^*]+)\*(?![A-Za-z0-9])|(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])|`([^`]+)`|~~([^~]+)~~|\[([^\]]+)\]\(([^)\s]+)\)/g;
-		let lastIdx = 0;
-		let m: RegExpExecArray | null;
-		while ((m = re.exec(segment)) !== null) {
-			if (m.index > lastIdx) {
-				parts.push(escapeHtml(segment.slice(lastIdx, m.index)));
-			}
-			if (m[1] !== undefined || m[2] !== undefined) {
-				parts.push(`<strong>${escapeHtml((m[1] ?? m[2])!)}</strong>`);
-			} else if (m[3] !== undefined || m[4] !== undefined) {
-				parts.push(`<em>${escapeHtml((m[3] ?? m[4])!)}</em>`);
-			} else if (m[5] !== undefined) {
-				parts.push(`<code>${escapeHtml(m[5])}</code>`);
-			} else if (m[6] !== undefined) {
-				parts.push(`<del>${escapeHtml(m[6])}</del>`);
-			} else {
-				parts.push(`<a href="${escapeHtml(m[8]!)}">${escapeHtml(m[7]!)}</a>`);
-			}
-			lastIdx = m.index + m[0].length;
+	let lastIdx = 0;
+	let m: RegExpExecArray | null;
+	while ((m = re.exec(segment)) !== null) {
+		if (m.index > lastIdx) {
+			parts.push(escapeHtml(segment.slice(lastIdx, m.index)));
 		}
-		if (lastIdx < segment.length) {
-			parts.push(escapeHtml(segment.slice(lastIdx)));
+		if (m[1] !== undefined || m[2] !== undefined) {
+			parts.push(`<strong>${inlineMarkdownToHtml((m[1] ?? m[2])!)}</strong>`);
+		} else if (m[3] !== undefined || m[4] !== undefined) {
+			parts.push(`<em>${inlineMarkdownToHtml((m[3] ?? m[4])!)}</em>`);
+		} else if (m[5] !== undefined) {
+			parts.push(`<code>${escapeHtml(m[5])}</code>`);
+		} else if (m[6] !== undefined) {
+			parts.push(`<del>${inlineMarkdownToHtml(m[6])}</del>`);
+		} else {
+			parts.push(`<a href="${escapeHtml(m[8]!)}">${inlineMarkdownToHtml(m[7]!)}</a>`);
 		}
+		lastIdx = m.index + m[0].length;
 	}
-	parent.innerHTML = sanitizeHtml(parts.join(''));
+	if (lastIdx < segment.length) {
+		parts.push(escapeHtml(segment.slice(lastIdx)));
+	}
+	return parts.join('');
+};
+
+export const renderInlineMarkdown = (parent: HTMLElement, text: string) => {
+	// Normalise: escaped pipes → |, and split on literal <br> for soft breaks.
+	const normalised = text.replace(/\\\|/g, '|');
+	const html = normalised
+		.split(/<br\s*\/?>/i)
+		.map(inlineMarkdownToHtml)
+		.join('<br>');
+	parent.innerHTML = sanitizeHtml(html);
 };
 
+// Stashed on the container so destroy() can reach toDOM()'s closure state.
+const teardownKey = Symbol('tableWidgetTeardown');
+type TableWidgetContainer = HTMLElement & { [teardownKey]?: ()=> void };
+
 class TableWidget extends WidgetType {
 	public constructor(
 		private tableText: string,
@@ -202,6 +213,9 @@ class TableWidget extends WidgetType {
 		let scrollbarDragging = false;
 		let lastFocusedTextDiv: HTMLElement | null = null;
 
+		// Disconnected on destroy so a detached DOM cannot still schedule syncs.
+		const cellObservers: MutationObserver[] = [];
+
 		// Debounced dispatch so the document source stays in sync with cell
 		// edits — important so the preview pane reflects in-cell changes
 		// (e.g. deleting an image) without waiting for blur or a structur
```

---

### Incident Patch 13: `4978154d` (2026-09-25)
**Commit Message**: Web: Fixes #16633: Fix sync (#16634)

**File**: `packages/lib/models/BaseItem.ts` (modified, +1/-1)
```diff
@@ -772,7 +772,7 @@ export default class BaseItem extends BaseModel {
 			// 'SELECT * FROM [ITEMS] items JOIN sync_items s ON s.item_id = items.id WHERE sync_target = ? AND'
 
 			let extraWhere: string[]|string = [];
-			if (className === 'Note') extraWhere.push('(is_conflict = 0 OR (conflict_original_id != "" AND share_id = ""))');
+			if (className === 'Note') extraWhere.push('(is_conflict = 0 OR (conflict_original_id != \'\' AND share_id = \'\'))');
 			if (className === 'Resource') extraWhere.push('encryption_blob_encrypted = 0');
 			if (ItemClass.encryptionSupported()) extraWhere.push('encryption_applied = 0');
 
```

**File**: `packages/lib/models/Note.ts` (modified, +1/-1)
```diff
@@ -587,7 +587,7 @@ export default class Note extends BaseItem {
 	}
 
 	public static async syncIneligibleConflictedCount() {
-		const r = await this.db().selectOne('SELECT count(*) as total FROM notes WHERE is_conflict = 1 AND (conflict_original_id = "" OR share_id != "")');
+		const r = await this.db().selectOne('SELECT count(*) as total FROM notes WHERE is_conflict = 1 AND (conflict_original_id = \'\' OR share_id != \'\')');
 		return r && r.total ? r.total : 0;
 	}
 
```

---

### Incident Patch 14: `ef29c43c` (2026-09-25)
**Commit Message**: Desktop, Mobile, Cli: Fixes #16647: Fix notes and sub-folders are still marked as published after being moved out of a published folder (#16648)

**File**: `packages/lib/models/Folder.publishing.test.ts` (modified, +83/-0)
```diff
@@ -11,6 +11,14 @@ const publishedFolderShareState = (folderId: string): StateShare => ({
 	master_key_id: '',
 });
 
+const publishedNoteShareState = (noteId: string): StateShare => ({
+	id: `share-note-${noteId}`,
+	type: ShareType.Note,
+	note_id: noteId,
+	folder_id: '',
+	master_key_id: '',
+});
+
 type ItemSlice = { title: string };
 
 const expectPublished = async (items: ItemSlice[], published = true) => {
@@ -101,4 +109,79 @@ describe('models/Folder.publishing', () => {
 			'unpublished note',
 		].map(title => ({ title })));
 	});
+
+	it('should clear is_shared when a folder is no longer published', async () => {
+		await createFolderTree('', [
+			{
+				title: 'unpublished',
+				is_shared: 1,
+				children: [
+					{
+						title: 'sub-folder 1',
+						is_shared: 1,
+						children: [
+							{
+								title: 'sub-sub-folder 1',
+								is_shared: 1,
+								children: [
+									{ title: 'now unpublished note', is_shared: 1 },
+									{ title: 'directly published note', is_shared: 1 },
+								],
+							},
+						],
+					},
+				],
+			},
+			{
+				title: 'still published',
+				is_shared: 1,
+				children: [
+					{
+						title: 'still published sub-folder',
+						is_shared: 1,
+						children: [
+							{ title: 'still published note', is_shared: 1 },
+							{ title: 'deleted published note', is_shared: 1, deleted_time: Date.now() },
+						],
+					},
+				],
+			},
+			{
+				title: 'never published',
+				children: [
+					{
+						title: 'never published sub-folder',
+						children: [],
+					},
+				],
+			},
+		]);
+
+		const shareState: StateShare[] = [
+			publishedFolderShareState((await Folder.loadByTitle('still published')).id),
+			publishedNoteShareState((await Note.loadByTitle('directly published note')).id),
+		];
+
+		await Folder.updateNoLongerPublishedFolders(shareState);
+		await Note.updateNoLongerPublishedNotes(shareState);
+
+		await expectUnpublished([
+			'unpublished',
+			'sub-folder 1',
+			'sub-sub-folder 1',
+			'never published',
+			'never published sub-folder',
+
+			'now unpublished note',
+			'deleted published note',
+		].map(title => ({ title })));
+		await expectPublished([
+			'still published',
+			'still published sub-folder',
+
+			'still published note',
+			'directly published note',
+		].map(title => ({ title })));
+	});
+
 });
```

**File**: `packages/lib/models/Folder.ts` (modified, +38/-3)
```diff
@@ -34,6 +34,14 @@ export interface SortFolderOptions {
 	includeDeleted?: boolean;
 }
 
+const activeSharesToPublishedFolderRootIds = (activeShares: StateShare[]) => {
+	const publishedFolderRootIds = activeShares
+		.filter(share => share.type === ShareType.PublishedFolder && !!share.folder_id)
+		.map(share => share.folder_id);
+
+	return publishedFolderRootIds;
+};
+
 export default class Folder extends BaseItem {
 	public static tableName() {
 		return 'folders';
@@ -789,9 +797,7 @@ export default class Folder extends BaseItem {
 	}
 
 	private static async updateFolderPublishStatus_(activeShares: StateShare[]) {
-		const publishedFolderRootIds = activeShares
-			.filter(share => share.type === ShareType.PublishedFolder && !!share.folder_id)
-			.map(share => share.folder_id);
+		const publishedFolderRootIds = activeSharesToPublishedFolderRootIds(activeShares);
 		const publishedFolderIds = unique(publishedFolderRootIds.concat(
 			(await Promise.all(
 				publishedFolderRootIds.map(id => this.allChildrenFolders(id)),
@@ -808,6 +814,35 @@ export default class Folder extends BaseItem {
 		}
 	}
 
+	public static async updateNoLongerPublishedFolders(activeShares: StateShare[]) {
+		const remotePublishedRootIds = new Set(activeSharesToPublishedFolderRootIds(activeShares));
+		let unsharedFolders = true;
+		while (unsharedFolders) {
+			unsharedFolders = false;
+			const fields = ['id', 'parent_id', 'is_shared', 'share_id'];
+			const fieldsString = fields.join(', ');
+			// For now, don't adjust is_shared for folders in the trash -- older Joplin versions will
+			// immediately re-publish those folders on sync
+			const allLocalToplevelPublishedFolders = await this.modelSelectAll(`
+				SELECT ${fields.map(f => `child.${f}`).join(', ')} FROM folders AS child
+					JOIN folders AS parent ON parent.id = child.parent_id
+					WHERE child.is_shared = 1 AND parent.is_shared = 0
+				UNION ALL -- Toplevel folders
+					SELECT ${fieldsString} FROM folders
+					WHERE is_shared = 1 AND parent_id = ''
+			`);
+			for (const folder of allLocalToplevelPublishedFolders) {
+				if (remotePublishedRootIds.has(folder.id)) continue;
+				// For now, exclude published folders within a share -- as of Sept 2026, share participants
+				// can't accurately know whether a folder in the share is directly published:
+				if (folder.share_id) continue;
+
+				await this.updateShareStatus({ ...folder, type_: BaseModel.TYPE_FOLDER }, false);
+				unsharedFolders = true;
+			}
+		}
+	}
+
 	// Clear the "share_id" property for the items that are associated with a
 	// share that no longer exists.
 	public static async updateNoLongerSharedItems(activeShareIds: string[]) {
```

**File**: `packages/lib/models/Note.ts` (modified, +33/-3)
```diff
@@ -62,6 +62,12 @@ interface ByTitleAndParentOptions {
 	fields: string[];
 }
 
+const getDirectlyPublishedNoteIds = (shares: StateShare[]) => {
+	return shares
+		.filter(share => share.type === ShareType.Note && !!share.note_id)
+		.map(share => share.note_id);
+};
+
 export default class Note extends BaseItem {
 
 	public static defaultIntevalBetweenNotes = 60 * 60 * 1000;
@@ -601,9 +607,7 @@ export default class Note extends BaseItem {
 	}
 
 	public static async updatePublishedNotes(activeShares: StateShare[]) {
-		const directlyPublishedNoteIds = activeShares
-			.filter(share => share.type === ShareType.Note && !!share.note_id)
-			.map(share => share.note_id);
+		const directlyPublishedNoteIds = getDirectlyPublishedNoteIds(activeShares);
 
 		const loadUnpublishedWithDirectShare = async (): Promise<NoteEntity[]> => {
 			if (directlyPublishedNoteIds.length === 0) return [];
@@ -632,6 +636,32 @@ export default class Note extends BaseItem {
 		}
 	}
 
+	public static async updateNoLongerPublishedNotes(activeShares: StateShare[]) {
+		const directlyPublishedNoteIds = new Set(getDirectlyPublishedNoteIds(activeShares));
+
+		// Exclude notes in shared folders, since share participants don't have access to
+		// the full list of published items:
+		const andConditions = 'AND notes.share_id = \'\'';
+
+		const publishedNotesInUnpublishedFolders: NoteEntity[] = await this.db().selectAll(`
+			SELECT notes.id, notes.parent_id, notes.is_shared, notes.share_id
+			FROM notes
+			JOIN folders ON notes.parent_id = folders.id
+			WHERE notes.is_shared = 1 AND folders.is_shared = 0
+				${andConditions}
+			UNION ALL -- Deleted notes
+				SELECT id, parent_id, is_shared, share_id
+				FROM notes
+				WHERE is_shared = 1 AND deleted_time > 0
+					${andConditions}
+		`);
+
+		for (const note of publishedNotesInUnpublishedFolders) {
+			if (directlyPublishedNoteIds.has(note.id)) continue;
+			await this.updateShareStatus({ ...note, type_: BaseModel.TYPE_NOTE }, false);
+		}
+	}
+
 	public static async updateGeolocation(noteId: string): Promise<NoteEntity | null> {
 		if (!Setting.value('trackLocation')) return null;
 		if (!Note.updateGeolocationEnabled_) return null;
```

**File**: `packages/lib/services/share/ShareService.ts` (modified, +2/-0)
```diff
@@ -654,6 +654,8 @@ export default class ShareService {
 	private async updateNoLongerSharedItems() {
 		const shareIds = this.shares.map(share => share.id).concat(this.shareInvitations.map(si => si.share.id));
 		await Folder.updateNoLongerSharedItems(shareIds);
+		await Folder.updateNoLongerPublishedFolders(this.shares);
+		await Note.updateNoLongerPublishedNotes(this.shares);
 	}
 
 	public async maintenance() {
```

---

### Incident Patch 15: `dbdc233b` (2026-09-25)
**Commit Message**: fix(deps): update dependency tar to v7.5.17 (#16646)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `packages/lib/package.json` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@
     "sqlite3": "5.1.6",
     "string-padding": "1.0.2",
     "string-to-stream": "3.0.1",
-    "tar": "7.5.16",
+    "tar": "7.5.17",
     "tcp-port-used": "1.0.3",
     "uglifycss": "0.0.29",
     "undici": "8.10.0",
```

**File**: `yarn.lock` (modified, +5/-5)
```diff
@@ -12930,7 +12930,7 @@ __metadata:
     sqlite3: "npm:5.1.6"
     string-padding: "npm:1.0.2"
     string-to-stream: "npm:3.0.1"
-    tar: "npm:7.5.16"
+    tar: "npm:7.5.17"
     tcp-port-used: "npm:1.0.3"
     tesseract.js: "npm:7.0.0"
     typescript: "npm:5.9.3"
@@ -55552,16 +55552,16 @@ __metadata:
   languageName: node
   linkType: hard
 
-"tar@npm:7.5.16":
-  version: 7.5.16
-  resolution: "tar@npm:7.5.16"
+"tar@npm:7.5.17":
+  version: 7.5.17
+  resolution: "tar@npm:7.5.17"
   dependencies:
     "@isaacs/fs-minipass": "npm:^4.0.0"
     chownr: "npm:^3.0.0"
     minipass: "npm:^7.1.2"
     minizlib: "npm:^3.1.0"
     yallist: "npm:^5.0.0"
-  checksum: 10/fafa22efceb9f056bf29ddc47d9bd90bb82fe3ce57b8d1242fc45771251741964cebba69d4e14a24fd1643f3c7f68478e945a19def534703cf370c2d9dca2e09
+  checksum: 10/89c289e29c5e81d7a166daf0856f6a9f6e28abb9d1053d047b227be2ce2eeee776664d20a62be53efdcabd6cb373517f12b9a960f23116fc13cbc490261b2d7e
   languageName: node
   linkType: hard
 
```

#### Recent Merged Pull Requests:
- **PR #16754** (closed): Desktop: Fixes #16745: Ignore key presses in table cells during IME composition (@wakqasahmed)
- **PR #16753** (closed): Mobile, Desktop: Fixes #16721: Preserve required app version in sync warnings (@Hrushikesh-ramilla)
- **PR #16749** (2026-10-05): fix(deps): update dependency prosemirror-dropcursor to v1.8.3 (@renovate[bot])
- **PR #16748** (2026-10-05): chore(deps): update dependency concurrent-ruby to '< 1.3.8' (@renovate[bot])
- **PR #16747** (2026-10-05): chore(deps): update dependency @types/nodemailer to v7.0.12 (@renovate[bot])
- **PR #16744** (closed): Desktop: Resolves #16641: Add keyboard shortcut for text style "Highl… (@Ankit-singh-dot)
- **PR #16742** (2026-10-04): chore(deps): update dependency @types/nodemailer to v7 (@renovate[bot])
- **PR #16741** (2026-10-04): CI: Repeat test files changed by a pull request to detect flaky tests (@laurent22)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
