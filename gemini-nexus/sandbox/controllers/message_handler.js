
// sandbox/controllers/message_handler.js
import { appendMessage } from '../render/message.js';
import { cropImage } from '../../lib/crop_utils.js';
import { t } from '../core/i18n.js';
import { WatermarkRemover } from '../../lib/watermark_remover.js';

export class MessageHandler {
    constructor(sessionManager, uiController, imageManager, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        this.app = appController; // Reference back to app for state like captureMode
        this.streamingBubble = null;
    }

    async handle(request) {
        // MCP server test result
        if (request.action === "MCP_TEST_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpTestResult === 'function') {
                this.ui.settings.updateMcpTestResult(request);
            }
            return;
        }

        if (request.action === "MCP_TOOLS_RESULT") {
            if (this.ui && this.ui.settings && typeof this.ui.settings.updateMcpToolsResult === 'function') {
                this.ui.settings.updateMcpToolsResult(request);
            }
            return;
        }

        // 0. Stream Update
        if (request.action === "GEMINI_STREAM_UPDATE") {
            this.handleStreamUpdate(request);
            return;
        }

        // 1. AI Reply
        if (request.action === "GEMINI_REPLY") {
            this.handleGeminiReply(request);
            return;
        }

        // 2. Image Fetch Result (For User Uploads)
        if (request.action === "FETCH_IMAGE_RESULT") {
            this.handleImageResult(request);
            return;
        }

        // 2.1 Generated Image Result (Proxy Fetch for Display)
        if (request.action === "GENERATED_IMAGE_RESULT") {
            await this.handleGeneratedImageResult(request);
            return;
        }

        // 3. Capture Result (Crop & OCR)
        if (request.action === "CROP_SCREENSHOT") {
            await this.handleCropResult(request);
            return;
        }

        // 4. Mode Sync (from Context Menu)
        if (request.action === "SET_SIDEBAR_CAPTURE_MODE") {
            this.app.setCaptureMode(request.mode);
            let statusText = t('selectSnip');
            if (request.mode === 'ocr') statusText = t('selectOcr');
            if (request.mode === 'screenshot_translate') statusText = t('selectTranslate');
            
            this.ui.updateStatus(statusText);
            return;
        }

        // 5. Quote Selection Result
        if (request.action === "SELECTION_RESULT") {
            this.handleSelectionResult(request);
            return;
        }

