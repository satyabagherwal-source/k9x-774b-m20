# Forensic Learning Record (Deep Inspection): asciimoo/hister

> **Canonical Artifact**: `07_PROJECT_LEARNING/asciimoo-hister-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/asciimoo/hister](https://github.com/asciimoo/hister))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:40.660Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `asciimoo/hister`
- **Description**: Your own search engine
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 5908 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/tui/render/layout.go`
```
// SPDX-FileContributor: 4evy <git@evy.pink>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"fmt"
	"image/color"
	"strings"

	"github.com/asciimoo/hister/cmd/tui/component"
	"github.com/asciimoo/hister/cmd/tui/model"

	"charm.land/lipgloss/v2"
	uv "github.com/charmbracelet/ultraviolet"
)

type overlayDef struct {
	content func(*model.Model) string
	border  func(*model.Model) color.Color
	offset  func(*model.Model) (int, int) // nil = use OverlayOff
}

var overlayDefs = map[model.ViewState]overlayDef{
	model.StateHelp:            {HelpOverlay, func(m *model.Model) color.Color { return m.Styles.HelpBorder }, nil},
	model.StateDialog:          {func(m *model.Model) string { return DeleteDialog(m) }, func(m *model.Model) color.Color { return m.Styles.DialogBorder }, nil},
	model.StateThemePicker:     {func(m *model.Model) string { return ThemePicker(m) }, func(m *model.Model) color.Color { return m.Styles.ThemeBorder }, nil},
	model.StateSettings:        {func(m *model.Model) string { return Settings(m) }, func(m *model.Model) color.Color { return m.Styles.HelpBorder }, nil},
	model.StateContextMenu:     {func(m *model.Model) string { return ContextMenu(m) }, func(m *model.Model) color.Color { return m.Styles.DialogBorder }, MenuOverlayOffset},
	model.StatePrioritizeInput: {func(m *model.Model) string { return PrioritizeInput(m) }, func(m *model.Model) color.Color { return m.Styles.DialogBorder }, nil},
	model.StateLabelInput:      {LabelInput, func(m *model.Model) color.Color { return m.Styles.ThemeBorder }, nil},
}

func View(m *model.Model) string {
	if !m.Ready {
		return "Starting Hister…"
	}
	if m.Width < 20 || m.Height < 14 {
		return fmt.Sprintf("Terminal too small\nNeed at least 20×14; current size is %d×%d.", m.Width, m.Height)
	}

	main := MainView(m)

	if def, ok := overlayDefs[m.State]; ok {
		maxW := overlayMaxWidth(m)
		fg := renderOverlayBox(def.content(m), def.border(m), maxW)
		offX, offY := m.OverlayOffX, m.OverlayOffY
		if def.offset != nil {
			offX, offY = def.offset(m)
		}
		return renderOverlay(main, fg, m.Width-1, m.Height, offX, offY)
	}
	return main
}

var tabRenderers = map[int]func(*model.Model) string{
	model.TabHistory: HistoryTab,
	model.TabRules:   RulesTab,
	model.TabAdd:     AddTab,
}

func MainView(m *model.Model) string {
	w := max(0, m.Width-1)
	div := m.Styles.Div.Render(strings.Repeat("─", w))

	header := Header(m)

	if renderer, ok := tabRenderers[m.ActiveTab]; ok {
		content := renderer(m)
		m.Workspace.SetContent(content)
		target := m.WorkspaceSelectionY
		if target < m.Workspace.YOffset() {
			m.Workspace.SetYOffset(target)
		} else if target >= m.Workspace.YOffset()+m.Workspace.Height() {
			m.Workspace.SetYOffset(max(0, target-m.Workspace.Height()+2))
		}
		hints := Hints(m)
		return strings.Join([]string{header, div, m.Workspace.View(), div, hints}, "\n")
	}

	pStyle := m.Styles.PromptActive
	prompt := "▶"
	if m.State != model.StateInput {
		pStyle = m.Styles.PromptBlur
		prompt = "·"
	}
	inputLine := "  " + pStyle.Render(prompt) + " " + m.TextInput.View()
	ResizeSearchViewports(m)
	body := SearchBody(m)

	hints := Hints(m)

	return strings.Join([]string{header, div, inputLine, div, body, div, hints}, "\n")
}

// DetailsVisible reports whether the Search workspace has a readable preview
// open. It is intentionally independent of State so a label/dialog overlay can
// retain the split pane behind it.
func DetailsVisible(m *model.Model) bool {
	return m.ActiveTab == model.TabSearch && m.DetailsURL != ""
}

func DetailsSplit(m *model.Model) bool {
	return DetailsVisible(m) && m.Width >= model.DetailsSplitMinWidth
}

func DetailsPaneWidth(m *model.Model) int {
	w := max(1, m.Width-1)
	if !DetailsSplit(m) {
		return w
	}
	return min(model.DetailsPaneMaxWidth, max(model.DetailsPaneMinWidth, w*46/100))
}

// ResizeSearchViewports applies the same geometry that SearchBody renders.
// Keeping this calculation in one place prevents wrapping, scrollbar, and
// pointer hitboxes from disagreeing when the details pane opens or closes.
func ResizeSearchViewports(m *model.Model) {
	w := max(1, m.Width-1)
	bodyH := max(1, m.Height-model.FixedLayoutRows)
	leftW := w
	if DetailsSplit(m) {
		leftW -= DetailsPaneWidth(m)
	}
	m.Viewport.SetWidth(max(1, leftW-2))
	m.Viewport.SetHeight(bodyH)

	if DetailsVisible(m) {
		m.Details.SetWidth(max(1, DetailsPaneWidth(m)-2))
		m.Details.SetHeight(max(1, bodyH-2))
	}
}

// DetailsPaneBounds returns the screen-space pane body used by mouse hit
// testing. Y begins below the search input and its divider.
func DetailsPaneBounds(m *model.Model) (x, y, width, height int) {
	width = DetailsPaneWidth(m)
	x = 0
	if DetailsSplit(m) {
		x = max(0, m.Width-1-width)
	}
	return x, model.RowVPStart, width, max(1, m.Height-model.FixedLayoutRows)
}

func SearchBody(m *model.Model) string {
	w := max(1, m.Width-1)
	bodyH := max(1, m.Height-model.FixedLayoutRows)
	if DetailsVisible(m) && !DetailsSplit(m) {
		return DetailsPane(m, w, bodyH)
	}

	leftW := w
	if DetailsSplit(m) {
		leftW -= DetailsPaneWidth(m)
	}
	results := resultsViewport(m, leftW, bodyH)
	if !DetailsSplit(m) {
		return results
	}
	return lipgloss.JoinHorizontal(lipgloss.Top, results, DetailsPane(m, DetailsPaneWidth(m), bodyH))
}

func resultsViewport(m *model.Model, width, height int) string {
	content := normalizeBlock(m.Viewport.View(), max(1, m.Viewport.Width()), height)
	if m.Viewport.TotalLineCount() > m.Viewport.Height() && m.Viewport.Height() > 0 {
		content = lipgloss.JoinHorizontal(lipgloss.Top, content, " ", Scrollbar(m))
	}
	return normalizeBlock(content, width, height)
}

func DetailsPane(m *model.Model, width, height int) string {
	innerW := max(1, width-2)
	headerStyle := m.Styles.Gray
	previewFocused := m.DetailsFocused || !DetailsSplit(m)
	if previewFocused {
		headerStyle = m.Styles.HelpHeader
	}
	previewLabel := "  Preview"
	if previewFocused {
		previewLabel = "▶ Preview"
	}
	title := headerStyle.Render(previewLabel)
	if m.DetailsLoading {
		title += " " + m.Styles.Spin.Render(m.Spinner.View())
	}
	closeButton := m.Styles.HintKey.Render("×")
	header := truncateAnsi(title, max(1, innerW-2))
	header = rightPad(header, max(1, innerW-lipgloss.Width(closeButton))) + closeButton
	divider := m.Styles.Div.Render(strings.Repeat("─", innerW))
	body := normalizeBlock(m.Details.View(), innerW, max(1, height-2))
	content := strings.Join([]string{header, divider, body}, "\n")
	content = normalizeBlock(content, innerW, height)

	prefix := m.Styles.Div.Render("│") + " "
	lines := strings.Split(content, "\n")
	for i := range lines {
		lines[i] = prefix + lines[i]
	}
	return strings.Join(lines, "\n")
}

func normalizeBlock(content string, width, height int) string {
	lines := strings.Split(content, "\n")
	if len(lines) > height {
		lines = lines[:height]
	}
	for len(lines) < height {
		lines = append(lines, "")
	}
	for i, line := range lines {
		line = truncateAnsi(line, width)
		lines[i] = rightPad(line, width)
	}
	return strings.Join(lines, "\n")
}

func Header(m *model.Model) string {
	w := max(1, m.Width-1)
	compact := w < 64
	var tabs []string
	m.TabTargets = nil
	prefix := " "
	if !compact {
		prefix += m.Styles.Brand.Render("hister") + "  "
	}
	x := lipgloss.Width(prefix)
	for _, definition := range model.Tabs {
		label := definition.Name
		if compact {
			label = definition.Name[:1]
		}
		var tab string
		if definition.ID == m.ActiveTab {
			tab = m.Styles.TabActive.Render("[" + label + "]")
		} else {
			tab = m.Styles.TabInactive.Render(" " + label + " ")
		}
		tabs = append(tabs, tab)
		tabWidth := lipgloss.Width(tab)
		m.TabTargets = append(m.TabTargets, model.HintRegion{
			X0: x, X1: x + tabWidth, Action: definition.Action,
		})
		x += tabWidth + model.TabGap
	}
	tabBar := prefix + strings.Join(tabs, " ")
	appendMode := func(full, short string) {
		label := full
		if compact {
			label = short
		}
		badge := "  " + m.Styles.Conn.Render(label)
		if lipgloss.Width(tabBar)+lipgloss.Width(badge) < w {
			tabBar += badge
		}
	}
	if m.SortMode == "domain" {
		appendMode("[domain]", "D")
	}
	if m.SemanticOn {
		appendMode("[semantic]", "S")
	}

	connection := m.Styles.Disc.Render("● offline · retrying…")
	if m.WsReady {
		connection = m.Styles.Conn.Render("●")
	}

	var status string
	if m.Notice != "" {
		status = renderNotice(m)
	} else if !m.WsReady {
		status = connection
	} else {
		status = workspaceStatus(m)
	}
	right := status
	if m.WsReady && m.Notice == "" {
		right = connection + "  " + status
	}

	leftW := lipgloss.Width(tabBar)
	rightW := lipgloss.Width(right)
	if available := max(0, w-leftW); rightW > available {
		right = truncateAnsi(right, available)
		rightW = lipgloss.Width(right)
	}
	pad := max(0, w-leftW-rightW)
	return tabBar + strings.Repeat(" ", pad) + right
}

func renderNotice(m *model.Model) string {
	return renderStatusMessage(m, m.Notice, m.NoticeKind)
}

func renderStatusMessage(m *model.Model, message string, kind model.NoticeKind) string {
	prefix := "◆ "
	style := m.Styles.Status
	switch kind {
	case model.NoticeSuccess:
		prefix, style = "✓ ", m.Styles.Conn
	case model.NoticeWarning:
		prefix, style = "! ", m.Styles.Spin
	case model.NoticeError:
		prefix, style = "! ", m.Styles.Disc
	}
	return style.Render(prefix + sanitizeTerminalLine(message))
}

func workspaceStatus(m *model.Model) string {
	switch m.ActiveTab {
	case model.TabHistory:
		if m.HistoryLoading {
			return m.Styles.Spin.Render(m.Spinner.View() + " loading history…")
		}
		return m.Styles.Status.Render(itemCount(len(m.HistoryItems), "history item"))
	case model.TabRules:
		if m.RulesLoading {
			return m.Styles.Spin.Render(m.Spinner.View() + " loading rules…")
		}
		total := len(m.RulesData.Allow) + len(m.RulesData.Skip) + len(m.RulesData.Priority) + len(m.RulesData.Versioning) + len(m.RulesData.Aliases)
		return m.Styles.Status.Render(itemCount(total, "rule"))
	case model.TabAdd:
		return m.Styles.Status.Render("Add a document")
	}

	if m.IsSearching {
		return m
```

### Core Architecture Module: `cmd/tui/render/overlays.go`
```
// SPDX-FileContributor: 4evy <git@evy.pink>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"fmt"
	"slices"
	"strings"

	"github.com/asciimoo/hister/cmd/tui/model"
	"github.com/asciimoo/hister/cmd/tui/theme"
	"github.com/asciimoo/hister/config"

	"charm.land/lipgloss/v2"
)

func ThemePicker(m *model.Model) string {
	darkNames, lightNames := theme.ClassifyThemes()
	listBudget := max(2, m.Height-12)
	darkBudget := (listBudget + 1) / 2
	lightBudget := listBudget - darkBudget
	darkStart, darkEnd := windowRange(len(darkNames), m.DarkThemeIdx, darkBudget)
	lightStart, lightEnd := windowRange(len(lightNames), m.LightThemeIdx, lightBudget)
	m.ThemeDarkStart, m.ThemeDarkCount = darkStart, darkEnd-darkStart
	m.ThemeLightStart, m.ThemeLightCount = lightStart, lightEnd-lightStart

	maxNameW := 0
	for _, name := range slices.Concat(darkNames, lightNames) {
		if width := lipgloss.Width(name); width > maxNameW {
			maxNameW = width
		}
	}

	var modeParts []string
	for _, mode := range theme.ColorSchemeModes {
		if mode == m.ThemePickerMode {
			modeParts = append(modeParts, m.Styles.ThemePickerSelected.Render("["+mode+"]"))
		} else {
			modeParts = append(modeParts, m.Styles.Gray.Render(" "+mode+" "))
		}
	}
	modeRow := "Mode: " + strings.Join(modeParts, " ")

	renderSection := func(names []string, start, end, cursorIdx int, configuredName string, focused bool) []string {
		var slines []string
		for i, name := range names[start:end] {
			absoluteIdx := start + i
			focusMarker := "  "
			if focused && absoluteIdx == cursorIdx {
				focusMarker = "▸ "
			}
			configuredMarker := "  "
			if name == configuredName {
				configuredMarker = "● "
			}
			paddedName := name + strings.Repeat(" ", maxNameW-lipgloss.Width(name))
			swatch := ""
			if p, ok := theme.GetPalette(name); ok {
				swatch = renderSwatch(p)
			}
			content := focusMarker + configuredMarker + paddedName + "  " + swatch
			if focused && absoluteIdx == cursorIdx {
				slines = append(slines, m.Styles.ThemePickerSelected.Render(content))
			} else {
				slines = append(slines, m.Styles.ThemePickerItem.Render(content))
			}
		}
		return slines
	}

	var lines []string
	lines = append(lines, modeRow)
	lines = append(lines, m.Styles.Gray.Render("Terminal mode keeps your terminal colors (pass-through)."), "")

	darkFocused := m.ThemePickerSection == 0
	headerStyle := m.Styles.Gray
	if darkFocused {
		headerStyle = m.Styles.SelTitle
	}
	lines = append(lines, headerStyle.Render(rangeHeader("Dark Themes", darkStart, darkEnd, len(darkNames))))
	lines = append(lines, renderSection(darkNames, darkStart, darkEnd, m.DarkThemeIdx, m.Cfg.TUI.DarkTheme, darkFocused)...)
	lines = append(lines, "")

	lightFocused := m.ThemePickerSection == 1
	headerStyle = m.Styles.Gray
	if lightFocused {
		headerStyle = m.Styles.SelTitle
	}
	lines = append(lines, headerStyle.Render(rangeHeader("Light Themes", lightStart, lightEnd, len(lightNames))))
	lines = append(lines, renderSection(lightNames, lightStart, lightEnd, m.LightThemeIdx, m.Cfg.TUI.LightTheme, lightFocused)...)

	lines = append(lines, "")
	nav := m.Keys.BestKey(config.ActionScrollDown)
	mode := m.Keys.BestKey(config.ActionToggleTheme)
	confirm := m.Keys.BestKey(config.ActionOpenResult)
	themeHints := nav + " navigate  ⇥ section  " + mode + " mode  " + confirm + " confirm  ⎋ cancel"
	lines = append(lines, m.Styles.Hint.Render(themeHints))
	return m.Styles.ThemePicker.Render(strings.Join(lines, "\n"))
}

// ContextMenu renders a small context menu box.
func ContextMenu(m *model.Model) string {
	var lines []string
	for i, option := range model.MenuOptions {
		if i == m.MenuSelIdx {
			lines = append(lines, m.Styles.ThemePickerSelected.Render("▸ "+option.Label))
		} else {
			lines = append(lines, m.Styles.ThemePickerItem.Render("  "+option.Label))
		}
	}
	return m.Styles.Dialog.Render(strings.Join(lines, "\n"))
}

func DeleteDialog(m *model.Model) string {
	var lines []string
	lines = append(lines, m.Styles.Title.Render(m.DialogMsg))
	lines = append(lines, "")
	urlDisplay := truncateLine(m.DialogURL, 35)
	lines = append(lines, m.Styles.URL.Render(urlDisplay))
	lines = append(lines, "")
	cancelLabel := " Cancel "
	deleteLabel := " Delete "
	var cancelBtn, deleteBtn string
	if m.DialogBtnIdx == 0 {
		cancelBtn = m.Styles.CancelBtnSel.Render(cancelLabel)
	} else {
		cancelBtn = m.Styles.CancelBtn.Render(cancelLabel)
	}
	if m.DialogBtnIdx == 1 {
		deleteBtn = m.Styles.DeleteBtnSel.Render(deleteLabel)
	} else {
		deleteBtn = m.Styles.DeleteBtn.Render(deleteLabel)
	}
	lines = append(lines, cancelBtn+"   "+deleteBtn)
	lines = append(lines, "")
	lines = append(lines, m.Styles.Hint.Render("←/→ select  ↵ confirm  esc cancel"))
	return m.Styles.Dialog.Render(strings.Join(lines, "\n"))
}

func Settings(m *model.Model) string {
	items := m.SortedSettingsItems()
	errorRows := 0
	if m.SettingsEditErr != "" {
		errorRows = 2
	}
	bindingCursor := max(0, m.SettingsIdx-1)
	start, end := windowRange(len(items), bindingCursor, max(1, m.Height-10-errorRows))
	m.SettingsStart, m.SettingsCount = start, end-start

	maxKeyW := 0
	for _, it := range items {
		fk := FormatKey(it.Key)
		if width := lipgloss.Width(fk); width > maxKeyW {
			maxKeyW = width
		}
	}

	var lines []string
	lines = append(lines, m.Styles.Title.Render("Settings"))
	appearance := "  Appearance  " + appearanceModeLabel(m.Cfg.TUI.ColorScheme)
	if m.SettingsIdx == 0 {
		appearance = m.Styles.ThemePickerSelected.Render("▸ Appearance  " + appearanceModeLabel(m.Cfg.TUI.ColorScheme))
	} else {
		appearance = m.Styles.ThemePickerItem.Render(appearance)
	}
	lines = append(lines, appearance)
	lines = append(lines, "")
	lines = append(lines, m.Styles.HelpHeader.Render(rangeHeader("Keybindings", start, end, len(items))))
	for i, it := range items[start:end] {
		absoluteIdx := start + i + 1
		if absoluteIdx == m.SettingsIdx && m.SettingsEditMode {
			lines = append(lines, m.Styles.ThemePickerSelected.Render("▸ Press a key...  →  "+string(it.Action)))
		} else {
			fk := FormatKey(it.Key)
			padded := fk + strings.Repeat(" ", maxKeyW-lipgloss.Width(fk))
			row := "  " + padded + "  →  " + string(it.Action)
			if absoluteIdx == m.SettingsIdx {
				lines = append(lines, m.Styles.ThemePickerSelected.Render("▸ "+padded+"  →  "+string(it.Action)))
			} else {
				lines = append(lines, m.Styles.ThemePickerItem.Render(row))
			}
		}
	}
	if m.SettingsEditErr != "" {
		lines = append(lines, "")
		lines = append(lines, lipgloss.NewStyle().Foreground(m.Styles.DialogBorder).Render("  "+m.SettingsEditErr))
	}
	lines = append(lines, "")
	if m.SettingsEditMode {
		lines = append(lines, m.Styles.Hint.Render("press any key to bind  esc restore default"))
	} else {
		sNav := m.Keys.BestKey(config.ActionScrollDown)
		sEdit := m.Keys.BestKey(config.ActionOpenResult)
		sTheme := m.Keys.BestKey(config.ActionToggleTheme)
		action := "rebind"
		if m.SettingsIdx == 0 {
			action = "change mode"
		}
		lines = append(lines, m.Styles.Hint.Render(sNav+" navigate  "+sEdit+" "+action+"  "+sTheme+" themes  ⎋ close"))
	}
	return m.Styles.Help.Render(strings.Join(lines, "\n"))
}

func appearanceModeLabel(mode string) string {
	switch mode {
	case "", theme.TerminalName:
		return "Terminal (pass-through)"
	case "auto":
		return "Auto (dark/light)"
	case "dark":
		return "Dark theme"
	case "light":
		return "Light theme"
	default:
		return mode
	}
}

func windowRange(length, cursor, budget int) (int, int) {
	if length <= 0 || budget <= 0 {
		return 0, 0
	}
	budget = min(length, budget)
	start := max(0, min(cursor-budget/2, length-budget))
	return start, start + budget
}

func rangeHeader(label string, start, end, total int) string {
	if start == 0 && end == total {
		return label
	}
	return fmt.Sprintf("%s (%d–%d/%d)", label, start+1, end, total)
}

func PrioritizeInput(m *model.Model) string {
	var lines []string
	lines = append(lines, m.Styles.Title.Render("Add Priority Pattern"))
	lines = append(lines, "")
	lines = append(lines, m.Styles.Gray.Render("Pattern:"))
	lines = append(lines, "  "+m.PrioritizeInput.View())
	lines = append(lines, "")
	cancelLabel := " Cancel "
	confirmLabel := " Confirm "
	var cancelBtn, confirmBtn string
	if m.PrioritizeBtnIdx == 0 {
		cancelBtn = m.Styles.CancelBtnSel.Render(cancelLabel)
	} else {
		cancelBtn = m.Styles.CancelBtn.Render(cancelLabel)
	}
	if m.PrioritizeBtnIdx == 1 {
		confirmBtn = m.Styles.ConfirmBtnSel.Render(confirmLabel)
	} else {
		confirmBtn = m.Styles.ConfirmBtn.Render(confirmLabel)
	}
	lines = append(lines, cancelBtn+"   "+confirmBtn)
	lines = append(lines, "")
	lines = append(lines, m.Styles.Hint.Render("←/→ select  ↵ confirm  esc cancel"))
	return m.Styles.Dialog.Render(strings.Join(lines, "\n"))
}

func LabelInput(m *model.Model) string {
	lines := []string{
		m.Styles.Title.Render("Edit label"),
		"",
		m.Styles.URL.Render(truncateLine(m.LabelURL, max(20, m.LabelInput.Width()))),
		"",
		m.LabelInput.View(),
		"",
		m.Styles.Hint.Render("↵ save  ⎋ cancel  empty label clears it"),
	}
	return m.Styles.Dialog.Render(strings.Join(lines, "\n"))
}

func renderSwatch(p theme.Palette) string {
	colors := []string{p.Base01, p.Base08, p.Base09, p.Base0A, p.Base0B, p.Base0C, p.Base0D, p.Base0E}
	var sb strings.Builder
	for _, hex := range colors {
		sb.WriteString(lipgloss.NewStyle().Background(lipgloss.Color(hex)).Render("  "))
	}
	return sb.String()
}

func RefreshViewport(m *model.Model) {
	if m.Ready {
		m.Viewport.SetContent(Results(m))
	}
}

func RefreshAndScroll(m *model.Model) {
	RefreshViewport(m)
	m.ScrollToSelected()
}

```

