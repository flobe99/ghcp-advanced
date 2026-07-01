import { describe, expect, it } from "vitest";

import { DuckDetailService } from "./duck-detail-service";
import type { CatalogRepository, Duck } from "./types";

function createRepository(duck: Duck | null): CatalogRepository {
    return {
        async getAll(): Promise<Duck[]> {
            return duck ? [duck] : [];
        },
        async getById(id: string): Promise<Duck | null> {
            return duck && duck.id === id ? duck : null;
        },
    };
}

describe("DuckDetailService", () => {
    const baseDuck: Duck = {
        id: "duck-1",
        name: "Debug Duck",
        category: "Classic",
        priceCents: 1299,
        tagline: "Squeaks through your stack traces.",
        longDescription: "A legendary debugging companion for long coding sessions.",
        personalityTraits: ["curious", "calm"],
        stockCount: 3,
    };

    it("returns In stock for stockCount >= 3", async () => {
        const service = new DuckDetailService(createRepository({ ...baseDuck, stockCount: 4 }));

        await expect(service.getById("duck-1")).resolves.toMatchObject({
            stockLevel: "In stock",
        });
    });

    it("returns Only 2 left for stockCount 1 or 2", async () => {
        const service = new DuckDetailService(createRepository({ ...baseDuck, stockCount: 2 }));

        await expect(service.getById("duck-1")).resolves.toMatchObject({
            stockLevel: "Only 2 left",
        });
    });

    it("returns Sold out for stockCount 0", async () => {
        const service = new DuckDetailService(createRepository({ ...baseDuck, stockCount: 0 }));

        await expect(service.getById("duck-1")).resolves.toMatchObject({
            stockLevel: "Sold out",
        });
    });

    it("returns null when duck does not exist", async () => {
        const service = new DuckDetailService(createRepository(null));

        await expect(service.getById("missing-duck")).resolves.toBeNull();
    });
});
