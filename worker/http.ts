import type { z } from "zod";

export class HttpError extends Error {
    constructor(
        readonly status: 400 | 401 | 403 | 404 | 409 | 503,
        message: string
    ) {
        super(message);
    }
}

export function notFound(what: string): HttpError {
    return new HttpError(404, `${what} not found.`);
}

/** Validate a request body; the first problem becomes a 400 with a readable message. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const issue = result.error.issues[0];
    const field = issue.path.join(".");
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue.message);
}

export async function body(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        throw new HttpError(400, "The request body must be JSON.");
    }
}

export function now(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function id(value: string): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, "Not found.");
    return n;
}