### Core Architecture Module: `cmd/tui/render/preview.go`
```
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	readabilityrender "codeberg.org/readeck/go-readability/v2/render"
	"github.com/charmbracelet/x/ansi"
	"golang.org/x/net/html"

	"github.com/asciimoo/hister/cmd/tui/model"
	"github.com/asciimoo/hister/server/document"
)

func ResultDetailsContent(m *model.Model) string {
	url := m.DetailsURL
	if url == "" {
		url = m.GetSelectedURL()
	}
	title := m.DetailsHintTitle
	if m.DetailsPreview != nil && m.DetailsPreview.Title != "" {
		title = m.DetailsPreview.Title
	}
	if title == "" {
		title = url
	}
	title = sanitizeTerminalText(title)
	url = sanitizeTerminalText(url)
	lines := []string{m.Styles.Title.Render(title), m.Styles.URL.Render(url)}

	doc := detailsDocument(m, url)
	meta := map[string]any(nil)
	if m.DetailsPreview != nil {
		meta = m.DetailsPreview.Meta
	}
	facts := previewFacts(m, doc, meta)
	if len(facts) > 0 {
		lines = append(lines, "", m.Styles.Gray.Render(sanitizeTerminalText(strings.Join(facts, "  ·  "))))
	}
	if doc != nil && doc.Label != "" {
		lines = append(lines, m.Styles.SuggTerm.Render(sanitizeTerminalText("label: "+doc.Label)))
	}
	if description := metaString(meta, "description"); description != "" {
		lines = append(lines, "", m.Styles.SecText.UnsetItalic().Render(sanitizeTerminalText(description)))
	}

	lines = append(lines, "", m.Styles.HelpHeader.Render("Content"), "")
	content := ""
	switch {
	case m.DetailsLoading:
		content = "Loading readable preview…"
	case m.DetailsErr != nil:
		content = "Readable preview unavailable: " + m.DetailsErr.Error()
		if doc != nil && strings.TrimSpace(doc.Text) != "" {
			content += "\n\n" + strings.TrimSpace(doc.Text)
		}
	case m.DetailsPreview != nil:
		content = previewPlainText(m.DetailsPreview.Template, m.DetailsPreview.Content)
	case doc != nil:
		content = strings.TrimSpace(doc.Text)
	}
	if content == "" {
		content = "No readable content is available for this result."
	}
	content = sanitizeTerminalText(content)
	lines = append(lines, m.Styles.SecText.UnsetItalic().UnsetFaint().Render(content))
	return wrapDetailsText(strings.Join(lines, "\n"), max(1, DetailsPaneWidth(m)-2))
}

func wrapDetailsText(content string, width int) string {
	width = max(1, width)
	return ansi.Hardwrap(ansi.Wordwrap(content, width, "/"), width, false)
}

func detailsDocument(m *model.Model, url string) *document.Document {
	for _, doc := range m.VisibleDocuments() {
		if doc != nil && doc.URL == url {
			return doc
		}
	}
	return nil
}

func previewFacts(m *model.Model, doc *document.Document, meta map[string]any) []string {
	var facts []string
	for _, key := range []string{"author", "published", "type", "site_name"} {
		if value := metaString(meta, key); value != "" {
			if key == "published" {
				value = formatPreviewDate(value)
			}
			facts = append(facts, value)
		}
	}
	if len(facts) == 0 && doc != nil {
		if doc.Domain != "" {
			facts = append(facts, doc.Domain)
		}
		if doc.Language != "" {
			facts = append(facts, "language "+doc.Language)
		}
		facts = append(facts, fmt.Sprintf("type %v", doc.Type))
	}
	added := int64(0)
	versionCount := 0
	if m.DetailsPreview != nil {
		added = m.DetailsPreview.Added
		versionCount = m.DetailsPreview.VersionCount
	} else if doc != nil {
		added = doc.Added
	}
	if age := relativeTime(added); age != "" {
		facts = append(facts, "indexed "+age+" ago")
	}
	if versionCount > 0 {
		facts = append(facts, fmt.Sprintf("%d previous version(s)", versionCount))
	}
	return facts
}

func metaString(meta map[string]any, key string) string {
	value, _ := meta[key].(string)
	return strings.TrimSpace(value)
}

func formatPreviewDate(raw string) string {
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.Format("2 Jan 2006")
	}
	return raw
}

func previewPlainText(template, content string) string {
	if template == "video" {
		return videoPreviewText(content)
	}
	if !strings.Contains(content, "<") {
		return strings.TrimSpace(content)
	}
	return htmlPreviewText(content)
}

func videoPreviewText(content string) string {
	var video struct {
		Uploader          string `json:"uploader"`
		DurationFormatted string `json:"durationFormatted"`
		UploadDate        string `json:"uploadDate"`
		ViewCount         int64  `json:"viewCount"`
		Description       string `json:"description"`
		Transcript        string `json:"transcript"`
		Chapters          []struct {
			Title     string `json:"title"`
			StartTime string `json:"startTime"`
		} `json:"chapters"`
	}
	if err := json.Unmarshal([]byte(content), &video); err != nil {
		return strings.TrimSpace(content)
	}
	var sections []string
	var facts []string
	for _, value := range []string{video.Uploader, video.UploadDate, video.DurationFormatted} {
		if value != "" {
			facts = append(facts, value)
		}
	}
	if video.ViewCount > 0 {
		facts = append(facts, fmt.Sprintf("%d views", video.ViewCount))
	}
	if len(facts) > 0 {
		sections = append(sections, strings.Join(facts, " · "))
	}
	if video.Description != "" {
		sections = append(sections, video.Description)
	}
	if len(video.Chapters) > 0 {
		chapters := []string{"Chapters"}
		for _, chapter := range video.Chapters {
			chapters = append(chapters, chapter.StartTime+"  "+chapter.Title)
		}
		sections = append(sections, strings.Join(chapters, "\n"))
	}
	if video.Transcript != "" {
		sections = append(sections, "Transcript\n"+video.Transcript)
	}
	return strings.Join(sections, "\n\n")
}

func htmlPreviewText(content string) string {
	doc, err := html.Parse(strings.NewReader(content))
	if err != nil {
		return strings.TrimSpace(content)
	}
	return strings.TrimSpace(readabilityrender.InnerText(doc))
}

```

### Core Architecture Module: `cmd/tui/render/results.go`
```
// SPDX-FileContributor: 4evy <git@evy.pink>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"fmt"
	"strings"

	"github.com/asciimoo/hister/cmd/tui/model"
	"github.com/asciimoo/hister/server/document"
	smodel "github.com/asciimoo/hister/server/model"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"
)

func Results(m *model.Model) string {
	documents := m.VisibleDocuments()
	if m.Results == nil || (len(documents) == 0 && len(m.Results.History) == 0) {
		m.LineOffsets = nil
		m.SuggestionHeight = 0
		if m.IsSearching {
			return m.Styles.Gray.Render("  " + m.Spinner.View() + " searching…")
		}
		query := sanitizeTerminalLine(m.TextInput.Value())
		if !m.WsReady {
			return emptyState(m, "Search is offline", "Hister is reconnecting automatically. Your query will stay here.")
		}
		if query != "" {
			title := "No results for “" + truncateLine(query, max(8, m.Viewport.Width()-22)) + "”"
			detail := "Try fewer words or check the spelling."
			if m.Results != nil && m.Results.QuerySuggestion != "" {
				suggestion := sanitizeTerminalLine(m.Results.QuerySuggestion)
				detail = "Did you mean “" + truncateLine(suggestion, max(8, m.Viewport.Width()-24)) + "”? Press Enter to try it."
			}
			return emptyState(m, title, detail)
		}
		return emptyState(m, "Search your history", "Type above to search indexed content and past visits.")
	}
	var items []string
	var lineOffsets []int
	currentLine, currentIdx := 0, 0

	w := max(1, m.Viewport.Width()-3)
	contentW := max(1, w-2)
	style := lipgloss.NewStyle().MaxWidth(w)

	histCount := 0
	for _, h := range m.Results.History {
		if currentIdx >= m.Limit {
			break
		}
		lineOffsets = append(lineOffsets, currentLine)
		item := style.Render(HistoryItem(m, h, currentIdx == m.SelectedIdx, contentW))
		items = append(items, item)
		currentLine += lipgloss.Height(item) + 1
		currentIdx++
		histCount++
	}

	if histCount > 0 && len(documents) > 0 && currentIdx < m.Limit {
		div := sectionDivider(m.Styles, w)
		items = append(items, div)
		currentLine += lipgloss.Height(div) + 1
	}

	lastDomain := ""
	for _, d := range documents {
		if currentIdx >= m.Limit {
			break
		}
		// Domain separator when sorting by domain
		if m.SortMode == "domain" && d.Domain != "" && d.Domain != lastDomain {
			// Close previous domain group
			if lastDomain != "" {
				closingDiv := "  " + m.Styles.Div.Render(strings.Repeat("─", max(0, w-2)))
				items = append(items, closingDiv)
				currentLine += lipgloss.Height(closingDiv) + 1
			}
			lastDomain = d.Domain
			domLabel := strings.TrimPrefix(d.Domain, "www.")
			ruleW := max(0, w-lipgloss.Width(domLabel)-3)
			domDiv := "  " + m.Styles.DomainHeader.Render(domLabel) + " " + m.Styles.Div.Render(strings.Repeat("─", ruleW))
			items = append(items, domDiv)
			currentLine += lipgloss.Height(domDiv) + 1
		}
		lineOffsets = append(lineOffsets, currentLine)
		item := style.Render(Document(m, d, currentIdx == m.SelectedIdx, contentW))
		items = append(items, item)
		currentLine += lipgloss.Height(item) + 1
		currentIdx++
	}

	// Close last domain group
	if m.SortMode == "domain" && lastDomain != "" {
		closingDiv := "  " + m.Styles.Div.Render(strings.Repeat("─", max(0, w-2)))
		items = append(items, closingDiv)
		currentLine += lipgloss.Height(closingDiv) + 1
	}

	totalItems := len(m.Results.History) + len(documents)
	if totalItems > m.Limit {
		lineOffsets = append(lineOffsets, currentLine)
		totalAvailable := max(int(m.Results.Total)+len(m.Results.History), totalItems)
		rem := max(0, totalAvailable-m.Limit)
		var content string
		if currentIdx == m.SelectedIdx && resultListFocused(m) {
			content = m.Styles.LoadMoreSelected.Render(fmt.Sprintf("[ ▼ Load 10 more (%d remaining) ]", rem))
		} else {
			content = m.Styles.LoadMore.Render(fmt.Sprintf("[ ▼ Load 10 more (%d remaining) ]", rem))
		}
		var item string
		if currentIdx == m.SelectedIdx {
			item = style.Render(selectedResultStyle(m).Render(content))
		} else {
			item = style.Render(m.Styles.Item.Render(content))
		}
		items = append(items, item)
	}

	output := strings.Join(items, "\n\n")
	if m.Results.QuerySuggestion != "" {
		sugg := "  " + m.Styles.SuggLabel.Render("did you mean: ") + m.Styles.SuggTerm.Render(sanitizeTerminalLine(m.Results.QuerySuggestion))
		suggH := lipgloss.Height(sugg) + 1
		for i := range lineOffsets {
			lineOffsets[i] += suggH
		}
		output = sugg + "\n\n" + output
		m.SuggestionHeight = suggH
	} else {
		m.SuggestionHeight = 0
	}
	m.LineOffsets = lineOffsets
	return output
}

func emptyState(m *model.Model, title, detail string) string {
	return strings.Join([]string{
		"",
		"  " + m.Styles.HelpHeader.Render(title),
		"  " + m.Styles.Gray.Render(detail),
	}, "\n")
}

func resultListFocused(m *model.Model) bool {
	return m.State == model.StateResults ||
		(m.State == model.StateDetails && renderResultsPaneFocused(m))
}

func renderResultsPaneFocused(m *model.Model) bool {
	return DetailsSplit(m) && !m.DetailsFocused
}

func selectedResultStyle(m *model.Model) lipgloss.Style {
	if resultListFocused(m) {
		return m.Styles.SelectedItem
	}
	return m.Styles.SelectedItemBlur
}

func HistoryItem(m *model.Model, h *smodel.URLCount, sel bool, contentW int) string {
	ts := m.Styles.Title
	if sel && resultListFocused(m) {
		ts = m.Styles.SelTitle
	}
	const badgeW = 4

	countRendered := ""
	countW := 0
	if h.Count > 0 {
		countRendered = m.Styles.Count.Render(fmt.Sprintf("×%d", h.Count))
		countW = lipgloss.Width(countRendered) + 1
	}

	titleMaxW := max(1, contentW-badgeW-countW)
	titleRendered := renderTitle(ts, strings.Join(strings.Fields(h.Title), " "), titleMaxW)
	titleLine := m.Styles.Hist.Render("[H] ") + rightPad(titleRendered, contentW-badgeW-countW) +
		strings.Repeat(" ", max(0, countW-lipgloss.Width(countRendered))) + countRendered

	content := titleLine + "\n" + renderURL(m.Styles, h.URL, "", contentW)
	if sel {
		return selectedResultStyle(m).Render(content)
	}
	return m.Styles.Item.Render(content)
}

func Document(m *model.Model, d *document.Document, sel bool, contentW int) string {
	ts := m.Styles.Title
	if sel && resultListFocused(m) {
		ts = m.Styles.SelTitle
	}

	domainBadge := ""
	domainBadgeW := 0
	if d.Domain != "" {
		shortDomain := strings.TrimPrefix(d.Domain, "www.")
		domainBadge = m.Styles.DomainLabel.Render("["+shortDomain+"]") + " "
		domainBadgeW = lipgloss.Width(domainBadge)
	}
	labelBadge := ""
	labelBadgeW := 0
	if d.Label != "" {
		labelBadge = m.Styles.SuggTerm.Render("["+truncateLine(d.Label, 18)+"]") + " "
		labelBadgeW = lipgloss.Width(labelBadge)
	}

	relTime := relativeTime(d.Updated)
	timeRendered := m.Styles.Time.Render(relTime)
	timeW := 0
	if relTime != "" {
		timeW = lipgloss.Width(timeRendered) + 1
	}

	titleMaxW := max(1, contentW-timeW-domainBadgeW-labelBadgeW)
	titleRendered := renderTitle(ts, strings.Join(strings.Fields(d.Title), " "), titleMaxW)
	titleLine := labelBadge + domainBadge + rightPad(titleRendered, contentW-timeW-domainBadgeW-labelBadgeW) +
		strings.Repeat(" ", max(0, timeW-lipgloss.Width(timeRendered))) + timeRendered

	var sb strings.Builder
	sb.WriteString(titleLine)
	sb.WriteString("\n")
	sb.WriteString(renderURL(m.Styles, d.URL, d.Domain, contentW))
	if d.Text != "" && sel {
		snippet := truncateLine(strings.Join(strings.Fields(d.Text), " "), contentW)
		sb.WriteString("\n")
		sb.WriteString(m.Styles.SecText.Render(snippet))
	}
	if sel {
		return selectedResultStyle(m).Render(sb.String())
	}
	return m.Styles.Item.Render(sb.String())
}

// renderTitle reapplies the title style after each search-highlight reset.
// The server's TUI highlighter wraps matches in its own SGR style, whose reset
// would otherwise also cancel the surrounding selected-title color.
func renderTitle(style lipgloss.Style, title string, maxW int) string {
	title = truncateLine(title, maxW)
	// Lip Gloss emits ESC[m, while accepting ESC[0m from other SGR producers
	// costs little and keeps the style boundary well-defined.
	title = strings.ReplaceAll(title, "\x1b[0m", ansi.ResetStyle)
	parts := strings.Split(title, ansi.ResetStyle)
	var rendered strings.Builder
	for _, part := range parts {
		if part != "" {
			rendered.WriteString(style.Render(part))
		}
	}
	return rendered.String()
}

func Scrollbar(m *model.Model) string {
	pct := m.Viewport.ScrollPercent()
	thumbPos := int(pct * float64(m.Viewport.Height()-1))

	thumbChar := m.Styles.Thumb.Render("█")
	trackChar := m.Styles.Track.Render("│")

	var sb strings.Builder
	for i := 0; i < m.Viewport.Height(); i++ {
		if i == thumbPos {
			sb.WriteString(thumbChar)
		} else {
			sb.WriteString(trackChar)
		}
		if i < m.Viewport.Height()-1 {
			sb.WriteString("\n")
		}
	}
	return sb.String()
}

```

