chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "open-better-find" || !tab?.id) {
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: "better-find:open" }).catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "better-find:open-options") {
    chrome.runtime.openOptionsPage();
  }
});
