import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { logItemIfChanged } from "../worker/db";
import { app } from "../worker/index";
import type { EventDetail, Item, ItemType, Overview, ScanResult, ScanSession, Template } from "../shared/types";

async function api<T = unknown>(method: string, path: string, body?: unknown, bindings: object = env) {
    const res = await app.request(
        `/api${path}`,
        {
            method,
            headers: body === undefined ? {} : { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
        bindings
    );
    const data = res.status === 204 ? null : await res.json();
    return { status: res.status, data: data as T };
}

async function ok<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { status, data } = await api<T>(method, path, body);
    if (status >= 300) throw new Error(`${method} ${path} -> ${status}: ${JSON.stringify(data)}`);
    return data;
}

/** A small first-aid setup: manikins (cleaned after use), an AED trainer, face shields. */
async function seed() {
    const manikin = await ok<ItemType>("POST", "/types", { name: "Adult manikin", kind: "equipment", needs_cleaning: true });
    const aed = await ok<ItemType>("POST", "/types", { name: "AED trainer", kind: "equipment" });
    const shields = await ok<ItemType>("POST", "/types", { name: "Face shield", kind: "supply", stock: 100, reorder_at: 20 });
    const { codes: manikins } = await ok<{ codes: string[] }>("POST", "/items", { type_id: manikin.id, count: 3 });
    const { codes: aeds } = await ok<{ codes: string[] }>("POST", "/items", { type_id: aed.id, serial: "AED-0001" });
    const template = await ok<Template>("POST", "/templates", {
        name: "Adult First Aid/CPR/AED",
        lines: [
            { type_id: manikin.id, amount: 0.5, per_attendee: true },
            { type_id: aed.id, amount: 1, per_attendee: false },
            { type_id: shields.id, amount: 1, per_attendee: true },
        ],
    });
    return { manikin, aed, shields, manikins, aed1: aeds[0], template };
}

function quantities(event: EventDetail) {
    return Object.fromEntries(event.lines.map((l) => [l.type_name, l.quantity]));
}

describe("packing lists", () => {
    it("scale with attendees and keep hand-set lines", async () => {
        const { template, shields } = await seed();
        let event = await ok<EventDetail>("POST", "/events", { name: "CPR class", attendees: 5, template_id: template.id });
        expect(quantities(event)).toEqual({ "Adult manikin": 3, "AED trainer": 1, "Face shield": 5 });

        event = await ok("PATCH", `/events/${event.id}`, { attendees: 7 });
        expect(quantities(event)).toEqual({ "Adult manikin": 4, "AED trainer": 1, "Face shield": 7 });

        event = await ok("PUT", `/events/${event.id}/lines/${shields.id}`, { quantity: 10 });
        event = await ok("PATCH", `/events/${event.id}`, { attendees: 9 });
        expect(quantities(event)).toEqual({ "Adult manikin": 5, "AED trainer": 1, "Face shield": 10 });

        event = await ok("DELETE", `/events/${event.id}/lines/${shields.id}`);
        expect(quantities(event)["Face shield"]).toBe(9);
    });

    it("follow template edits while the event is planned", async () => {
        const { template, manikin } = await seed();
        const event = await ok<EventDetail>("POST", "/events", { name: "CPR class", attendees: 6, template_id: template.id });
        await ok("PUT", `/templates/${template.id}`, {
            name: template.name,
            lines: [{ type_id: manikin.id, amount: 1, per_attendee: true }],
        });
        expect(quantities(await ok(`GET`, `/events/${event.id}`))).toEqual({ "Adult manikin": 6 });
    });
});

describe("pack and return", () => {
    it("runs the whole loop", async () => {
        const { template, manikins, aed1, shields } = await seed();
        const event = await ok<EventDetail>("POST", "/events", { name: "CPR class", attendees: 4, template_id: template.id });

        // A tapped tag (/t/<code> on any host) lands in the open session.
        await ok<ScanSession>("PUT", "/session", { event_id: event.id, mode: "pack" });
        const tapped = await ok<{ result: ScanResult }>("POST", "/session/scan", { value: `https://ventorio.example.org/t/${manikins[0]}` });
        expect(tapped.result).toMatchObject({ outcome: "packed", tone: "success" });

        const again = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "pack", value: manikins[0] });
        expect(again.outcome).toBe("already");

        await ok("POST", `/events/${event.id}/scan`, { mode: "pack", value: manikins[1] });
        // Legacy label: JSON with the serial.
        const aed = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "pack", value: '{"type":"AED","serial":"AED-0001"}' });
        expect(aed.outcome).toBe("packed");

        const extra = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "pack", value: manikins[2] });
        expect(extra).toMatchObject({ outcome: "packed", tone: "warning" });
        await ok("DELETE", `/events/${event.id}/items/${manikins[2]}`);
        expect((await ok<{ item: Item }>("GET", `/items/${manikins[2]}`)).item.status).toBe("available");

        const packed = await ok<EventDetail>("POST", `/events/${event.id}/pack`, { supplies: [{ type_id: shields.id, count: 6 }] });
        expect(packed.status).toBe("out");
        expect(await ok("GET", "/session")).toBeNull();
        const second = await api("POST", `/events/${event.id}/pack`, { supplies: [] });
        expect(second.status).toBe(409);
        expect((await ok<ItemType[]>("GET", "/types")).find((t) => t.id === shields.id)?.stock).toBe(94);

        // Return: manikins need cleaning, the AED trainer doesn't, one manikin never comes back.
        const back = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "return", value: manikins[0] });
        expect(back).toMatchObject({ outcome: "returned", tone: "warning" });
        expect(back.item?.status).toBe("needs_cleaning");
        const aedBack = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "return", value: aed1 });
        expect(aedBack.item?.status).toBe("available");
        const stranger = await ok<ScanResult>("POST", `/events/${event.id}/scan`, { mode: "return", value: manikins[2] });
        expect(stranger.outcome).toBe("rejected");

        const done = await ok<EventDetail>("POST", `/events/${event.id}/return`, { supplies: [{ type_id: shields.id, back: 2 }] });
        expect(done.status).toBe("returned");
        expect((await ok<ItemType[]>("GET", "/types")).find((t) => t.id === shields.id)?.stock).toBe(96);
        const lost = await ok<{ item: Item; log: { action: string }[] }>("GET", `/items/${manikins[1]}`);
        expect(lost.item.status).toBe("missing");
        expect(lost.log.map((l) => l.action)).toEqual(["missing", "packed", "added"]);

        const overview = await ok<Overview>("GET", "/overview");
        expect(overview.attention.map((a) => a.kind).sort()).toEqual(["missing", "needs_cleaning"]);
    });

    it("rejects dirty or busy equipment and lets cleaning fix it", async () => {
        const { manikin, manikins } = await seed();
        const first = await ok<EventDetail>("POST", "/events", { name: "Monday", attendees: 2, lines: [{ type_id: manikin.id, quantity: 1 }] });
        const second = await ok<EventDetail>("POST", "/events", { name: "Tuesday", attendees: 2, lines: [{ type_id: manikin.id, quantity: 1 }] });

        await ok("POST", `/events/${first.id}/scan`, { mode: "pack", value: manikins[0] });
        const busy = await ok<ScanResult>("POST", `/events/${second.id}/scan`, { mode: "pack", value: manikins[0] });
        expect(busy).toMatchObject({ outcome: "rejected", message: "Adult manikin is packed for Monday." });

        await ok("POST", `/events/${first.id}/pack`, {});
        await ok("POST", `/events/${first.id}/scan`, { mode: "return", value: manikins[0] });
        await ok("POST", `/events/${first.id}/return`, {});

        const dirty = await ok<ScanResult>("POST", `/events/${second.id}/scan`, { mode: "pack", value: manikins[0] });
        expect(dirty).toMatchObject({ outcome: "rejected", fix: "clean" });
        await ok("POST", `/items/${manikins[0]}/actions`, { action: "cleaned" });
        const clean = await ok<ScanResult>("POST", `/events/${second.id}/scan`, { mode: "pack", value: manikins[0] });
        expect(clean.outcome).toBe("packed");
    });

    it("finds missing equipment when it's scanned again", async () => {
        const { aed, aed1 } = await seed();
        const first = await ok<EventDetail>("POST", "/events", { name: "Lost it", attendees: 1, lines: [{ type_id: aed.id, quantity: 1 }] });
        await ok("POST", `/events/${first.id}/scan`, { mode: "pack", value: aed1 });
        await ok("POST", `/events/${first.id}/pack`, {});
        await ok("POST", `/events/${first.id}/return`, {});

        const next = await ok<EventDetail>("POST", "/events", { name: "Found it", attendees: 1, lines: [{ type_id: aed.id, quantity: 1 }] });
        const found = await ok<ScanResult>("POST", `/events/${next.id}/scan`, { mode: "pack", value: aed1 });
        expect(found).toMatchObject({ outcome: "packed", message: "Found and packed AED trainer." });
    });

    it("refuses more supplies back than went out", async () => {
        const { shields } = await seed();
        const event = await ok<EventDetail>("POST", "/events", { name: "Shields", attendees: 3, lines: [{ type_id: shields.id, quantity: 3 }] });
        await ok("POST", `/events/${event.id}/pack`, {});
        const res = await api<{ error: string }>("POST", `/events/${event.id}/return`, { supplies: [{ type_id: shields.id, back: 4 }] });
        expect(res).toEqual({ status: 400, data: { error: "More Face shield came back than went out (3)." } });
    });
});

