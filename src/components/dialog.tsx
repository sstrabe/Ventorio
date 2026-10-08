import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, cx, type ButtonVariant } from "./ui";

/**
 * A native <dialog> holding one form: fields, an error callout when the last
 * submit failed, and Cancel + submit in the footer. `onSubmit` gets the form's
 * data; when it resolves the dialog closes, when it throws the message shows.
 * The body remounts on every opening, so a reopened dialog starts clean.
 */
export function Dialog({
    open,
    onClose,
    title,
    description,
    sheet,
    submitLabel,
    submitVariant = "primary",
    submitDisabled,
    onSubmit,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: ReactNode;
    sheet?: boolean;
    submitLabel: string;
    submitVariant?: ButtonVariant;
    submitDisabled?: boolean;
    onSubmit: (data: FormData) => Promise<unknown>;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const [error, setError] = useState<string>();
    const [pending, setPending] = useState(false);
    const [openings, setOpenings] = useState(0);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            setError(undefined);
            setOpenings((n) => n + 1);
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setPending(true);
        setError(undefined);
        try {
            await onSubmit(new FormData(e.currentTarget));
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPending(false);
        }
    }

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            onClick={(e) => {
                if (e.target === ref.current) onClose();
            }}
            className={cx(
                "bg-surface text-fg shadow-xl backdrop:bg-overlay",
                sheet ? "m-0 ml-auto h-dvh max-h-dvh w-full max-w-lg border-l border-line" : "m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line"
            )}
        >
            {open && (
                <div key={openings} className={cx("flex flex-col", sheet && "h-full")}>
                    <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4">
                        <div>
                            <h2 className="text-[16px] font-semibold">{title}</h2>
                            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
                        </div>
                        <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted hover:bg-subtle hover:text-fg">
                            <X className="size-4" />
                        </button>
                    </div>
                    <form onSubmit={submit} className={cx("flex flex-col", sheet && "min-h-0 flex-1")}>
                        <div className={cx("space-y-4 px-5 py-5", sheet && "flex-1 overflow-y-auto")}>
                            {error && <Callout tone="danger">{error}</Callout>}
                            {children}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-line-subtle bg-subtle px-5 py-3">
                            <Button onClick={onClose}>Cancel</Button>
                            <Button type="submit" variant={submitVariant} pending={pending} disabled={submitDisabled}>
                                {submitLabel}
                            </Button>
                        </div>
                    </form>
                </div>
            )}
        </dialog>
    );
}

/** Read a trimmed text field; empty becomes null. */
export function text(data: FormData, name: string): string | null {
    const value = String(data.get(name) ?? "").trim();
    return value === "" ? null : value;
}

export function int(data: FormData, name: string): number | null {
    const value = text(data, name);
    return value === null ? null : Number.parseInt(value, 10);
}
