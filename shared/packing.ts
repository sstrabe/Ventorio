export interface TemplateLine {
    type_id: number;
    amount: number;
    per_attendee: boolean;
}

/**
 * How many of a type an event needs: `amount` per attendee (rounded up), or
 * `amount` once per event. The epsilon keeps float noise from adding a unit:
 * 0.1 * 30 is 3.0000000000000004, which must stay 3.
 */
export function scaledQuantity(line: Pick<TemplateLine, "amount" | "per_attendee">, attendees: number): number {
    const raw = line.per_attendee ? line.amount * attendees : line.amount;
    return Math.max(0, Math.ceil(raw - 1e-9));
}

export interface PackingLine {
    type_id: number;
    quantity: number;
    manual: boolean;
}

/**
 * The packing list for an event: the template scaled to the attendee count,
 * with lines edited by hand (manual) kept as they are, including manual lines
 * for types the template doesn't list. A manual quantity of 0 removes a line
 * the template would add.
 */
export function packingList(template: TemplateLine[], attendees: number, manual: PackingLine[]): PackingLine[] {
    const lines = new Map<number, PackingLine>();
    for (const line of template) {
        lines.set(line.type_id, { type_id: line.type_id, quantity: scaledQuantity(line, attendees), manual: false });
    }
    for (const line of manual) {
        if (line.manual) lines.set(line.type_id, { ...line });
    }
    return [...lines.values()];
}
