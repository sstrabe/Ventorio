import "../lib/barcode-scan";
import { BarcodeScanParams, scanBarcode } from "../lib/barcode-scan";

// Nuance: https://github.com/mdn/dom-examples/blob/main/web-workers/offscreen-canvas-worker/worker.js
let canvas: OffscreenCanvas;

self.onmessage = async (params: { data: BarcodeScanParams }) => {
  if (params.data.canvasMaskNode) {
    canvas = params.data.canvasMaskNode;
  }

  const result = await scanBarcode({
    ...params.data,
    canvasMaskNode: canvas,
  });

  if (!result) return;
  self.postMessage(result);
};