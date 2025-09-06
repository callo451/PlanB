
import type { OcrPayload } from '../types';

async function sha1(str: string): Promise<string> {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateFingerprint(stem: string, options: { id: string; text: string }[]): Promise<{ id: string; ocrHash: string }> {
    const normalizedStem = stem.trim().toLowerCase();
    const sortedOptions = [...options]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(opt => `${opt.id}:${opt.text.trim().toLowerCase()}`)
        .join('|');

    const combinedString = `${normalizedStem}::${sortedOptions}`;
    const id = await sha1(combinedString);
    const ocrHash = await sha1(stem + JSON.stringify(options)); // A simpler hash for raw text changes

    return { id, ocrHash };
}