### Core Architecture Module: `cmd/tui/render/tabs.go`
```
// SPDX-FileContributor: 4evy <git@evy.pink>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"strings"

	"github.com/asciimoo/hister/cmd/tui/model"

	"charm.land/lipgloss/v2"
)

func HistoryTab(m *model.Model) string {
	m.WorkspaceTargets = nil
	m.WorkspaceSelectionY = 0
	if m.HistoryLoading {
		return m.Styles.Gray.Render("  " + m.Spinner.View() + " loading…")
	}
	if len(m.HistoryItems) == 0 {
		return workspaceEmptyState(m, "No history yet", "Open a search result and it will appear here.")
	}
	contentW := max(1, m.Width-5)
	var lines []string
	lines = append(lines, "")
	for i, h := range m.HistoryItems {
		queryPart := ""
		if h.Query != "" {
			queryPart = m.Styles.Gray.Render(" [" + truncateLine(h.Query, 20) + "]")
		}
		title := truncateLine(h.Title, contentW-lipgloss.Width(queryPart))
		if title == "" {
			title = truncateLine(h.URL, contentW)
		}
		var row string
		if i == m.HistoryIdx {
			row = m.Styles.SelTitle.Render(title) + queryPart
			row = m.Styles.SelectedItem.Render(row + "\n" + renderURL(m.Styles, h.URL, "", contentW))
		} else {
			row = m.Styles.Title.Render(title) + queryPart
			row = m.Styles.Item.Render(row + "\n" + renderURL(m.Styles, h.URL, "", contentW))
		}
		y := lipgloss.Height(strings.Join(lines, "\n\n")) + 1
		m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
			Y: y, Height: lipgloss.Height(row), Kind: model.WorkspaceHistoryItem, Index: i,
		})
		if i == m.HistoryIdx {
			m.WorkspaceSelectionY = y
		}
		lines = append(lines, row)
	}
	return strings.Join(lines, "\n\n")
}

func RulesTab(m *model.Model) string {
	m.WorkspaceTargets = nil
	m.WorkspaceSelectionY = 0
	if m.RulesLoading {
		return m.Styles.Gray.Render("  " + m.Spinner.View() + " loading…")
	}
	lines := []string{""}
	aliasItems := make([]string, 0, len(m.RulesData.Aliases))
	for _, key := range m.SortedAliasKeys() {
		aliasItems = append(aliasItems, key+" → "+m.RulesData.Aliases[key])
	}
	for _, section := range model.RulesSections {
		items := aliasItems
		if patterns := m.RulesPatterns(section.ID); patterns != nil {
			items = *patterns
		}
		headerStyle := m.Styles.Title
		if section.ID == m.RulesSection && m.RulesFormFocus == model.RulesFocusList {
			headerStyle = m.Styles.SelTitle
		}
		lines = append(lines, headerStyle.Render("  "+section.Title))

		var form string
		if section.Aliases {
			kwStyle := m.Styles.Gray
			valStyle := m.Styles.Gray
			if m.RulesSection == section.ID && m.RulesFormFocus == model.RulesFocusAliasKey {
				kwStyle = m.Styles.SelTitle
			}
			if m.RulesSection == section.ID && m.RulesFormFocus == model.RulesFocusAliasValue {
				valStyle = m.Styles.SelTitle
			}
			btnLabel := " + Add "
			if m.RulesEditingIdx >= 0 && m.RulesEditingSection == section.ID {
				btnLabel = " Save "
			}
			form = "  " + kwStyle.Render("Keyword:") + " " + m.RulesAliasKeyInput.View() + "  " + valStyle.Render("Value:") + " " + m.RulesAliasValInput.View() + "  " + m.Styles.CancelBtn.Render(btnLabel)
		} else {
			inputStyle := m.Styles.Gray
			if m.RulesSection == section.ID && m.RulesFormFocus == model.RulesFocusPattern {
				inputStyle = m.Styles.SelTitle
			}
			btnLabel := " + Add "
			if m.RulesEditingIdx >= 0 && m.RulesEditingSection == section.ID {
				btnLabel = " Save "
			}
			form = "  " + inputStyle.Render("Pattern:") + " " + m.RulesPatternInputs[section.ID].View() + "  " + m.Styles.CancelBtn.Render(btnLabel)
		}
		formY := lipgloss.Height(strings.Join(lines, "\n"))
		m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
			Y: formY, Height: lipgloss.Height(form), Kind: model.WorkspaceRulesForm, Section: section.ID,
		})
		if section.ID == m.RulesSection && m.RulesFormFocus != model.RulesFocusList {
			m.WorkspaceSelectionY = formY
		}
		lines = append(lines, form)

		if len(items) == 0 {
			if section.ID == m.RulesSection && m.RulesFormFocus == model.RulesFocusList {
				m.WorkspaceSelectionY = formY
			}
			lines = append(lines, m.Styles.Gray.Render("    No entries yet — use the form above to add one."))
		}
		for i, item := range items {
			var row string
			if section.ID == m.RulesSection && i == m.RulesIdx && m.RulesFormFocus == model.RulesFocusList {
				row = m.Styles.SelectedItem.Render("  ▸ " + item)
			} else {
				row = m.Styles.Item.Render("    " + item)
			}
			y := lipgloss.Height(strings.Join(lines, "\n"))
			m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
				Y: y, Height: lipgloss.Height(row), Kind: model.WorkspaceRulesItem, Section: section.ID, Index: i,
			})
			if section.ID == m.RulesSection && i == m.RulesIdx && m.RulesFormFocus == model.RulesFocusList {
				m.WorkspaceSelectionY = y
			}
			lines = append(lines, row)
		}
		lines = append(lines, "")
	}
	return strings.Join(lines, "\n")
}

func AddTab(m *model.Model) string {
	m.WorkspaceTargets = nil
	m.WorkspaceSelectionY = 0
	lines := []string{"", m.Styles.Title.Render("  Add Document"), ""}
	for i, label := range []string{"URL", "Title"} {
		style := m.Styles.Gray
		if i == m.AddFocusIdx {
			style = m.Styles.SelTitle
		}
		y := lipgloss.Height(strings.Join(lines, "\n"))
		labelView := "  " + style.Render(label+":")
		inputView := "    " + m.AddInputs[i].View()
		m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
			Y: y, Height: lipgloss.Height(labelView) + lipgloss.Height(inputView), Kind: model.WorkspaceAddField, Index: i,
		})
		if i == m.AddFocusIdx {
			m.WorkspaceSelectionY = y
		}
		lines = append(lines, labelView, inputView)
		lines = append(lines, "")
	}
	textStyle := m.Styles.Gray
	if m.AddFocusIdx == 2 {
		textStyle = m.Styles.SelTitle
	}
	textY := lipgloss.Height(strings.Join(lines, "\n"))
	textLabel := "  " + textStyle.Render("Text:")
	textInput := "    " + m.AddText.View()
	m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
		Y: textY, Height: lipgloss.Height(textLabel) + lipgloss.Height(textInput), Kind: model.WorkspaceAddField, Index: 2,
	})
	if m.AddFocusIdx == 2 {
		m.WorkspaceSelectionY = textY
	}
	lines = append(lines, textLabel, textInput)
	lines = append(lines, "")
	submitStyle := m.Styles.CancelBtn
	if m.AddFocusIdx == 3 {
		submitStyle = m.Styles.CancelBtnSel
	}
	submitY := lipgloss.Height(strings.Join(lines, "\n"))
	submit := "  " + submitStyle.Render(" Submit ")
	m.WorkspaceTargets = append(m.WorkspaceTargets, model.WorkspaceTarget{
		Y: submitY, Height: lipgloss.Height(submit), Kind: model.WorkspaceAddSubmit, Index: model.AddSubmitFieldIdx,
	})
	if m.AddFocusIdx == model.AddSubmitFieldIdx {
		m.WorkspaceSelectionY = submitY
	}
	lines = append(lines, submit)
	if m.AddStatus != "" {
		lines = append(lines, "")
		lines = append(lines, "  "+renderStatusMessage(m, m.AddStatus, m.AddStatusKind))
	}
	return strings.Join(lines, "\n")
}

func workspaceEmptyState(m *model.Model, title, detail string) string {
	return strings.Join([]string{
		"",
		"  " + m.Styles.HelpHeader.Render(title),
		"  " + m.Styles.Gray.Render(detail),
	}, "\n")
}

```

### Core Architecture Module: `cmd/tui/render/util.go`
```
// SPDX-FileContributor: 4evy <git@evy.pink>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package render

import (
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/asciimoo/hister/cmd/tui/component"
	"github.com/asciimoo/hister/cmd/tui/theme"
)

// pads s with spaces on the right to reach exactly width display columns
func rightPad(s string, width int) string {
	pad := max(0, width-lipgloss.Width(s))
	return s + strings.Repeat(" ", pad)
}

// returns a compact human-readable age string for a unix timestamp
func relativeTime(unixTs int64) string {
	if unixTs == 0 {
		return ""
	}
	d := time.Since(time.Unix(unixTs, 0))
	switch {
	case d < time.Minute:
		return "now"
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	case d < 7*24*time.Hour:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	case d < 30*24*time.Hour:
		return fmt.Sprintf("%dw", int(d.Hours()/(24*7)))
	case d < 365*24*time.Hour:
		return fmt.Sprintf("%dmo", int(d.Hours()/(24*30)))
	default:
		return fmt.Sprintf("%dy", int(d.Hours()/(24*365)))
	}
}

// truncates s to maxW terminal cells without splitting ANSI sequences or
// grapheme clusters, appending "…" if it was cut.
func truncateLine(s string, maxW int) string {
	if maxW <= 0 {
		return ""
	}
	return ansi.Truncate(s, maxW, "…")
}

// renders a URL as "host · /path" where the path is dimmed
func renderURL(st theme.Styles, rawURL, domain string, maxW int) string {
	var host, path string
	u, err := url.Parse(rawURL)
	if err != nil || (u.Host == "" && domain == "") {
		return st.URL.Render(truncateLine(rawURL, maxW))
	}
	if domain != "" {
		host = strings.TrimPrefix(domain, "www.")
	} else {
		host = strings.TrimPrefix(u.Host, "www.")
	}
	if u != nil {
		path = u.Path
		if path == "/" {
			path = ""
		}
		if u.RawQuery != "" {
			path += "?" + u.RawQuery
		}
	}

	hs := st.URL
	if isLocalHost(host) {
		hs = st.URLLocal
	}
	hostPart := hs.Render(host)
	hostW := lipgloss.Width(hostPart)

	if path == "" || hostW >= maxW {
		return hs.Render(truncateLine(host, maxW))
	}

	const sepStr = " · "
	pathMaxW := max(0, maxW-hostW-lipgloss.Width(sepStr))
	return hostPart + st.URLPath.Render(sepStr) + st.URLPath.Render(truncateLine(path, pathMaxW))
}

func isLocalHost(host string) bool {
	h := host
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		h = parsed
	}
	h = strings.Trim(h, "[]")
	addr, err := netip.ParseAddr(h)
	return strings.EqualFold(h, "localhost") || err == nil && addr.IsLoopback()
}

// renders a subtle full-width rule.
func sectionDivider(st theme.Styles, width int) string {
	label := " results "
	ruleW := max(0, width-lipgloss.Width(label)-2)
	return st.Section.Render("  " + label + strings.Repeat("─", ruleW))
}

// returns the first maxCols visible columns of s, preserving ANSI
func truncateAnsi(s string, maxCols int) string {
	if maxCols <= 0 {
		return ""
	}
	truncated := ansi.Truncate(s, maxCols, "")
	return truncated + strings.Repeat(" ", max(0, maxCols-ansi.StringWidth(truncated)))
}

// sanitizeTerminalText removes styling and terminal control sequences from
// untrusted document metadata/content before it enters the renderer. Tabs are
// expanded so they cannot move the cursor outside the layout's cell model.
func sanitizeTerminalText(s string) string {
	s = strings.ReplaceAll(ansi.Strip(s), "\t", "    ")
	return strings.Map(func(r rune) rune {
		if r == '\n' {
			return r
		}
		if r < 0x20 || (r >= 0x7f && r <= 0x9f) {
			return -1
		}
		return r
	}, s)
}

func sanitizeTerminalLine(s string) string {
	return strings.Join(strings.Fields(sanitizeTerminalText(s)), " ")
}

func FormatKey(k string) string {
	return component.FormatKey(k)
}

```

### Core Architecture Module: `server/extractor/textutil/textutil.go`
```
// Package textutil provides shared helpers for flattening HTML to plain text
// while keeping the block structure of the original markup.
package textutil

import (
	"strings"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

// textBlockElements are the elements whose boundaries become line breaks when
// markup is flattened to text.
var textBlockElements = map[string]bool{
	"address": true, "article": true, "blockquote": true, "dd": true, "div": true,
	"dl": true, "dt": true, "figcaption": true, "figure": true, "footer": true,
	"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true,
	"header": true, "li": true, "main": true, "ol": true, "p": true, "pre": true,
	"section": true, "table": true, "td": true, "th": true, "tr": true, "ul": true,
}

// SelectionText flattens a selection to plain text. Unlike goquery's Text(),
// which concatenates text nodes with no separator and therefore runs the
// paragraphs of multi-paragraph content together, block elements and <br>
// become line breaks so the shape of the original content survives.
func SelectionText(selection *goquery.Selection) string {
	if selection == nil || selection.Length() == 0 {
		return ""
	}
	var b strings.Builder
	for _, node := range selection.Nodes {
		writeNodeText(&b, node)
	}
	return normalizeText(b.String())
}

func writeNodeText(b *strings.Builder, node *html.Node) {
	if node.Type == html.TextNode {
		b.WriteString(node.Data)
		return
	}
	if node.Type == html.ElementNode {
		name := strings.ToLower(node.Data)
		if name == "script" || name == "style" || name == "svg" || name == "button" {
			return
		}
		if name == "br" {
			writeTextBreak(b)
			return
		}
		if textBlockElements[name] {
			writeTextBreak(b)
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			writeNodeText(b, child)
		}
		if textBlockElements[name] {
			writeTextBreak(b)
		}
		return
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		writeNodeText(b, child)
	}
}

func writeTextBreak(b *strings.Builder) {
	if b.Len() > 0 && !strings.HasSuffix(b.String(), "\n") {
		b.WriteByte('\n')
	}
}

// normalizeText collapses runs of whitespace within lines and runs of blank
// lines down to one, and trims the result.
func normalizeText(text string) string {
	text = strings.ReplaceAll(text, "\u00a0", " ")
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	lines := strings.Split(text, "\n")
	cleaned := make([]string, 0, len(lines))
	blank := false
	for _, line := range lines {
		line = strings.Join(strings.Fields(line), " ")
		if line == "" {
			if len(cleaned) > 0 && !blank {
				cleaned = append(cleaned, "")
				blank = true
			}
			continue
		}
		cleaned = append(cleaned, line)
		blank = false
	}
	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

```

### Core Architecture Module: `server/extractor/urlutil/urlutil.go`
```
// Package urlutil provides shared URL helpers for extractors.
package urlutil

import (
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// ResolveURL resolves ref against base. Returns ref unchanged if it is already
// absolute, a fragment, or a data URI. Protocol-relative URLs (//host/...)
// are resolved using the base scheme.
func ResolveURL(base *url.URL, ref string) string {
	if ref == "" || strings.HasPrefix(ref, "#") || strings.HasPrefix(ref, "data:") {
		return ref
	}
	// Handle protocol-relative URLs (//upload.wikimedia.org/...)
	if strings.HasPrefix(ref, "//") {
		return base.Scheme + ":" + ref
	}
	u, err := url.Parse(ref)
	if err != nil || u.IsAbs() {
		return ref
	}
	return base.ResolveReference(u).String()
}

// RewriteURLs rewrites relative href, src, and srcset attributes to absolute
// URLs using base. No-op if base is nil.
func RewriteURLs(s *goquery.Selection, base *url.URL) {
	if base == nil {
		return
	}
	for _, attr := range []string{"href", "src", "srcset"} {
		s.Find("[" + attr + "]").Each(func(_ int, el *goquery.Selection) {
			if v, ok := el.Attr(attr); ok {
				if attr == "srcset" {
					v = ResolveSrcset(base, v)
				} else {
					v = ResolveURL(base, v)
				}
				el.SetAttr(attr, v)
			}
		})
	}
}

// ResolveSrcset rewrites each URL in a srcset attribute value against base.
func ResolveSrcset(base *url.URL, srcset string) string {
	var parts []string
	for entry := range strings.SplitSeq(srcset, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		fields := strings.Fields(entry)
		if len(fields) >= 1 {
			fields[0] = ResolveURL(base, fields[0])
		}
		parts = append(parts, strings.Join(fields, " "))
	}
	return strings.Join(parts, ", ")
}

```

### Core Architecture Module: `server/indexer/embedding_queue.go`
```
// SPDX-FileContributor: Adam Tauber <asciimoo@gmail.com>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

package indexer

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/asciimoo/hister/server/model"

	"github.com/rs/zerolog/log"
)

const (
	embeddingQueuePollInterval = time.Second
	embeddingRetryMaxDelay     = time.Minute
	embeddingMaxJobAttempts    = 5
	defaultEmbeddingWorkers    = 2
)

type activeEmbedding struct {
	cancel context.CancelFunc
	done   chan struct{}
}

// embeddingQueue runs a fixed number of workers over a durable SQL work set.
// The jobs channel is intentionally unbuffered so only active documents are
// loaded from the index and retained in memory.
type embeddingQueue struct {
	idx       *Indexer
	ctx       context.Context
	cancel    context.CancelFunc
	jobs      chan *model.EmbeddingJob
	wake      chan struct{}
	wg        sync.WaitGroup
	closeOnce sync.Once
	activeMu  sync.Mutex
	active    map[string]*activeEmbedding
}

func normalizeEmbeddingWorkerCount(configured int) int {
	if configured > 0 {
		return configured
	}
	return defaultEmbeddingWorkers
}

func newEmbeddingQueue(idx *Indexer, workers int) (*embeddingQueue, error) {
	if err := model.ResetInProgressEmbeddingJobs(); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(idx.embedCtx)
	q := &embeddingQueue{
		idx:    idx,
		ctx:    ctx,
		cancel: cancel,
		jobs:   make(chan *model.EmbeddingJob),
		wake:   make(chan struct{}, 1),
		active: make(map[string]*activeEmbedding),
	}
	q.wg.Go(q.dispatch)
	for range workers {
		q.wg.Go(q.work)
	}
	q.notify()
	return q, nil
}

func (i *Indexer) startEmbeddingQueue(workers int) error {
	if i.embeddingQueue != nil {
		return nil
	}
	workers = normalizeEmbeddingWorkerCount(workers)
	q, err := newEmbeddingQueue(i, workers)
	if err != nil {
		return err
	}
	i.embeddingWorkers = workers
	i.embeddingQueue = q
	return nil
}

func (i *Indexer) stopEmbeddingQueue() {
	if i.embeddingQueue == nil {
		return
	}
	i.embeddingQueue.Close()
	i.embeddingQueue = nil
}

func (i *Indexer) enqueueEmbedding(docID string) error {
	if i.embeddingQueue != nil {
		return i.embeddingQueue.Enqueue(docID)
	}
	return model.EnqueueEmbeddingJob(docID)
}

func (i *Indexer) cancelEmbedding(docID string) error {
	if i.embeddingQueue != nil {
		return i.embeddingQueue.Cancel(docID)
	}
	if model.DB == nil {
		return nil
	}
	return model.DeleteEmbeddingJob(docID)
}

func (q *embeddingQueue) notify() {
	select {
	case q.wake <- struct{}{}:
	default:
	}
}

func (q *embeddingQueue) waitForWork(delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-q.ctx.Done():
		return false
	case <-q.wake:
		return true
	case <-timer.C:
		return true
	}
}

func (q *embeddingQueue) dispatch() {
	defer close(q.jobs)
	for {
		job, err := model.ClaimNextEmbeddingJob()
		if err != nil {
			log.Error().Err(err).Msg("failed to claim embedding job")
			if !q.waitForWork(embeddingQueuePollInterval) {
				return
			}
			continue
		}
		if job == nil {
			if !q.waitForWork(embeddingQueuePollInterval) {
				return
			}
			continue
		}
		select {
		case q.jobs <- job:
		case <-q.ctx.Done():
			if err := model.ReleaseEmbeddingJob(job.DocID); err != nil {
				log.Warn().Err(err).Str("id", job.DocID).Msg("failed to release embedding job")
			}
			return
		}
	}
}

func (q *embeddingQueue) work() {
	for job := range q.jobs {
		q.process(job)
	}
}

func (q *embeddingQueue) begin(docID string) (context.Context, *activeEmbedding) {
	ctx, cancel := context.WithCancel(q.ctx)
	active := &activeEmbedding{cancel: cancel, done: make(chan struct{})}
	q.activeMu.Lock()
	q.active[docID] = active
	q.activeMu.Unlock()
	return ctx, active
}

func (q *embeddingQueue) finish(docID string, active *activeEmbedding) {
	active.cancel()
	q.activeMu.Lock()
	if q.active[docID] == active {
		delete(q.active, docID)
	}
	close(active.done)
	q.activeMu.Unlock()
}

func (q *embeddingQueue) process(job *model.EmbeddingJob) {
	ctx, active := q.begin(job.DocID)
	defer q.finish(job.DocID, active)

	owned, err := model.EmbeddingJobInProgressExists(job.DocID)
	if err != nil {
		log.Warn().Err(err).Str("id", job.DocID).Msg("failed to verify embedding job")
		q.retry(job, err)
		return
	}
	if !owned {
		return
	}

	d := q.idx.getByDocID(job.DocID, resultIncludeText)
	if d == nil {
		retry, err := model.CompleteEmbeddingJob(job.DocID)
		if err != nil {
			log.Warn().Err(err).Str("id", job.DocID).Msg("failed to discard missing embedding document")
		} else if retry {
			q.notify()
		}
		return
	}

	err = embedDocumentChunks(ctx, q.idx, d)
	if err == nil {
		retry, completeErr := model.CompleteEmbeddingJob(job.DocID)
		if completeErr != nil {
			log.Warn().Err(completeErr).Str("id", job.DocID).Msg("failed to complete embedding job")
			q.retry(job, completeErr)
			return
		}
		if retry {
			q.notify()
		}
		return
	}
	if errors.Is(err, context.Canceled) {
		if releaseErr := model.ReleaseEmbeddingJob(job.DocID); releaseErr != nil {
			log.Warn().Err(releaseErr).Str("id", job.DocID).Msg("failed to release canceled embedding job")
		}
		q.notify()
		return
	}
	q.retry(job, err)
}

func embeddingRetryDelay(attempt uint) time.Duration {
	if attempt == 0 {
		attempt = 1
	}
	delay := time.Second
	for range attempt - 1 {
		if delay >= embeddingRetryMaxDelay/2 {
			return embeddingRetryMaxDelay
		}
		delay *= 2
	}
	return min(delay, embeddingRetryMaxDelay)
}

func (q *embeddingQueue) retry(job *model.EmbeddingJob, jobErr error) {
	if job.Attempts >= embeddingMaxJobAttempts {
		retry, err := model.FailEmbeddingJob(job.DocID, jobErr.Error())
		if err != nil {
			log.Warn().Err(err).Str("id", job.DocID).Msg("failed to quarantine embedding job")
			return
		}
		if retry {
			q.notify()
			return
		}
		log.Error().Err(jobErr).Str("id", job.DocID).Uint("attempts", job.Attempts).Msg("embedding job quarantined")
		return
	}
	retryAt := time.Now().Add(embeddingRetryDelay(job.Attempts))
	if err := model.RetryEmbeddingJob(job.DocID, retryAt, jobErr.Error()); err != nil {
		log.Warn().Err(err).Str("id", job.DocID).Msg("failed to retry embedding job")
		return
	}
	q.notify()
}

func (q *embeddingQueue) Enqueue(docID string) error {
	if err := model.EnqueueEmbeddingJob(docID); err != nil {
		return err
	}
	q.notify()
	return nil
}

// Cancel removes queued work, interrupts an active request, and waits until the
// active worker can no longer write vectors for the document.
func (q *embeddingQueue) Cancel(docID string) error {
	err := model.DeleteEmbeddingJob(docID)
	q.activeMu.Lock()
	active := q.active[docID]
	if active != nil {
		active.cancel()
	}
	q.activeMu.Unlock()
	if active != nil {
		<-active.done
	}
	return err
}

func (q *embeddingQueue) Close() {
	q.closeOnce.Do(func() {
		q.cancel()
		q.wg.Wait()
	})
}

```

