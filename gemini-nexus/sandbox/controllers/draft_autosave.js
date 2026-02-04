export class DraftAutosaveController {
  constructor(sessionManager, uiController) {
    this.sessionManager = sessionManager;
    this.ui = uiController;
    this.drafts = new Map();
    this.autosaveInterval = null;
    this.lastSavedContent = '';
  }

  init() {
    this.autosaveInterval = setInterval(() => this._autosave(), 2000);

    if (this.ui.inputFn) {
      this.ui.inputFn.addEventListener('blur', () => this._saveDraft());
    }

    this._loadDraftsFromStorage();
  }

  destroy() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  onSessionSwitch(oldSessionId, newSessionId) {
    if (oldSessionId) {
      this._saveDraft(oldSessionId);
    }
    if (newSessionId) {
      this._restoreDraft(newSessionId);
    }
  }

  onMessageSent(sessionId) {
    if (sessionId) {
      this.drafts.delete(sessionId);
      this._persistDraftsToStorage();
      this.lastSavedContent = '';
    }
  }

  _autosave() {
    const currentContent = this.ui.inputFn ? this.ui.inputFn.value : '';

    if (currentContent !== this.lastSavedContent) {
      if (currentContent.trim()) {
        this._saveDraft();
      }
      this.lastSavedContent = currentContent;
    }
  }

  _saveDraft(sessionId = null) {
    const targetSessionId = sessionId || this.sessionManager.currentSessionId;
    if (!targetSessionId) return;

    const content = this.ui.inputFn ? this.ui.inputFn.value : '';

    if (content.trim()) {
      this.drafts.set(targetSessionId, {
        content: content,
        timestamp: Date.now()
      });
    } else {
      this.drafts.delete(targetSessionId);
    }

    this._persistDraftsToStorage();
  }

  _restoreDraft(sessionId) {
    if (!sessionId) return;

    const draft = this.drafts.get(sessionId);

    if (draft && draft.content && this.ui.inputFn) {
      if (!this.ui.inputFn.value.trim()) {
        this.ui.inputFn.value = draft.content;
        this.ui.inputFn.style.height = 'auto';
        this.ui.inputFn.style.height = this.ui.inputFn.scrollHeight + 'px';
      }
    }

    this.lastSavedContent = this.ui.inputFn ? this.ui.inputFn.value : '';
  }

  _persistDraftsToStorage() {
    const draftsObj = Object.fromEntries(this.drafts);

    window.parent.postMessage({
      action: 'SAVE_DRAFTS',
      payload: draftsObj
    }, '*');
  }

  _loadDraftsFromStorage() {
    window.parent.postMessage({
      action: 'GET_DRAFTS'
    }, '*');
  }

  receiveDrafts(draftsData) {
    if (draftsData && typeof draftsData === 'object') {
      this.drafts = new Map(Object.entries(draftsData));

      const currentSessionId = this.sessionManager.currentSessionId;
      if (currentSessionId && this.drafts.has(currentSessionId)) {
        this._restoreDraft(currentSessionId);
      }
    }
  }
}
