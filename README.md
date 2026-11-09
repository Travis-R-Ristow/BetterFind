# Better Find

A professional replacement for Chrome's Ctrl+F. Searches the **full DOM** (including
hidden/collapsed content the native find skips) and highlights matches cleanly using the
CSS Custom Highlight API — no DOM mutation, so page layout never breaks.

## Features

- Overrides `Cmd+F` / `Ctrl+F` on normal pages (shortcut is configurable)
- One-click on/off from the toolbar popup, plus always-on / always-off URL lists
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

- `Cmd/Ctrl+F` opens the bar (backup: `Cmd/Ctrl+Shift+F`)
- `Enter` / `↓` next, `↑` previous, `Esc` closes (or cancels a running scan)
- `Shift+Enter` (or the scan button) runs **Deep Scan**
- Click the toolbar icon for the on/off popup; **Settings** from the popup or the bar's gear

## Turning it on and off

The toolbar popup has two switches:

- **Master switch** — a hard off. No shortcut capture, no highlights, no highlight or custom
  CSS injected, and the lists below are ignored entirely. The find bar tears itself down
  immediately on every open tab, no reload needed. (The content script itself still loads —
  Chrome mounts it declaratively — but it goes fully inert, and `content.css` sits unused
  with nothing to style.)
- **This site** — an override for the current host. Overrides beat both lists; flipping a
  site back to what the lists already say clears the override instead of pinning it.

Settings holds the two pattern lists. Precedence, top down:

1. Master switch off → off, no exceptions
2. Per-site override (set from the popup)
3. **Always on** — wins over always off
4. **Always off**
5. Otherwise on

Two deliberate choices worth knowing:

- **Fails closed.** If the settings read fails, the content script stays inert rather than
  assuming "on" — an off rule is never ignored because storage hiccuped. The cost is that
  `Ctrl+F` falls through to Chrome's native find for the moment between page load and the
  settings arriving.
- **Re-checked on in-page navigation.** `hashchange` and `popstate` re-evaluate the rules and
  tear the bar down if you land on an excluded route. Routers that only call `pushState`
  aren't observable without patching `history`, so those are re-checked on the next
  `Ctrl+F` instead.

### Pattern syntax

| Pattern                         | Matches                                    |
| ------------------------------- | ------------------------------------------ |
| `example.com`                   | the whole site — any scheme, port, or path |
| `*.example.com`                 | subdomains only (not the apex)             |
| `example.com/docs/`             | everything under that path                 |
| `https://example.com/docs/page` | that exact URL                             |
| `github.com/*/issues`           | `*` is a wildcard anywhere                 |
| `app.com/#/admin`               | one route of a hash-routed SPA             |

Scheme and port are optional; `*` never crosses a `/` in the host, so `*.example.com`
can't be tricked by a path like `evil.com/a.example.com/x`.

Fragments are only compared when the pattern has one. So `app.com/#/admin` targets that
single route, while `example.com/docs/page` still matches `…/docs/page#section`, and a
plain `example.com` covers every route including hash ones. Matching is case-insensitive.

### Conflict highlighting

The lists cross-check each other as you type:

- **Red** — the same pattern is in both lists. Always-on wins; remove one.
- **Orange** — the patterns overlap (e.g. a wildcard in one list covering a hardcoded URL in
  the other). Always-on wins for the shared URLs, so the always-off entry never applies
  there. Each flagged row names the pattern it collides with.

## Deep Scan

Some pages don't put content in the DOM until you scroll to it (infinite scroll, lazy
sections). Instant search can't see what isn't mounted yet. Deep Scan sweeps the page
top-to-bottom to force that content to render, indexing matches live with a progress bar
(Esc cancels). It:

- Sweeps **every** scroll container on the page, not just the window — nested panes, split
  views, and widgets that draw their own scrollbars (`overflow: hidden`), which the usual
  `overflow: auto` check misses entirely
- Drives each container the way that container actually works: `scrollTop` stepping for normal
  panes, synthetic `wheel` events for custom scrollers like the Monaco editor (Azure DevOps /
  GitHub code views), automatically falling back to the other mechanism if the first moves
  nothing
- Expands collapsibles: opens `<details>` and clicks disclosure toggles
  (`aria-expanded`, `aria-controls`, `role="button"`) — skips links and form submits
- Indexes hidden content too — text hidden via `[hidden]`, `aria-hidden`, or any CSS
  (`display:none`, `.hidden`, `.d-none`, etc.) is searched
- Reveals a hidden match's branch only when you navigate to it, and restores the page
  when you close (non-destructive — no attributes or classes are removed)
- Stops a container when it stops growing and its content stops changing, or after a
  time/iteration cap shared across all containers
- Restores each container's scroll position when done

Fully handles lazy content that stays mounted. For **virtualized** lists that unmount
off-screen rows — Monaco's code view, big data grids — matches are indexed as the sweep
scrolls past them, and navigation re-scrolls the owning container to re-render the row.
Each match remembers which container it came from, so navigating to it seeks that pane
rather than the page.

Two limits worth knowing on virtualized content: a custom scroller's original position
can't be read back (the widget keeps it internally, not in `scrollTop`), so the sweep leaves
it at the first match rather than exactly where you were; and two identical lines far apart
in the same file can dedupe into one match, since the index key is the surrounding text.

## Azure DevOps code view (Monaco)

ADO renders files in Monaco, which owns its own scroll state and mounts only the visible
lines — so `scrollTop` is always 0 and off-screen lines don't exist in the DOM. Scrolling it
from outside can only ever approximate where a match is.

Instead, Better Find asks Monaco directly. A bridge runs in the page's own JS context
(`chrome.scripting`, `world: "MAIN"`) and calls `model.findMatches()`, which returns every
match in the file with exact line/column — no scrolling, no sweeping, instant. Navigation
uses `revealRangeInCenter()`, and matches are highlighted with Monaco decorations, so the
highlight survives scrolling and virtualization instead of dying with a recycled line.

**This costs other sites nothing.** Three gates:

- The content script checks `document.querySelector(".monaco-editor")` first. No editor, no
  message, no service-worker wake, no async work — one cheap selector per search.
- `host_permissions` is scoped to `*.visualstudio.com` and `dev.azure.com`, so the bridge
  cannot run anywhere else even if something tried.
- A failed probe is remembered per page, so a site that has Monaco but doesn't expose it
  round-trips once and never again.

If the bridge can't reach Monaco (the page may not expose it globally), it falls back to the
generic wheel sweep described above — degraded but functional.

Deep Scan likewise stays cheap elsewhere: beyond the main scroller it only sweeps
_custom-scrollbar_ containers that are genuinely large (≥300px and ≥25% of the viewport). A
page without such widgets sweeps exactly one container, as it always did.

## Notes

- Cannot override find on `chrome://` pages, the built-in PDF viewer, or the Chrome Web
  Store — extensions are blocked there by the browser.
- Searches the top document (not cross-origin iframes).

## Files

- `manifest.json` — MV3 config
- `defaults.js` — settings schema, URL pattern matching, enable/disable resolution, conflict
  analysis (shared by content script, popup, and options)
- `content.js` — search engine, highlighting, and the find bar UI
- `content.css` — find bar styling
- `background.js` — routes the backup command to the page, opens settings
- `popup.html` / `popup.css` / `popup.js` — toolbar on/off popup
- `options.html` / `options.css` / `options.js` — settings page
- `switch.css` — toggle switch shared by the popup and settings page
- `vendor/lt3.js` — LT3 feedback widget, loaded by the settings page
