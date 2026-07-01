import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Duck } from "./types";

describe("catalog seed data", () => {
    async function readSeed(): Promise<Duck[]> {
        const filePath = join(process.cwd(), "src", "data", "ducks.json");
        const content = await readFile(filePath, "utf8");
        return JSON.parse(content) as Duck[];
    }

    it("contains at least 10 ducks", async () => {
        const ducks = await readSeed();

        expect(Array.isArray(ducks)).toBe(true);
        expect(ducks.length).toBeGreaterThanOrEqual(10);
    });

    it("contains at least 3 categories", async () => {
        const ducks = await readSeed();

        const categories = new Set(ducks.map((duck) => duck.category));
        expect(categories.size).toBeGreaterThanOrEqual(3);
    });

    it("includes detail fields required for duck detail responses", async () => {
        const ducks = await readSeed();

        for (const duck of ducks) {
            expect(typeof duck.longDescription).toBe("string");
            expect(duck.longDescription.length).toBeGreaterThan(0);
            expect(Array.isArray(duck.personalityTraits)).toBe(true);
            expect(duck.personalityTraits.length).toBeGreaterThan(0);
            expect(Number.isInteger(duck.stockCount)).toBe(true);
            expect(duck.stockCount).toBeGreaterThanOrEqual(0);
        }
    });
});
