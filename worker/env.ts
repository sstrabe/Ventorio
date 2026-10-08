export interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
    /** Cloudflare Access team domain, e.g. "redcross-ops.cloudflareaccess.com". */
    ACCESS_TEAM_DOMAIN?: string;
    /** Audience (AUD) tag of the Access application protecting Ventorio. */
    ACCESS_AUD?: string;
    /** Local development only (.dev.vars): act as this person, skipping Access. */
    DEV_USER_EMAIL?: string;
}

export interface AppEnv {
    Bindings: Env;
    Variables: { email: string };
}
