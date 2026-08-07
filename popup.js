const API = window.BetterFind;

const enabledEl = document.getElementById("enabled");
const masterStateEl = document.getElementById("master-state");
const siteEnabledEl = document.getElementById("site-enabled");
const siteHostEl = document.getElementById("site-host");
const siteWhyEl = document.getElementById("site-why");
const siteClearEl = document.getElementById("site-clear");
const errorEl = document.getElementById("error");
const optionsEl = document.getElementById("open-options");

let settings = API.mergeSettings(null);
let overrides = {};
let url = "";
let loaded = false;

function reasonText(state, shadowed) {
  if (state.reason === "master-off") {
    return "Off everywhere. Site rules are ignored.";
  }
  if (state.reason === "unsupported") {
    return "Chrome blocks extensions on this page.";
  }
  if (state.reason === "override") {
    return shadowed
      ? `Override for this site, ignoring your "${shadowed}" rule.`
      : "Override set for this site.";
  }
  if (state.reason === "always-on") {
    return `Always-on rule: ${state.detail}`;
  }
  if (state.reason === "always-off") {
    return `Always-off rule: ${state.detail}`;
  }
  return "No rule matches — on by default.";
}

function showError(text) {
  errorEl.textContent = text || "";
  errorEl.hidden = !text;
}

function render() {
  const state = API.resolveState(settings, overrides, url);
  const site = API.siteKey(url);
  const supported = API.isSupportedUrl(url);
  const hasOverride = API.hasOverride(overrides, url);
  const listed =
    API.matchingPattern(settings.alwaysOn, url) || API.matchingPattern(settings.alwaysOff, url);
  const shadowed = hasOverride && listed ? listed : null;

  document.body.classList.toggle("is-loading", !loaded);

  enabledEl.checked = settings.enabled;
  enabledEl.disabled = !loaded;
  masterStateEl.textContent = settings.enabled ? "On" : "Off everywhere";

  siteHostEl.textContent = site || "this page";
  siteEnabledEl.checked = state.enabled;
  siteEnabledEl.disabled = !loaded || !settings.enabled || !supported;

  siteWhyEl.textContent = reasonText(state, shadowed);
  siteWhyEl.classList.toggle("is-warn", Boolean(shadowed) || !supported);

  siteClearEl.hidden = !hasOverride;
}

function load(done) {
  chrome.storage.sync.get([API.STORAGE_KEY, API.SITES_KEY], (data) => {
    if (chrome.runtime.lastError) {
      showError("Couldn't read settings. Reopen this popup.");
      render();
      return;
    }
    settings = API.mergeSettings(data && data[API.STORAGE_KEY]);
    overrides = API.mergeOverrides(data && data[API.SITES_KEY]);
    loaded = true;
    showError("");
    render();
    if (done) {
      done();
    }
  });
}

function write(items) {
  if (!loaded) {
    return;
  }
  chrome.storage.sync.set(items, () => {
    if (chrome.runtime.lastError) {
      showError(`Couldn't save: ${chrome.runtime.lastError.message}`);
      load();
      return;
    }
    showError("");
  });
}

enabledEl.addEventListener("change", () => {
  settings.enabled = enabledEl.checked;
  write({ [API.STORAGE_KEY]: settings });
  render();
});

siteEnabledEl.addEventListener("change", () => {
  const site = API.siteKey(url);
  if (!site) {
    return;
  }
  const withoutOverride = API.resolveState(settings, {}, url);
  if (withoutOverride.enabled === siteEnabledEl.checked) {
    delete overrides[site];
  } else {
    overrides[site] = siteEnabledEl.checked;
  }
  write({ [API.SITES_KEY]: overrides });
  render();
});

siteClearEl.addEventListener("click", () => {
  delete overrides[API.siteKey(url)];
  write({ [API.SITES_KEY]: overrides });
  render();
});

optionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  url = (tabs && tabs[0] && tabs[0].url) || "";
  load();
});
