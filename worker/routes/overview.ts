import { Hono } from "hono";
import type { AttentionItem, EventSummary, Overview } from "../../shared/types";
import type { AppEnv } from "../env";
import { EVENT_SELECT } from "../db";

export const overview = new Hono<AppEnv>().get("/", async (c) => {
    const db = c.env.DB;
    const [counts, upcoming, outEvents, flagged, low] = await db.batch([
        db.prepare(
            `SELECT (SELECT COUNT(*) FROM events WHERE status = 'planned') AS planned,
                    (SELECT COUNT(*) FROM events WHERE status = 'out') AS out,
                    (SELECT COUNT(*) FROM items WHERE status = 'out') AS equipment_out`
        ),
        db.prepare(`${EVENT_SELECT} WHERE e.status = 'planned' ORDER BY e.starts_at IS NULL, e.starts_at, e.id LIMIT 6`),
        db.prepare(`${EVENT_SELECT} WHERE e.status = 'out' ORDER BY e.starts_at, e.id`),
        db.prepare(
            `SELECT i.code, i.name, i.status, t.name AS type_name FROM items i JOIN item_types t ON t.id = i.type_id
             WHERE i.status IN ('needs_cleaning', 'missing', 'repair')
             ORDER BY CASE i.status WHEN 'missing' THEN 0 WHEN 'needs_cleaning' THEN 1 ELSE 2 END, t.name, i.name`
        ),
        db.prepare(
            `SELECT id, name, stock, reorder_at FROM item_types
             WHERE kind = 'supply' AND reorder_at IS NOT NULL AND stock <= reorder_at ORDER BY name`
        ),
    ]);

    const n = counts.results[0] as { planned: number; out: number; equipment_out: number };
    const attention: AttentionItem[] = [
        ...(flagged.results as { code: string; name: string | null; status: AttentionItem["kind"]; type_name: string }[]).map((i) => ({
            kind: i.status,
            label: i.name ? `${i.name} (${i.type_name})` : `${i.type_name} ${i.code}`,
            href: `/items/${i.code}`,
        })),
        ...(low.results as { id: number; name: string; stock: number }[]).map((t) => ({
            kind: "low_stock" as const,
            label: `${t.name}: ${t.stock} left`,
            href: `/inventory?tab=supplies`,
        })),
    ];

    const result: Overview = {
        ...n,
        attention,
        upcoming: upcoming.results as EventSummary[],
        out_events: outEvents.results as EventSummary[],
    };
    return c.json(result);
});
