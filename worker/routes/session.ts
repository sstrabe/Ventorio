import { Hono } from "hono";
import { z } from "zod";
import { parseScan } from "../../shared/codes";
import type { ScanSession } from "../../shared/types";
import type { AppEnv } from "../env";
import { getEvent } from "../db";
import { body, HttpError, now, parse } from "../http";
import { scan } from "./scan";

// A scan session says which event a person is packing or returning right now,
// so tapping a tag with the phone (which opens /t/<code>) lands in that event.

const SESSION_HOURS = 12;

const StartSession = z.object({
    event_id: z.number().int().positive(),
    mode: z.enum(["pack", "return"]),
});

const SessionScan = z.object({ value: z.string().min(1).max(500) });

export async function getSession(db: D1Database, email: string): Promise<ScanSession | null> {
    const session = await db
        .prepare(
            `SELECT s.event_id, e.name AS event_name, s.mode, s.updated_at
             FROM scan_sessions s JOIN events e ON e.id = s.event_id
             WHERE s.email = ?`
        )
        .bind(email)
        .first<ScanSession>();
    if (!session) return null;
    if (Date.now() - Date.parse(session.updated_at) > SESSION_HOURS * 3600_000) return null;
    return session;
}

export const session = new Hono<AppEnv>()
    .get("/", async (c) => c.json(await getSession(c.env.DB, c.get("email"))))

    .put("/", async (c) => {
        const input = parse(StartSession, await body(c.req.raw));
        const db = c.env.DB;
        const event = await getEvent(db, input.event_id);
        const expected = input.mode === "pack" ? "planned" : "out";
        if (event.status !== expected) {
            throw new HttpError(409, input.mode === "pack" ? "This event is already packed." : "This event isn't out.");
        }
        await db
            .prepare(
                `INSERT INTO scan_sessions (email, event_id, mode, updated_at) VALUES (?, ?, ?, ?)
                 ON CONFLICT (email) DO UPDATE SET event_id = excluded.event_id, mode = excluded.mode, updated_at = excluded.updated_at`
            )
            .bind(c.get("email"), event.id, input.mode, now())
            .run();
        return c.json(await getSession(db, c.get("email")));
    })

    .delete("/", async (c) => {
        await c.env.DB.prepare("DELETE FROM scan_sessions WHERE email = ?").bind(c.get("email")).run();
        return c.body(null, 204);
    })

    /** Record a tapped tag in the person's open session, if they have one. */
    .post("/scan", async (c) => {
        const input = parse(SessionScan, await body(c.req.raw));
        const db = c.env.DB;
        const email = c.get("email");
        const current = await getSession(db, email);
        if (!current) return c.json({ session: null, result: null });
        const target = parseScan(input.value);
        if (!target) throw new HttpError(400, "That isn't a Ventorio label.");
        const result = await scan(db, current.event_id, current.mode, target, email);
        await db.prepare("UPDATE scan_sessions SET updated_at = ? WHERE email = ?").bind(now(), email).run();
        return c.json({ session: current, result });
    });
