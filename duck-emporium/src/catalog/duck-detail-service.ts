import type { CatalogRepository } from "./types";

export type DuckDetail = {
    id: string;
    name: string;
    category: string;
    priceCents: number;
    tagline: string;
    longDescription: string;
    personalityTraits: string[];
    stockLevel: "In stock" | "Only 2 left" | "Sold out";
};

function mapStockLevel(stockCount: number): DuckDetail["stockLevel"] {
    if (stockCount === 0) {
        return "Sold out";
    }
    if (stockCount <= 2) {
        return "Only 2 left";
    }
    return "In stock";
}

export class DuckDetailService {
    public constructor(private readonly repository: CatalogRepository) { }

    public async getById(id: string): Promise<DuckDetail | null> {
        const duck = await this.repository.getById(id);
        if (!duck) {
            return null;
        }

        return {
            id: duck.id,
            name: duck.name,
            category: duck.category,
            priceCents: duck.priceCents,
            tagline: duck.tagline,
            longDescription: duck.longDescription,
            personalityTraits: duck.personalityTraits,
            stockLevel: mapStockLevel(duck.stockCount),
        };
    }
}
