import { describe, expect, it } from "vitest";

import { fib } from "./hello";

describe("fib", () => {
    it("returns base cases", async () => {
        await expect(fib(0)).resolves.toBe(0);
        await expect(fib(1)).resolves.toBe(1);
    });

    it("returns the correct Fibonacci number", async () => {
        await expect(fib(7)).resolves.toBe(13);
    });

    it("throws for non-integer values", async () => {
        await expect(fib(1.5)).rejects.toThrow(TypeError);
    });

    it("throws for non-finite values", async () => {
        await expect(fib(Number.POSITIVE_INFINITY)).rejects.toThrow(TypeError);
    });

    it("throws for negative values", async () => {
        await expect(fib(-1)).rejects.toThrow(RangeError);
    });
});
