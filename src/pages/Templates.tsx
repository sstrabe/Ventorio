import { ClipboardList, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ItemType, Template } from "../../shared/types";
import { Dialog, text } from "../components/dialog";
import { Button, Callout, Card, CardHeader, cx, EmptyState, Field, inputBase, inputClass, Loading, PageHeader } from "../components/ui";
import { api, useApi } from "../lib/api";
import { plural } from "../lib/format";
import { useTitle } from "../lib/title";

function describeLine(line: { amount: number; per_attendee: boolean; type_name: string }) {
    if (!line.per_attendee) return `${line.amount} ${line.type_name} per event`;
    const every = 1 / line.amount;
    if (line.amount < 1 && Math.abs(every - Math.round(every)) < 1e-6) return `1 ${line.type_name} per ${Math.round(every)} attendees`;
    return `${line.amount} ${line.type_name} per attendee`;
}

export function Templates() {
    useTitle("Templates");
    const templates = useApi<Template[]>("/templates");
    const [editing, setEditing] = useState<Template | "new" | null>(null);

    return (
        <>
            <PageHeader
                title="Templates"
                description="What a kind of event needs, per attendee or per event. Events scale it to their headcount."
                actions={
                    <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                        Create template
                    </Button>
                }
            />
            {templates.error && <Callout tone="danger">{templates.error}</Callout>}
            {!templates.data && !templates.error && <Loading />}
            {templates.data?.length === 0 && (
                <Card>
                    <EmptyState
                        icon={ClipboardList}
                        title="No templates yet"
                        action={
                            <Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>
                                Create template
                            </Button>
                        }
                    >
                        Copy the equipment list from a course's instructor materials, e.g. one manikin per two participants.
                    </EmptyState>
                </Card>
            )}
            <div className="grid gap-6 lg:grid-cols-2">
                {templates.data?.map((t) => (
                    <Card key={t.id}>
                        <CardHeader
                            title={t.name}
                            description={t.events ? `Used by ${plural(t.events, "event")}` : "Not used yet"}
                            actions={
                                <Button size="sm" onClick={() => setEditing(t)}>
                                    Edit
                                </Button>
                            }
                        />
                        <ul className="space-y-1 px-5 py-4 text-sm">
                            {t.lines.length === 0 && <li className="text-muted">No lines.</li>}
                            {t.lines.map((line) => (
                                <li key={line.type_id} className="flex justify-between gap-3">
                                    <span>{describeLine(line)}</span>
                                    <span className="text-xs text-muted">{line.kind === "supply" ? "Supply" : "Equipment"}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
            {editing && <TemplateSheet template={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={templates.reload} />}
        </>
    );
}

interface DraftLine {
    key: number;
    type_id: number | null;
    amount: string;
    per_attendee: boolean;
}

function TemplateSheet({ template, onClose, onSaved }: { template?: Template; onClose: () => void; onSaved: () => void }) {
    const types = useApi<ItemType[]>("/types");
    const [deleting, setDeleting] = useState(false);
    const [typed, setTyped] = useState("");
    const [lines, setLines] = useState<DraftLine[]>(() =>
        template?.lines.length
            ? template.lines.map((l, i) => ({ key: i, type_id: l.type_id, amount: String(l.amount), per_attendee: l.per_attendee }))
            : [{ key: 0, type_id: null, amount: "1", per_attendee: true }]
    );

    const update = (key: number, change: Partial<DraftLine>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));

    return (
        <>
            <Dialog
                open={!deleting}
                onClose={onClose}
                sheet
                title={template ? `Edit ${template.name}` : "Create template"}
                description={template?.events ? "Events still being planned with it get their packing lists updated." : undefined}
                submitLabel={template ? "Save template" : "Create template"}
                onSubmit={async (data) => {
                    const filled = lines.filter((l) => l.type_id !== null);
                    if (filled.some((l) => !(Number(l.amount) > 0))) throw new Error("Amounts must be more than 0.");
                    const body = {
                        name: text(data, "name"),
                        lines: filled.map((l) => ({ type_id: l.type_id, amount: Number(l.amount), per_attendee: l.per_attendee })),
                    };
                    if (template) await api(`/templates/${template.id}`, { method: "PUT", body });
                    else await api("/templates", { method: "POST", body });
                    onSaved();
                }}
            >
                <Field label="Name" htmlFor="template-name">
                    <input id="template-name" name="name" required defaultValue={template?.name} placeholder="Adult First Aid/CPR/AED" className={inputClass} />
                </Field>
                <div className="space-y-2">
                    <span className="block text-[13px] font-medium">What it needs</span>
                    {lines.map((line) => (
                        <div key={line.key} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2 sm:flex-nowrap">
                            <select
                                aria-label="Type"
                                value={line.type_id ?? ""}
                                onChange={(e) => update(line.key, { type_id: e.target.value ? Number(e.target.value) : null })}
                                className={cx(inputBase, "min-w-0 flex-1 basis-full sm:basis-auto")}
                            >
                                <option value="">Choose a type</option>
                                {types.data?.map((t) => (
                                    <option key={t.id} value={t.id} disabled={lines.some((l) => l.type_id === t.id && l.key !== line.key)}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                aria-label="Amount"
                                type="number"
                                min={0}
                                step="any"
                                inputMode="decimal"
                                value={line.amount}
                                onChange={(e) => update(line.key, { amount: e.target.value })}
                                className={cx(inputBase, "w-20 text-right")}
                            />
                            <select
                                aria-label="Per"
                                value={line.per_attendee ? "attendee" : "event"}
                                onChange={(e) => update(line.key, { per_attendee: e.target.value === "attendee" })}
                                className={cx(inputBase, "w-auto")}
                            >
                                <option value="attendee">per attendee</option>
                                <option value="event">per event</option>
                            </select>
                            <button
                                type="button"
                                aria-label="Remove line"
                                onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                                className="rounded p-1 text-muted hover:bg-subtle hover:text-fg"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ))}
                    <Button
                        size="sm"
                        icon={Plus}
                        onClick={() => setLines([...lines, { key: Math.max(0, ...lines.map((l) => l.key)) + 1, type_id: null, amount: "1", per_attendee: true }])}
                    >
                        Add line
                    </Button>
                    <p className="text-xs text-muted">0.5 per attendee is one per two attendees, rounded up.</p>
                </div>
                {template && (
                    <div className="border-t border-line-subtle pt-4">
                        <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
                            Delete template
                        </Button>
                    </div>
                )}
            </Dialog>
            {template && (
                <Dialog
                    open={deleting}
                    onClose={() => setDeleting(false)}
                    title={`Delete ${template.name}`}
                    description={template.events ? "Planned events stop following it." : undefined}
                    submitLabel="Delete template"
                    submitVariant="danger"
                    submitDisabled={typed !== template.name}
                    onSubmit={async () => {
                        await api(`/templates/${template.id}`, { method: "DELETE" });
                        onSaved();
                        onClose();
                    }}
                >
                    <Field label={`Type ${template.name} to confirm`} htmlFor="confirm-template">
                        <input id="confirm-template" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} />
                    </Field>
                </Dialog>
            )}
        </>
    );
}
