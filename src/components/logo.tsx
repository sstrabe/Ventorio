import { useId } from "react";

/** Ventorio's mark: the first logo's two interlocking halves of a hexagon, on the family tile. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
    const id = useId();
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fa8cd7" />
                    <stop offset="1" stopColor="#a24287" />
                </linearGradient>
            </defs>
            <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
            <g transform="translate(14.68 12) scale(0.4)" fill="#ffffff" fillRule="evenodd">
                <path d="M0 25l43.3 25V25l21.65-12.5L86.6 25v25L64.95 37.5v-25L43.3 0 0 25z" />
                <path d="M86.6 75L43.3 50v25L21.65 87.5 0 75V50l21.65 12.5v25L43.3 100l43.3-25z" />
            </g>
        </svg>
    );
}
