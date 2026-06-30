# Tasks: browse-catalog

1. Define Duck domain model and local JSON catalog repository with validation.
- Deliverables:
  - duck-emporium/src/catalog/types.ts
  - duck-emporium/src/catalog/catalog-repository.ts
  - duck-emporium/src/catalog/catalog-repository.test.ts
- Acceptance check:
  - In duck-emporium, vitest for catalog-repository tests passes.
- Dependencies: none.

2. Add seed catalog data file with >=10 ducks across >=3 categories.
- Deliverables:
  - duck-emporium/src/data/ducks.json
  - tests asserting record count and category diversity.
- Acceptance check:
  - In duck-emporium, vitest seed-data tests pass.
- Dependencies: 1.

3. Implement catalog service empty-state behavior.
- Deliverables:
  - duck-emporium/src/catalog/catalog-service.ts
  - duck-emporium/src/catalog/catalog-service.test.ts
- Acceptance check:
  - In duck-emporium, vitest service tests pass.
- Dependencies: 1, 2.

4. Implement GET /api/ducks endpoint for catalog retrieval.
- Deliverables:
  - duck-emporium/src/server.ts (or route module)
  - duck-emporium/src/server.test.ts
- Acceptance check:
  - In duck-emporium, vitest API tests pass and response includes ducks list or explicit emptyState.
- Dependencies: 1, 2, 3.
