console.info("[Gemini Nexus] Background Service Worker Started");

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ success: true });
  }
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle_pip_window') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'PIP_TOGGLE' }).catch(() => {});
    }
  }
});

setInterval(() => {
  console.log('[KeepAlive]');
}, 20000);
