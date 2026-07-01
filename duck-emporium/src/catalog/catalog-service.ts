import type { CatalogRepository, Duck } from "./types";

export type EmptyState = {
    message: string;
};

export type CatalogResult = {
    ducks: Duck[];
    emptyState?: EmptyState;
};

export type CatalogFilters = {
    queryText?: string;
    categories?: string[];
    minPriceCents?: number;
    maxPriceCents?: number;
};

export class CatalogService {
    public constructor(private readonly repository: CatalogRepository) { }

    public async getCatalog(filters: CatalogFilters = {}): Promise<CatalogResult> {
        const ducks = await this.repository.getAll();
        const filtered = this.applyFilters(ducks, filters);

        if (filtered.length === 0) {
            const hasActiveFilters = this.hasActiveFilters(filters);
            return {
                ducks: filtered,
                emptyState: {
                    message: hasActiveFilters
                        ? "No duck matches your existential criteria."
                        : "No ducks available right now. Please check back soon.",
                },
            };
        }

        return { ducks: filtered };
    }

    private applyFilters(ducks: Duck[], filters: CatalogFilters): Duck[] {
        const normalizedText = filters.queryText?.trim().toLowerCase() ?? "";
        const normalizedCategories = new Set(
            (filters.categories ?? [])
                .map((category) => category.trim().toLowerCase())
                .filter((category) => category.length > 0)
        );

        return ducks.filter((duck) => {
            if (normalizedText.length > 0) {
                const haystack = [duck.name, duck.tagline, duck.longDescription]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(normalizedText)) {
                    return false;
                }
            }

            if (normalizedCategories.size > 0) {
                const duckCategory = duck.category.trim().toLowerCase();
                if (!normalizedCategories.has(duckCategory)) {
                    return false;
                }
            }

            if (typeof filters.minPriceCents === "number" && duck.priceCents < filters.minPriceCents) {
                return false;
            }

            if (typeof filters.maxPriceCents === "number" && duck.priceCents > filters.maxPriceCents) {
                return false;
            }

            return true;
        });
    }

    private hasActiveFilters(filters: CatalogFilters): boolean {
        if (filters.queryText && filters.queryText.trim().length > 0) {
            return true;
        }

        if ((filters.categories ?? []).some((category) => category.trim().length > 0)) {
            return true;
        }

        return typeof filters.minPriceCents === "number" || typeof filters.maxPriceCents === "number";
    }
}