### Core Architecture Module: `webui/app/src/lib/result-state.svelte.ts`
```
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiFetch, getUserId } from './api';
import { deleteDocuments, previewDocumentDeletion } from './document-delete';
import { fetchRules, saveRuleLists } from './rules';
import { buildUrlSkipPattern, buildDomainSkipPattern } from '@hister/components';

interface AddSkipRuleOptions {
  url: string;
  domain: string;
  type: 'url' | 'domain';
  deleteMatches: boolean;
  removeResult: (url: string) => void;
  removeResultsByDomain: (domain: string) => void;
  confirmDeletion: (matched: number) => Promise<boolean>;
}

async function saveSkipRule(pattern: string): Promise<void> {
  const rules = await fetchRules();
  if (rules.skip.includes(pattern)) return;
  await saveRuleLists({ ...rules, skip: [...rules.skip, pattern] });
}

function skipRuleDeleteQuery(url: string, domain: string, type: 'url' | 'domain'): string {
  const uid = getUserId();
  const userFilter = uid === undefined ? '' : ` user_id:${uid}`;
  return type === 'url'
    ? `url:"${url.replaceAll('"', '\\"')}"${userFilter}`
    : `domain:${domain}${userFilter}`;
}

async function deleteSkipRuleDocuments(
  query: string,
  confirmDeletion: (matched: number) => Promise<boolean>,
  onDeleted: () => void,
): Promise<string> {
  const matched = await previewDocumentDeletion(query);
  if (matched === 0) return 'Skip rule added. No matching documents found.';
  if (!(await confirmDeletion(matched))) {
    return 'Skip rule added. Matching documents were not deleted.';
  }
  const deleted = await deleteDocuments(query);
  onDeleted();
  return `Skip rule added. ${deleted} matching document${deleted === 1 ? '' : 's'} deleted.`;
}

export class ResultState {
  labelInput = $state('');
  labelMessage = $state<string | null>(null);
  labelError = $state(false);
  displayLabel = $state<string | undefined>(undefined);

  actionsQuery = $state('');
  actionsMessage = $state<string | null>(null);
  actionsError = $state(false);

  constructor(initialLabel?: string) {
    this.displayLabel = initialLabel || undefined;
    this.labelInput = initialLabel ?? '';
  }

  onOpen() {
    this.actionsMessage = null;
    this.actionsError = false;
    this.labelMessage = null;
    this.labelError = false;
  }

  async updateLabel(url: string) {
    this.labelMessage = null;
    this.labelError = false;
    const label = this.labelInput;
    try {
      const res = await apiFetch('/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, label }),
      });
      if (!res.ok) throw new Error('Failed to save label');
      this.displayLabel = label || undefined;
      this.labelMessage = label ? 'Label saved.' : 'Label cleared.';
    } catch {
      this.labelMessage = 'Failed to save label.';
      this.labelError = true;
    }
  }

  async pin(url: string, title: string, currentQuery: string, remove = false) {
    const q = this.actionsQuery || currentQuery;
    if (!q) return;
    const cleanTitle = title.replace(/<[^>]*>/g, '');
    try {
      const res = await apiFetch('/history', {
        method: 'POST',
        headers: { 'Content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ url, title: cleanTitle, query: q, pin: !remove }),
      });
      if (!res.ok) throw new Error('Failed to update priority');
      this.actionsMessage = `Priority result ${remove ? 'removed' : 'added'}.`;
      this.actionsError = false;
    } catch {
      this.actionsMessage = 'Failed to update priority.';
      this.actionsError = true;
    }
  }

  async forgetForQuery(url: string, query: string): Promise<boolean> {
    if (!query) return false;
    try {
      const res = await apiFetch('/history', {
        method: 'POST',
        headers: { 'Content-type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ url, query, delete: true }),
      });
      if (!res.ok) throw new Error('Failed to forget result for query');
      this.actionsMessage = 'Result forgotten for this query.';
      this.actionsError = false;
      return true;
    } catch {
      this.actionsMessage = 'Failed to forget result for this query.';
      this.actionsError = true;
      return false;
    }
  }

  async addSkipRule(options: AddSkipRuleOptions) {
    const {
      url,
      domain,
      type,
      deleteMatches,
      removeResult,
      removeResultsByDomain,
      confirmDeletion,
    } = options;
    this.actionsMessage = null;
    this.actionsError = false;
    const pattern = type === 'url' ? buildUrlSkipPattern(url) : buildDomainSkipPattern(url);
    try {
      await saveSkipRule(pattern);
    } catch {
      this.actionsMessage = 'Failed to add skip rule.';
      this.actionsError = true;
      return;
    }
    if (!deleteMatches) {
      this.actionsMessage = 'Skip rule added.';
      return;
    }
    try {
      const removeMatches =
        type === 'url' ? () => removeResult(url) : () => removeResultsByDomain(domain);
      this.actionsMessage = await deleteSkipRuleDocuments(
        skipRuleDeleteQuery(url, domain, type),
        confirmDeletion,
        removeMatches,
      );
    } catch {
      this.actionsMessage = 'Skip rule added, but matching documents could not be deleted.';
      this.actionsError = true;
    }
  }
}

```

### Core Architecture Module: `webui/components/src/lib/utils.ts`
```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

```

### Core Architecture Module: `client/client.go`
```
package client

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// targetUserIDHeader is sent by admin CLI callers to request a specific user_id
// for indexed documents. The server only honours it for admin users in
// multiuser mode.
const targetUserIDHeader = "X-Hister-Target-User-ID"

type Client struct {
	baseURL        string
	httpClient     *http.Client
	userAgent      string
	accessToken    string
	targetUserID   *uint
	allowSensitive bool
	ignoreRules    bool
	batchLimitOnce sync.Once
	batchBodyBytes int64
}

type HTTPError struct {
	StatusCode int
	Detail     string
	Message    string
}

func (e *HTTPError) Error() string {
	return e.Message
}

// HTTPStatusCode returns the response status associated with the error.
func (e *HTTPError) HTTPStatusCode() int {
	return e.StatusCode
}

type Option func(*Client)

func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) { c.httpClient = hc }
}

func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.httpClient.Timeout = d }
}

func WithUserAgent(ua string) Option {
	return func(c *Client) { c.userAgent = ua }
}

func WithAccessToken(token string) Option {
	return func(c *Client) { c.accessToken = token }
}

func WithAllowSensitive() Option {
	return func(c *Client) { c.allowSensitive = true }
}

// WithIgnoreRules marks submitted documents as explicitly saved, bypassing URL
// indexing rules on submission and on subsequent index rebuilds.
func WithIgnoreRules() Option {
	return func(c *Client) { c.ignoreRules = true }
}

// WithMaxBatchBodyBytes overrides batch capability discovery. It is primarily
// useful for clients that already obtained the server limit out of band.
func WithMaxBatchBodyBytes(limit int64) Option {
	return func(c *Client) {
		if limit > 0 {
			c.batchBodyBytes = limit
		}
	}
}

// WithTargetUserID instructs the server to index submitted documents under the
// given user ID instead of the authenticated caller's ID. The server only
// honours this for admin users in multiuser mode.
func WithTargetUserID(uid uint) Option {
	return func(c *Client) { c.targetUserID = &uid }
}

func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// FetchConfig retrieves capabilities from the server the client is connected
// to. This avoids assuming that local configuration describes a remote server.
func (c *Client) FetchConfig() (_ *ServerConfig, err error) {
	return c.FetchConfigContext(context.Background())
}

func (c *Client) FetchConfigContext(ctx context.Context) (_ *ServerConfig, err error) {
	req, err := c.newRequest(http.MethodGet, "/api/config", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req.WithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer closeBody(resp, &err)
	if err = checkStatus(resp); err != nil {
		return nil, err
	}
	var serverConfig ServerConfig
	if err = json.NewDecoder(resp.Body).Decode(&serverConfig); err != nil {
		return nil, err
	}
	return &serverConfig, nil
}

const legacyMaxBatchBodyBytes int64 = 5 << 20

// MaxBatchBodyBytes returns the server advertised batch request limit. Servers
// that predate capability discovery use the former 5 MiB limit.
func (c *Client) MaxBatchBodyBytes() int64 {
	c.batchLimitOnce.Do(func() {
		if c.batchBodyBytes > 0 {
			return
		}
		c.batchBodyBytes = legacyMaxBatchBodyBytes
		req, err := c.newRequest(http.MethodGet, "/api/config", nil)
		if err != nil {
			return
		}
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
			return
		}
		var capabilities struct {
			MaxBatchBodyBytes int64 `json:"maxBatchBodyBytes"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&capabilities); err == nil && capabilities.MaxBatchBodyBytes > 0 {
			c.batchBodyBytes = capabilities.MaxBatchBodyBytes
		}
	})
	return c.batchBodyBytes
}

func checkStatus(resp *http.Response) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	detail := strings.TrimSpace(string(body))
	errWithStatus := func(msg string) error {
		return &HTTPError{
			StatusCode: resp.StatusCode,
			Detail:     detail,
			Message:    msg,
		}
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		msg := "authentication required: the server requires an access token"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(fmt.Sprintf("%s\nProvide one with --token / -t or set access_token in your config file", msg))
	case http.StatusForbidden:
		msg := "access denied: the token is invalid or does not have permission for this operation"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(fmt.Sprintf("%s\nCheck the token with --token / -t or verify the user's permissions on the server", msg))
	case http.StatusNotFound:
		msg := "resource not found (404)"
		if detail != "" {
			msg += ": " + detail
		}
		return errWithStatus(msg)
	case http.StatusNotAcceptable:
		msg := "page skipped: this URL was rejected by the server (usually due to allow or skip rules)"
		if detail != "" {
			msg += " (" + detail + ")"
		}
		return errWithStatus(msg)
	case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		msg := fmt.Sprintf("server error (%d)", resp.StatusCode)
		if detail != "" {
			msg += ": " + detail
		}
		return errWithStatus(fmt.Sprintf("%s\nCheck the server logs for details", msg))
	default:
		if detail == "" {
			detail = resp.Status
		}
		return errWithStatus(fmt.Sprintf("unexpected response (%d): %s", resp.StatusCode, detail))
	}
}

func closeBody(resp *http.Response, errp *error) {
	if cerr := resp.Body.Close(); cerr != nil && *errp == nil {
		*errp = fmt.Errorf("closing response body: %w", cerr)
	}
}

// builds an http.Request with Origin: hister:// set for CSRF bypass.
func (c *Client) newRequest(method, path string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Origin", "hister://")
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}
	if c.accessToken != "" {
		req.Header.Set("X-Access-Token", c.accessToken)
	}
	if c.targetUserID != nil {
		req.Header.Set(targetUserIDHeader, strconv.FormatUint(uint64(*c.targetUserID), 10))
	}
	return req, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #790** (2026-09-26): **ChatGPT extractor fail: can't see turns**
  *Symptoms*: When trying to index ChatGPT conversations, the Hister server reports: `| ERROR  | server/endpoints.go:818 > failed to create index error="extractor ChatGPT: extractor aborted: no visible user or assistant turns found" URL=...`  Version: 0.20.0
  **Post-Mortem & Fix Analysis**:
  > Hopefully 25dccad fixes the issue. Could you verify it?
  > 25dccadb doesn't appear to cover the variant my session gets. It has no `data-message-author-role`, no `data-turn` and no `conversation-turn-*` test ids and fails with the new error:  ` | ERROR  | server/endpoints.go:818 > failed to create index error="extractor ChatGPT: extractor aborted: no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser" URL=...`  Here's my variant. It's a rendered conversation container from a short throw away chat [search-unit-markup.html](https://github.com/user-attachments/files/32681204/search-unit-markup.html)
  > Thanks. Could you test it again with bafe7d7 ?

- **Issue #784** (2026-09-23): **Embeddings dimension mismatch**
  *Symptoms*: When using semantic search with qwen3-embedding-8b and default auto-generated config settings in Hister 0.19.0, I kept getting the error:  `vector store write failed error="insert embedding: Dimension mismatch for inserted vector for the \"embedding\" column. Expected 2000 dimensions but received 4096."`  I thought this would be as simple to resolve as changing semantic_search.dimensions in config.yml from 2000 to 4096, but now I get:  `vector store write failed error="insert embedding: Dimension mismatch for inserted vector for the \"embedding\" column. Expected 768 dimensions but received 4096."`  I have no idea why it is now expecting 768 dimensions. This number appears nowhere in the config file.
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Hopefully 960bf020 fixes it.

- **Issue #771** (2026-09-21): **Lobste.rs extractor/view shows duplicate comments**
  *Symptoms*: The nested comments in lobste.rs thread appear as duplicate top-level comments for me.  For instance if the thread is structured like  ``` A | B C ```  it will show as  ``` A | B B C ```  hister version v0.19.0 (118a73a) 
  **Post-Mortem & Fix Analysis**:
  > awesome!

