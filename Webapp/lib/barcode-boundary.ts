import { BarcodeScanParams } from "./barcode-scan";
import { DetectedBarcode } from "barcode-detector/pure";

export const drawBarcodeBoundary = ({
  canvasMaskNode,
  canvasScanImageData,
  scanResult,
}: Pick<BarcodeScanParams, "canvasMaskNode" | "canvasScanImageData"> & {
  scanResult: DetectedBarcode[] | null;
}) => {
  // Get the canvasMask element and its dimensions
  const canvasMaskWidth = canvasMaskNode.width;
  const canvasMaskHeight = canvasMaskNode.height;

  // Get the scanned element and its dimensions
  const scannedImageWidth = canvasScanImageData.width;
  const scannedImageHeight = canvasScanImageData.height;

  // Calculate the scaling factor between the video and canvas
  const scaleX = canvasMaskWidth / scannedImageWidth;
  const scaleY = canvasMaskHeight / scannedImageHeight;

  // Get the canvas context
  const ctx = canvasMaskNode.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasMaskWidth, canvasMaskHeight);

  // Do nothing if there is no scan result
  if (!scanResult) return;

  scanResult.forEach((scan) => {
    const resultPoints = scan.cornerPoints
    const scaledPoints = resultPoints.map((point) => {
      return {
        x: point.x * scaleX,
        y: point.y * scaleY,
      };
    });

    ctx.clearRect(0, 0, canvasMaskWidth, canvasMaskHeight);
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    for (let i = 1; i < scaledPoints.length; i++) {
      ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  })
};