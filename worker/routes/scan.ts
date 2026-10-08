import type { ScanTarget } from "../../shared/codes";
import type { Item, ScanMode, ScanResult } from "../../shared/types";
import { findItem, getEvent, getItem, logItemIfChanged, statusAfterUse } from "../db";
import { HttpError, now } from "../http";

function label(item: Item): string {
    return item.name ? `${item.name} (${item.type_name})` : item.type_name;
}

function rejected(message: string, item: Item | null, fix?: ScanResult["fix"]): ScanResult {
    return { outcome: "rejected", tone: "danger", message, item, fix };
}

/** Pack an item for an event, or check it back in, from a scan. */
export async function scan(db: D1Database, eventId: number, mode: ScanMode, target: ScanTarget, email: string): Promise<ScanResult> {
    const event = await getEvent(db, eventId);
    if (mode === "pack" && event.status !== "planned") throw new HttpError(409, "This event is already packed.");
    if (mode === "return" && event.status !== "out") throw new HttpError(409, "This event isn't out.");

    const item = await findItem(db, target);
    if (!item) return rejected("No equipment has this label. Add it under Inventory first.", null);

    const packed = await db
        .prepare("SELECT returned_at FROM event_items WHERE event_id = ? AND item_code = ?")
        .bind(eventId, item.code)
        .first<{ returned_at: string | null }>();

    return mode === "pack" ? pack(db, eventId, item, packed !== null, email) : checkIn(db, eventId, item, packed, email);
}

async function pack(db: D1Database, eventId: number, item: Item, alreadyPacked: boolean, email: string): Promise<ScanResult> {
    if (alreadyPacked) return { outcome: "already", tone: "info", message: `${label(item)} is already packed.`, item };

    switch (item.status) {
        case "out":
            return rejected(`${label(item)} is packed for ${item.event_name ?? "another event"}.`, item);
        case "needs_cleaning":
            return rejected(`${label(item)} needs cleaning first.`, item, "clean");
        case "repair":
            return rejected(`${label(item)} is in repair.`, item);
        case "retired":
            return rejected(`${label(item)} is retired.`, item);
    }

    const counts = await db
        .prepare(
            `SELECT (SELECT quantity FROM event_lines WHERE event_id = ?1 AND type_id = ?2) AS needed,
                    (SELECT COUNT(*) FROM event_items ei JOIN items i ON i.code = ei.item_code
                      WHERE ei.event_id = ?1 AND i.type_id = ?2) AS packed`
        )
        .bind(eventId, item.type_id)
        .first<{ needed: number | null; packed: number }>();

    const at = now();
    const wasMissing = item.status === "missing";
    // Guarded on the status read above: if someone packed it a moment ago, nothing changes.
    const statements = [
        db
            .prepare("UPDATE items SET status = 'out', event_id = ?, last_used_at = ? WHERE code = ? AND status = ?")
            .bind(eventId, at, item.code, item.status),
        ...(wasMissing ? [logItemIfChanged(db, item.code, "found", email, at, eventId)] : []),
        db
            .prepare(
                `INSERT OR IGNORE INTO event_items (event_id, item_code, packed_at, packed_by)
                 SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM items WHERE code = ? AND status = 'out' AND event_id = ? AND last_used_at = ?)`
            )
            .bind(eventId, item.code, at, email, item.code, eventId, at),
        logItemIfChanged(db, item.code, "packed", email, at, eventId),
    ];
    const results = await db.batch(statements);
    const fresh = await getItem(db, item.code);
    if (!results[0].meta.changes) {
        // Lost a race: a second scan of the same label, or someone packing it elsewhere.
        return fresh.event_id === eventId
            ? { outcome: "already", tone: "info", message: `${label(item)} is already packed.`, item: fresh }
            : rejected(`${label(item)} was just packed for ${fresh.event_name ?? "another event"}.`, fresh);
    }

    const needed = counts?.needed ?? 0;
    const prefix = wasMissing ? "Found and packed" : "Packed";
    if (needed === 0) {
        return { outcome: "packed", tone: "warning", message: `${prefix} ${label(item)}, which isn't on the packing list.`, item: fresh };
    }
    if ((counts?.packed ?? 0) >= needed) {
        return { outcome: "packed", tone: "warning", message: `${prefix} ${label(item)}: more than the list needs.`, item: fresh };
    }
    return { outcome: "packed", tone: "success", message: `${prefix} ${label(item)}.`, item: fresh };
}

async function checkIn(
    db: D1Database,
    eventId: number,
    item: Item,
    packed: { returned_at: string | null } | null,
    email: string
): Promise<ScanResult> {
    if (!packed) {
        return rejected(
            item.status === "out"
                ? `${label(item)} is packed for ${item.event_name ?? "another event"}, not this one.`
                : `${label(item)} wasn't packed for this event.`,
            item
        );
    }
    if (packed.returned_at) return { outcome: "already", tone: "info", message: `${label(item)} is already back.`, item };

    const at = now();
    const status = statusAfterUse(item);
    const results = await db.batch([
        db
            .prepare("UPDATE event_items SET returned_at = ?, returned_by = ? WHERE event_id = ? AND item_code = ? AND returned_at IS NULL")
            .bind(at, email, eventId, item.code),
        logItemIfChanged(db, item.code, "returned", email, at, eventId),
        db.prepare("UPDATE items SET status = ?, event_id = NULL WHERE code = ? AND event_id = ?").bind(status, item.code, eventId),
    ]);
    const fresh = await getItem(db, item.code);
    if (!results[0].meta.changes) return { outcome: "already", tone: "info", message: `${label(item)} is already back.`, item: fresh };
    return status === "needs_cleaning"
        ? { outcome: "returned", tone: "warning", message: `${label(item)} is back and needs cleaning.`, item: fresh }
        : { outcome: "returned", tone: "success", message: `${label(item)} is back.`, item: fresh };
}
