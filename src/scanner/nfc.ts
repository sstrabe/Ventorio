import { useCallback, useEffect, useRef, useState } from "react";

// Web NFC: Chrome on Android only. iPhones read Ventorio tags without it: the
// tag holds a URL, and opening that URL records the tap (see /t/:code).

interface NDEFRecordInit {
    recordType: "url" | "text";
    data: string;
}

interface NDEFRecord {
    recordType: string;
    encoding?: string;
    data?: DataView;
}

interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: { records: NDEFRecord[] };
}

interface NDEFReader extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    write(message: { records: NDEFRecordInit[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
    makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
}

declare global {
    interface Window {
        NDEFReader?: { new (): NDEFReader };
    }
}

export const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

function recordText(record: NDEFRecord): string | null {
    if (!record.data) return null;
    if (record.recordType === "url" || record.recordType === "absolute-url") return new TextDecoder().decode(record.data);
    if (record.recordType === "text") return new TextDecoder(record.encoding ?? "utf-8").decode(record.data);
    return null;
}

function nfcError(error: unknown): string {
    const name = (error as DOMException)?.name;
    if (name === "NotAllowedError") return "NFC access was blocked. Allow it in the browser's site settings.";
    if (name === "NotSupportedError") return "NFC is turned off or this phone has none. Turn it on in the phone's settings.";
    if (name === "AbortError") return "";
    return "Couldn't use NFC. Try again.";
}

export type NfcState = "unsupported" | "off" | "listening";

/** Listen for tags while the page is open. Starting needs a tap the first time (the permission prompt). */
export function useNfcReader(onValue: (value: string) => void) {
    const [state, setState] = useState<NfcState>(nfcSupported ? "off" : "unsupported");
    const [error, setError] = useState<string>();
    const controller = useRef<AbortController | null>(null);
    const callback = useRef(onValue);
    callback.current = onValue;

    const stop = useCallback(() => {
        controller.current?.abort();
        controller.current = null;
        if (nfcSupported) setState("off");
    }, []);

    const start = useCallback(async () => {
        if (!window.NDEFReader) return;
        controller.current?.abort();
        const abort = new AbortController();
        controller.current = abort;
        const reader = new window.NDEFReader();
        reader.onreading = (event) => {
            for (const record of event.message.records) {
                const value = recordText(record);
                if (value) return callback.current(value);
            }
            setError("This tag has no Ventorio label on it. Write one under Labels.");
        };
        reader.onreadingerror = () => setError("Couldn't read that tag. Hold it still against the back of the phone.");
        try {
            await reader.scan({ signal: abort.signal });
            setError(undefined);
            setState("listening");
        } catch (e) {
            setError(nfcError(e) || undefined);
            setState("off");
        }
    }, []);

    // Start right away when permission was granted before.
    useEffect(() => {
        if (!nfcSupported) return;
        navigator.permissions
            ?.query({ name: "nfc" as PermissionName })
            .then((status) => {
                if (status.state === "granted") start();
            })
            .catch(() => {});
        return () => controller.current?.abort();
    }, [start]);

    return { state, error, start, stop };
}

/**
 * Write a URL onto the next tag held to the phone. Locking (permanent) takes
 * a second tap: `onWritten` runs between the two.
 */
export async function writeTag(url: string, lock: boolean, signal: AbortSignal, onWritten?: () => void): Promise<void> {
    if (!window.NDEFReader) throw new Error("This browser can't write NFC tags. Use Chrome on Android.");
    const writer = new window.NDEFReader();
    try {
        await writer.write({ records: [{ recordType: "url", data: url }] }, { signal, overwrite: true });
        if (lock) {
            onWritten?.();
            await writer.makeReadOnly({ signal });
        }
    } catch (e) {
        const message = nfcError(e);
        if (!message) throw e;
        throw new Error((e as DOMException).name === "NotAllowedError" && lock ? "This tag is locked or can't be written." : message);
    }
}
