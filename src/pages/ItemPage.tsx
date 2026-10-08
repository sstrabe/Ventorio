import { Archive, Pencil, Printer, SearchX, Sparkles, StickyNote, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { renderSVG } from "uqr";
import { tagPath } from "../../shared/codes";
import type { Item, ItemLogEntry, ItemType, ScanResult, ScanSession } from "../../shared/types";
import { Dialog, text } from "../components/dialog";
import { useShell } from "../components/shell";
import {
    Badge,
    Button,
    buttonClass,
    Callout,
    Card,
    CardBody,
    CardHeader,
    Code,
    EmptyState,
    Field,
    inputClass,
    KeyValue,
    Loading,
    PageHeader,
    textareaClass,
    type ButtonVariant,
} from "../components/ui";
import { api, useApi } from "../lib/api";
import { formatFull, ITEM_STATUS, itemLabel, LOG_ACTIONS, person, relative } from "../lib/format";
import { useTitle } from "../lib/title";
import { feedback } from "../scanner/feedback";

interface ItemData {
    item: Item;
    log: ItemLogEntry[];
    session: ScanSession | null;
}

/**
 * What a label's URL opens (/t/<code>), from a tapped NFC tag or the phone's
 * camera app. With a pack or return under way, the tap is recorded there.
 */
export function TagPage() {
    const { code = "" } = useParams();
    const navigate = useNavigate();
    const { refreshSession } = useShell();
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        api<{ session: ScanSession | null; result: ScanResult | null }>("/session/scan", { method: "POST", body: { value: code } })
            .then(({ session, result }) => {
                if (result) feedback(result.tone);
                refreshSession();
                navigate(`/items/${code.toUpperCase()}`, { replace: true, state: result ? { scan: result, session } : undefined });
            })
            .catch(() => navigate(`/items/${code.toUpperCase()}`, { replace: true }));
    }, [code, navigate, refreshSession]);

    return <Loading />;
}

type Action = "cleaned" | "maintained" | "repair" | "in_service" | "found" | "retire" | "note";

const ACTIONS: Record<Action, { label: string; description: string; icon: typeof Sparkles; note?: "optional" | "required" }> = {
    cleaned: { label: "Mark cleaned", description: "It's clean and ready for the next event.", icon: Sparkles },
    maintained: { label: "Log maintenance", description: "Records maintenance done today.", icon: Wrench, note: "optional" },
    repair: { label: "Send to repair", description: "It can't be packed until it's back in service.", icon: Wrench, note: "optional" },
    in_service: { label: "Back in service", description: "It can be packed again.", icon: Sparkles, note: "optional" },
    found: { label: "Mark found", description: "It's back in the store.", icon: Sparkles },
    retire: { label: "Retire", description: "It stays in the history but can't be packed again.", icon: Archive, note: "optional" },
    note: { label: "Add note", description: "Adds a note to the history.", icon: StickyNote, note: "required" },
};

function actionsFor(item: Item): { primary?: Action; others: Action[] } {
    switch (item.status) {
        case "needs_cleaning":
            return { primary: "cleaned", others: ["maintained", "repair", "note", "retire"] };
        case "missing":
            return { primary: "found", others: ["repair", "note", "retire"] };
        case "repair":
            return { primary: "in_service", others: ["maintained", "note", "retire"] };
        case "available":
            return { others: ["cleaned", "maintained", "repair", "note", "retire"] };
        case "out":
            return { others: ["note"] };
        case "retired":
            return { others: ["note"] };
    }
}

