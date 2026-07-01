import type { CatalogRepository } from "../catalog/types";

export type CartItem = {
    duckId: string;
    name: string;
    priceCents: number;
    quantity: number;
    lineTotalCents: number;
};

export type CartSnapshot = {
    items: CartItem[];
    totalCents: number;
};

export class CartServiceError extends Error {
    public constructor(public readonly statusCode: number, message: string) {
        super(message);
    }
}

export class CartService {
    private readonly carts = new Map<string, Map<string, number>>();

    public constructor(private readonly repository: CatalogRepository) { }

    public async getCart(sessionId: string): Promise<CartSnapshot> {
        return this.buildSnapshot(this.getOrCreateSessionCart(sessionId));
    }

    public async addItem(sessionId: string, duckId: string, quantity = 1): Promise<CartSnapshot> {
        this.validateQuantity(quantity);

        const duck = await this.requireDuck(duckId);
        const cart = this.getOrCreateSessionCart(sessionId);
        const current = cart.get(duckId) ?? 0;
        const nextQuantity = current + quantity;

        if (nextQuantity > duck.stockCount) {
            throw new CartServiceError(400, "Requested quantity exceeds available stock");
        }

        cart.set(duckId, nextQuantity);
        return this.buildSnapshot(cart);
    }

    public async updateItem(sessionId: string, duckId: string, quantity: number): Promise<CartSnapshot> {
        this.validateQuantity(quantity);

        const duck = await this.requireDuck(duckId);
        const cart = this.getOrCreateSessionCart(sessionId);

        if (!cart.has(duckId)) {
            throw new CartServiceError(404, "Cart item not found");
        }

        if (quantity > duck.stockCount) {
            throw new CartServiceError(400, "Requested quantity exceeds available stock");
        }

        cart.set(duckId, quantity);
        return this.buildSnapshot(cart);
    }

    public async removeItem(sessionId: string, duckId: string): Promise<CartSnapshot> {
        const cart = this.getOrCreateSessionCart(sessionId);
        cart.delete(duckId);
        return this.buildSnapshot(cart);
    }

    public async clearCart(sessionId: string): Promise<CartSnapshot> {
        const cart = this.getOrCreateSessionCart(sessionId);
        cart.clear();
        return this.buildSnapshot(cart);
    }

    private getOrCreateSessionCart(sessionId: string): Map<string, number> {
        const existing = this.carts.get(sessionId);
        if (existing) {
            return existing;
        }

        const created = new Map<string, number>();
        this.carts.set(sessionId, created);
        return created;
    }

    private async buildSnapshot(cart: Map<string, number>): Promise<CartSnapshot> {
        const items: CartItem[] = [];

        for (const [duckId, quantity] of cart.entries()) {
            const duck = await this.repository.getById(duckId);
            if (!duck) {
                continue;
            }

            items.push({
                duckId,
                name: duck.name,
                priceCents: duck.priceCents,
                quantity,
                lineTotalCents: duck.priceCents * quantity,
            });
        }

        const totalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
        return { items, totalCents };
    }

    private validateQuantity(quantity: number): void {
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new CartServiceError(400, "quantity must be a positive integer");
        }
    }

    private async requireDuck(duckId: string) {
        const duck = await this.repository.getById(duckId);
        if (!duck) {
            throw new CartServiceError(404, "Duck not found");
        }
        return duck;
    }
}
