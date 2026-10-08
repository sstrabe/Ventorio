import { Hono } from "hono";
import { z } from "zod";
import { newCode } from "../../shared/codes";
import type { Item, ItemLogEntry, ItemStatus } from "../../shared/types";
import type { AppEnv } from "../env";
import { getItem, IN_JSON, ITEM_SELECT, logItemIfChanged, statusAfterUse, toItem } from "../db";
import { body, HttpError, now, parse } from "../http";
import { getSession } from "./session";

const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullable()
        .optional()
        .transform((v) => (v === "" ? null : v));

const CreateItems = z
    .object({
        type_id: z.number().int().positive(),
        count: z.number().int().min(1).max(500).default(1),
        name: optionalText(80),
        serial: optionalText(120),
    })
    .refine((v) => v.count === 1 || (!v.name && !v.serial), "A name or serial only fits a single item.");

const UpdateItem = z.object({
    type_id: z.number().int().positive().optional(),
    name: optionalText(80),
    serial: optionalText(120),
    notes: optionalText(2000),
});

const Action = z.object({
    action: z.enum(["cleaned", "maintained", "repair", "in_service", "found", "retire", "note"]),
    note: optionalText(500),
});

const STATUSES = ["available", "out", "needs_cleaning", "repair", "missing", "retired"] as const;

/** What each action does to an item, and from which statuses it's allowed. */
const ACTIONS: Record<
    z.infer<typeof Action>["action"],
    { from: readonly ItemStatus[] | "any"; to?: (item: Item) => ItemStatus; stamp?: "last_cleaned_at" | "last_maintained_at" }
> = {
    cleaned: { from: ["needs_cleaning", "available"], to: () => "available", stamp: "last_cleaned_at" },
    maintained: { from: ["available", "needs_cleaning", "repair"], stamp: "last_maintained_at" },
    repair: { from: ["available", "needs_cleaning", "missing"], to: () => "repair" },
    in_service: { from: ["repair"], to: statusAfterUse },
    found: { from: ["missing"], to: statusAfterUse },
    retire: { from: ["available", "needs_cleaning", "repair", "missing"], to: () => "retired" },
    note: { from: "any" },
};

const STATUS_WORDS: Record<ItemStatus, string> = {
    available: "available",
    out: "out with an event",
    needs_cleaning: "waiting to be cleaned",
    repair: "in repair",
    missing: "missing",
    retired: "retired",
};

