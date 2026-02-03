
// services/providers/openai_compatible.js

/**
 * Sends a message using an OpenAI Compatible API.
 */
export async function sendOpenAIMessage(prompt, systemInstruction, history, config, files, signal, onUpdate) {
    let { baseUrl, apiKey, model } = config;

    if (!baseUrl) throw new Error("Base URL is missing.");
    if (!model) throw new Error("Model ID is missing.");
    
    // Normalize Base URL (remove trailing slash)
    baseUrl = baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/chat/completions`;

    // 1. Build Messages Array
    const messages = [];

    // System Message
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }

    // Helper to format content (Text + Image)
    const formatContent = (text, images) => {
        if (!images || images.length === 0) {
            return text || "";
        }
        
        const content = [];
        if (text) {
            content.push({ type: "text", text: text });
        }
        
        images.forEach(img => {
            // img is base64 string "data:image/png;base64,..."
            // OpenAI expects "image_url": { "url": "data:image/jpeg;base64,..." }
            content.push({
                type: "image_url",
                image_url: {
                    url: img
                }
            });
        });
        
        return content;
    };

    // History
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            const role = msg.role === 'ai' ? 'assistant' : 'user';
            
            // Map image attachment from history
            // Gemini history stores images as array of base64 strings in msg.image
            // Only user messages usually have images
            const images = (msg.role === 'user' && msg.image) ? msg.image : [];
            
            messages.push({
                role: role,
                content: formatContent(msg.text, images)
            });
        });
    }

    // Current Prompt
    const currentImages = [];
    if (files && files.length > 0) {
        files.forEach(f => {
             // Assuming f.base64 is a complete data URI
             currentImages.push(f.base64);
        });
    }
    
    messages.push({
        role: "user",
        content: formatContent(prompt, currentImages)
    });

    const payload = {
        model: model,
        messages: messages,
        stream: true
    };

    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    console.debug(`[OpenAI Compatible] Requesting ${model} at ${url}...`);

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal
    });

    if (!response.ok) {
        let errorText = await response.text();
        try {
            const errJson = JSON.parse(errorText);
            if (errJson.error && errJson.error.message) errorText = errJson.error.message;
        } catch (e) {
            // JSON parse failed, use raw error text from response
        }
        throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    
    let buffer = "";
    let fullText = "";
    let fullThoughts = ""; // Not standard in OpenAI, but some models (DeepSeek R1) might output <think> tags in content

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        let lines = buffer.split('\n');
        buffer = lines.pop(); 
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.substring(6);
                if (dataStr === '[DONE]') continue;
                
                try {
                    const data = JSON.parse(dataStr);
                    if (data.choices && data.choices.length > 0) {
                        const delta = data.choices[0].delta;
                        
                        // Standard Content
                        if (delta.content) {
                            fullText += delta.content;
                            onUpdate(fullText, fullThoughts);
                        }
                        
                        // Reasoning Content (DeepSeek R1 style or similar extension)
                        // If the API returns reasoning_content, use it as thoughts
                        if (delta.reasoning_content) {
                            fullThoughts += delta.reasoning_content;
                            onUpdate(fullText, fullThoughts);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null, 
        images: [], 
        context: null 
    };
}
