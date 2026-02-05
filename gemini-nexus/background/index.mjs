import { GeminiSessionManager } from './managers/session_manager.js';
import { ImageManager } from './managers/image_manager.js';
import { BrowserControlManager } from './managers/control_manager.js';
import { McpRemoteManager } from './managers/mcp_remote_manager.js';
import { LogManager, setupConsoleInterception } from './managers/log_manager.js';
import { keepAliveManager } from './managers/keep_alive.js';
import { setupContextMenus } from './menus.js';
import { setupMessageListener } from './messages.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const logManager = new LogManager();

setupConsoleInterception(logManager);

console.info("[Gemini Nexus] Background Service Worker Started");

const sessionManager = new GeminiSessionManager();
const imageManager = new ImageManager();
const controlManager = new BrowserControlManager();
const mcpManager = new McpRemoteManager({
  clientName: 'gemini-nexus',
  clientVersion: chrome.runtime.getManifest().version
});

setupContextMenus(imageManager);
setupMessageListener(sessionManager, imageManager, controlManager, mcpManager, logManager);

chrome.commands.onCommand.addListener(async (command) => {
  console.log('[Background] Command received:', command);

  if (command === 'toggle_pip_window') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      console.warn('[Background] No active tab found');
      return;
    }

    console.log('[Background] Active tab:', tab.id, tab.url);

    chrome.tabs.sendMessage(tab.id, { action: 'PIP_CHECK' })
    .then(checkResponse => {
      console.log('[Background] PIP check response:', checkResponse);

      if (checkResponse && checkResponse.exists) {
        console.log('[Background] PIP exists, closing window');
        chrome.tabs.sendMessage(tab.id, { action: 'PIP_CLOSE' })
        .then(response => console.log('[Background] Toggle response:', response))
        .catch(error => console.error('[Background] Toggle failed:', error));
      } else {
        console.log('[Background] PIP does not exist, creating new window');
        chrome.tabs.sendMessage(tab.id, { action: 'PIP_CREATE' })
        .then(response => {
          console.log('[Background] Create response:', response);
          if (response && !response.success) {
            console.error('[Background] PIP creation error:', response.error);
          }
        })
        .catch(error => {
          console.error('[Background] Failed to send PIP_CREATE:', error);
          console.error('[Background] Content script may not be loaded on:', tab.url);
        });
      }
    })
    .catch(error => {
      console.error('[Background] Failed to check PIP status:', error);
      console.error('[Background] Content script is not loaded on this page');
      console.error('[Background] Tab URL:', tab.url);
    });
  }
});

keepAliveManager.init();
