import { drawBarcodeBoundary } from "./barcode-boundary";
import { BarcodeDetector, DetectedBarcode } from "barcode-detector/pure";

const detector = new BarcodeDetector({
  formats: ["code_39", "qr_code", "code_128", "rm_qr_code"]
})

export type BarcodeScanParams = {
  canvasMaskNode: OffscreenCanvas;
  canvasScanImageData: ImageData;
};

export const scanBarcode = async ({
  canvasMaskNode,
  canvasScanImageData,
}: BarcodeScanParams): Promise<undefined | DetectedBarcode[]> => {
  const scanResult = await detector.detect(canvasScanImageData)

  drawBarcodeBoundary({
    canvasMaskNode,
    canvasScanImageData,
    scanResult,
  });

  if (!scanResult) {
    return undefined;
  }

  return scanResult;
};