export const items = new Hono<AppEnv>()
    .get("/", async (c) => {
        const where: string[] = [];
        const params: unknown[] = [];
        const typeId = c.req.query("type_id");
        const status = c.req.query("status");
        const q = c.req.query("q")?.trim();
        const codes = c.req.query("codes")?.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
        if (codes?.length) {
            where.push(`i.code ${IN_JSON}`);
            params.push(JSON.stringify(codes));
        }
        if (typeId) {
            where.push("i.type_id = ?");
            params.push(Number(typeId));
        }
        if (status && (STATUSES as readonly string[]).includes(status)) {
            where.push("i.status = ?");
            params.push(status);
        } else if (!codes?.length) {
            where.push("i.status != 'retired'");
        }
        if (q) {
            where.push("(i.code LIKE ? OR i.name LIKE ? OR i.serial LIKE ? OR t.name LIKE ?)");
            params.push(...Array(4).fill(`%${q}%`));
        }
        const rows = await c.env.DB.prepare(`${ITEM_SELECT} WHERE ${where.join(" AND ")} ORDER BY t.name, i.name, i.created_at`)
            .bind(...params)
            .all();
        return c.json((rows.results as Parameters<typeof toItem>[0][]).map(toItem));
    })

    .post("/", async (c) => {
        const input = parse(CreateItems, await body(c.req.raw));
        const db = c.env.DB;
        const type = await db.prepare("SELECT kind FROM item_types WHERE id = ?").bind(input.type_id).first<{ kind: string }>();
        if (!type) throw new HttpError(400, "Choose a type.");
        if (type.kind !== "equipment") throw new HttpError(400, "Supplies are counted, not labelled. Restock them instead.");

        const at = now();
        const email = c.get("email");
        const codes = new Set<string>();
        while (codes.size < input.count) codes.add(newCode());
        const taken = await db.prepare(`SELECT code FROM items WHERE code ${IN_JSON}`).bind(JSON.stringify([...codes])).all<{ code: string }>();
        for (const { code } of taken.results) {
            codes.delete(code);
            let fresh = newCode();
            while (codes.has(fresh)) fresh = newCode();
            codes.add(fresh);
        }

        // Two statements however many items: D1 allows 100 bound parameters per query.
        const list = JSON.stringify([...codes]);
        await db.batch([
            db
                .prepare("INSERT INTO items (code, type_id, name, serial, created_at) SELECT value, ?, ?, ?, ? FROM json_each(?)")
                .bind(input.type_id, input.name ?? null, input.serial ?? null, at, list),
            db.prepare("INSERT INTO item_log (item_code, action, by, at) SELECT value, 'added', ?, ? FROM json_each(?)").bind(email, at, list),
        ]);
        return c.json({ codes: [...codes] }, 201);
    })

    .get("/:code", async (c) => {
        const db = c.env.DB;
        const item = await getItem(db, c.req.param("code").toUpperCase());
        const log = await db
            .prepare(
                `SELECT l.id, l.action, l.event_id, e.name AS event_name, l.note, l.by, l.at
                 FROM item_log l LEFT JOIN events e ON e.id = l.event_id
                 WHERE l.item_code = ? ORDER BY l.at DESC, l.id DESC LIMIT 100`
            )
            .bind(item.code)
            .all<ItemLogEntry>();
        return c.json({ item, log: log.results, session: await getSession(db, c.get("email")) });
    })

    .patch("/:code", async (c) => {
        const db = c.env.DB;
        const item = await getItem(db, c.req.param("code").toUpperCase());
        const input = parse(UpdateItem, await body(c.req.raw));
        if (input.type_id !== undefined && input.type_id !== item.type_id) {
            if (item.status === "out") throw new HttpError(409, "Change the type once the item is back.");
            const type = await db.prepare("SELECT kind FROM item_types WHERE id = ?").bind(input.type_id).first<{ kind: string }>();
            if (type?.kind !== "equipment") throw new HttpError(400, "Choose an equipment type.");
        }
        await db
            .prepare("UPDATE items SET type_id = ?, name = ?, serial = ?, notes = ? WHERE code = ?")
            .bind(
                input.type_id ?? item.type_id,
                input.name === undefined ? item.name : input.name,
                input.serial === undefined ? item.serial : input.serial,
                input.notes === undefined ? item.notes : input.notes,
                item.code
            )
            .run();
        return c.json(await getItem(db, item.code));
    })

    .post("/:code/actions", async (c) => {
        const db = c.env.DB;
        const item = await getItem(db, c.req.param("code").toUpperCase());
        const input = parse(Action, await body(c.req.raw));
        const rule = ACTIONS[input.action];
        if (rule.from !== "any" && !rule.from.includes(item.status)) {
            throw new HttpError(409, `Not possible while the item is ${STATUS_WORDS[item.status]}.`);
        }
        if (input.action === "note" && !input.note) throw new HttpError(400, "note: Enter a note.");

        const at = now();
        const status = rule.to ? rule.to(item) : item.status;
        const stamp = rule.stamp ? `, ${rule.stamp} = ?` : "";
        const params: unknown[] = [status, ...(rule.stamp ? [at] : []), item.code, item.status];
        const result = await db.batch([
            db.prepare(`UPDATE items SET status = ?${stamp} WHERE code = ? AND status = ?`).bind(...params),
            logItemIfChanged(db, item.code, input.action, c.get("email"), at, null, input.note ?? null),
        ]);
        if (!result[0].meta.changes) throw new HttpError(409, "Someone else just changed this item. Reload and try again.");
        return c.json(await getItem(db, item.code));
    })

    .delete("/:code", async (c) => {
        const db = c.env.DB;
        const item = await getItem(db, c.req.param("code").toUpperCase());
        const used = await db.prepare("SELECT COUNT(*) AS n FROM event_items WHERE item_code = ?").bind(item.code).first<{ n: number }>();
        if (used!.n > 0) throw new HttpError(409, "This item has been to events. Retire it instead, to keep its history.");
        await db.prepare("DELETE FROM items WHERE code = ?").bind(item.code).run();
        return c.body(null, 204);
    });