export function ItemPage() {
    const { code = "" } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const data = useApi<ItemData>(`/items/${code}`);
    const [action, setAction] = useState<Action | null>(null);
    const [editing, setEditing] = useState(false);
    const scan = (location.state as { scan?: ScanResult; session?: ScanSession } | null) ?? null;
    useTitle(data.data ? itemLabel(data.data.item) : code);

    if (data.error && !data.data) {
        return (
            <Card>
                <EmptyState icon={SearchX} title={`No equipment has the label ${code}`}>
                    {data.error.includes("not found") ? "It may have been deleted, or the label belongs to another Ventorio." : data.error}
                </EmptyState>
            </Card>
        );
    }
    if (!data.data) return <Loading />;

    const { item, log } = data.data;
    const status = ITEM_STATUS[item.status];
    const { primary, others } = actionsFor(item);
    const url = `${window.location.origin}${tagPath(item.code)}`;

    async function cleanAndPack() {
        await api(`/items/${item.code}/actions`, { method: "POST", body: { action: "cleaned" } });
        const result = await api<{ result: ScanResult | null; session: ScanSession | null }>("/session/scan", {
            method: "POST",
            body: { value: item.code },
        });
        if (result.result) feedback(result.result.tone);
        navigate(".", { replace: true, state: result.result ? { scan: result.result, session: result.session } : null });
        data.reload();
    }

    return (
        <>
            <PageHeader
                crumbs={[{ label: "Inventory", to: "/inventory" }, { label: item.type_name, to: `/inventory?tab=equipment&type_id=${item.type_id}` }, { label: item.code }]}
                title={item.name ?? item.type_name}
                badges={
                    <Badge tone={status.tone} dot>
                        {status.label}
                    </Badge>
                }
                description={item.name ? item.type_name : undefined}
                actions={
                    <>
                        <Button icon={Pencil} onClick={() => setEditing(true)}>
                            Edit
                        </Button>
                        {others.map((a) => (
                            <ActionButton key={a} action={a} variant={a === "retire" ? "danger-outline" : "secondary"} onClick={() => setAction(a)} />
                        ))}
                        {primary && <ActionButton action={primary} variant="primary" onClick={() => setAction(primary)} />}
                    </>
                }
            />
            {scan?.scan && (
                <div className="mb-6">
                    <Callout
                        tone={scan.scan.tone}
                        action={
                            scan.scan.fix === "clean" ? (
                                <Button size="sm" onClick={cleanAndPack}>
                                    Mark cleaned and pack
                                </Button>
                            ) : (
                                scan.session && (
                                    <Link to={`/events/${scan.session.event_id}?mode=${scan.session.mode}`} className={buttonClass("secondary", "sm")}>
                                        Open {scan.session.event_name}
                                    </Link>
                                )
                            )
                        }
                    >
                        {scan.scan.message}
                    </Callout>
                </div>
            )}
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card>
                        <CardHeader title="Details" />
                        <CardBody>
                            <KeyValue
                                rows={[
                                    ["Label code", <Code>{item.code}</Code>],
                                    ["Type", item.type_name],
                                    ["Serial number", item.serial ?? <span className="text-muted">None</span>],
                                    [
                                        "Event",
                                        item.event_id ? (
                                            <Link to={`/events/${item.event_id}`} className="text-link hover:underline">
                                                {item.event_name}
                                            </Link>
                                        ) : (
                                            <span className="text-muted">Not packed</span>
                                        ),
                                    ],
                                    ["Last used", <span title={formatFull(item.last_used_at)}>{relative(item.last_used_at)}</span>],
                                    ...(item.needs_cleaning || item.last_cleaned_at
                                        ? ([["Last cleaned", <span title={formatFull(item.last_cleaned_at)}>{relative(item.last_cleaned_at)}</span>]] as [string, React.ReactNode][])
                                        : []),
                                    ["Last maintenance", <span title={formatFull(item.last_maintained_at)}>{relative(item.last_maintained_at)}</span>],
                                    ...(item.notes ? ([["Notes", <span className="whitespace-pre-line">{item.notes}</span>]] as [string, React.ReactNode][]) : []),
                                ]}
                            />
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader title="History" />
                        <ul className="divide-y divide-line-subtle">
                            {log.map((entry) => (
                                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3 text-sm">
                                    <span className="font-medium">{LOG_ACTIONS[entry.action] ?? entry.action}</span>
                                    {entry.event_id && (
                                        <Link to={`/events/${entry.event_id}`} className="text-link hover:underline">
                                            {entry.event_name ?? "Deleted event"}
                                        </Link>
                                    )}
                                    {entry.note && <span className="text-muted">“{entry.note}”</span>}
                                    <span className="ml-auto text-xs text-muted" title={formatFull(entry.at)}>
                                        {person(entry.by)}, {relative(entry.at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
                <Card className="h-fit">
                    <CardHeader title="Label" />
                    <CardBody className="space-y-3">
                        <div
                            className="mx-auto w-40 rounded-md bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                            dangerouslySetInnerHTML={{ __html: renderSVG(url, { border: 1 }) }}
                        />
                        <p className="text-center font-mono text-[13px] break-all text-muted">{url}</p>
                        <Link to={`/labels?codes=${item.code}`} className={buttonClass("secondary") + " w-full"}>
                            <Printer className="size-4" /> Print or write tag
                        </Link>
                    </CardBody>
                </Card>
            </div>

            {action && (
                <ActionDialog
                    item={item}
                    action={action}
                    onClose={() => setAction(null)}
                    onDone={() => {
                        navigate(".", { replace: true, state: null });
                        data.reload();
                    }}
                />
            )}
            <EditItem item={item} open={editing} onClose={() => setEditing(false)} onSaved={data.reload} />
        </>
    );
}

function ActionButton({ action, variant, onClick }: { action: Action; variant: ButtonVariant; onClick: () => void }) {
    const { label, icon } = ACTIONS[action];
    return (
        <Button variant={variant} icon={icon} onClick={onClick}>
            {label}
        </Button>
    );
}

function ActionDialog({ item, action, onClose, onDone }: { item: Item; action: Action; onClose: () => void; onDone: () => void }) {
    const spec = ACTIONS[action];
    return (
        <Dialog
            open
            onClose={onClose}
            title={`${spec.label}: ${itemLabel(item)}`}
            description={spec.description}
            submitLabel={spec.label}
            submitVariant={action === "retire" ? "danger" : "primary"}
            onSubmit={async (data) => {
                await api(`/items/${item.code}/actions`, { method: "POST", body: { action, note: text(data, "note") } });
                onDone();
            }}
        >
            {spec.note ? (
                <Field label="Note" htmlFor="action-note" optional={spec.note === "optional"}>
                    <textarea id="action-note" name="note" rows={3} required={spec.note === "required"} className={textareaClass} />
                </Field>
            ) : (
                <p className="text-[13px] text-muted">{itemLabel(item)} becomes available.</p>
            )}
        </Dialog>
    );
}

function EditItem({ item, open, onClose, onSaved }: { item: Item; open: boolean; onClose: () => void; onSaved: () => void }) {
    const types = useApi<ItemType[]>(open ? "/types" : null);
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Edit item"
            submitLabel="Save item"
            onSubmit={async (data) => {
                const typeId = text(data, "type_id");
                await api(`/items/${item.code}`, {
                    method: "PATCH",
                    body: { type_id: typeId ? Number(typeId) : undefined, name: text(data, "name"), serial: text(data, "serial"), notes: text(data, "notes") },
                });
                onSaved();
            }}
        >
            <Field label="Name" htmlFor="item-name" optional hint="To tell identical items apart, e.g. “Manikin 3”.">
                <input id="item-name" name="name" defaultValue={item.name ?? ""} className={inputClass} />
            </Field>
            <Field label="Type" htmlFor="item-type">
                <select id="item-type" name="type_id" defaultValue={item.type_id} disabled={item.status === "out"} className={inputClass}>
                    {(types.data ?? [{ id: item.type_id, name: item.type_name, kind: "equipment" }])
                        .filter((t) => t.kind === "equipment")
                        .map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                </select>
            </Field>
            <Field label="Serial number" htmlFor="item-serial" optional hint="Scanning the maker's barcode finds the item too.">
                <input id="item-serial" name="serial" defaultValue={item.serial ?? ""} className={inputClass} />
            </Field>
            <Field label="Notes" htmlFor="item-notes" optional>
                <textarea id="item-notes" name="notes" rows={3} defaultValue={item.notes ?? ""} className={textareaClass} />
            </Field>
        </Dialog>
    );
}
