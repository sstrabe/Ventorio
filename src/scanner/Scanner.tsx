import { Camera, CameraOff, Keyboard, Nfc } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Callout, inputClass } from "../components/ui";
import { useNfcReader } from "./nfc";

const FRAME_INTERVAL_MS = 150;
const REPEAT_IGNORE_MS = 2500;

function cameraError(error: unknown): string {
    const name = (error as DOMException)?.name;
    if (name === "NotAllowedError") return "Camera access was blocked. Allow it in the browser's site settings, then try again.";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "This device has no camera Ventorio can use.";
    if (name === "NotReadableError") return "Another app is using the camera. Close it and try again.";
    return "Couldn't start the camera. Try again.";
}

/** The phone's camera, reading QR codes and barcodes until it's turned off. */
function Camera_({ onValue, onStop }: { onValue: (value: string) => void; onStop: () => void }) {
    const video = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string>();
    const callback = useRef(onValue);
    callback.current = onValue;

    useEffect(() => {
        let stream: MediaStream | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;
        let busy = false;
        const recent = new Map<string, number>();
        const worker = new Worker(new URL("./detect.worker.ts", import.meta.url), { type: "module" });

        worker.onmessage = (event: MessageEvent<string[]>) => {
            busy = false;
            const now = Date.now();
            for (const value of event.data) {
                // The same code stays in view for a while: report it once.
                if (now - (recent.get(value) ?? 0) < REPEAT_IGNORE_MS) {
                    recent.set(value, now);
                    continue;
                }
                recent.set(value, now);
                callback.current(value);
            }
        };

        const tick = async () => {
            if (stopped) return;
            const node = video.current;
            if (node && !busy && node.readyState >= 2 && node.videoWidth > 0) {
                try {
                    busy = true;
                    const frame = await createImageBitmap(node);
                    worker.postMessage(frame, [frame]);
                } catch {
                    busy = false;
                }
            }
            timer = setTimeout(tick, FRAME_INTERVAL_MS);
        };

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
            .then(async (media) => {
                if (stopped) return media.getTracks().forEach((t) => t.stop());
                stream = media;
                const node = video.current!;
                node.srcObject = media;
                await node.play().catch(() => {});
                tick();
            })
            .catch((e) => setError(cameraError(e)));

        return () => {
            stopped = true;
            clearTimeout(timer);
            stream?.getTracks().forEach((t) => t.stop());
            worker.terminate();
        };
    }, []);

    if (error) {
        return (
            <Callout tone="danger" action={<Button size="sm" onClick={onStop}>Close</Button>}>
                {error}
            </Callout>
        );
    }
    return (
        <div className="relative overflow-hidden rounded-md border border-line bg-subtle">
            <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80 shadow-[0_0_0_100vmax_rgb(0_0_0/0.25)]" />
        </div>
    );
}

/**
 * Every way to scan: the camera (QR codes, barcodes), NFC on Android, or
 * typing the code from the label.
 */
export function ScanPanel({ onValue, disabled }: { onValue: (value: string) => void; disabled?: boolean }) {
    const [camera, setCamera] = useState(false);
    const [typing, setTyping] = useState(false);
    const nfc = useNfcReader(onValue);

    function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("code") as HTMLInputElement;
        if (input.value.trim()) onValue(input.value.trim());
        input.value = "";
    }

    return (
        <div className="space-y-3">
            {camera && !disabled && <Camera_ onValue={onValue} onStop={() => setCamera(false)} />}
            <div className="flex flex-wrap gap-2">
                <Button variant={camera ? "secondary" : "primary"} icon={camera ? CameraOff : Camera} onClick={() => setCamera(!camera)} disabled={disabled}>
                    {camera ? "Stop camera" : "Scan with camera"}
                </Button>
                {nfc.state === "off" && (
                    <Button icon={Nfc} onClick={nfc.start} disabled={disabled}>
                        Read NFC tags
                    </Button>
                )}
                {nfc.state === "listening" && (
                    <Button icon={Nfc} onClick={nfc.stop}>
                        Stop NFC
                    </Button>
                )}
                <Button variant="ghost" icon={Keyboard} onClick={() => setTyping(!typing)} disabled={disabled}>
                    Type a code
                </Button>
            </div>
            {nfc.state === "listening" && <p className="text-[13px] text-muted">Hold a tag to the back of the phone.</p>}
            {nfc.error && <Callout tone="warning">{nfc.error}</Callout>}
            {typing && (
                <form onSubmit={submit} className="flex gap-2">
                    <input
                        name="code"
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder="Code or serial, e.g. K7Q2XM"
                        aria-label="Code or serial"
                        className={inputClass}
                    />
                    <Button type="submit">Use code</Button>
                </form>
            )}
        </div>
    );
}
