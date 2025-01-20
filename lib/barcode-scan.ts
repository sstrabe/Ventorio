import { drawBarcodeBoundary } from "./barcode-boundary";
import { BarcodeDetectorPolyfill, DetectedBarcode } from '@undecaf/barcode-detector-polyfill'

const detector = new BarcodeDetectorPolyfill({

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