import { drawBarcodeBoundary } from "./barcode-boundary";
import { BarcodeDetector, DetectedBarcode } from "barcode-detector/pure";

const detector = new BarcodeDetector({
  formats: ["code_39", "qr_code", "code_128"]
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
  console.log(scanResult)

  console.log(scanResult.map((sc) => sc.rawValue))

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