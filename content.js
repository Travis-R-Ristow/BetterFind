(() => {
  if (window.__betterFindLoaded) {
    return;
  }
  window.__betterFindLoaded = true;

  const API = window.BetterFind;
  const SUPPORTS_HIGHLIGHT =
    typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  const SEARCH_DEBOUNCE_MS = 120;
  const DEEP_SETTLE_MS = 200;
  const DEEP_MAX_ITERATIONS = 400;
  const DEEP_MAX_MS = 30000;
  const DEEP_STABLE_LIMIT = 2;

  const state = {
    settings: API.DEFAULT_SETTINGS,
    bar: null,
    input: null,
    countEl: null,
    progressEl: null,
    progressInner: null,
    styleEl: null,
    toggleButtons: {},
    matches: [],
    anchors: [],
    current: -1,
    options: { caseSensitive: false, wholeWord: false, regex: false, hidden: false },
    searchTimer: null,
    deep: { running: false, cancel: false, scroller: null, seen: null },
  };

  const ICONS = {
    prev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    scan: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="11" cy="11" r="3"/><path d="M15.5 15.5l2.5 2.5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  };

  function isEditable(el) {
    if (!el) {
      return false;
    }
    if (el.isContentEditable) {
      return true;
    }
    return /^(input|textarea|select)$/i.test(el.tagName);
  }

  function isVisible(node) {
    const el = node.parentElement;
    if (!el) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return el.getClientRects().length > 0;
  }

  function collectTextNodes(includeHidden) {
    if (!document.body) {
      return [];
    }
    const showHidden = includeHidden || state.options.hidden;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest(".better-find-bar")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!showHidden && !isVisible(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }
    return nodes;
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildRegex(query, literal) {
    const opts = state.options;
    let pattern = opts.regex && !literal ? query : escapeRegex(query);
    if (opts.wholeWord && !literal) {
      pattern = `\\b${pattern}\\b`;
    }
    const flags = opts.caseSensitive ? "g" : "gi";
    return new RegExp(pattern, flags);
  }

  function rangeForMatch(node, index, length) {
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + length);
    return range;
  }

  function isConnected(range) {
    return range && range.startContainer && range.startContainer.isConnected;
  }

  function clearHighlights() {
    if (SUPPORTS_HIGHLIGHT) {
      CSS.highlights.delete("better-find-all");
      CSS.highlights.delete("better-find-current");
    }
    state.matches = [];
    state.anchors = [];
    state.current = -1;
  }

  function runSearch(query) {
    if (state.deep.running) {
      return;
    }
    clearHighlights();
    if (!query) {
      updateCount();
      return;
    }

    let regex;
    try {
      regex = buildRegex(query);
    } catch (e) {
      state.countEl.textContent = "bad regex";
      state.countEl.classList.add("better-find-none");
      return;
    }

    const nodes = collectTextNodes();
    for (const node of nodes) {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        state.matches.push(rangeForMatch(node, match.index, match[0].length));
        state.anchors.push(null);
      }
    }

    state.current = state.matches.length ? 0 : -1;
    paintHighlights();
    if (state.current >= 0) {
      scrollToCurrent();
    }
    updateCount();
  }

  function scheduleSearch(query) {
    if (state.searchTimer) {
      clearTimeout(state.searchTimer);
    }
    state.searchTimer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  }

  function paintHighlights() {
    if (!SUPPORTS_HIGHLIGHT) {
      return;
    }
    const all = new Highlight();
    const current = new Highlight();
    state.matches.forEach((range, i) => {
      if (!isConnected(range)) {
        return;
      }
      if (i === state.current) {
        current.add(range);
      } else {
        all.add(range);
      }
    });
    CSS.highlights.set("better-find-all", all);
    CSS.highlights.set("better-find-current", current);
  }

  function isHidden(el) {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const style = window.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden";
  }

  function revealAncestors(node) {
    let el = node.parentElement;
    while (el && el !== document.documentElement) {
      if (el.tagName === "DETAILS" && !el.open) {
        el.open = true;
      }
      if (isHidden(el)) {
        el.setAttribute("data-bf-reveal", "");
      }
      el = el.parentElement;
    }
  }

  function restoreRevealed() {
    document.querySelectorAll("[data-bf-reveal]").forEach((el) => {
      el.removeAttribute("data-bf-reveal");
    });
  }

  function scrollRangeIntoView(range) {
    revealAncestors(range.startContainer);
    const rect = range.getBoundingClientRect();
    const outOfView = rect.top < 0 || rect.bottom > window.innerHeight || rect.height === 0;
    if (outOfView) {
      const target = range.startContainer.parentElement;
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    }
  }

  function scrollToCurrent() {
    const range = state.matches[state.current];
    if (!range) {
      return;
    }
    if (!isConnected(range)) {
      relocateCurrent();
      return;
    }
    scrollRangeIntoView(range);
  }

  async function relocateCurrent() {
    const i = state.current;
    const anchor = state.anchors[i];
    if (!anchor) {
      return;
    }
    const scroller = state.deep.scroller || findScroller();
    scroller.scrollTo({ top: anchor.ratio * scroller.scrollHeight });
    await settle(DEEP_SETTLE_MS);

    const flags = state.options.caseSensitive ? "g" : "gi";
    const re = new RegExp(escapeRegex(anchor.text), flags);
    const centerY = window.innerHeight / 2;
    let chosen = null;
    let chosenDist = Infinity;

    for (const node of collectTextNodes(true)) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(node.nodeValue)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const r = rangeForMatch(node, m.index, m[0].length);
        const rect = r.getBoundingClientRect();
        const dist = Math.abs((rect.top + rect.bottom) / 2 - centerY);
        if (dist < chosenDist) {
          chosenDist = dist;
          chosen = r;
        }
      }
    }

    if (chosen) {
      state.matches[i] = chosen;
      paintHighlights();
      scrollRangeIntoView(chosen);
    }
  }

  function updateCount() {
    if (state.deep.running) {
      return;
    }
    const total = state.matches.length;
    if (total === 0) {
      if (state.input.value) {
        state.countEl.textContent = "0 · ⇧⏎ scan";
        state.countEl.classList.add("better-find-none");
      } else {
        state.countEl.textContent = "";
        state.countEl.classList.remove("better-find-none");
      }
      return;
    }
    state.countEl.classList.remove("better-find-none");
    state.countEl.textContent = `${state.current + 1} / ${total}`;
  }

  function move(delta) {
    if (!state.matches.length) {
      return;
    }
    state.current = (state.current + delta + state.matches.length) % state.matches.length;
    paintHighlights();
    scrollToCurrent();
    updateCount();
  }

  function settle(ms) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, ms));
    });
  }

  function findScroller() {
    const doc = document.scrollingElement || document.documentElement;
    if (doc && doc.scrollHeight > doc.clientHeight + 4) {
      return doc;
    }
    let best = doc;
    let bestArea = 0;
    const els = document.body ? document.body.querySelectorAll("*") : [];
    for (const el of els) {
      const style = window.getComputedStyle(el);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 20) {
        const area = el.clientWidth * el.clientHeight;
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      }
    }
    return best;
  }

  function anchorPath(node) {
    let el = node.parentElement;
    let path = "";
    let depth = 0;
    while (el && depth < 4) {
      let idx = 0;
      let sib = el;
      while ((sib = sib.previousElementSibling)) {
        idx++;
      }
      path = `${el.tagName}${idx}/${path}`;
      el = el.parentElement;
      depth++;
    }
    return path;
  }

  function isExpandableToggle(el) {
    if (el.tagName === "A") {
      return false;
    }
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "submit" || type === "reset") {
      return false;
    }
    const role = (el.getAttribute("role") || "").toLowerCase();
    return el.tagName === "BUTTON" || role === "button" || el.hasAttribute("aria-controls");
  }

  function expandCollapsibles() {
    let changed = false;

    document.querySelectorAll("details:not([open])").forEach((d) => {
      if (d.closest(".better-find-bar")) {
        return;
      }
      d.open = true;
      changed = true;
    });

    document.querySelectorAll('[aria-expanded="false"]').forEach((el) => {
      if (state.deep.expanded.has(el) || el.closest(".better-find-bar")) {
        return;
      }
      if (!isExpandableToggle(el)) {
        return;
      }
      state.deep.expanded.add(el);
      try {
        el.click();
        changed = true;
      } catch (e) {
        /* ignore toggles that throw */
      }
    });

    return changed;
  }

  function accumulate(regex, scroller) {
    const ratio = scroller.scrollHeight ? scroller.scrollTop / scroller.scrollHeight : 0;
    for (const node of collectTextNodes(true)) {
      const text = node.nodeValue;
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const context = text.slice(Math.max(0, match.index - 15), match.index + match[0].length + 15);
        const key = `${anchorPath(node)}::${match[0]}::${context}`;
        if (state.deep.seen.has(key)) {
          continue;
        }
        state.deep.seen.add(key);
        state.matches.push(rangeForMatch(node, match.index, match[0].length));
        state.anchors.push({ ratio, text: match[0] });
      }
    }
  }

  function setProgress(pct) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    state.countEl.textContent = `Scanning ${clamped}%`;
    state.countEl.classList.remove("better-find-none");
    if (state.progressInner) {
      state.progressInner.style.width = `${clamped}%`;
    }
  }

  async function deepScan(query) {
    if (state.deep.running || !query) {
      return;
    }
    let regex;
    try {
      regex = buildRegex(query);
    } catch (e) {
      state.countEl.textContent = "bad regex";
      state.countEl.classList.add("better-find-none");
      return;
    }

    clearHighlights();
    state.deep.running = true;
    state.deep.cancel = false;
    state.deep.seen = new Set();
    state.deep.expanded = new WeakSet();
    state.progressEl.classList.add("better-find-progress-active");

    const scroller = findScroller();
    state.deep.scroller = scroller;
    const originalTop = scroller.scrollTop;
    const step = Math.max(200, scroller.clientHeight * 0.85);
    const start = performance.now();
    let iterations = 0;
    let stable = 0;
    let lastHeight = -1;

    scroller.scrollTo({ top: 0 });
    await settle(DEEP_SETTLE_MS);

    while (!state.deep.cancel) {
      if (expandCollapsibles()) {
        await settle(DEEP_SETTLE_MS);
      }
      accumulate(regex, scroller);

      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      if (atBottom) {
        if (scroller.scrollHeight === lastHeight) {
          stable++;
          if (stable >= DEEP_STABLE_LIMIT) {
            break;
          }
        } else {
          stable = 0;
        }
        lastHeight = scroller.scrollHeight;
      }

      scroller.scrollTo({ top: scroller.scrollTop + step });
      await settle(DEEP_SETTLE_MS);

      setProgress(((scroller.scrollTop + scroller.clientHeight) / scroller.scrollHeight) * 100);

      iterations++;
      if (iterations > DEEP_MAX_ITERATIONS || performance.now() - start > DEEP_MAX_MS) {
        break;
      }
    }

    if (expandCollapsibles()) {
      await settle(DEEP_SETTLE_MS);
    }
    accumulate(regex, scroller);
    scroller.scrollTo({ top: originalTop });

    state.deep.running = false;
    state.progressEl.classList.remove("better-find-progress-active");
    state.current = state.matches.length ? 0 : -1;
    paintHighlights();
    if (state.current >= 0) {
      scrollToCurrent();
    }
    updateCount();
  }

  function cancelDeep() {
    state.deep.cancel = true;
  }

  function makeButton(html, title, onClick, isIcon) {
    const btn = document.createElement("button");
    btn.className = isIcon ? "better-find-btn better-find-icon" : "better-find-btn";
    btn.innerHTML = html;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.type = "button";
    btn.tabIndex = -1;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", onClick);
    return btn;
  }

  function makeToggle(label, title, key) {
    const btn = makeButton(label, title, () => {
      state.options[key] = !state.options[key];
      btn.classList.toggle("better-find-active", state.options[key]);
      runSearch(state.input.value);
      state.input.focus();
    });
    state.toggleButtons[key] = btn;
    return btn;
  }

  function applyDynamicStyle() {
    if (!state.styleEl) {
      state.styleEl = document.createElement("style");
      state.styleEl.id = "better-find-style";
      document.documentElement.appendChild(state.styleEl);
    }
    const s = state.settings;
    state.styleEl.textContent = `
::highlight(better-find-all){background-color:${s.colorAllBg};color:${s.colorAllText};}
::highlight(better-find-current){background-color:${s.colorCurrentBg};color:${s.colorCurrentText};}
[data-bf-reveal]{display:revert !important;visibility:visible !important;opacity:1 !important;}`;
  }

  function applyTheme() {
    if (!state.bar) {
      return;
    }
    const dark =
      state.settings.theme === "dark" ||
      (state.settings.theme === "auto" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    state.bar.classList.toggle("better-find-dark", dark);
  }

  function applyPosition() {
    if (!state.bar) {
      return;
    }
    const positions = ["top-right", "top-left", "bottom-right", "bottom-left"];
    positions.forEach((p) => state.bar.classList.remove(`better-find-${p}`));
    state.bar.classList.add(`better-find-${state.settings.position}`);
  }

  function applyDefaultOptions() {
    state.options.caseSensitive = state.settings.defaultCaseSensitive;
    state.options.wholeWord = state.settings.defaultWholeWord;
    state.options.regex = state.settings.defaultRegex;
    state.options.hidden = state.settings.defaultHidden;
    Object.keys(state.toggleButtons).forEach((key) => {
      state.toggleButtons[key].classList.toggle("better-find-active", state.options[key]);
    });
  }

  function buildBar() {
    const bar = document.createElement("div");
    bar.className = "better-find-bar";
    bar.setAttribute("role", "search");

    const input = document.createElement("input");
    input.className = "better-find-input";
    input.type = "text";
    input.placeholder = "Find in full page";
    input.spellcheck = false;
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-label", "Search text");

    const count = document.createElement("span");
    count.className = "better-find-count";

    const caseBtn = makeToggle("Aa", "Match case", "caseSensitive");
    const wordBtn = makeToggle("ab", "Whole word", "wholeWord");
    const regexBtn = makeToggle(".*", "Regular expression", "regex");
    const hiddenBtn = makeToggle(ICONS.eye, "Include hidden content", "hidden");

    const scanBtn = makeButton(
      ICONS.scan,
      "Deep scan full page (Shift+Enter)",
      () => deepScan(state.input.value),
      true
    );

    const prevBtn = makeButton(ICONS.prev, "Previous (↑)", () => move(-1), true);
    const nextBtn = makeButton(ICONS.next, "Next (Enter / ↓)", () => move(1), true);
    const settingsBtn = makeButton(
      ICONS.gear,
      "Settings",
      () => chrome.runtime.sendMessage({ type: "better-find:open-options" }),
      true
    );
    const closeBtn = makeButton(ICONS.close, "Close (Esc)", close, true);

    input.addEventListener("input", () => scheduleSearch(input.value));
    input.addEventListener("focus", () => bar.classList.add("better-find-focused"));
    input.addEventListener("blur", () => bar.classList.remove("better-find-focused"));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        deepScan(input.value);
      } else if (e.key === "Enter") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (state.deep.running) {
          cancelDeep();
        } else {
          close();
        }
      }
    });

    const sep1 = document.createElement("div");
    sep1.className = "better-find-sep";
    const sep2 = document.createElement("div");
    sep2.className = "better-find-sep";

    const progress = document.createElement("div");
    progress.className = "better-find-progress";
    const progressInner = document.createElement("div");
    progressInner.className = "better-find-progress-inner";
    progress.appendChild(progressInner);

    bar.append(
      input,
      count,
      sep1,
      caseBtn,
      wordBtn,
      regexBtn,
      hiddenBtn,
      scanBtn,
      sep2,
      prevBtn,
      nextBtn,
      settingsBtn,
      closeBtn,
      progress
    );

    state.bar = bar;
    state.input = input;
    state.countEl = count;
    state.progressEl = progress;
    state.progressInner = progressInner;
    document.documentElement.appendChild(bar);
    applyDynamicStyle();
    applyPosition();
    applyTheme();
    applyDefaultOptions();
    return bar;
  }

  function open() {
    if (!state.bar) {
      buildBar();
    }
    state.bar.style.display = "flex";
    const selected = window.getSelection().toString().trim();
    if (selected) {
      state.input.value = selected;
    }
    state.input.focus();
    state.input.select();
    if (state.input.value) {
      runSearch(state.input.value);
    }
  }

  function close() {
    cancelDeep();
    clearHighlights();
    restoreRevealed();
    if (state.bar) {
      state.bar.style.display = "none";
    }
    if (state.countEl) {
      state.countEl.textContent = "";
      state.countEl.classList.remove("better-find-none");
    }
  }

  function matchesHotkey(e) {
    const hk = state.settings.hotkey;
    if (!hk || !hk.key) {
      return false;
    }
    return (
      e.key.toLowerCase() === hk.key.toLowerCase() &&
      e.ctrlKey === hk.ctrlKey &&
      e.metaKey === hk.metaKey &&
      e.altKey === hk.altKey &&
      e.shiftKey === hk.shiftKey
    );
  }

  window.addEventListener(
    "keydown",
    (e) => {
      if (!matchesHotkey(e)) {
        return;
      }
      const hk = state.settings.hotkey;
      if (!hk.ctrlKey && !hk.metaKey && isEditable(document.activeElement)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      open();
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "better-find:open") {
      open();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[API.STORAGE_KEY]) {
      return;
    }
    state.settings = API.mergeSettings(changes[API.STORAGE_KEY].newValue);
    applyDynamicStyle();
    applyTheme();
    applyPosition();
  });

  chrome.storage.sync.get(API.STORAGE_KEY, (data) => {
    state.settings = API.mergeSettings(data && data[API.STORAGE_KEY]);
    applyDynamicStyle();
  });
})();
