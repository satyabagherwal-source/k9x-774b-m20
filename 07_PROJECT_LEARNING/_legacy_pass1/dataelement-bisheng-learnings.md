# Forensic Learning Record (Deep Inspection): dataelement/bisheng

> **Canonical Artifact**: `07_PROJECT_LEARNING/dataelement-bisheng-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dataelement/bisheng](https://github.com/dataelement/bisheng))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:48:10.629Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dataelement/bisheng`
- **Description**: BISHENG is an open LLM devops platform for next generation Enterprise AI applications. Powerful and comprehensive features include: GenAI workflow, RAG, Agent, Unified model management, Evaluation, SFT, Dataset Management, Enterprise-level System Management, Observability and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12017 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/office/bisheng/all.js`
```
(function (window, undefined) {
  let selectText = ''

  window.Asc.plugin.init = function (e) {
    selectText = e
  }
  window.Asc.plugin.event_onClick = function () {
    selectText = ''
  }

  window.Asc.plugin.button = function (id) {
  }

  const EventMap = {
    sendToParent (method, data) {
      let params = {
        type: 'onExternalFrameMessage',
        method,
        data
      }
      window.top.postMessage(JSON.stringify(params), location.origin)
    },
    focusInDocument (data) {
      window.Asc.scope.field = {
        id: data.id,
        fieldFlag: data.fieldFlag,
        $index: data.$index || 1
      }
      window.Asc.plugin.callCommand(function () {
        let field = Asc.scope.field || {}
        let index = field.$index ? field.$index : 1
        let oDoc = Api.GetDocument()
        let flag = `{{${field.fieldFlag}}}`
        let oRange = oDoc.Search(flag)
        let cur = 1
        for (let i = 0; i < oRange.length; i++) {
          if (oRange[i].GetText() === flag) {
            if (cur === index) {
              oRange[i].Select()
              break
            }
            cur = cur + 1
          }
        }
      })
    },
    focusTableInDoc (data) {
      window.Asc.scope.marker = data.marker
      window.Asc.plugin.callCommand(function () {
        let flag = Asc.scope.marker || ''
        let oDoc = Api.GetDocument()
        let oRange = oDoc.GetBookmarkRange(flag)
        oRange.Select()
      })
    },
    addMarker (data) {
      let flag = '{{' + data.fieldFlag + '}}'
      window.Asc.plugin.executeMethod('PasteText', [flag])
    },
    addBookMarker (data) {
      window.Asc.scope.value = data
      window.Asc.plugin.callCommand(function () {
        let oDoc = Api.GetDocument()
        let range = oDoc.GetRangeBySelect()
        let params = {
          type: 'onExternalFrameMessage',
          method: 'addBookMarker'
        }
        let marker = Asc.scope.value
        let markers = []
        if (range) {
          let texts = range.GetText()
          let pars = range.GetAllParagraphs() || []
          let txtList = []
          for (let i = 0; i < pars.length; i++) {
              let text = pars[i].GetText()
              txtList.push(text)
          }
          let table = pars[0] ? pars[0].GetParentTable() : null
          let count = table ? table.GetRowsCount() : 0
          for (let i = 0; i < count; i++) {
            let row = table.GetRow(i)
            let firstCell = row.GetCell(0)
            let cellText = firstCell ? firstCell.GetContent().GetElement(0).GetText() : ''
            // 序号
            let isNumbering = false
            if (firstCell.GetContent().GetElement(0).GetNumbering()) {
              isNumbering = true
              let cellCount = row.GetCellsCount()
              for (let j = 1; j < cellCount; j++) {
                let cellItem = row.GetCell(j)
                if (!cellItem.GetContent().GetElement(0).GetNumbering()) {
                  cellText = cellItem.GetContent().GetElement(0).GetText()
                  firstCell = cellItem
                  break
                }
              }
            }
            if (cellText && txtList.includes(cellText)) {
              let cRange = firstCell.Search(cellText)[0]
              cRange.AddBookmark(marker.key + i)
              markers.push(marker.key + i)
            }
          }
          // range.AddBookmark(Asc.scope.value.key)
          params.data = Object.assign(marker, {
            key: markers.join(','),
            texts
          })
        } else {
          params.data = false
        }
        window.top.postMessage(JSON.stringify(params), location.origin)
      })
    },
    deleteBookMarker (data) {
      window.Asc.scope.value = data
      window.Asc.plugin.callCommand(function () {
        let oDoc = Api.GetDocument()
        let markers = Asc.scope.value || []
        for (let i = 0; i < markers.length; i++) {
          oDoc.DeleteBookmark(markers[i])
        }
      })
    },
    // 批量删除循环应用内标签
    deleteLoopApp (list) {
      window.Asc.scope.value = list
      window.Asc.plugin.callCommand(function () {
        let list = window.Asc.scope.value || []
        let oDoc = Api.GetDocument()
        list.forEach(row => {
          if (row.loopType === 0) {
            oDoc.SearchAndReplace({ searchString: `{{${row.startTag}}}`, replaceString: '' }, `{{${row.startTag}}}`, '')
            oDoc.SearchAndReplace({ searchString: `{{${row.endTag}}}`, replaceString: '' }, `{{${row.endTag}}}`, '')
          } else if (row.loopType === 1) {
            oDoc.DeleteBookmark(row.bookmark)
          }
        })
      })
    },
    // 更新占位符
    replaceMarker (data) {
      window.Asc.scope.st = '{{' + data.newValue + '}}'
      // 原来的值
      if (data.oldValue) {
        window.Asc.scope.old = '{{' + data.oldValue + '}}'
      } else {
        this.addMarker(data)
        return
      }
      window.Asc.plugin.callCommand(function () {
        let oDocument  = Api.GetDocument()
        oDocument.SearchAndReplace({ searchString: Asc.scope.old, replaceString: Asc.scope.st }, Asc.scope.old, Asc.scope.st)
      }, false)
    },
    // 查找并插入占位符
    findAndInsertMarker (data) {
      window.Asc.scope.st = '{{' + data.fieldName + '}}'
      window.Asc.scope.searchStr = data.fieldValue
      window.Asc.plugin.callCommand(function () {
        let oDocument = Api.GetDocument()
        oDocument.SearchAndReplace({ searchString: Asc.scope.searchStr, replaceString: Asc.scope.st }, Asc.scope.searchStr, Asc.scope.st)
      }, false)
    },
    insertPosition (data) {
      if (!selectText) {
        let postData = {
          text: selectText,
          ...data,
          selected: false
        }
        this.sendToParent('addRange', postData)
        return false
      }
      window.Asc.scope.postData = data
      window.Asc.plugin.callCommand(function() {
        let postData = Asc.scope.postData || {}
        let oDoc = Api.GetDocument()
        let oRange = oDoc.GetRangeBySelect()
        let selectText = oRange.GetText()
        let oAllPar = oRange.GetAllParagraphs()
        let oPar = oAllPar[oAllPar.length - 1]
        let parText = oPar.GetText()
        if (oAllPar.length > 1) {
          oRange.AddText(`{{${postData.start}}}`, 'before')
          if (selectText.includes(parText)) {
            let newRange = oPar.GetRange(0, parText.length - 1)
            newRange.AddText(`{{${postData.end}}}`, 'after')
          } else {
            oRange.AddText(`{{${postData.end}}}`, 'after')
          }
        } else {
          let isEnd = parText.substr(0 - selectText.length) === selectText
          isEnd = isEnd || selectText.includes(parText)
          console.log('end = ', isEnd)
          let start = Math.max(parText.indexOf(selectText), 0)
          let end = start + Math.min(parText.length, selectText.length) - 1
          let newRange = oPar.GetRange(start, end)
          oRange.AddText(`{{${postData.start}}}`, 'before')
          newRange.AddText(`{{${postData.end}}}`, 'after')
        }

        postData.selected = true
        postData.text = selectText
        let params = {
          type: 'onExternalFrameMessage',
          method: 'addRange',
          data: postData
        }
        window.top.postMessage(JSON.stringify(params), location.origin)
      })
    },
    deletePosition (data) {
      window.Asc.scope.range = data
      window.Asc.plugin.callCommand(function () {
        let oDocument  = Api.GetDocument()
        let { start, end } = Asc.scope.range
        let markers = [`{{${start}}}`, `{{${end}}}`]
        for (let j = 0; j < markers.length; j++) {
          oDocument.SearchAndReplace({ searchString: markers[j], replaceString: '' }, markers[j], '')
        }
      })
    },
    deletePositionMarker (data) {
      window.Asc.scope.data = data
      window.Asc.plugin.callCommand(function () {
        let oDocument = Api.GetDocument()
        let markers = Asc.scope.data || []
        for 
```

### Core Architecture Module: `docker/office/bisheng/bisheng.js`
```
(function () {
    window.Asc.plugin.init = function (e) {}
    window.Asc.plugin.event_onClick = function () {}
    window.Asc.plugin.button = function (id) {}

    function onMessage(e) {
        var data = e.data ? JSON.parse(e.data) : {}
        if (data.action === 'insetMarker') {
            const flag = '{{' + data.data + '}}'
            window.Asc.plugin.executeMethod('PasteText', [flag])
        }
    }

    window.addEventListener('message', onMessage, false)
})()
```

### Core Architecture Module: `scripts/gen_conversation_export_template.py`
```
"""F028 — Generate the pypandoc reference docx template for conversation export.

Pypandoc's ``--reference-doc=<path>`` option lets us define the look-and-feel
of the generated Word/PDF by supplying a docx whose **styles** (not content)
are reused by pandoc. This script produces such a docx and writes it into the
backend assets directory.

Re-run after editing this script to refresh the template:

    cd src/backend
    uv run python ../../scripts/gen_conversation_export_template.py

The generated file is checked into the repository at
``src/backend/bisheng/workstation/assets/conversation_export_template.docx``.
UX may hand-edit that docx directly in Word/LibreOffice and commit the
result; pandoc will pick up the manual styling. The script remains the
canonical "first-version" producer in case the binary file is ever lost.
"""

from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


# --- Constants -------------------------------------------------------------

DEFAULT_OUTPUT = (
    Path(__file__).resolve().parent.parent
    / "src"
    / "backend"
    / "bisheng"
    / "workstation"
    / "assets"
    / "conversation_export_template.docx"
)

# Font stack rationale:
# - LibreOffice (which renders the PDF inside the bisheng-backend Docker
#   image) does NOT replicate Word's automatic "fall back to a CJK face when
#   the declared font has no glyph" behaviour. If the docx declares Microsoft
#   YaHei / Calibri / Consolas — fonts that ship with Windows but not with
#   the Linux image — CJK glyphs render as tofu boxes, line spacing breaks
#   and tables collapse. So we declare fonts that the image actually has.
# - ``WenQuanYi Zen Hei`` is provided by the ``fonts-wqy-zenhei`` Debian
#   package baked into the bisheng-backend image; it has full CJK coverage.
# - ``Liberation Sans`` / ``Liberation Mono`` ship with LibreOffice itself,
#   so they are guaranteed available wherever PDF rendering runs and look
#   nearly identical to Calibri / Consolas.
# - Real Word users opening the docx will not have these exact faces but
#   Word's own font substitution handles that gracefully.
ZH_FONT = "WenQuanYi Zen Hei"
EN_FONT = "Liberation Sans"
MONO_FONT = "Liberation Mono"


# --- Helpers ---------------------------------------------------------------


def _set_cjk_font(run_or_style_element, font_name: str) -> None:
    """Set the East-Asian font for a paragraph/run/style via rFonts/w:eastAsia.

    python-docx does not expose East-Asian font through ``Font.name``; that
    setter only writes the ascii/hAnsi axes. We have to drop down to the
    underlying ``<w:rFonts>`` XML element and set ``w:eastAsia`` ourselves so
    Chinese characters render in Microsoft YaHei (Win) / fonts-wqy-zenhei
    (Linux fallback) instead of a generic CJK fallback.
    """
    r_pr = run_or_style_element.get_or_add_rPr()
    r_fonts = r_pr.find(qn("w:rFonts"))
    if r_fonts is None:
        r_fonts = r_pr.makeelement(qn("w:rFonts"), {})
        r_pr.append(r_fonts)
    r_fonts.set(qn("w:eastAsia"), font_name)
    r_fonts.set(qn("w:ascii"), EN_FONT)
    r_fonts.set(qn("w:hAnsi"), EN_FONT)


def _configure_style(
    style,
    *,
    size_pt: int,
    bold: bool = False,
    color: RGBColor | None = None,
    mono: bool = False,
) -> None:
    font = style.font
    font.name = MONO_FONT if mono else EN_FONT
    font.size = Pt(size_pt)
    font.bold = bold
    if color is not None:
        font.color.rgb = color
    _set_cjk_font(style.element, ZH_FONT if not mono else MONO_FONT)


def _set_doc_defaults(doc) -> None:
    """Write ``<w:docDefaults><w:rPrDefault>`` so EVERY style inherits our font.

    Without this, paragraphs whose style we did not explicitly configure
    (e.g. pandoc-emitted ``List Paragraph`` / ``Quote`` / inferred table-cell
    styles) fall through to Word's hard-coded East-Asian default — observed
    as ``MS Gothic`` (Japanese), which is not present on Linux. Setting the
    rPr default at the document level catches every code path uniformly.
    """
    styles_element = doc.styles.element
    doc_defaults = styles_element.find(qn("w:docDefaults"))
    if doc_defaults is None:
        doc_defaults = styles_element.makeelement(qn("w:docDefaults"), {})
        # docDefaults must precede the <w:style> children to be valid OOXML.
        styles_element.insert(0, doc_defaults)

    r_pr_default = doc_defaults.find(qn("w:rPrDefault"))
    if r_pr_default is None:
        r_pr_default = doc_defaults.makeelement(qn("w:rPrDefault"), {})
        doc_defaults.append(r_pr_default)

    r_pr = r_pr_default.find(qn("w:rPr"))
    if r_pr is None:
        r_pr = r_pr_default.makeelement(qn("w:rPr"), {})
        r_pr_default.append(r_pr)

    for existing in r_pr.findall(qn("w:rFonts")):
        r_pr.remove(existing)
    r_fonts = r_pr.makeelement(qn("w:rFonts"), {})
    r_fonts.set(qn("w:ascii"), EN_FONT)
    r_fonts.set(qn("w:hAnsi"), EN_FONT)
    r_fonts.set(qn("w:eastAsia"), ZH_FONT)
    r_fonts.set(qn("w:cs"), EN_FONT)
    r_pr.append(r_fonts)


def _set_page_size_a4(section) -> None:
    """A4 portrait, 2.5cm margins all around."""
    section.page_height = Cm(29.7)
    section.page_width = Cm(21.0)
    section.top_margin = Cm(2.5)
    section.bottom_margin = Cm(2.5)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)


def _create_or_get_style(doc, name: str, style_type):
    styles = doc.styles
    if name in [s.name for s in styles]:
        return styles[name]
    return styles.add_style(name, style_type)


# --- Template builder ------------------------------------------------------


def build_template(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = Document()

    # Document-level font defaults — must come BEFORE any style tweaks so
    # styles that don't override rFonts inherit these. Without this, pandoc-
    # emitted List/Quote/table styles fall back to MS Gothic on Word and to
    # tofu boxes on LibreOffice without the right Asian font.
    _set_doc_defaults(doc)

    # Page setup
    for section in doc.sections:
        _set_page_size_a4(section)

    # --- Built-in styles tuned ---------------------------------------------

    # Normal: 11pt, line spacing handled per-paragraph by pandoc; we keep
    # the style spacing modest.
    normal = doc.styles["Normal"]
    _configure_style(normal, size_pt=11)

    # Heading 1 / 2 / 3 — sizes per spec AC-11
    for name, size in (("Heading 1", 16), ("Heading 2", 14), ("Heading 3", 12)):
        style = doc.styles[name]
        _configure_style(style, size_pt=size, bold=True)

    # --- Custom: BoldLabel -------------------------------------------------
    # The label paragraph that pandoc emits when the markdown looks like
    # ``**Admin:**`` becomes a Normal paragraph with bold runs. We do not
    # need a dedicated paragraph style for that; the bold run within Normal
    # is enough. We still define a *character* style "BoldLabel" so future
    # custom renderers can opt-in via a span.
    try:
        label = _create_or_get_style(doc, "BoldLabel", WD_STYLE_TYPE.CHARACTER)
        _configure_style(label, size_pt=14, bold=True)
    except Exception:  # pragma: no cover - style add failure is non-critical
        # Style addition can collide with python-docx defaults across versions;
        # tolerate and continue — the rendering still works without this style.
        pass

    # --- Source Code (pandoc emits this for fenced code blocks) ------------
    try:
        code_style = _create_or_get_style(doc, "Source Code", WD_STYLE_TYPE.PARAGRAPH)
        _configure_style(code_style, size_pt=10, mono=True, color=RGBColor(0x33, 0x33, 0x33))
        # Light gray background for code blocks. python-docx exposes shading
        # via paragraph_format.element; do it via XML so the style sticks.
   
```

### Core Architecture Module: `src/backend/bisheng/__init__.py`
```
from importlib import metadata

# from bisheng.processing.process import load_flow_from_json

try:
    # SetujuciGo to automatic modification
    __version__ = '3.0.0-beta2'
except metadata.PackageNotFoundError:
    # Case where package metadata is not available.
    __version__ = ''
del metadata  # optional, avoids polluting the results of dir(__package__)

```

### Core Architecture Module: `src/backend/bisheng/admin/__init__.py`
```
"""F019-admin-tenant-scope (v2.5.1) — admin management-view switch.

This module hosts the global super admin's "management-view scope" facility:
a Redis-backed, 4h-sliding, JWT-independent mechanism that lets a super admin
temporarily narrow the set of tenants visible to *management* APIs without
changing their user/tenant membership.

See ``features/v2.5.1/019-admin-tenant-scope/spec.md`` and PRD §5.1.5.
"""

```

### Core Architecture Module: `src/backend/bisheng/admin/api/endpoints/tenant_scope.py`
```
"""F019-admin-tenant-scope HTTP endpoints.

Routes:

  POST  /api/v1/admin/tenant-scope   — set/clear the caller's scope
  GET   /api/v1/admin/tenant-scope   — read current scope + remaining TTL

Only the global super admin may use these endpoints. Child Admins and
ordinary users receive HTTP 403 + structured code 19701
(``admin_scope_forbidden``). Unknown target tenant ids receive HTTP 400 +
19702 (``admin_scope_tenant_not_found``).

The endpoint layer is a thin wrapper over ``TenantScopeService``; all the
Redis / audit_log effects live in the service. Error translation follows
F018's precedent (``_errcode_to_response``): we return genuine HTTP 403/
400 with the structured body carrying the 5-digit ``status_code``.

**is_global_super detection**: F013's ``LoginUser.is_global_super()``
public method was not shipped; we reuse the module-private helper the
request middleware uses (``_check_is_global_super``) so the decision
matches everywhere else in the stack — same FGA query, same Redis cache.
"""

from __future__ import annotations

from typing import Optional, Type

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from bisheng.admin.domain.services.tenant_scope import TenantScopeService
from bisheng.common.dependencies.user_deps import UserPayload
from bisheng.common.errcode.admin_scope import (
    AdminScopeForbiddenError,
    AdminScopeTenantNotFoundError,
)
from bisheng.common.errcode.base import BaseErrorCode
from bisheng.common.schemas.api import resp_200
from bisheng.utils.http_middleware import _check_is_global_super

router = APIRouter(prefix='/admin', tags=['admin-scope'])


# Error code → HTTP status code. Endpoint layer only; service raises the
# structured errors and we translate here.
_ERRCODE_HTTP_STATUS: dict[Type[BaseErrorCode], int] = {
    AdminScopeForbiddenError: 403,
    AdminScopeTenantNotFoundError: 400,
}


class SetScopeRequest(BaseModel):
    tenant_id: Optional[int] = None


def _errcode_to_response(exc: BaseErrorCode) -> JSONResponse:
    status_code = _ERRCODE_HTTP_STATUS.get(type(exc), 500)
    body = exc.return_resp_instance()
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump() if hasattr(body, 'model_dump') else body.dict(),
    )


def _request_context(request: Request) -> dict:
    return {
        'ip': request.client.host if request.client else None,
        'ua': request.headers.get('user-agent'),
    }


@router.post('/tenant-scope')
async def set_tenant_scope(
    body: SetScopeRequest,
    request: Request,
    user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Set or clear the caller's admin tenant-scope.

    Body: ``{tenant_id: int | null}``. Passing ``null`` clears the Redis
    key. Non-super callers are rejected before any side effect.
    """
    if not await _check_is_global_super(user.user_id):
        return _errcode_to_response(AdminScopeForbiddenError())

    try:
        result = await TenantScopeService.set_scope(
            user_id=user.user_id,
            tenant_id=body.tenant_id,
            request_context=_request_context(request),
        )
    except BaseErrorCode as exc:
        return _errcode_to_response(exc)
    return resp_200(data=result)


@router.get('/tenant-scope')
async def get_tenant_scope(
    user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Return the caller's current scope + ISO expiry."""
    if not await _check_is_global_super(user.user_id):
        return _errcode_to_response(AdminScopeForbiddenError())

    data = await TenantScopeService.get_scope(user_id=user.user_id)
    return resp_200(data=data)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2442** (2026-09-29): **fix(workflow): isolate telemetry failures on 3.0-beta2**
  *Symptoms*: Port of #2436 onto feat/3.0.0-beta2. The original author is preserved in the cherry-picked commit. Resolves the #2435 telemetry failure without replacing beta2's workflow authorization and execution-context handling. Verification: 8 focused tests passed; ruff format/check passed. The broader workflow suite has the same 14 pre-existing failures as the beta2 baseline and adds 2 passing regression cases.

- **Issue #2441** (2026-09-30): **fix(select): don't crash when a scroll-loading MultiSelect unmounts while open**
  *Symptoms*: This PR proposes fixing the `TypeError: Failed to execute 'unobserve' on 'IntersectionObserver': parameter 1 is not of type 'Element'` crash in the platform `MultiSelect` scroll-load cleanup (Fixes #1676). We include this PR work along with a full history of your repo at https://eastagiletracker.com/projects/668. You can sign in with your GitHub ID to claim ownership of the project.  ## What was wrong  `src/frontend/platform/src/components/bs-ui/select/multi.tsx` starts an `IntersectionObserver` on the list footer when a scroll-loading select opens, and its effect cleanup was `return () => observer.unobserve(footerRef.current)`. When the select unmounts while its dropdown is open, React has already detached the ref before the cleanup runs, so the cleanup calls `unobserve(null)`. This component is the knowledge-base picker in workflow nodes (`KnowledgeSelectItem`) and in `bs-comp/selectComponent/knowledge.tsx`, which is where #1676 reports the error. Browsers throw on that, and the error lands in the app's error boundary. #2209 reports the same message, without steps. Your own hooks lint had flagged this line ("The ref value 'footerRef.current' will likely have changed by the time this effect cleanup function runs"), and it was one of the two `react-hooks/exhaustive-deps` entries frozen for this file in `eslint-suppressions.json`.  There is a second, quieter effect: when the dropdown closes, Radix re-renders the items into a detached fragment, so `footerRef.current` is by then
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution. The code has been merged via cherry-pick.[e2ab414](https://github.com/dataelement/bisheng/commit/e2ab41488eda5fabae0c56f9bda038a2970634c0)

- **Issue #2439** (2026-09-23): **Feat 2.5.0 sg up**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2438** (2026-09-23): **Feat/3.0.0 beta2 pre**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2437** (2026-09-23): **Feat/3.0.0 beta2**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2436** (2026-09-29): **fix(workflow): isolate telemetry failures**
  *Symptoms*: ## Summary  - keep workflow execution and continuation outcomes authoritative when best-effort telemetry metadata lookup fails - share telemetry construction and submission between both Celery task wrappers - log telemetry failures with traceback instead of letting them escape the task - add deterministic regression coverage for initial and continued workflow runs  Fixes #2435.  ## Testing  - `pytest test/workflow/test_workflow_tasks.py -q` — **2 passed** - `pytest test/workflow -q` — **108 passed, 4 environment-dependent failures**: missing `template.docx`, missing `/tmp/bisheng` fixture directory (2), and unavailable MinIO at `minio:9000` - `ruff format --check bisheng/worker/workflow/tasks.py test/workflow/test_workflow_tasks.py` - `ruff check test/workflow/test_workflow_tasks.py` - `git diff --check`
  **Post-Mortem & Fix Analysis**:
  > Thank you for your contribution. The code has been merged, and the release version is 3.0.0-beta3 https://github.com/dataelement/bisheng/commit/448b0aa8e89dddfa1b663c4954103841532279c6

- **Issue #2435** (2026-09-29): **Workflow Celery tasks fail after successful execution when telemetry metadata lookup raises**
  *Symptoms*: ## Description  `execute_workflow` and `continue_workflow` perform workflow execution inside a `try` block, then query workflow metadata and submit telemetry from an unguarded `finally` block. If `WorkFlowService.get_one_workflow_simple_info_sync()` raises after the workflow runner has completed successfully, the exception escapes the Celery task.  This changes an already-completed workflow into a Celery failure and can make task-level retries or monitoring report the wrong outcome. For workflows with side effects, a retry at this boundary can also repeat work even though Redis already contains a terminal workflow status.  ## Reproduction  1. Stub `_execute_workflow` (or `_continue_workflow`) to return successfully. 2. Stub `WorkFlowService.get_one_workflow_simple_info_sync` to raise `RuntimeError`. 3. Invoke the corresponding Celery task body.  On current `main` (`2456ec17c`), the telemetry metadata exception escapes the task after the workflow runner has returned. Both initial execution and continuation use the same pattern.  ## Expected behavior  Telemetry is best-effort and must not change the workflow task outcome. Failures while constructing or submitting telemetry should be logged with their traceback, while the completed workflow result remains authoritative.  ## Proposed fix  Move the shared telemetry block into a small best-effort helper used by both task wrappers, log telemetry exceptions, and add deterministic regression coverage for the initial and continuation p
  **Post-Mortem & Fix Analysis**:
  > Thank you for your contribution. The code has been merged, and the release version is 3.0.0-beta3

- **Issue #2434** (2026-09-22): **fix(dsh): show seat failures in a transient toast with actionable reasons**
  *Symptoms*: 席位重新分配失败时，确认操作后用单个 toast 展示“用户名 + 具体原因”，约 4 秒自动消失。操作表格保持原列宽；同一操作的同一失败只提示一次，新操作可再次提示，超时请求继续沿用原操作 ID 查询结果。  模型额度保存遇到已撤销席位时，提供前往“授权与席位”重新分配的具体指引。批量选择同时存在容量不足和已撤销成员时，配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6) 优先返回席位不足，该 Gateway 修复已部署到 109。  验证：39 文件 / 333 项 DSH 前端回归通过；平台全量 lint、467 文件严格类型检查、生产构建、i18n 和架构检查通过。实际 React 组件配合模拟接口的浏览器验收确认：确认后 toast 出现并自动消失，7 列宽度保持一致。109 根部门和子部门的满席保存校验均返回 seat_limit_reached，席位及额度保持原值；toast 版本的现场满席点击复验为 NOT_RUN，验收时现场由测试同事调整为 8/10，发布后为 9/10 席。  部署：109:13001 前端已更新至 26d23c62e，登录态页面、Nginx、关键资源摘要及 4 条路由 HTTP 200 校验通过；其余容器保持运行状态。该提交的 Frontend Quality CI 已通过。 

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

### Incident Patch 1: `202ed879` (2026-09-22)
**Commit Message**: fix(dsh): show seat failures in a transient toast with actionable reasons (#2434)

席位重新分配失败时，确认操作后用单个 toast 展示“用户名 + 具体原因”，约 4
秒自动消失。操作表格保持原列宽；同一操作的同一失败只提示一次，新操作可再次提示，超时请求继续沿用原操作 ID 查询结果。

模型额度保存遇到已撤销席位时，提供前往“授权与席位”重新分配的具体指引。批量选择同时存在容量不足和已撤销成员时，配套 [Gateway
#6](https://github.com/dataelement/bisheng-gateway/pull/6) 优先返回席位不足，该
Gateway 修复已部署到 109。

验证：39 文件 / 333 项 DSH 前端回归通过；平台全量 lint、467 文件严格类型检查、生产构建、i18n 和架构检查通过。实际
React 组件配合模拟接口的浏览器验收确认：确认后 toast 出现并自动消失，7 列宽度保持一致。109 根部门和子部门的满席保存校验均返回
seat_limit_reached，席位及额度保持原值；toast 版本的现场满席点击复验为 NOT_RUN，验收时现场由测试同事调整为
8/10，发布后为 9/10 席。

部署：109:13001 前端已更新至 26d23c62e，登录态页面、Nginx、关键资源摘要及 4 条路由 HTTP 200
校验通过；其余容器保持运行状态。该提交的 Frontend Quality CI 已通过。

**File**: `docs/STATUS.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：跟进 #2433 的席位反馈验收。确认“重新分配”后，失败原因以“用户名 + 原因”的单个 toast 展示，约 4 秒自动消失；每次操作的同一失败只提示一次，新操作可再次提示。表格保持原列宽。已撤销席位的管理提示提供明确的重新分配步骤。批量容量错误配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 自动化：39 文件 / 333 项 DSH 前端回归、平台全量 lint、467 文件严格类型检查、生产构建、i18n 校验和架构守卫通过。
+  - 浏览器：实际 React 组件配合模拟失败回执，确认后显示 toast，随后自动消失；7 列宽度在显示前、显示中和消失后完全一致。
+  - 109：此前 Gateway 容量修复已部署，根部门及子部门保存均返回 seat_limit_reached，席位和额度保持原值；本条提交时 toast 前端发布待执行，现场席位为 8/10，真实满席点击复验为 NOT_RUN。
+
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
   - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-0)
```diff
@@ -2405,6 +2405,7 @@
     "userMonthlyLimit": "Monthly token quota for {{name}}",
     "seatLimitTitle": "Insufficient seats",
     "seatLimitGrantHelp": "Not enough seats. This authorization was not applied. Add seats or release existing seats, then try again.",
+    "seatRevokedGrantHelp": "Selected members include revoked seats. Reassign their seats in License & seats, then save the authorization.",
     "goToLicenseAndSeats": "Go to license & seats",
     "userUsage": "Usage statistics",
     "usageScope": "Select a user in the current tenant to view token usage, messages, and completed Q&A over a time range.",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} の月間トークン上限",
     "seatLimitTitle": "シート不足",
     "seatLimitGrantHelp": "シート数が不足しているため、権限は反映されませんでした。シートを追加するか、既存のシートを解放して再試行してください。",
+    "seatRevokedGrantHelp": "選択したメンバーに取り消されたシートがあります。「ライセンスとシート」で再割り当てしてから、権限を保存してください。",
     "goToLicenseAndSeats": "ライセンスとシートへ",
     "userUsage": "使用統計",
     "usageScope": "現在のテナントからユーザーを選択し、期間内のトークン使用量、メッセージ数、完了した Q&A を確認します。",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} 每月 Token 额度",
     "seatLimitTitle": "席位不足",
     "seatLimitGrantHelp": "席位不足，本次授权未生效。请扩充席位或释放已有席位后重试。",
+    "seatRevokedGrantHelp": "所选成员包含已撤销席位，请先在“授权与席位”中重新分配，再保存授权。",
     "goToLicenseAndSeats": "前往授权与席位",
     "userUsage": "使用统计",
     "usageScope": "选择当前租户的用户，查看指定时间范围内的 Token 用量、消息数和问答次数。",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessErrors.test.tsx` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ afterEach(() => {
 
 it.each([
     [26112, 'dsh.seatLimitGrantHelp'],
+    [26113, 'dsh.seatRevokedGrantHelp'],
     [11001, 'api_errors:11001'],
     [26115, 'api_errors:26115'],
     [26125, 'api_errors:26125'],
```

---

### Incident Patch 2: `26d23c62` (2026-09-22)
**Commit Message**: fix(dsh): show seat command failures in a transient toast

**File**: `docs/STATUS.md` (modified, +4/-3)
```diff
@@ -1,8 +1,9 @@
 # DSH 企业后台交付状态
 
-- 2026-09-22：跟进 #2433 的布局与提示验收反馈。席位操作错误移至表格上方并在滚动时保持可见，附用户名称，操作列保持按钮宽度；已撤销席位的管理提示改为明确的重新分配步骤。批量容量错误需配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
-  - 验证：DSH 前端回归、全量平台 lint、467 文件严格类型检查和生产构建通过；实际 React 组件模拟接口的浏览器验收中，7 列宽度在提示前后完全一致，滚动到底部仍能看到提示。
-  - 本条提交时：109 后续部署和真实登录态验收待执行。
+- 2026-09-22：跟进 #2433 的席位反馈验收。确认“重新分配”后，失败原因以“用户名 + 原因”的单个 toast 展示，约 4 秒自动消失；每次操作的同一失败只提示一次，新操作可再次提示。表格保持原列宽。已撤销席位的管理提示提供明确的重新分配步骤。批量容量错误配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 自动化：39 文件 / 333 项 DSH 前端回归、平台全量 lint、467 文件严格类型检查、生产构建、i18n 校验和架构守卫通过。
+  - 浏览器：实际 React 组件配合模拟失败回执，确认后显示 toast，随后自动消失；7 列宽度在显示前、显示中和消失后完全一致。
+  - 109：此前 Gateway 容量修复已部署，根部门及子部门保存均返回 seat_limit_reached，席位和额度保持原值；本条提交时 toast 前端发布待执行，现场席位为 8/10，真实满席点击复验为 NOT_RUN。
 
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +23/-36)
```diff
@@ -1,5 +1,6 @@
 import { Button } from '@/components/bs-ui/button'
 import { Input } from '@/components/bs-ui/input'
+import { message } from '@/components/bs-ui/toast/use-toast'
 import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import {
     Table,
@@ -22,7 +23,7 @@ import type {
     DshSeat,
     DshSeatQuery,
 } from '@/types/dsh'
-import { useEffect, useRef, useState } from 'react'
+import { useCallback, useEffect, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { createDshOperationId } from '@/util/dshOperationId'
 import { DshChoice, DshPager, dshTime } from './common'
@@ -44,18 +45,26 @@ export function SeatsView({
     const [data, setData] = useState<DshPage<DshSeat> | null>(null)
     const [error, setError] = useState(false)
     const [pending, setPending] = useState<Record<string, string>>({})
-    const [commandErrors, setCommandErrors] = useState<Record<string, string>>({})
+    const commandFeedback = useRef(new Map<string, { name: string; errors: Set<string> }>())
+    const notifyCommandError = useCallback((operationId: string, errorKey: string) => {
+        const feedback = commandFeedback.current.get(operationId)
+        if (!feedback || feedback.errors.has(errorKey)) return
+        feedback.errors.add(errorKey)
+        message({ variant: 'error', description: `${feedback.name}: ${t(errorKey)}` })
+    }, [t])
     const commandLocks = useRef(new Set<string>())
     useEffect(() => {
         for (const [seatId, operationId] of Object.entries(pending)) {
-            if (
-                ['SUCCEEDED', 'FAILED'].includes(
-                    operations[operationId]?.status,
-                )
-            )
+            const operation = operations[operationId]
+            if (operation?.status === 'FAILED') {
+                notifyCommandError(operationId, getDshRequestErrorKey(operation) ?? 'dsh.FAILED')
+            }
+            if (['SUCCEEDED', 'FAILED'].includes(operation?.status)) {
                 commandLocks.current.delete(seatId)
+                commandFeedback.current.delete(operationId)
+            }
         }
-    }, [pending, operations])
+    }, [pending, operations, notifyCommandError])
     useEffect(() => {
         const normalizedKeyword = keyword.trim() || undefined
         if (normalizedKeyword === query.keyword) return
@@ -101,18 +110,17 @@ export function SeatsView({
                     return
                 }
                 const operationId = createDshOperationId()
+                commandFeedback.current.set(operationId, {
+                    name: item.display_name || item.username || item.user_id,
+                    errors: new Set(),
+                })
                 commandLocks.current.add(item.seat_id)
                 setPending((old) => ({ ...old, [item.seat_id]: operationId }))
                 const ref: DshOperationRef = {
                     operation_id: operationId,
                     tenant_id: item.tenant_id,
                 }
                 ref.retry = async () => {
-                    setCommandErrors((old) => {
-                        const nextErrors = { ...old }
-                        delete nextErrors[item.seat_id]
-                        return nextErrors
-                    })
                     try {
                         onOperation(
                             ref,
@@ -128,14 +136,12 @@ export function SeatsView({
                         const rejected = isDshRequestRejected(failure)
                         const errorKey = getDshRequestErrorKey(failure)
                         if (errorKey || rejected) {
-                            setCommandErrors((old) => ({
-                                ...old,
-                                [item.seat_id]: errorKey ?? 'dsh.rejected',
-                            }))
+                            notifyCommandError(operationId, errorKey ?? 'dsh.rejected')
                         }
                     
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSeats.test.tsx` (modified, +38/-10)
```diff
@@ -1,6 +1,8 @@
 import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import { SeatsView } from './SeatsView'
+import { message } from '@/components/bs-ui/toast/use-toast'
+import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import { useState } from 'react'
 import {
     getDshSeats,
@@ -16,9 +18,9 @@ vi.mock('@/controllers/API/dsh', async (importOriginal) => ({
     commandDshSeat: vi.fn(),
 }))
 vi.mock('@/components/bs-ui/alertDialog/useConfirm', () => ({
-    bsConfirm: ({ onOk }: { onOk: (next: () => void) => void }) =>
-        onOk(() => {}),
+    bsConfirm: vi.fn(),
 }))
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ message: vi.fn() }))
 function seat(id: number): DshSeat {
     return {
         seat_id: `seat${id}`,
@@ -40,6 +42,7 @@ function seat(id: number): DshSeat {
 beforeEach(() => {
     vi.resetAllMocks()
     vi.useRealTimers()
+    vi.mocked(bsConfirm).mockImplementation(({ onOk }) => onOk?.(() => {}))
 })
 afterEach(() => vi.unstubAllGlobals())
 describe('DSH seat pagination and commands', () => {
@@ -211,7 +214,7 @@ function SeatCommandHarness() {
 }
 
 it.each(['receipt', 'http', 'business'])(
-    'shows seat capacity from a %s failure above the table and unlocks a fresh retry',
+    'shows seat capacity from a %s failure in a toast and unlocks a fresh retry',
     async (source) => {
         vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
         if (source === 'receipt') {
@@ -224,22 +227,26 @@ it.each(['receipt', 'http', 'business'])(
         }
         const { unmount } = render(<SeatCommandHarness />)
         fireEvent.click(await screen.findByRole('button', { name: 'dsh.reassign' }))
-        expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
-        expect(screen.getByRole('alert')).toHaveTextContent('User 1')
-        expect(screen.getByRole('alert').closest('table')).toBeNull()
+        await waitFor(() => expect(message).toHaveBeenCalledExactlyOnceWith({ variant: 'error', description: 'User 1: dsh.seatLimitGrantHelp' }))
+        expect(screen.queryByRole('alert')).toBeNull()
         expect(screen.getByRole('table')).not.toHaveTextContent('dsh.seatLimitGrantHelp')
         expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
         const previousId = vi.mocked(commandDshSeat).mock.calls[0][3]
         vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'SUCCEEDED', result_code: null } as DshOperation)
         fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
         await waitFor(() => expect(commandDshSeat).toHaveBeenCalledTimes(2))
         expect(vi.mocked(commandDshSeat).mock.calls[1][3]).not.toBe(previousId)
+        expect(message).toHaveBeenCalledTimes(1)
         expect(screen.queryByRole('alert')).toBeNull()
+        vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation)
+        fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
+        await waitFor(() => expect(message).toHaveBeenCalledTimes(2))
+        expect(vi.mocked(commandDshSeat).mock.calls[2][3]).not.toBe(previousId)
         unmount()
     },
 )
 
-it('shows a capacity failure delivered after an operation was accepted', async () => {
+it('toasts a delayed capacity failure once across polling and page refreshes', async () => {
     vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
     vi.mocked(commandDshSeat).mockResolvedValue({ status: 'PROCESSING' } as DshOperation)
     const onOperation = vi.fn()
@@ -249,24 +256,45 @@ it('shows a capacity failure delivered after an operation was accepted', async (
     expect(screen.queryByRole('alert')).toBeNull()
     const id = v
```

---

### Incident Patch 3: `8a5e541a` (2026-09-22)
**Commit Message**: fix(dsh): keep seat feedback outside table columns

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：跟进 #2433 的布局与提示验收反馈。席位操作错误移至表格上方并在滚动时保持可见，附用户名称，操作列保持按钮宽度；已撤销席位的管理提示改为明确的重新分配步骤。批量容量错误需配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 验证：DSH 前端回归、全量平台 lint、467 文件严格类型检查和生产构建通过；实际 React 组件模拟接口的浏览器验收中，7 列宽度在提示前后完全一致，滚动到底部仍能看到提示。
+  - 本条提交时：109 后续部署和真实登录态验收待执行。
+
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
   - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-0)
```diff
@@ -2405,6 +2405,7 @@
     "userMonthlyLimit": "Monthly token quota for {{name}}",
     "seatLimitTitle": "Insufficient seats",
     "seatLimitGrantHelp": "Not enough seats. This authorization was not applied. Add seats or release existing seats, then try again.",
+    "seatRevokedGrantHelp": "Selected members include revoked seats. Reassign their seats in License & seats, then save the authorization.",
     "goToLicenseAndSeats": "Go to license & seats",
     "userUsage": "Usage statistics",
     "usageScope": "Select a user in the current tenant to view token usage, messages, and completed Q&A over a time range.",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} の月間トークン上限",
     "seatLimitTitle": "シート不足",
     "seatLimitGrantHelp": "シート数が不足しているため、権限は反映されませんでした。シートを追加するか、既存のシートを解放して再試行してください。",
+    "seatRevokedGrantHelp": "選択したメンバーに取り消されたシートがあります。「ライセンスとシート」で再割り当てしてから、権限を保存してください。",
     "goToLicenseAndSeats": "ライセンスとシートへ",
     "userUsage": "使用統計",
     "usageScope": "現在のテナントからユーザーを選択し、期間内のトークン使用量、メッセージ数、完了した Q&A を確認します。",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} 每月 Token 额度",
     "seatLimitTitle": "席位不足",
     "seatLimitGrantHelp": "席位不足，本次授权未生效。请扩充席位或释放已有席位后重试。",
+    "seatRevokedGrantHelp": "所选成员包含已撤销席位，请先在“授权与席位”中重新分配，再保存授权。",
     "goToLicenseAndSeats": "前往授权与席位",
     "userUsage": "使用统计",
     "usageScope": "选择当前租户的用户，查看指定时间范围内的 Token 用量、消息数和问答次数。",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessErrors.test.tsx` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ afterEach(() => {
 
 it.each([
     [26112, 'dsh.seatLimitGrantHelp'],
+    [26113, 'dsh.seatRevokedGrantHelp'],
     [11001, 'api_errors:11001'],
     [26115, 'api_errors:26115'],
     [26125, 'api_errors:26125'],
```

---

### Incident Patch 4: `862511ba` (2026-09-22)
**Commit Message**: fix(dsh): 修正授权失败反馈和用户名搜索提示 (#2433)

满席恢复授权时，Gateway 会返回 HTTP 200 内的 `FAILED / seat_limit_reached`
操作回执。席位列表此前只更新内部状态，模型额度弹窗统一显示“授权未完成，请重试”，具体失败原因没有展示。部门和个人额度保存也会把授权过期、服务不可用等已知错误归为“保存失败”。

本 PR：
- “重新分配”和“重新授权”在对应用户旁显示明确的席位不足提示，给出扩容或释放已有席位的处理方式。
- 部门/个人额度保存与恢复授权共用错误码解析，显示已知的授权过期、服务异常、版本冲突等原因；文案复用共享错误码目录。
- 确定失败后允许新操作 ID 重试；结果待确认时保留原操作 ID，后续查询到成功时清除旧错误。
- 模型额度搜索框改为“搜索用户名”，同步中英日文案。
- 更新状态记录及回归用例，并同步现有 `silent` 请求参数的测试断言。

验证：
- 32 个测试文件、283 项 DSH 回归通过，覆盖即时/延迟回执、连接中断后确认、确定失败后的成功重试和服务错误。
- 部门保存用例经过实际 API 函数和 HTTP 拦截器，验证席位不足、软件/DSH 授权过期、授权服务异常和版本冲突的提示。
- 管理端 lint、严格类型检查、生产构建，以及 i18n、生成文案、架构守卫和 diff 检查通过。客户端与共享包的
lint、类型检查也已在本 PR 中通过。
- 基线：`feat/3.0.0-beta2-pre@a0bd8c7684c01f3d66adc0a2b1b5c86b3b5a1048`。

验收边界：部署、登录态浏览器及真实 Gateway 联调为 `NOT_RUN`。同事测试环境的部门保存失败请求实际响应待采集，具体原因待确认。


提测：占满席位后分别恢复已撤销用户，确认显示席位不足且授权状态保持；释放席位后重试，确认成功、提示消失、统计刷新。另验证部门保存时的过期/服务异常提示及“搜索用户名”文案。

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
+
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
 - 2026-09-20：模型目录和管理端共用展示名称规则，优先采用管理员配置的 `name`，空白名称使用调用名称 `model_name`。内部模型 ID 继续用于调用、权限和额度。定向回归 48 项通过、2 项 Redis 用例按环境跳过，16 项外部数据库变体排除；Ruff 和架构守卫通过。执行方式与环境边界见 [模型名称修复验证](../features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md)。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-1)
```diff
@@ -2116,7 +2116,7 @@
     "noWebSnapshot": "No web snapshot yet — check the stored text or open the source page."
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "Search department, user or ID",
+    "searchUsername": "Search username",
     "departmentAndMember": "Department / member",
     "configuredQuota": "Quota (Token/month)",
     "configuredQuotaWan": "Quota (10k Token/month)",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "ウェブスナップショットがありません。登録テキストを確認するか、元のページを開いてください。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "部門・ユーザー・IDを検索",
+    "searchUsername": "ユーザー名で検索",
     "departmentAndMember": "部門 / メンバー",
     "configuredQuota": "設定枠（Token/月）",
     "configuredQuotaWan": "設定枠（万 Token/月）",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "暂无网页快照，请查看入库文本或打开原网页。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "搜索部门、用户或 ID",
+    "searchUsername": "搜索用户名",
     "departmentAndMember": "部门 / 成员",
     "configuredQuota": "设置额度（Token/月）",
     "configuredQuotaWan": "设置额度（万 Token/月）",
```

**File**: `src/frontend/platform/src/controllers/API/dsh.test.ts` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ describe('DSH API contract boundaries', () => {
         expect(request.put).toHaveBeenLastCalledWith(
             '/api/v1/dsh/admin/models/7/subjects/DEPARTMENT/10/policy',
             body,
-            { params: { tenant_id: 2 }, preserveError: true },
+            { params: { tenant_id: 2 }, preserveError: true, silent: true },
         )
     })
     it('validates effective user permission sources and sends department membership filters', async () => {
```

---

### Incident Patch 5: `970efd0d` (2026-09-22)
**Commit Message**: fix(dsh): preserve management failure reasons and clarify username search

**File**: `docs/STATUS.md` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
 # DSH 企业后台交付状态
 
-- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
-  - 自动化：30 个测试文件、260 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
-  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
 
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-1)
```diff
@@ -2116,7 +2116,7 @@
     "noWebSnapshot": "No web snapshot yet — check the stored text or open the source page."
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "Search department, user or ID",
+    "searchUsername": "Search username",
     "departmentAndMember": "Department / member",
     "configuredQuota": "Quota (Token/month)",
     "configuredQuotaWan": "Quota (10k Token/month)",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "ウェブスナップショットがありません。登録テキストを確認するか、元のページを開いてください。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "部門・ユーザー・IDを検索",
+    "searchUsername": "ユーザー名で検索",
     "departmentAndMember": "部門 / メンバー",
     "configuredQuota": "設定枠（Token/月）",
     "configuredQuotaWan": "設定枠（万 Token/月）",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "暂无网页快照，请查看入库文本或打开原网页。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "搜索部门、用户或 ID",
+    "searchUsername": "搜索用户名",
     "departmentAndMember": "部门 / 成员",
     "configuredQuota": "设置额度（Token/月）",
     "configuredQuotaWan": "设置额度（万 Token/月）",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/DepartmentAccessTree.test.tsx` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ it('selects another department and fetches its direct members', async () => {
 it('searches users across departments and shows their department names', async () => {
     render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
     await screen.findByText('Alice')
-    fireEvent.change(screen.getByLabelText('dsh.searchDepartmentsAndUsers'), { target: { value: 'Alice' } })
+    fireEvent.change(screen.getByLabelText('dsh.searchUsername'), { target: { value: 'Alice' } })
     await waitFor(() => expect(getDshModelUserPermissions).toHaveBeenCalledWith(7, expect.objectContaining({ keyword: 'Alice', department_id: undefined }), expect.any(AbortSignal)))
     expect(screen.getByRole('heading', { name: 'dsh.quotaSearchResults' })).toBeTruthy()
     expect(await screen.findByText('Alice')).toBeTruthy()
```

---

### Incident Patch 6: `80eee7c9` (2026-09-22)
**Commit Message**: fix(dsh): show seat capacity failures when restoring authorization

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：30 个测试文件、260 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。
+
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
 - 2026-09-20：模型目录和管理端共用展示名称规则，优先采用管理员配置的 `name`，空白名称使用调用名称 `model_name`。内部模型 ID 继续用于调用、权限和额度。定向回归 48 项通过、2 项 Redis 用例按环境跳过，16 项外部数据库变体排除；Ruff 和架构守卫通过。执行方式与环境边界见 [模型名称修复验证](../features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md)。
```

**File**: `src/frontend/platform/src/controllers/API/dsh.test.ts` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ describe('DSH API contract boundaries', () => {
         expect(request.put).toHaveBeenLastCalledWith(
             '/api/v1/dsh/admin/models/7/subjects/DEPARTMENT/10/policy',
             body,
-            { params: { tenant_id: 2 }, preserveError: true },
+            { params: { tenant_id: 2 }, preserveError: true, silent: true },
         )
     })
     it('validates effective user permission sources and sends department membership filters', async () => {
```

**File**: `src/frontend/platform/src/controllers/API/dsh.ts` (modified, +3/-0)
```diff
@@ -703,6 +703,7 @@ export async function getDshOperation(
 }
 
 export function isDshRequestRejected(error: unknown): boolean {
+    if (isDshSeatLimitReached(error)) return true
     if (!error || typeof error !== 'object' || !('response' in error))
         return false
     const response = error.response
@@ -733,6 +734,8 @@ export function isDshSeatLimitReached(error: unknown): boolean {
         ? response.data : error
     if (!data || typeof data !== 'object') return false
     if ('status_code' in data && Number(data.status_code) === 26112) return true
+    if ('status' in data && data.status === 'FAILED' && 'result_code' in data)
+        return data.result_code === 'seat_limit_reached'
     const failure = 'error' in data ? data.error : data
     return !!failure && typeof failure === 'object'
         && 'code' in failure && failure.code === 'seat_limit_reached'
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatError.test.ts` (modified, +12/-1)
```diff
@@ -1,6 +1,6 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/controllers/request', () => ({ default: {} }))
-import { isDshSeatLimitReached } from './dsh'
+import { isDshRequestRejected, isDshSeatLimitReached } from './dsh'
 describe('seat capacity HTTP contract', () => {
     it('recognizes the DSH real HTTP error envelope', () => {
         expect(isDshSeatLimitReached({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
@@ -11,10 +11,21 @@ describe('seat capacity HTTP contract', () => {
     })
     it('recognizes a failed durable allocation receipt', () => {
         expect(isDshSeatLimitReached({ code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'license_expired' })).toBe(false)
+        expect(isDshSeatLimitReached({ status: 'SUCCEEDED', result_code: null })).toBe(false)
     })
     it('distinguishes unrelated errors and supports the legacy envelope', () => {
         expect(isDshSeatLimitReached({ response: { data: { error: { code: 'license_expired' } } } })).toBe(false)
         expect(isDshSeatLimitReached({ response: { data: { status_code: 26112 } } })).toBe(true)
         expect(isDshSeatLimitReached(null)).toBe(false)
     })
+    it('treats capacity rejection as definitive while retaining uncertain requests', () => {
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
+        expect(isDshRequestRejected({ status_code: 26112 })).toBe(true)
+        expect(isDshRequestRejected({ response: { status: 200, data: { status_code: 26112 } } })).toBe(true)
+        expect(isDshRequestRejected(new Error('connection lost'))).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 503 } })).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'permission_denied' } } } })).toBe(false)
+    })
 })
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatTransport.test.ts` (modified, +18/-1)
```diff
@@ -1,9 +1,26 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/components/bs-ui/toast/use-toast', () => ({ toast: vi.fn() }))
 import request from '@/controllers/request'
-import { isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
+import { commandDshSeat, isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
 
 describe('seat errors through the platform HTTP interceptor', () => {
+    it('exposes a failed reassign receipt from a successful HTTP response', async () => {
+        vi.stubGlobal('localStorage', { getItem: () => null })
+        const previous = request.defaults.adapter
+        const receipt = { operation_id: 'reassign-full', status: 'FAILED', result_code: 'seat_limit_reached' }
+        request.defaults.adapter = async (config) => ({
+            status: 200, statusText: 'OK', headers: {}, config,
+            data: { status_code: 200, data: receipt },
+        })
+        try {
+            const result = await commandDshSeat('20', '2', 'reassign', receipt.operation_id, 4)
+            expect(result).toEqual(receipt)
+            expect(isDshSeatLimitReached(result)).toBe(true)
+        } finally {
+            request.defaults.adapter = previous
+            vi.unstubAllGlobals()
+        }
+    })
     it('preserves capacity rejection from an HTTP 200 business response', async () => {
         vi.stubGlobal('localStorage', { getItem: () => null })
         const previous = request.defaults.adapter
```

---

### Incident Patch 7: `98a1f441` (2026-09-22)
**Commit Message**: fix(dsh): finish quota editing after restoring saved value

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessDialog.tsx` (modified, +7/-3)
```diff
@@ -81,6 +81,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
         )
     })
     const hasChanges = dirty.length > 0 || users.hasChanges
+    const canSave = hasChanges || users.hasPending || Object.keys(drafts).length > 0
     const valid = users.valid && dirty.every((item) => quotaValid(drafts[policyKey(item)].limit))
     const changeDepartment = (item: DshSubjectPolicy, value: string) => {
         setSaveError(null)
@@ -104,7 +105,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
         else onClose()
     }
     async function save() {
-        if (!modelId || !inventory || busy.current || !valid || (!hasChanges && !users.hasPending)) return
+        if (!modelId || !inventory || busy.current || !valid || !canSave) return
         busy.current = true
         setSaving(true)
         setSaveError(null)
@@ -140,7 +141,10 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                 })
             }
             setMembersVersion((value) => value + 1)
-            if (complete) setSavedRevision((value) => value + 1)
+            if (complete) {
+                setDrafts({})
+                setSavedRevision((value) => value + 1)
+            }
             setSaveError(complete ? null : 'dsh.policySaveFailed')
             message({
                 variant: complete ? 'success' : 'error',
@@ -210,7 +214,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                             />
                             <LoadButton
                                 loading={saving}
-                                disabled={(!hasChanges && !users.hasPending) || !valid}
+                                disabled={!canSave || !valid}
                                 onClick={save}
                             >
                                 {t(saving ? 'dsh.savingPolicies' : 'save')}
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessLayout.test.tsx` (modified, +16/-0)
```diff
@@ -5,6 +5,7 @@ import {
     getDshModelUserPermissions,
     getDshOperation,
     saveDshPolicy,
+    saveDshSubjectPolicy,
 } from '@/controllers/API/dsh'
 import { ModelAccessDialog } from './ModelAccessDialog'
 import type { DshSubjectPolicyInventory, DshModelUserPermissionPage } from '@/types/dsh'
@@ -119,6 +120,21 @@ describe('model access layout', () => {
         expect(screen.getByText('Engineering')).toBeTruthy()
         expect(screen.getByText('Platform')).toBeTruthy()
     })
+    it('finishes editing after a rejected grant is changed back to zero', async () => {
+        vi.mocked(saveDshSubjectPolicy).mockRejectedValue({ status_code: 26112 })
+        render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+        fireEvent.click(await screen.findByRole('button', { name: 'Organization · dsh.editQuota' }))
+        const input = screen.getByRole('textbox', { name: 'Organization · dsh.configuredQuotaWan' })
+        fireEvent.change(input, { target: { value: '1000' } })
+        fireEvent.click(screen.getByRole('button', { name: 'save' }))
+        await waitFor(() => expect(saveDshSubjectPolicy).toHaveBeenCalledTimes(1))
+        await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
+        fireEvent.change(input, { target: { value: '0' } })
+        fireEvent.click(screen.getByRole('button', { name: 'save' }))
+        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Organization · dsh.configuredQuotaWan' })).toBeNull())
+        expect(saveDshSubjectPolicy).toHaveBeenCalledTimes(1)
+        expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
+    })
     it('keeps the single scrolling tree inside the bounded dialog', async () => {
         render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
         await screen.findByText('Engineering')
```

---

### Incident Patch 8: `e0266602` (2026-09-22)
**Commit Message**: fix(dsh): refresh seat totals on section navigation

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSettings.test.tsx` (modified, +13/-0)
```diff
@@ -65,6 +65,19 @@ describe('DSH deployment and business settings', () => {
         expect(screen.queryByText('seat-content')).toBeNull()
     })
 
+    it('refreshes assigned seats when returning from model authorization', async () => {
+        vi.mocked(getDshBrowserConfig).mockResolvedValue({ management_enabled: true, enabled: true, download_url: null, launch_url: 'dsh-desktop://login' })
+        const snapshot = { status: 'active', seat_limit: 10, assigned: 2, available: 8, as_of: '', expires_at: null, license_id: 'test' }
+        vi.mocked(getDshLicense).mockResolvedValue(snapshot)
+        const view = render(<DshManagement section="license" />)
+        expect(await screen.findByText('Seats 2 / 10')).toBeInTheDocument()
+        view.rerender(<DshManagement section="models" />)
+        await screen.findByText('model-content')
+        vi.mocked(getDshLicense).mockResolvedValue({ ...snapshot, assigned: 3, available: 7 })
+        view.rerender(<DshManagement section="license" />)
+        expect(await screen.findByText('Seats 3 / 10')).toBeInTheDocument()
+    })
+
     it('keeps settings accessible while business is disabled and avoids license/seat calls', async () => {
         render(<DshManagement />)
         await screen.findByRole('textbox', { name: /dsh.launchAddress/ })
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/index.tsx` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ function DshManagementContent({
                 if (!abort.signal.aborted) setLicenseError(true)
             })
         return () => abort.abort()
-    }, [config.enabled, revision])
+    }, [config.enabled, revision, activeSection])
 
     const handleOperation = useCallback(
         (ref: DshOperationRef, result?: DshOperation) => {
```

---

### Incident Patch 9: `4a52649b` (2026-09-22)
**Commit Message**: fix(dsh): recognize silent seat capacity errors

**File**: `src/frontend/platform/src/controllers/API/dsh.ts` (modified, +10/-8)
```diff
@@ -725,15 +725,17 @@ export function isDshRequestRejected(error: unknown): boolean {
 }
 
 export function isDshSeatLimitReached(error: unknown): boolean {
-    if (error && typeof error === 'object' && 'code' in error && error.code === 'seat_limit_reached') return true
-    if (!error || typeof error !== 'object' || !('response' in error)) return false
-    const response = error.response
-    if (!response || typeof response !== 'object' || !('data' in response)) return false
-    const data = response.data
+    if (!error || typeof error !== 'object') return false
+    // Silent requests reject HTTP 200 business envelopes directly; HTTP errors
+    // retain the Axios response. Decode the business payload in either case.
+    const response = 'response' in error ? error.response : undefined
+    const data = response && typeof response === 'object' && 'data' in response
+        ? response.data : error
     if (!data || typeof data !== 'object') return false
-    if ('error' in data && data.error && typeof data.error === 'object'
-        && 'code' in data.error && data.error.code === 'seat_limit_reached') return true
-    return 'status_code' in data && Number(data.status_code) === 26112
+    if ('status_code' in data && Number(data.status_code) === 26112) return true
+    const failure = 'error' in data ? data.error : data
+    return !!failure && typeof failure === 'object'
+        && 'code' in failure && failure.code === 'seat_limit_reached'
 }
 
 export async function getDshModelPolicy(
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatError.test.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ describe('seat capacity HTTP contract', () => {
     it('recognizes the DSH real HTTP error envelope', () => {
         expect(isDshSeatLimitReached({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
     })
+    it('recognizes the direct business envelope rejected by silent requests', () => {
+        expect(isDshSeatLimitReached({ status_code: 26112, status_message: 'DSH seat limit reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status_code: 26101 })).toBe(false)
+    })
     it('recognizes a failed durable allocation receipt', () => {
         expect(isDshSeatLimitReached({ code: 'seat_limit_reached' })).toBe(true)
     })
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatTransport.test.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { describe, expect, it, vi } from 'vitest'
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ toast: vi.fn() }))
+import request from '@/controllers/request'
+import { isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
+
+describe('seat errors through the platform HTTP interceptor', () => {
+    it('preserves capacity rejection from an HTTP 200 business response', async () => {
+        vi.stubGlobal('localStorage', { getItem: () => null })
+        const previous = request.defaults.adapter
+        request.defaults.adapter = async (config) => ({
+            status: 200, statusText: 'OK', headers: {}, config,
+            data: { status_code: 26112, status_message: 'DSH seat limit reached; contact an administrator' },
+        })
+        try {
+            const failure = await saveDshSubjectPolicy(6, 'DEPARTMENT', 18, 1, {
+                expected_version: 2, enabled: true, monthly_token_limit: 10000000,
+            }).catch((error: unknown) => error)
+            expect(isDshSeatLimitReached(failure)).toBe(true)
+        } finally {
+            request.defaults.adapter = previous
+            vi.unstubAllGlobals()
+        }
+    })
+})
```

---

### Incident Patch 10: `f3f1e599` (2026-09-21)
**Commit Message**: fix(dsh): show the provider model name and translate the catalog table

The shared display rule preferred the administrator-configured alias over
the provider's own model name, so a placeholder alias such as "model 1"
reached the Desktop catalog and the administration pages instead of
"qwen2.5-72b-instruct". Swap the precedence and keep the alias as the
fallback for models whose call name is blank.

The DSH model table also rendered raw i18n keys for its status, badge,
actions and permission-button labels, plus the empty-state hint; add the
five missing keys to the model namespace in all three languages.

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/client-api.md` (modified, +2/-2)
```diff
@@ -296,15 +296,15 @@ Content-Type: application/json
     "object":"model",
     "created":1788919200,
     "owned_by":"bisheng",
-    "display_name":"百炼 / 通义千问 Max",
+    "display_name":"百炼 / qwen-max",
     "capabilities":{"streaming":true,"tools":true,"reasoning_content":false}
   }]
 }
 ```
 
 上述字段均必返；created 为 Unix 秒。capabilities 三项为布尔值，`reasoning_content` 表示该适配器已验证的 DeepSeek 兼容扩展能力；不依据模型名推断。模型列表必须已经过现有模型可访问性与 DSH 白名单过滤；合法共享模型的物理 tenant_id 不返回给客户端作为过滤依据。
 
-`display_name` 与毕昇管理端共用展示规则：`提供方名称 / 管理员配置的模型展示名称`。模型展示名称优先使用 `name`，去除首尾空白后为空时使用调用名称 `model_name`；提供方名称为空时使用提供方类型。两部分均去除首尾空白。`id` 使用稳定的 `bisheng:<model.id>`，用于权限、额度与请求路由；`owned_by` 为 `bisheng`。修改展示名称后，客户端在下一次目录刷新时获取新名称。
+`display_name` 与毕昇管理端共用展示规则：`提供方名称 / 供应商调用名称`。模型部分优先使用调用名称 `model_name`，去除首尾空白后为空时回落到管理员配置的展示名称 `name`；提供方名称为空时使用提供方类型。两部分均去除首尾空白。`id` 使用稳定的 `bisheng:<model.id>`，用于权限、额度与请求路由；`owned_by` 为 `bisheng`。修改模型调用名称或展示名称后，客户端在下一次目录刷新时获取新名称。
 
 列表一次返回当前用户全部可用模型，本期无分页参数。空数组为成功结果，展示“管理员尚未开放可用企业模型”。模型名只用于展示，调用必须原样使用 id（`bisheng:<model_id>`），不传供应商原始模型名或自行拼接名称。
 
```

**File**: `src/backend/bisheng/dsh/domain/services/model_display.py` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 
 def model_display_name(model, server) -> str:
-    """Prefer the configured display name while keeping the provider visible."""
+    """Prefer the provider's own model name while keeping the provider visible."""
     provider = server.name.strip() or server.type
-    name = model.name.strip() or model.model_name.strip()
+    name = model.model_name.strip() or model.name.strip()
     return f"{provider} / {name}"
```

**File**: `src/backend/test/dsh/test_model_service.py` (modified, +5/-5)
```diff
@@ -133,17 +133,17 @@ async def test_models_empty_policy_and_immediate_offline(service_setup):
 @pytest.mark.parametrize(
     ("provider_name", "provider_type", "model_name", "alias", "expected"),
     [
-        ("百炼", "aliyun", "qwen-max", "通义千问 Max", "百炼 / 通义千问 Max"),
-        ("DeepSeek", "openai", "deepseek-chat", "DeepSeek V3", "DeepSeek / DeepSeek V3"),
-        ("  百炼  ", "aliyun", "  qwen-max  ", "  通义千问 Max  ", "百炼 / 通义千问 Max"),
-        ("", "openai", "qwen-max", "通义千问 Max", "openai / 通义千问 Max"),
+        ("百炼", "aliyun", "qwen-max", "通义千问 Max", "百炼 / qwen-max"),
+        ("DeepSeek", "openai", "deepseek-chat", "DeepSeek V3", "DeepSeek / deepseek-chat"),
+        ("  百炼  ", "aliyun", "  qwen-max  ", "  通义千问 Max  ", "百炼 / qwen-max"),
+        ("", "openai", "qwen-max", "通义千问 Max", "openai / qwen-max"),
         ("百炼", "aliyun", "  qwen-max  ", "", "百炼 / qwen-max"),
         ("百炼", "aliyun", "  qwen-max  ", "   ", "百炼 / qwen-max"),
         ("   ", "openai", "", "Custom model", "openai / Custom model"),
         ("OpenAI", "openai", "   ", "Custom model", "OpenAI / Custom model"),
     ],
 )
-async def test_catalog_and_admin_share_configured_display_name_and_route_id(
+async def test_catalog_and_admin_share_provider_model_name_and_route_id(
     service_setup, provider_name, provider_type, model_name, alias, expected
 ):
     from bisheng.dsh.admin_runtime import read_available_models
```

**File**: `src/frontend/platform/public/locales/en-US/model.json` (modified, +5/-0)
```diff
@@ -101,6 +101,11 @@
     "systemConfigInheritedBadge": "Inherited from Root",
     "systemConfigFallbackBlockedBanner": "Root sharing is off. Ask the super admin to enable sharing or configure this tenant directly.",
     "supportsImages": "Image input",
+    "status": "Status",
+    "available": "Available",
+    "actions": "Actions",
+    "configureDshPermission": "Configure permissions",
+    "noOnlineDshModels": "No online models available yet",
     "visionRetry": "Load or save failed. Retry",
     "loading": "Loading"
   },
```

**File**: `src/frontend/platform/public/locales/ja/model.json` (modified, +5/-0)
```diff
@@ -99,6 +99,11 @@
     "systemConfigInheritedBadge": "Root から継承",
     "systemConfigFallbackBlockedBanner": "Root 共有が無効です。スーパー管理者に共有を有効化してもらうか、このテナントで個別に設定してください。",
     "supportsImages": "画像入力",
+    "status": "ステータス",
+    "available": "利用可能",
+    "actions": "操作",
+    "configureDshPermission": "権限を設定",
+    "noOnlineDshModels": "利用可能なオンラインモデルがありません",
     "visionRetry": "読み込みまたは保存に失敗。再試行",
     "loading": "読み込み中"
   },
```

#### Recent Merged Pull Requests:
- **PR #2442** (2026-09-29): fix(workflow): isolate telemetry failures on 3.0-beta2 (@dolphin0618)
- **PR #2441** (closed): fix(select): don't crash when a scroll-loading MultiSelect unmounts while open (@eastagiletracker)
- **PR #2439** (2026-09-23): Feat 2.5.0 sg up (@likaiaki)
- **PR #2438** (2026-09-23): Feat/3.0.0 beta2 pre (@zgqgit)
- **PR #2437** (closed): Feat/3.0.0 beta2 (@zgqgit)
- **PR #2436** (closed): fix(workflow): isolate telemetry failures (@luochen211)
- **PR #2434** (2026-09-22): fix(dsh): show seat failures in a transient toast with actionable reasons (@SuperstructureJH)
- **PR #2433** (2026-09-22): fix(dsh): 修正授权失败反馈和用户名搜索提示 (@SuperstructureJH)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
