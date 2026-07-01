import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalJsonCatalogRepository } from "../catalog/catalog-repository";
import { CuratorService, CuratorServiceError } from "./curator-service";

function validRequest() {
    return {
        name: "Philosopher Duck",
        category: "Mindful",
        priceCents: 1999,
        tagline: "Contemplates every ripple.",
        longDescription: "A duck for deep thoughts and calm debugging.",
        personalityTraits: ["reflective", "calm"],
        stockCount: 5,
    };
}

describe("CuratorService", () => {
    it("creates a duck when admin password and payload are valid", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "curator-service-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            await writeFile(ducksPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const service = new CuratorService(repository, "secret");
            const created = await service.addDuck(validRequest(), "secret");

            expect(created.id).toContain("duck-");
            expect(created.name).toBe("Philosopher Duck");

            const persistedRaw = await readFile(ducksPath, "utf8");
            const persisted = JSON.parse(persistedRaw) as Array<{ name: string }>;
            expect(persisted).toHaveLength(1);
            expect(persisted[0].name).toBe("Philosopher Duck");
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("rejects missing or wrong admin password", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "curator-service-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            await writeFile(ducksPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const service = new CuratorService(repository, "secret");

            await expect(service.addDuck(validRequest(), undefined)).rejects.toMatchObject<CuratorServiceError>({
                statusCode: 401,
                message: "Unauthorized",
            });

            await expect(service.addDuck(validRequest(), "wrong")).rejects.toMatchObject<CuratorServiceError>({
                statusCode: 401,
                message: "Unauthorized",
            });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("rejects duplicate names and invalid values", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "curator-service-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            await writeFile(
                ducksPath,
                JSON.stringify([
                    {
                        id: "duck-existing",
                        name: "Philosopher Duck",
                        category: "Mindful",
                        priceCents: 1999,
                        tagline: "Already here.",
                        longDescription: "Already in flock.",
                        personalityTraits: ["calm"],
                        stockCount: 2,
                    },
                ])
            );

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const service = new CuratorService(repository, "secret");

            await expect(service.addDuck(validRequest(), "secret")).rejects.toMatchObject<CuratorServiceError>({
                statusCode: 400,
                message: "Duck name already exists",
            });

            await expect(
                service.addDuck({ ...validRequest(), priceCents: -1 }, "secret")
            ).rejects.toMatchObject<CuratorServiceError>({
                statusCode: 400,
                message: "priceCents must be a non-negative integer",
            });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});
