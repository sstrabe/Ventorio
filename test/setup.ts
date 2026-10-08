import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Each test starts from an empty database.
const TABLES = ["scan_sessions", "supply_log", "item_log", "event_items", "event_lines", "items", "events", "template_lines", "templates", "item_types"];

beforeEach(async () => {
    await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
});
