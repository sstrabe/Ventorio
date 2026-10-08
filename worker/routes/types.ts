import { Hono } from "hono";
import { z } from "zod";
import type { ItemStatus, ItemType } from "../../shared/types";
import type { AppEnv } from "../env";
import { body, HttpError, id, notFound, now, parse } from "../http";

const name = z.string().trim().min(1, "Enter a name.").max(80);

const CreateType = z.object({
    name,
    kind: z.enum(["equipment", "supply"]),
    needs_cleaning: z.boolean().default(false),
    stock: z.number().int().min(0).default(0),
    reorder_at: z.number().int().min(0).nullable().default(null),
});

const UpdateType = z.object({
    name: name.optional(),
    needs_cleaning: z.boolean().optional(),
    reorder_at: z.number().int().min(0).nullable().optional(),
});

const Stock = z.object({
    mode: z.enum(["restock", "count"]),
    amount: z.number().int().min(0).max(1_000_000),
});

type TypeRow = Omit<ItemType, "needs_cleaning" | "counts" | "total"> & { needs_cleaning: number };

export async function listTypes(db: D1Database): Promise<ItemType[]> {
    const [types, counts] = await db.batch([
        db.prepare("SELECT id, name, kind, needs_cleaning, stock, reorder_at FROM item_types ORDER BY kind, name"),
        db.prepare("SELECT type_id, status, COUNT(*) AS n FROM items GROUP BY type_id, status"),
    ]);
    const byType = new Map<number, Partial<Record<ItemStatus, number>>>();
    for (const row of counts.results as { type_id: number; status: ItemStatus; n: number }[]) {
        const entry = byType.get(row.type_id) ?? {};
        entry[row.status] = row.n;
        byType.set(row.type_id, entry);
    }
    return (types.results as TypeRow[]).map((t) => {
        const c = byType.get(t.id) ?? {};
        const total = Object.entries(c).reduce((sum, [status, n]) => (status === "retired" ? sum : sum + (n ?? 0)), 0);
        return { ...t, needs_cleaning: t.needs_cleaning === 1, counts: c, total };
    });
}

async function getType(db: D1Database, typeId: number): Promise<ItemType> {
    const type = (await listTypes(db)).find((t) => t.id === typeId);
    if (!type) throw notFound("Type");
    return type;
}

export const types = new Hono<AppEnv>()
    .get("/", async (c) => c.json(await listTypes(c.env.DB)))

    .post("/", async (c) => {
        const input = parse(CreateType, await body(c.req.raw));
        const db = c.env.DB;
        const row = await db
            .prepare("INSERT INTO item_types (name, kind, needs_cleaning, stock, reorder_at) VALUES (?, ?, ?, ?, ?) RETURNING id")
            .bind(
                input.name,
                input.kind,
                input.kind === "equipment" && input.needs_cleaning ? 1 : 0,
                input.kind === "supply" ? input.stock : 0,
                input.kind === "supply" ? input.reorder_at : null
            )
            .first<{ id: number }>();
        if (input.kind === "supply" && input.stock > 0) {
            await db
                .prepare("INSERT INTO supply_log (type_id, delta, reason, by, at) VALUES (?, ?, 'count', ?, ?)")
                .bind(row!.id, input.stock, c.get("email"), now())
                .run();
        }
        return c.json(await getType(db, row!.id), 201);
    })

    .patch("/:id", async (c) => {
        const typeId = id(c.req.param("id"));
        const input = parse(UpdateType, await body(c.req.raw));
        const current = await getType(c.env.DB, typeId);
        await c.env.DB.prepare("UPDATE item_types SET name = ?, needs_cleaning = ?, reorder_at = ? WHERE id = ?")
            .bind(
                input.name ?? current.name,
                current.kind === "equipment" && (input.needs_cleaning ?? current.needs_cleaning) ? 1 : 0,
                current.kind === "supply" ? (input.reorder_at === undefined ? current.reorder_at : input.reorder_at) : null,
                typeId
            )
            .run();
        return c.json(await getType(c.env.DB, typeId));
    })

    .delete("/:id", async (c) => {
        const typeId = id(c.req.param("id"));
        const db = c.env.DB;
        const used = await db
            .prepare(
                `SELECT (SELECT COUNT(*) FROM items WHERE type_id = ?) AS items,
                        (SELECT COUNT(*) FROM event_lines l JOIN events e ON e.id = l.event_id
                          WHERE l.type_id = ? AND e.status != 'returned') AS open_lines`
            )
            .bind(typeId, typeId)
            .first<{ items: number; open_lines: number }>();
        if (used!.items > 0) throw new HttpError(409, "This type still has equipment, so it can't be deleted.");
        if (used!.open_lines > 0) throw new HttpError(409, "An event that isn't returned yet still lists this type.");
        const result = await db.prepare("DELETE FROM item_types WHERE id = ?").bind(typeId).run();
        if (!result.meta.changes) throw notFound("Type");
        return c.body(null, 204);
    })

    .post("/:id/stock", async (c) => {
        const typeId = id(c.req.param("id"));
        const input = parse(Stock, await body(c.req.raw));
        const db = c.env.DB;
        const type = await getType(db, typeId);
        if (type.kind !== "supply") throw new HttpError(400, "Only supplies have a stock level.");
        const delta = input.mode === "restock" ? input.amount : input.amount - type.stock;
        if (delta !== 0) {
            await db.batch([
                db.prepare("UPDATE item_types SET stock = stock + ? WHERE id = ?").bind(delta, typeId),
                db
                    .prepare("INSERT INTO supply_log (type_id, delta, reason, by, at) VALUES (?, ?, ?, ?, ?)")
                    .bind(typeId, delta, input.mode, c.get("email"), now()),
            ]);
        }
        return c.json(await getType(db, typeId));
    });
