import { Hono } from "hono";
import { z } from "zod";
import { parseScan } from "../../shared/codes";
import { packingList } from "../../shared/packing";
import type { EventSummary } from "../../shared/types";
import type { AppEnv } from "../env";
import { EVENT_SELECT, getEvent, getEventDetail, IN_JSON, insertLines, logItemIfChanged, recomputeLines } from "../db";
import { body, HttpError, id, now, parse } from "../http";
import { scan } from "./scan";

const text = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullable()
        .optional()
        .transform((v) => (v === "" ? null : v));

const startsAt = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a date and time.")
    .nullable()
    .optional();

const ManualLine = z.object({
    type_id: z.number().int().positive(),
    quantity: z.number().int().min(0).max(10_000),
});

const CreateEvent = z.object({
    name: z.string().trim().min(1, "Enter a name.").max(120),
    starts_at: startsAt,
    location: text(200),
    attendees: z.number().int().min(0).max(10_000),
    template_id: z.number().int().positive().nullable().optional(),
    instructor: z.string().trim().toLowerCase().email("Enter the instructor's email.").optional(),
    lines: z.array(ManualLine).max(200).default([]),
});

const UpdateEvent = z.object({
    name: z.string().trim().min(1, "Enter a name.").max(120).optional(),
    starts_at: startsAt,
    location: text(200),
    attendees: z.number().int().min(0).max(10_000).optional(),
    template_id: z.number().int().positive().nullable().optional(),
    instructor: z.string().trim().toLowerCase().email("Enter the instructor's email.").optional(),
});

const Scan = z.object({
    mode: z.enum(["pack", "return"]),
    value: z.string().min(1).max(500),
});

const FinishPacking = z.object({
    supplies: z.array(z.object({ type_id: z.number().int().positive(), count: z.number().int().min(0).max(100_000) })).default([]),
});

const FinishReturn = z.object({
    supplies: z.array(z.object({ type_id: z.number().int().positive(), back: z.number().int().min(0).max(100_000) })).default([]),
});

const FILTERS: Record<string, string> = {
    planned: "WHERE e.status = 'planned' ORDER BY e.starts_at IS NULL, e.starts_at, e.id",
    out: "WHERE e.status = 'out' ORDER BY e.starts_at, e.id",
    returned: "WHERE e.status = 'returned' ORDER BY e.returned_at DESC LIMIT 100",
};

async function requireTemplate(db: D1Database, templateId: number | null | undefined) {
    if (!templateId) return;
    const found = await db.prepare("SELECT 1 FROM templates WHERE id = ?").bind(templateId).first();
    if (!found) throw new HttpError(400, "That template no longer exists.");
}

async function requireTypes(db: D1Database, typeIds: number[]) {
    if (typeIds.length === 0) return;
    const unique = [...new Set(typeIds)];
    const found = await db.prepare(`SELECT COUNT(*) AS n FROM item_types WHERE id ${IN_JSON}`).bind(JSON.stringify(unique)).first<{ n: number }>();
    if (found!.n !== unique.length) throw new HttpError(400, "One of the types no longer exists.");
}

function requirePlanned(event: EventSummary) {
    if (event.status !== "planned") throw new HttpError(409, "The packing list is fixed once the event is packed.");
}

