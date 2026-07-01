import { describe, expect, it } from "vitest";

import { CatalogService } from "./catalog-service";
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

describe("CatalogService", () => {
    const ducks: Duck[] = [
        {
            id: "duck-1",
            name: "Debug Duck",
            category: "Classic",
            priceCents: 1299,
            tagline: "Squeaks through your stack traces.",
            longDescription: "A legendary debugging companion for long coding sessions.",
            personalityTraits: ["curious", "calm"],
            stockCount: 7,
        },
        {
            id: "duck-2",
            name: "Captain Quack",
            category: "Nautical",
            priceCents: 2199,
            tagline: "Commands the bathtub fleet.",
            longDescription: "A strategic navigator for deep philosophical currents.",
            personalityTraits: ["brave", "steady"],
            stockCount: 4,
        },
        {
            id: "duck-3",
            name: "Pixel Quacker",
            category: "Tech",
            priceCents: 1899,
            tagline: "Compiled for maximum squeak speed.",
            longDescription: "Talks in snippets and helps with cloud systems.",
            personalityTraits: ["fast", "inventive"],
            stockCount: 5,
        },
    ];

    it("returns ducks without emptyState when catalog has entries", async () => {
        const repository = createRepository([ducks[0]]);
        const service = new CatalogService(repository);

        await expect(service.getCatalog()).resolves.toEqual({
            ducks: [
                {
                    id: "duck-1",
                    name: "Debug Duck",
                    category: "Classic",
                    priceCents: 1299,
                    tagline: "Squeaks through your stack traces.",
                    longDescription: "A legendary debugging companion for long coding sessions.",
                    personalityTraits: ["curious", "calm"],
                    stockCount: 7,
                },
            ],
        });
    });

    it("returns explicit emptyState when catalog is empty", async () => {
        const repository = createRepository([]);
        const service = new CatalogService(repository);

        await expect(service.getCatalog()).resolves.toEqual({
            ducks: [],
            emptyState: {
                message: "No ducks available right now. Please check back soon.",
            },
        });
    });

    it("matches free text across name, tagline and description case-insensitively", async () => {
        const service = new CatalogService(createRepository(ducks));

        const byName = await service.getCatalog({ queryText: "debug" });
        const byTagline = await service.getCatalog({ queryText: "BATHTUB FLEET" });
        const byDescription = await service.getCatalog({ queryText: "cloud systems" });

        expect(byName.ducks.map((duck) => duck.id)).toEqual(["duck-1"]);
        expect(byTagline.ducks.map((duck) => duck.id)).toEqual(["duck-2"]);
        expect(byDescription.ducks.map((duck) => duck.id)).toEqual(["duck-3"]);
    });

    it("filters by one or more categories", async () => {
        const service = new CatalogService(createRepository(ducks));

        const oneCategory = await service.getCatalog({ categories: ["Nautical"] });
        const twoCategories = await service.getCatalog({ categories: ["Classic", "Tech"] });

        expect(oneCategory.ducks.map((duck) => duck.id)).toEqual(["duck-2"]);
        expect(twoCategories.ducks.map((duck) => duck.id)).toEqual(["duck-1", "duck-3"]);
    });

    it("filters by optional min and max price", async () => {
        const service = new CatalogService(createRepository(ducks));

        const minOnly = await service.getCatalog({ minPriceCents: 1800 });
        const maxOnly = await service.getCatalog({ maxPriceCents: 1800 });
        const range = await service.getCatalog({ minPriceCents: 1500, maxPriceCents: 2000 });

        expect(minOnly.ducks.map((duck) => duck.id)).toEqual(["duck-2", "duck-3"]);
        expect(maxOnly.ducks.map((duck) => duck.id)).toEqual(["duck-1"]);
        expect(range.ducks.map((duck) => duck.id)).toEqual(["duck-3"]);
    });

    it("composes filters and returns existential emptyState when nothing matches", async () => {
        const service = new CatalogService(createRepository(ducks));

        const composed = await service.getCatalog({
            queryText: "cloud",
            categories: ["Tech"],
            minPriceCents: 1800,
            maxPriceCents: 1900,
        });

        expect(composed.ducks.map((duck) => duck.id)).toEqual(["duck-3"]);

        await expect(
            service.getCatalog({ queryText: "existential", categories: ["Classic"], minPriceCents: 5000 })
        ).resolves.toEqual({
            ducks: [],
            emptyState: {
                message: "No duck matches your existential criteria.",
            },
        });
    });
});
