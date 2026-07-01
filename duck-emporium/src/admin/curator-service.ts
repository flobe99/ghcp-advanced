import { randomUUID } from "node:crypto";

import { LocalJsonCatalogRepository } from "../catalog/catalog-repository";
import type { Duck } from "../catalog/types";

export type AddDuckRequest = {
    name: string;
    category: string;
    priceCents: number;
    tagline: string;
    longDescription: string;
    personalityTraits: string[];
    stockCount: number;
};

export class CuratorServiceError extends Error {
    public constructor(public readonly statusCode: number, message: string) {
        super(message);
    }
}

function slugifyName(value: string): string {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug.length > 0 ? slug : randomUUID().slice(0, 8);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => isNonEmptyString(entry));
}

export class CuratorService {
    public constructor(
        private readonly repository: LocalJsonCatalogRepository,
        private readonly adminPassword: string | undefined
    ) { }

    public async addDuck(request: unknown, providedPassword: string | undefined): Promise<Duck> {
        this.assertAuthorized(providedPassword);

        if (typeof this.adminPassword !== "string" || this.adminPassword.length === 0) {
            throw new CuratorServiceError(500, "ADMIN_PASSWORD is not configured");
        }

        const payload = this.validateRequest(request);
        const existing = await this.repository.getAll();

        const duplicate = existing.find(
            (duck) => duck.name.trim().toLowerCase() === payload.name.trim().toLowerCase()
        );
        if (duplicate) {
            throw new CuratorServiceError(400, "Duck name already exists");
        }

        const id = this.generateUniqueId(payload.name, existing);
        const created: Duck = {
            id,
            name: payload.name.trim(),
            category: payload.category.trim(),
            priceCents: payload.priceCents,
            tagline: payload.tagline.trim(),
            longDescription: payload.longDescription.trim(),
            personalityTraits: payload.personalityTraits.map((trait) => trait.trim()),
            stockCount: payload.stockCount,
        };

        await this.repository.appendDuck(created);
        console.log(`[${new Date().toISOString()}] Curator added duck: ${created.name}`);

        return created;
    }

    private assertAuthorized(providedPassword: string | undefined): void {
        if (!providedPassword || providedPassword !== this.adminPassword) {
            throw new CuratorServiceError(401, "Unauthorized");
        }
    }

    private validateRequest(request: unknown): AddDuckRequest {
        if (typeof request !== "object" || request === null) {
            throw new CuratorServiceError(400, "Request body must be an object");
        }

        const payload = request as Partial<AddDuckRequest>;

        if (!isNonEmptyString(payload.name)) {
            throw new CuratorServiceError(400, "name is required");
        }
        if (!isNonEmptyString(payload.category)) {
            throw new CuratorServiceError(400, "category is required");
        }
        if (!isNonNegativeInteger(payload.priceCents)) {
            throw new CuratorServiceError(400, "priceCents must be a non-negative integer");
        }
        if (!isNonEmptyString(payload.tagline)) {
            throw new CuratorServiceError(400, "tagline is required");
        }
        if (!isNonEmptyString(payload.longDescription)) {
            throw new CuratorServiceError(400, "longDescription is required");
        }
        if (!isStringArray(payload.personalityTraits) || payload.personalityTraits.length === 0) {
            throw new CuratorServiceError(400, "personalityTraits must be a non-empty array of strings");
        }
        if (!isNonNegativeInteger(payload.stockCount)) {
            throw new CuratorServiceError(400, "stockCount must be a non-negative integer");
        }

        return {
            name: payload.name,
            category: payload.category,
            priceCents: payload.priceCents,
            tagline: payload.tagline,
            longDescription: payload.longDescription,
            personalityTraits: payload.personalityTraits,
            stockCount: payload.stockCount,
        };
    }

    private generateUniqueId(name: string, existing: Duck[]): string {
        const base = `duck-${slugifyName(name)}`;
        if (!existing.some((duck) => duck.id === base)) {
            return base;
        }

        let counter = 2;
        while (existing.some((duck) => duck.id === `${base}-${counter}`)) {
            counter += 1;
        }

        return `${base}-${counter}`;
    }
}