export const events = new Hono<AppEnv>()
    .get("/", async (c) => {
        const filter = FILTERS[c.req.query("filter") ?? "planned"] ?? FILTERS.planned;
        const rows = await c.env.DB.prepare(`${EVENT_SELECT} ${filter}`).all<EventSummary>();
        return c.json(rows.results);
    })

    .post("/", async (c) => {
        const input = parse(CreateEvent, await body(c.req.raw));
        const db = c.env.DB;
        const email = c.get("email");
        await requireTemplate(db, input.template_id);
        await requireTypes(db, input.lines.map((l) => l.type_id));

        const template = await db
            .prepare("SELECT type_id, amount, per_attendee FROM template_lines WHERE template_id = ?")
            .bind(input.template_id ?? -1)
            .all<{ type_id: number; amount: number; per_attendee: number }>();
        const lines = packingList(
            template.results.map((l) => ({ ...l, per_attendee: l.per_attendee === 1 })),
            input.attendees,
            input.lines.map((l) => ({ ...l, manual: true }))
        ).filter((l) => l.manual || l.quantity > 0);

        const created = await db
            .prepare(
                `INSERT INTO events (name, starts_at, location, attendees, template_id, instructor, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
            )
            .bind(input.name, input.starts_at ?? null, input.location ?? null, input.attendees, input.template_id ?? null, input.instructor ?? email, email, now())
            .first<{ id: number }>();
        const eventId = created!.id;
        try {
            if (lines.length) await insertLines(db, lines.map((l) => ({ ...l, event_id: eventId }))).run();
        } catch (error) {
            await db.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();
            throw error;
        }
        return c.json(await getEventDetail(db, eventId), 201);
    })

    .get("/:id", async (c) => c.json(await getEventDetail(c.env.DB, id(c.req.param("id")))))

    .patch("/:id", async (c) => {
        const eventId = id(c.req.param("id"));
        const input = parse(UpdateEvent, await body(c.req.raw));
        const db = c.env.DB;
        const event = await getEvent(db, eventId);
        const attendees = input.attendees ?? event.attendees;
        const templateId = input.template_id === undefined ? event.template_id : input.template_id;
        const listChanges = attendees !== event.attendees || templateId !== event.template_id;
        if (listChanges) requirePlanned(event);
        await requireTemplate(db, templateId);

        const update = db
            .prepare("UPDATE events SET name = ?, starts_at = ?, location = ?, attendees = ?, template_id = ?, instructor = ? WHERE id = ?")
            .bind(
                input.name ?? event.name,
                input.starts_at === undefined ? event.starts_at : input.starts_at,
                input.location === undefined ? event.location : input.location,
                attendees,
                templateId,
                input.instructor ?? event.instructor,
                eventId
            );
        await db.batch([update, ...(listChanges ? await recomputeLines(db, [{ id: eventId, attendees }], templateId) : [])]);
        return c.json(await getEventDetail(db, eventId));
    })

    .delete("/:id", async (c) => {
        const eventId = id(c.req.param("id"));
        const db = c.env.DB;
        const event = await getEvent(db, eventId);
        if (event.status !== "planned") throw new HttpError(409, "Only events that haven't been packed can be deleted.");
        const at = now();
        const email = c.get("email");
        await db.batch([
            db
                .prepare("INSERT INTO item_log (item_code, action, by, at) SELECT item_code, 'unpacked', ?, ? FROM event_items WHERE event_id = ?")
                .bind(email, at, eventId),
            db.prepare("UPDATE items SET status = 'available', event_id = NULL WHERE event_id = ? AND status = 'out'").bind(eventId),
            db.prepare("DELETE FROM events WHERE id = ?").bind(eventId),
        ]);
        return c.body(null, 204);
    })

    /** Set a line's quantity by hand. It then stays as set when attendees or the template change. */
    .put("/:id/lines/:typeId", async (c) => {
        const eventId = id(c.req.param("id"));
        const typeId = id(c.req.param("typeId"));
        const input = parse(ManualLine.pick({ quantity: true }), await body(c.req.raw));
        const db = c.env.DB;
        requirePlanned(await getEvent(db, eventId));
        await requireTypes(db, [typeId]);
        await db
            .prepare(
                `INSERT INTO event_lines (event_id, type_id, quantity, manual) VALUES (?, ?, ?, 1)
                 ON CONFLICT (event_id, type_id) DO UPDATE SET quantity = excluded.quantity, manual = 1`
            )
            .bind(eventId, typeId, input.quantity)
            .run();
        return c.json(await getEventDetail(db, eventId));
    })

    /** Drop a hand-set quantity: the line goes back to what the template says (or away). */
    .delete("/:id/lines/:typeId", async (c) => {
        const eventId = id(c.req.param("id"));
        const typeId = id(c.req.param("typeId"));
        const db = c.env.DB;
        const event = await getEvent(db, eventId);
        requirePlanned(event);
        await db.batch(await recomputeLines(db, [event], event.template_id, typeId));
        return c.json(await getEventDetail(db, eventId));
    })

    .post("/:id/scan", async (c) => {
        const eventId = id(c.req.param("id"));
        const input = parse(Scan, await body(c.req.raw));
        const target = parseScan(input.value);
        if (!target) throw new HttpError(400, "That isn't a Ventorio label.");
        return c.json(await scan(c.env.DB, eventId, input.mode, target, c.get("email")));
    })

    /** Take a packed item off the event again, before it leaves. */
    .delete("/:id/items/:code", async (c) => {
        const eventId = id(c.req.param("id"));
        const code = c.req.param("code").toUpperCase();
        const db = c.env.DB;
        requirePlanned(await getEvent(db, eventId));
        const at = now();
        const results = await db.batch([
            db.prepare("DELETE FROM event_items WHERE event_id = ? AND item_code = ?").bind(eventId, code),
            logItemIfChanged(db, code, "unpacked", c.get("email"), at, eventId),
            db.prepare("UPDATE items SET status = 'available', event_id = NULL WHERE code = ? AND event_id = ? AND status = 'out'").bind(code, eventId),
        ]);
        if (!results[0].meta.changes) throw new HttpError(404, "That item isn't packed for this event.");
        return c.json(await getEventDetail(db, eventId));
    })

    /** Packing is done: supplies come off stock and the event is out. */
    .post("/:id/pack", async (c) => {
        const eventId = id(c.req.param("id"));
        const input = parse(FinishPacking, await body(c.req.raw));
        const db = c.env.DB;
        const event = await getEventDetail(db, eventId);
        requirePlanned(event);
        const counts = new Map(input.supplies.map((s) => [s.type_id, s.count]));
        const at = now();
        const email = c.get("email");

        const supplies = JSON.stringify(
            event.lines.filter((l) => l.kind === "supply").map((l) => ({ type_id: l.type_id, n: counts.get(l.type_id) ?? l.quantity }))
        );
        const count = "(SELECT s.value ->> 'n' FROM json_each(?) s WHERE s.value ->> 'type_id' = event_lines.type_id)";

        // Everything after the first statement only applies if that statement
        // was this request's: a double submit can't take supplies off twice.
        const mine = "EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'out' AND packed_at = ?)";
        const statements = [
            db.prepare("UPDATE events SET status = 'out', packed_at = ? WHERE id = ? AND status = 'planned'").bind(at, eventId),
            db
                .prepare(`UPDATE event_lines SET supplies_out = ${count} WHERE event_id = ? AND type_id IN (SELECT value ->> 'type_id' FROM json_each(?)) AND ${mine}`)
                .bind(supplies, eventId, supplies, eventId, at),
            db
                .prepare(`UPDATE item_types SET stock = stock - ${count.replace("= event_lines.type_id", "= item_types.id")} WHERE id IN (SELECT value ->> 'type_id' FROM json_each(?)) AND ${mine}`)
                .bind(supplies, supplies, eventId, at),
            db
                .prepare(
                    `INSERT INTO supply_log (type_id, delta, reason, event_id, by, at)
                     SELECT value ->> 'type_id', -(value ->> 'n'), 'event', ?, ?, ? FROM json_each(?) WHERE value ->> 'n' != 0 AND ${mine}`
                )
                .bind(eventId, email, at, supplies, eventId, at),
            db.prepare("DELETE FROM scan_sessions WHERE event_id = ?").bind(eventId),
        ];
        const results = await db.batch(statements);
        if (!results[0].meta.changes) throw new HttpError(409, "Someone else just finished packing this event.");
        return c.json(await getEventDetail(db, eventId));
    })

    /** Return is done: unused supplies go back on stock; equipment not checked in is missing. */
    .post("/:id/return", async (c) => {
        const eventId = id(c.req.param("id"));
        const input = parse(FinishReturn, await body(c.req.raw));
        const db = c.env.DB;
        const event = await getEventDetail(db, eventId);
        if (event.status !== "out") throw new HttpError(409, "This event isn't out.");
        const back = new Map(input.supplies.map((s) => [s.type_id, s.back]));
        const at = now();
        const email = c.get("email");

        const supplyLines = event.lines.filter((l) => l.kind === "supply");
        for (const line of supplyLines) {
            if ((back.get(line.type_id) ?? 0) > (line.supplies_out ?? 0)) {
                throw new HttpError(400, `More ${line.type_name} came back than went out (${line.supplies_out ?? 0}).`);
            }
        }
        const supplies = JSON.stringify(supplyLines.map((l) => ({ type_id: l.type_id, n: back.get(l.type_id) ?? 0 })));
        const count = "(SELECT s.value ->> 'n' FROM json_each(?) s WHERE s.value ->> 'type_id' = event_lines.type_id)";

        const mine = "EXISTS (SELECT 1 FROM events WHERE id = ? AND status = 'returned' AND returned_at = ?)";
        const statements = [
            db.prepare("UPDATE events SET status = 'returned', returned_at = ? WHERE id = ? AND status = 'out'").bind(at, eventId),
            db
                .prepare(`UPDATE event_lines SET supplies_back = ${count} WHERE event_id = ? AND type_id IN (SELECT value ->> 'type_id' FROM json_each(?)) AND ${mine}`)
                .bind(supplies, eventId, supplies, eventId, at),
            db
                .prepare(`UPDATE item_types SET stock = stock + ${count.replace("= event_lines.type_id", "= item_types.id")} WHERE id IN (SELECT value ->> 'type_id' FROM json_each(?)) AND ${mine}`)
                .bind(supplies, supplies, eventId, at),
            db
                .prepare(
                    `INSERT INTO supply_log (type_id, delta, reason, event_id, by, at)
                     SELECT value ->> 'type_id', value ->> 'n', 'return', ?, ?, ? FROM json_each(?) WHERE value ->> 'n' != 0 AND ${mine}`
                )
                .bind(eventId, email, at, supplies, eventId, at),
        ];
        statements.push(
            db
                .prepare(
                    `INSERT INTO item_log (item_code, action, event_id, by, at)
                     SELECT ei.item_code, 'missing', ?, ?, ? FROM event_items ei JOIN items i ON i.code = ei.item_code
                     WHERE ei.event_id = ? AND ei.returned_at IS NULL AND i.status = 'out' AND i.event_id = ? AND ${mine}`
                )
                .bind(eventId, email, at, eventId, eventId, eventId, at),
            db.prepare("UPDATE items SET status = 'missing', event_id = NULL WHERE event_id = ? AND status = 'out'").bind(eventId),
            db.prepare("DELETE FROM scan_sessions WHERE event_id = ?").bind(eventId)
        );
        const results = await db.batch(statements);
        if (!results[0].meta.changes) throw new HttpError(409, "Someone else just finished the return of this event.");
        return c.json(await getEventDetail(db, eventId));
    });
