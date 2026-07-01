import { describe, expect, it } from "vitest";

import { DuckOfTheDayService, DUCK_OF_THE_DAY_EMPTY_MESSAGE } from "./duck-of-the-day-service";
import type { CatalogRepository, Duck } from "./types";

function createRepository(ducks: Duck[]): CatalogRepository {
    return {
        async getAll(): Promise<Duck[]> {
            return ducks;
        },
        async getById(id: string): Promise<Duck | null> {
            return ducks.find((duck) => duck.id === id) ?? null;
        },
    };
}

describe("DuckOfTheDayService", () => {
    it("returns same duck for the same day", async () => {
        const ducks: Duck[] = [
            {
                id: "duck-a",
                name: "Alpha",
                category: "Classic",
                priceCents: 1000,
                tagline: "A",
                longDescription: "A",
                personalityTraits: ["calm"],
                stockCount: 2,
            },
            {
                id: "duck-b",
                name: "Beta",
                category: "Tech",
                priceCents: 1100,
                tagline: "B",
                longDescription: "B",
                personalityTraits: ["bold"],
                stockCount: 2,
            },
        ];

        const service = new DuckOfTheDayService(createRepository(ducks));
        const date = new Date("2026-06-30T10:00:00.000Z");

        const first = await service.getDuckOfTheDay(date);
        const second = await service.getDuckOfTheDay(date);

        expect(first.duck?.id).toBeDefined();
        expect(first.duck?.id).toBe(second.duck?.id);
    });

    it("returns a different duck on the next day when multiple ducks are in stock", async () => {
        const ducks: Duck[] = [
            {
                id: "duck-a",
                name: "Alpha",
                category: "Classic",
                priceCents: 1000,
                tagline: "A",
                longDescription: "A",
                personalityTraits: ["calm"],
                stockCount: 2,
            },
            {
                id: "duck-b",
                name: "Beta",
                category: "Tech",
                priceCents: 1100,
                tagline: "B",
                longDescription: "B",
                personalityTraits: ["bold"],
                stockCount: 2,
            },
            {
                id: "duck-c",
                name: "Gamma",
                category: "Nautical",
                priceCents: 1200,
                tagline: "C",
                longDescription: "C",
                personalityTraits: ["steady"],
                stockCount: 2,
            },
        ];

        const service = new DuckOfTheDayService(createRepository(ducks));
        const dayOne = await service.getDuckOfTheDay(new Date("2026-06-30T10:00:00.000Z"));
        const dayTwo = await service.getDuckOfTheDay(new Date("2026-07-01T10:00:00.000Z"));

        expect(dayOne.duck?.id).toBeDefined();
        expect(dayTwo.duck?.id).toBeDefined();
        expect(dayOne.duck?.id).not.toBe(dayTwo.duck?.id);
    });

    it("skips sold-out ducks and returns fallback when all are sold out", async () => {
        const oneInStock: Duck[] = [
            {
                id: "duck-a",
                name: "Alpha",
                category: "Classic",
                priceCents: 1000,
                tagline: "A",
                longDescription: "A",
                personalityTraits: ["calm"],
                stockCount: 0,
            },
            {
                id: "duck-b",
                name: "Beta",
                category: "Tech",
                priceCents: 1100,
                tagline: "B",
                longDescription: "B",
                personalityTraits: ["bold"],
                stockCount: 2,
            },
        ];

        const service = new DuckOfTheDayService(createRepository(oneInStock));
        const featured = await service.getDuckOfTheDay(new Date("2026-06-30T10:00:00.000Z"));
        expect(featured.duck?.id).toBe("duck-b");

        const allSoldOut = oneInStock.map((duck) => ({ ...duck, stockCount: 0 }));
        const emptyService = new DuckOfTheDayService(createRepository(allSoldOut));
        await expect(emptyService.getDuckOfTheDay()).resolves.toEqual({
            emptyState: {
                message: DUCK_OF_THE_DAY_EMPTY_MESSAGE,
            },
        });
    });
});
