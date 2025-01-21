import { useCallback, useEffect, useRef } from "react";

const inPixels = (value: string | number) => `${value}px`;

const setVideoStream = async (videoNode: HTMLVideoElement) => {
    if (!("srcObject" in videoNode)) {
        return alert(
            "Your browser does not support the scanner. Please download the latest version of Chrome, Firefox, or Safari."
        );
    }
    const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment",
            aspectRatio: window.devicePixelRatio || 1,
            frameRate: 30,
            width: {
                ideal: 4096,
            },
            height: {
                ideal: 2160,
            },
        },
    });
    videoNode.srcObject = videoStream;
};

type UseScannerParams = {
    video: {
        maxWidth: number;
    };
    onScan: (result: DetectedBarcode[]) => void;
};

const barcodeScannerWorker = new Worker(
    new URL("../../../workers/barcode-scan.ts", import.meta.url),
    {
        type: "module",
    }
);

export const useScanner = ({ video, onScan }: UseScannerParams) => {
    const canvasScanRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
    const canvasMaskRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
    const isFirstVideoTick = useRef(true);

    useEffect(() => {
        barcodeScannerWorker.addEventListener("message", (event) => {
            onScan(event.data);
        });
    }, [onScan]);

    const initScanner = useCallback<(instance: HTMLVideoElement | null) => Promise<void>>(
        async (videoNode) => {
            if (!videoNode) return;

            // Start the video stream
            await setVideoStream(videoNode);

            const canvasScanNode = canvasScanRef.current;
            const canvasMaskNode = canvasMaskRef.current;

            // Set the video properties
            videoNode.style.maxWidth = inPixels(video.maxWidth);
            videoNode.autoplay = true;

            // 3. Set some attributes of our elements once the video has initialized
            videoNode.addEventListener("loadedmetadata", () => {
                // Set the scanner to the _real_ height & width of the video
                canvasScanNode.width = videoNode.videoWidth;
                canvasScanNode.height = videoNode.videoHeight;

                // Set the masking attributes and add it to the DOM
                canvasMaskNode.style.height = inPixels(videoNode.clientHeight);
                canvasMaskNode.style.width = inPixels(videoNode.clientWidth);
                canvasMaskNode.style.position = "absolute";
                canvasMaskNode.style.top = inPixels(videoNode.offsetTop);
                canvasMaskNode.style.left = inPixels(videoNode.offsetLeft);
                canvasMaskNode.classList.add("scanner");
                videoNode.parentElement?.appendChild(canvasMaskNode);
            });

            // Get the contexts
            const canvasScanContext = canvasScanRef.current.getContext("2d", {
                willReadFrequently: true,
            });

            // short circuit if the canvasScanContext doesn't exist.
            if (!canvasScanContext) {
                throw new Error("Cannot get the necessary context to decode the scan.");
            }

            let offscreenCanvas: OffscreenCanvas | null
            try {
                offscreenCanvas = canvasMaskNode.transferControlToOffscreen();
            } catch(err) {
                console.log(err)
            }

            // When the next tick of the video occurs
            videoNode.addEventListener("timeupdate", () => {
                if (!canvasScanContext) return;

                canvasScanContext.drawImage(videoNode, 0, 0);
                const canvasScanImageData = canvasScanContext.getImageData(
                    0,
                    0,
                    canvasScanNode.width,
                    canvasScanNode.height
                );

                if (isFirstVideoTick.current && offscreenCanvas) {
                    barcodeScannerWorker.postMessage(
                        {
                            canvasMaskNode: offscreenCanvas,
                            canvasScanImageData,
                        },
                        // transferable object
                        [offscreenCanvas]
                    );

                    isFirstVideoTick.current = false;
                } else {
                    // serializable structured clone
                    barcodeScannerWorker.postMessage({ canvasScanImageData: structuredClone(canvasScanImageData) });
                }
            });
        },
        [video.maxWidth]
    );

    return initScanner;
}