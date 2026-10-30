const API = window.BetterFind;

const RULE_LISTS = ["alwaysOn", "alwaysOff"];
const SAVE_DEBOUNCE_MS = 400;

const fields = {
  colorAllBg: document.getElementById("colorAllBg"),
  colorAllText: document.getElementById("colorAllText"),
  colorCurrentBg: document.getElementById("colorCurrentBg"),
  colorCurrentText: document.getElementById("colorCurrentText"),
  theme: document.getElementById("theme"),
  position: document.getElementById("position"),
  defaultCaseSensitive: document.getElementById("defaultCaseSensitive"),
  defaultWholeWord: document.getElementById("defaultWholeWord"),
  defaultRegex: document.getElementById("defaultRegex"),
  defaultHidden: document.getElementById("defaultHidden"),
  defaultIgnoreDiacritics: document.getElementById("defaultIgnoreDiacritics"),
  liveUpdate: document.getElementById("liveUpdate"),
  defaultExpandCollapsibles: document.getElementById("defaultExpandCollapsibles"),
  defaultSweepScrollers: document.getElementById("defaultSweepScrollers"),
  defaultScanHidden: document.getElementById("defaultScanHidden"),
  customCss: document.getElementById("customCss"),
  animation: document.getElementById("animation"),
  animationTarget: document.getElementById("animationTarget"),
  animationSpeed: document.getElementById("animationSpeed"),
  animationIntensity: document.getElementById("animationIntensity"),
};

const enabledEl = document.getElementById("enabled");
const masterStateEl = document.getElementById("master-state");
const overridesCard = document.getElementById("overrides-card");
const overridesList = document.getElementById("list-overrides");
const hotkeyBtn = document.getElementById("hotkey");
const hotkeyClear = document.getElementById("hotkey-clear");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const previewAll = document.getElementById("preview-all");
const previewCurrent = document.getElementById("preview-current");

const pageEl = document.querySelector(".page");

let settings = API.mergeSettings(null);
let overrides = {};
let loaded = false;
let recording = false;
let statusTimer = null;
let saveTimer = null;

pageEl.inert = true;

function render() {
  renderMaster();
  renderRules();
  renderOverrides();
  renderProfiles();
  fields.colorAllBg.value = settings.colorAllBg;
  fields.colorAllText.value = settings.colorAllText;
  fields.colorCurrentBg.value = settings.colorCurrentBg;
  fields.colorCurrentText.value = settings.colorCurrentText;
  fields.theme.value = settings.theme;
  fields.position.value = settings.position;
  fields.defaultCaseSensitive.checked = settings.defaultCaseSensitive;
  fields.defaultWholeWord.checked = settings.defaultWholeWord;
  fields.defaultRegex.checked = settings.defaultRegex;
  fields.defaultHidden.checked = settings.defaultHidden;
  fields.defaultIgnoreDiacritics.checked = settings.defaultIgnoreDiacritics;
  fields.liveUpdate.checked = settings.liveUpdate;
  fields.defaultExpandCollapsibles.checked = settings.defaultExpandCollapsibles;
  fields.defaultSweepScrollers.checked = settings.defaultSweepScrollers;
  fields.defaultScanHidden.checked = settings.defaultScanHidden;
  fields.customCss.value = settings.customCss;
  fields.animation.value = settings.animation;
  fields.animationTarget.value = settings.animationTarget;
  fields.animationSpeed.value = settings.animationSpeed;
  fields.animationIntensity.value = settings.animationIntensity;
  renderRangeValues();
  hotkeyBtn.textContent = API.formatHotkey(settings.hotkey);
  renderPreview();
}

function renderRangeValues() {
  document.getElementById("animationSpeed-val").textContent = `${settings.animationSpeed}s`;
  document.getElementById("animationIntensity-val").textContent = `${settings.animationIntensity}%`;
}

function renderPreview() {
  previewAll.style.backgroundColor = settings.colorAllBg;
  previewAll.style.color = settings.colorAllText;
  previewCurrent.style.backgroundColor = settings.colorCurrentBg;
  previewCurrent.style.color = settings.colorCurrentText;
}

function showStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle("is-error", Boolean(isError));
  statusEl.classList.add("show");
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (!isError) {
    statusTimer = setTimeout(() => statusEl.classList.remove("show"), 1400);
  }
}

function reportWrite() {
  if (chrome.runtime.lastError) {
    showStatus(`Save failed: ${chrome.runtime.lastError.message}`, true);
    return;
  }
  showStatus("Saved");
}

function cleanList(list) {
  return (list || []).map((entry) => entry.trim()).filter(Boolean);
}

