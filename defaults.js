(() => {
  const isMac = /mac/i.test(navigator.platform || navigator.userAgent);

  const DEFAULT_SETTINGS = {
    enabled: true,
    hotkey: {
      ctrlKey: !isMac,
      metaKey: isMac,
      altKey: false,
      shiftKey: false,
      key: "f",
    },
    alwaysOn: [],
    alwaysOff: [],
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
    defaultExpandCollapsibles: true,
    defaultSweepScrollers: true,
    defaultScanHidden: true,
    customCss: "",
    animation: "none",
    animationTarget: "current",
    animationSpeed: 1.2,
    animationIntensity: 60,
    scanProfiles: [],
  };

  const DEFAULT_PROFILE = {
    name: "",
    hotkey: null,
    expandCollapsibles: true,
    sweepScrollers: true,
    includeHidden: false,
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    diacritics: false,
  };

  const UNSUPPORTED_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "devtools:", "view-source:"];
  const UNSUPPORTED_HOSTS = ["chromewebstore.google.com", "chrome.google.com"];

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

  function parseUrl(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }

  function urlKey(url, includeHash) {
    const parsed = parseUrl(url);
    if (!parsed) {
      return "";
    }
    const hash = includeHash ? parsed.hash : "";
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${hash}`.toLowerCase();
  }

  function siteKey(url) {
    const parsed = parseUrl(url);
    if (!parsed) {
      return "";
    }
    return (parsed.host || parsed.protocol).toLowerCase();
  }

  function isSupportedUrl(url) {
    const parsed = parseUrl(url);
    if (!parsed) {
      return false;
    }
    if (UNSUPPORTED_SCHEMES.includes(parsed.protocol)) {
      return false;
    }
    return !UNSUPPORTED_HOSTS.includes(parsed.host.toLowerCase());
  }

  function normalizePattern(pattern) {
    const trimmed = String(pattern || "").trim().toLowerCase();
    if (!trimmed) {
      return "";
    }
    const hashIndex = trimmed.indexOf("#");
    const hash = hashIndex === -1 ? "" : trimmed.slice(hashIndex);
    let value = hashIndex === -1 ? trimmed : trimmed.slice(0, hashIndex);
    if (!value.includes("://")) {
      value = `*://${value}`;
    }
    const rest = value.slice(value.indexOf("://") + 3);
    if (!rest.includes("/")) {
      return hash ? `${value}/${hash}` : `${value}/*`;
    }
    if (hash) {
      return `${value}${hash}`;
    }
    return rest.endsWith("/") ? `${value}*` : value;
  }

  function globToSource(text, wildcard) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, wildcard);
  }

  function splitPattern(glob) {
    const schemeEnd = glob.indexOf("://");
    const rest = glob.slice(schemeEnd + 3);
    const slash = rest.indexOf("/");
    return {
      scheme: glob.slice(0, schemeEnd),
      host: slash === -1 ? rest : rest.slice(0, slash),
      path: slash === -1 ? "/*" : rest.slice(slash),
    };
  }

  const regexCache = new Map();

  function patternToRegex(pattern) {
    const glob = normalizePattern(pattern);
    if (!glob) {
      return null;
    }
    if (regexCache.has(glob)) {
      return regexCache.get(glob);
    }
    const parts = splitPattern(glob);
    const port = parts.host.includes(":") ? "" : "(:\\d+)?";
    const regex = new RegExp(
      `^${globToSource(parts.scheme, "[^:/]*")}://${globToSource(parts.host, "[^/]*")}${port}${globToSource(parts.path, ".*")}$`
    );
    regexCache.set(glob, regex);
    return regex;
  }

  function wantsHash(pattern) {
    return normalizePattern(pattern).includes("#");
  }

  function matchesPattern(pattern, url) {
    const regex = patternToRegex(pattern);
    const key = urlKey(url, wantsHash(pattern));
    if (!regex || !key) {
      return false;
    }
    return regex.test(key);
  }

  function matchingPattern(patterns, url) {
    const keys = { plain: urlKey(url, false), hashed: urlKey(url, true) };
    if (!keys.plain) {
      return null;
    }
    return (
      (patterns || []).find((pattern) => {
        const regex = patternToRegex(pattern);
        return regex ? regex.test(wantsHash(pattern) ? keys.hashed : keys.plain) : false;
      }) || null
    );
  }

  function hasOverride(overrides, url) {
    const site = siteKey(url);
    return Boolean(site) && Object.prototype.hasOwnProperty.call(overrides || {}, site);
  }

  function resolveState(settings, overrides, url) {
    if (!settings || !settings.enabled) {
      return { enabled: false, reason: "master-off" };
    }
    if (!isSupportedUrl(url)) {
      return { enabled: false, reason: "unsupported" };
    }
    if (hasOverride(overrides, url)) {
      const site = siteKey(url);
      return { enabled: Boolean(overrides[site]), reason: "override", detail: site };
    }
    const on = matchingPattern(settings.alwaysOn, url);
    if (on) {
      return { enabled: true, reason: "always-on", detail: on };
    }
    const off = matchingPattern(settings.alwaysOff, url);
    if (off) {
      return { enabled: false, reason: "always-off", detail: off };
    }
    return { enabled: true, reason: "default" };
  }

  function isEnabledFor(settings, overrides, url) {
    return resolveState(settings, overrides, url).enabled;
  }

  function globsIntersect(a, b) {
    const seen = new Set();
    const walk = (i, j) => {
      const key = i * (b.length + 1) + j;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      if (i === a.length && j === b.length) {
        return true;
      }
      if (i === a.length) {
        return /^\**$/.test(b.slice(j));
      }
      if (j === b.length) {
        return /^\**$/.test(a.slice(i));
      }
      if (a[i] === "*") {
        return walk(i + 1, j) || walk(i, j + 1);
      }
      if (b[j] === "*") {
        return walk(i, j + 1) || walk(i + 1, j);
      }
      if (a[i] === b[j]) {
        return walk(i + 1, j + 1);
      }
      return false;
    };
    return walk(0, 0);
  }

  function stripPort(host) {
    const colon = host.lastIndexOf(":");
    return colon === -1 ? host : host.slice(0, colon);
  }

  function hostsIntersect(hostA, hostB) {
    if (hostA.includes(":") === hostB.includes(":")) {
      return globsIntersect(hostA, hostB);
    }
    return globsIntersect(stripPort(hostA), stripPort(hostB));
  }

  function patternsIntersect(globA, globB) {
    const a = splitPattern(globA);
    const b = splitPattern(globB);
    return (
      globsIntersect(a.scheme, b.scheme) &&
      hostsIntersect(a.host, b.host) &&
      globsIntersect(a.path, b.path)
    );
  }

  function addIssue(current, level, counterpart) {
    const next = current || { level: "warn", conflicts: [], overlaps: [] };
    const bucket = level === "conflict" ? next.conflicts : next.overlaps;
    if (level === "conflict") {
      next.level = "conflict";
    }
    if (!bucket.includes(counterpart)) {
      bucket.push(counterpart);
    }
    return next;
  }

  function analyzeRules(alwaysOn, alwaysOff) {
    const on = (alwaysOn || []).map(normalizePattern);
    const off = (alwaysOff || []).map(normalizePattern);
    const result = { on: on.map(() => null), off: off.map(() => null) };
    on.forEach((a, i) => {
      off.forEach((b, j) => {
        if (!a || !b) {
          return;
        }
        const level = a === b ? "conflict" : patternsIntersect(a, b) ? "warn" : null;
        if (!level) {
          return;
        }
        result.on[i] = addIssue(result.on[i], level, alwaysOff[j]);
        result.off[j] = addIssue(result.off[j], level, alwaysOn[i]);
      });
    });
    return result;
  }

  window.BetterFind = {
    STORAGE_KEY: "betterFindSettings",
    SITES_KEY: "betterFindSites",
    DEFAULT_SETTINGS,
    DEFAULT_PROFILE,
    isMac,
    formatHotkey,
    normalizePattern,
    patternToRegex,
    matchesPattern,
    matchingPattern,
    siteKey,
    urlKey,
    isSupportedUrl,
    hasOverride,
    resolveState,
    isEnabledFor,
    globsIntersect,
    patternsIntersect,
    analyzeRules,
    mergeSettings(stored) {
      const merged = Object.assign({}, DEFAULT_SETTINGS, stored || {});
      merged.hotkey = Object.assign({}, DEFAULT_SETTINGS.hotkey, (stored && stored.hotkey) || {});
      merged.alwaysOn = Array.isArray(merged.alwaysOn) ? merged.alwaysOn.slice() : [];
      merged.alwaysOff = Array.isArray(merged.alwaysOff) ? merged.alwaysOff.slice() : [];
      merged.scanProfiles = Array.isArray(merged.scanProfiles)
        ? merged.scanProfiles.map((p) => {
            const profile = Object.assign({}, DEFAULT_PROFILE, p);
            if (p && p.hotkey) {
              profile.hotkey = Object.assign({}, p.hotkey);
            }
            return profile;
          })
        : [];
      return merged;
    },
    mergeOverrides(stored) {
      const merged = {};
      Object.entries(stored || {}).forEach(([site, value]) => {
        merged[site.toLowerCase()] = Boolean(value);
      });
      return merged;
    },
  };
})();
