import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { CatalogService } from "./catalog/catalog-service";
import { LocalJsonCatalogRepository } from "./catalog/catalog-repository";
import { DuckDetailService } from "./catalog/duck-detail-service";
import { DuckOfTheDayService } from "./catalog/duck-of-the-day-service";
import { CartService, CartServiceError } from "./cart/cart-service";
import { CheckoutService, CheckoutServiceError } from "./checkout/checkout-service";
import { CuratorService, CuratorServiceError } from "./admin/curator-service";
import { QuizService, QuizServiceError } from "./quiz/quiz-service";

function parsePriceToCents(value: string | null, paramName: string): number | undefined {
    if (value === null || value.trim().length === 0) {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new CartServiceError(400, `${paramName} must be a non-negative number`);
    }

    return Math.round(parsed * 100);
}

function parseCatalogFilters(url: URL) {
    const queryText = url.searchParams.get("q")?.trim() ?? "";
    const categoryValues = url.searchParams
        .getAll("category")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

    const minPriceCents = parsePriceToCents(url.searchParams.get("minPrice"), "minPrice");
    const maxPriceCents = parsePriceToCents(url.searchParams.get("maxPrice"), "maxPrice");

    if (
        typeof minPriceCents === "number" &&
        typeof maxPriceCents === "number" &&
        minPriceCents > maxPriceCents
    ) {
        throw new CartServiceError(400, "minPrice must be less than or equal to maxPrice");
    }

    return {
        queryText,
        categories: categoryValues,
        minPriceCents,
        maxPriceCents,
    };
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
}

function contentTypeForAsset(pathname: string): string {
    if (pathname.endsWith(".css")) {
        return "text/css; charset=utf-8";
    }
    if (pathname.endsWith(".js")) {
        return "text/javascript; charset=utf-8";
    }
    return "application/octet-stream";
}

async function sendFile(response: ServerResponse, filePath: string, contentType: string): Promise<void> {
    try {
        const content = await readFile(filePath);
        response.statusCode = 200;
        response.setHeader("content-type", contentType);
        response.end(content);
    } catch {
        sendJson(response, 404, { error: "Not found" });
    }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) {
        return {};
    }

    return cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter((part) => part.includes("="))
        .reduce<Record<string, string>>((acc, part) => {
            const separatorIndex = part.indexOf("=");
            const key = part.slice(0, separatorIndex).trim();
            const value = part.slice(separatorIndex + 1).trim();
            acc[key] = value;
            return acc;
        }, {});
}

function ensureSessionId(request: IncomingMessage, response: ServerResponse): string {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies.sessionId;

    if (sessionId && sessionId.length > 0) {
        return sessionId;
    }

    const newSessionId = randomUUID();
    response.setHeader("set-cookie", `sessionId=${newSessionId}; Path=/; HttpOnly; SameSite=Lax`);
    return newSessionId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (raw.length === 0) {
        return {};
    }

    return JSON.parse(raw) as unknown;
}

function getQuantityFromBody(body: unknown, defaultValue?: number): number {
    if (!isRecord(body)) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new CartServiceError(400, "Request body must be an object");
    }

    if (!("quantity" in body)) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new CartServiceError(400, "quantity is required");
    }

    return body.quantity as number;
}

function getDuckIdFromBody(body: unknown): string {
    if (!isRecord(body) || typeof body.duckId !== "string" || body.duckId.trim().length === 0) {
        throw new CartServiceError(400, "duckId is required");
    }
    return body.duckId;
}

