import type { EventStatus, ItemStatus } from "../../shared/types";
import type { Tone } from "../components/ui";

const dateTime = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** An event's start, entered as local time (YYYY-MM-DDTHH:MM). */
export function formatStart(value: string | null): string {
    if (!value) return "No date";
    const [date, time] = value.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return dateTime.format(new Date(y, m - 1, d, hh, mm));
}

export function formatFull(iso: string | null): string {
    return iso ? fullDate.format(new Date(iso)) : "";
}

export function relative(iso: string | null): string {
    if (!iso) return "Never";
    const seconds = (Date.parse(iso) - Date.now()) / 1000;
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ["year", 31_536_000],
        ["month", 2_592_000],
        ["week", 604_800],
        ["day", 86_400],
        ["hour", 3_600],
        ["minute", 60],
    ];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
    }
    return "just now";
}

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
    available: { label: "Available", tone: "success" },
    out: { label: "Out", tone: "info" },
    needs_cleaning: { label: "Needs cleaning", tone: "warning" },
    repair: { label: "In repair", tone: "warning" },
    missing: { label: "Missing", tone: "danger" },
    retired: { label: "Retired", tone: "neutral" },
};

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
    planned: { label: "Planned", tone: "neutral" },
    out: { label: "Out", tone: "info" },
    returned: { label: "Returned", tone: "success" },
};

export const LOG_ACTIONS: Record<string, string> = {
    added: "Added",
    packed: "Packed",
    unpacked: "Taken off the event",
    returned: "Returned",
    missing: "Not returned",
    found: "Found",
    cleaned: "Cleaned",
    maintained: "Maintenance",
    repair: "Sent to repair",
    in_service: "Back in service",
    retire: "Retired",
    note: "Note",
};

/** "ada.lovelace@redcross.org" -> "ada.lovelace" */
export function person(email: string): string {
    return email.split("@")[0];
}

export function itemLabel(item: { name: string | null; type_name: string; code: string }): string {
    return item.name ?? `${item.type_name} ${item.code}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}
