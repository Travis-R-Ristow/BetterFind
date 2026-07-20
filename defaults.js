(() => {
  const isMac = /mac/i.test(navigator.platform || navigator.userAgent);

  const DEFAULT_SETTINGS = {
    hotkey: {
      ctrlKey: !isMac,
      metaKey: isMac,
      altKey: false,
      shiftKey: false,
      key: "f",
    },
    colorAllBg: "#fce38a",
    colorAllText: "#1a1a1a",
    colorCurrentBg: "#ff9632",
    colorCurrentText: "#1a1a1a",
    theme: "auto",
    position: "top-right",
    defaultCaseSensitive: false,
    defaultWholeWord: false,
    defaultRegex: false,
    defaultHidden: false,
    defaultIgnoreDiacritics: false,
    liveUpdate: false,
    customCss: "",
    animation: "none",
    animationTarget: "current",
    animationSpeed: 1.2,
    animationIntensity: 60,
  };

  function formatHotkey(hk) {
    if (!hk || !hk.key) {
      return "Unset";
    }
    const parts = [];
    if (hk.ctrlKey) {
      parts.push("Ctrl");
    }
    if (hk.metaKey) {
      parts.push(isMac ? "⌘" : "Meta");
    }
    if (hk.altKey) {
      parts.push(isMac ? "⌥" : "Alt");
    }
    if (hk.shiftKey) {
      parts.push("Shift");
    }
    parts.push(hk.key.length === 1 ? hk.key.toUpperCase() : hk.key);
    return parts.join(" + ");
  }

  window.BetterFind = {
    STORAGE_KEY: "betterFindSettings",
    DEFAULT_SETTINGS,
    isMac,
    formatHotkey,
    mergeSettings(stored) {
      const merged = Object.assign({}, DEFAULT_SETTINGS, stored || {});
      merged.hotkey = Object.assign({}, DEFAULT_SETTINGS.hotkey, (stored && stored.hotkey) || {});
      return merged;
    },
  };
})();
