export type Duck = {
    id: string;
    name: string;
    category: string;
    priceCents: number;
    tagline: string;
    longDescription: string;
    personalityTraits: string[];
    stockCount: number;
};

export interface CatalogRepository {
    getAll(): Promise<Duck[]>;
    getById(id: string): Promise<Duck | null>;
}
