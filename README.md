# Better Find

A professional replacement for Chrome's Ctrl+F. Searches the **full DOM** (including
hidden/collapsed content the native find skips) and highlights matches cleanly using the
CSS Custom Highlight API — no DOM mutation, so page layout never breaks.

## Features

- Overrides `Cmd+F` / `Ctrl+F` on normal pages (shortcut is configurable)
- Full-DOM text search, optionally including hidden elements
- Match case, whole word, and regex toggles
- Live `current / total` counter, next/prev navigation, auto-scroll to match
- Auto-expands `<details>` when jumping to a collapsed match
- Distinct, configurable highlight colors for all matches vs. the active match
- Settings page: custom hotkey, colors, theme (auto/light/dark), bar position, default toggles
- Settings sync across devices via `chrome.storage.sync`

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this folder

## Usage

- `Cmd/Ctrl+F` opens the bar (backup: `Cmd/Ctrl+Shift+F`, or click the toolbar icon)
- `Enter` / `↓` next, `↑` previous, `Esc` closes (or cancels a running scan)
- `Shift+Enter` (or the scan button) runs **Deep Scan**
- Open **Settings** from `chrome://extensions` → Better Find → _Extension options_

## Deep Scan

Some pages don't put content in the DOM until you scroll to it (infinite scroll, lazy
sections). Instant search can't see what isn't mounted yet. Deep Scan sweeps the page
top-to-bottom to force that content to render, indexing matches live with a progress bar
(Esc cancels). It:

- Detects the real scroll container (not just the window)
- Expands collapsibles: opens `<details>` and clicks disclosure toggles
  (`aria-expanded`, `aria-controls`, `role="button"`) — skips links and form submits
- Indexes hidden content too — text hidden via `[hidden]`, `aria-hidden`, or any CSS
  (`display:none`, `.hidden`, `.d-none`, etc.) is searched
- Reveals a hidden match's branch only when you navigate to it, and restores the page
  when you close (non-destructive — no attributes or classes are removed)
- Stops when the page stops growing, or after a time/iteration cap
- Restores your scroll position when done

Fully handles lazy content that stays mounted. For **virtualized** lists that unmount
off-screen rows, matches are still counted and navigation re-scrolls to re-render them —
but such lists can't all be mounted at once by design.

## Notes

- Cannot override find on `chrome://` pages, the built-in PDF viewer, or the Chrome Web
  Store — extensions are blocked there by the browser.
- Searches the top document (not cross-origin iframes).

## Files

- `manifest.json` — MV3 config
- `defaults.js` — shared settings schema + helpers (loaded by content script and options)
- `content.js` — search engine, highlighting, and the find bar UI
- `content.css` — find bar styling
- `background.js` — routes the command / toolbar click to the page
- `options.html` / `options.css` / `options.js` — settings page
