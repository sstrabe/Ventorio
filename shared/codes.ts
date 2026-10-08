// Label codes: 6 characters of Crockford base32 (no I, L, O or U), about a
// billion possibilities. A label carries https://<host>/t/<code>.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{6}$/;

export function newCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}

/** Path a label points at; opening it records the scan in the person's open session. */
export function tagPath(code: string): string {
    return `/t/${code}`;
}

/** Normalise what a person types: case-insensitive, and the look-alikes Crockford folds. */
export function normaliseCode(value: string): string {
    return value.trim().toUpperCase().replace(/[IL]/g, "1").replace(/O/g, "0");
}

/** A scanned value resolves to an item by its code first, then by its serial. */
export interface ScanTarget {
    code?: string;
    serial?: string;
}

/**
 * What a scanned QR code, barcode or NFC record refers to. Accepts a Ventorio
 * URL from any host (/t/<code> or /items/<code>), the JSON labels of the first
 * version ({"type", "serial"}), a bare code, or a manufacturer serial.
 */
export function parseScan(raw: string): ScanTarget | null {
    const value = raw.trim();
    if (!value) return null;

    if (/^https?:\/\//i.test(value)) {
        try {
            const match = new URL(value).pathname.match(/^\/(?:t|items)\/([0-9A-Za-z]+)\/?$/);
            if (match) return { code: normaliseCode(match[1]) };
        } catch {
            // not a URL after all
        }
        return null;
    }

    if (value.startsWith("{")) {
        try {
            const data = JSON.parse(value) as { serial?: unknown };
            if (typeof data.serial === "string" && data.serial) return { serial: data.serial };
        } catch {
            // not JSON: treat it as a serial below
        }
    }

    const code = normaliseCode(value);
    return CODE_PATTERN.test(code) ? { code, serial: value } : { serial: value };
}
