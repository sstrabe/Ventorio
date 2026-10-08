import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requireAccess } from "./auth";
import { HttpError } from "./http";
import { events } from "./routes/events";
import { items } from "./routes/items";
import { overview } from "./routes/overview";
import { session } from "./routes/session";
import { templates } from "./routes/templates";
import { types } from "./routes/types";

export const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requireAccess);

app.get("/me", (c) => c.json({ email: c.get("email") }));
app.route("/overview", overview);
app.route("/types", types);
app.route("/items", items);
app.route("/templates", templates);
app.route("/events", events);
app.route("/session", session);

app.notFound((c) => c.json({ error: "Not found." }, 404));

app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
    const message = String((error as Error).message ?? error);
    if (message.includes("UNIQUE constraint failed: items.serial")) {
        return c.json({ error: "Another item already has this serial number." }, 409);
    }
    if (message.includes("UNIQUE constraint failed")) return c.json({ error: "That name is already taken." }, 409);
    if (message.includes("FOREIGN KEY constraint failed")) return c.json({ error: "It's still in use elsewhere." }, 409);
    console.error(error);
    return c.json({ error: "Something went wrong. Try again in a moment." }, 500);
});

export default app satisfies ExportedHandler<AppEnv["Bindings"]>;
