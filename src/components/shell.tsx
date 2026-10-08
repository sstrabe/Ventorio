import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Menu,
    Monitor,
    Moon,
    Package,
    QrCode,
    ScanLine,
    Sun,
    X,
    type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import type { Me, ScanSession } from "../../shared/types";
import { api, useApi } from "../lib/api";
import { person } from "../lib/format";
import { Logo } from "./logo";
import { Avatar, cx } from "./ui";

const NAV: { label?: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
    { items: [{ to: "/", label: "Overview", icon: LayoutDashboard }] },
    { label: "Work", items: [{ to: "/events", label: "Events", icon: CalendarDays }] },
    {
        label: "Inventory",
        items: [
            { to: "/inventory", label: "Inventory", icon: Package },
            { to: "/templates", label: "Templates", icon: ClipboardList },
            { to: "/labels", label: "Labels", icon: QrCode },
        ],
    },
];

interface ShellContext {
    me: Me | undefined;
    session: ScanSession | null;
    refreshSession: () => void;
}

const Context = createContext<ShellContext>({ me: undefined, session: null, refreshSession: () => {} });

export function useShell() {
    return useContext(Context);
}

export function Shell({ children }: { children: ReactNode }) {
    const [navOpen, setNavOpen] = useState(false);
    const location = useLocation();
    const me = useApi<Me>("/me");
    const session = useApi<ScanSession | null>("/session");

    // Close the drawer on back/forward too (links close it themselves, first).
    useEffect(() => setNavOpen(false), [location.pathname]);

    const isActive = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

    return (
        <Context.Provider value={{ me: me.data, session: session.data ?? null, refreshSession: session.reload }}>
            <div className="flex min-h-dvh">
                {navOpen && <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}
                <aside
                    className={cx(
                        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform print:hidden lg:translate-x-0 lg:shadow-none",
                        navOpen ? "translate-x-0 shadow-[0_0_0_100vmax_var(--overlay)]" : "-translate-x-full"
                    )}
                >
                    <div className="flex h-14 items-center gap-2.5 border-b border-line-subtle px-4">
                        <Logo size={28} className="shrink-0" />
                        <div className="min-w-0 leading-tight">
                            <div className="text-[15px] font-semibold">Ventorio</div>
                            <div className="truncate text-[11px] text-muted">Equipment for events</div>
                        </div>
                        <button
                            className="ml-auto rounded p-1 text-muted hover:bg-subtle lg:hidden"
                            aria-label="Close navigation"
                            onClick={() => setNavOpen(false)}
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
                        {NAV.map((group, i) => (
                            <div key={i}>
                                {group.label && (
                                    <div className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-faint uppercase">{group.label}</div>
                                )}
                                <ul className="space-y-0.5">
                                    {group.items.map(({ to, label, icon: Icon }) => (
                                        <li key={to}>
                                            <Link
                                                to={to}
                                                onClick={() => setNavOpen(false)}
                                                aria-current={isActive(to) ? "page" : undefined}
                                                className={cx(
                                                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm",
                                                    isActive(to) ? "bg-primary-soft font-medium text-link" : "text-muted hover:bg-subtle hover:text-fg"
                                                )}
                                            >
                                                <Icon className="size-4" /> {label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                    <div className="border-t border-line-subtle px-4 py-3 text-[11px] text-faint">Ventorio · 0.2.0</div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col lg:pl-60 print:pl-0">
                    {session.data && <SessionStrip session={session.data} onStop={session.reload} />}
                    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur print:hidden lg:px-6">
                        <button className="rounded p-1.5 text-muted hover:bg-subtle lg:hidden" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
                            <Menu className="size-5" />
                        </button>
                        <div className="ml-auto">{me.data && <UserMenu me={me.data} />}</div>
                    </header>
                    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0 lg:px-8 lg:py-8">{children}</main>
                </div>
            </div>
        </Context.Provider>
    );
}

/** Shown on every page while tapped tags are being recorded into an event. */
function SessionStrip({ session, onStop }: { session: ScanSession; onStop: () => void }) {
    const location = useLocation();
    const eventPath = `/events/${session.event_id}`;
    const onEventPage = location.pathname === eventPath;
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-info-soft px-4 py-2 text-[13px] text-fg print:hidden lg:px-6">
            <ScanLine className="size-4 shrink-0 text-info" />
            <span className="min-w-0 flex-1">
                {session.mode === "pack" ? "Packing" : "Returning"} <span className="font-medium">{session.event_name}</span>: tapped tags are
                recorded there.
            </span>
            {!onEventPage && (
                <Link to={`${eventPath}?mode=${session.mode}`} className="font-medium text-link hover:underline">
                    Open
                </Link>
            )}
            <button
                className="font-medium text-link hover:underline"
                onClick={async () => {
                    await api("/session", { method: "DELETE" });
                    onStop();
                }}
            >
                Stop
            </button>
        </div>
    );
}

type Theme = "light" | "dark" | "system";

function currentTheme(): Theme {
    const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
    return (match?.[1] as Theme) ?? "system";
}

function applyTheme(theme: Theme) {
    const root = document.documentElement;
    if (theme === "system") {
        document.cookie = "theme=; path=/; max-age=0; samesite=lax";
        root.removeAttribute("data-theme");
    } else {
        document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
        root.setAttribute("data-theme", theme);
    }
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
    const add = (color: string, media?: string) => {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = color;
        if (media) meta.media = media;
        document.head.append(meta);
    };
    if (theme === "system") {
        add("#f2f3f5", "(prefers-color-scheme: light)");
        add("#141518", "(prefers-color-scheme: dark)");
    } else {
        add(theme === "dark" ? "#141518" : "#f2f3f5");
    }
}

function UserMenu({ me }: { me: Me }) {
    const [open, setOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>(currentTheme);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const name = person(me.email);
    const options: { id: Theme; label: string; icon: LucideIcon }[] = [
        { id: "light", label: "Light", icon: Sun },
        { id: "dark", label: "Dark", icon: Moon },
        { id: "system", label: "System", icon: Monitor },
    ];

    return (
        <div ref={ref} className="relative">
            <button
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-subtle"
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen(!open)}
            >
                <Avatar name={name} size="sm" />
                <span className="hidden text-sm font-medium sm:inline">{name}</span>
            </button>
            {open && (
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-line bg-surface p-1 shadow-lg" role="menu">
                    <div className="px-2 py-2">
                        <div className="text-sm font-semibold">{name}</div>
                        <div className="truncate text-xs text-muted">{me.email}</div>
                    </div>
                    <div className="border-t border-line-subtle px-2 py-2">
                        <div className="mb-1.5 text-xs text-muted">Theme</div>
                        <div className="flex rounded-md border border-line p-0.5" role="radiogroup" aria-label="Theme">
                            {options.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    role="radio"
                                    aria-checked={theme === id}
                                    onClick={() => {
                                        setTheme(id);
                                        applyTheme(id);
                                    }}
                                    className={cx(
                                        "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs",
                                        theme === id ? "bg-primary-soft text-link" : "text-muted hover:text-fg"
                                    )}
                                >
                                    <Icon className="size-3.5" /> {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-line-subtle pt-1">
                        <a href="/cdn-cgi/access/logout" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-subtle" role="menuitem">
                            <LogOut className="size-4" /> Sign out
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
