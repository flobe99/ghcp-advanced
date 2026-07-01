import type { CatalogRepository, Duck } from "./types";

export type DuckOfTheDayResult = {
    duck?: Duck;
    emptyState?: {
        message: string;
    };
};

const FALLBACK_MESSAGE = "The pond is empty today, come back tomorrow.";

function dayIndex(date: Date): number {
    return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

export class DuckOfTheDayService {
    public constructor(private readonly repository: CatalogRepository) { }

    public async getDuckOfTheDay(date: Date = new Date()): Promise<DuckOfTheDayResult> {
        const ducks = await this.repository.getAll();
        const inStock = ducks
            .filter((duck) => duck.stockCount > 0)
            .sort((a, b) => a.id.localeCompare(b.id));

        if (inStock.length === 0) {
            return {
                emptyState: {
                    message: FALLBACK_MESSAGE,
                },
            };
        }

        const index = dayIndex(date) % inStock.length;
        return { duck: inStock[index] };
    }
}

export { FALLBACK_MESSAGE as DUCK_OF_THE_DAY_EMPTY_MESSAGE };
