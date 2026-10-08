import { describe, expect, it } from "vitest";
import { CODE_PATTERN, newCode, parseScan } from "../shared/codes";
import { packingList, scaledQuantity } from "../shared/packing";

describe("scaledQuantity", () => {
    it("rounds per-attendee amounts up", () => {
        expect(scaledQuantity({ amount: 0.5, per_attendee: true }, 7)).toBe(4);
        expect(scaledQuantity({ amount: 1, per_attendee: true }, 12)).toBe(12);
    });

    it("doesn't add a unit for float noise", () => {
        expect(0.28 * 25).toBeGreaterThan(7);
        expect(scaledQuantity({ amount: 0.28, per_attendee: true }, 25)).toBe(7);
    });

    it("uses the amount as-is per event", () => {
        expect(scaledQuantity({ amount: 2, per_attendee: false }, 40)).toBe(2);
        expect(scaledQuantity({ amount: 1.5, per_attendee: false }, 40)).toBe(2);
    });

    it("needs nothing per attendee when nobody attends", () => {
        expect(scaledQuantity({ amount: 1, per_attendee: true }, 0)).toBe(0);
    });
});

describe("packingList", () => {
    const template = [
        { type_id: 1, amount: 0.5, per_attendee: true },
        { type_id: 2, amount: 1, per_attendee: false },
    ];

    it("scales the template", () => {
        expect(packingList(template, 6, [])).toEqual([
            { type_id: 1, quantity: 3, manual: false },
            { type_id: 2, quantity: 1, manual: false },
        ]);
    });

    it("keeps manual lines, including extras and zeroes", () => {
        const manual = [
            { type_id: 2, quantity: 0, manual: true },
            { type_id: 3, quantity: 5, manual: true },
        ];
        expect(packingList(template, 6, manual)).toEqual([
            { type_id: 1, quantity: 3, manual: false },
            { type_id: 2, quantity: 0, manual: true },
            { type_id: 3, quantity: 5, manual: true },
        ]);
    });
});

describe("label codes", () => {
    it("generates codes from the Crockford alphabet", () => {
        for (let i = 0; i < 200; i++) expect(newCode()).toMatch(CODE_PATTERN);
    });

    it("reads Ventorio URLs from any host", () => {
        expect(parseScan("https://ventorio.example.org/t/ab12cd")).toEqual({ code: "AB12CD" });
        expect(parseScan("http://localhost:5173/items/K7Q2XM/")).toEqual({ code: "K7Q2XM" });
    });

    it("ignores other URLs", () => {
        expect(parseScan("https://example.org/products/123")).toBeNull();
    });

    it("reads the first version's JSON labels by serial", () => {
        expect(parseScan('{"type":"Adult manikin","serial":"PP-0042"}')).toEqual({ serial: "PP-0042" });
    });

    it("folds look-alike characters in bare codes and keeps the serial as a fallback", () => {
        expect(parseScan(" k7q2xo ")).toEqual({ code: "K7Q2X0", serial: "k7q2xo" });
    });

    it("treats anything else as a serial", () => {
        expect(parseScan("SN 12345-B")).toEqual({ serial: "SN 12345-B" });
        expect(parseScan("   ")).toBeNull();
    });
});
