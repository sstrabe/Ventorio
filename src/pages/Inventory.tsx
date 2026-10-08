import { Boxes, PackagePlus, Pencil, Plus, Printer, Search, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { Item, ItemStatus, ItemType } from "../../shared/types";
import { Dialog, int, text } from "../components/dialog";
import { Badge, Button, Callout, Card, Checkbox, cx, EmptyState, Field, inputBase, inputClass, Loading, PageHeader, Tabs, td, th } from "../components/ui";
import { api, useApi } from "../lib/api";
import { ITEM_STATUS, relative } from "../lib/format";
import { useTitle } from "../lib/title";

export function Inventory() {
    useTitle("Inventory");
    const [params] = useSearchParams();
    const tab = params.get("tab") ?? "equipment";
    const types = useApi<ItemType[]>("/types");
    const [dialog, setDialog] = useState<"equipment" | "supply" | "type" | null>(null);

    const equipmentTypes = types.data?.filter((t) => t.kind === "equipment") ?? [];
    const supplies = types.data?.filter((t) => t.kind === "supply") ?? [];

    return (
        <>
            <PageHeader
                title="Inventory"
                description="Equipment is labelled and tracked one by one; supplies are counted."
                actions={
                    tab === "equipment" ? (
                        <Button variant="primary" icon={PackagePlus} onClick={() => setDialog("equipment")}>
                            Add equipment
                        </Button>
                    ) : tab === "supplies" ? (
                        <Button variant="primary" icon={Plus} onClick={() => setDialog("supply")}>
                            Add supply
                        </Button>
                    ) : (
                        <Button variant="primary" icon={Plus} onClick={() => setDialog("type")}>
                            Add equipment type
                        </Button>
                    )
                }
            />
            <Tabs
                fallback="equipment"
                tabs={[
                    { id: "equipment", label: "Equipment", count: equipmentTypes.reduce((n, t) => n + t.total, 0) },
                    { id: "supplies", label: "Supplies", count: supplies.length },
                    { id: "types", label: "Equipment types", count: equipmentTypes.length },
                ]}
            />
            {types.error && <Callout tone="danger">{types.error}</Callout>}
            {tab === "equipment" && <EquipmentTab types={equipmentTypes} onAdd={() => setDialog("equipment")} />}
            {tab === "supplies" && <SuppliesTab supplies={supplies} loaded={!!types.data} onChange={types.reload} />}
            {tab === "types" && <TypesTab types={equipmentTypes} loaded={!!types.data} onChange={types.reload} />}

            <AddEquipment open={dialog === "equipment"} types={equipmentTypes} onClose={() => setDialog(null)} onAdded={types.reload} />
            <TypeDialog kind="supply" open={dialog === "supply"} onClose={() => setDialog(null)} onSaved={types.reload} />
            <TypeDialog kind="equipment" open={dialog === "type"} onClose={() => setDialog(null)} onSaved={types.reload} />
        </>
    );
}

/* ---------- Equipment ---------- */

const STATUS_FILTERS: (ItemStatus | "")[] = ["", "available", "out", "needs_cleaning", "repair", "missing", "retired"];

function EquipmentTab({ types, onAdd }: { types: ItemType[]; onAdd: () => void }) {
    const [params, setParams] = useSearchParams();
    const typeId = params.get("type_id") ?? "";
    const status = params.get("status") ?? "";
    const q = params.get("q") ?? "";
    const query = new URLSearchParams({ ...(typeId && { type_id: typeId }), ...(status && { status }), ...(q && { q }) });
    const items = useApi<Item[]>(`/items?${query}`);

    function set(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    }

    const filtered = Boolean(typeId || status || q);

    return (
        <Card>
            <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4 py-3">
                <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
                    <input
                        type="search"
                        aria-label="Search equipment"
                        placeholder="Search name, code, serial"
                        defaultValue={q}
                        onChange={(e) => set("q", e.target.value.trim())}
                        className={cx(inputClass, "pl-8")}
                    />
                </div>
                <select aria-label="Type" value={typeId} onChange={(e) => set("type_id", e.target.value)} className={cx(inputBase, "w-auto")}>
                    <option value="">All types</option>
                    {types.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                        </option>
                    ))}
                </select>
                <select aria-label="Status" value={status} onChange={(e) => set("status", e.target.value)} className={cx(inputBase, "w-auto")}>
                    {STATUS_FILTERS.map((s) => (
                        <option key={s} value={s}>
                            {s ? ITEM_STATUS[s].label : "In service"}
                        </option>
                    ))}
                </select>
                {items.data && items.data.length > 0 && (
                    <Link
                        to={`/labels?codes=${items.data.map((i) => i.code).join(",")}`}
                        className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-link hover:underline"
                    >
                        <Printer className="size-3.5" /> Labels for these
                    </Link>
                )}
            </div>
            {items.error && (
                <div className="p-4">
                    <Callout tone="danger">{items.error}</Callout>
                </div>
            )}
            {!items.data && !items.error && <Loading />}
            {items.data?.length === 0 &&
                (filtered ? (
                    <EmptyState icon={Search} title="Nothing matches">
                        Try another search or filter.
                    </EmptyState>
                ) : (
                    <EmptyState
                        icon={Boxes}
                        title="No equipment yet"
                        action={
                            <Button variant="primary" icon={PackagePlus} onClick={onAdd}>
                                Add equipment
                            </Button>
                        }
                    >
                        Add manikins, trainers and other reusable gear; each gets a label to scan.
                    </EmptyState>
                ))}
            {items.data && items.data.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr>
                                <th className={th}>Item</th>
                                <th className={th}>Status</th>
                                <th className={cx(th, "text-right")}>Last used</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.data.map((item) => (
                                <tr key={item.code} className="transition-colors hover:bg-hover">
                                    <td className={td}>
                                        <Link to={`/items/${item.code}`} className="group block">
                                            <span className="font-medium text-link group-hover:underline">{item.name ?? item.type_name}</span>
                                            <span className="block text-xs text-muted">
                                                <span className="font-mono">{item.code}</span>
                                                {item.name && ` · ${item.type_name}`}
                                                {item.serial && ` · ${item.serial}`}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className={td}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge tone={ITEM_STATUS[item.status].tone} dot>
                                                {ITEM_STATUS[item.status].label}
                                            </Badge>
                                            {item.event_name && <span className="text-xs text-muted">{item.event_name}</span>}
                                        </div>
                                    </td>
                                    <td className={cx(td, "text-right text-muted")} title={item.last_used_at ?? undefined}>
                                        {relative(item.last_used_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

function AddEquipment({ open, types, onClose, onAdded }: { open: boolean; types: ItemType[]; onClose: () => void; onAdded: () => void }) {
    const navigate = useNavigate();
    const [typeId, setTypeId] = useState<string>("");
    const [count, setCount] = useState(1);
    const newType = typeId === "new" || types.length === 0;

    return (
        <Dialog
            open={open}
            onClose={() => {
                setTypeId("");
                setCount(1);
                onClose();
            }}
            title="Add equipment"
            description="Each item gets its own label code. Print the labels next."
            submitLabel="Add equipment"
            onSubmit={async (data) => {
                let type = Number(typeId);
                if (newType) {
                    const created = await api<ItemType>("/types", {
                        method: "POST",
                        body: { name: text(data, "type_name"), kind: "equipment", needs_cleaning: data.get("needs_cleaning") === "on" },
                    });
                    type = created.id;
                }
                const { codes } = await api<{ codes: string[] }>("/items", {
                    method: "POST",
                    body: { type_id: type, count, name: count === 1 ? text(data, "name") : null, serial: count === 1 ? text(data, "serial") : null },
                });
                onAdded();
                navigate(`/labels?codes=${codes.join(",")}`);
            }}
        >
            {types.length > 0 && (
                <Field label="Type" htmlFor="add-type">
                    <select id="add-type" required value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
                        <option value="" disabled>
                            Choose a type
                        </option>
                        {types.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                        <option value="new">New type…</option>
                    </select>
                </Field>
            )}
            {newType && (
                <>
                    <Field label="New type" htmlFor="add-type-name">
                        <input id="add-type-name" name="type_name" required placeholder="Adult CPR manikin" className={inputClass} />
                    </Field>
                    <Checkbox name="needs_cleaning" label="Needs cleaning after each event" description="Returned items wait to be marked cleaned before they can be packed." />
                </>
            )}
            <Field label="How many" htmlFor="add-count">
                <input
                    id="add-count"
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={count}
                    onChange={(e) => setCount(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                    className={inputClass}
                />
            </Field>
            {count === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" htmlFor="add-name" optional>
                        <input id="add-name" name="name" placeholder="Manikin 3" className={inputClass} />
                    </Field>
                    <Field label="Serial number" htmlFor="add-serial" optional>
                        <input id="add-serial" name="serial" className={inputClass} />
                    </Field>
                </div>
            )}
        </Dialog>
    );
}

/* ---------- Supplies ---------- */

function SuppliesTab({ supplies, loaded, onChange }: { supplies: ItemType[]; loaded: boolean; onChange: () => void }) {
    const [stock, setStock] = useState<{ type: ItemType; mode: "restock" | "count" } | null>(null);
    const [editing, setEditing] = useState<ItemType | null>(null);

    return (
        <Card>
            {!loaded && <Loading />}
            {loaded && supplies.length === 0 && (
                <EmptyState icon={Tags} title="No supplies yet">
                    Add consumables like face shields, gloves or workbooks to count them per event.
                </EmptyState>
            )}
            {supplies.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr>
                                <th className={th}>Supply</th>
                                <th className={cx(th, "text-right")}>In stock</th>
                                <th className={th} />
                            </tr>
                        </thead>
                        <tbody>
                            {supplies.map((t) => {
                                const low = t.reorder_at !== null && t.stock <= t.reorder_at;
                                return (
                                    <tr key={t.id} className="transition-colors hover:bg-hover">
                                        <td className={td}>
                                            <span className="font-medium">{t.name}</span>
                                            <span className="block text-xs text-muted">
                                                {t.reorder_at !== null ? `Reorder at ${t.reorder_at}` : "No reorder level"}
                                            </span>
                                        </td>
                                        <td className={cx(td, "text-right")}>
                                            <span className="inline-flex items-center gap-2">
                                                {low && (
                                                    <Badge tone="warning" dot>
                                                        Low
                                                    </Badge>
                                                )}
                                                <span className="tabular-nums">{t.stock}</span>
                                            </span>
                                        </td>
                                        <td className={cx(td, "text-right whitespace-nowrap")}>
                                            <div className="flex justify-end gap-1">
                                                <Button size="sm" onClick={() => setStock({ type: t, mode: "restock" })}>
                                                    Restock
                                                </Button>
                                                <Button size="sm" onClick={() => setStock({ type: t, mode: "count" })}>
                                                    Count
                                                </Button>
                                                <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {stock && (
                <Dialog
                    open
                    onClose={() => setStock(null)}
                    title={stock.mode === "restock" ? `Restock ${stock.type.name}` : `Count ${stock.type.name}`}
                    description={stock.mode === "restock" ? `Adds to the ${stock.type.stock} in stock.` : "Sets the stock to what's actually on the shelf."}
                    submitLabel={stock.mode === "restock" ? "Add to stock" : "Save count"}
                    onSubmit={async (data) => {
                        await api(`/types/${stock.type.id}/stock`, { method: "POST", body: { mode: stock.mode, amount: int(data, "amount") ?? 0 } });
                        onChange();
                    }}
                >
                    <Field label={stock.mode === "restock" ? "How many arrived" : "How many are there"} htmlFor="stock-amount">
                        <input
                            id="stock-amount"
                            name="amount"
                            type="number"
                            min={0}
                            required
                            autoFocus
                            inputMode="numeric"
                            defaultValue={stock.mode === "count" ? stock.type.stock : undefined}
                            className={inputClass}
                        />
                    </Field>
                </Dialog>
            )}
            {editing && <TypeDialog kind="supply" type={editing} open onClose={() => setEditing(null)} onSaved={onChange} />}
        </Card>
    );
}

/* ---------- Types ---------- */

function TypesTab({ types, loaded, onChange }: { types: ItemType[]; loaded: boolean; onChange: () => void }) {
    const [editing, setEditing] = useState<ItemType | null>(null);
    const [deleting, setDeleting] = useState<ItemType | null>(null);

    return (
        <Card>
            {!loaded && <Loading />}
            {loaded && types.length === 0 && (
                <EmptyState icon={Tags} title="No equipment types yet">
                    A type groups identical equipment, like “Adult CPR manikin”.
                </EmptyState>
            )}
            {types.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead>
                            <tr>
                                <th className={th}>Type</th>
                                <th className={cx(th, "text-right")}>Available</th>
                                <th className={cx(th, "text-right")}>Out</th>
                                <th className={cx(th, "text-right")}>Total</th>
                                <th className={th} />
                            </tr>
                        </thead>
                        <tbody>
                            {types.map((t) => (
                                <tr key={t.id} className="transition-colors hover:bg-hover">
                                    <td className={td}>
                                        <Link to={`/inventory?tab=equipment&type_id=${t.id}`} className="group block">
                                            <span className="font-medium text-link group-hover:underline">{t.name}</span>
                                            <span className="block text-xs text-muted">{t.needs_cleaning ? "Cleaned after each event" : "No cleaning step"}</span>
                                        </Link>
                                    </td>
                                    <td className={cx(td, "text-right tabular-nums")}>{t.counts.available ?? 0}</td>
                                    <td className={cx(td, "text-right text-muted tabular-nums")}>{t.counts.out ?? 0}</td>
                                    <td className={cx(td, "text-right text-muted tabular-nums")}>{t.total}</td>
                                    <td className={cx(td, "text-right whitespace-nowrap")}>
                                        <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)} />
                                        <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {editing && <TypeDialog kind="equipment" type={editing} open onClose={() => setEditing(null)} onSaved={onChange} />}
            {deleting && (
                <DeleteType type={deleting} onClose={() => setDeleting(null)} onDeleted={onChange} />
            )}
        </Card>
    );
}

function DeleteType({ type, onClose, onDeleted }: { type: ItemType; onClose: () => void; onDeleted: () => void }) {
    const items = Object.values(type.counts).reduce((n, c) => n + (c ?? 0), 0);
    return (
        <Dialog
            open
            onClose={onClose}
            title={`Delete ${type.name}`}
            description="Templates stop listing it."
            submitLabel="Delete type"
            submitVariant="danger"
            submitDisabled={items > 0}
            onSubmit={async () => {
                await api(`/types/${type.id}`, { method: "DELETE" });
                onDeleted();
            }}
        >
            {items > 0 ? (
                <Callout tone="warning">It still has {items === 1 ? "1 item" : `${items} items`} (retired ones included), so it can't be deleted.</Callout>
            ) : (
                <p className="text-[13px] text-muted">It has no equipment.</p>
            )}
        </Dialog>
    );
}

function TypeDialog({
    kind,
    type,
    open,
    onClose,
    onSaved,
}: {
    kind: "equipment" | "supply";
    type?: ItemType;
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const noun = kind === "supply" ? "supply" : "equipment type";
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={type ? `Edit ${type.name}` : `Add ${noun}`}
            submitLabel={type ? `Save ${noun}` : `Add ${noun}`}
            onSubmit={async (data) => {
                const body = {
                    name: text(data, "name"),
                    needs_cleaning: data.get("needs_cleaning") === "on",
                    reorder_at: int(data, "reorder_at"),
                };
                if (type) await api(`/types/${type.id}`, { method: "PATCH", body });
                else await api("/types", { method: "POST", body: { ...body, kind, stock: int(data, "stock") ?? 0 } });
                onSaved();
            }}
        >
            <Field label="Name" htmlFor="type-name">
                <input
                    id="type-name"
                    name="name"
                    required
                    defaultValue={type?.name}
                    placeholder={kind === "supply" ? "CPR face shield" : "Adult CPR manikin"}
                    className={inputClass}
                />
            </Field>
            {kind === "equipment" ? (
                <Checkbox
                    name="needs_cleaning"
                    defaultChecked={type?.needs_cleaning}
                    label="Needs cleaning after each event"
                    description="Returned items wait to be marked cleaned before they can be packed."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {!type && (
                        <Field label="In stock now" htmlFor="type-stock">
                            <input id="type-stock" name="stock" type="number" min={0} defaultValue={0} inputMode="numeric" className={inputClass} />
                        </Field>
                    )}
                    <Field label="Reorder at" htmlFor="type-reorder" optional hint="Flagged as low at or below this.">
                        <input
                            id="type-reorder"
                            name="reorder_at"
                            type="number"
                            min={0}
                            inputMode="numeric"
                            defaultValue={type?.reorder_at ?? undefined}
                            className={inputClass}
                        />
                    </Field>
                </div>
            )}
        </Dialog>
    );
}
