import { ArrowLeft, Check, PackageCheck, Pencil, RotateCcw, ScanLine, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { EventDetail, EventLine, ItemType, ScanMode, ScanResult, Template } from "../../shared/types";
import { Dialog, int, text } from "../components/dialog";
import { useShell } from "../components/shell";
import {
    Badge,
    Button,
    Callout,
    Card,
    CardBody,
    CardFooter,
    CardHeader,
    cx,
    EmptyState,
    Field,
    inputBase,
    inputClass,
    Loading,
    PageHeader,
    td,
    th,
} from "../components/ui";
import { api, useApi } from "../lib/api";
import { EVENT_STATUS, formatStart, ITEM_STATUS, itemLabel, person, plural, relative } from "../lib/format";
import { useTitle } from "../lib/title";
import { feedback } from "../scanner/feedback";
import { ScanPanel } from "../scanner/Scanner";
import { AddLine } from "./Events";

export function EventPage() {
    const { id } = useParams();
    const [params, setParams] = useSearchParams();
    const event = useApi<EventDetail>(`/events/${id}`);
    const { refreshSession } = useShell();
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    useTitle(event.data?.name);

    const requested = params.get("mode") as ScanMode | null;
    const data = event.data;
    const mode: ScanMode | null =
        data && requested === "pack" && data.status === "planned" ? "pack" : data && requested === "return" && data.status === "out" ? "return" : null;

    function setMode(next: ScanMode | null) {
        const p = new URLSearchParams(params);
        if (next) p.set("mode", next);
        else p.delete("mode");
        setParams(p, { replace: true });
    }

    // While packing or returning, tags tapped with the phone land in this event.
    const eventId = data?.id;
    useEffect(() => {
        if (!mode || !eventId) return;
        api("/session", { method: "PUT", body: { event_id: eventId, mode } }).then(refreshSession, () => {});
    }, [mode, eventId, refreshSession]);

    if (event.error && !data) return <Callout tone="danger">{event.error}</Callout>;
    if (!data) return <Loading />;

    const status = EVENT_STATUS[data.status];
    const meta = [formatStart(data.starts_at), data.location, plural(data.attendees, "attendee"), `Instructor: ${person(data.instructor)}`, data.template_name]
        .filter(Boolean)
        .join(" · ");

    return (
        <>
            <PageHeader
                crumbs={[{ label: "Events", to: `/events?filter=${data.status}` }, { label: data.name }]}
                title={data.name}
                badges={
                    <Badge tone={status.tone} dot>
                        {status.label}
                    </Badge>
                }
                description={meta}
                actions={
                    mode ? (
                        <Button icon={ArrowLeft} onClick={() => setMode(null)}>
                            Packing list
                        </Button>
                    ) : (
                        <>
                            <Button icon={Pencil} onClick={() => setEditing(true)}>
                                Edit
                            </Button>
                            {data.status === "planned" && (
                                <>
                                    <Button variant="danger-outline" icon={Trash2} onClick={() => setDeleting(true)}>
                                        Delete
                                    </Button>
                                    <Button variant="primary" icon={ScanLine} onClick={() => setMode("pack")}>
                                        Start packing
                                    </Button>
                                </>
                            )}
                            {data.status === "out" && (
                                <Button variant="primary" icon={ScanLine} onClick={() => setMode("return")}>
                                    Start return
                                </Button>
                            )}
                        </>
                    )
                }
            />
            {event.error && (
                <div className="mb-4">
                    <Callout tone="danger">{event.error}</Callout>
                </div>
            )}
            {mode ? (
                <ScanView
                    key={mode}
                    event={data}
                    mode={mode}
                    onChange={event.setData}
                    onFinished={(next) => {
                        event.setData(next);
                        refreshSession();
                        setMode(null);
                    }}
                />
            ) : (
                <Summary event={data} onChange={event.setData} />
            )}
            <EditEvent event={data} open={editing} onClose={() => setEditing(false)} onSaved={event.setData} />
            <DeleteEvent event={data} open={deleting} onClose={() => setDeleting(false)} />
        </>
    );
}

/* ---------- Summary: the packing list and what went out ---------- */

function Summary({ event, onChange }: { event: EventDetail; onChange: (e: EventDetail) => void }) {
    const planned = event.status === "planned";
    const types = useApi<ItemType[]>(planned ? "/types" : null);
    const [error, setError] = useState<string>();
    const missing = event.status === "returned" ? event.items.filter((i) => !i.returned_at) : [];

    async function change(path: string, method: "PUT" | "DELETE", body?: unknown) {
        try {
            setError(undefined);
            onChange(await api<EventDetail>(path, { method, body }));
        } catch (e) {
            setError((e as Error).message);
        }
    }

    return (
        <div className="space-y-6">
            {missing.length > 0 && (
                <Callout tone="danger" title={`${plural(missing.length, "item")} didn't come back`}>
                    {missing.map((i) => (
                        <Link key={i.code} to={`/items/${i.code}`} className="mr-3 text-link hover:underline">
                            {itemLabel(i)}
                        </Link>
                    ))}
                </Callout>
            )}
            <Card>
                <CardHeader
                    title="Packing list"
                    description={planned ? "Change a quantity to set it by hand; it then stays put when attendees change." : undefined}
                    actions={
                        planned && (
                            <AddLine
                                types={(types.data ?? []).filter((t) => !event.lines.some((l) => l.type_id === t.id))}
                                onAdd={(typeId) => change(`/events/${event.id}/lines/${typeId}`, "PUT", { quantity: 1 })}
                            />
                        )
                    }
                />
                {error && (
                    <div className="px-5 pt-4">
                        <Callout tone="danger">{error}</Callout>
                    </div>
                )}
                {event.lines.length === 0 ? (
                    <EmptyState icon={PackageCheck} title="The packing list is empty">
                        {planned ? "Add types, or choose a template under Edit." : undefined}
                    </EmptyState>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr>
                                    <th className={th}>Type</th>
                                    <th className={cx(th, "text-right")}>Needed</th>
                                    <th className={cx(th, "text-right")}>{planned ? "Packed" : "Went out"}</th>
                                    {!planned && <th className={cx(th, "text-right")}>Came back</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {event.lines.map((line) => (
                                    <tr key={line.type_id}>
                                        <td className={td}>
                                            <span className="font-medium">{line.type_name}</span>
                                            <span className="block text-xs text-muted">
                                                {line.kind === "supply" ? `Supply · ${line.stock} in stock` : "Equipment"}
                                                {line.manual && " · set by hand"}
                                            </span>
                                        </td>
                                        <td className={cx(td, "text-right")}>
                                            {planned ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    {line.manual && (
                                                        <button
                                                            className="rounded p-1 text-muted hover:bg-subtle hover:text-fg"
                                                            aria-label={`Reset ${line.type_name} to the template`}
                                                            title="Reset to the template"
                                                            onClick={() => change(`/events/${event.id}/lines/${line.type_id}`, "DELETE")}
                                                        >
                                                            <RotateCcw className="size-3.5" />
                                                        </button>
                                                    )}
                                                    <QuantityInput
                                                        value={line.quantity}
                                                        label={line.type_name}
                                                        onSave={(quantity) => change(`/events/${event.id}/lines/${line.type_id}`, "PUT", { quantity })}
                                                    />
                                                </div>
                                            ) : (
                                                line.quantity
                                            )}
                                        </td>
                                        <td className={cx(td, "text-right text-muted")}>
                                            {line.kind === "equipment" ? line.packed : planned ? "–" : (line.supplies_out ?? 0)}
                                        </td>
                                        {!planned && (
                                            <td className={cx(td, "text-right text-muted")}>
                                                {line.kind === "equipment" ? line.returned : (line.supplies_back ?? "–")}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            {event.items.length > 0 && <PackedItems event={event} />}
        </div>
    );
}

function QuantityInput({ value, label, onSave }: { value: number; label: string; onSave: (n: number) => void }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    const save = () => {
        const n = Math.max(0, Number.parseInt(draft, 10) || 0);
        if (n !== value) onSave(n);
        else setDraft(String(value));
    };
    return (
        <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={`Quantity of ${label}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className={cx(inputBase, "h-7 w-20 text-right")}
        />
    );
}

function PackedItems({ event, onRemove }: { event: EventDetail; onRemove?: (code: string) => void }) {
    return (
        <Card>
            <CardHeader title="Equipment" description={plural(event.items.length, "item") + (event.status === "planned" ? " packed" : "")} />
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                    <thead>
                        <tr>
                            <th className={th}>Item</th>
                            <th className={th}>Packed</th>
                            {event.status !== "planned" && <th className={th}>Back</th>}
                            {onRemove && <th className={th} />}
                        </tr>
                    </thead>
                    <tbody>
                        {event.items.map((item) => (
                            <tr key={item.code} className="transition-colors hover:bg-hover">
                                <td className={td}>
                                    <Link to={`/items/${item.code}`} className="group block">
                                        <span className="font-medium text-link group-hover:underline">{item.name ?? item.type_name}</span>
                                        <span className="block font-mono text-xs text-muted">{item.code}</span>
                                    </Link>
                                </td>
                                <td className={cx(td, "text-muted")} title={item.packed_at}>
                                    {relative(item.packed_at)} by {person(item.packed_by)}
                                </td>
                                {event.status !== "planned" && (
                                    <td className={td}>
                                        {item.returned_at ? (
                                            <Badge tone={ITEM_STATUS[item.status].tone} dot>
                                                {item.status === "available" ? "Back" : ITEM_STATUS[item.status].label}
                                            </Badge>
                                        ) : (
                                            <Badge tone={event.status === "returned" ? "danger" : "neutral"}>
                                                {event.status === "returned" ? "Missing" : "Not yet"}
                                            </Badge>
                                        )}
                                    </td>
                                )}
                                {onRemove && (
                                    <td className={cx(td, "text-right")}>
                                        <Button size="sm" variant="ghost" icon={Undo2} onClick={() => onRemove(item.code)}>
                                            Take off
                                        </Button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

/* ---------- Packing and returning ---------- */

interface FeedEntry {
    id: number;
    result: ScanResult;
}

function ScanView({
    event,
    mode,
    onChange,
    onFinished,
}: {
    event: EventDetail;
    mode: ScanMode;
    onChange: (e: EventDetail) => void;
    onFinished: (e: EventDetail) => void;
}) {
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [error, setError] = useState<string>();
    const [finishing, setFinishing] = useState(false);
    const supplies = event.lines.filter((l) => l.kind === "supply");
    const [counts, setCounts] = useState<Record<number, number>>(() =>
        Object.fromEntries(supplies.map((l) => [l.type_id, mode === "pack" ? l.quantity : 0]))
    );

    const refresh = useCallback(async () => onChange(await api<EventDetail>(`/events/${event.id}`)), [event.id, onChange]);

    const onValue = useCallback(
        async (value: string) => {
            try {
                setError(undefined);
                const result = await api<ScanResult>(`/events/${event.id}/scan`, { method: "POST", body: { mode, value } });
                feedback(result.tone);
                setFeed((f) => [{ id: Date.now() + Math.random(), result }, ...f].slice(0, 6));
                if (result.outcome === "packed" || result.outcome === "returned") await refresh();
            } catch (e) {
                feedback("danger");
                setError((e as Error).message);
            }
        },
        [event.id, mode, refresh]
    );

    async function cleanAndPack(code: string) {
        await api(`/items/${code}/actions`, { method: "POST", body: { action: "cleaned" } });
        await onValue(code);
    }

    async function takeOff(code: string) {
        try {
            onChange(await api<EventDetail>(`/events/${event.id}/items/${code}`, { method: "DELETE" }));
        } catch (e) {
            setError((e as Error).message);
        }
    }

    const equipment = event.lines.filter((l) => l.kind === "equipment");
    const short = mode === "pack" ? equipment.filter((l) => l.packed < l.quantity) : [];
    const notBack = mode === "return" ? event.items.filter((i) => !i.returned_at) : [];

    return (
        <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-2">
                <Card>
                    <CardHeader
                        title={mode === "pack" ? "Scan what you pack" : "Scan what comes back"}
                        description="Camera, NFC, or tap a tag with the phone: it opens Ventorio and lands here."
                    />
                    <CardBody className="space-y-3">
                        <ScanPanel onValue={onValue} />
                        {error && <Callout tone="danger">{error}</Callout>}
                        {feed.map(({ id, result }) => (
                            <Callout
                                key={id}
                                tone={result.tone}
                                action={
                                    result.fix === "clean" && result.item ? (
                                        <Button size="sm" onClick={() => cleanAndPack(result.item!.code)}>
                                            Mark cleaned and pack
                                        </Button>
                                    ) : undefined
                                }
                            >
                                {result.item ? (
                                    <Link to={`/items/${result.item.code}`} className="hover:underline">
                                        {result.message}
                                    </Link>
                                ) : (
                                    result.message
                                )}
                            </Callout>
                        ))}
                    </CardBody>
                </Card>
            </div>
            <div className="space-y-6 lg:col-span-3">
                <Card>
                    <CardHeader title={mode === "pack" ? "Packing list" : "Coming back"} />
                    <ul className="divide-y divide-line-subtle">
                        {equipment.map((line) => (
                            <ProgressRow key={line.type_id} line={line} done={mode === "pack" ? line.packed : line.returned} of={mode === "pack" ? line.quantity : line.packed} />
                        ))}
                        {supplies.map((line) => (
                            <li key={line.type_id} className="flex items-center gap-3 px-5 py-3 text-sm">
                                <span className="min-w-0 flex-1">
                                    <span className="font-medium">{line.type_name}</span>
                                    <span className="block text-xs text-muted">
                                        {mode === "pack" ? `Need ${line.quantity} · ${line.stock} in stock` : `${line.supplies_out ?? 0} went out · count what's unused`}
                                    </span>
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    max={mode === "return" ? (line.supplies_out ?? 0) : undefined}
                                    inputMode="numeric"
                                    aria-label={mode === "pack" ? `${line.type_name} taken` : `${line.type_name} back unused`}
                                    value={counts[line.type_id] ?? 0}
                                    onChange={(e) => setCounts({ ...counts, [line.type_id]: Math.max(0, Number(e.target.value) || 0) })}
                                    className={cx(inputBase, "h-7 w-20 text-right")}
                                />
                            </li>
                        ))}
                        {event.lines.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">The packing list is empty.</li>}
                    </ul>
                    <CardFooter>
                        <Button variant="primary" icon={Check} onClick={() => setFinishing(true)}>
                            {mode === "pack" ? "Finish packing" : "Finish return"}
                        </Button>
                    </CardFooter>
                </Card>
                {event.items.length > 0 && <PackedItems event={event} onRemove={mode === "pack" ? takeOff : undefined} />}
            </div>

            <Dialog
                open={finishing}
                onClose={() => setFinishing(false)}
                title={mode === "pack" ? "Finish packing" : "Finish return"}
                description={
                    mode === "pack"
                        ? "The event is marked out and its supplies come off stock."
                        : "The event is marked returned and unused supplies go back on stock."
                }
                submitLabel={mode === "pack" ? "Finish packing" : "Finish return"}
                onSubmit={async () => {
                    const body =
                        mode === "pack"
                            ? { supplies: supplies.map((l) => ({ type_id: l.type_id, count: counts[l.type_id] ?? 0 })) }
                            : { supplies: supplies.map((l) => ({ type_id: l.type_id, back: counts[l.type_id] ?? 0 })) };
                    onFinished(await api<EventDetail>(`/events/${event.id}/${mode}`, { method: "POST", body }));
                }}
            >
                {short.length > 0 && (
                    <Callout tone="warning" title="Short on equipment">
                        {short.map((l) => `${l.type_name}: ${l.packed} of ${l.quantity}`).join(", ")}
                    </Callout>
                )}
                {notBack.length > 0 && (
                    <Callout tone="warning" title={`${plural(notBack.length, "item")} will be marked missing`}>
                        {notBack.map((i) => itemLabel(i)).join(", ")}
                    </Callout>
                )}
                {supplies.length > 0 && (
                    <p className="text-[13px] text-muted">
                        {supplies.map((l) => `${counts[l.type_id] ?? 0} ${l.type_name}`).join(", ")} {mode === "pack" ? "taken" : "back unused"}.
                    </p>
                )}
                {short.length === 0 && notBack.length === 0 && supplies.length === 0 && (
                    <p className="text-[13px] text-muted">{mode === "pack" ? "Everything on the list is packed." : "Everything came back."}</p>
                )}
            </Dialog>
        </div>
    );
}

function ProgressRow({ line, done, of }: { line: EventLine; done: number; of: number }) {
    const complete = of > 0 && done >= of;
    return (
        <li className="flex items-center gap-3 px-5 py-3 text-sm">
            <span
                className={cx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    complete ? "bg-success-soft text-success" : "border border-line text-transparent"
                )}
                aria-hidden
            >
                <Check className="size-3.5" />
            </span>
            <span className={cx("min-w-0 flex-1", complete && "text-muted")}>{line.type_name}</span>
            <span className={cx("tabular-nums", complete ? "text-success" : done > of ? "text-warning" : "text-muted")}>
                {done} / {of}
            </span>
        </li>
    );
}

/* ---------- Edit and delete ---------- */

function EditEvent({ event, open, onClose, onSaved }: { event: EventDetail; open: boolean; onClose: () => void; onSaved: (e: EventDetail) => void }) {
    const templates = useApi<Template[]>(open ? "/templates" : null);
    const planned = event.status === "planned";
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Edit event"
            description={planned ? "Changing attendees or the template updates the packing list." : undefined}
            submitLabel="Save event"
            onSubmit={async (data) => {
                const template = text(data, "template_id");
                onSaved(
                    await api<EventDetail>(`/events/${event.id}`, {
                        method: "PATCH",
                        body: {
                            name: text(data, "name"),
                            starts_at: text(data, "starts_at"),
                            location: text(data, "location"),
                            instructor: text(data, "instructor") ?? undefined,
                            ...(planned ? { attendees: int(data, "attendees") ?? 0, template_id: template ? Number(template) : null } : {}),
                        },
                    })
                );
            }}
        >
            <Field label="Name" htmlFor="edit-name">
                <input id="edit-name" name="name" required defaultValue={event.name} className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" htmlFor="edit-starts" optional>
                    <input id="edit-starts" name="starts_at" type="datetime-local" defaultValue={event.starts_at ?? ""} className={inputClass} />
                </Field>
                <Field label="Attendees" htmlFor="edit-attendees">
                    <input
                        id="edit-attendees"
                        name="attendees"
                        type="number"
                        min={0}
                        required
                        disabled={!planned}
                        defaultValue={event.attendees}
                        className={inputClass}
                    />
                </Field>
            </div>
            <Field label="Location" htmlFor="edit-location" optional>
                <input id="edit-location" name="location" defaultValue={event.location ?? ""} className={inputClass} />
            </Field>
            <Field label="Template" htmlFor="edit-template">
                <select id="edit-template" name="template_id" disabled={!planned} defaultValue={event.template_id ?? ""} className={inputClass}>
                    <option value="">No template</option>
                    {templates.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                    {!templates.data && event.template_id && <option value={event.template_id}>{event.template_name}</option>}
                </select>
            </Field>
            <Field label="Instructor" htmlFor="edit-instructor">
                <input id="edit-instructor" name="instructor" type="email" required defaultValue={event.instructor} className={inputClass} />
            </Field>
        </Dialog>
    );
}

function DeleteEvent({ event, open, onClose }: { event: EventDetail; open: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const [typed, setTyped] = useState("");
    return (
        <Dialog
            open={open}
            onClose={() => {
                setTyped("");
                onClose();
            }}
            title="Delete event"
            description={
                event.items.length
                    ? `The event and its packing list are deleted; ${plural(event.items.length, "packed item")} go back to available.`
                    : "The event and its packing list are deleted."
            }
            submitLabel="Delete event"
            submitVariant="danger"
            submitDisabled={typed !== event.name}
            onSubmit={async () => {
                await api(`/events/${event.id}`, { method: "DELETE" });
                navigate("/events");
            }}
        >
            <Field label={`Type ${event.name} to confirm`} htmlFor="confirm-name">
                <input id="confirm-name" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} />
            </Field>
        </Dialog>
    );
}
