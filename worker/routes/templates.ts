import { Hono } from "hono";
import { z } from "zod";
import type { Template, TemplateLine } from "../../shared/types";
import type { AppEnv } from "../env";
import { IN_JSON, recomputeLines } from "../db";
import { body, HttpError, id, notFound, parse } from "../http";

const SaveTemplate = z.object({
    name: z.string().trim().min(1, "Enter a name.").max(120),
    lines: z
        .array(
            z.object({
                type_id: z.number().int().positive(),
                amount: z.number().positive("Amounts must be more than 0.").max(10_000),
                per_attendee: z.boolean(),
            })
        )
        .max(200)
        .refine((lines) => new Set(lines.map((l) => l.type_id)).size === lines.length, "Each type can only be listed once."),
});

async function listTemplates(db: D1Database): Promise<Template[]> {
    const [templates, lines] = await db.batch([
        db.prepare(
            `SELECT tp.id, tp.name, (SELECT COUNT(*) FROM events e WHERE e.template_id = tp.id) AS events
             FROM templates tp ORDER BY tp.name`
        ),
        db.prepare(
            `SELECT l.template_id, l.type_id, t.name AS type_name, t.kind, l.amount, l.per_attendee
             FROM template_lines l JOIN item_types t ON t.id = l.type_id ORDER BY t.kind, t.name`
        ),
    ]);
    const byTemplate = new Map<number, TemplateLine[]>();
    for (const row of lines.results as (Omit<TemplateLine, "per_attendee"> & { template_id: number; per_attendee: number })[]) {
        const { template_id, ...line } = row;
        const list = byTemplate.get(template_id) ?? [];
        list.push({ ...line, per_attendee: line.per_attendee === 1 });
        byTemplate.set(template_id, list);
    }
    return (templates.results as Omit<Template, "lines">[]).map((t) => ({ ...t, lines: byTemplate.get(t.id) ?? [] }));
}

async function getTemplate(db: D1Database, templateId: number): Promise<Template> {
    const template = (await listTemplates(db)).find((t) => t.id === templateId);
    if (!template) throw notFound("Template");
    return template;
}

async function requireTypes(db: D1Database, typeIds: number[]) {
    if (!typeIds.length) return;
    const found = await db.prepare(`SELECT COUNT(*) AS n FROM item_types WHERE id ${IN_JSON}`).bind(JSON.stringify(typeIds)).first<{ n: number }>();
    if (found!.n !== typeIds.length) throw new HttpError(400, "One of the types no longer exists.");
}

/** All of a template's lines in one statement (D1 allows 100 bound parameters per query). */
function insertLines(db: D1Database, templateId: number, lines: z.infer<typeof SaveTemplate>["lines"]) {
    return db
        .prepare(
            `INSERT INTO template_lines (template_id, type_id, amount, per_attendee)
             SELECT ?, value ->> 'type_id', value ->> 'amount', value ->> 'per_attendee' FROM json_each(?)`
        )
        .bind(templateId, JSON.stringify(lines.map((l) => ({ type_id: l.type_id, amount: l.amount, per_attendee: l.per_attendee ? 1 : 0 }))));
}

export const templates = new Hono<AppEnv>()
    .get("/", async (c) => c.json(await listTemplates(c.env.DB)))

    .post("/", async (c) => {
        const input = parse(SaveTemplate, await body(c.req.raw));
        const db = c.env.DB;
        await requireTypes(db, input.lines.map((l) => l.type_id));
        const created = await db.prepare("INSERT INTO templates (name) VALUES (?) RETURNING id").bind(input.name).first<{ id: number }>();
        try {
            await insertLines(db, created!.id, input.lines).run();
        } catch (error) {
            await db.prepare("DELETE FROM templates WHERE id = ?").bind(created!.id).run();
            throw error;
        }
        return c.json(await getTemplate(db, created!.id), 201);
    })

    /** Replace a template. Events still being planned with it get their packing lists updated. */
    .put("/:id", async (c) => {
        const templateId = id(c.req.param("id"));
        const input = parse(SaveTemplate, await body(c.req.raw));
        const db = c.env.DB;
        await getTemplate(db, templateId);
        await requireTypes(db, input.lines.map((l) => l.type_id));
        await db.batch([
            db.prepare("UPDATE templates SET name = ? WHERE id = ?").bind(input.name, templateId),
            db.prepare("DELETE FROM template_lines WHERE template_id = ?").bind(templateId),
            insertLines(db, templateId, input.lines),
        ]);
        const planned = await db
            .prepare("SELECT id, attendees FROM events WHERE template_id = ? AND status = 'planned'")
            .bind(templateId)
            .all<{ id: number; attendees: number }>();
        if (planned.results.length) await db.batch(await recomputeLines(db, planned.results, templateId));
        return c.json(await getTemplate(db, templateId));
    })

    .delete("/:id", async (c) => {
        const templateId = id(c.req.param("id"));
        const result = await c.env.DB.prepare("DELETE FROM templates WHERE id = ?").bind(templateId).run();
        if (!result.meta.changes) throw notFound("Template");
        return c.body(null, 204);
    });
