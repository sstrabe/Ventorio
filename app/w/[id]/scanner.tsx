import { memo } from "react"
import { useScanner } from "./useScanner"

export const Scanner = memo(function Scanner({ onScan }: { onScan: (e: DetectedBarcode[]) => void }) {
    const initScanner: (instance: HTMLVideoElement | null) => void = useScanner({
        video: {
            maxWidth: 300
        },
        onScan
    })

    return (
        <video ref={initScanner} className="w-auto h-auto min-w-full min-h-full"></video>
    )
})