export function createCatalogHandler(
    catalogService: CatalogService,
    detailService: DuckDetailService,
    cartService: CartService,
    checkoutService: CheckoutService,
    curatorService?: CuratorService,
    duckOfTheDayService?: DuckOfTheDayService,
    quizService?: QuizService
) {
    return async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", "http://localhost");

        if (method === "GET" && url.pathname === "/") {
            const indexPath = join(process.cwd(), "src", "web", "index.html");
            await sendFile(response, indexPath, "text/html; charset=utf-8");
            return;
        }

        if (method === "GET" && url.pathname.startsWith("/assets/")) {
            const assetPath = join(process.cwd(), "src", "web", url.pathname);
            await sendFile(response, assetPath, contentTypeForAsset(url.pathname));
            return;
        }

        if (method === "GET" && url.pathname === "/api/ducks") {
            try {
                const filters = parseCatalogFilters(url);
                const catalog = await catalogService.getCatalog(filters);
                sendJson(response, 200, catalog);
                return;
            } catch (error) {
                if (error instanceof CartServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to load catalog" });
                return;
            }
        }

        if (method === "GET" && url.pathname === "/api/ducks/of-the-day") {
            try {
                if (!duckOfTheDayService) {
                    sendJson(response, 500, { error: "Duck of the day service is not configured" });
                    return;
                }

                const result = await duckOfTheDayService.getDuckOfTheDay();
                sendJson(response, 200, result);
                return;
            } catch {
                sendJson(response, 500, { error: "Failed to load duck of the day" });
                return;
            }
        }

        if (method === "GET" && url.pathname === "/api/quiz/questions") {
            try {
                if (!quizService) {
                    sendJson(response, 500, { error: "Quiz service is not configured" });
                    return;
                }

                sendJson(response, 200, { questions: quizService.getQuestions() });
                return;
            } catch {
                sendJson(response, 500, { error: "Failed to load quiz questions" });
                return;
            }
        }

        if (method === "POST" && url.pathname === "/api/quiz/result") {
            try {
                if (!quizService) {
                    sendJson(response, 500, { error: "Quiz service is not configured" });
                    return;
                }

                const body = await readJsonBody(request);
                const answers = isRecord(body) ? body.answers : undefined;
                const result = await quizService.evaluate(answers);
                sendJson(response, 200, result);
                return;
            } catch (error) {
                if (error instanceof QuizServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }

                sendJson(response, 500, { error: "Failed to evaluate quiz" });
                return;
            }
        }

        const detailMatch = /^\/api\/ducks\/([^/]+)$/.exec(url.pathname);
        if (method === "GET" && detailMatch) {
            try {
                const duck = await detailService.getById(decodeURIComponent(detailMatch[1]));
                if (!duck) {
                    sendJson(response, 404, { error: "Duck not found" });
                    return;
                }

                sendJson(response, 200, duck);
                return;
            } catch {
                sendJson(response, 500, { error: "Failed to load duck detail" });
                return;
            }
        }

        if (method === "GET" && url.pathname === "/api/cart") {
            try {
                const sessionId = ensureSessionId(request, response);
                const cart = await cartService.getCart(sessionId);
                sendJson(response, 200, cart);
                return;
            } catch {
                sendJson(response, 500, { error: "Failed to load cart" });
                return;
            }
        }

        if (method === "POST" && url.pathname === "/api/cart/items") {
            try {
                const sessionId = ensureSessionId(request, response);
                const body = await readJsonBody(request);
                const duckId = getDuckIdFromBody(body);
                const quantity = getQuantityFromBody(body, 1);
                const cart = await cartService.addItem(sessionId, duckId, quantity);
                sendJson(response, 200, cart);
                return;
            } catch (error) {
                if (error instanceof CartServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to add item to cart" });
                return;
            }
        }

        const cartItemMatch = /^\/api\/cart\/items\/([^/]+)$/.exec(url.pathname);
        if (method === "PATCH" && cartItemMatch) {
            try {
                const sessionId = ensureSessionId(request, response);
                const body = await readJsonBody(request);
                const quantity = getQuantityFromBody(body);
                const duckId = decodeURIComponent(cartItemMatch[1]);
                const cart = await cartService.updateItem(sessionId, duckId, quantity);
                sendJson(response, 200, cart);
                return;
            } catch (error) {
                if (error instanceof CartServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to update cart item" });
                return;
            }
        }

        if (method === "DELETE" && cartItemMatch) {
            try {
                const sessionId = ensureSessionId(request, response);
                const duckId = decodeURIComponent(cartItemMatch[1]);
                const cart = await cartService.removeItem(sessionId, duckId);
                sendJson(response, 200, cart);
                return;
            } catch (error) {
                if (error instanceof CartServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to remove cart item" });
                return;
            }
        }

        if (method === "POST" && url.pathname === "/api/checkout") {
            try {
                const sessionId = ensureSessionId(request, response);
                const body = await readJsonBody(request);
                const checkout = await checkoutService.checkout(sessionId, body as never);
                sendJson(response, 200, {
                    orderId: checkout.orderId,
                    createdAt: checkout.createdAt,
                    payment: checkout.payment,
                    items: checkout.items,
                    totalCents: checkout.totalCents,
                });
                return;
            } catch (error) {
                if (error instanceof CheckoutServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to checkout" });
                return;
            }
        }

        if (method === "POST" && url.pathname === "/api/admin/ducks") {
            try {
                if (!curatorService) {
                    sendJson(response, 500, { error: "Curator service is not configured" });
                    return;
                }

                const body = await readJsonBody(request);
                const header = request.headers["x-admin-password"];
                const providedPassword = Array.isArray(header) ? header[0] : header;
                const createdDuck = await curatorService.addDuck(body, providedPassword);
                sendJson(response, 201, createdDuck);
                return;
            } catch (error) {
                if (error instanceof CuratorServiceError) {
                    sendJson(response, error.statusCode, { error: error.message });
                    return;
                }
                sendJson(response, 500, { error: "Failed to add duck" });
                return;
            }
        }

        sendJson(response, 404, { error: "Not found" });
    };
}

export function createDefaultServer() {
    const filePath = join(process.cwd(), "src", "data", "ducks.json");
    const repository = new LocalJsonCatalogRepository(filePath);
    const catalogService = new CatalogService(repository);
    const detailService = new DuckDetailService(repository);
    const cartService = new CartService(repository);
    const ordersFilePath = join(process.cwd(), "src", "data", "orders.json");
    const checkoutService = new CheckoutService(cartService, repository, ordersFilePath);
    const curatorService = new CuratorService(repository, process.env.ADMIN_PASSWORD);
    const duckOfTheDayService = new DuckOfTheDayService(repository);
    const quizService = new QuizService(repository);

    return createServer(
        createCatalogHandler(
            catalogService,
            detailService,
            cartService,
            checkoutService,
            curatorService,
            duckOfTheDayService,
            quizService
        )
    );
}
