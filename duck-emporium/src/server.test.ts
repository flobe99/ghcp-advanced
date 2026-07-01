import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CatalogService } from "./catalog/catalog-service";
import { LocalJsonCatalogRepository } from "./catalog/catalog-repository";
import { DuckDetailService } from "./catalog/duck-detail-service";
import { DuckOfTheDayService } from "./catalog/duck-of-the-day-service";
import type { CatalogRepository, Duck } from "./catalog/types";
import { CartService } from "./cart/cart-service";
import { CheckoutService } from "./checkout/checkout-service";
import { CuratorService } from "./admin/curator-service";
import { QuizService } from "./quiz/quiz-service";
import { createCatalogHandler } from "./server";

type CatalogResponse = {
    ducks: Duck[];
    emptyState?: {
        message: string;
    };
};

type DuckDetailResponse = {
    id: string;
    name: string;
    category: string;
    priceCents: number;
    tagline: string;
    longDescription: string;
    personalityTraits: string[];
    stockLevel: "In stock" | "Only 2 left" | "Sold out";
};

type DuckOfTheDayResponse = {
    duck?: Duck;
    emptyState?: {
        message: string;
    };
};

type QuizQuestionsResponse = {
    questions: Array<{
        id: string;
        prompt: string;
        options: Array<{
            id: string;
            text: string;
        }>;
    }>;
};

type QuizResultResponse = {
    duck: {
        id: string;
        name: string;
        category: string;
        priceCents: number;
        tagline: string;
    };
    message: string;
    detailPath: string;
    tieBreakRule: string;
};

type ErrorResponse = {
    error: string;
};

type CartItemResponse = {
    duckId: string;
    name: string;
    priceCents: number;
    quantity: number;
    lineTotalCents: number;
};

type CartResponse = {
    items: CartItemResponse[];
    totalCents: number;
};

type CheckoutResponse = {
    orderId: string;
    createdAt: string;
    payment: {
        method: "card";
        cardLast4: string;
    };
    items: CartItemResponse[];
    totalCents: number;
};

type RequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    cookie?: string;
};

function createFallbackCheckoutService(): CheckoutService {
    const ducksPath = fileURLToPath(new URL("./data/ducks.json", import.meta.url));
    const ordersPath = fileURLToPath(new URL("./data/orders.json", import.meta.url));
    const repository = new LocalJsonCatalogRepository(ducksPath);
    const cartService = new CartService(repository);
    return new CheckoutService(cartService, repository, ordersPath);
}

function createCheckoutRequest(email = "quincy@example.com") {
    return {
        shippingName: "Quincy Quacker",
        email,
        address: "42 Duck Lake Road",
        cardHolder: "Quincy Quacker",
        cardNumber: "4111111111111111",
        cardExpiry: "12/30",
        cardCvc: "123",
    };
}

