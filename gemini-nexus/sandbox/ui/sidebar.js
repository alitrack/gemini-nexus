
// ui_sidebar.js -> sandbox/ui/sidebar.js
import { t } from '../core/i18n.js';

export class SidebarController {
    constructor(elements, callbacks) {
        this.sidebar = elements.sidebar;
        this.overlay = elements.sidebarOverlay;
        this.listEl = elements.historyListEl;
        this.toggleBtn = elements.historyToggleBtn;
        this.closeBtn = elements.closeSidebarBtn;
        
        // Search Elements
        this.searchInput = document.getElementById('history-search');
        
        this.callbacks = callbacks || {};

        // State for search
        this.allSessions = [];
        this.currentSessionId = null;
        this.itemCallbacks = null;
        this.fuse = null;

        this.initListeners();
    }

    initListeners() {
        if(this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if(this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if(this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.close();
                if (this.callbacks.onOverlayClick) {
                    this.callbacks.onOverlayClick();
                }
            });
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        
        const importBtn = document.getElementById('import-sessions-btn');
        const importInput = document.getElementById('import-sessions-input');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => this.handleImport(e));
        }
    }
    
    async handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            let sessions = [];
            
            if (file.name.endsWith('.json')) {
                sessions = JSON.parse(text);
            } else if (file.name.endsWith('.md')) {
                sessions = this.parseMarkdownSessions(text);
            }
            
            if (this.callbacks.onImport && sessions.length > 0) {
                this.callbacks.onImport(sessions);
            }
        } catch (err) {
            console.error('Import failed:', err);
            alert('Import failed: ' + err.message);
        }
        
        e.target.value = '';
    }
    
    parseMarkdownSessions(markdown) {
        const sessions = [];
        const sessionBlocks = markdown.split(/\n## /).slice(1);
        
        sessionBlocks.forEach(block => {
            const lines = block.split('\n');
            const title = lines[0].trim();
            const messages = [];
            
            let currentRole = null;
            let currentText = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('**User**:')) {
                    if (currentRole) {
                        messages.push({ role: currentRole, text: currentText.join('\n').trim() });
                    }
                    currentRole = 'user';
                    currentText = [line.replace('**User**:', '').trim()];
                } else if (line.startsWith('**AI**:')) {
                    if (currentRole) {
                        messages.push({ role: currentRole, text: currentText.join('\n').trim() });
                    }
                    currentRole = 'ai';
                    currentText = [line.replace('**AI**:', '').trim()];
                } else if (currentRole && line.trim()) {
                    currentText.push(line);
                }
            }
            
            if (currentRole) {
                messages.push({ role: currentRole, text: currentText.join('\n').trim() });
            }
            
            if (messages.length > 0) {
                sessions.push({
                    id: 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    title: title || 'Imported Chat',
                    timestamp: Date.now(),
                    messages: messages
                });
            }
        });
        
        return sessions;
    }

    toggle() {
        if (this.sidebar) this.sidebar.classList.toggle('open');
        if (this.overlay) this.overlay.classList.toggle('visible');
        
        // Auto-focus search if opening
        if (this.sidebar && this.sidebar.classList.contains('open') && this.searchInput) {
            setTimeout(() => this.searchInput.focus(), 100);
        }
    }

    close() {
        if (this.sidebar) this.sidebar.classList.remove('open');
        if (this.overlay) this.overlay.classList.remove('visible');
    }

    _initSearch() {
        if (this.fuse) return;
        
        if (window.Fuse && this.allSessions && this.allSessions.length > 0) {
             this.fuse = new window.Fuse(this.allSessions, {
                keys: [
                    { name: 'title', weight: 0.7 },
                    { name: 'messages.text', weight: 0.3 }
                ],
                threshold: 0.4,
                ignoreLocation: true
            });
        }
    }

    handleSearch(query) {
        if (!this.allSessions) return;

        let displayList = this.allSessions;

        // Lazy Init Fuse
        this._initSearch();

        if (query.trim() && this.fuse) {
            const results = this.fuse.search(query);
            displayList = results.map(r => r.item);
        }

        this._renderDOM(displayList);
    }

    renderList(sessions, currentId, itemCallbacks) {
        if (!this.listEl) return;
        
        // Cache data for searching
        this.allSessions = sessions;
        this.currentSessionId = currentId;
        this.itemCallbacks = itemCallbacks;
        
        // Reset Fuse index as data changed
        this.fuse = null;
        
        // Check if there is an active search query
        const currentQuery = this.searchInput ? this.searchInput.value : '';
        if (currentQuery.trim()) {
            this.handleSearch(currentQuery);
        } else {
            this._renderDOM(this.allSessions);
        }
    }

    _renderDOM(sessions) {
        this.listEl.innerHTML = '';

        if (sessions.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.padding = '16px';
            emptyEl.style.textAlign = 'center';
            emptyEl.style.color = 'var(--text-tertiary)';
            emptyEl.style.fontSize = '13px';
            emptyEl.textContent = t('noConversations');
            this.listEl.appendChild(emptyEl);
            return;
        }

        sessions.forEach(s => {
            const item = document.createElement('div');
            item.className = `history-item ${s.id === this.currentSessionId ? 'active' : ''}`;
            item.onclick = () => {
                this.itemCallbacks.onSwitch(s.id);
                // On mobile or small screens, maybe auto-close sidebar?
                // Keeping current behavior: explicit close required or select closes
                if (window.innerWidth < 600) {
                    this.close();
                }
            };

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title';
            titleSpan.textContent = s.title;

            // Action buttons container
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'history-actions';

            // Export button
            const exportBtn = document.createElement('span');
            exportBtn.className = 'history-export';
            exportBtn.innerHTML = '⬇';
            exportBtn.title = t('exportChat');
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.itemCallbacks.onExport) {
                    this.itemCallbacks.onExport(s.id);
                }
            };

            // Delete button
            const delBtn = document.createElement('span');
            delBtn.className = 'history-delete';
            delBtn.textContent = '✕';
            delBtn.title = t('delete');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if(confirm(t('deleteChatConfirm'))) {
                    this.itemCallbacks.onDelete(s.id);
                }
            };

            actionsDiv.appendChild(exportBtn);
            actionsDiv.appendChild(delBtn);

            item.appendChild(titleSpan);
            item.appendChild(actionsDiv);
            this.listEl.appendChild(item);
        });
    }
}
