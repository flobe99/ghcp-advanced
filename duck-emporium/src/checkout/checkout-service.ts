import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import type { LocalJsonCatalogRepository, StockAdjustment } from "../catalog/catalog-repository";
import type { CartItem } from "../cart/cart-service";
import { CartService, CartServiceError } from "../cart/cart-service";

export type CheckoutRequest = {
    shippingName: string;
    email: string;
    address: string;
    cardHolder: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
};

export type CardPaymentSummary = {
    method: "card";
    cardLast4: string;
};

export type OrderRecord = {
    orderId: string;
    createdAt: string;
    shippingName: string;
    email: string;
    address: string;
    payment: CardPaymentSummary;
    items: CartItem[];
    totalCents: number;
};

export class CheckoutServiceError extends Error {
    public constructor(public readonly statusCode: number, message: string) {
        super(message);
    }
}

export class CheckoutService {
    public constructor(
        private readonly cartService: CartService,
        private readonly catalogRepository: LocalJsonCatalogRepository,
        private readonly ordersFilePath: string
    ) { }

    public async checkout(sessionId: string, request: CheckoutRequest): Promise<OrderRecord> {
        this.validateRequest(request);

        const cart = await this.cartService.getCart(sessionId);
        if (cart.items.length === 0) {
            throw new CheckoutServiceError(400, "Cart is empty");
        }

        const adjustments: StockAdjustment[] = cart.items.map((item) => ({
            duckId: item.duckId,
            quantity: item.quantity,
        }));

        try {
            await this.catalogRepository.decrementStockAtomically(adjustments);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Checkout stock validation failed";
            if (message.startsWith("Insufficient stock")) {
                throw new CheckoutServiceError(400, "One or more cart items are out of stock");
            }
            if (message.startsWith("Duck not found")) {
                throw new CheckoutServiceError(404, "Duck not found during checkout");
            }
            throw new CheckoutServiceError(500, "Failed to validate stock during checkout");
        }

        const order: OrderRecord = {
            orderId: `ord_${randomUUID()}`,
            createdAt: new Date().toISOString(),
            shippingName: request.shippingName.trim(),
            email: request.email.trim(),
            address: request.address.trim(),
            payment: {
                method: "card",
                cardLast4: this.getCardLast4(request.cardNumber),
            },
            items: cart.items,
            totalCents: cart.totalCents,
        };

        await this.persistOrder(order);
        await this.cartService.clearCart(sessionId);

        return order;
    }

    private validateRequest(request: CheckoutRequest): void {
        const required: Array<keyof CheckoutRequest> = [
            "shippingName",
            "email",
            "address",
            "cardHolder",
            "cardNumber",
            "cardExpiry",
            "cardCvc",
        ];

        for (const field of required) {
            const value = request[field];
            if (typeof value !== "string" || value.trim().length === 0) {
                throw new CheckoutServiceError(400, `${field} is required`);
            }
        }

        if (!/^\S+@\S+\.\S+$/.test(request.email.trim())) {
            throw new CheckoutServiceError(400, "email is invalid");
        }
    }

    private getCardLast4(cardNumber: string): string {
        const normalized = cardNumber.replace(/\s+/g, "").trim();
        return normalized.slice(-4);
    }

    private async persistOrder(order: OrderRecord): Promise<void> {
        const raw = await readFile(this.ordersFilePath, "utf8");
        const parsed = JSON.parse(raw) as unknown;

        if (!Array.isArray(parsed)) {
            throw new CartServiceError(500, "orders.json must be an array");
        }

        const orders = parsed as OrderRecord[];
        orders.push(order);

        await writeFile(this.ordersFilePath, `${JSON.stringify(orders, null, 4)}\n`, "utf8");
    }
}