- **Issue #753** (2026-09-14): **Mastodon extractor URL rewriting is broken**
  *Symptoms*: Have a look at [this post](https://hachyderm.io/@peteorrall@bsd.cafe/117269611598821921) as an example. The URL is `https://hachyderm.io/@peteorrall@bsd.cafe/117269611598821921`. It gets rewritten to `https://bsd.cafe/@peteorrall/117269611598821921`, which gives back a 404.  The actual URL (which can be discovered using the "Open original page" in the UI) on the original instance is `https://mastodon.bsd.cafe/@peteorrall/117269611556537474`. The key issue is that the extractor assumes that post IDs are global but in fact they are local to each instance.

- **Issue #746** (2026-09-12): **Importing a file without an extension causes problems**
  *Symptoms*: Hello, I'm migrating Hister from Docker to an LXC environment for easier maintenance. I exported my data using the command: hister export file backup  But when I import it to the new platform, Hister returns an error 426 (I think). I renamed the file to .json, and Hister no longer returns an error during import. It would be a good idea to add a safety measure by suggesting that users include the .json extension in the command, or to require a .json extension when creating the file.

- **Issue #697** (2026-08-30): **"hister reindex" failed with Internal Server Error (500)**
  *Symptoms*: `hister reindex` returns `Error! Reindex error: server error (500): Internal Server Error` and the reindex operation does not complete when the markdown file has specific content.  hister reindex: ``` PS > .\hister_0.18.0_windows_amd64.exe reindex Error! Reindex error: server error (500): Internal Server Error Check the server logs for details ```  Logs: ```log 2026-08-30T17:27:47+09:00 | WARN   | extractor/extractor.go:238 > Failed to extract content error="the Node field is nil" Extractor=Readability URL=file:///P:/OneDrive/vscnotes/notes/test-h1-only.md 2026-08-30T17:27:47+09:00 | ERROR  | server/endpoints.go:1846 > reindex failed error="file URL is not allowed: submitted content is required" ```  The content of `test-h1-only.md` when reindex operation failed (only one line): ```md # test test test test test ```  Reindex operation succeeded with the following content (only one line): ```md # test test test test ```  <img width="2148" height="920" alt="Image" src="https://github.com/user-attachments/assets/e9941acb-80e2-4c96-b0a6-93e1c0495feb" /> 
  **Post-Mortem & Fix Analysis**:
  > This is a crazy bug. Unfortunately the root cause isn't as funny as the way you found to reproduce it. Local files accidentally go through a different processing chain when running `reindex` and that causes the bug.  Fix is coming soon, thank you for reporting it.

- **Issue #682** (2026-08-27): **Prevent pgvector from using more than 2000 dimensions**
  *Symptoms*: pgvector only supports 2000 dimensions according to their readme, so that error should probably be catched early on when postgres is used.  ``` | INFO   | vectorstore/postgres.go:37 > pgvector extension enabled | WARN   | indexer/indexer.go:337 > failed to init vector store, semantic search disabled error="create HNSW index: ERROR: column cannot have more than 2000 dimensions for hnsw index (SQLSTATE 54000)" | INFO   | server/server.go:193 > Starting webserver Address=127.0.0.1:8114 URL=https://hister.lan/ Version=v0.17.0 ```
  **Post-Mortem & Fix Analysis**:
  > To recover from that I needed to drop one table. Not a problem, I am just setting hister up.  ``` DROP TABLE embeddings; ```
  > ~Hmm, this might be one of the reasons for #684 since I was using `qwen/qwen3-embedding-4b` which outputs 2560 dimensions.~ Never mind, I completely missed that you wrote pgvector here. I'm using the default sqlite-vector.

- **Issue #650** (2026-08-28): **Chats from ChatGPT being not consistently imported**
  *Symptoms*: I noticed that the chats from ChatGPT are not consistently imported. And when they are, only one of the messages or only the sidebar that get imported.   Am I the only one experiencing this?
  **Post-Mortem & Fix Analysis**:
  > Unfortunately the generic `readability` extractor cannot always identify the main content on websites. The proper solution would be a ChatGPT extractor. See more about it [here](https://hister.org/docs/developer#extractor-development)
  > @asciimoo would it be ok if I worked on it and send a PR if I'm successful?
  > It would be great, thank you! Check out other extractors for inspiration.

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

### Incident Patch 1: `2ff95bb2` (2026-10-05)
**Commit Message**: [fix] lint

**File**: `server/indexer/querybuilder/filters.go` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ func (q *presenceQuery) Searcher(ctx context.Context, reader index.IndexReader,
 			}
 			present := false
 			doc.VisitFields(func(field index.Field) {
-				if present || (field.Name() != q.Field && !(metadata && strings.HasPrefix(field.Name(), q.Field+"."))) {
+				if present || (field.Name() != q.Field && (!metadata || !strings.HasPrefix(field.Name(), q.Field+"."))) {
 					return
 				}
 				if text, ok := field.(index.TextField); ok {
```

**File**: `server/indexer/querybuilder/filters_test.go` (modified, +5/-1)
```diff
@@ -19,7 +19,11 @@ func TestConvenienceFiltersCannotBeSatisfiedByQueryText(t *testing.T) {
 			if err != nil {
 				t.Fatal(err)
 			}
-			defer idx.Close()
+			t.Cleanup(func() {
+				if err := idx.Close(); err != nil {
+					t.Errorf("Close index: %v", err)
+				}
+			})
 			for id, doc := range map[string]map[string]string{
 				"selected": {"title": "needle", "domain": "example.com", "label": "research"},
 				"literal":  {"title": input, "domain": "other.test", "label": ""},
```

---

### Incident Patch 2: `14dc26c9` (2026-10-05)
**Commit Message**: Merge pull request #806 from kevin9327/fix/negated-only-query

[fix] return results for a query made only of negated terms

**File**: `server/indexer/indexer_test.go` (modified, +45/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"fmt"
 	"net/http"
 	"net/http/httptest"
+	"slices"
 	"strings"
 	"sync"
 	"testing"
@@ -233,6 +234,50 @@ func TestSearchURLRegexpUsesGoMatchSemantics(t *testing.T) {
 	}
 }
 
+func TestSearchOnlyNegatedTerms(t *testing.T) {
+	idx := newTestIndexer(t, testutil.Config(t))
+	defer idx.Close()
+
+	documents := []*document.Document{
+		{URL: "https://go.dev/doc", Title: "Golang docs", Text: "golang language", Processed: true},
+		{URL: "https://rust-lang.org/", Title: "Rust", Text: "rust language", Processed: true},
+		{URL: "https://python.org/", Title: "Python", Text: "python language", Processed: true},
+	}
+	for _, d := range documents {
+		if err := idx.Add(d); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	tests := []struct {
+		query string
+		want  []string
+	}{
+		// a negated field filter already returned every other document
+		{query: "-title:golang", want: []string{documents[1].URL, documents[2].URL}},
+		{query: "-golang", want: []string{documents[1].URL, documents[2].URL}},
+		{query: `-"golang language"`, want: []string{documents[1].URL, documents[2].URL}},
+		{query: "-golang -python", want: []string{documents[1].URL}},
+		{query: "language -golang", want: []string{documents[1].URL, documents[2].URL}},
+	}
+	for _, test := range tests {
+		result, err := idx.Search(&Query{Text: test.query})
+		if err != nil {
+			t.Fatalf("Search(%q): %v", test.query, err)
+		}
+		got := make([]string, 0, len(result.Documents))
+		for _, d := range result.Documents {
+			got = append(got, d.URL)
+		}
+		slices.Sort(got)
+		want := slices.Clone(test.want)
+		slices.Sort(want)
+		if !slices.Equal(got, want) {
+			t.Errorf("Search(%q) returned %q, want %q", test.query, got, want)
+		}
+	}
+}
+
 func TestConcurrentLanguageIndexCreation(t *testing.T) {
 	idx := newTestIndexer(t, testutil.Config(t))
 	defer idx.Close()
```

**File**: `server/indexer/querybuilder/builder.go` (modified, +7/-2)
```diff
@@ -102,7 +102,9 @@ func Build(s string) query.Query {
 			qs = append(qs, q)
 		}
 	}
-	if len(qt) > 1 && !anyFieldSpecific(qt) {
+	// A query made only of negated terms has nothing to wrap: the phrase
+	// would become a required clause and match nothing.
+	if len(qt) > 1 && len(qs) > 0 && !anyFieldSpecific(qt) {
 		// create a full phrase query from the query string to get exact matches for the full query
 		pq := createCombinedMatchQuery(s, 2)
 		qs = []query.Query{
@@ -113,7 +115,10 @@ func Build(s string) query.Query {
 		}
 	}
 	q := query.NewBooleanQuery(qs, nil, nqs)
-	if len(qt) == 1 && !isFieldSpecific(qt[0]) {
+	// Only for a positive term: with no must clause the should clause becomes
+	// required, so a negated term would only return documents whose URL
+	// starts with it.
+	if len(qt) == 1 && len(qs) == 1 && !isFieldSpecific(qt[0]) {
 		// prioritize base url matches if there is only one non field specific search term for easier retrieval of websites.
 		uq := bleve.NewRegexpQuery(fmt.Sprintf("https?://(www\\.)?%s[^/]*/", regexp.QuoteMeta(strings.ToLower(qt[0].Value))))
 		uq.SetField("url")
```

**File**: `server/indexer/querybuilder/builder_test.go` (modified, +5/-0)
```diff
@@ -274,6 +274,11 @@ func Test_build_negated_word(t *testing.T) {
 	if bq.Must != nil {
 		t.Fatalf("negated-only word: expected Must to be nil, got %T", bq.Must)
 	}
+	// The base URL boost is for a positive term only; without a Must clause
+	// it would be the only required clause.
+	if bq.Should != nil {
+		t.Fatalf("negated-only word: expected Should to be nil, got %T", bq.Should)
+	}
 	nots := mustNotClauses(t, bq)
 	if len(nots) != 1 {
 		t.Fatalf("expected 1 must_not clause, got %d", len(nots))
```

---

### Incident Patch 3: `c8d1b62a` (2026-10-04)
**Commit Message**: [fix] return results for a query made only of negated terms

**File**: `server/indexer/indexer_test.go` (modified, +45/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"fmt"
 	"net/http"
 	"net/http/httptest"
+	"slices"
 	"strings"
 	"sync"
 	"testing"
@@ -233,6 +234,50 @@ func TestSearchURLRegexpUsesGoMatchSemantics(t *testing.T) {
 	}
 }
 
+func TestSearchOnlyNegatedTerms(t *testing.T) {
+	idx := newTestIndexer(t, testutil.Config(t))
+	defer idx.Close()
+
+	documents := []*document.Document{
+		{URL: "https://go.dev/doc", Title: "Golang docs", Text: "golang language", Processed: true},
+		{URL: "https://rust-lang.org/", Title: "Rust", Text: "rust language", Processed: true},
+		{URL: "https://python.org/", Title: "Python", Text: "python language", Processed: true},
+	}
+	for _, d := range documents {
+		if err := idx.Add(d); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	tests := []struct {
+		query string
+		want  []string
+	}{
+		// a negated field filter already returned every other document
+		{query: "-title:golang", want: []string{documents[1].URL, documents[2].URL}},
+		{query: "-golang", want: []string{documents[1].URL, documents[2].URL}},
+		{query: `-"golang language"`, want: []string{documents[1].URL, documents[2].URL}},
+		{query: "-golang -python", want: []string{documents[1].URL}},
+		{query: "language -golang", want: []string{documents[1].URL, documents[2].URL}},
+	}
+	for _, test := range tests {
+		result, err := idx.Search(&Query{Text: test.query})
+		if err != nil {
+			t.Fatalf("Search(%q): %v", test.query, err)
+		}
+		got := make([]string, 0, len(result.Documents))
+		for _, d := range result.Documents {
+			got = append(got, d.URL)
+		}
+		slices.Sort(got)
+		want := slices.Clone(test.want)
+		slices.Sort(want)
+		if !slices.Equal(got, want) {
+			t.Errorf("Search(%q) returned %q, want %q", test.query, got, want)
+		}
+	}
+}
+
 func TestConcurrentLanguageIndexCreation(t *testing.T) {
 	idx := newTestIndexer(t, testutil.Config(t))
 	defer idx.Close()
```

**File**: `server/indexer/querybuilder/builder.go` (modified, +7/-2)
```diff
@@ -102,7 +102,9 @@ func Build(s string) query.Query {
 			qs = append(qs, q)
 		}
 	}
-	if len(qt) > 1 && !anyFieldSpecific(qt) {
+	// A query made only of negated terms has nothing to wrap: the phrase
+	// would become a required clause and match nothing.
+	if len(qt) > 1 && len(qs) > 0 && !anyFieldSpecific(qt) {
 		// create a full phrase query from the query string to get exact matches for the full query
 		pq := createCombinedMatchQuery(s, 2)
 		qs = []query.Query{
@@ -113,7 +115,10 @@ func Build(s string) query.Query {
 		}
 	}
 	q := query.NewBooleanQuery(qs, nil, nqs)
-	if len(qt) == 1 && !isFieldSpecific(qt[0]) {
+	// Only for a positive term: with no must clause the should clause becomes
+	// required, so a negated term would only return documents whose URL
+	// starts with it.
+	if len(qt) == 1 && len(qs) == 1 && !isFieldSpecific(qt[0]) {
 		// prioritize base url matches if there is only one non field specific search term for easier retrieval of websites.
 		uq := bleve.NewRegexpQuery(fmt.Sprintf("https?://(www\\.)?%s[^/]*/", regexp.QuoteMeta(strings.ToLower(qt[0].Value))))
 		uq.SetField("url")
```

**File**: `server/indexer/querybuilder/builder_test.go` (modified, +5/-0)
```diff
@@ -274,6 +274,11 @@ func Test_build_negated_word(t *testing.T) {
 	if bq.Must != nil {
 		t.Fatalf("negated-only word: expected Must to be nil, got %T", bq.Must)
 	}
+	// The base URL boost is for a positive term only; without a Must clause
+	// it would be the only required clause.
+	if bq.Should != nil {
+		t.Fatalf("negated-only word: expected Should to be nil, got %T", bq.Should)
+	}
 	nots := mustNotClauses(t, bq)
 	if len(nots) != 1 {
 		t.Fatalf("expected 1 must_not clause, got %d", len(nots))
```

---

### Incident Patch 4: `dc0b2260` (2026-10-04)
**Commit Message**: [fix] detect priority rule regexp errors - fixes #805

**File**: `server/indexer/indexer.go` (modified, +57/-12)
```diff
@@ -83,6 +83,7 @@ const (
 	langIndexerName         = "index_%s.db"
 	updatedBackfillKey      = "hister.updated_backfill_complete"
 	updatedBackfillSize     = 200
+	priorityScoreBoost      = 100
 	bleveAsyncErrorCallback = "hister_background_error"
 	bleveErrorRetryDelay    = time.Second
 )
@@ -307,7 +308,23 @@ type indexingMetric struct {
 func (i *Indexer) searchIndexes(req *bleve.SearchRequest) (*bleve.SearchResult, error) {
 	i.indexesMu.RLock()
 	defer i.indexesMu.RUnlock()
-	return i.idx.Search(req)
+	res, err := i.idx.Search(req)
+	if err != nil {
+		return nil, err
+	}
+	// An alias can return a nil error even when some or all indexes failed.
+	// Do not present partial results as a successful search or an empty index.
+	if res.Status != nil && (res.Status.Failed > 0 || len(res.Status.Errors) > 0) {
+		failures := make([]error, 0, len(res.Status.Errors))
+		for _, name := range slices.Sorted(maps.Keys(res.Status.Errors)) {
+			failures = append(failures, fmt.Errorf("search index %q: %w", name, res.Status.Errors[name]))
+		}
+		if len(failures) == 0 {
+			return nil, fmt.Errorf("search failed for %d indexes", res.Status.Failed)
+		}
+		return nil, errors.Join(failures...)
+	}
+	return res, nil
 }
 
 func (i *Indexer) indexes() map[string]bleve.Index {
@@ -2269,22 +2286,50 @@ func (q *Query) create(text string) (query.Query, error) {
 	}
 
 	if !q.MatchAll && len(q.PriorityPatterns) > 0 {
-		bq := query.NewBooleanQuery([]query.Query{sq}, nil, nil)
-		for _, p := range q.PriorityPatterns {
-			if p == "" {
-				continue
-			}
-			rq := bleve.NewRegexpQuery(p)
-			rq.SetField("url")
-			rq.SetBoost(100)
-			bq.AddShould(rq)
-		}
-		return bq, nil
+		return boostPriorityURLs(sq, q.PriorityPatterns)
 	}
 
 	return sq, nil
 }
 
+// boostPriorityURLs scores only candidates from the original query, preserving
+// its text and ownership filters. Go regexps keep matching consistent with rule
+// validation and avoid Bleve's more restrictive regexp syntax.
+func boostPriorityURLs(base query.Query, patterns []string) (query.Query, error) {
+	matchers := make([]*regexp.Regexp, 0, len(patterns))
+	for _, pattern := range patterns {
+		if pattern == "" {
+			continue
+		}
+		matcher, err := regexp.Compile(pattern)
+		if err != nil {
+			return nil, fmt.Errorf("invalid priority rule %q: %w", pattern, err)
+		}
+		matchers = append(matchers, matcher)
+	}
+	if len(matchers) == 0 {
+		return base, nil
+	}
+
+	return query.NewCustomScoreQueryWithScorer(base,
+		func(ctx context.Context, match *search.DocumentMatch) (float64, error) {
+			if err := ctx.Err(); err != nil {
+				return 0, err
+			}
+			score := match.Score
+			if url, ok := match.Fields["url"].(string); ok {
+				for _, matcher := range matchers {
+					if matcher.MatchString(url) {
+						score += priorityScoreBoost
+					}
+				}
+			}
+			return score, nil
+		},
+		[]string{"url"}, nil,
+	), nil
+}
+
 func (q *Query) legacyDateFilterQuery() (query.Query, bool) {
 	if q.DateFrom == 0 && q.DateTo == 0 {
 		return nil, false
```

**File**: `server/indexer/indexer_test.go` (modified, +278/-0)
```diff
@@ -13,11 +13,13 @@ import (
 
 	"github.com/asciimoo/hister/config"
 	"github.com/asciimoo/hister/server/document"
+	"github.com/asciimoo/hister/server/indexer/searchschema"
 	servermetrics "github.com/asciimoo/hister/server/metrics"
 	"github.com/asciimoo/hister/server/testutil"
 	"github.com/asciimoo/hister/server/vectorstore"
 
 	"github.com/blevesearch/bleve/v2"
+	"github.com/blevesearch/bleve/v2/search/query"
 )
 
 func newTestIndexer(t *testing.T, cfg *config.Config) *Indexer {
@@ -1022,3 +1024,279 @@ func TestSearchReturnsKeywordResultsAfterQueryEmbeddingTimeout(t *testing.T) {
 		t.Fatal("search did not attempt semantic embedding")
 	}
 }
+
+func TestSearchPriorityRulesUseGoRegexpSemantics(t *testing.T) {
+	idx := newTestIndexer(t, testutil.Config(t))
+	defer idx.Close()
+
+	const ordinaryURL = "https://example.com/guide"
+	const priorityURL = "https://wiki.example.com/guide"
+	for _, d := range []*document.Document{
+		{URL: ordinaryURL, Title: "Granite guide", Text: "Granite and quartz", Added: 200, Processed: true},
+		{URL: priorityURL, Title: "Granite guide", Text: "Granite and quartz", Added: 100, Language: "en", Processed: true},
+	} {
+		if err := idx.Add(d); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	for _, tc := range []struct {
+		name     string
+		patterns []string
+		firstURL string
+	}{
+		{"full URL", []string{`https://wiki\.example\.com/.*`}, priorityURL},
+		{"substring", []string{`wiki\.example\.com`}, priorityURL},
+		{"prefix anchor", []string{`^https://wiki\.example\.com/`}, priorityURL},
+		{"suffix anchor", []string{`wiki\.example\.com/guide$`}, priorityURL},
+		{"word boundary", []string{`\bwiki\b`}, priorityURL},
+		{"lazy quantifier", []string{`wiki.*?guide`}, priorityURL},
+		{"empty alongside matching", []string{"", `\bwiki\b`}, priorityURL},
+		{"no matches", []string{`missing\.example$`}, ""},
+		{"empty", []string{""}, ""},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			rule := &config.Rule{ReStrs: tc.patterns}
+			if err := rule.Compile(); err != nil {
+				t.Fatalf("valid rule rejected: %v", err)
+			}
+			for _, text := range []string{"*", "granite"} {
+				t.Run(text, func(t *testing.T) {
+					result, err := idx.Search(&Query{Text: text, PriorityPatterns: tc.patterns})
+					if err != nil {
+						t.Fatal(err)
+					}
+					if result.Total != 2 || len(result.Documents) != 2 {
+						t.Fatalf("got %d total and %d documents, want both matches", result.Total, len(result.Documents))
+					}
+					if tc.firstURL != "" && result.Documents[0].URL != tc.firstURL {
+						t.Errorf("first URL = %q, want priority URL %q", result.Documents[0].URL, tc.firstURL)
+					}
+				})
+			}
+		})
+	}
+
+	first, err := idx.Search(&Query{Text: "granite", PriorityPatterns: []string{`\bwiki\b`}, Limit: 1})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(first.Documents) != 1 || first.Documents[0].URL != priorityURL || first.PageKey == "" {
+		t.Fatalf("first page = %+v, want priority document and continuation", first)
+	}
+	second, err := idx.Search(&Query{Text: "granite", PriorityPatterns: []string{`\bwiki\b`}, Limit: 1, PageKey: first.PageKey})
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(second.Documents) != 1 || second.Documents[0].URL != ordinaryURL {
+		t.Fatalf("second page = %+v, want ordinary document", second)
+	}
+}
+
+func TestSearchPriorityRulesRespectFiltersAndSort(t *testing.T) {
+	idx := newTestIndexer(t, testutil.Config(t))
+	defer idx.Close()
+
+	const ordinaryURL = "https://example.com/guide"
+	const priorityURL = "https://wiki.example.com/guide"
+	for _, d := range []*document.Document{
+		{URL: ordinaryURL, Text: "Granite", Added: 200, UserID: 1, Processed: true},
+		{URL: priorityURL, Text: "Granite", Added: 100, UserID: 0, Language: "en", Processed: true},
+		{URL: "https://wiki.example.com/private", Text: "Granite", Added: 300, UserID: 2, Processed: true},
+		{URL: "https://wiki.example.com/unrelated", Text: "Basalt", Added: 400, UserID: 1, Processed: true},
+	} {
+		if err := idx.Add(d); err != nil {
+			t.Fatal(err)
+		}
+	}
+	for _, tc := range []struct {
+		text, sort, firstURL string
+		total                uint64
+	}{
+		{"granite", "", priorityURL, 2},
+		{"granite", "date", ordinaryURL, 2},
+		{`granite -url:"https://wiki.example.com/guide"`, "", ordinaryURL, 1},
+	} {
+		t.Run(tc.text+"/"+tc.sort, func(t *testing.T) {
+			result, err := idx.Search(&Query{Text: tc.text, Sort: tc.sort, UserID: 1, PriorityPatterns: []string{`\bwiki\b`}})
+			if err != nil {
+				t.Fatal(err)
+			}
+			if result.Total != tc.total || len(result.Documents) != int(tc.total) {
+				t.Fatalf("got %d total and %d documents, want %d", result.Total, len(result.Documents), tc.total)
+			}
+			if result.Documents[0].URL != tc.firstURL {
+				t.Errorf("first URL = %q, want %q", result.Documents[0].URL, tc.firstURL)
+			}
+		})
+	}
+}
+
+func TestSearchRejectsInvalidPriorityRegexp(t *testing.T) {
+	idx := newTestIndexer(t, testutil.Config(t))
+	defer idx.Close()
+	if _, err := idx.Se
```

---

### Incident Patch 5: `9d5e64c2` (2026-10-03)
**Commit Message**: fix(proxy-auth): passwordless proxy users, preserve token auth, harden tests

**File**: `server/model/user.go` (modified, +23/-0)
```diff
@@ -18,6 +18,7 @@ var (
 	ErrUserNotFound      = errors.New("user not found")
 	ErrInvalidPassword   = errors.New("invalid password")
 	ErrUserAlreadyExists = errors.New("user already exists")
+	ErrEmptyPassword     = errors.New("password must not be empty")
 )
 
 type User struct {
@@ -81,6 +82,9 @@ func CreateUser(username, password string, isAdmin bool) (*User, error) {
 	if err := DB.Where("username = ?", username).First(&existing).Error; err == nil {
 		return nil, ErrUserAlreadyExists
 	}
+	if password == "" {
+		return nil, ErrEmptyPassword
+	}
 	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
 	if err != nil {
 		return nil, err
@@ -105,6 +109,9 @@ func AuthenticateUser(username, password string) (*User, error) {
 	if err := DB.Where("username = ?", username).First(&u).Error; err != nil {
 		return nil, ErrUserNotFound
 	}
+	if password == "" || u.Password == "" {
+		return nil, ErrInvalidPassword
+	}
 	if err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)); err != nil {
 		return nil, ErrInvalidPassword
 	}
@@ -167,6 +174,9 @@ func UpdateUsername(username, newUsername string) error {
 }
 
 func UpdatePassword(username, password string) error {
+	if password == "" {
+		return ErrEmptyPassword
+	}
 	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
 	if err != nil {
 		return err
@@ -198,6 +208,19 @@ func CreateOAuthUser(username, oauthID string) (*User, error) {
 	return u, DB.Create(u).Error
 }
 
+// CreateProxyUser creates an account for reverse-proxy authentication.
+// Like CreateOAuthUser it leaves Password empty so password authentication
+// stays disabled: AuthenticateUser rejects users with no stored password,
+// so these credentials can never be used if proxy auth is later disabled.
+func CreateProxyUser(username string) (*User, error) {
+	var existing User
+	if err := DB.Where("username = ?", username).First(&existing).Error; err == nil {
+		return nil, ErrUserAlreadyExists
+	}
+	u := &User{Username: username, Token: rand.Text()}
+	return u, DB.Create(u).Error
+}
+
 func ToggleAdmin(username string) (bool, error) {
 	var u User
 	if err := DB.Where("username = ?", username).First(&u).Error; err != nil {
```

**File**: `server/proxy_auth_test.go` (modified, +95/-48)
```diff
@@ -1,11 +1,14 @@
 package server
 
 import (
+	"encoding/json"
+	"errors"
 	"net/http"
 	"net/http/httptest"
 	"strings"
 	"testing"
 
+	"github.com/asciimoo/hister/server/model"
 	"github.com/asciimoo/hister/server/testutil"
 )
 
@@ -29,55 +32,79 @@ func newProxyAuthTestServer(t *testing.T, headerName string) (*http.ServeMux, ui
 	return handler.(*http.ServeMux), user.ID
 }
 
-func TestProxyAuthHeaderPresent_UserExists(t *testing.T) {
-	handler, _ := newProxyAuthTestServer(t, "Remote-User")
-
-	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
-	req.Header.Set("Remote-User", "ali")
+func serveProxyAuthProfile(t *testing.T, handler http.Handler, headers map[string]string) (int, map[string]any) {
+	t.Helper()
+	req := httptest.NewRequest(http.MethodGet, "/api/profile", nil)
+	for k, v := range headers {
+		req.Header.Set(k, v)
+	}
 	rec := httptest.NewRecorder()
 	handler.ServeHTTP(rec, req)
+	var body map[string]any
+	if rec.Code == http.StatusOK {
+		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
+			t.Fatalf("failed to decode /api/profile response: %v", err)
+		}
+	}
+	return rec.Code, body
+}
+
+func TestProxyAuthHeaderPresent_UserExists(t *testing.T) {
+	handler, aliceID := newProxyAuthTestServer(t, "Remote-User")
 
-	if rec.Code != http.StatusOK {
-		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
+	code, body := serveProxyAuthProfile(t, handler, map[string]string{"Remote-User": "alice"})
+	if code != http.StatusOK {
+		t.Fatalf("status = %d, want %d", code, http.StatusOK)
+	}
+	if body["username"] != "alice" {
+		t.Fatalf("username = %v, want %q", body["username"], "alice")
+	}
+	if uint(body["user_id"].(float64)) != aliceID {
+		t.Fatalf("user_id = %v, want %d", body["user_id"], aliceID)
 	}
 }
 
 func TestProxyAuthHeaderPresent_UserAutoCreated(t *testing.T) {
 	handler, _ := newProxyAuthTestServer(t, "Remote-User")
 
-	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
-	req.Header.Set("Remote-User", "bob")
-	rec := httptest.NewRecorder()
-	handler.ServeHTTP(rec, req)
+	code, body := serveProxyAuthProfile(t, handler, map[string]string{"Remote-User": "bob"})
+	if code != http.StatusOK {
+		t.Fatalf("expected 200 for auto-created proxy user, got %d", code)
+	}
+	if body["username"] != "bob" {
+		t.Fatalf("username = %v, want %q", body["username"], "bob")
+	}
 
-	if rec.Code != http.StatusOK {
-		t.Fatalf("expected 200 for auto-created proxy user, got %d", rec.Code)
+	created, err := model.GetUser("bob")
+	if err != nil {
+		t.Fatalf("auto-created proxy user not found: %v", err)
+	}
+	if created.Password != "" {
+		t.Fatal("auto-created proxy user must not have a password hash")
+	}
+	if _, err := model.AuthenticateUser("bob", ""); !errors.Is(err, model.ErrInvalidPassword) {
+		t.Fatalf("proxy user empty-password login error = %v, want %v", err, model.ErrInvalidPassword)
+	}
+	if _, err := model.AuthenticateUser("bob", "anything"); !errors.Is(err, model.ErrInvalidPassword) {
+		t.Fatalf("proxy user password login error = %v, want %v", err, model.ErrInvalidPassword)
 	}
 }
 
 func TestProxyAuthHeaderMissing(t *testing.T) {
 	handler, _ := newProxyAuthTestServer(t, "Remote-User")
 
-	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks", nil)
-	// No Remote-User header set.
-	rec := httptest.NewRecorder()
-	handler.ServeHTTP(rec, req)
-
-	if rec.Code == http.StatusOK {
-		t.Fatalf("expected non-200 when proxy header is missing, got %d", rec.Code)
+	code, _ := serveProxyAuthProfile(t, handler, nil)
+	if code != http.StatusForbidden {
+		t.Fatalf("status = %d, want %d when proxy header is missing", code, http.StatusForbidden)
 	}
 }
 
 func TestProxyAuthHeaderEmpty(t *testing.T) {
 	handler, _ := newProxyAuthTestServer(t, "Remote-User")
 
-	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks", nil)
-	req.Header.Set("Remote-User", "   ")
-	rec := httptest.NewRecorder()
-	handler.ServeHTTP(rec, req)
-
-	if rec.Code == http.StatusOK {
-		t.Fatalf("expected non-200 for empty/whitespace proxy header, got %d", rec.Code)
+	code, _ := serveProxyAuthProfile(t, handler, map[string]string{"Remote-User": "   "})
+	if code != http.StatusForbidden {
+		t.Fatalf("status = %d, want %d for empty/whitespace proxy header", code, http.StatusForbidden)
 	}
 }
 
@@ -99,37 +126,57 @@ func TestProxyAuthDisabled_FallsBackToOldAuth(t *testing.T) {
 	handler := registerEndpoints(cfg, newServerTestIndexer(t, cfg))
 
 	// Even with a Remote-User header, proxy auth is disabled so it's ignored.
-	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks", nil)
-	req.Header.Set("Remote-User", "alice")
-	rec := httptest.NewRecorder()
-	handler.ServeHTTP(rec, req)
-
-	// Without a valid session cookie, the user is unauthenticated.
-	if rec.Code == http.StatusOK {
-		t.Fatalf("expected non-200 when proxy auth is disabled, got %d", rec.Code)
+	code, _ := serveProxyAuthProfile(t, handler, map[string]string{"Remote-User": "alice"})
+	if code != http.StatusForbidden {
+		t.Fatal
```

**File**: `server/server.go` (modified, +19/-16)
```diff
@@ -246,25 +246,28 @@ func withTokenAuth(handler endpointHandler) endpointHandler {
 
 func populateUserContext(c *webContext) {
 	if c.Config.Server.ProxyAuthHeader != "" {
-		username := strings.TrimSpace(c.Request.Header.Get(c.Config.Server.ProxyAuthHeader))
-		if username == "" {
-			return
-		}
-		u, err := model.GetUser(username)
-		if err != nil {
-			u, err = model.CreateUser(username, "", false)
-			if err != nil {
+		if username := strings.TrimSpace(c.Request.Header.Get(c.Config.Server.ProxyAuthHeader)); username != "" {
+			u, err := model.GetUser(username)
+			if err != nil && errors.Is(err, model.ErrUserNotFound) {
+				u, err = model.CreateProxyUser(username)
+				if err != nil && errors.Is(err, model.ErrUserAlreadyExists) {
+					u, err = model.GetUser(username)
+				}
+			}
+			if err == nil && u != nil {
+				c.UserID = u.ID
+				c.Username = u.Username
+				c.IsAdmin = u.IsAdmin
+				c.Authenticated = true
+				if rules, err := u.ParseRules(); err == nil {
+					c.userRules = rules
+				}
 				return
 			}
 		}
-		c.UserID = u.ID
-		c.Username = u.Username
-		c.IsAdmin = u.IsAdmin
-		c.Authenticated = true
-		if rules, err := u.ParseRules(); err == nil {
-			c.userRules = rules
-		}
-		return
+		// Missing/empty header or proxy lookup failure falls through to
+		// session and API token authentication below, so CLI, extension,
+		// and MCP token access keeps working when proxy auth is enabled.
 	}
 
 	session, err := sessionStore.Get(c.Request, storeName)
```

---

### Incident Patch 6: `a69f2017` (2026-10-01)
**Commit Message**:  fix(metrics): use native histograms for search/indexing latency

**File**: `server/metrics/metrics.go` (modified, +12/-3)
```diff
@@ -62,7 +62,11 @@ func New(ctx context.Context, src GaugeSource) *Metrics {
 			Namespace: "hister",
 			Name:      "search_duration_seconds",
 			Help:      "Histogram of search query latency in seconds.",
-			Buckets:   prometheus.DefBuckets,
+			// Native-only: no classic Buckets. Sparse exponential buckets
+			// are emitted for Prometheus >= v2.40 (stable in v3.x).
+			NativeHistogramBucketFactor:     1.1,
+			NativeHistogramMaxBucketNumber:  160,
+			NativeHistogramMinResetDuration: time.Hour,
 		}),
 
 		DocumentsIndexedTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
@@ -75,7 +79,10 @@ func New(ctx context.Context, src GaugeSource) *Metrics {
 			Namespace: "hister",
 			Name:      "indexing_duration_seconds",
 			Help:      "Histogram of single-document indexing latency in seconds.",
-			Buckets:   prometheus.DefBuckets,
+			// Native-only: no classic Buckets. See SearchDuration above.
+			NativeHistogramBucketFactor:     1.1,
+			NativeHistogramMaxBucketNumber:  160,
+			NativeHistogramMinResetDuration: time.Hour,
 		}),
 
 		DatastoreSizeBytes: prometheus.NewGauge(prometheus.GaugeOpts{
@@ -111,8 +118,10 @@ func New(ctx context.Context, src GaugeSource) *Metrics {
 }
 
 // Handler returns an http.Handler that serves the Prometheus metrics.
+// OpenMetrics negotiation is enabled so native histograms are exposed
+// to capable scrapers; classic text scrapers still receive count/sum.
 func (m *Metrics) Handler() http.Handler {
-	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
+	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{EnableOpenMetrics: true})
 }
 
 // Stop cancels the background gauge-refresh ticker.
```

**File**: `server/metrics/metrics_test.go` (modified, +60/-0)
```diff
@@ -79,6 +79,66 @@ func TestMetricsNewAndHandler(t *testing.T) {
 	}
 }
 
+func TestHistogramsUseNativeFormat(t *testing.T) {
+	m := New(t.Context(), &mockGaugeSource{total: 1, dataDir: t.TempDir()})
+	defer m.Stop()
+
+	m.SearchDuration.Observe(0.123)
+	m.IndexingDuration.Observe(0.045)
+
+	mfs, err := m.registry.Gather()
+	if err != nil {
+		t.Fatalf("gather metrics: %v", err)
+	}
+	seen := map[string]bool{}
+	for _, mf := range mfs {
+		name := mf.GetName()
+		if name != "hister_search_duration_seconds" && name != "hister_indexing_duration_seconds" {
+			continue
+		}
+		seen[name] = true
+		for _, mt := range mf.GetMetric() {
+			h := mt.GetHistogram()
+			if h == nil {
+				t.Fatalf("%s: no histogram in gathered metric", name)
+			}
+			if n := len(h.GetBucket()); n != 0 {
+				t.Fatalf("%s: want native-only histogram with no classic buckets, got %d", name, n)
+			}
+			if h.GetSchema() == 0 || len(h.GetPositiveSpan()) == 0 {
+				t.Fatalf("%s: no native histogram buckets populated (schema=%d spans=%d)", name, h.GetSchema(), len(h.GetPositiveSpan()))
+			}
+		}
+	}
+	for _, name := range []string{"hister_search_duration_seconds", "hister_indexing_duration_seconds"} {
+		if !seen[name] {
+			t.Fatalf("metric %q missing from gather", name)
+		}
+	}
+}
+
+func TestHandlerNegotiatesOpenMetrics(t *testing.T) {
+	m := New(t.Context(), &mockGaugeSource{total: 1, dataDir: t.TempDir()})
+	defer m.Stop()
+
+	m.SearchDuration.Observe(0.123)
+
+	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
+	req.Header.Set("Accept", "application/openmetrics-text; version=1.0.0; charset=utf-8")
+	rec := httptest.NewRecorder()
+	m.Handler().ServeHTTP(rec, req)
+
+	if rec.Code != http.StatusOK {
+		t.Fatalf("expected status OK, got %d", rec.Code)
+	}
+	if ct := rec.Header().Get("Content-Type"); !strings.Contains(strings.ToLower(ct), "openmetrics") {
+		t.Fatalf("expected openmetrics content type, got %q", ct)
+	}
+	if body := rec.Body.String(); !strings.Contains(body, "hister_search_duration_seconds_count 1") {
+		t.Fatalf("openmetrics exposition missing histogram count:\n%.500s", body)
+	}
+}
+
 func TestStopCancelsContext(t *testing.T) {
 	ctx := t.Context()
 	m := New(ctx, &mockGaugeSource{total: 1, dataDir: t.TempDir()})
```

---

### Incident Patch 7: `76105c93` (2026-09-30)
**Commit Message**: [fix] lint

**File**: `server/vectorstore/embedder_test.go` (modified, +2/-2)
```diff
@@ -619,7 +619,7 @@ func TestEmbedQueryDeadlineWhileWaitingForQuerySlot(t *testing.T) {
 	e.queryTimeout = 40 * time.Millisecond
 	e.querySem <- struct{}{}
 	defer func() { <-e.querySem }()
-	_, err := e.EmbedQuery(nil, "query")
+	_, err := e.EmbedQuery(context.Background(), "query")
 	if !errors.Is(err, context.DeadlineExceeded) {
 		t.Fatalf("error = %v, want deadline exceeded", err)
 	}
@@ -657,7 +657,7 @@ func TestEmbedQueryDeadlineCancelsRetry(t *testing.T) {
 		calls++
 		return &http.Response{StatusCode: 503, Body: http.NoBody, Header: make(http.Header), Request: r}, nil
 	})
-	_, err := e.EmbedQuery(nil, "query")
+	_, err := e.EmbedQuery(context.Background(), "query")
 	if !errors.Is(err, context.DeadlineExceeded) {
 		t.Fatalf("error = %v", err)
 	}
```

---

### Incident Patch 8: `8534acfe` (2026-09-29)
**Commit Message**: [fix] validate subdocuments properly

**File**: `server/indexer/files_test.go` (modified, +71/-0)
```diff
@@ -75,6 +75,77 @@ func TestAddFunctionsValidateFileDocuments(t *testing.T) {
 	}
 }
 
+func TestExtractorExtraDocumentsCannotReadLocalFiles(t *testing.T) {
+	for _, mode := range []string{"single", "direct", "batch"} {
+		for _, nested := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/nested=%t", mode, nested), func(t *testing.T) {
+				idx := newTestIndexer(t, testutil.Config(t))
+				t.Cleanup(idx.Close)
+				path := filepath.Join(t.TempDir(), "secret.txt")
+				const secret = "extractorfileregressionsecret"
+				if err := os.WriteFile(path, []byte(secret), 0o600); err != nil {
+					t.Fatal(err)
+				}
+				fileURL := files.PathToFileURL(path)
+				const validURL = "https://example.com/@alice/123"
+				payload := &document.Document{
+					URL:    "https://example.com/",
+					UserID: 1,
+					HTML: fmt.Sprintf(`<span>"repository":"mastodon/mastodon"</span>
+<div class="status"><a class="status__relative-time" href="%s"></a><div class="status__content"></div></div>
+<div class="status"><a class="status__relative-time" href="%s"></a><div class="status__content">Public toot</div></div>`, fileURL, validURL),
+				}
+				root := payload
+				if nested {
+					root = &document.Document{
+						URL:            "https://example.com/root",
+						Text:           "Parent document",
+						UserID:         1,
+						ExtraDocuments: []*document.Document{payload},
+					}
+				}
+				// Manual indexing overrides URL rules, but must retain file validation.
+				root.SetIgnoreSkipRules(true)
+				var err error
+				switch mode {
+				case "single":
+					err = idx.Add(root)
+				case "direct":
+					err = idx.AddDocument(root)
+				case "batch":
+					batch := idx.NewMultiBatch()
+					err = batch.Add(root)
+					if err == nil {
+						err = batch.Save()
+					}
+				}
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(payload.ExtraDocuments) != 2 {
+					t.Fatalf("extracted %d documents, want 2", len(payload.ExtraDocuments))
+				}
+				if extra := payload.ExtraDocuments[0]; extra.Text != "" || extra.IsProcessed() {
+					t.Fatal("unsafe extra document was processed")
+				}
+				if idx.GetByURLAndUser(fileURL, 1) != nil {
+					t.Fatal("local file was indexed")
+				}
+				result, err := idx.Search(&Query{Text: secret, UserID: 1})
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(result.Documents) != 0 {
+					t.Fatal("local file content is searchable")
+				}
+				if doc := idx.GetByURLAndUser(validURL, 1); doc == nil || doc.Text != "Public toot" {
+					t.Fatal("valid sibling toot was not indexed")
+				}
+			})
+		}
+	}
+}
+
 func TestDirectoryUserResolution(t *testing.T) {
 	testutil.InitModel(t)
 
```

**File**: `server/indexer/indexer.go` (modified, +6/-0)
```diff
@@ -1243,6 +1243,12 @@ func (i *Indexer) addDocument(ctx context.Context, d *document.Document, increme
 		if err := ctx.Err(); err != nil {
 			return err
 		}
+		// Extractor output can contain URLs from untrusted HTML. Validate each
+		// extra document before processing can read a local file.
+		if err := i.validateFileDocument(extra); err != nil {
+			log.Warn().Err(err).Str("url", extra.URL).Msg("failed to index extra document")
+			continue
+		}
 		if ignoreRules {
 			extra.SetIgnoreSkipRules(true)
 		}
```

---

### Incident Patch 9: `7ab09500` (2026-09-28)
**Commit Message**: [fix] lint

**File**: `cmd/index_flags_test.go` (modified, +7/-4)
```diff
@@ -44,8 +44,7 @@ func TestIndexSubmissionFlags(t *testing.T) {
 			cfg.Crawler.Delay = 0
 			cfg.Crawler.Timeout = 2
 			var submitted []document.Document
-			var server *httptest.Server
-			server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 				switch r.URL.Path {
 				case "/api/document", "/api/add":
 					if got := r.Header.Get("X-Hister-Target-User-ID"); got != tc.owner {
@@ -69,7 +68,9 @@ func TestIndexSubmissionFlags(t *testing.T) {
 					if tc.noRobots {
 						t.Error("--no-robots should bypass robots requests")
 					}
-					fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+					if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+						t.Error(err)
+					}
 				case "/page", "/existing", "/blocked":
 					if r.URL.Path == "/existing" && !tc.force || r.URL.Path == "/blocked" && !tc.noRobots {
 						t.Errorf("fetched a page that should be skipped: %s", r.URL.Path)
@@ -82,7 +83,9 @@ func TestIndexSubmissionFlags(t *testing.T) {
 						t.Errorf("crawler cookie = %v, %v", cookie, err)
 					}
 					w.Header().Set("Content-Type", "text/html")
-					fmt.Fprint(w, `<html><head><title>Flag test</title></head><body><p>Page content.</p><a href="/unlisted">Unlisted page</a></body></html>`)
+					if _, err := fmt.Fprint(w, `<html><head><title>Flag test</title></head><body><p>Page content.</p><a href="/unlisted">Unlisted page</a></body></html>`); err != nil {
+						t.Error(err)
+					}
 				case "/missing", "/favicon.ico":
 					w.WriteHeader(http.StatusNotFound)
 				default:
```

**File**: `cmd/sitemap.go` (modified, +1/-2)
```diff
@@ -4,7 +4,6 @@ package cmd
 
 import (
 	"fmt"
-	"io"
 	"net/url"
 	"os"
 	"path"
@@ -80,7 +79,7 @@ func readSitemapInput(cmd *cobra.Command, reader *sitemapReader, source string)
 	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
 		return reader.Fetch(cmd.Context(), source)
 	}
-	var input io.Reader = cmd.InOrStdin()
+	input := cmd.InOrStdin()
 	if source != "-" {
 		file, openErr := os.Open(files.ExpandHome(source))
 		if openErr != nil {
```

**File**: `cmd/sitemap_reader_test.go` (modified, +12/-4)
```diff
@@ -128,13 +128,19 @@ func TestSitemapReaderExpandsIndexesAndDeduplicates(t *testing.T) {
 		}
 		switch req.URL.Path {
 		case "/index.xml":
-			fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/one.xml.gz</loc></sitemap><sitemap><loc>%s/nested.xml</loc></sitemap><sitemap><loc>%s/one.xml.gz</loc></sitemap></sitemapindex>`, server.URL, server.URL, server.URL)
+			if _, err := fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/one.xml.gz</loc></sitemap><sitemap><loc>%s/nested.xml</loc></sitemap><sitemap><loc>%s/one.xml.gz</loc></sitemap></sitemapindex>`, server.URL, server.URL, server.URL); err != nil {
+				t.Error(err)
+			}
 		case "/nested.xml":
-			fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/index.xml</loc></sitemap><sitemap><loc>%s/two.xml</loc></sitemap></sitemapindex>`, server.URL, server.URL)
+			if _, err := fmt.Fprintf(w, `<sitemapindex><sitemap><loc>%s/index.xml</loc></sitemap><sitemap><loc>%s/two.xml</loc></sitemap></sitemapindex>`, server.URL, server.URL); err != nil {
+				t.Error(err)
+			}
 		case "/one.xml.gz":
 			_, _ = w.Write(gzipSitemap(t, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/one#fragment</loc></url></urlset>`))
 		case "/two.xml":
-			fmt.Fprint(w, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/two</loc></url></urlset>`)
+			if _, err := fmt.Fprint(w, `<urlset><url><loc>https://example.com/one</loc></url><url><loc>https://example.com/two</loc></url></urlset>`); err != nil {
+				t.Error(err)
+			}
 		default:
 			t.Errorf("unexpected fetch: %s", req.URL)
 		}
@@ -170,7 +176,9 @@ func TestSitemapReaderExpandsIndexesAndDeduplicates(t *testing.T) {
 func TestSitemapReaderErrors(t *testing.T) {
 	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		if r.URL.Path == "/robots.txt" {
-			fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+			if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+				t.Error(err)
+			}
 			return
 		}
 		http.Error(w, "missing", http.StatusNotFound)
```

**File**: `cmd/sitemap_test.go` (modified, +9/-3)
```diff
@@ -76,9 +76,13 @@ func TestImportSitemapQueuesOnlyListedPages(t *testing.T) {
 			server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 				switch r.URL.Path {
 				case "/sitemap.xml":
-					fmt.Fprintf(w, `<urlset><url><loc>%s/page</loc></url><url><loc>%s/page</loc></url><url><loc>%s/existing</loc></url><url><loc>%s/blocked</loc></url></urlset>`, server.URL, server.URL, server.URL, server.URL)
+					if _, err := fmt.Fprintf(w, `<urlset><url><loc>%s/page</loc></url><url><loc>%s/page</loc></url><url><loc>%s/existing</loc></url><url><loc>%s/blocked</loc></url></urlset>`, server.URL, server.URL, server.URL, server.URL); err != nil {
+						t.Error(err)
+					}
 				case "/robots.txt":
-					fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n")
+					if _, err := fmt.Fprint(w, "User-agent: *\nDisallow: /blocked\n"); err != nil {
+						t.Error(err)
+					}
 				case "/api/document":
 					if !strings.HasSuffix(r.URL.Query().Get("url"), "/existing") {
 						w.WriteHeader(http.StatusNotFound)
@@ -91,7 +95,9 @@ func TestImportSitemapQueuesOnlyListedPages(t *testing.T) {
 						t.Error("existing page fetched without --force")
 					}
 					w.Header().Set("Content-Type", "text/html")
-					fmt.Fprint(w, `<html><head><title>Sitemap page</title></head><body><p>Content of the listed page.</p><a href="/unlisted">Do not crawl this page</a></body></html>`)
+					if _, err := fmt.Fprint(w, `<html><head><title>Sitemap page</title></head><body><p>Content of the listed page.</p><a href="/unlisted">Do not crawl this page</a></body></html>`); err != nil {
+						t.Error(err)
+					}
 				case "/api/add":
 					var doc document.Document
 					if err := json.NewDecoder(r.Body).Decode(&doc); err != nil {
```

---

### Incident Patch 10: `bafe7d70` (2026-09-26)
**Commit Message**: [fix] extend selectors - #790

**File**: `server/extractor/extractors/chatgpt/extractor.go` (modified, +18/-3)
```diff
@@ -21,7 +21,8 @@ import (
 
 const conversationType = "chatgpt"
 
-const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn]`
+const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn], ` +
+	`[data-chatgpt-search-unit-key], [data-content-search-unit-key]`
 
 const noConversationTurns = "no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser"
 
@@ -187,7 +188,7 @@ func findConversationTurns(doc *goquery.Document) []conversationTurn {
 		return nil
 	}
 	turns := make([]conversationTurn, 0)
-	// Visit both marker forms together so mixed markup retains document order.
+	// Visit all marker forms together so mixed markup retains document order.
 	doc.Find(conversationRoleSelector).Each(func(_ int, roleNode *goquery.Selection) {
 		role := conversationRole(roleNode)
 		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
@@ -213,7 +214,20 @@ func conversationRole(selection *goquery.Selection) string {
 	if rawRole, ok := selection.Attr("data-message-author-role"); ok {
 		return normalizeRole(rawRole)
 	}
-	return normalizeRole(selection.AttrOr("data-turn", ""))
+	if rawRole, ok := selection.Attr("data-turn"); ok {
+		return normalizeRole(rawRole)
+	}
+	// Search units encode the role as the final component, for example
+	// "fallback-turn-0:2:assistant". Both attributes may wrap the same message.
+	for _, attribute := range []string{"data-chatgpt-search-unit-key", "data-content-search-unit-key"} {
+		if key, ok := selection.Attr(attribute); ok {
+			if separator := strings.LastIndexByte(key, ':'); separator > 0 {
+				return normalizeRole(key[separator+1:])
+			}
+			return ""
+		}
+	}
+	return ""
 }
 
 func normalizeRole(raw string) string {
@@ -252,6 +266,7 @@ func cleanConversationContent(content *goquery.Selection, role string) {
 		// Turn wrappers include an accessibility heading repeating the speaker.
 		content.ChildrenFiltered(".sr-only").Remove()
 	}
+	content.Find(`[data-markdown-copy="exclude"], .turn-action-controls`).Remove()
 	content.Find(`script, style, noscript, template, button, svg, img, picture, video, audio, iframe, embed, object, canvas, source, form, input, textarea, select, option`).Remove()
 	content.Find(`[hidden], [aria-hidden]`).Each(func(_ int, nested *goquery.Selection) {
 		if isHiddenElement(nested) {
```

---

### Incident Patch 11: `25dccadb` (2026-09-26)
**Commit Message**: [fix] support data-turn markers and mixed markup - #790

**File**: `server/extractor/extractors/chatgpt/extractor.go` (modified, +31/-60)
```diff
@@ -4,6 +4,7 @@
 package chatgpt
 
 import (
+	"errors"
 	"fmt"
 	stdhtml "html"
 	"net/url"
@@ -20,6 +21,10 @@ import (
 
 const conversationType = "chatgpt"
 
+const conversationRoleSelector = `[data-message-author-role], [data-testid^="conversation-turn-"][data-turn]`
+
+const noConversationTurns = "no visible user or assistant turns found; capture the loaded conversation with the browser extension or a browser crawler (chromedp or bidi); private conversations require a signed in browser"
+
 // ChatGPTExtractor extracts one visible ChatGPT conversation into one Hister
 // document. It intentionally works only with the rendered HTML already on the
 // document and never fetches conversation data itself.
@@ -34,7 +39,7 @@ func (e *ChatGPTExtractor) Name() string {
 }
 
 func (e *ChatGPTExtractor) Description() string {
-	return "Extracts the visible user and assistant turns from ChatGPT conversations as one searchable document."
+	return "Extracts the visible user and assistant turns from rendered ChatGPT conversations as one searchable document. Requires HTML captured by the browser extension or a browser crawler (chromedp or bidi)."
 }
 
 func (e *ChatGPTExtractor) Capabilities() sdk.Capabilities {
@@ -110,7 +115,7 @@ func (e *ChatGPTExtractor) Extract(d *sdk.Document) sdk.ExtractResult {
 		return sdk.ExtractFallback(err)
 	}
 	if len(turns) == 0 {
-		return sdk.AbortExtraction(fmt.Errorf("no visible user or assistant turns found"))
+		return sdk.AbortExtraction(errors.New(noConversationTurns))
 	}
 
 	title := documentTitle(d, doc)
@@ -134,7 +139,7 @@ func (e *ChatGPTExtractor) Preview(d *sdk.Document) sdk.PreviewResult {
 		return sdk.PreviewFallback(err)
 	}
 	if len(turns) == 0 {
-		return sdk.PreviewFallback(fmt.Errorf("no visible user or assistant turns found"))
+		return sdk.PreviewFallback(errors.New(noConversationTurns))
 	}
 
 	base, err := url.Parse(d.URL)
@@ -181,20 +186,16 @@ func findConversationTurns(doc *goquery.Document) []conversationTurn {
 	if doc == nil {
 		return nil
 	}
-	if turns := findArticleConversationTurns(doc); len(turns) > 0 {
-		return turns
-	}
-	return findRoleConversationTurns(doc)
-}
-
-func findArticleConversationTurns(doc *goquery.Document) []conversationTurn {
 	turns := make([]conversationTurn, 0)
-	doc.Find(`article[data-testid^="conversation-turn-"]`).Each(func(_ int, article *goquery.Selection) {
-		if isHiddenElement(article) {
+	// Visit both marker forms together so mixed markup retains document order.
+	doc.Find(conversationRoleSelector).Each(func(_ int, roleNode *goquery.Selection) {
+		role := conversationRole(roleNode)
+		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
 			return
 		}
-		roleNode, role := findRoleNode(article)
-		if roleNode == nil || isHiddenElement(roleNode) {
+		if _, explicit := roleNode.Attr("data-message-author-role"); !explicit && roleNode.Find(`[data-message-author-role]`).Length() > 0 {
+			// Prefer explicit messages, even when they are hidden or unsupported.
+			// Falling back to their wrapper would index controls or internal text.
 			return
 		}
 
@@ -208,48 +209,11 @@ func findArticleConversationTurns(doc *goquery.Document) []conversationTurn {
 	return turns
 }
 
-func findRoleConversationTurns(doc *goquery.Document) []conversationTurn {
-	turns := make([]conversationTurn, 0)
-	doc.Find(`[data-message-author-role]`).Each(func(_ int, roleNode *goquery.Selection) {
-		role := normalizeRole(roleNode.AttrOr("data-message-author-role", ""))
-		if role == "" || hasRoleAncestor(roleNode) || isHiddenElement(roleNode) {
-			return
-		}
-
-		content := roleNode.Clone()
-		cleanConversationContent(content, role)
-		if strings.TrimSpace(conversationSelectionText(content)) == "" {
-			return
-		}
-		turns = append(turns, conversationTurn{role: role, content: content})
-	})
-	return turns
-}
-
-func findRoleNode(article *goquery.Selection) (*goquery.Selection, string) {
-	if article == nil || article.Length() == 0 {
-		return nil, ""
-	}
-	if rawRole, ok := article.Attr("data-message-author-role"); ok {
-		role := normalizeRole(rawRole)
-		if role == "" {
-			return nil, ""
-		}
-		return article, role
+func conversationRole(selection *goquery.Selection) string {
+	if rawRole, ok := selection.Attr("data-message-author-role"); ok {
+		return normalizeRole(rawRole)
 	}
-
-	var selected *goquery.Selection
-	role := ""
-	article.Find(`[data-message-author-role]`).EachWithBreak(func(_ int, candidate *goquery.Selection) bool {
-		candidateRole := normalizeRole(candidate.AttrOr("data-message-author-role", ""))
-		if candidateRole == "" || hasRoleAncestor(candidate) {
-			return true
-		}
-		selected = candidate
-		role = candidateRole
-		return false
-	})
-	return selected, role
+	return normalizeRole(selection.AttrOr("data-turn", ""))
 }
 
 func normalizeRole(raw string) string {
@@ -265,9 +229,12 @@ func normalizeRole(raw string) string {
 
 func hasRoleAncestor(selection *goquery.Selection) bool {
 	found := fals
```

**File**: `server/extractor/extractors/chatgpt/extractor_test.go` (modified, +95/-2)
```diff
@@ -3,6 +3,7 @@
 package chatgpt
 
 import (
+	"fmt"
 	"os"
 	"strings"
 	"testing"
@@ -11,6 +12,96 @@ import (
 	"github.com/asciimoo/hister/server/extractor/sdk"
 )
 
+func TestExtractsTurnMarkers(t *testing.T) {
+	for _, tag := range []string{"article", "section", "div"} {
+		for _, legacy := range []bool{false, true} {
+			t.Run(fmt.Sprintf("%s/legacy=%v", tag, legacy), func(t *testing.T) {
+				question := `<p>Explain <strong>gravity</strong>.</p>`
+				followup := `<section data-testid="conversation-turn-3" data-turn="user"><p>Thanks.</p></section>`
+				if legacy {
+					question = `<div data-message-author-role="user">` + question + `</div>`
+					followup = `<div data-message-author-role="user"><p>Thanks.</p></div>`
+				}
+				doc := &document.Document{
+					URL: "https://chatgpt.com/c/turn-markers",
+					HTML: fmt.Sprintf(`<html><body><nav>Sidebar content</nav><main>
+						<%[1]s data-testid="conversation-turn-1" data-turn="user">%[2]s</%[1]s>
+						<%[1]s data-testid="conversation-turn-2" data-turn="assistant">
+							<h4 class="sr-only">ChatGPT said:</h4>
+							<div class="markdown"><p>Gravity attracts masses.</p><pre><code>F = G * m1 * m2 / r^2</code></pre></div>
+							<button>Copy answer</button><script>ignored()</script>
+						</%[1]s>
+						%[3]s
+					</main></body></html>`, tag, question, followup),
+				}
+				extractor := &ChatGPTExtractor{}
+				decision, err := extractor.Extract(doc).Unpack()
+				if err != nil || decision != sdk.ExtractorSuccess {
+					t.Fatalf("Extract returned decision %v and error %v", decision, err)
+				}
+				want := "User:\nExplain gravity.\n\nAssistant:\nGravity attracts masses.\nF = G * m1 * m2 / r^2\n\nUser:\nThanks."
+				if doc.Text != want {
+					t.Fatalf("indexed text = %q, want %q", doc.Text, want)
+				}
+				preview, decision, err := extractor.Preview(doc).Unpack()
+				if err != nil || decision != sdk.ExtractorSuccess {
+					t.Fatalf("Preview returned decision %v and error %v", decision, err)
+				}
+				for _, want := range []string{"<strong>gravity</strong>", "<pre><code>F = G * m1 * m2 / r^2</code></pre>"} {
+					if !strings.Contains(preview.Content, want) {
+						t.Errorf("preview is missing %q: %s", want, preview.Content)
+					}
+				}
+				if strings.Count(preview.Content, "<h2>User</h2>") != 2 || strings.Count(preview.Content, "<h2>Assistant</h2>") != 1 {
+					t.Errorf("preview has missing or duplicate turns: %s", preview.Content)
+				}
+				for _, unwanted := range []string{"Sidebar content", "ChatGPT said:", "Copy answer", "ignored()"} {
+					if strings.Contains(preview.Content, unwanted) {
+						t.Errorf("preview contains %q: %s", unwanted, preview.Content)
+					}
+				}
+			})
+		}
+	}
+}
+
+func TestTurnMarkersRespectExplicitRolesAndVisibility(t *testing.T) {
+	doc := &document.Document{
+		URL: "https://chatgpt.com/c/turn-visibility",
+		HTML: `<html><body>
+			<section data-testid="conversation-turn-1" data-turn="user" hidden><p>Hidden user</p></section>
+			<div aria-hidden="true"><section data-testid="conversation-turn-2" data-turn="assistant"><p>Hidden ancestor</p></section></div>
+			<section data-testid="conversation-turn-3" data-turn="assistant"><div data-message-author-role="assistant" hidden>Hidden message</div>Turn controls</section>
+			<section data-testid="conversation-turn-4" data-turn="system"><div data-message-author-role="user">Internal user</div></section>
+			<section data-testid="conversation-turn-5" data-turn="assistant"><div data-message-author-role="tool">Tool output</div>Turn controls</section>
+			<section data-testid="conversation-turn-6" data-turn="assistant"><div data-message-author-role="assistant"><p>First answer.</p></div><div data-message-author-role="assistant"><p>Second answer.</p></div></section>
+			<section data-testid="conversation-turn-7" data-turn="user"><section data-testid="conversation-turn-nested" data-turn="user"><p>Follow up.</p></section></section>
+			<section data-testid="conversation-turn-8" data-turn="assistant"><div hidden>Hidden content</div><p>Final answer.</p></section>
+			<section data-testid="conversation-turn-9" data-turn="assistant" data-message-author-role="tool">Explicit tool</section>
+			<section data-testid="conversation-turn-10" data-turn="assistant"><h4 class="sr-only">ChatGPT said:</h4><button>Copy</button></section>
+			<div data-turn="user">Unrelated element</div>
+		</body></html>`,
+	}
+	extractor := &ChatGPTExtractor{}
+	decision, err := extractor.Extract(doc).Unpack()
+	if err != nil || decision != sdk.ExtractorSuccess {
+		t.Fatalf("Extract returned decision %v and error %v", decision, err)
+	}
+	want := "Assistant:\nFirst answer.\n\nAssistant:\nSecond answer.\n\nUser:\nFollow up.\n\nAssistant:\nFinal answer."
+	if doc.Text != want {
+		t.Fatalf("indexed text = %q, want %q", doc.Text, want)
+	}
+	preview, decision, err := extractor.Preview(doc).Unpack()
+	if err != nil || decision != sdk.ExtractorSuccess {
+		t.Fatalf("Preview returned decis
```

---

### Incident Patch 12: `bb2dc837` (2026-09-25)
**Commit Message**: [doc] add search ui document deletion docs - closes #789

**File**: `webui/website/src/content/docs/data-lifecycle.md` (modified, +5/-1)
```diff
@@ -93,7 +93,11 @@ See [Disable Previews](configuration#disable-previews) for the user interface ef
 
 ## Deleting Documents
 
-Delete one result from the web or terminal interface, or delete every document matching a query with the command line client:
+Delete one result from the web or terminal interface, or prune every document matching a search query from the search web UI or command line client.
+
+In the search web UI, enter a query such as `domain:example.com` or `updated:>90d`. Refine the query while reviewing the results until it selects the documents you want to remove. Open **Actions**, click **Delete all matching results**, and confirm the deletion. Like `hister delete`, this removes every document matching the query, including matches beyond the currently displayed results. This lets you quickly build and adjust cleanup queries without leaving the search page.
+
+To delete matching documents from the command line:
 
 ```bash
 hister delete 'domain:example.com'
```

**File**: `webui/website/src/content/docs/query-language.md` (modified, +10/-0)
```diff
@@ -418,6 +418,16 @@ domain:github.com title:(security|vulnerability) -closed
 
 ## Common Use Cases
 
+### Pruning Unwanted Documents
+
+Use the search web UI to build a query that selects unwanted documents. For example, find pages from a domain that have not been updated for more than 90 days:
+
+```textplain
+domain:example.com updated:>90d
+```
+
+Review the results and refine the query as needed, then open **Actions**, click **Delete all matching results**, and confirm. This deletes every document matching the query, like `hister delete`, so you can quickly clean up unwanted results as you search. See [Deleting Documents](data-lifecycle#deleting-documents) for details about what deletion removes.
+
 ### Finding Documentation
 
 ```textplain
```

**File**: `webui/website/src/content/posts/how-i-use-hister.md` (modified, +2/-0)
```diff
@@ -120,6 +120,8 @@ The `--dry` flag lets you preview what would be deleted before committing:
 hister delete --dry "domain:old-framework.io"
 ```
 
+You can also prune directly from the search web UI. Enter a query such as `domain:old-framework.io`, review the results, and adjust the query until it selects the content you want to remove. Then open **Actions**, click **Delete all matching results**, and confirm. Like `hister delete`, this deletes every document matching the query. Being able to refine the query while reviewing matches makes it quick to clean up unwanted results without leaving the search page.
+
 ## Pre-indexing Reference Material
 
 The browser extension indexes pages as you visit them, which means documentation you have never opened is invisible to Hister. I close this gap by using the crawler to pre-index reference material I expect to look up repeatedly.
```

---

### Incident Patch 13: `2bf3c9a9` (2026-09-25)
**Commit Message**: [fix] increase the capacity of the qute browser event parsing

**File**: `cmd/companion/qutebrowser/cdp.go` (modified, +4/-10)
```diff
@@ -49,7 +49,7 @@ type cdpClient struct {
 	pendingMu sync.Mutex
 	pending   map[int64]chan rpcMessage
 
-	events chan rpcMessage
+	events *cdpEventQueue
 	done   chan struct{}
 
 	closeOnce sync.Once
@@ -83,7 +83,7 @@ func dialCDP(
 	client := &cdpClient{
 		conn:    conn,
 		pending: make(map[int64]chan rpcMessage),
-		events:  make(chan rpcMessage, 512),
+		events:  newCDPEventQueue(),
 		done:    make(chan struct{}),
 	}
 	go client.readLoop()
@@ -228,14 +228,8 @@ func (c *cdpClient) readLoop() {
 			}
 			continue
 		}
-		if message.Method == "" {
-			continue
-		}
-		select {
-		case c.events <- message:
-		default:
-			c.fail(errors.New("DevTools event buffer is full"))
-			return
+		if isMonitoredEvent(message.Method) {
+			c.events.push(message)
 		}
 	}
 }
```

**File**: `cmd/companion/qutebrowser/cdp_test.go` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+package qutebrowser
+
+import (
+	"context"
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"github.com/gorilla/websocket"
+)
+
+func TestMonitorInitializesManyTabs(t *testing.T) {
+	const tabCount = 300
+	targets := make([]targetInfo, tabCount)
+	for i := range targets {
+		targets[i] = targetInfo{
+			TargetID: fmt.Sprintf("page-%d", i),
+			Type:     "page",
+			URL:      fmt.Sprintf("https://example.com/%d", i),
+		}
+	}
+	client := newTestCDPClient(t, func(conn *websocket.Conn, request rpcMessage) error {
+		var result any = struct{}{}
+		switch request.Method {
+		case "Target.setDiscoverTargets":
+			for _, target := range targets {
+				params, err := json.Marshal(map[string]any{"targetInfo": target})
+				if err != nil {
+					return err
+				}
+				if err := conn.WriteJSON(rpcMessage{
+					Method: "Target.targetCreated",
+					Params: params,
+				}); err != nil {
+					return err
+				}
+			}
+		case "Target.getTargets":
+			result = map[string]any{"targetInfos": targets}
+		case "Target.attachToTarget":
+			var params struct {
+				TargetID string `json:"targetId"`
+			}
+			if err := json.Unmarshal(request.Params, &params); err != nil {
+				return err
+			}
+			result = map[string]any{"sessionId": params.TargetID}
+		case "Page.enable":
+			if err := conn.WriteJSON(rpcMessage{
+				Method:    "Page.loadEventFired",
+				SessionID: request.SessionID,
+				Params:    json.RawMessage(`{"timestamp":1}`),
+			}); err != nil {
+				return err
+			}
+		case "Page.getFrameTree":
+			result = map[string]any{"frameTree": map[string]any{"frame": map[string]any{"id": request.SessionID}}}
+		case "Page.createIsolatedWorld":
+			result = map[string]any{"executionContextId": 1}
+		}
+		encoded, err := json.Marshal(result)
+		if err != nil {
+			return err
+		}
+		return conn.WriteJSON(rpcMessage{ID: request.ID, Result: encoded})
+	})
+
+	input := DefaultOptions()
+	input.InitialDelay = time.Hour
+	opts, err := normalizeOptions(input)
+	if err != nil {
+		t.Fatal(err)
+	}
+	m := &monitor{
+		companion:   newCompanion(opts, &recordingSubmitter{}),
+		client:      client,
+		bindingName: "testBinding",
+		pages:       make(map[string]*pageState),
+		targets:     make(map[string]string),
+		extraction:  make(chan extractionDue, tabCount),
+	}
+	t.Cleanup(m.stop)
+	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
+	defer cancel()
+	if err := m.initialize(ctx); err != nil {
+		t.Fatal(err)
+	}
+	if len(m.pages) != tabCount {
+		t.Fatalf("watching %d pages, want %d", len(m.pages), tabCount)
+	}
+	select {
+	case <-client.done:
+		t.Fatalf("connection ended during initialization: %v", client.connectionError())
+	default:
+	}
+
+	// Discovery and page setup events must remain available after initialization.
+	for _, method := range []string{"Target.targetCreated", "Page.loadEventFired"} {
+		for _, target := range targets {
+			event := nextTestCDPEvent(t, ctx, client)
+			if event.Method != method {
+				t.Fatalf("event method = %q, want %q", event.Method, method)
+			}
+			if method == "Page.loadEventFired" && event.SessionID != target.TargetID {
+				t.Fatalf("event session = %q, want %q", event.SessionID, target.TargetID)
+			}
+			m.handleEvent(ctx, event)
+		}
+	}
+}
+
+func TestCDPEventBurstPreservesRepliesAndOrder(t *testing.T) {
+	const eventCount = 4096
+	methods := []string{
+		"Target.targetCreated", "Target.targetInfoChanged",
+		"Target.targetDestroyed", "Target.targetCrashed", "Target.detachedFromTarget",
+		"Page.frameNavigated", "Page.loadEventFired", "Page.navigatedWithinDocument",
+		"Page.lifecycleEvent", "Runtime.bindingCalled",
+	}
+	eventAt := func(i int) rpcMessage {
+		return rpcMessage{
+			Method:    methods[i%len(methods)],
+			SessionID: fmt.Sprintf("session-%d", i),
+			Params:    json.RawMessage(fmt.Sprintf(`{"sequence":%d}`, i)),
+		}
+	}
+	client := newTestCDPClient(t, func(conn *websocket.Conn, request rpcMessage) error {
+		for i := range eventCount {
+			if err := conn.WriteJSON(rpcMessage{
+				Method: "Runtime.consoleAPICalled",
+				Params: json.RawMessage(`{"type":"log"}`),
+			}); err != nil {
+				return err
+			}
+			if err := conn.WriteJSON(eventAt(i)); err != nil {
+				return err
+			}
+		}
+		return conn.WriteJSON(rpcMessage{ID: request.ID, Result: json.RawMessage(`{"product":"test"}`)})
+	})
+	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
+	defer cancel()
+	// Cover both paused and active consumers, reusing the queue after it empties.
+	for _, consumeDuringCall := range []bool{false, true} {
+		var result struct {
+			Product string `json:"product"`
+		}
+		replied := make(chan error, 1)
+		go func() {
+			replied <- client.call(ctx, "Browser.getVersion", nil, "", &result)
+		}()
+		waitForReply := func() {
+			t.Helper()
+			select {
+			case err := <-replied:
+				if err != nil {
+					t.Fatalf("command failed while events were queued: %v", err)
+				}
+			case <-ctx.Done():
+		
```

**File**: `cmd/companion/qutebrowser/companion.go` (modified, +2/-2)
```diff
@@ -187,8 +187,8 @@ func (m *monitor) eventLoop(ctx context.Context) error {
 			return ctx.Err()
 		case <-m.client.done:
 			return m.client.connectionError()
-		case event := <-m.client.events:
-			m.handleEvent(ctx, event)
+		case <-m.client.events.ready:
+			m.handleEvent(ctx, m.client.events.pop())
 		case due := <-m.extraction:
 			m.handleExtractionDue(ctx, due)
 		case result := <-m.results:
```

**File**: `cmd/companion/qutebrowser/events.go` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+package qutebrowser
+
+import "sync"
+
+// cdpEventQueue lets the socket reader keep delivering command replies while
+// the monitor is busy attaching pages. Event handling can itself wait for a
+// command reply, so queueing an event must never wait for the monitor.
+type cdpEventQueue struct {
+	mu      sync.Mutex
+	pending []rpcMessage
+	ready   chan struct{}
+}
+
+func newCDPEventQueue() *cdpEventQueue {
+	return &cdpEventQueue{ready: make(chan struct{}, 1)}
+}
+
+func (q *cdpEventQueue) push(event rpcMessage) {
+	q.mu.Lock()
+	defer q.mu.Unlock()
+
+	q.pending = append(q.pending, event)
+	if len(q.pending) == 1 {
+		q.ready <- struct{}{}
+	}
+}
+
+// pop is called by the monitor after receiving a notification from ready.
+func (q *cdpEventQueue) pop() rpcMessage {
+	q.mu.Lock()
+	defer q.mu.Unlock()
+
+	event := q.pending[0]
+	q.pending[0] = rpcMessage{}
+	q.pending = q.pending[1:]
+	if len(q.pending) == 0 {
+		q.pending = nil
+	} else {
+		q.ready <- struct{}{}
+	}
+	return event
+}
+
+func isMonitoredEvent(method string) bool {
+	switch method {
+	case "Target.targetCreated", "Target.targetInfoChanged",
+		"Target.targetDestroyed", "Target.targetCrashed", "Target.detachedFromTarget",
+		"Page.frameNavigated", "Page.loadEventFired", "Page.navigatedWithinDocument",
+		"Page.lifecycleEvent", "Runtime.bindingCalled":
+		return true
+	default:
+		return false
+	}
+}
```

---

### Incident Patch 14: `28ed5aa6` (2026-09-24)
**Commit Message**: [fix] throttle bleve write error retries to prevent excessive cpu usage

**File**: `server/indexer/indexer.go` (modified, +25/-5)
```diff
@@ -35,6 +35,7 @@ import (
 	"github.com/blevesearch/bleve/v2/analysis/token/lowercase"
 	"github.com/blevesearch/bleve/v2/analysis/tokenizer/single"
 	"github.com/blevesearch/bleve/v2/analysis/tokenizer/unicode"
+	"github.com/blevesearch/bleve/v2/index/scorch"
 	"github.com/blevesearch/bleve/v2/mapping"
 	"github.com/blevesearch/bleve/v2/registry"
 	"github.com/blevesearch/bleve/v2/search"
@@ -78,10 +79,12 @@ type Indexer struct {
 }
 
 const (
-	defaultIndexerName  = "index.db"
-	langIndexerName     = "index_%s.db"
-	updatedBackfillKey  = "hister.updated_backfill_complete"
-	updatedBackfillSize = 200
+	defaultIndexerName      = "index.db"
+	langIndexerName         = "index_%s.db"
+	updatedBackfillKey      = "hister.updated_backfill_complete"
+	updatedBackfillSize     = 200
+	bleveAsyncErrorCallback = "hister_background_error"
+	bleveErrorRetryDelay    = time.Second
 )
 
 type Query struct {
@@ -328,7 +331,8 @@ var (
 	ErrEmptyFilter                      = errors.New("query must not be empty")
 	ErrFileURLNotAllowed                = errors.New("file URL is not allowed")
 	bleveConfig          map[string]any = map[string]any{
-		"bolt_timeout": "2s",
+		"bolt_timeout":           "2s",
+		"asyncErrorCallbackName": bleveAsyncErrorCallback,
 		// https://github.com/blevesearch/bleve/blob/master/docs/persister.md
 		"scorchPersisterOptions": map[string]any{
 			"NumPersisterWorkers":           4,
@@ -341,6 +345,22 @@ var (
 	}
 )
 
+func init() {
+	// Bleve's callback registry must only be modified during initialization.
+	scorch.RegistryAsyncErrorCallbacks[bleveAsyncErrorCallback] = handleBleveAsyncError
+}
+
+func handleBleveAsyncError(err error, path string) {
+	log.Error().Err(err).Str("index", path).Msg("Search index background operation failed")
+	if errors.Is(err, scorch.ErrPersist) {
+		// Scorch calls this hook synchronously before retrying persistence or
+		// merge failures. Pace both loops without delaying successful writes.
+		// Each failing worker logs at most once per second. The wait is bounded
+		// so that the worker can still finish during shutdown.
+		time.Sleep(bleveErrorRetryDelay)
+	}
+}
+
 // New creates an independent indexer instance from cfg.
 func New(cfg *config.Config) (*Indexer, error) {
 	sp := make([]string, 0, len(cfg.SensitiveContentPatterns))
```

---

### Incident Patch 15: `960bf020` (2026-09-23)
**Commit Message**: [fix] handle embedding dimension mismatches - fixes #784

**File**: `server/indexer/embedding_queue_test.go` (modified, +72/-0)
```diff
@@ -15,9 +15,11 @@ import (
 	"testing"
 	"time"
 
+	"github.com/asciimoo/hister/config"
 	"github.com/asciimoo/hister/server/document"
 	"github.com/asciimoo/hister/server/model"
 	"github.com/asciimoo/hister/server/testutil"
+	"github.com/asciimoo/hister/server/vectorstore"
 )
 
 func embeddingTestServer(t *testing.T, requests *atomic.Int64) *httptest.Server {
@@ -126,6 +128,76 @@ func TestEmbeddingQueueSkipsUnchangedDocumentText(t *testing.T) {
 	waitForEmbeddingJobs(t, &requests, 2)
 }
 
+func TestReindexRebuildsEmbeddingsAfterDimensionChange(t *testing.T) {
+	var requests atomic.Int64
+	server := embeddingTestServer(t, &requests)
+	defer server.Close()
+	cfg := testutil.Config(t)
+	cfg.SemanticSearch.EmbeddingEndpoint = server.URL
+	cfg.SemanticSearch.EmbeddingModel = "test"
+	cfg.SemanticSearch.Dimensions = 768
+	cfg.SemanticSearch.MaxEmbeddingConcurrency = 1
+	testutil.InitModelWithConfig(t, cfg)
+	idx := newTestIndexer(t, cfg)
+	doc := &document.Document{
+		URL:       "https://example.com/changed-dimensions",
+		Title:     "Dimension change",
+		Text:      "Document to embed again with the new dimensions",
+		Processed: true,
+	}
+	if err := idx.Add(doc); err != nil {
+		idx.Close()
+		t.Fatal(err)
+	}
+	idx.Close()
+
+	// Seed an existing vector table with a size that differs from the endpoint.
+	store, err := vectorstore.New(cfg)
+	if err != nil {
+		t.Fatal(err)
+	}
+	t.Cleanup(func() { _ = store.Close() })
+	if err := store.Init(); err != nil {
+		t.Fatal(err)
+	}
+	oldVector := make([]float32, 768)
+	oldVector[0] = 1
+	if err := store.PutChunks(doc.ID(), 0, []vectorstore.Chunk{{Text: doc.Text, Embedding: oldVector}}); err != nil {
+		t.Fatal(err)
+	}
+	if err := store.Close(); err != nil {
+		t.Fatal(err)
+	}
+
+	cfg.SemanticSearch.Enable = true
+	cfg.SemanticSearch.Dimensions = 2
+	idx = newTestIndexer(t, cfg)
+	defer idx.Close()
+	if !idx.SemanticSearchEnabled() {
+		t.Fatal("schema mismatch disabled the vector store needed for reindexing")
+	}
+	if err := idx.Reindex(&config.Rules{}, false, false, false, nil); err != nil {
+		t.Fatal(err)
+	}
+	results, err := idx.vectorStore.Search([]float32{0.25, 0.75}, 5, 0.9, 0)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(results) == 0 || results[0].DocID != doc.ID() {
+		t.Fatalf("semantic search after dimension change = %#v, want %q", results, doc.ID())
+	}
+	if idx.GetByURLAndUser(doc.URL, 0) == nil {
+		t.Fatal("document missing after reindex")
+	}
+	fingerprint, err := idx.GetEmbeddingFingerprint()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if fingerprint != cfg.SemanticSearch.EmbeddingFingerprint() {
+		t.Fatal("reindex did not record the updated embedding configuration")
+	}
+}
+
 func TestEmbeddingQueueReprocessesDocumentChangedWhileActive(t *testing.T) {
 	var requests atomic.Int64
 	var inputsMu sync.Mutex
```

**File**: `server/indexer/indexer.go` (modified, +7/-8)
```diff
@@ -712,14 +712,6 @@ func (idx *Indexer) reindex(ctx context.Context, basePath string, rules *config.
 	// separate file from the Bleve indexes).
 	vs := idx.vectorStore
 	embedder := idx.embedder
-	if vs != nil && embedder != nil {
-		if err := vs.Clear(); err != nil {
-			log.Warn().Err(err).Msg("failed to clear vector store before reindex")
-		} else {
-			tmpIdx.vectorStore = vs
-			tmpIdx.embedder = embedder
-		}
-	}
 	abortReindex := func(err error) error {
 		// The live indexer still owns the shared vector store when reindexing
 		// aborts. Do not let closing the temporary indexer close that store.
@@ -730,6 +722,13 @@ func (idx *Indexer) reindex(ctx context.Context, basePath string, rules *config.
 		}
 		return err
 	}
+	if vs != nil && embedder != nil {
+		if err := vs.Clear(); err != nil {
+			return abortReindex(fmt.Errorf("rebuild vector store before reindex: %w", err))
+		}
+		tmpIdx.vectorStore = vs
+		tmpIdx.embedder = embedder
+	}
 	q := query.NewMatchAllQuery()
 	var total uint64
 	for name, source := range sourceIndexes {
```

**File**: `server/indexer/metadata_test.go` (modified, +41/-2)
```diff
@@ -3,6 +3,7 @@
 package indexer
 
 import (
+	"errors"
 	"os"
 	"path/filepath"
 	"testing"
@@ -15,7 +16,9 @@ import (
 	"github.com/blevesearch/bleve/v2"
 )
 
-type metadataVectorStore struct{}
+type metadataVectorStore struct {
+	clearErr error
+}
 
 func (*metadataVectorStore) Init() error { return nil }
 
@@ -27,7 +30,7 @@ func (*metadataVectorStore) Search([]float32, int, float64, uint) ([]vectorstore
 	return nil, nil
 }
 
-func (*metadataVectorStore) Clear() error { return nil }
+func (s *metadataVectorStore) Clear() error { return s.clearErr }
 
 func (*metadataVectorStore) Close() error { return nil }
 
@@ -378,3 +381,39 @@ func TestReindexStoresActiveEmbeddingFingerprint(t *testing.T) {
 		t.Fatalf("embedding fingerprint = %q, want %q", storedFingerprint, wantFingerprint)
 	}
 }
+
+func TestReindexPreservesIndexWhenVectorRebuildFails(t *testing.T) {
+	cfg := testutil.Config(t)
+	idx, err := initializeIndexer(cfg.FullPath(""), false, false, "stored-embedding")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer idx.Close()
+	doc := &document.Document{URL: "https://example.com/rebuild-failure", Text: "original text", Processed: true}
+	if err := idx.Add(doc); err != nil {
+		t.Fatal(err)
+	}
+	idx.semanticConfig = config.SemanticSearch{Enable: true, Dimensions: 4}
+	idx.embedder = vectorstore.NewEmbedder(&idx.semanticConfig)
+	wantErr := errors.New("vector table rebuild failed")
+	idx.vectorStore = &metadataVectorStore{clearErr: wantErr}
+	if err := idx.Reindex(&config.Rules{}, false, false, false, nil); !errors.Is(err, wantErr) {
+		t.Fatalf("Reindex error = %v, want %v", err, wantErr)
+	}
+	if idx.GetByURLAndUser(doc.URL, 0) == nil {
+		t.Fatal("existing document was lost after failed vector rebuild")
+	}
+	fingerprint, err := idx.GetEmbeddingFingerprint()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if fingerprint != "stored-embedding" {
+		t.Fatalf("embedding fingerprint changed after failed rebuild: %q", fingerprint)
+	}
+	if idx.reindexInProgress.Load() {
+		t.Fatal("reindex remains in progress after failed vector rebuild")
+	}
+	if _, err := os.Stat(filepath.Join(cfg.App.Directory, "reindex")); !os.IsNotExist(err) {
+		t.Fatalf("temporary reindex directory remains after failure: %v", err)
+	}
+}
```

**File**: `server/vectorstore/sqlite.go` (modified, +42/-7)
```diff
@@ -9,6 +9,8 @@ import (
 	"fmt"
 	"math"
 	"path/filepath"
+	"regexp"
+	"strconv"
 	"strings"
 
 	"github.com/asciimoo/hister/config"
@@ -19,6 +21,8 @@ import (
 
 const sqliteVectorSchemaVersion = 1
 
+var sqliteEmbeddingColumn = regexp.MustCompile(`(?i)\bembedding\s+float\s*\[\s*(\d+)\s*\]`)
+
 type sqliteVectorStore struct {
 	db         *sql.DB
 	dimensions int
@@ -97,12 +101,12 @@ func (s *sqliteVectorStore) Init() error {
 	return nil
 }
 
-func (s *sqliteVectorStore) createEmbeddingsTable(tx *sql.Tx) error {
+func (s *sqliteVectorStore) createEmbeddingsTable(tx *sql.Tx, dimensions int) error {
 	stmt := fmt.Sprintf(`CREATE VIRTUAL TABLE embeddings USING vec0(
 		user_id INTEGER PARTITION KEY,
 		chunk_key TEXT PRIMARY KEY,
 		embedding FLOAT[%d] distance_metric=cosine
-	)`, s.dimensions)
+	)`, dimensions)
 	if _, err := tx.Exec(stmt); err != nil {
 		return fmt.Errorf("create embeddings table: %w", err)
 	}
@@ -113,7 +117,7 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	var schema string
 	err := tx.QueryRow(`SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'embeddings'`).Scan(&schema)
 	if errors.Is(err, sql.ErrNoRows) {
-		return -1, s.createEmbeddingsTable(tx)
+		return -1, s.createEmbeddingsTable(tx, s.dimensions)
 	}
 	if err != nil {
 		return -1, fmt.Errorf("read embeddings table schema: %w", err)
@@ -123,6 +127,20 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	if !strings.Contains(normalizedSchema, "usingvec0(") {
 		return -1, errors.New("existing embeddings table is not a vec0 virtual table")
 	}
+	column := sqliteEmbeddingColumn.FindStringSubmatch(schema)
+	if len(column) != 2 {
+		return -1, errors.New("cannot read dimensions from existing embeddings table")
+	}
+	storedDimensions, err := strconv.Atoi(column[1])
+	if err != nil {
+		return -1, fmt.Errorf("read stored embedding dimensions: %w", err)
+	}
+	if storedDimensions != s.dimensions {
+		// Keep existing vectors until the user requests a reindex. Initialization
+		// must still succeed so the live indexer can rebuild this store.
+		log.Warn().Int("stored_dimensions", storedDimensions).Int("configured_dimensions", s.dimensions).
+			Msg("vector store dimensions differ from semantic_search.dimensions. Run `hister reindex` to rebuild embeddings")
+	}
 	if strings.Contains(normalizedSchema, "distance_metric=cosine") {
 		return -1, nil
 	}
@@ -146,7 +164,9 @@ func (s *sqliteVectorStore) initEmbeddingsTable(tx *sql.Tx) (int64, error) {
 	if _, err := tx.Exec(`DROP TABLE embeddings`); err != nil {
 		return -1, fmt.Errorf("drop L2 embeddings table: %w", err)
 	}
-	if err := s.createEmbeddingsTable(tx); err != nil {
+	// A distance metric migration preserves vectors and their original size.
+	// Only a reindex can replace them with vectors of a different size.
+	if err := s.createEmbeddingsTable(tx, storedDimensions); err != nil {
 		return -1, err
 	}
 	restoreResult, err := tx.Exec(`INSERT INTO embeddings(user_id, chunk_key, embedding)
@@ -294,12 +314,27 @@ func (s *sqliteVectorStore) searchUser(vector []float32, topK int, threshold flo
 }
 
 func (s *sqliteVectorStore) Clear() error {
-	if _, err := s.db.Exec(`DELETE FROM embeddings`); err != nil {
-		return fmt.Errorf("clear embeddings: %w", err)
+	tx, err := s.db.Begin()
+	if err != nil {
+		return fmt.Errorf("begin vector store rebuild: %w", err)
+	}
+	defer func() {
+		_ = tx.Rollback()
+	}()
+	// vec0 column dimensions cannot be altered. Recreate the table so reindex
+	// also applies dimension changes from the semantic search configuration.
+	if _, err := tx.Exec(`DROP TABLE embeddings`); err != nil {
+		return fmt.Errorf("drop embeddings table: %w", err)
 	}
-	if _, err := s.db.Exec(`DELETE FROM chunk_meta`); err != nil {
+	if err := s.createEmbeddingsTable(tx, s.dimensions); err != nil {
+		return err
+	}
+	if _, err := tx.Exec(`DELETE FROM chunk_meta`); err != nil {
 		return fmt.Errorf("clear chunk_meta: %w", err)
 	}
+	if err := tx.Commit(); err != nil {
+		return fmt.Errorf("commit vector store rebuild: %w", err)
+	}
 	return nil
 }
 
```

**File**: `webui/website/src/content/docs/configuration.md` (modified, +2/-0)
```diff
@@ -750,6 +750,8 @@ The vector store backend is chosen automatically based on `server.database`:
 - **SQLite** (default) stores vectors in a separate `vectors.sqlite3` file in the same directory as the main database, using the [sqlite-vec](https://github.com/asg017/sqlite-vec) extension. No extra setup required.
 - **PostgreSQL** stores vectors in the same database as the main data using the [pgvector](https://github.com/pgvector/pgvector) extension. Hister uses an HNSW index with the `vector` type, which supports at most 2000 dimensions. Make sure `pgvector` is installed and enabled (`CREATE EXTENSION vector;`) before starting Hister.
 
+Set `semantic_search.dimensions` to the output size supported by your embedding endpoint. If the endpoint returns a different size, Hister rejects the embeddings. After changing dimensions with SQLite, restart Hister and run `hister reindex` to rebuild the vector table and regenerate embeddings. Existing vectors are preserved until reindexing begins, and startup logs report when the stored dimensions differ from the configuration.
+
 ### Example
 
 ```yaml
```

#### Recent Merged Pull Requests:
- **PR #811** (2026-10-05): Bump the npm-deps group across 1 directory with 7 updates (@dependabot[bot])
- **PR #810** (2026-10-05): Update Nix hashes (@github-actions[bot])
- **PR #809** (closed): Bump the npm-deps group with 8 updates (@dependabot[bot])
- **PR #808** (2026-10-05): Bump codeberg.org/readeck/go-readability/v2 from 2.1.2 to 2.1.3 in the go-deps group (@dependabot[bot])
- **PR #807** (2026-10-05): Bump the nix-deps group with 2 updates (@dependabot[bot])
- **PR #806** (2026-10-05): [fix] return results for a query made only of negated terms (@kevin9327)
- **PR #804** (2026-10-03): Migrate to Sveltekit 3 (@4evy)
- **PR #803** (2026-10-02):  fix(metrics): use native histograms for search/indexing latency (@akshayvibe)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