describe("inventory", () => {
    it("flags low supplies and tracks restocks and counts", async () => {
        const { shields } = await seed();
        await ok("POST", `/types/${shields.id}/stock`, { mode: "count", amount: 15 });
        expect((await ok<Overview>("GET", "/overview")).attention).toEqual([
            { kind: "low_stock", label: "Face shield: 15 left", href: "/inventory?tab=supplies" },
        ]);
        const restocked = await ok<ItemType>("POST", `/types/${shields.id}/stock`, { mode: "restock", amount: 50 });
        expect(restocked.stock).toBe(65);
    });

    it("adds many items at once and finds them by code", async () => {
        const { aed } = await seed();
        const { codes } = await ok<{ codes: string[] }>("POST", "/items", { type_id: aed.id, count: 150 });
        expect(new Set(codes).size).toBe(150);
        const found = await ok<Item[]>("GET", `/items?codes=${codes.join(",")}`);
        expect(found).toHaveLength(150);
        expect((await ok<ItemType[]>("GET", "/types")).find((t) => t.id === aed.id)?.total).toBe(151);
    });

    it("explains conflicts in words", async () => {
        const { manikin } = await seed();
        expect(await api("POST", "/types", { name: "adult MANIKIN", kind: "equipment" })).toEqual({
            status: 409,
            data: { error: "That name is already taken." },
        });
        expect((await api("DELETE", `/types/${manikin.id}`)).status).toBe(409);
        expect(await api("POST", "/items", { type_id: manikin.id, serial: "AED-0001" })).toEqual({
            status: 409,
            data: { error: "Another item already has this serial number." },
        });
    });
});

