import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
    }
}

const RELOAD_KEY = "ventorio:reauth";

/**
 * Call the API. When Cloudflare Access ends the session, requests are
 * redirected to its sign-in page (or rejected with 401): reload once, so
 * Access can sign the person in again.
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
        method: options.method ?? "GET",
        headers: options.body === undefined ? undefined : { "content-type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "same-origin",
        redirect: "manual",
    });

    if (res.type === "opaqueredirect" || res.status === 401) {
        let last = 0;
        try {
            last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
            sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {
            // storage blocked: reload anyway
        }
        if (Date.now() - last > 30_000) window.location.reload();
        throw new ApiError(401, "Your sign-in has expired. Reload the page to sign in again.");
    }
    if (res.status === 204) return undefined as T;

    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `Something went wrong (${res.status}). Try again in a moment.`);
    return data as T;
}

export interface Loaded<T> {
    data: T | undefined;
    error: string | undefined;
    loading: boolean;
    reload: () => void;
    setData: (data: T) => void;
}

/** Load a GET endpoint; keeps the previous data while reloading, so nothing flickers. */
export function useApi<T>(path: string | null): Loaded<T> {
    const [data, setData] = useState<T>();
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (path === null) return;
        let cancelled = false;
        setLoading(true);
        api<T>(path)
            .then((result) => {
                if (cancelled) return;
                setData(result);
                setError(undefined);
            })
            .catch((e: Error) => !cancelled && setError(e.message))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [path, version]);

    const reload = useCallback(() => setVersion((v) => v + 1), []);
    return { data, error, loading, reload, setData };
}
