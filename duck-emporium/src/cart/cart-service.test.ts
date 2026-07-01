import { describe, expect, it } from "vitest";

import { CartService } from "./cart-service";
import type { CatalogRepository, Duck } from "../catalog/types";

const ducks: Duck[] = [
    {
        id: "duck-1",
        name: "Debug Duck",
        category: "Classic",
        priceCents: 1000,
        tagline: "Debug all the things.",
        longDescription: "A great debugging companion.",
        personalityTraits: ["calm"],
        stockCount: 5,
    },
    {
        id: "duck-2",
        name: "Sprint Duck",
        category: "Classic",
        priceCents: 2000,
        tagline: "Always ready.",
        longDescription: "A duck for fast teams.",
        personalityTraits: ["focused"],
        stockCount: 2,
    },
];

const repository: CatalogRepository = {
    async getAll(): Promise<Duck[]> {
        return ducks;
    },
    async getById(id: string): Promise<Duck | null> {
        return ducks.find((duck) => duck.id === id) ?? null;
    },
};

describe("CartService", () => {
    it("adds items and calculates running total", async () => {
        const service = new CartService(repository);

        await service.addItem("s1", "duck-1");
        const cart = await service.addItem("s1", "duck-2", 2);

        expect(cart.items).toHaveLength(2);
        expect(cart.totalCents).toBe(5000);
    });

    it("updates and removes items", async () => {
        const service = new CartService(repository);

        await service.addItem("s1", "duck-1", 2);
        const updated = await service.updateItem("s1", "duck-1", 3);
        expect(updated.items[0].quantity).toBe(3);

        const emptied = await service.removeItem("s1", "duck-1");
        expect(emptied.items).toEqual([]);
        expect(emptied.totalCents).toBe(0);
    });

    it("rejects quantities above stock", async () => {
        const service = new CartService(repository);

        await expect(service.addItem("s1", "duck-2", 3)).rejects.toMatchObject({
            statusCode: 400,
            message: "Requested quantity exceeds available stock",
        });
    });

    it("preserves cart per session", async () => {
        const service = new CartService(repository);

        await service.addItem("session-a", "duck-1", 1);
        await service.addItem("session-b", "duck-2", 1);

        const cartA = await service.getCart("session-a");
        const cartB = await service.getCart("session-b");

        expect(cartA.items).toHaveLength(1);
        expect(cartA.items[0].duckId).toBe("duck-1");
        expect(cartB.items[0].duckId).toBe("duck-2");
    });
});
