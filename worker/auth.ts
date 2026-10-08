import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "./env";
import { HttpError } from "./http";

// Cloudflare Access sits in front of the whole app and signs every request it
// lets through. The Worker verifies that signature, so the API can't be reached
// around Access (e.g. through a workers.dev URL Access doesn't cover).

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keySet(teamDomain: string) {
    let set = keySets.get(teamDomain);
    if (!set) {
        set = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
        keySets.set(teamDomain, set);
    }
    return set;
}

function isLocal(url: string): boolean {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
}

export const requireAccess = createMiddleware<AppEnv>(async (c, next) => {
    const team = c.env.ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const aud = c.env.ACCESS_AUD;

    if (!team || !aud) {
        // Fail closed: without Access configured only local development works.
        if (!c.env.DEV_USER_EMAIL || !isLocal(c.req.url)) {
            throw new HttpError(503, "Cloudflare Access isn't configured (ACCESS_TEAM_DOMAIN and ACCESS_AUD).");
        }
        c.set("email", c.env.DEV_USER_EMAIL.toLowerCase());
        return next();
    }

    const token = c.req.header("Cf-Access-Jwt-Assertion") ?? getCookie(c, "CF_Authorization");
    if (!token) throw new HttpError(401, "Sign in through Cloudflare Access.");

    let email: unknown;
    try {
        const { payload } = await jwtVerify(token, keySet(team), {
            issuer: `https://${team}`,
            audience: aud,
        });
        email = payload.email;
    } catch {
        throw new HttpError(401, "Your sign-in has expired. Reload the page to sign in again.");
    }
    if (typeof email !== "string" || !email) {
        throw new HttpError(403, "Only people can use Ventorio, not service tokens.");
    }

    c.set("email", email.toLowerCase());
    return next();
});
