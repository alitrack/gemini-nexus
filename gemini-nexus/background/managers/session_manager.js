
// background/managers/session_manager.js
import { AuthManager } from './auth_manager.js';
import { getConnectionSettings } from './session/settings_store.js';
import { RequestDispatcher } from './session/request_dispatcher.js';
import { generateMessageId } from '../../lib/utils.js';

export class GeminiSessionManager {
    constructor() {
        this.auth = new AuthManager();
        this.dispatcher = new RequestDispatcher(this.auth);
        this.activeRequest = null;
    }

    async ensureInitialized() {
        await this.auth.ensureInitialized();
    }

    async handleSendPrompt(request, onUpdate) {
        const requestId = generateMessageId();
        
        this.cancelCurrentRequest();
        
        const abortController = new AbortController();
        this.activeRequest = { id: requestId, controller: abortController };
        
        const signal = abortController.signal;

        try {
            const settings = await getConnectionSettings();
            
            let files = [];
            if (request.files && Array.isArray(request.files)) {
                files = request.files;
            } else if (request.image) {
                files = [{
                    base64: request.image, 
                    type: request.imageType,
                    name: request.imageName || "image.png"
                }];
            }

            if (settings.provider === 'web') {
                await this.ensureInitialized();
            }

            return await this.dispatcher.dispatch(request, settings, files, onUpdate, signal);

        } catch (error) {
            if (error.name === 'AbortError') return null;

            console.error("Gemini Error:", error);
            
            let errorMessage = error.message || "Unknown error";
            const isZh = chrome.i18n.getUILanguage().startsWith('zh');

            if(errorMessage.includes("未登录") || errorMessage.includes("Not logged in")) {
                this.auth.forceContextRefresh();
                await chrome.storage.local.remove(['geminiContext']);
                
                const currentIndex = this.auth.getCurrentIndex();
                if (isZh) {
                    errorMessage = `账号 (Index: ${currentIndex}) 未登录或会话已过期。请前往 <a href="https://gemini.google.com/u/${currentIndex}/" target="_blank" style="color: inherit; text-decoration: underline;">gemini.google.com/u/${currentIndex}/</a> 登录。`;
                } else {
                    errorMessage = `Account (Index: ${currentIndex}) not logged in. Please log in at <a href="https://gemini.google.com/u/${currentIndex}/" target="_blank" style="color: inherit; text-decoration: underline;">gemini.google.com/u/${currentIndex}/</a>.`;
                }
            } else if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
                errorMessage = isZh ? "请求过于频繁，请稍后再试 (429)" : "Too many requests, please try again later (429)";
            }
            
            return {
                action: "GEMINI_REPLY",
                text: "Error: " + errorMessage,
                status: "error"
            };
        } finally {
            if (this.activeRequest?.id === requestId) {
                this.activeRequest = null;
            }
        }
    }

    cancelCurrentRequest() {
        if (this.activeRequest) {
            console.log('[GeminiSessionManager] Cancelling request:', this.activeRequest.id);
            this.activeRequest.controller.abort();
            this.activeRequest = null;
            return true;
        }
        return false;
    }

    async setContext(context, model) {
        await this.auth.updateContext(context, model);
    }

    async resetContext() {
        await this.auth.resetContext();
    }
}
