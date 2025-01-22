import { ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Modal({ children, visible }: { children: ReactNode, visible?: boolean }) {
    if (!visible) return;

    return createPortal((
        <div className="fixed inset-0 flex flex-col justify-center items-center bg-background bg-opacity-50 z-[200]">
            {children}
        </div>
    ), document.body)
}