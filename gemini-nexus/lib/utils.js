// lib/utils.js

// Extract authentication token from HTML
export function extractFromHTML(variableName, html) {
    const regex = new RegExp(`"${variableName}":"([^"]+)"`);
    const match = regex.exec(html);
    return match?.[1];
}

// Generate a random UUID
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    }).toUpperCase();
}

// Generate a short unique message ID (shorter than UUID for message tracking)
export function generateMessageId() {
    return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// Convert Data URL to Blob (Safe implementation without fetch)
export async function dataUrlToBlob(dataUrl) {
    try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        throw new Error("Failed to convert data URL to Blob: " + e.message);
    }
}

// Upgrade Google Image URL to High Res (Original Quality)
export function getHighResImageUrl(url) {
    if (!url) return null;
    
    // Robustly replace or append size parameter
    const parts = url.split('?');
    let base = parts[0];
    const query = parts.slice(1).join('?');

    // Remove any existing sizing parameters from the path (e.g., =w500-h500, =s1024)
    // The regex matches typical Google User Content URL parameter patterns at the end of the path
    base = base.replace(/=[a-zA-Z0-9_-]+$/, '');

    // Append high-res parameter (=s0 for original size)
    base += "=s0";

    return base + (query ? '?' + query : '');
}