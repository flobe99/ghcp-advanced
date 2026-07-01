import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LocalJsonCatalogRepository } from "../catalog/catalog-repository";
import { CartService } from "../cart/cart-service";
import { CheckoutService } from "./checkout-service";

const baseDucks = [
    {
        id: "duck-001",
        name: "Debugger Duck",
        category: "Classic",
        priceCents: 1299,
        tagline: "Finds bugs by staring at them.",
        longDescription: "A debugger companion.",
        personalityTraits: ["patient"],
        stockCount: 3,
    },
];

describe("CheckoutService", () => {
    it("creates an order, decrements stock and clears cart", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-checkout-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, JSON.stringify(baseDucks, null, 4));
            await writeFile(ordersPath, "[]");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);

            await cartService.addItem("session-a", "duck-001", 2);
            const order = await checkoutService.checkout("session-a", {
                shippingName: "Quincy Quacker",
                email: "quincy@example.com",
                address: "42 Duck Lake Road",
                cardHolder: "Quincy Quacker",
                cardNumber: "4111111111111111",
                cardExpiry: "12/30",
                cardCvc: "123",
            });

            expect(order.orderId).toContain("ord_");
            expect(order.items).toHaveLength(1);
            expect(order.totalCents).toBe(2598);
            expect(order.payment).toEqual({ method: "card", cardLast4: "1111" });

            const cart = await cartService.getCart("session-a");
            expect(cart.items).toEqual([]);

            const ducksRaw = await readFile(ducksPath, "utf8");
            const ducks = JSON.parse(ducksRaw);
            expect(ducks[0].stockCount).toBe(1);

            const ordersRaw = await readFile(ordersPath, "utf8");
            const orders = JSON.parse(ordersRaw);
            expect(orders).toHaveLength(1);
            expect(orders[0].payment).toEqual({ method: "card", cardLast4: "1111" });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("supports mocked card payment with non-digit card strings", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-checkout-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, JSON.stringify(baseDucks, null, 4));
            await writeFile(ordersPath, "[]");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);

            await cartService.addItem("session-a", "duck-001", 1);

            const order = await checkoutService.checkout("session-a", {
                shippingName: "Quincy Quacker",
                email: "quincy@example.com",
                address: "42 Duck Lake Road",
                cardHolder: "Quincy Quacker",
                cardNumber: "CARD-MOCK-ABCD",
                cardExpiry: "12/30",
                cardCvc: "XYZ",
            });

            expect(order.payment).toEqual({ method: "card", cardLast4: "ABCD" });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("rejects invalid email", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-checkout-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, JSON.stringify(baseDucks, null, 4));
            await writeFile(ordersPath, "[]");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);

            await cartService.addItem("session-a", "duck-001", 1);

            await expect(
                checkoutService.checkout("session-a", {
                    shippingName: "Quincy Quacker",
                    email: "invalid-email",
                    address: "42 Duck Lake Road",
                    cardHolder: "Quincy Quacker",
                    cardNumber: "4111111111111111",
                    cardExpiry: "12/30",
                    cardCvc: "123",
                })
            ).rejects.toMatchObject({ statusCode: 400, message: "email is invalid" });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("rejects checkout when stock is no longer sufficient", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-checkout-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, JSON.stringify(baseDucks, null, 4));
            await writeFile(ordersPath, "[]");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);

            await cartService.addItem("session-a", "duck-001", 2);
            await repository.decrementStockAtomically([{ duckId: "duck-001", quantity: 2 }]);

            await expect(
                checkoutService.checkout("session-a", {
                    shippingName: "Quincy Quacker",
                    email: "quincy@example.com",
                    address: "42 Duck Lake Road",
                    cardHolder: "Quincy Quacker",
                    cardNumber: "4111111111111111",
                    cardExpiry: "12/30",
                    cardCvc: "123",
                })
            ).rejects.toMatchObject({
                statusCode: 400,
                message: "One or more cart items are out of stock",
            });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});
