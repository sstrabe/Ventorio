import { packingList, type PackingLine } from "../shared/packing";
import type { EventDetail, EventItem, EventLine, EventSummary, Item, ItemStatus } from "../shared/types";
import { notFound } from "./http";

// SQLite has no booleans; these turn 0/1 columns into the API's booleans.
type Row<T, K extends keyof T> = Omit<T, K> & { [P in K]: number };

export const ITEM_SELECT = `
    SELECT i.code, i.type_id, t.name AS type_name, t.needs_cleaning, i.name, i.serial, i.status,
           i.event_id, e.name AS event_name, i.notes, i.last_used_at, i.last_cleaned_at,
           i.last_maintained_at, i.created_at
    FROM items i
    JOIN item_types t ON t.id = i.type_id
    LEFT JOIN events e ON e.id = i.event_id`;

export function toItem(row: Row<Item, "needs_cleaning">): Item {
    return { ...row, needs_cleaning: row.needs_cleaning === 1 };
}

export async function findItem(db: D1Database, target: { code?: string; serial?: string }): Promise<Item | null> {
    if (target.code) {
        const row = await db.prepare(`${ITEM_SELECT} WHERE i.code = ?`).bind(target.code).first<Row<Item, "needs_cleaning">>();
        if (row) return toItem(row);
    }
    if (target.serial) {
        const row = await db.prepare(`${ITEM_SELECT} WHERE i.serial = ?`).bind(target.serial).first<Row<Item, "needs_cleaning">>();
        if (row) return toItem(row);
    }
    return null;
}

export async function getItem(db: D1Database, code: string): Promise<Item> {
    const item = await findItem(db, { code });
    if (!item) throw notFound("Item");
    return item;
}

