import { ChevronRight, CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

export function cx(...classes: (string | false | null | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md") {
    return cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-8 px-3 text-sm",
        variant === "primary" && "bg-primary text-on-primary shadow-card hover:bg-primary-hover",
        variant === "secondary" && "border border-line bg-surface text-fg hover:bg-subtle",
        variant === "ghost" && "text-muted hover:bg-subtle hover:text-fg",
        variant === "danger" && "bg-danger text-on-danger hover:bg-danger-hover",
        variant === "danger-outline" && "border border-line bg-surface text-danger hover:border-danger hover:bg-danger-soft"
    );
}

export function Button({
    variant = "secondary",
    size = "md",
    pending = false,
    icon: Icon,
    className,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
    pending?: boolean;
    icon?: ComponentType<{ className?: string }>;
}) {
    const iconClass = size === "sm" ? "size-3.5" : "size-4";
    return (
        <button type="button" {...props} disabled={props.disabled || pending} className={cx(buttonClass(variant, size), className)}>
            {pending ? <LoaderCircle className={cx(iconClass, "animate-spin")} /> : Icon && <Icon className={iconClass} />}
            {children}
        </button>
    );
}

/** Inputs without a width, for compact controls that set their own (w-20, w-auto). */
export const inputBase =
    "h-8 rounded-md border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-faint focus:border-primary focus:outline-none";
export const inputClass = `${inputBase} w-full`;
export const textareaClass =
    "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-faint focus:border-primary focus:outline-none";

export function Field({
    label,
    htmlFor,
    optional,
    hint,
    children,
}: {
    label: string;
    htmlFor?: string;
    optional?: boolean;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={htmlFor} className="block text-[13px] font-medium">
                {label}
                {optional && <span className="ml-1 font-normal text-faint">(optional)</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
    );
}

export function Checkbox({
    name,
    label,
    description,
    defaultChecked,
    checked,
    onChange,
}: {
    name?: string;
    label: string;
    description?: string;
    defaultChecked?: boolean;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5">
            <input
                type="checkbox"
                name={name}
                defaultChecked={defaultChecked}
                checked={checked}
                onChange={onChange && ((e) => onChange(e.target.checked))}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
                <span className="block text-sm font-medium">{label}</span>
                {description && <span className="block text-xs text-muted">{description}</span>}
            </span>
        </label>
    );
}

export function PageHeader({
    title,
    description,
    crumbs,
    badges,
    actions,
}: {
    title: ReactNode;
    description?: ReactNode;
    crumbs?: { label: string; to?: string }[];
    badges?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="mb-6">
            {crumbs && (
                <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[13px]">
                    {crumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="size-3.5 text-faint" />}
                            {crumb.to ? (
                                <Link to={crumb.to} className="text-link hover:underline">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-muted">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-semibold tracking-tight">
                        {title}
                        {badges}
                    </h1>
                    {description && <div className="mt-1 max-w-3xl text-[14px] text-muted">{description}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: "danger" }) {
    return (
        <section className={cx("rounded-lg border bg-surface shadow-card", tone === "danger" ? "border-danger/40" : "border-line", className)}>
            {children}
        </section>
    );
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <div className="min-w-0">
                <h2 className="text-[15px] font-semibold">{title}</h2>
                {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-line-subtle bg-subtle px-5 py-3">{children}</div>
    );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
    neutral: "border border-line bg-subtle text-muted",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
    return (
        <span
            title={title}
            className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone])}
        >
            {dot && <span className="size-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}

const calloutIcon = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleX } as const;
const calloutBg = { info: "bg-info-soft", success: "bg-success-soft", warning: "bg-warning-soft", danger: "bg-danger-soft" } as const;
const calloutFg = { info: "text-info", success: "text-success", warning: "text-warning", danger: "text-danger" } as const;

export function Callout({
    tone = "info",
    title,
    children,
    action,
}: {
    tone?: "info" | "success" | "warning" | "danger";
    title?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
}) {
    const Icon = calloutIcon[tone];
    return (
        <div className={cx("flex gap-3 rounded-md px-3.5 py-3 text-[13px]", calloutBg[tone])} role={tone === "danger" ? "alert" : undefined}>
            <Icon className={cx("mt-px size-4 shrink-0", calloutFg[tone])} />
            <div className="min-w-0 flex-1 space-y-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className="text-fg/90">{children}</div>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}

export function EmptyState({
    icon: Icon,
    title,
    children,
    action,
}: {
    icon: ComponentType<{ className?: string }>;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 text-faint">
                <Icon className="size-8" />
            </div>
            <p className="font-semibold">{title}</p>
            {children && <p className="mt-1 max-w-md text-[13px] text-muted">{children}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

export function Stat({
    label,
    value,
    icon: Icon,
    note,
    to,
}: {
    label: string;
    value: ReactNode;
    icon: ComponentType<{ className?: string }>;
    note?: ReactNode;
    to?: string;
}) {
    const body = (
        <>
            <div className="flex items-center justify-between text-[13px] text-muted">
                {label}
                <span className="text-faint">
                    <Icon className="size-4" />
                </span>
            </div>
            <div className="mt-2 text-[26px] leading-none font-semibold tracking-tight">{value}</div>
            {note && <div className="mt-2 text-xs text-muted">{note}</div>}
        </>
    );
    const className = "block rounded-lg border border-line bg-surface p-4 shadow-card";
    return to ? (
        <Link to={to} className={cx(className, "transition-colors hover:border-primary/60")}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

/** Tabs kept in the URL (?tab= or another key), so they survive reloads and links. */
export function Tabs({ tabs, param = "tab", fallback }: { tabs: { id: string; label: string; count?: number }[]; param?: string; fallback: string }) {
    const [params] = useSearchParams();
    const current = params.get(param) ?? fallback;
    return (
        <nav
            aria-label="Sections"
            className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {tabs.map((tab) => {
                const active = tab.id === current;
                const next = new URLSearchParams(params);
                next.set(param, tab.id);
                return (
                    <Link
                        key={tab.id}
                        to={`?${next}`}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                            "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                            active ? "border-primary font-medium text-fg" : "border-transparent text-muted hover:text-fg"
                        )}
                    >
                        {tab.label}
                        {tab.count !== undefined && <span className="rounded bg-subtle px-1.5 text-xs text-muted">{tab.count}</span>}
                    </Link>
                );
            })}
        </nav>
    );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[180px_1fr]">
            {rows.map(([key, value]) => (
                <div key={key} className="contents">
                    <dt className="text-[13px] text-muted">{key}</dt>
                    <dd className="min-w-0 text-sm break-words">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

export function Code({ children }: { children: ReactNode }) {
    return <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[12.5px]">{children}</code>;
}

export const th = "border-b border-line bg-subtle px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase";
export const td = "border-b border-line-subtle px-4 py-3 align-middle";

export function Loading() {
    return (
        <div className="flex items-center gap-2 px-1 py-8 text-[13px] text-muted">
            <LoaderCircle className="size-4 animate-spin" /> Loading…
        </div>
    );
}

const avatarTones = [
    "bg-info-soft text-info",
    "bg-success-soft text-success",
    "bg-warning-soft text-warning",
    "bg-primary-soft text-link",
    "bg-danger-soft text-danger",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
    const initials = name
        .split(/[.\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]!.toUpperCase())
        .join("");
    const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
    return (
        <span
            aria-hidden
            className={cx(
                "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
                size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
                avatarTones[hash % avatarTones.length]
            )}
        >
            {initials || "?"}
        </span>
    );
}
