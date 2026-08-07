(() => {
  if (window.__betterFindLoaded) {
    return;
  }
  window.__betterFindLoaded = true;

  const API = window.BetterFind;

  function extensionAlive() {
    return Boolean(chrome.runtime && chrome.runtime.id);
  }

  function openOptions() {
    if (!extensionAlive()) {
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "better-find:open-options" });
    } catch (e) {
      /* extension was reloaded; context is gone until the page reloads */
    }
  }

  const SUPPORTS_HIGHLIGHT =
    typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  const SEARCH_DEBOUNCE_MS = 120;
  const DEEP_SETTLE_MS = 200;
  const CUSTOM_SETTLE_MS = 80;
  const DEEP_MAX_ITERATIONS = 400;
  const DEEP_MAX_MS = 45000;
  const DEEP_STABLE_LIMIT = 2;
  const SCROLLER_MIN_HEIGHT = 120;
  const SCROLLER_MIN_WIDTH = 200;
  const SCROLLER_MIN_OVERFLOW = 40;
  const MAX_SCROLLERS = 8;
  const SIGNATURE_SAMPLE = 2;
  const RELOCATE_HUNT_STEPS = 4;
  const MONACO_SELECTOR = ".monaco-editor";
  const MONACO_MATCH_LIMIT = 5000;
  const CUSTOM_SWEEP_MIN_HEIGHT = 300;
  const CUSTOM_SWEEP_VIEWPORT_RATIO = 0.25;

  const state = {
    settings: API.DEFAULT_SETTINGS,
    overrides: {},
    loaded: false,
    bar: null,
    input: null,
    countEl: null,
    progressEl: null,
    progressInner: null,
    styleEl: null,
    ticksEl: null,
    liveEl: null,
    toggleButtons: {},
    matches: [],
    anchors: [],
    current: -1,
    options: {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      hidden: false,
      diacritics: false,
    },
    searchTimer: null,
    searchToken: 0,
    deepResults: false,
    relocating: false,
    monacoActive: false,
    monacoUnavailable: false,
    deep: { running: false, cancel: false, scroller: null, seen: null, deadline: 0 },
    anim: { raf: null },
    observer: null,
    liveTimer: null,
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

  function makeTextFilter(showHidden) {
    return {
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
        if (parent.closest && parent.closest(".better-find-bar")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!showHidden && !isVisible(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    };
  }

  function collectFromRoot(root, filter, nodes) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, filter);
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) {
        collectFromRoot(el.shadowRoot, filter, nodes);
      }
    });
  }

  function collectTextNodes(includeHidden, root) {
    const base = root || document.body;
    if (!base) {
      return [];
    }
    const showHidden = includeHidden || state.options.hidden;
    const nodes = [];
    collectFromRoot(base, makeTextFilter(showHidden), nodes);
    return nodes;
  }

  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function stripDiacritics(text) {
    return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  function foldValue(text) {
    let folded = "";
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const parts = stripDiacritics(text[i]);
      for (let j = 0; j < parts.length; j++) {
        folded += parts[j];
        map.push(i);
      }
    }
    map.push(text.length);
    return { folded, map };
  }

  function buildRegex(query, literal) {
    const opts = state.options;
    const source = opts.diacritics ? stripDiacritics(query) : query;
    let pattern = opts.regex && !literal ? source : escapeRegex(source);
    if (opts.wholeWord && !literal) {
      pattern = `\\b${pattern}\\b`;
    }
    const flags = opts.caseSensitive ? "g" : "gi";
    return new RegExp(pattern, flags);
  }

  function forEachMatch(node, regex, cb) {
    const text = node.nodeValue;
    regex.lastIndex = 0;
    if (state.options.diacritics) {
      const { folded, map } = foldValue(text);
      let match;
      while ((match = regex.exec(folded)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const start = map[match.index];
        const end = map[match.index + match[0].length];
        if (end > start) {
          cb(start, end - start);
        }
      }
      return;
    }
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      cb(match.index, match[0].length);
    }
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
    renderTicks();
    syncAnimation();
  }

  function runSearch(query, opts) {
    const options = opts || {};
    if (state.deep.running || !state.bar) {
      return;
    }
    state.deepResults = false;
    state.searchToken++;
    clearHighlights();
    if (!query) {
      clearMonaco();
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
      forEachMatch(node, regex, (index, length) => {
        state.matches.push(rangeForMatch(node, index, length));
        state.anchors.push(null);
      });
    }

    let target = state.matches.length ? 0 : -1;
    if (options.keepView && options.index > 0 && options.index < state.matches.length) {
      target = options.index;
    }
    state.current = target;
    paintHighlights();
    if (state.current >= 0 && !options.keepView) {
      scrollToCurrent();
    }
    updateCount();
    augmentWithMonaco(query);
  }

  function scheduleSearch(query) {
    startObserver();
    if (state.searchTimer) {
      clearTimeout(state.searchTimer);
    }
    state.searchTimer = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
  }

  function paintHighlights() {
    if (SUPPORTS_HIGHLIGHT) {
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
    renderTicks();
    syncAnimation();
  }

  const MAX_TICKS = 400;

  function renderTicks() {
    if (!state.ticksEl) {
      return;
    }
    state.ticksEl.textContent = "";
    const total = state.matches.length;
    if (!total) {
      state.ticksEl.style.display = "none";
      return;
    }
    const docHeight = Math.max(document.documentElement.scrollHeight, 1);
    const step = total > MAX_TICKS ? Math.ceil(total / MAX_TICKS) : 1;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      if (i % step !== 0 && i !== state.current) {
        continue;
      }
      const range = state.matches[i];
      if (!isConnected(range)) {
        continue;
      }
      const rect = range.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) {
        continue;
      }
      const ratio = Math.max(0, Math.min(1, (rect.top + window.scrollY) / docHeight));
      const tick = document.createElement("div");
      tick.className =
        i === state.current ? "better-find-tick better-find-tick-current" : "better-find-tick";
      tick.style.top = `${ratio * 100}%`;
      tick.dataset.index = String(i);
      frag.appendChild(tick);
    }
    state.ticksEl.appendChild(frag);
    state.ticksEl.style.display = "block";
  }

  function jumpTo(i) {
    if (i < 0 || i >= state.matches.length) {
      return;
    }
    state.current = i;
    paintHighlights();
    scrollToCurrent(true);
    updateCount();
  }

  function announce(text) {
    if (state.liveEl) {
      state.liveEl.textContent = text;
    }
  }

  const ANIMATION_VARS = [
    "--bf-all-bg",
    "--bf-all-glow",
    "--bf-current-bg",
    "--bf-current-glow",
  ];

  function hexToHsl(hex) {
    let value = (hex || "").replace("#", "");
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return { h: 45, s: 90, l: 60 };
    }
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let sat = 0;
    if (delta !== 0) {
      sat = delta / (1 - Math.abs(2 * l - 1));
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h *= 60;
      if (h < 0) {
        h += 360;
      }
    }
    return { h: Math.round(h), s: Math.round(sat * 100), l: Math.round(l * 100) };
  }

  function clearAnimationOverrides() {
    const style = document.documentElement.style;
    ANIMATION_VARS.forEach((name) => style.removeProperty(name));
  }

  function stopAnimation() {
    if (state.anim.raf) {
      cancelAnimationFrame(state.anim.raf);
      state.anim.raf = null;
    }
    clearAnimationOverrides();
  }

  function animationTargets() {
    return state.settings.animationTarget === "all" ? ["all"] : ["current"];
  }

  function paintAnimationFrame(now) {
    const s = state.settings;
    const period = Math.max(200, s.animationSpeed * 1000);
    const phase = (now % period) / period;
    const wave = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
    const intensity = s.animationIntensity / 100;
    const style = document.documentElement.style;

    animationTargets().forEach((target) => {
      const baseColor = target === "all" ? s.colorAllBg : s.colorCurrentBg;
      const hsl = hexToHsl(baseColor);
      if (s.animation === "pulse") {
        const blur = intensity * 16 * wave;
        style.setProperty(`--bf-${target}-glow`, `0 0 ${blur.toFixed(2)}px ${baseColor}`);
      } else if (s.animation === "breathe") {
        const l = Math.max(0, Math.min(100, hsl.l + (wave - 0.5) * 2 * intensity * 30));
        style.setProperty(`--bf-${target}-bg`, `hsl(${hsl.h} ${hsl.s}% ${l}%)`);
      } else if (s.animation === "rainbow") {
        const hue = (hsl.h + phase * 360) % 360;
        const sat = Math.max(hsl.s, Math.round(intensity * 100));
        style.setProperty(`--bf-${target}-bg`, `hsl(${hue} ${sat}% ${hsl.l}%)`);
      }
    });

    state.anim.raf = requestAnimationFrame(paintAnimationFrame);
  }

  function syncAnimation() {
    const s = state.settings;
    const active =
      SUPPORTS_HIGHLIGHT &&
      state.bar &&
      state.bar.style.display !== "none" &&
      state.matches.length > 0 &&
      !state.deep.running &&
      s.animation &&
      s.animation !== "none";
    if (active) {
      if (!state.anim.raf) {
        state.anim.raf = requestAnimationFrame(paintAnimationFrame);
      }
    } else {
      stopAnimation();
    }
  }

  const LIVE_UPDATE_DEBOUNCE_MS = 300;

  function reSearchLive() {
    if (state.deep.running || state.deepResults || !state.input || !state.input.value) {
      return;
    }
    const previous = state.current;
    if (state.observer) {
      state.observer.disconnect();
    }
    runSearch(state.input.value, { keepView: true, index: previous });
    if (state.observer) {
      state.observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    }
  }

  function onMutations() {
    if (state.liveTimer) {
      clearTimeout(state.liveTimer);
    }
    state.liveTimer = setTimeout(reSearchLive, LIVE_UPDATE_DEBOUNCE_MS);
  }

  function startObserver() {
    if (state.observer || !state.settings.liveUpdate || !document.body) {
      return;
    }
    state.observer = new MutationObserver(onMutations);
    state.observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  }

  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.liveTimer) {
      clearTimeout(state.liveTimer);
      state.liveTimer = null;
    }
  }

  function isHidden(el) {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
      return true;
    }
    const style = window.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden";
  }

  function withFocusGuard(fn) {
    const input = state.input;
    const guard = input && document.activeElement === input;
    const start = guard ? input.selectionStart : null;
    const end = guard ? input.selectionEnd : null;
    const result = fn();
    if (guard && document.activeElement !== input) {
      input.focus();
      if (start !== null) {
        input.setSelectionRange(start, end);
      }
    }
    return result;
  }

  function reopenControllingToggles(el) {
    if (!el.id) {
      return;
    }
    document
      .querySelectorAll(`[aria-controls~="${CSS.escape(el.id)}"][aria-expanded="false"]`)
      .forEach((toggle) => {
        if (toggle.closest(".better-find-bar") || !isExpandableToggle(toggle)) {
          return;
        }
        try {
          toggle.click();
        } catch (e) {
          /* ignore toggles that throw */
        }
      });
  }

  function revealAncestors(node, interactive) {
    let el = node.parentElement;
    while (el && el !== document.documentElement) {
      if (el.tagName === "DETAILS" && !el.open) {
        el.open = true;
      }
      if (interactive) {
        if (el.getAttribute("aria-expanded") === "false" && isExpandableToggle(el)) {
          try {
            el.click();
          } catch (e) {
            /* ignore toggles that throw */
          }
        }
        reopenControllingToggles(el);
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

  function scrollableAncestor(node) {
    let el = node.parentElement;
    while (el) {
      if (
        el.scrollHeight > el.clientHeight + SCROLLER_MIN_OVERFLOW &&
        el.clientHeight >= SCROLLER_MIN_HEIGHT &&
        window.getComputedStyle(el).overflowY !== "visible"
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function isUsableRange(range, index) {
    if (!isConnected(range)) {
      return false;
    }
    const anchor = state.anchors[index];
    if (!anchor || !anchor.text) {
      return true;
    }
    return range.toString() === anchor.text;
  }

  function verifyAfterSeek(allowRelocate) {
    setTimeout(() => {
      const index = state.current;
      const range = state.matches[index];
      if (!range) {
        return;
      }
      if (!isUsableRange(range, index)) {
        if (allowRelocate) {
          relocateCurrent();
        }
        return;
      }
      paintHighlights();
    }, DEEP_SETTLE_MS);
  }

  function scrollRangeIntoView(range, interactive) {
    if (interactive) {
      withFocusGuard(() => revealAncestors(range.startContainer, true));
    } else {
      revealAncestors(range.startContainer, false);
    }
    const rect = range.getBoundingClientRect();
    const container = scrollableAncestor(range.startContainer);
    const box = container ? container.getBoundingClientRect() : null;
    const rendered = rect.height > 0 || rect.width > 0;

    if (container && isCustomScroller(container) && rendered) {
      const delta = rect.top + rect.height / 2 - (box.top + box.height / 2);
      if (Math.abs(delta) > 8) {
        dispatchWheel(container, delta);
        verifyAfterSeek(!state.relocating);
      }
      return;
    }

    const clipped = box ? rect.bottom < box.top + 1 || rect.top > box.bottom - 1 : false;
    const outOfView =
      rect.top < 0 || rect.bottom > window.innerHeight || rect.height === 0 || clipped;
    if (outOfView) {
      const target = range.startContainer.parentElement;
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    }
  }

  function scrollToCurrent(interactive) {
    if (monacoAnchor(state.current)) {
      revealMonaco(state.current);
      return;
    }
    const range = state.matches[state.current];
    if (!range) {
      return;
    }
    if (!isUsableRange(range, state.current)) {
      relocateCurrent();
      return;
    }
    scrollRangeIntoView(range, interactive);
  }

  function monacoPresent() {
    return !state.monacoUnavailable && document.querySelector(MONACO_SELECTOR) !== null;
  }

  function monacoRequest(payload) {
    return new Promise((resolve) => {
      if (!extensionAlive()) {
        resolve(null);
        return;
      }
      try {
        chrome.runtime.sendMessage({ type: "better-find:monaco", payload }, (response) => {
          resolve(chrome.runtime.lastError ? null : response);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function monacoOptions(query) {
    return {
      op: "find",
      query,
      caseSensitive: state.options.caseSensitive,
      wholeWord: state.options.wholeWord,
      regex: state.options.regex,
      limit: MONACO_MATCH_LIMIT,
    };
  }

  function insideMonaco(node, editors) {
    return editors.some((editor) => editor.contains(node));
  }

  function mergeMonacoMatches(found) {
    const editors = Array.from(document.querySelectorAll(MONACO_SELECTOR));
    const ranges = [];
    const anchors = [];
    state.matches.forEach((range, i) => {
      if (range && range.startContainer && insideMonaco(range.startContainer, editors)) {
        return;
      }
      ranges.push(range);
      anchors.push(state.anchors[i]);
    });
    found.forEach((match) => {
      ranges.push(null);
      anchors.push({ monaco: match });
    });
    state.matches = ranges;
    state.anchors = anchors;
  }

  async function augmentWithMonaco(query) {
    if (!query || !monacoPresent()) {
      return;
    }
    const token = state.searchToken;
    const result = await monacoRequest(monacoOptions(query));
    if (token !== state.searchToken || !state.bar) {
      return;
    }
    if (!result || !result.ok) {
      state.monacoActive = false;
      state.monacoUnavailable = true;
      return;
    }
    state.monacoActive = true;
    if (!result.matches.length) {
      return;
    }
    const wasEmpty = state.current < 0;
    mergeMonacoMatches(result.matches);
    if (wasEmpty && state.matches.length) {
      state.current = 0;
    }
    paintHighlights();
    updateCount();
    if (wasEmpty && state.current >= 0) {
      scrollToCurrent(true);
    }
  }

  function monacoAnchor(index) {
    const anchor = state.anchors[index];
    return anchor && anchor.monaco ? anchor.monaco : null;
  }

  function revealMonaco(index) {
    const match = monacoAnchor(index);
    if (!match) {
      return;
    }
    monacoRequest({ op: "reveal", id: match.id });
  }

  function clearMonaco() {
    if (!state.monacoActive) {
      return;
    }
    state.monacoActive = false;
    monacoRequest({ op: "clear" });
  }

  function seekCenter(scroller, isPage) {
    if (isPage) {
      return window.innerHeight / 2;
    }
    const box = scroller.getBoundingClientRect();
    return box.top + box.height / 2;
  }

  function findNearestMatch(root, re, centerY) {
    let chosen = null;
    let chosenDist = Infinity;
    for (const node of collectTextNodes(true, root)) {
      forEachMatch(node, re, (index, length) => {
        const range = rangeForMatch(node, index, length);
        const rect = range.getBoundingClientRect();
        const dist = Math.abs((rect.top + rect.bottom) / 2 - centerY);
        if (dist < chosenDist) {
          chosenDist = dist;
          chosen = range;
        }
      });
    }
    return chosen;
  }

  async function relocateCurrent() {
    if (state.relocating) {
      return;
    }
    const i = state.current;
    const anchor = state.anchors[i];
    if (!anchor) {
      return;
    }
    const scroller =
      anchor.scroller && anchor.scroller.isConnected
        ? anchor.scroller
        : state.deep.scroller || findScroller();
    state.relocating = true;
    try {
      await scrollToRatio(scroller, anchor.ratio);

      const re = buildRegex(anchor.text, true);
      const isPage = scroller === docScroller();
      const root = isPage ? null : scroller;

      let chosen = findNearestMatch(root, re, seekCenter(scroller, isPage));
      if (!chosen && isCustomScroller(scroller)) {
        const step = Math.max(200, scroller.clientHeight * 0.85);
        for (let pass = 0; pass < RELOCATE_HUNT_STEPS && !chosen; pass++) {
          dispatchWheel(scroller, step);
          await settle(CUSTOM_SETTLE_MS);
          chosen = findNearestMatch(root, re, seekCenter(scroller, isPage));
        }
      }

      if (chosen) {
        state.matches[i] = chosen;
        paintHighlights();
        scrollRangeIntoView(chosen, true);
      }
    } finally {
      state.relocating = false;
    }
  }

  function updateCount() {
    if (state.deep.running || !state.countEl) {
      return;
    }
    const total = state.matches.length;
    if (total === 0) {
      if (state.input.value) {
        state.countEl.textContent = "0 · ⇧⏎ scan";
        state.countEl.classList.add("better-find-none");
        announce("No results");
      } else {
        state.countEl.textContent = "";
        state.countEl.classList.remove("better-find-none");
        announce("");
      }
      return;
    }
    state.countEl.classList.remove("better-find-none");
    state.countEl.textContent = `${state.current + 1} / ${total}`;
    announce(`Match ${state.current + 1} of ${total}`);
  }

  function move(delta) {
    if (!state.matches.length) {
      return;
    }
    state.current = (state.current + delta + state.matches.length) % state.matches.length;
    paintHighlights();
    scrollToCurrent(true);
    updateCount();
  }

  function settle(ms) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, ms));
    });
  }

  function docScroller() {
    return document.scrollingElement || document.documentElement;
  }

  function isCustomScroller(el) {
    return el !== docScroller() && window.getComputedStyle(el).overflowY === "hidden";
  }

  function isScrollContainer(el) {
    if (el.scrollHeight <= el.clientHeight + SCROLLER_MIN_OVERFLOW) {
      return false;
    }
    if (el.clientHeight < SCROLLER_MIN_HEIGHT || el.clientWidth < SCROLLER_MIN_WIDTH) {
      return false;
    }
    if (el.closest(".better-find-bar")) {
      return false;
    }
    const overflow = window.getComputedStyle(el).overflowY;
    return (
      overflow === "auto" || overflow === "scroll" || overflow === "overlay" || overflow === "hidden"
    );
  }

  function findScrollers() {
    const found = [];
    const doc = docScroller();
    if (doc && doc.scrollHeight > doc.clientHeight + 4) {
      found.push(doc);
    }
    const els = document.body ? document.body.querySelectorAll("*") : [];
    for (const el of els) {
      if (isScrollContainer(el)) {
        found.push(el);
      }
    }
    found.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    return found.slice(0, MAX_SCROLLERS);
  }

  function findScroller() {
    return findScrollers()[0] || docScroller();
  }

  function worthSweeping(el) {
    return (
      el.clientHeight >= CUSTOM_SWEEP_MIN_HEIGHT &&
      el.clientHeight >= window.innerHeight * CUSTOM_SWEEP_VIEWPORT_RATIO
    );
  }

  function sweepTargets(scrollers, primary) {
    const editors = state.monacoActive
      ? Array.from(document.querySelectorAll(MONACO_SELECTOR))
      : [];
    const targets = [primary];
    scrollers.forEach((el) => {
      if (el === primary || !isCustomScroller(el) || !worthSweeping(el)) {
        return;
      }
      if (editors.some((editor) => editor.contains(el))) {
        return;
      }
      targets.push(el);
    });
    return targets;
  }

  function dispatchWheel(el, deltaY) {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      })
    );
  }

  function contentSignature(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = [];
    const last = [];
    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.trim();
      if (!text) {
        continue;
      }
      count++;
      if (first.length < SIGNATURE_SAMPLE) {
        first.push(text.slice(0, 40));
      }
      last.push(text.slice(0, 40));
      if (last.length > SIGNATURE_SAMPLE) {
        last.shift();
      }
    }
    return `${count}|${first.join("~")}|${last.join("~")}`;
  }

  function scrollRatio(el, travelled) {
    if (!el.scrollHeight) {
      return 0;
    }
    const top = el.scrollTop > 0 ? el.scrollTop : travelled;
    return Math.min(1, top / el.scrollHeight);
  }

  function advanceScroller(el, step, mode) {
    if (mode === "native") {
      el.scrollTo({ top: el.scrollTop + step });
      return;
    }
    dispatchWheel(el, step);
  }

  async function resetScroller(el, mode) {
    if (mode === "native") {
      el.scrollTo({ top: 0 });
    } else {
      el.scrollTop = 0;
      dispatchWheel(el, -(el.scrollHeight + 2000));
    }
    await settle(CUSTOM_SETTLE_MS);
  }

  async function scrollToRatio(el, ratio) {
    const target = ratio * el.scrollHeight;
    if (isCustomScroller(el)) {
      el.scrollTop = 0;
      dispatchWheel(el, -(el.scrollHeight + 2000));
      await settle(CUSTOM_SETTLE_MS);
      dispatchWheel(el, target);
      await settle(DEEP_SETTLE_MS);
      return;
    }
    el.scrollTo({ top: target });
    await settle(DEEP_SETTLE_MS);
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
    if (el.hasAttribute("aria-haspopup")) {
      return false;
    }
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (role === "menuitem" || role === "combobox" || role === "tab") {
      return false;
    }
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "submit" || type === "reset") {
      return false;
    }
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

  function accumulate(regex, scroller, ratio, root) {
    for (const node of collectTextNodes(true, root)) {
      const text = node.nodeValue;
      forEachMatch(node, regex, (index, length) => {
        const matchText = text.slice(index, index + length);
        const context = text.slice(Math.max(0, index - 15), index + length + 15);
        const key = `${anchorPath(node)}::${matchText}::${context}`;
        if (state.deep.seen.has(key)) {
          return;
        }
        state.deep.seen.add(key);
        state.matches.push(rangeForMatch(node, index, length));
        state.anchors.push({ scroller, ratio, text: matchText });
      });
    }
  }

  function setProgress(pct) {
    if (!state.countEl) {
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    state.countEl.textContent = `Scanning ${clamped}%`;
    state.countEl.classList.remove("better-find-none");
    if (state.progressInner) {
      state.progressInner.style.width = `${clamped}%`;
    }
  }

  async function sweepNative(el, regex, root, report) {
    const originalTop = el.scrollTop;
    const step = Math.max(200, el.clientHeight * 0.85);
    let iterations = 0;
    let stable = 0;
    let lastHeight = -1;

    el.scrollTo({ top: 0 });
    await settle(DEEP_SETTLE_MS);

    while (!state.deep.cancel) {
      if (withFocusGuard(expandCollapsibles)) {
        await settle(DEEP_SETTLE_MS);
      }
      accumulate(regex, el, scrollRatio(el, 0), root);

      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      if (atBottom) {
        if (el.scrollHeight === lastHeight) {
          stable++;
          if (stable >= DEEP_STABLE_LIMIT) {
            break;
          }
        } else {
          stable = 0;
        }
        lastHeight = el.scrollHeight;
      }

      el.scrollTo({ top: el.scrollTop + step });
      await settle(DEEP_SETTLE_MS);
      report(scrollRatio(el, 0));

      iterations++;
      if (iterations > DEEP_MAX_ITERATIONS || performance.now() > state.deep.deadline) {
        break;
      }
    }

    el.scrollTo({ top: originalTop });
  }

  async function sweepCustom(el, regex, root, report) {
    const originalTop = el.scrollTop;
    const step = Math.max(200, el.clientHeight * 0.85);
    let mode = "wheel";
    let escalated = false;
    let travelled = 0;
    let iterations = 0;
    let stable = 0;
    let signature = null;

    await resetScroller(el, mode);

    while (!state.deep.cancel) {
      accumulate(regex, el, scrollRatio(el, travelled), root);

      const current = `${el.scrollHeight}|${contentSignature(el)}`;
      if (current === signature) {
        stable++;
        if (stable >= DEEP_STABLE_LIMIT) {
          if (escalated) {
            break;
          }
          escalated = true;
          mode = mode === "wheel" ? "native" : "wheel";
          travelled = 0;
          stable = 0;
          signature = null;
          await resetScroller(el, mode);
          continue;
        }
      } else {
        stable = 0;
      }
      signature = current;

      advanceScroller(el, step, mode);
      travelled += step;
      await settle(CUSTOM_SETTLE_MS);
      report(scrollRatio(el, travelled));

      iterations++;
      if (iterations > DEEP_MAX_ITERATIONS || performance.now() > state.deep.deadline) {
        break;
      }
    }

    el.scrollTop = originalTop;
    if (mode === "wheel") {
      dispatchWheel(el, -(el.scrollHeight + 2000));
    }
  }

  async function deepScan(query) {
    if (state.deep.running || !query || !state.bar) {
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
    stopObserver();
    state.deep.running = true;
    state.deep.cancel = false;
    state.deep.seen = new Set();
    state.deep.expanded = new WeakSet();
    state.progressEl.classList.add("better-find-progress-active");

    state.deep.deadline = performance.now() + DEEP_MAX_MS;

    state.searchToken++;
    const scrollers = findScrollers();
    const primary = scrollers[0] || docScroller();
    const targets = sweepTargets(scrollers, primary);
    state.deep.scroller = primary;

    accumulate(regex, primary, scrollRatio(primary, 0), null);

    for (let i = 0; i < targets.length; i++) {
      const el = targets[i];
      if (state.deep.cancel || !state.bar || performance.now() > state.deep.deadline) {
        break;
      }
      if (!el.isConnected) {
        continue;
      }
      const root = el === docScroller() ? null : el;
      const report = (ratio) => {
        setProgress(((i + Math.min(1, ratio)) / targets.length) * 100);
      };
      if (isCustomScroller(el)) {
        await sweepCustom(el, regex, root, report);
      } else {
        await sweepNative(el, regex, root, report);
      }
    }

    const abandoned = !state.bar;
    if (!abandoned) {
      if (withFocusGuard(expandCollapsibles)) {
        await settle(DEEP_SETTLE_MS);
      }
      accumulate(regex, primary, scrollRatio(primary, 0), null);
    }

    state.deep.running = false;
    if (abandoned) {
      clearHighlights();
      return;
    }
    state.deepResults = true;
    state.progressEl.classList.remove("better-find-progress-active");
    state.current = state.matches.length ? 0 : -1;
    paintHighlights();
    if (state.current >= 0) {
      scrollToCurrent(true);
    }
    updateCount();
    state.input.focus();
    augmentWithMonaco(query);
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
:root{
--bf-all-bg:${s.colorAllBg};
--bf-all-text:${s.colorAllText};
--bf-all-glow:none;
--bf-current-bg:${s.colorCurrentBg};
--bf-current-text:${s.colorCurrentText};
--bf-current-glow:none;
}
::highlight(better-find-all){background-color:var(--bf-all-bg,${s.colorAllBg});color:var(--bf-all-text,${s.colorAllText});text-shadow:var(--bf-all-glow,none);}
::highlight(better-find-current){background-color:var(--bf-current-bg,${s.colorCurrentBg});color:var(--bf-current-text,${s.colorCurrentText});text-shadow:var(--bf-current-glow,none);}
[data-bf-reveal]{display:revert !important;visibility:visible !important;opacity:1 !important;}
${s.customCss || ""}`;
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
    state.options.diacritics = state.settings.defaultIgnoreDiacritics;
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
    const diacriticsBtn = makeToggle("á", "Ignore accents (café = cafe)", "diacritics");
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
    const settingsBtn = makeButton(ICONS.gear, "Settings", openOptions, true);
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

    const live = document.createElement("div");
    live.className = "better-find-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");

    bar.append(
      input,
      count,
      sep1,
      caseBtn,
      wordBtn,
      diacriticsBtn,
      regexBtn,
      hiddenBtn,
      scanBtn,
      sep2,
      prevBtn,
      nextBtn,
      settingsBtn,
      closeBtn,
      progress,
      live
    );

    const ticks = document.createElement("div");
    ticks.className = "better-find-ticks";
    ticks.style.display = "none";
    ticks.addEventListener("mousedown", (e) => e.preventDefault());
    ticks.addEventListener("click", (e) => {
      const tick = e.target.closest(".better-find-tick");
      if (tick && tick.dataset.index) {
        jumpTo(Number(tick.dataset.index));
      }
    });

    state.bar = bar;
    state.input = input;
    state.countEl = count;
    state.progressEl = progress;
    state.progressInner = progressInner;
    state.liveEl = live;
    state.ticksEl = ticks;
    document.documentElement.appendChild(bar);
    document.documentElement.appendChild(ticks);
    applyDynamicStyle();
    applyPosition();
    applyTheme();
    applyDefaultOptions();
    return bar;
  }

  function open() {
    const wasOpen = Boolean(state.bar) && state.bar.style.display !== "none";
    if (!state.bar) {
      buildBar();
    }
    state.bar.style.display = "flex";
    if (!wasOpen) {
      const selected = window.getSelection().toString().trim();
      if (selected) {
        state.input.value = selected;
      }
    }
    state.input.focus();
    state.input.select();
    if (!wasOpen && state.input.value) {
      runSearch(state.input.value);
    }
    startObserver();
  }

  function close() {
    cancelDeep();
    stopAnimation();
    stopObserver();
    clearHighlights();
    restoreRevealed();
    clearMonaco();
    state.deepResults = false;
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
    if (!hk || !hk.key || !e.key) {
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

  function isActive() {
    if (!state.loaded) {
      return false;
    }
    return API.isEnabledFor(state.settings, state.overrides, location.href);
  }

  function teardown() {
    close();
    if (state.searchTimer) {
      clearTimeout(state.searchTimer);
      state.searchTimer = null;
    }
    if (state.styleEl) {
      state.styleEl.remove();
      state.styleEl = null;
    }
    if (state.bar) {
      state.bar.remove();
      state.bar = null;
      state.input = null;
      state.countEl = null;
      state.progressEl = null;
      state.progressInner = null;
      state.liveEl = null;
      state.toggleButtons = {};
    }
    if (state.ticksEl) {
      state.ticksEl.remove();
      state.ticksEl = null;
    }
  }

  function applySettings() {
    if (!isActive()) {
      teardown();
      return;
    }
    applyDynamicStyle();
    applyTheme();
    applyPosition();
    stopAnimation();
    syncAnimation();
    stopObserver();
    if (state.bar && state.bar.style.display !== "none") {
      startObserver();
    }
  }

  function onLocationChange() {
    state.monacoUnavailable = false;
    if (!isActive()) {
      teardown();
    }
  }

  window.addEventListener("hashchange", onLocationChange);
  window.addEventListener("popstate", onLocationChange);

  window.addEventListener(
    "keydown",
    (e) => {
      if (!matchesHotkey(e) || !isActive()) {
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

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!state.matches.length) {
      return;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(renderTicks, 120);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "better-find:open" && isActive()) {
      open();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !extensionAlive()) {
      return;
    }
    if (!changes[API.STORAGE_KEY] && !changes[API.SITES_KEY]) {
      return;
    }
    if (changes[API.STORAGE_KEY]) {
      state.settings = API.mergeSettings(changes[API.STORAGE_KEY].newValue);
    }
    if (changes[API.SITES_KEY]) {
      state.overrides = API.mergeOverrides(changes[API.SITES_KEY].newValue);
    }
    applySettings();
  });

  try {
    chrome.storage.sync.get([API.STORAGE_KEY, API.SITES_KEY], (data) => {
      if (chrome.runtime.lastError) {
        return;
      }
      state.settings = API.mergeSettings(data && data[API.STORAGE_KEY]);
      state.overrides = API.mergeOverrides(data && data[API.SITES_KEY]);
      state.loaded = true;
      if (isActive()) {
        applyDynamicStyle();
      }
    });
  } catch (e) {
    /* extension context unavailable; stay inert rather than ignore the user's rules */
  }
})();
