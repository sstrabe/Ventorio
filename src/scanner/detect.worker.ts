/// <reference lib="webworker" />
// Decodes camera frames off the main thread. Uses the browser's own
// BarcodeDetector where it reads QR codes (Chrome on Android), otherwise
// ZXing compiled to WebAssembly (iPhone, desktop), served from this app.
import { BarcodeDetector as ZXingDetector, prepareZXingModule, type BarcodeFormat } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
});

const FORMATS: BarcodeFormat[] = ["qr_code", "code_128", "code_39", "data_matrix"];

interface Detector {
    detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

let detector: Promise<Detector> | undefined;

async function createDetector(): Promise<Detector> {
    const Native = (self as unknown as { BarcodeDetector?: typeof ZXingDetector }).BarcodeDetector;
    if (Native) {
        try {
            const supported = await Native.getSupportedFormats();
            if (supported.includes("qr_code")) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
        } catch {
            // fall back to ZXing
        }
    }
    return new ZXingDetector({ formats: FORMATS });
}

self.onmessage = async (event: MessageEvent<ImageBitmap>) => {
    const frame = event.data;
    try {
        detector ??= createDetector();
        const found = await (await detector).detect(frame);
        self.postMessage(found.map((code) => code.rawValue));
    } catch {
        self.postMessage([]);
    } finally {
        frame.close();
    }
};
