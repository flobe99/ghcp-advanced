import type { CatalogRepository, Duck } from "../catalog/types";

type QuizOption = {
    id: string;
    text: string;
    weights: Record<string, number>;
};

type QuizQuestion = {
    id: string;
    prompt: string;
    options: QuizOption[];
};

export type PublicQuizQuestion = {
    id: string;
    prompt: string;
    options: Array<{
        id: string;
        text: string;
    }>;
};

export type QuizResult = {
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

export class QuizServiceError extends Error {
    public constructor(public readonly statusCode: number, message: string) {
        super(message);
    }
}

const QUESTIONS: QuizQuestion[] = [
    {
        id: "q1",
        prompt: "How do you start your day?",
        options: [
            { id: "q1a", text: "A neat checklist and clean desk", weights: { Classic: 2, Tech: 1 } },
            { id: "q1b", text: "A spontaneous quest and maybe a map", weights: { Adventure: 2, Nautical: 1 } },
            { id: "q1c", text: "With ceremony and style", weights: { Royal: 2 } },
        ],
    },
    {
        id: "q2",
        prompt: "Which slogan fits you best?",
        options: [
            { id: "q2a", text: "Ship it, then optimize", weights: { Tech: 2, Adventure: 1 } },
            { id: "q2b", text: "Stay steady through any storm", weights: { Nautical: 2, Classic: 1 } },
            { id: "q2c", text: "Polish every tiny detail", weights: { Royal: 2, Classic: 1 } },
        ],
    },
    {
        id: "q3",
        prompt: "Your ideal weekend is...",
        options: [
            { id: "q3a", text: "Building a gadget", weights: { Tech: 2 } },
            { id: "q3b", text: "Exploring somewhere new", weights: { Adventure: 2 } },
            { id: "q3c", text: "Hosting a small elegant gathering", weights: { Royal: 2 } },
        ],
    },
    {
        id: "q4",
        prompt: "In group projects, you are usually...",
        options: [
            { id: "q4a", text: "The calm anchor", weights: { Nautical: 2, Classic: 1 } },
            { id: "q4b", text: "The rapid prototyper", weights: { Tech: 2 } },
            { id: "q4c", text: "The morale captain", weights: { Adventure: 2, Royal: 1 } },
        ],
    },
    {
        id: "q5",
        prompt: "Pick a duck-sized superpower:",
        options: [
            { id: "q5a", text: "Perfect timing", weights: { Classic: 2 } },
            { id: "q5b", text: "Fearless navigation", weights: { Nautical: 2, Adventure: 1 } },
            { id: "q5c", text: "Elegant charisma", weights: { Royal: 2, Tech: 1 } },
        ],
    },
];

const CATEGORY_MESSAGES: Record<string, string> = {
    Classic: "You value clarity and reliability. Your duck match is a dependable companion.",
    Nautical: "You stay calm in rough waters. Your duck match thrives under pressure.",
    Tech: "You think in systems and shortcuts. Your duck match loves clever solutions.",
    Royal: "You bring style and confidence. Your duck match knows how to make an entrance.",
    Adventure: "You chase stories and new paths. Your duck match is always ready to explore.",
};

function hashText(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
}

export class QuizService {
    public constructor(private readonly repository: CatalogRepository) { }

    public getQuestions(): PublicQuizQuestion[] {
        return QUESTIONS.map((question) => ({
            id: question.id,
            prompt: question.prompt,
            options: question.options.map((option) => ({
                id: option.id,
                text: option.text,
            })),
        }));
    }

    public async evaluate(answers: unknown): Promise<QuizResult> {
        if (typeof answers !== "object" || answers === null) {
            throw new QuizServiceError(400, "answers must be an object");
        }

        const answerMap = answers as Record<string, unknown>;
        const scores = new Map<string, number>();
        const answerFingerprintParts: string[] = [];

        for (const question of QUESTIONS) {
            const selectedOptionId = answerMap[question.id];
            if (typeof selectedOptionId !== "string" || selectedOptionId.length === 0) {
                throw new QuizServiceError(400, `Missing answer for ${question.id}`);
            }

            const option = question.options.find((entry) => entry.id === selectedOptionId);
            if (!option) {
                throw new QuizServiceError(400, `Invalid answer for ${question.id}`);
            }

            answerFingerprintParts.push(`${question.id}:${selectedOptionId}`);
            for (const [category, points] of Object.entries(option.weights)) {
                scores.set(category, (scores.get(category) ?? 0) + points);
            }
        }

        if (scores.size === 0) {
            throw new QuizServiceError(400, "No scores calculated for quiz answers");
        }

        const topScore = Math.max(...Array.from(scores.values()));
        const topCategories = Array.from(scores.entries())
            .filter(([, score]) => score === topScore)
            .map(([category]) => category)
            .sort((a, b) => a.localeCompare(b));

        const selectedCategory = topCategories[0];
        const ducks = await this.repository.getAll();

        const categoryMatches = ducks
            .filter((duck) => duck.category === selectedCategory)
            .sort((a, b) => a.id.localeCompare(b.id));
        const candidates = (categoryMatches.length > 0 ? categoryMatches : ducks)
            .filter((duck) => duck.stockCount > 0)
            .sort((a, b) => a.id.localeCompare(b.id));

        if (candidates.length === 0) {
            throw new QuizServiceError(400, "No in-stock ducks available for recommendation");
        }

        const fingerprint = answerFingerprintParts.join("|");
        const selectedDuck = candidates[hashText(fingerprint) % candidates.length];

        return {
            duck: {
                id: selectedDuck.id,
                name: selectedDuck.name,
                category: selectedDuck.category,
                priceCents: selectedDuck.priceCents,
                tagline: selectedDuck.tagline,
            },
            message:
                CATEGORY_MESSAGES[selectedCategory] ??
                "Your answers point to a balanced duck with versatile vibes.",
            detailPath: `/?duckId=${encodeURIComponent(selectedDuck.id)}`,
            tieBreakRule: "If category scores tie, the alphabetically first category is selected.",
        };
    }
}
