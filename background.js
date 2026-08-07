chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-better-find" || !tab?.id) {
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "better-find:open" }).catch(() => {});
});

function monacoBridge(payload) {
  const editorApi = window.monaco && window.monaco.editor;
  if (!editorApi || typeof editorApi.getEditors !== "function") {
    return { ok: false, reason: "no-monaco" };
  }
  const editors = editorApi.getEditors().filter((editor) => editor && editor.getModel());
  if (!editors.length) {
    return { ok: false, reason: "no-editors" };
  }

  const store = window.__betterFindMonaco || {};
  window.__betterFindMonaco = store;
  store.matches = store.matches || [];
  store.decorations = store.decorations || new Map();

  const setDecorations = (editor, slot, decorations) => {
    let slots = store.decorations.get(editor);
    if (!slots) {
      slots = {};
      store.decorations.set(editor, slots);
    }
    const existing = slots[slot];
    if (existing && existing.collection) {
      existing.collection.set(decorations);
      return;
    }
    if (typeof editor.createDecorationsCollection === "function") {
      slots[slot] = { collection: editor.createDecorationsCollection(decorations) };
      return;
    }
    if (typeof editor.deltaDecorations === "function") {
      const previous = existing && existing.ids ? existing.ids : [];
      slots[slot] = { ids: editor.deltaDecorations(previous, decorations) };
    }
  };

  const clearAll = () => {
    editors.forEach((editor) => {
      setDecorations(editor, "all", []);
      setDecorations(editor, "current", []);
    });
    store.matches = [];
  };

  if (payload.op === "clear") {
    clearAll();
    return { ok: true };
  }

  if (payload.op === "reveal") {
    const item = store.matches[payload.id];
    if (!item || !item.editor.getModel()) {
      return { ok: false, reason: "stale" };
    }
    item.editor.revealRangeInCenter(item.range, 1);
    editors.forEach((editor) => {
      if (editor !== item.editor) {
        setDecorations(editor, "current", []);
      }
    });
    setDecorations(item.editor, "current", [
      { range: item.range, options: { inlineClassName: "better-find-monaco-current" } },
    ]);
    return { ok: true, line: item.range.startLineNumber };
  }

  if (payload.op !== "find") {
    return { ok: false, reason: "bad-op" };
  }

  clearAll();
  if (!payload.query) {
    return { ok: true, matches: [] };
  }

  const separators = payload.wholeWord ? "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?" : null;
  editors.forEach((editor) => {
    const model = editor.getModel();
    let found = [];
    try {
      found = model.findMatches(
        payload.query,
        false,
        Boolean(payload.regex),
        Boolean(payload.caseSensitive),
        separators,
        false,
        payload.limit || 5000
      );
    } catch (e) {
      found = [];
    }
    if (!found.length) {
      return;
    }
    setDecorations(
      editor,
      "all",
      found.map((match) => ({
        range: match.range,
        options: { inlineClassName: "better-find-monaco-all" },
      }))
    );
    found.forEach((match) => {
      store.matches.push({ editor, range: match.range });
    });
  });

  return {
    ok: true,
    matches: store.matches.map((item, id) => ({
      id,
      line: item.range.startLineNumber,
      column: item.range.startColumn,
    })),
  };
}

function runMonacoBridge(tabId, frameId, payload, sendResponse) {
  chrome.scripting
    .executeScript({
      target: { tabId, frameIds: [frameId || 0] },
      world: "MAIN",
      func: monacoBridge,
      args: [payload],
    })
    .then((results) => {
      const first = results && results[0];
      sendResponse(first ? first.result : { ok: false, reason: "no-result" });
    })
    .catch((error) => {
      sendResponse({ ok: false, reason: String((error && error.message) || error) });
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "better-find:open-options") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  if (msg && msg.type === "better-find:monaco" && sender.tab && sender.tab.id) {
    runMonacoBridge(sender.tab.id, sender.frameId, msg.payload, sendResponse);
    return true;
  }
  return false;
});
