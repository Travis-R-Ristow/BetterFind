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
  hotkeyBtn.textContent = API.formatHotkey(settings.hotkey);
  renderPreview();
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
    settings[key] = prop === "checked" ? el.checked : el.value;
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