        // 6. Page Context Toggle (from Context Menu)
        if (request.action === "TOGGLE_PAGE_CONTEXT") {
            this.app.setPageContext(request.enable);
            return;
        }
    }

    handleStreamUpdate(request) {
        if (this.app.prompt.isCancellationRecent()) return;

        if (!this.streamingBubble) {
            const session = this.sessionManager.getCurrentSession();
            let messageIndex = null;
            let messageId = request.messageId;

            if (this.app.prompt.isRegenerating && this.app.prompt.regenerateIndex !== null) {
                messageIndex = this.app.prompt.regenerateIndex;
            } else if (session) {
                const effectiveCount = this.app.prompt.getEffectiveMessageCount();
                messageIndex = effectiveCount;

                if (this.streamingBubble && this.streamingBubble.messageIndex === messageIndex) {
                    console.warn('[handleStreamUpdate] Duplicate index detected! Adjusting...');
                    messageIndex = effectiveCount + 1;
                }
            }

            if (messageId) {
                this.app.prompt.trackPendingMessage(messageId);
            }

            console.log('[handleStreamUpdate] Creating streaming bubble with index:', messageIndex, 'ID:', messageId);
            this.streamingBubble = appendMessage(this.ui.historyDiv, "", 'ai', null, "", messageIndex, messageId);
            this.streamingBubble.messageIndex = messageIndex;
            this.streamingBubble.messageId = messageId;
        }

        this.streamingBubble.update(request.text, request.thoughts);

        if (!this.app.isGenerating) {
            this.app.isGenerating = true;
            this.ui.setLoading(true);
        }
    }

    handleGeminiReply(request) {
        this.app.isGenerating = false;
        this.ui.setLoading(false);

        const messageId = request.messageId;

        if (messageId) {
            this.app.prompt.untrackPendingMessage(messageId);
        }

        console.log('[handleGeminiReply] isRegenerating:', this.app.prompt.isRegenerating, 'messageId:', messageId);

        const session = this.sessionManager.getCurrentSession();
        if (session) {
            if (request.status === 'success') {
                this.sessionManager.updateContext(session.id, request.context);
            }

            if (this.streamingBubble) {
                this.streamingBubble.update(request.text, request.thoughts);

                if (request.images && request.images.length > 0) {
                    this.streamingBubble.addImages(request.images);
                }

                this.streamingBubble = null;
            } else {
                if (this.app.prompt.isRegenerating) {
                    const regenerateIndex = this.app.prompt.regenerateIndex;

                    session.messages.splice(regenerateIndex, 0, {
                        role: 'ai',
                        text: request.text,
                        thoughts: request.thoughts,
                        generatedImages: request.images,
                        id: messageId
                    });

                    this.ui.clearChatHistory();
                    session.messages.forEach((msg, index) => {
                        let attachment = null;
                        if (msg.role === 'user') attachment = msg.image;
                        if (msg.role === 'ai') attachment = msg.generatedImages;
                        appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index, msg.id);
                    });

                    this.app.prompt.isRegenerating = false;
                    this.app.prompt.regenerateIndex = null;
                    this.app.prompt.regenerateUserMessageIndex = null;
                } else if (this.app.prompt.skipUserMessageForHandler) {
                    this.ui.clearChatHistory();
                    session.messages.forEach((msg, index) => {
                        let attachment = null;
                        if (msg.role === 'user') attachment = msg.image;
                        if (msg.role === 'ai') attachment = msg.generatedImages;
                        appendMessage(this.ui.historyDiv, msg.text, msg.role, attachment, msg.thoughts, index, msg.id);
                    });
                    this.app.prompt.skipUserMessageForHandler = false;
                } else {
                    const messageIndex = session.messages.length - 1;
                    console.log('[handleGeminiReply] Normal flow - index:', messageIndex, 'ID:', messageId);
                    appendMessage(this.ui.historyDiv, request.text, 'ai', request.images, request.thoughts, messageIndex, messageId);
                }
            }
        }
    }

    handleImageResult(request) {
        this.ui.updateStatus("");
        if (request.error) {
            console.error("Image fetch failed", request.error);
            this.ui.updateStatus(t('failedLoadImage'));
            setTimeout(() => this.ui.updateStatus(""), 3000);
        } else {
            this.imageManager.setFile(request.base64, request.type, request.name);
        }
    }

    async handleGeneratedImageResult(request) {
        // Find the placeholder image by ID
        const img = document.querySelector(`img[data-req-id="${request.reqId}"]`);
        if (img) {
            if (request.base64) {
                try {
                    // Apply Watermark Removal
                    const cleanedBase64 = await WatermarkRemover.process(request.base64);
                    img.src = cleanedBase64;
                } catch (e) {
                    console.warn("Watermark removal failed, using original", e);
                    img.src = request.base64;
                }
                
                img.classList.remove('loading');
                img.style.minHeight = "auto"; 
            } else {
                // Handle error visually
                img.style.background = "#ffebee"; // Light red
                img.alt = "Failed to load image";
                console.warn("Generated image load failed:", request.error);
            }
        }
    }

    async handleCropResult(request) {
        this.ui.updateStatus(t('processingImage'));
        try {
            const croppedBase64 = await cropImage(request.image, request.area);
            this.imageManager.setFile(croppedBase64, 'image/png', 'snip.png');
            
            if (this.app.captureMode === 'ocr') {
                // Change prompt to localized OCR instructions
                this.ui.inputFn.value = t('ocrPrompt');
                // Auto-send via the main controller
                this.app.handleSendMessage(); 
            } else if (this.app.captureMode === 'screenshot_translate') {
                // Change prompt to localized Translate instructions
                this.ui.inputFn.value = t('screenshotTranslatePrompt');
                this.app.handleSendMessage();
            } else {
                this.ui.updateStatus("");
                this.ui.inputFn.focus();
            }
        } catch (e) {
            console.error("Crop error", e);
            this.ui.updateStatus(t('errorScreenshot'));
        }
    }
    
    handleSelectionResult(request) {
        if (request.text && request.text.trim()) {
             const quote = `> ${request.text.trim()}\n\n`;
             const input = this.ui.inputFn;
             // Append to new line if text exists
             input.value = input.value ? input.value + "\n\n" + quote : quote;
             input.focus();
             // Trigger resize
             input.dispatchEvent(new Event('input'));
        } else {
             this.ui.updateStatus(t('noTextSelected'));
             setTimeout(() => this.ui.updateStatus(""), 2000);
        }
    }

    // Called by AppController on cancel/switch
    resetStream() {
        if (this.streamingBubble) {
             this.streamingBubble = null;
        }
    }
}
