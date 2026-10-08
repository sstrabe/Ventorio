import { CalendarDays, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { packingList } from "../../shared/packing";
import type { EventDetail, EventSummary, ItemType, Template } from "../../shared/types";
import { Dialog, int, text } from "../components/dialog";
import { useShell } from "../components/shell";
import { Badge, Button, Callout, Card, cx, EmptyState, Field, inputBase, inputClass, Loading, PageHeader, Tabs, td, th } from "../components/ui";
import { api, useApi } from "../lib/api";
import { EVENT_STATUS, formatStart, person, plural } from "../lib/format";
import { useTitle } from "../lib/title";

const FILTERS = [
    { id: "planned", label: "Planned" },
    { id: "out", label: "Out" },
    { id: "returned", label: "Returned" },
];

export function Events() {
    useTitle("Events");
    const [params, setParams] = useSearchParams();
    const filter = params.get("filter") ?? "planned";
    const { data, error } = useApi<EventSummary[]>(`/events?filter=${filter}`);
    const creating = params.get("new") === "1";

    function setCreating(open: boolean) {
        const next = new URLSearchParams(params);
        if (open) next.set("new", "1");
        else next.delete("new");
        setParams(next, { replace: true });
    }

    return (
        <>
            <PageHeader
                title="Events"
                description="Classes and other events, each with a packing list."
                actions={
                    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                        Create event
                    </Button>
                }
            />
            <Tabs tabs={FILTERS} param="filter" fallback="planned" />
            {error && <Callout tone="danger">{error}</Callout>}
            <Card>
                {!data && !error && <Loading />}
                {data && data.length === 0 && (
                    <EmptyState icon={CalendarDays} title={filter === "planned" ? "Nothing planned" : filter === "out" ? "Nothing out" : "Nothing returned yet"}>
                        {filter === "planned" ? "Create an event to get its packing list." : undefined}
                    </EmptyState>
                )}
                {data && data.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr>
                                    <th className={th}>Event</th>
                                    <th className={th}>When</th>
                                    <th className={th}>Instructor</th>
                                    <th className={cx(th, "text-right")}>Attendees</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((e) => (
                                    <tr key={e.id} className="transition-colors hover:bg-hover">
                                        <td className={td}>
                                            <Link to={`/events/${e.id}`} className="group block">
                                                <span className="font-medium text-link group-hover:underline">{e.name}</span>
                                                <span className="block text-xs text-muted">{[e.template_name, e.location].filter(Boolean).join(" · ") || "No template"}</span>
                                            </Link>
                                        </td>
                                        <td className={cx(td, "whitespace-nowrap text-muted")}>
                                            {formatStart(e.starts_at)}
                                            {e.status !== filter && (
                                                <span className="ml-2">
                                                    <Badge tone={EVENT_STATUS[e.status].tone} dot>
                                                        {EVENT_STATUS[e.status].label}
                                                    </Badge>
                                                </span>
                                            )}
                                        </td>
                                        <td className={cx(td, "text-muted")}>{person(e.instructor)}</td>
                                        <td className={cx(td, "text-right text-muted")}>{e.attendees}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
            <CreateEvent open={creating} onClose={() => setCreating(false)} />
        </>
    );
}

function CreateEvent({ open, onClose }: { open: boolean; onClose: () => void }) {
    const navigate = useNavigate();
    const { me } = useShell();
    const templates = useApi<Template[]>(open ? "/templates" : null);
    const types = useApi<ItemType[]>(open ? "/types" : null);
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [attendees, setAttendees] = useState(0);
    const [overrides, setOverrides] = useState<Record<number, number>>({});

    const template = templates.data?.find((t) => t.id === templateId);
    const lines = useMemo(
        () =>
            packingList(
                template?.lines ?? [],
                attendees,
                Object.entries(overrides).map(([typeId, quantity]) => ({ type_id: Number(typeId), quantity, manual: true }))
            ),
        [template, attendees, overrides]
    );
    const typeName = (id: number) => types.data?.find((t) => t.id === id)?.name ?? "…";

    function close() {
        setTemplateId(null);
        setAttendees(0);
        setOverrides({});
        onClose();
    }

    return (
        <Dialog
            open={open}
            onClose={close}
            sheet
            title="Create event"
            description="The packing list follows from the template and the number of attendees."
            submitLabel="Create event"
            onSubmit={async (data) => {
                const created = await api<EventDetail>("/events", {
                    method: "POST",
                    body: {
                        name: text(data, "name"),
                        starts_at: text(data, "starts_at"),
                        location: text(data, "location"),
                        attendees: int(data, "attendees") ?? 0,
                        template_id: templateId,
                        instructor: text(data, "instructor") ?? undefined,
                        lines: Object.entries(overrides).map(([typeId, quantity]) => ({ type_id: Number(typeId), quantity })),
                    },
                });
                navigate(`/events/${created.id}`);
            }}
        >
            <Field label="Name" htmlFor="name">
                <input id="name" name="name" required className={inputClass} placeholder="Adult First Aid/CPR/AED, Saturday" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Starts" htmlFor="starts_at" optional>
                    <input id="starts_at" name="starts_at" type="datetime-local" className={inputClass} />
                </Field>
                <Field label="Attendees" htmlFor="attendees">
                    <input
                        id="attendees"
                        name="attendees"
                        type="number"
                        min={0}
                        required
                        inputMode="numeric"
                        className={inputClass}
                        onChange={(e) => setAttendees(Math.max(0, Number(e.target.value) || 0))}
                    />
                </Field>
            </div>
            <Field label="Location" htmlFor="location" optional>
                <input id="location" name="location" className={inputClass} />
            </Field>
            <Field label="Template" htmlFor="template">
                <select
                    id="template"
                    className={inputClass}
                    value={templateId ?? ""}
                    onChange={(e) => {
                        setTemplateId(e.target.value ? Number(e.target.value) : null);
                        setOverrides({});
                    }}
                >
                    <option value="">No template</option>
                    {templates.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Instructor" htmlFor="instructor" hint="Their email; you by default.">
                <input id="instructor" name="instructor" type="email" className={inputClass} placeholder={me?.email} />
            </Field>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">Packing list</span>
                    <AddLine
                        types={(types.data ?? []).filter((t) => !lines.some((l) => l.type_id === t.id))}
                        onAdd={(typeId) => setOverrides({ ...overrides, [typeId]: 1 })}
                    />
                </div>
                {lines.length === 0 ? (
                    <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
                        Choose a template or add types.
                    </p>
                ) : (
                    <ul className="divide-y divide-line-subtle rounded-md border border-line">
                        {lines.map((line) => (
                            <li key={line.type_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="min-w-0 flex-1">
                                    {typeName(line.type_id)}
                                    {line.manual && <span className="ml-2 text-xs text-muted">set by hand</span>}
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    aria-label={`Quantity of ${typeName(line.type_id)}`}
                                    value={line.quantity}
                                    onChange={(e) => setOverrides({ ...overrides, [line.type_id]: Math.max(0, Number(e.target.value) || 0) })}
                                    className={cx(inputBase, "h-7 w-20 text-right")}
                                />
                            </li>
                        ))}
                    </ul>
                )}
                {lines.length > 0 && <p className="text-xs text-muted">{plural(lines.reduce((n, l) => n + l.quantity, 0), "thing")} in total.</p>}
            </div>
        </Dialog>
    );
}

export function AddLine({ types, onAdd }: { types: ItemType[]; onAdd: (typeId: number) => void }) {
    if (types.length === 0) return null;
    return (
        <select
            aria-label="Add a type"
            className={cx(inputBase, "h-7 w-auto text-[13px]")}
            value=""
            onChange={(e) => e.target.value && onAdd(Number(e.target.value))}
        >
            <option value="">Add a type…</option>
            {types.map((t) => (
                <option key={t.id} value={t.id}>
                    {t.name}
                </option>
            ))}
        </select>
    );
}