async function requestPath<T>(
    handler: ReturnType<typeof createCatalogHandler>,
    path: string,
    options: RequestOptions = {}
): Promise<{ status: number; body: T; setCookie: string | null }> {
    const server = createServer((request, response) => {
        void handler(request, response);
    });

    await new Promise<void>((resolve) => {
        server.listen(0, resolve);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Server address is not available");
    }

    try {
        const headers: Record<string, string> = {
            "content-type": "application/json",
        };
        if (options.cookie) {
            headers.cookie = options.cookie;
        }

        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
            method: options.method ?? "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const body = (await response.json()) as T;
        return { status: response.status, body, setCookie: response.headers.get("set-cookie") };
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
}

describe("GET /api/ducks", () => {
    it("returns ducks from local JSON storage", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<CatalogResponse>(handler, "/api/ducks");

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.ducks)).toBe(true);
        expect(response.body.ducks.length).toBeGreaterThan(0);

        const firstDuck = response.body.ducks[0];
        expect(firstDuck).toHaveProperty("name");
        expect(firstDuck).toHaveProperty("category");
        expect(firstDuck).toHaveProperty("priceCents");
        expect(firstDuck).toHaveProperty("tagline");
    });

    it("returns explicit emptyState when no ducks exist", async () => {
        const emptyRepository: CatalogRepository = {
            async getAll(): Promise<Duck[]> {
                return [];
            },
            async getById(): Promise<Duck | null> {
                return null;
            },
        };
        const catalogService = new CatalogService(emptyRepository);
        const detailService = new DuckDetailService(emptyRepository);
        const cartService = new CartService(emptyRepository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<CatalogResponse>(handler, "/api/ducks");

        expect(response.status).toBe(200);
        expect(response.body.ducks).toEqual([]);
        expect(response.body.emptyState).toEqual({
            message: "No ducks available right now. Please check back soon.",
        });
    });

    it("returns a full duck detail record for a valid id", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<DuckDetailResponse>(handler, "/api/ducks/duck-002");

        expect(response.status).toBe(200);
        expect(response.body.id).toBe("duck-002");
        expect(response.body).toHaveProperty("name");
        expect(response.body).toHaveProperty("category");
        expect(response.body).toHaveProperty("priceCents");
        expect(response.body).toHaveProperty("tagline");
        expect(response.body).toHaveProperty("longDescription");
        expect(response.body).toHaveProperty("personalityTraits");
        expect(response.body).toHaveProperty("stockLevel");
    });

    it("returns 404 for unknown duck id", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<ErrorResponse>(handler, "/api/ducks/does-not-exist");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Duck not found" });
    });

    it("returns a deterministic duck of the day and skips sold-out ducks", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-of-day-api-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(
                ducksPath,
                JSON.stringify(
                    [
                        {
                            id: "duck-a",
                            name: "Alpha",
                            category: "Classic",
                            priceCents: 1000,
                            tagline: "A",
                            longDescription: "A",
                            personalityTraits: ["calm"],
                            stockCount: 0,
                        },
                        {
                            id: "duck-b",
                            name: "Beta",
                            category: "Tech",
                            priceCents: 1100,
                            tagline: "B",
                            longDescription: "B",
                            personalityTraits: ["bold"],
                            stockCount: 3,
                        },
                    ],
                    null,
                    4
                )
            );
            await writeFile(ordersPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const catalogService = new CatalogService(repository);
            const detailService = new DuckDetailService(repository);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);
            const duckOfTheDayService = new DuckOfTheDayService(repository);
            const handler = createCatalogHandler(
                catalogService,
                detailService,
                cartService,
                checkoutService,
                undefined,
                duckOfTheDayService
            );

            const first = await requestPath<DuckOfTheDayResponse>(handler, "/api/ducks/of-the-day");
            const second = await requestPath<DuckOfTheDayResponse>(handler, "/api/ducks/of-the-day");

            expect(first.status).toBe(200);
            expect(first.body.duck?.id).toBe("duck-b");
            expect(second.body.duck?.id).toBe("duck-b");
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("returns friendly fallback when all ducks are sold out", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-of-day-api-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(
                ducksPath,
                JSON.stringify(
                    [
                        {
                            id: "duck-a",
                            name: "Alpha",
                            category: "Classic",
                            priceCents: 1000,
                            tagline: "A",
                            longDescription: "A",
                            personalityTraits: ["calm"],
                            stockCount: 0,
                        },
                    ],
                    null,
                    4
                )
            );
            await writeFile(ordersPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const catalogService = new CatalogService(repository);
            const detailService = new DuckDetailService(repository);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);
            const duckOfTheDayService = new DuckOfTheDayService(repository);
            const handler = createCatalogHandler(
                catalogService,
                detailService,
                cartService,
                checkoutService,
                undefined,
                duckOfTheDayService
            );

            const response = await requestPath<DuckOfTheDayResponse>(handler, "/api/ducks/of-the-day");
            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                emptyState: {
                    message: "The pond is empty today, come back tomorrow.",
                },
            });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("serves quiz questions and deterministic quiz results", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const duckOfTheDayService = new DuckOfTheDayService(repository);
        const quizService = new QuizService(repository);
        const handler = createCatalogHandler(
            catalogService,
            detailService,
            cartService,
            checkoutService,
            undefined,
            duckOfTheDayService,
            quizService
        );

        const questions = await requestPath<QuizQuestionsResponse>(handler, "/api/quiz/questions");
        expect(questions.status).toBe(200);
        expect(questions.body.questions).toHaveLength(5);

        const answers = {
            q1: "q1a",
            q2: "q2a",
            q3: "q3a",
            q4: "q4b",
            q5: "q5a",
        };

        const first = await requestPath<QuizResultResponse>(handler, "/api/quiz/result", {
            method: "POST",
            body: { answers },
        });
        const second = await requestPath<QuizResultResponse>(handler, "/api/quiz/result", {
            method: "POST",
            body: { answers },
        });

        expect(first.status).toBe(200);
        expect(first.body.duck.id).toBe(second.body.duck.id);
        expect(first.body.detailPath).toContain(first.body.duck.id);
    });

    it("applies composed search and filter params", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<CatalogResponse>(
            handler,
            "/api/ducks?q=compiled&category=Tech&maxPrice=19.00"
        );

        expect(response.status).toBe(200);
        expect(response.body.ducks).toHaveLength(1);
        expect(response.body.ducks[0].id).toBe("duck-005");
    });

    it("returns existential emptyState when filters yield no matches", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const response = await requestPath<CatalogResponse>(handler, "/api/ducks?q=nonexistent&minPrice=999");

        expect(response.status).toBe(200);
        expect(response.body.ducks).toEqual([]);
        expect(response.body.emptyState).toEqual({
            message: "No duck matches your existential criteria.",
        });
    });

    it("rejects invalid price query parameters", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const invalid = await requestPath<ErrorResponse>(handler, "/api/ducks?minPrice=-1");
        expect(invalid.status).toBe(400);
        expect(invalid.body).toEqual({ error: "minPrice must be a non-negative number" });

        const bounds = await requestPath<ErrorResponse>(handler, "/api/ducks?minPrice=20&maxPrice=10");
        expect(bounds.status).toBe(400);
        expect(bounds.body).toEqual({ error: "minPrice must be less than or equal to maxPrice" });
    });

    it("supports full cart workflow in a single session", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const start = await requestPath<CartResponse>(handler, "/api/cart");
        expect(start.status).toBe(200);
        expect(start.body.items).toEqual([]);
        expect(start.body.totalCents).toBe(0);
        expect(start.setCookie).toContain("sessionId=");

        const cookie = start.setCookie?.split(";")[0] ?? "";

        const added = await requestPath<CartResponse>(handler, "/api/cart/items", {
            method: "POST",
            body: { duckId: "duck-001", quantity: 2 },
            cookie,
        });
        expect(added.status).toBe(200);
        expect(added.body.items[0].duckId).toBe("duck-001");
        expect(added.body.items[0].quantity).toBe(2);

        const updated = await requestPath<CartResponse>(handler, "/api/cart/items/duck-001", {
            method: "PATCH",
            body: { quantity: 3 },
            cookie,
        });
        expect(updated.status).toBe(200);
        expect(updated.body.items[0].quantity).toBe(3);

        const removed = await requestPath<CartResponse>(handler, "/api/cart/items/duck-001", {
            method: "DELETE",
            cookie,
        });
        expect(removed.status).toBe(200);
        expect(removed.body.items).toEqual([]);
        expect(removed.body.totalCents).toBe(0);
    });

    it("rejects requests above stock limit", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const start = await requestPath<CartResponse>(handler, "/api/cart");
        const cookie = start.setCookie?.split(";")[0] ?? "";

        const rejected = await requestPath<ErrorResponse>(handler, "/api/cart/items", {
            method: "POST",
            body: { duckId: "duck-002", quantity: 3 },
            cookie,
        });

        expect(rejected.status).toBe(400);
        expect(rejected.body).toEqual({ error: "Requested quantity exceeds available stock" });
    });

    it("completes checkout, persists order and clears cart", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-checkout-api-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(
                ducksPath,
                JSON.stringify(
                    [
                        {
                            id: "duck-101",
                            name: "Checkout Duck",
                            category: "Classic",
                            priceCents: 1500,
                            tagline: "Ready to ship.",
                            longDescription: "Used for checkout API testing.",
                            personalityTraits: ["focused"],
                            stockCount: 3,
                        },
                    ],
                    null,
                    4
                )
            );
            await writeFile(ordersPath, "[]");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const catalogService = new CatalogService(repository);
            const detailService = new DuckDetailService(repository);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);
            const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

            const start = await requestPath<CartResponse>(handler, "/api/cart");
            const cookie = start.setCookie?.split(";")[0] ?? "";

            await requestPath<CartResponse>(handler, "/api/cart/items", {
                method: "POST",
                cookie,
                body: { duckId: "duck-101", quantity: 2 },
            });

            const checkout = await requestPath<CheckoutResponse>(handler, "/api/checkout", {
                method: "POST",
                cookie,
                body: createCheckoutRequest(),
            });

            expect(checkout.status).toBe(200);
            expect(checkout.body.orderId).toContain("ord_");
            expect(checkout.body.payment).toEqual({ method: "card", cardLast4: "1111" });
            expect(checkout.body.totalCents).toBe(3000);

            const cartAfter = await requestPath<CartResponse>(handler, "/api/cart", { cookie });
            expect(cartAfter.body.items).toEqual([]);

            const ordersRaw = await readFile(ordersPath, "utf8");
            const orders = JSON.parse(ordersRaw) as Array<{ orderId: string }>;
            expect(orders).toHaveLength(1);

            const ducksRaw = await readFile(ducksPath, "utf8");
            const ducks = JSON.parse(ducksRaw) as Array<{ stockCount: number }>;
            expect(ducks[0].stockCount).toBe(1);
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("rejects checkout for invalid email", async () => {
        const repository = new LocalJsonCatalogRepository(
            fileURLToPath(new URL("./data/ducks.json", import.meta.url))
        );
        const catalogService = new CatalogService(repository);
        const detailService = new DuckDetailService(repository);
        const cartService = new CartService(repository);
        const checkoutService = createFallbackCheckoutService();
        const handler = createCatalogHandler(catalogService, detailService, cartService, checkoutService);

        const start = await requestPath<CartResponse>(handler, "/api/cart");
        const cookie = start.setCookie?.split(";")[0] ?? "";

        await requestPath<CartResponse>(handler, "/api/cart/items", {
            method: "POST",
            cookie,
            body: { duckId: "duck-001", quantity: 1 },
        });

        const checkout = await requestPath<ErrorResponse>(handler, "/api/checkout", {
            method: "POST",
            cookie,
            body: createCheckoutRequest("bad-email"),
        });

        expect(checkout.status).toBe(400);
        expect(checkout.body).toEqual({ error: "email is invalid" });
    });

    it("rejects admin duck creation without valid password", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-admin-api-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, "[]\n", "utf8");
            await writeFile(ordersPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const catalogService = new CatalogService(repository);
            const detailService = new DuckDetailService(repository);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);
            const curatorService = new CuratorService(repository, "secret");
            const handler = createCatalogHandler(
                catalogService,
                detailService,
                cartService,
                checkoutService,
                curatorService
            );

            const response = await requestPath<ErrorResponse>(handler, "/api/admin/ducks", {
                method: "POST",
                body: {
                    name: "Admin Duck",
                    category: "Classic",
                    priceCents: 1200,
                    tagline: "Admin only.",
                    longDescription: "Created via admin endpoint.",
                    personalityTraits: ["strict"],
                    stockCount: 5,
                },
            });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: "Unauthorized" });
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });

    it("creates a duck through admin endpoint and shows it in catalog", async () => {
        const testDir = await mkdtemp(join(tmpdir(), "duck-admin-api-"));
        try {
            const ducksPath = join(testDir, "ducks.json");
            const ordersPath = join(testDir, "orders.json");
            await writeFile(ducksPath, "[]\n", "utf8");
            await writeFile(ordersPath, "[]\n", "utf8");

            const repository = new LocalJsonCatalogRepository(ducksPath);
            const catalogService = new CatalogService(repository);
            const detailService = new DuckDetailService(repository);
            const cartService = new CartService(repository);
            const checkoutService = new CheckoutService(cartService, repository, ordersPath);
            const curatorService = new CuratorService(repository, "secret");
            const handler = createCatalogHandler(
                catalogService,
                detailService,
                cartService,
                checkoutService,
                curatorService
            );

            const server = createServer((request, response) => {
                void handler(request, response);
            });

            await new Promise<void>((resolve) => {
                server.listen(0, resolve);
            });

            const address = server.address();
            if (!address || typeof address === "string") {
                throw new Error("Server address is not available");
            }

            try {
                const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/admin/ducks`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "x-admin-password": "secret",
                    },
                    body: JSON.stringify({
                        name: "Admiral Quack",
                        category: "Nautical",
                        priceCents: 2100,
                        tagline: "Leads the fleet.",
                        longDescription: "An admin-created duck for naval adventures.",
                        personalityTraits: ["bold", "strategic"],
                        stockCount: 3,
                    }),
                });

                const created = (await createResponse.json()) as Duck;
                expect(createResponse.status).toBe(201);
                expect(created.name).toBe("Admiral Quack");

                const catalogResponse = await requestPath<CatalogResponse>(handler, "/api/ducks");
                expect(catalogResponse.body.ducks.map((duck) => duck.name)).toContain("Admiral Quack");
            } finally {
                await new Promise<void>((resolve, reject) => {
                    server.close((error) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve();
                    });
                });
            }
        } finally {
            await rm(testDir, { recursive: true, force: true });
        }
    });
});