function save() {
  if (!loaded) {
    return;
  }
  const payload = Object.assign({}, settings, {
    alwaysOn: cleanList(settings.alwaysOn),
    alwaysOff: cleanList(settings.alwaysOff),
  });
  chrome.storage.sync.set({ [API.STORAGE_KEY]: payload }, reportWrite);
}

function saveSoon() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
}

function saveOverrides() {
  if (!loaded) {
    return;
  }
  chrome.storage.sync.set({ [API.SITES_KEY]: overrides }, reportWrite);
}

function renderMaster() {
  enabledEl.checked = settings.enabled;
  masterStateEl.textContent = settings.enabled ? "On" : "Off everywhere";
}

function issueText(key, issue) {
  const other = key === "alwaysOn" ? "always off" : "always on";
  if (issue.level === "conflict") {
    return `Same pattern in ${other}: ${issue.conflicts.join(", ")} — always-on wins. Remove one.`;
  }
  const patterns = issue.overlaps.join(", ");
  if (key === "alwaysOn") {
    return `Overlaps ${other}: ${patterns} — always-on wins for the shared URLs.`;
  }
  return `Overlaps ${other}: ${patterns} — always-on wins, so this never applies there.`;
}

function refreshRuleIssues() {
  const analysis = API.analyzeRules(settings.alwaysOn, settings.alwaysOff);
  const issues = { alwaysOn: analysis.on, alwaysOff: analysis.off };
  RULE_LISTS.forEach((key) => {
    document.querySelectorAll(`#list-${key} .rule`).forEach((row) => {
      const issue = issues[key][Number(row.dataset.index)];
      row.classList.toggle("is-conflict", Boolean(issue) && issue.level === "conflict");
      row.classList.toggle("is-warn", Boolean(issue) && issue.level === "warn");
      row.querySelector(".rule-issue").textContent = issue ? issueText(key, issue) : "";
    });
  });
}

