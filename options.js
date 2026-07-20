const API = window.BetterFind;

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
  customCss: document.getElementById("customCss"),
  animation: document.getElementById("animation"),
  animationTarget: document.getElementById("animationTarget"),
  animationSpeed: document.getElementById("animationSpeed"),
  animationIntensity: document.getElementById("animationIntensity"),
};

const hotkeyBtn = document.getElementById("hotkey");
const hotkeyClear = document.getElementById("hotkey-clear");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");
const previewAll = document.getElementById("preview-all");
const previewCurrent = document.getElementById("preview-current");

let settings = API.DEFAULT_SETTINGS;
let recording = false;
let statusTimer = null;

function render() {
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

function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.add("show");
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  statusTimer = setTimeout(() => statusEl.classList.remove("show"), 1400);
}

function save() {
  chrome.storage.sync.set({ [API.STORAGE_KEY]: settings }, () => showStatus("Saved"));
}

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

chrome.storage.sync.get(API.STORAGE_KEY, (data) => {
  settings = API.mergeSettings(data && data[API.STORAGE_KEY]);
  render();
});
