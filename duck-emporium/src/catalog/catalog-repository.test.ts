import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { LocalJsonCatalogRepository } from "./catalog-repository";

describe("LocalJsonCatalogRepository", () => {
    it("returns validated ducks for a valid JSON file", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-catalog-"));
        try {
            const filePath = join(testDir, "ducks.json");
            await writeFile(
                filePath,
                JSON.stringify([
                    {
                        id: "duck-1",
                        name: "Debug Duck",
                        category: "Classic",
                        priceCents: 1299,
                        tagline: "Squeaks through your stack traces.",
                        longDescription: "A legendary debugging companion for long coding sessions.",
                        personalityTraits: ["curious", "calm"],
                        stockCount: 8,
                    },
                ])
            );

            const repository = new LocalJsonCatalogRepository(filePath);

            await expect(repository.getAll()).resolves.toEqual([
                {
                    id: "duck-1",
                    name: "Debug Duck",
                    category: "Classic",
                    priceCents: 1299,
                    tagline: "Squeaks through your stack traces.",
                    longDescription: "A legendary debugging companion for long coding sessions.",
                    personalityTraits: ["curious", "calm"],
                    stockCount: 8,
                },
            ]);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("throws a validation error when a row is malformed", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-catalog-"));
        try {
            const filePath = join(testDir, "ducks.json");
            await writeFile(
                filePath,
                JSON.stringify([
                    {
                        id: "duck-2",
                        name: "",
                        category: "Classic",
                        priceCents: 999,
                        tagline: "Broken payload",
                        longDescription: "Broken row",
                        personalityTraits: ["noisy"],
                        stockCount: 1,
                    },
                ])
            );

            const repository = new LocalJsonCatalogRepository(filePath);

            await expect(repository.getAll()).rejects.toThrow(
                "Invalid duck at index 0: name must be a non-empty string"
            );
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("returns a duck by id and null for unknown ids", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-catalog-"));
        try {
            const filePath = join(testDir, "ducks.json");
            await writeFile(
                filePath,
                JSON.stringify([
                    {
                        id: "duck-1",
                        name: "Debug Duck",
                        category: "Classic",
                        priceCents: 1299,
                        tagline: "Squeaks through your stack traces.",
                        longDescription: "A legendary debugging companion for long coding sessions.",
                        personalityTraits: ["curious", "calm"],
                        stockCount: 8,
                    },
                ])
            );

            const repository = new LocalJsonCatalogRepository(filePath);

            await expect(repository.getById("duck-1")).resolves.toEqual({
                id: "duck-1",
                name: "Debug Duck",
                category: "Classic",
                priceCents: 1299,
                tagline: "Squeaks through your stack traces.",
                longDescription: "A legendary debugging companion for long coding sessions.",
                personalityTraits: ["curious", "calm"],
                stockCount: 8,
            });

            await expect(repository.getById("missing-id")).resolves.toBeNull();
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});