function buildRuleRow(key, pattern, index) {
  const row = document.createElement("div");
  row.className = "rule";
  row.dataset.index = String(index);

  const main = document.createElement("div");
  main.className = "rule-main";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "rule-input";
  input.value = pattern;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.placeholder = key === "alwaysOn" ? "example.com" : "*.example.com/admin/*";
  input.setAttribute("aria-label", key === "alwaysOn" ? "Always-on pattern" : "Always-off pattern");
  input.addEventListener("input", () => {
    settings[key][index] = input.value;
    refreshRuleIssues();
    saveSoon();
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "rule-remove";
  remove.textContent = "×";
  remove.title = "Remove pattern";
  remove.setAttribute("aria-label", "Remove pattern");
  remove.addEventListener("click", () => {
    settings[key].splice(index, 1);
    renderRules();
    save();
  });

  const issue = document.createElement("p");
  issue.className = "rule-issue";

  main.append(input, remove);
  row.append(main, issue);
  return row;
}

function renderRules() {
  RULE_LISTS.forEach((key) => {
    const list = document.getElementById(`list-${key}`);
    list.textContent = "";
    settings[key].forEach((pattern, index) => {
      list.appendChild(buildRuleRow(key, pattern, index));
    });
    document.getElementById(`empty-${key}`).hidden = settings[key].length > 0;
  });
  refreshRuleIssues();
}

function addRule(key) {
  settings[key].push("");
  renderRules();
  const inputs = document.querySelectorAll(`#list-${key} .rule-input`);
  const last = inputs[inputs.length - 1];
  if (last) {
    last.focus();
  }
}

function renderOverrides() {
  const entries = Object.entries(overrides).sort((a, b) => a[0].localeCompare(b[0]));
  overridesCard.hidden = entries.length === 0;
  overridesList.textContent = "";
  entries.forEach(([site, enabled]) => {
    const row = document.createElement("div");
    row.className = "override";

    const host = document.createElement("span");
    host.className = "override-host";
    host.textContent = site;

    const state = document.createElement("span");
    state.className = "override-state";
    state.textContent = enabled ? "Always on" : "Always off";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "rule-remove";
    remove.textContent = "×";
    remove.title = `Clear override for ${site}`;
    remove.setAttribute("aria-label", `Clear override for ${site}`);
    remove.addEventListener("click", () => {
      delete overrides[site];
      renderOverrides();
      saveOverrides();
    });

    row.append(host, state, remove);
    overridesList.appendChild(row);
  });
}

function buildProfileCheck(label, checked, onChange) {
  const wrapper = document.createElement("label");
  wrapper.className = "check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  wrapper.append(input, document.createTextNode(` ${label}`));
  return wrapper;
}

function buildProfileCard(index) {
  const profile = settings.scanProfiles[index];
  const card = document.createElement("div");
  card.className = "profile-card";

  const header = document.createElement("div");
  header.className = "profile-header";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "profile-name";
  nameInput.value = profile.name;
  nameInput.placeholder = "Profile name";
  nameInput.spellcheck = false;
  nameInput.autocomplete = "off";
  nameInput.addEventListener("input", () => {
    profile.name = nameInput.value;
    saveSoon();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "rule-remove";
  removeBtn.textContent = "×";
  removeBtn.title = "Remove profile";
  removeBtn.setAttribute("aria-label", "Remove profile");
  removeBtn.addEventListener("click", () => {
    settings.scanProfiles.splice(index, 1);
    renderProfiles();
    save();
  });

  header.append(nameInput, removeBtn);

  const hotkeyRow = document.createElement("div");
  hotkeyRow.className = "profile-row";

  const hotkeyLabel = document.createElement("label");
  hotkeyLabel.textContent = "Hotkey";

  const hotkeyWrap = document.createElement("div");
  hotkeyWrap.className = "hotkey-wrap";

  const profileHotkeyBtn = document.createElement("button");
  profileHotkeyBtn.type = "button";
  profileHotkeyBtn.className = "hotkey";
  profileHotkeyBtn.textContent = profile.hotkey ? API.formatHotkey(profile.hotkey) : "Click to set";

  const profileHotkeyClear = document.createElement("button");
  profileHotkeyClear.type = "button";
  profileHotkeyClear.className = "ghost small";
  profileHotkeyClear.textContent = "Clear";
  profileHotkeyClear.addEventListener("click", () => {
    profile.hotkey = null;
    profileHotkeyBtn.textContent = "Click to set";
    save();
  });

  let isRecording = false;

  function stopProfileRecording() {
    isRecording = false;
    profileHotkeyBtn.classList.remove("recording");
    profileHotkeyBtn.textContent = profile.hotkey ? API.formatHotkey(profile.hotkey) : "Click to set";
  }

  profileHotkeyBtn.addEventListener("click", () => {
    if (recording) {
      stopRecording();
    }
    isRecording = true;
    profileHotkeyBtn.classList.add("recording");
    profileHotkeyBtn.textContent = "Press a shortcut…";
  });

  profileHotkeyBtn.addEventListener("keydown", (e) => {
    if (!isRecording) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      stopProfileRecording();
      return;
    }
    const modifierKeys = ["Control", "Meta", "Alt", "Shift"];
    if (modifierKeys.includes(e.key)) {
      return;
    }
    profile.hotkey = {
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    };
    stopProfileRecording();
    save();
  });

  profileHotkeyBtn.addEventListener("blur", () => {
    if (isRecording) {
      stopProfileRecording();
    }
  });

  hotkeyWrap.append(profileHotkeyBtn, profileHotkeyClear);
  hotkeyRow.append(hotkeyLabel, hotkeyWrap);

  const scanSection = document.createElement("div");
  scanSection.className = "profile-section";
  const scanTitle = document.createElement("h4");
  scanTitle.textContent = "Scan behavior";
  scanSection.appendChild(scanTitle);
  scanSection.appendChild(buildProfileCheck("Expand collapsibles", profile.expandCollapsibles, (v) => {
    profile.expandCollapsibles = v;
    save();
  }));
  scanSection.appendChild(buildProfileCheck("Sweep scrollers", profile.sweepScrollers, (v) => {
    profile.sweepScrollers = v;
    save();
  }));

  const searchSection = document.createElement("div");
  searchSection.className = "profile-section";
  const searchTitle = document.createElement("h4");
  searchTitle.textContent = "Search options";
  searchSection.appendChild(searchTitle);
  searchSection.appendChild(buildProfileCheck("Match case", profile.caseSensitive, (v) => {
    profile.caseSensitive = v;
    save();
  }));
  searchSection.appendChild(buildProfileCheck("Whole word", profile.wholeWord, (v) => {
    profile.wholeWord = v;
    save();
  }));
  searchSection.appendChild(buildProfileCheck("Regular expression", profile.regex, (v) => {
    profile.regex = v;
    save();
  }));
  searchSection.appendChild(buildProfileCheck("Include hidden", profile.includeHidden, (v) => {
    profile.includeHidden = v;
    save();
  }));
  searchSection.appendChild(buildProfileCheck("Ignore accents", profile.diacritics, (v) => {
    profile.diacritics = v;
    save();
  }));

  card.append(header, hotkeyRow, scanSection, searchSection);
  return card;
}

function renderProfiles() {
  const list = document.getElementById("list-profiles");
  list.textContent = "";
  settings.scanProfiles.forEach((_, index) => {
    list.appendChild(buildProfileCard(index));
  });
  document.getElementById("empty-profiles").hidden = settings.scanProfiles.length > 0;
}

function addProfile() {
  const name = `Profile ${settings.scanProfiles.length + 1}`;
  settings.scanProfiles.push(Object.assign({}, API.DEFAULT_PROFILE, { name }));
  renderProfiles();
  save();
  const nameInputs = document.querySelectorAll("#list-profiles .profile-name");
  const last = nameInputs[nameInputs.length - 1];
  if (last) {
    last.focus();
    last.select();
  }
}

document.getElementById("add-profile").addEventListener("click", addProfile);

enabledEl.addEventListener("change", () => {
  settings.enabled = enabledEl.checked;
  renderMaster();
  save();
});

document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => addRule(btn.dataset.add));
});

