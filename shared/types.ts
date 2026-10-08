// Shapes the API returns; shared by the Worker and the client.

export type ItemKind = "equipment" | "supply";
export type ItemStatus = "available" | "out" | "needs_cleaning" | "repair" | "missing" | "retired";
export type EventStatus = "planned" | "out" | "returned";
export type ScanMode = "pack" | "return";

export interface ItemType {
    id: number;
    name: string;
    kind: ItemKind;
    needs_cleaning: boolean;
    /** Supplies: units on hand. */
    stock: number;
    /** Supplies: flag as low at or below this. */
    reorder_at: number | null;
    /** Equipment: units per status (retired excluded from total). */
    counts: Partial<Record<ItemStatus, number>>;
    total: number;
}

export interface Item {
    code: string;
    type_id: number;
    type_name: string;
    needs_cleaning: boolean;
    name: string | null;
    serial: string | null;
    status: ItemStatus;
    event_id: number | null;
    event_name: string | null;
    notes: string | null;
    last_used_at: string | null;
    last_cleaned_at: string | null;
    last_maintained_at: string | null;
    created_at: string;
}

export interface ItemLogEntry {
    id: number;
    action: string;
    event_id: number | null;
    event_name: string | null;
    note: string | null;
    by: string;
    at: string;
}

export interface TemplateLine {
    type_id: number;
    type_name: string;
    kind: ItemKind;
    amount: number;
    per_attendee: boolean;
}

export interface Template {
    id: number;
    name: string;
    lines: TemplateLine[];
    events: number;
}

export interface EventSummary {
    id: number;
    name: string;
    starts_at: string | null;
    location: string | null;
    attendees: number;
    template_id: number | null;
    template_name: string | null;
    instructor: string;
    status: EventStatus;
    packed_at: string | null;
    returned_at: string | null;
    created_by: string;
    created_at: string;
}

export interface EventLine {
    type_id: number;
    type_name: string;
    kind: ItemKind;
    quantity: number;
    manual: boolean;
    /** Equipment: units packed / returned so far. */
    packed: number;
    returned: number;
    /** Supplies: units taken / brought back unused. */
    supplies_out: number | null;
    supplies_back: number | null;
    stock: number;
}

export interface EventItem {
    code: string;
    name: string | null;
    type_id: number;
    type_name: string;
    status: ItemStatus;
    packed_at: string;
    packed_by: string;
    returned_at: string | null;
    returned_by: string | null;
}

export interface EventDetail extends EventSummary {
    lines: EventLine[];
    items: EventItem[];
}

export interface ScanSession {
    event_id: number;
    event_name: string;
    mode: ScanMode;
    updated_at: string;
}

export type ScanOutcome = "packed" | "returned" | "already" | "rejected";

export interface ScanResult {
    outcome: ScanOutcome;
    tone: "success" | "info" | "warning" | "danger";
    message: string;
    item: Item | null;
    /** Set when the item could be packed after a quick fix the client can offer. */
    fix?: "clean";
}

export interface AttentionItem {
    kind: "needs_cleaning" | "missing" | "repair" | "low_stock";
    label: string;
    href: string;
}

export interface Overview {
    planned: number;
    out: number;
    equipment_out: number;
    attention: AttentionItem[];
    upcoming: EventSummary[];
    out_events: EventSummary[];
}

export interface Me {
    email: string;
}