export function logItem(db: D1Database, code: string, action: string, by: string, at: string, eventId: number | null = null, note: string | null = null) {
    return db
        .prepare("INSERT INTO item_log (item_code, action, event_id, note, by, at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(code, action, eventId, note, by, at);
}

/**
 * The same, but only written when the statement just before it in a batch
 * changed a row: a guarded UPDATE that lost a race leaves no log entry.
 */
export function logItemIfChanged(db: D1Database, code: string, action: string, by: string, at: string, eventId: number | null = null, note: string | null = null) {
    return db
        .prepare("INSERT INTO item_log (item_code, action, event_id, note, by, at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0")
        .bind(code, action, eventId, note, by, at);
}

/** Where an item goes when it comes back from an event. */
export function statusAfterUse(item: Pick<Item, "needs_cleaning">): ItemStatus {
    return item.needs_cleaning ? "needs_cleaning" : "available";
}

export const EVENT_SELECT = `
    SELECT e.id, e.name, e.starts_at, e.location, e.attendees, e.template_id, tp.name AS template_name,
           e.instructor, e.status, e.packed_at, e.returned_at, e.created_by, e.created_at
    FROM events e
    LEFT JOIN templates tp ON tp.id = e.template_id`;

export async function getEvent(db: D1Database, eventId: number): Promise<EventSummary> {
    const event = await db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(eventId).first<EventSummary>();
    if (!event) throw notFound("Event");
    return event;
}

export async function getEventDetail(db: D1Database, eventId: number): Promise<EventDetail> {
    const event = await getEvent(db, eventId);
    const [lines, items] = await db.batch([
        db
            .prepare(
                `SELECT l.type_id, t.name AS type_name, t.kind, l.quantity, l.manual, l.supplies_out, l.supplies_back, t.stock,
                        (SELECT COUNT(*) FROM event_items ei JOIN items i ON i.code = ei.item_code
                          WHERE ei.event_id = l.event_id AND i.type_id = l.type_id) AS packed,
                        (SELECT COUNT(*) FROM event_items ei JOIN items i ON i.code = ei.item_code
                          WHERE ei.event_id = l.event_id AND i.type_id = l.type_id AND ei.returned_at IS NOT NULL) AS returned
                 FROM event_lines l JOIN item_types t ON t.id = l.type_id
                 WHERE l.event_id = ?
                 ORDER BY t.kind, t.name`
            )
            .bind(eventId),
        db
            .prepare(
                `SELECT ei.item_code AS code, i.name, i.type_id, t.name AS type_name, i.status,
                        ei.packed_at, ei.packed_by, ei.returned_at, ei.returned_by
                 FROM event_items ei
                 JOIN items i ON i.code = ei.item_code
                 JOIN item_types t ON t.id = i.type_id
                 WHERE ei.event_id = ?
                 ORDER BY t.name, ei.packed_at`
            )
            .bind(eventId),
    ]);

    const packedLines = (lines.results as Row<EventLine, "manual">[]).map((line) => ({ ...line, manual: line.manual === 1 }));

    // Equipment packed for a type the list doesn't have still shows up as a line.
    const listed = new Set(packedLines.map((line) => line.type_id));
    for (const item of items.results as EventItem[]) {
        if (listed.has(item.type_id)) continue;
        listed.add(item.type_id);
        const ofType = (items.results as EventItem[]).filter((i) => i.type_id === item.type_id);
        packedLines.push({
            type_id: item.type_id,
            type_name: item.type_name,
            kind: "equipment",
            quantity: 0,
            manual: false,
            packed: ofType.length,
            returned: ofType.filter((i) => i.returned_at).length,
            supplies_out: null,
            supplies_back: null,
            stock: 0,
        });
    }

    return { ...event, lines: packedLines, items: items.results as EventItem[] };
}

/**
 * Rebuild the template lines of events that use `templateId`, from the
 * template and each event's attendee count. Manual lines stay as they are,
 * except the `forget` type's, which goes back to what the template says.
 * Returns two statements for a batch, however many events and lines there are.
 */
export async function recomputeLines(
    db: D1Database,
    events: { id: number; attendees: number }[],
    templateId: number | null,
    forget?: number
) {
    const ids = JSON.stringify(events.map((e) => e.id));
    const [template, manual] = await db.batch([
        db.prepare("SELECT type_id, amount, per_attendee FROM template_lines WHERE template_id = ?").bind(templateId ?? -1),
        db
            .prepare("SELECT event_id, type_id, quantity FROM event_lines WHERE event_id IN (SELECT value FROM json_each(?)) AND manual = 1 AND type_id != ?")
            .bind(ids, forget ?? -1),
    ]);
    const templateLines = (template.results as { type_id: number; amount: number; per_attendee: number }[]).map((l) => ({
        ...l,
        per_attendee: l.per_attendee === 1,
    }));
    const manualLines = manual.results as { event_id: number; type_id: number; quantity: number }[];
    const rows = events.flatMap((event) =>
        packingList(
            templateLines,
            event.attendees,
            manualLines.filter((l) => l.event_id === event.id).map((l) => ({ ...l, manual: true }))
        )
            .filter((l) => !l.manual && l.quantity > 0)
            .map((l) => ({ ...l, event_id: event.id }))
    );
    return [
        db
            .prepare("DELETE FROM event_lines WHERE event_id IN (SELECT value FROM json_each(?)) AND (manual = 0 OR type_id = ?)")
            .bind(ids, forget ?? -1),
        insertLines(db, rows),
    ];
}

/** Insert packing-list lines in one statement (D1 allows 100 bound parameters per query). */
export function insertLines(db: D1Database, lines: (PackingLine & { event_id: number })[]) {
    return db
        .prepare(
            `INSERT INTO event_lines (event_id, type_id, quantity, manual)
             SELECT value ->> 'event_id', value ->> 'type_id', value ->> 'quantity', value ->> 'manual' FROM json_each(?)`
        )
        .bind(JSON.stringify(lines.map((l) => ({ event_id: l.event_id, type_id: l.type_id, quantity: l.quantity, manual: l.manual ? 1 : 0 }))));
}

/** "id IN (...)" for any number of values, with one bound parameter. */
export const IN_JSON = "IN (SELECT value FROM json_each(?))";
