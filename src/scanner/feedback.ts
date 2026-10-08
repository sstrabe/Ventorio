// A short sound and buzz for each scan, so packing works without looking at the screen.
let sound: HTMLAudioElement | undefined;

function vibrate(pattern: number | number[]) {
    // Browsers refuse (and complain) before the person has touched the page, e.g. right after a tag opened it.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
}

export function feedback(tone: "success" | "info" | "warning" | "danger") {
    if (tone === "danger") return vibrate([80, 60, 80]);
    vibrate(tone === "warning" ? [40, 40, 40] : 40);
    if (tone === "info") return;
    sound ??= new Audio("/start.mp3");
    sound.currentTime = 0;
    sound.play().catch(() => {});
}
