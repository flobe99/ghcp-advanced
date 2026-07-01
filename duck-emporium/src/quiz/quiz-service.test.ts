import { describe, expect, it } from "vitest";

import { QuizService } from "./quiz-service";
import type { CatalogRepository, Duck } from "../catalog/types";

function createRepository(ducks: Duck[]): CatalogRepository {
    return {
        async getAll(): Promise<Duck[]> {
            return ducks;
        },
        async getById(id: string): Promise<Duck | null> {
            return ducks.find((duck) => duck.id === id) ?? null;
        },
    };
}

function answersA() {
    return {
        q1: "q1a",
        q2: "q2a",
        q3: "q3a",
        q4: "q4b",
        q5: "q5a",
    };
}

describe("QuizService", () => {
    const ducks: Duck[] = [
        {
            id: "duck-001",
            name: "Debugger Duck",
            category: "Classic",
            priceCents: 1299,
            tagline: "Finds bugs.",
            longDescription: "Classic duck.",
            personalityTraits: ["calm"],
            stockCount: 5,
        },
        {
            id: "duck-005",
            name: "Pixel Quacker",
            category: "Tech",
            priceCents: 1899,
            tagline: "Compiled speed.",
            longDescription: "Tech duck.",
            personalityTraits: ["fast"],
            stockCount: 4,
        },
        {
            id: "duck-003",
            name: "Captain Quack",
            category: "Nautical",
            priceCents: 1599,
            tagline: "Fleet commander.",
            longDescription: "Nautical duck.",
            personalityTraits: ["steady"],
            stockCount: 4,
        },
    ];

    it("returns 5 quiz questions", () => {
        const service = new QuizService(createRepository(ducks));
        const questions = service.getQuestions();

        expect(questions).toHaveLength(5);
        expect(questions[0].options.length).toBeGreaterThan(1);
    });

    it("returns deterministic recommendation for same answers", async () => {
        const service = new QuizService(createRepository(ducks));

        const first = await service.evaluate(answersA());
        const second = await service.evaluate(answersA());

        expect(first.duck.id).toBe(second.duck.id);
        expect(first.detailPath).toContain(first.duck.id);
    });

    it("applies deterministic tie-break rule", async () => {
        const service = new QuizService(createRepository(ducks));
        const tieAnswers = {
            q1: "q1a",
            q2: "q2c",
            q3: "q3b",
            q4: "q4a",
            q5: "q5a",
        };

        const result = await service.evaluate(tieAnswers);
        expect(result.tieBreakRule).toContain("alphabetically first category");
        expect(typeof result.message).toBe("string");
    });
});
