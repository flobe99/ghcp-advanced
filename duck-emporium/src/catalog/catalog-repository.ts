import { readFile, writeFile } from "node:fs/promises";

import type { CatalogRepository, Duck } from "./types";

type RawDuck = Partial<Duck>;

export type StockAdjustment = {
    duckId: string;
    quantity: number;
};

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => isNonEmptyString(entry));
}

function validateDuck(raw: RawDuck, index: number): Duck {
    if (!isNonEmptyString(raw.id)) {
        throw new Error(`Invalid duck at index ${index}: id must be a non-empty string`);
    }
    if (!isNonEmptyString(raw.name)) {
        throw new Error(`Invalid duck at index ${index}: name must be a non-empty string`);
    }
    if (!isNonEmptyString(raw.category)) {
        throw new Error(`Invalid duck at index ${index}: category must be a non-empty string`);
    }
    if (!isNonNegativeInteger(raw.priceCents)) {
        throw new Error(`Invalid duck at index ${index}: priceCents must be a non-negative integer`);
    }
    if (!isNonEmptyString(raw.tagline)) {
        throw new Error(`Invalid duck at index ${index}: tagline must be a non-empty string`);
    }
    if (!isNonEmptyString(raw.longDescription)) {
        throw new Error(`Invalid duck at index ${index}: longDescription must be a non-empty string`);
    }
    if (!isStringArray(raw.personalityTraits)) {
        throw new Error(`Invalid duck at index ${index}: personalityTraits must be an array of non-empty strings`);
    }
    if (!isNonNegativeInteger(raw.stockCount)) {
        throw new Error(`Invalid duck at index ${index}: stockCount must be a non-negative integer`);
    }

    return {
        id: raw.id,
        name: raw.name,
        category: raw.category,
        priceCents: raw.priceCents,
        tagline: raw.tagline,
        longDescription: raw.longDescription,
        personalityTraits: raw.personalityTraits,
        stockCount: raw.stockCount,
    };
}

export class LocalJsonCatalogRepository implements CatalogRepository {
    public constructor(private readonly filePath: string) { }

    public async getAll(): Promise<Duck[]> {
        return this.loadValidatedDucks();
    }

    public async appendDuck(newDuck: Duck): Promise<void> {
        const ducks = await this.loadValidatedDucks();
        if (ducks.some((duck) => duck.id === newDuck.id)) {
            throw new Error(`Duck id already exists: ${newDuck.id}`);
        }

        ducks.push(newDuck);
        await writeFile(this.filePath, `${JSON.stringify(ducks, null, 4)}\n`, "utf8");
    }

    public async getById(id: string): Promise<Duck | null> {
        const ducks = await this.getAll();
        return ducks.find((duck) => duck.id === id) ?? null;
    }

    public async decrementStockAtomically(adjustments: StockAdjustment[]): Promise<void> {
        const ducks = await this.loadValidatedDucks();

        for (const adjustment of adjustments) {
            if (!isNonNegativeInteger(adjustment.quantity) || adjustment.quantity === 0) {
                throw new Error("Stock adjustment quantity must be a positive integer");
            }

            const duck = ducks.find((item) => item.id === adjustment.duckId);
            if (!duck) {
                throw new Error(`Duck not found: ${adjustment.duckId}`);
            }

            if (duck.stockCount < adjustment.quantity) {
                throw new Error(`Insufficient stock for duck ${adjustment.duckId}`);
            }
        }

        const updated = ducks.map((duck) => {
            const adjustment = adjustments.find((item) => item.duckId === duck.id);
            if (!adjustment) {
                return duck;
            }

            return {
                ...duck,
                stockCount: duck.stockCount - adjustment.quantity,
            };
        });

        await writeFile(this.filePath, `${JSON.stringify(updated, null, 4)}\n`, "utf8");
    }

    private async loadValidatedDucks(): Promise<Duck[]> {
        const rawContent = await readFile(this.filePath, "utf8");
        const parsed = JSON.parse(rawContent) as unknown;

        if (!Array.isArray(parsed)) {
            throw new Error("Catalog JSON must be an array of ducks");
        }

        return parsed.map((entry, index) => validateDuck(entry as RawDuck, index));
    }
}