describe("race guards", () => {
    it("only log when the statement before changed a row", async () => {
        const { manikins } = await seed();
        const db = env.DB;
        const code = manikins[0];
        await db.batch([
            db.prepare("UPDATE items SET status = 'repair' WHERE code = ? AND status = 'out'").bind(code),
            logItemIfChanged(db, code, "lost-race", "x@example.org", "2026-01-01T00:00:00Z"),
            db.prepare("UPDATE items SET status = 'repair' WHERE code = ? AND status = 'available'").bind(code),
            logItemIfChanged(db, code, "won-race", "x@example.org", "2026-01-01T00:00:00Z"),
        ]);
        const log = await db.prepare("SELECT action FROM item_log WHERE item_code = ? ORDER BY id").bind(code).all();
        expect(log.results.map((r) => r.action)).toEqual(["added", "won-race"]);
    });
});

describe("access", () => {
    it("fails closed when Access isn't configured", async () => {
        const res = await api("GET", "/me", undefined, { ...env, DEV_USER_EMAIL: undefined });
        expect(res.status).toBe(503);
    });

    it("ignores the development identity anywhere but localhost", async () => {
        const res = await app.request("https://ventorio.example.org/api/me", {}, env);
        expect(res.status).toBe(503);
    });

    it("requires an Access token once Access is configured", async () => {
        const res = await api("GET", "/me", undefined, { ...env, ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com", ACCESS_AUD: "aud" });
        expect(res).toEqual({ status: 401, data: { error: "Sign in through Cloudflare Access." } });
    });

    it("rejects a forged token", async () => {
        const res = await app.request(
            "/api/me",
            { headers: { "Cf-Access-Jwt-Assertion": "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImFAYi5jIn0." } },
            { ...env, ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com", ACCESS_AUD: "aud" }
        );
        expect(res.status).toBe(401);
    });

    it("uses the development identity locally", async () => {
        expect(await ok("GET", "/me")).toEqual({ email: "tester@example.org" });
    });
});
