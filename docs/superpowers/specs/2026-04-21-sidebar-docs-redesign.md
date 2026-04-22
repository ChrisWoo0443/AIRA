# Sidebar Docs Tab + Doc Context Dropdown + Toggle Button Redesign

## Goal

Simplify the three roughest UI surfaces left after the main revamp: the sidebar docs tab (too cramped, too many controls), the doc context dropdown (checkbox list feels clunky), and sidebar discoverability (keyboard-only toggle). All changes are visual -- no new functionality, no backend changes.

## 1. Sidebar Toggle Button

A small icon button in the top-left corner of the main chat area.

- **Size**: 32x32px
- **Position**: fixed to top-left of chat area, `top: 12px`, `left: 12px`, `z-index: 1`
- **Icon**: `PanelLeft` from lucide-react (sidebar panel icon)
- **Styling**: `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 8px`. Icon color `var(--color-text-secondary)`. Hover: `background: rgba(255,255,255,0.08)`.
- **Behavior**: click calls `toggle()` from sidebar hook. Same as Cmd+B.
- **Visibility**: hidden when sidebar is open (sidebar covers it anyway). Visible when sidebar is closed.
- **Remove**: the "Cmd+B sidebar" text hint from ChatInput's bottom row.

## 2. Sidebar Docs Tab -- Minimal List

### Remove
- Search input
- Sort button and sort cycle logic
- Select-all checkbox row
- Bulk delete bar
- "Documents" uppercase header in App.tsx
- Dashed drag-and-drop zone box
- File type hint text ("PDF, TXT, MD - max 10MB")

### Add Documents Button
- Full-width button at top of docs content
- Styling: `background: rgba(255,255,255,0.03)`, `border: 1px dashed rgba(255,255,255,0.08)`, `border-radius: 8px`, `padding: 8px`, centered content
- Content: `+` character + "Add documents" text, `font-size: 11px`, `color: var(--color-text-secondary)`
- Click triggers file picker (same as current upload button)
- Hover: `background: rgba(255,255,255,0.06)`

### Drop Zone
- The entire sidebar content area (the scrollable div in the Sidebar component) acts as the drop zone
- No visible dashed box -- the drop zone is invisible until a file is dragged over
- On drag-over: the "Add documents" button highlights with accent border (`border: 1px dashed var(--color-accent)`, `background: rgba(163, 144, 112, 0.08)`)
- Drop accepted file types: PDF, TXT, MD (max 10MB) -- same as current

### Doc Count
- Small text below the add button: "N documents", `font-size: 10px`, `color: var(--color-text-tertiary)`
- Only shown when documents.length > 0

### Document Rows
- Each row: 20px file type badge + filename + size + hover delete
- Badge: same `FileTypeBadge` component but at 20x20px (already 20px in mockup -- current is 24px, shrink to 20px)
- Filename: `font-size: 11px`, `color: var(--color-text-primary)`, ellipsis overflow
- Size: below filename, `font-size: 9px`, `color: var(--color-text-tertiary)`
- Delete: quiet "x" character (or X icon), `color: var(--color-text-tertiary)`, `opacity: 0` by default, `opacity: 1` on row hover. Click triggers `window.confirm()` then delete.
- Row padding: `6px 8px`, border-radius 6px
- Row hover: `background: rgba(255,255,255,0.02)`
- No checkboxes on any row

### Upload Progress
- When uploading, show inline progress bar under the filename text in the document row
- Thin 2px bar, same as current styling
- On complete, row appears in list normally
- On error, show error text below filename in red, with "Retry" link

### Empty State
- Just the "Add documents" button, no other text

## 3. Doc Context Dropdown -- Dot Toggle

The dropdown that opens from the input bar's doc button.

### Container
- Width: 220px (was 256px)
- `background: var(--color-bg-elevated)`, `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 10px`
- `box-shadow: 0 8px 24px rgba(0,0,0,0.4)`
- No "Document Context" header

### Document Rows
- Each row is a clickable toggle (click full row to select/deselect)
- Left side: 6px circle dot
  - Selected: `background: var(--color-accent)` (filled)
  - Unselected: `background: transparent`, `border: 1px solid rgba(255,255,255,0.15)` (empty ring)
- Right side: filename only, `font-size: 11px`
  - Selected: `color: var(--color-text-primary)`
  - Unselected: `color: var(--color-text-secondary)`
- Selected row background: `rgba(163, 144, 112, 0.06)`, border-radius 6px
- Row padding: `6px 10px`
- Row hover: `background: var(--color-bg-hover)`
- No checkboxes, no file type badges

### Footer
- Separated by `border-top: 1px solid rgba(255,255,255,0.04)`
- Left: "N of M selected" (or "All selected"), `font-size: 10px`, `color: var(--color-text-tertiary)`
- Right: "All" toggle link, `font-size: 10px`, `color: var(--color-accent)`. Click selects all or deselects all (same toggle behavior as current).
- Padding: `6px 14px 8px`

### Empty State
- "No documents uploaded", `font-size: 11px`, `color: var(--color-text-tertiary)`, centered

## Component Changes

| Component | Change |
|---|---|
| `Chat.tsx` | Add sidebar toggle button (top-left, PanelLeft icon). Remove sidebar hint div. |
| `ChatInput.tsx` | Remove "Cmd+B sidebar" hint from bottom row |
| `DocumentList.tsx` | Remove search, sort, checkboxes, bulk delete. Simplify to badge + name + size + hover delete rows. |
| `FileUpload.tsx` | Replace upload button + separate dashed zone with single "Add documents" button. Drop zone wraps the entire component (invisible until drag-over). |
| `DocumentContextSelector.tsx` | Replace checkbox list with dot toggle rows. Remove header, badges. Add footer with count + "All" link. Narrow to 220px. |
| `FileTypeBadge.tsx` | Reduce default size from 24px to 20px |
| `App.tsx` | Remove "Documents" header from documentContent. Simplify padding. |

## Out of Scope

- Backend changes
- New dependencies
- Search/sort in sidebar (intentionally removed for simplicity)
- Bulk delete (intentionally removed -- delete one at a time)