function bindField(key, el, prop) {
  el.addEventListener("input", () => {
    if (prop === "checked") {
      settings[key] = el.checked;
    } else if (prop === "number") {
      settings[key] = parseFloat(el.value);
    } else {
      settings[key] = el.value;
    }
    renderRangeValues();
    renderPreview();
    save();
  });
}

bindField("colorAllBg", fields.colorAllBg, "value");
bindField("colorAllText", fields.colorAllText, "value");
bindField("colorCurrentBg", fields.colorCurrentBg, "value");
bindField("colorCurrentText", fields.colorCurrentText, "value");
bindField("theme", fields.theme, "value");
bindField("position", fields.position, "value");
bindField("defaultCaseSensitive", fields.defaultCaseSensitive, "checked");
bindField("defaultWholeWord", fields.defaultWholeWord, "checked");
bindField("defaultRegex", fields.defaultRegex, "checked");
bindField("defaultHidden", fields.defaultHidden, "checked");
bindField("defaultIgnoreDiacritics", fields.defaultIgnoreDiacritics, "checked");
bindField("liveUpdate", fields.liveUpdate, "checked");
bindField("defaultExpandCollapsibles", fields.defaultExpandCollapsibles, "checked");
bindField("defaultSweepScrollers", fields.defaultSweepScrollers, "checked");
bindField("defaultScanHidden", fields.defaultScanHidden, "checked");
bindField("customCss", fields.customCss, "value");
bindField("animation", fields.animation, "value");
bindField("animationTarget", fields.animationTarget, "value");
bindField("animationSpeed", fields.animationSpeed, "number");
bindField("animationIntensity", fields.animationIntensity, "number");

function stopRecording() {
  recording = false;
  hotkeyBtn.classList.remove("recording");
  hotkeyBtn.textContent = API.formatHotkey(settings.hotkey);
}

hotkeyBtn.addEventListener("click", () => {
  recording = true;
  hotkeyBtn.classList.add("recording");
  hotkeyBtn.textContent = "Press a shortcut…";
});

hotkeyBtn.addEventListener("keydown", (e) => {
  if (!recording) {
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    stopRecording();
    return;
  }

  const modifierKeys = ["Control", "Meta", "Alt", "Shift"];
  if (modifierKeys.includes(e.key)) {
    return;
  }

  settings.hotkey = {
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    shiftKey: e.shiftKey,
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
  };
  stopRecording();
  save();
});

hotkeyBtn.addEventListener("blur", stopRecording);

hotkeyClear.addEventListener("click", () => {
  settings.hotkey = Object.assign({}, API.DEFAULT_SETTINGS.hotkey);
  render();
  save();
});

resetBtn.addEventListener("click", () => {
  settings = API.mergeSettings(null);
  render();
  save();
});

function isEditing() {
  const el = document.activeElement;
  return Boolean(el) && /^(input|textarea)$/i.test(el.tagName);
}

chrome.storage.sync.get([API.STORAGE_KEY, API.SITES_KEY], (data) => {
  if (chrome.runtime.lastError) {
    showStatus("Couldn't load settings — reload this page.", true);
    return;
  }
  settings = API.mergeSettings(data && data[API.STORAGE_KEY]);
  overrides = API.mergeOverrides(data && data[API.SITES_KEY]);
  loaded = true;
  pageEl.inert = false;
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !loaded) {
    return;
  }
  if (changes[API.SITES_KEY]) {
    overrides = API.mergeOverrides(changes[API.SITES_KEY].newValue);
    renderOverrides();
  }
  if (changes[API.STORAGE_KEY]) {
    settings = API.mergeSettings(changes[API.STORAGE_KEY].newValue);
    if (isEditing()) {
      renderMaster();
    } else {
      render();
    }
  }
});
