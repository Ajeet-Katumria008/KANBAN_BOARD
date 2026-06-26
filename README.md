# Kanban Task Board

A Trello-style Kanban board built with **vanilla JS, HTML, and CSS** — no frameworks, no build step, no backend. The full board persists to `localStorage`.

## Run it

Just open `index.html` in a browser (double-click it, or drag it into a tab). No server needed.

## Features

- **Multiple columns** with a heading and live card count.
- **Add cards** inline (`+` in a column header). Enter to add, Shift+Enter for a newline, Escape to cancel.
- **Drag & drop** to move cards between columns and reorder within a column.
- **Edit cards** (double-click, Enter on a focused card, or ✏️): text, label color, due date.
- **Delete** cards and columns, each with an **Undo** toast.
- **Add / rename / delete columns** (double-click a column title to rename).
- **Search** across all cards — matches highlight, the rest dim.
- **Due-date pills** that turn amber when due soon and red when overdue.
- **Export / Import** the whole board as JSON (⋯ menu).
- **Light / dark theme** (⋯ menu), remembered across reloads.
- **Multi-tab sync** — changes in one tab reflect in others.

## Mobile / touch

Drag-and-drop is awkward on phones, so on narrow screens columns stack vertically and every card shows a **↔ move** button that opens a "Move to…" picker. The board is fully usable by touch.

## Architecture

Code is split into focused modules under `js/`, loaded in dependency order and sharing a single `window.Kanban` namespace (classic scripts so it runs directly from `file://`):

| File | Responsibility |
|------|----------------|
| `js/storage.js` | `localStorage` read/write + shape validation. Knows nothing about the DOM. |
| `js/state.js` | Single source of truth + all mutations. Persists and notifies subscribers on every change. |
| `js/render.js` | Renders state → DOM. Pure rendering; full redraw on each change. |
| `js/dragdrop.js` | HTML Drag & Drop API wiring (computes drop index from pointer position). |
| `js/events.js` | All user-interaction wiring via event delegation; dialogs, toasts, export/import. |
| `js/app.js` | Composition root: boots modules and connects state → render → events. |

The data flow is one-directional: **events → state mutation → persist → re-render**.

### Board model

```js
{
  columns: [
    { id, title, cards: [ { id, text, label, due, createdAt } ] }
  ]
}
```
