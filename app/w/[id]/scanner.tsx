import { memo } from "react"
import { useScanner } from "./useScanner"

export const Scanner = memo(function Scanner({ onScan }: { onScan: (e: string) => void }) {
    const initScanner = useScanner({
        video: {
            maxWidth: 300
        },
        onScan
    })

    return (
        <video ref={initScanner}></video>
    )
})